# 16 — Security

## Logging
- ❌ Never log sensitive data: tokens, passwords, emails, file paths, PII.
- Use `Timber.d()` for debug, `Timber.e()` for errors (no sensitive data).
- Release builds: `Timber` does NOT log above `w` level (configured in Application).

## Secure Storage

### EncryptedSharedPreferences for sensitive data
```kotlin
// Tokens, API keys, user credentials → EncryptedSharedPreferences
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

### DataStore for non-sensitive settings
```kotlin
// Theme, language, preferences → DataStore
val dataStore = context.dataStore
```

## Network Security

### TLS Configuration
```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

### Certificate Pinning (for sensitive APIs)
```xml
<domain-config>
    <domain includeSubdomains="true">api.office-reader.com</domain>
    <pin-set>
        <pin digest="SHA-256">sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>
        <pin digest="SHA-256">sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>
    </pin-set>
</domain-config>
```

### Network Rules
- All APIs use HTTPS (enforced by `network_security_config.xml`).
- Certificate pinning for Supabase, Firebase APIs.
- No `http://` in production code.

## Code Obfuscation (R8/ProGuard)
- Release always obfuscated (`minifyEnabled = true`).
- Keep rules for reflection-based libraries (Hilt, Kotlin Serialization, Room).
- Mapping files saved for crash deobfuscation.

## Input Validation
- Validate all user input before processing.
- Sanitize file names (no path traversal: `../`, `..\\`).
- Validate URIs from external intents.

### File Path Validation
```kotlin
fun isPathSafe(context: Context, uri: Uri): Boolean {
    val path = uri.path ?: return false
    // No path traversal
    if (path.contains("..")) return false
    // Only allowed extensions
    val extension = path.substringAfterLast('.', "").lowercase()
    return extension in ALLOWED_EXTENSIONS
}
```

## Intent & Deep Link Security
- Validate all incoming Intent data.
- No sensitive data passed via Intent extras (use internal storage + ID).
- Export only necessary components in AndroidManifest.
