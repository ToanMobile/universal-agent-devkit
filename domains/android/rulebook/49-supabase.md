# 49 — Supabase

## Client Setup
```kotlin
val supabaseClient = createSupabaseClient(
    supabaseUrl = BuildConfig.SUPABASE_URL,
    supabaseKey = BuildConfig.SUPABASE_ANON_KEY
) {
    install(Auth)
    install(Storage)
    install(Postgrest)
    install(Realtime)
}
```

---

## Authentication

### Google Sign-In (OAuth)
```kotlin
suspend fun signInWithGoogle(context: Context): Result<User> {
    return try {
        supabaseClient.auth.signInWith(Google) {
            nativeAuth(context)
        }
        val user = supabaseClient.auth.currentUserOrNull()
            ?: return Result.failure(AuthError("Sign-in failed"))
        Result.success(user)
    } catch (e: Exception) {
        Timber.e(e, "Google sign-in failed")
        Result.failure(e)
    }
}
```

### Session Management
```kotlin
// Check session on app start
fun observeSession(): Flow<SessionStatus> = callbackFlow {
    val listener = AuthStateChangeListener { status, session ->
        when (status) {
            AuthState.SIGNED_IN -> trySend(SessionStatus.Authenticated(session?.user))
            AuthState.SIGNED_OUT -> trySend(SessionStatus.Unauthenticated)
            AuthState.INITIAL_SESSION -> {} // wait
            AuthState.TOKEN_REFRESHED -> {} // transparent
        }
    }
    supabaseClient.auth.addAuthStateListener(listener)
    awaitClose { supabaseClient.auth.removeAuthStateListener(listener) }
}

// Deep link in AndroidManifest
// Handle OAuth redirect
```

---

## Cloud Storage

### Upload Document
```kotlin
suspend fun uploadDocument(userId: String, file: File, documentName: String): Result<String> {
    return try {
        val path = "$userId/${UUID.randomUUID()}_$documentName"
        supabaseClient.storage["documents"].upload(
            path = path,
            data = file.readBytes(),
            upsert = false
        )
        val publicUrl = supabaseClient.storage["documents"].publicUrl(path)
        Result.success(publicUrl)
    } catch (e: Exception) {
        Timber.e(e, "Upload failed")
        Result.failure(e)
    }
}
```

### Storage Rules (Row Level Security)
```sql
-- Supabase SQL Editor
CREATE POLICY "Users can access own documents"
ON storage.objects
FOR ALL USING (
    auth.uid() = (storage.foldername(name))[1]::uuid
);
```

---

## Database (Postgrest)

### Sync Documents with Room
```kotlin
suspend fun syncDocuments(userId: String): Result<Unit> {
    return try {
        val remoteDocuments = supabaseClient.postgrest["documents"]
            .select {
                filter { eq("user_id", userId) }
                order("updated_at", Order.DESC)
            }.decodeList<DocumentDto>()
        
        // Save to Room (single source of truth)
        database.documentDao().upsertAll(
            remoteDocuments.map { it.toEntity() }
        )
        Result.success(Unit)
    } catch (e: Exception) {
        Timber.e(e, "Sync failed")
        Result.failure(e)
    }
}
```

## Realtime Subscriptions
```kotlin
suspend fun subscribeToChanges(userId: String) {
    supabaseClient.realtime.connect()
    
    val channel = supabaseClient.realtime.createChannel(
        SupabaseRealtime.CHANNEL_DOCUMENTS
    ) {
        // Listen for inserts
        postgresChangeFlow<PostgresAction.Insert>(
            schema = "public",
            table = "documents",
            filter = "user_id=eq.$userId"
        ).collect { action ->
            val document = action.decodeRecord<DocumentDto>()
            database.documentDao().insert(document.toEntity())
        }
        
        // Listen for deletes
        postgresChangeFlow<PostgresAction.Delete>(
            schema = "public",
            table = "documents"
        ).collect { action ->
            val id = action.oldRecord["id"].toString()
            database.documentDao().deleteById(id)
        }
    }
    
    supabaseClient.realtime.subscribe(channel)
}
```

## Security
- RLS policies for ALL tables.
- Storage bucket policies per user.
- Never expose `service_role` key in client.
- Use `anon` key for client, `service_role` only on server.
- Encrypt local cache (Room with SQLCipher if storing sensitive data).

## Rules
- Always sync to Room (offline-first).
- Handle network errors gracefully (show cached data).
- Use `upsert` for conflict-free sync.
- Realtime subscriptions only for active screens.
- Logout clears local data AND Supabase session.

## Anti-Patterns
- ❌ Using `service_role` key in client app.
- ❌ Direct UI → Supabase calls (go through Repository → Room).
- ❌ Syncing without conflict resolution (use `updated_at` timestamps).
- ❌ Keeping realtime channels open when screen not visible.
