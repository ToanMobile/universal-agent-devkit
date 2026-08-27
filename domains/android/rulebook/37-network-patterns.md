# 37 — Network Patterns

## Retrofit Setup

### Rules
- All network calls are `suspend` functions.
- Return `Result<T>` or `AppResult<T>` — never raw Retrofit response.
- Timeout configured globally.
- OkHttp interceptors ordered correctly.

---

## OkHttp Interceptors

### Interceptor Order
```kotlin
val okHttpClient = OkHttpClient.Builder()
    .addInterceptor(AuthInterceptor())        // First — add auth headers
    .addInterceptor(ConnectivityInterceptor()) // Check network
    .addInterceptor(CacheInterceptor())        // Cache responses
    .addInterceptor(LoggingInterceptor())      // Last — log request/response
    .build()
```

### Auth Interceptor Pattern
```kotlin
class AuthInterceptor @Inject constructor(
    private val tokenProvider: TokenProvider
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider.getToken()
        val request = if (token != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}
```

### Connectivity Interceptor
```kotlin
class ConnectivityInterceptor @Inject constructor(
    @ApplicationContext private val context: Context
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        if (!isNetworkAvailable()) {
            throw NoConnectivityException()
        }
        return chain.proceed(chain.request())
    }
    
    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return cm.activeNetwork?.let { network ->
            cm.getNetworkCapabilities(network)
                ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } == true
    }
}
```

### Logging — Debug Only
```kotlin
if (BuildConfig.DEBUG) {
    builder.addInterceptor(HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    })
}
```

## Caching

### OkHttp Cache
```kotlin
val cacheDir = File(context.cacheDir, "http_cache")
val cache = Cache(cacheDir, 10 * 1024 * 1024) // 10 MB

val client = OkHttpClient.Builder()
    .cache(cache)
    .build()
```

### Cache-Control Headers
```kotlin
// Online: cache for 5 minutes
class CacheInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        return response.newBuilder()
            .header("Cache-Control", "public, max-age=300")
            .build()
    }
}

// Offline: use cache up to 7 days
class OfflineCacheInterceptor @Inject constructor(
    @ApplicationContext private val context: Context
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        var request = chain.request()
        if (!isNetworkAvailable()) {
            request = request.newBuilder()
                .header("Cache-Control", "public, only-if-cached, max-stale=${7 * 24 * 60 * 60}")
                .build()
        }
        return chain.proceed(request)
    }
}
```

---

## Timeout & Retry

### Timeout Configuration
```kotlin
val client = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(60, TimeUnit.SECONDS) // longer for uploads
    .build()
```

### Retry Pattern (in Repository)
```kotlin
suspend fun fetchWithRetry(
    maxRetries: Int = 3,
    initialDelay: Long = 1000,
    block: suspend () -> Response
): Response {
    var delay = initialDelay
    repeat(maxRetries - 1) { attempt ->
        try {
            return block()
        } catch (e: IOException) {
            Timber.w(e, "Network attempt ${attempt + 1} failed, retrying in ${delay}ms")
            delay(delay)
            delay *= 2 // exponential backoff
        }
    }
    return block() // last attempt, let exception propagate
}
```

---

## Repository Pattern

### Repository Layer — Map Network Errors
```kotlin
@Singleton
class DocumentRepository @Inject constructor(
    private val api: DocumentApi,
    private val dao: DocumentDao,
    private val connectivityChecker: ConnectivityChecker
) {
    
    suspend fun getDocuments(): AppResult<List<Document>> {
        return try {
            val remoteDocuments = api.getDocuments()
            dao.insertAll(remoteDocuments.map { it.toEntity() })
            AppResult.Success(remoteDocuments)
        } catch (e: NoConnectivityException) {
            // Offline: use cache
            val localDocuments = dao.getAll()
            AppResult.Success(localDocuments.map { it.toDomain() })
        } catch (e: HttpException) {
            AppResult.Error(AppError.NetworkError(e.code()))
        } catch (e: IOException) {
            AppResult.Error(AppError.NetworkError(0))
        }
    }
}
```

### Document Reader Pattern
```kotlin
// Network for metadata, local for content
suspend fun getDocumentContent(id: String): AppResult<ByteArray> {
    // Always read content from local file (fast, offline)
    val localFile = File(context.filesDir, "documents/$id")
    if (localFile.exists()) {
        return AppResult.Success(localFile.readBytes())
    }
    
    // Download if not cached
    return try {
        val content = api.downloadDocument(id)
        localFile.writeBytes(content)
        AppResult.Success(content)
    } catch (e: IOException) {
        AppResult.Error(AppError.NetworkError(0))
    }
}
```

## Connectivity Monitoring
```kotlin
@Singleton
class ConnectivityChecker @Inject constructor(
    @ApplicationContext private val context: Context
) {
    val isOnline: StateFlow<Boolean> = callbackFlow {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { trySend(true) }
            override fun onLost(network: Network) { trySend(false) }
        }
        cm.registerDefaultNetworkCallback(callback)
        // Initial state
        trySend(cm.activeNetwork != null)
        awaitClose { cm.unregisterNetworkCallback(callback) }
    }.stateIn(CoroutineScope(Dispatchers.Default), SharingStarted.WhileSubscribed(5000), true)
}
```

## DI Setup (Hilt)
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    
    @Provides
    @Singleton
    fun provideOkHttpClient(
        @ApplicationContext context: Context,
        authInterceptor: AuthInterceptor,
        connectivityInterceptor: ConnectivityInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(connectivityInterceptor)
            .cache(Cache(File(context.cacheDir, "http_cache"), 10 * 1024 * 1024))
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }
    
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(Json.asConverterFactory("application/json".toMediaType()))
            .build()
    }
}
```

## Rules
- All API calls go through Repository (never call API directly from ViewModel).
- Repository returns `AppResult<T>` or `Result<T>`.
- Use `suspend` functions for one-shot calls, `Flow` for streaming.
- Always handle `NoConnectivityException` with offline fallback.
- Never expose OkHttp/Retrofit types outside Data layer.
