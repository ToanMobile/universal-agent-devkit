# 33 — Deep Linking

## Intent Filters

### AndroidManifest — Intent Filters
```xml
<activity android:name=".ReaderOfficeActivity">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="file" />
        <data android:scheme="content" />
        <data android:mimeType="application/pdf" />
        <data android:mimeType="application/epub+zip" />
        <!-- Add all supported mime types -->
    </intent-filter>
</activity>
```

### Handle Intent in Activity
```kotlin
class ReaderOfficeActivity : BaseActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIntent(intent)
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }
    
    private fun handleIntent(intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_VIEW -> {
                val uri = intent.data
                if (uri != null && validateUri(uri)) {
                    openDocument(uri)
                }
            }
        }
    }
}
```

## URI Security — Validation
```kotlin
fun validateUri(uri: Uri): Boolean {
    // Check scheme
    if (uri.scheme !in listOf("file", "content")) return false
    
    // Check path traversal
    val path = uri.path ?: return false
    if (path.contains("..")) return false
    
    // Check extension
    val extension = path.substringAfterLast('.', "").lowercase()
    if (extension !in ALLOWED_EXTENSIONS) return false
    
    return true
}

val ALLOWED_EXTENSIONS = listOf(
    "pdf", "epub", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "html", "xml", "json", "djvu",
    "png", "jpg", "jpeg", "gif", "svg", "webp",
    "cbz", "cbr", "zip", "mp3", "m4b"
)
```

### Path Traversal Prevention
```kotlin
// ❌ Vulnerable
fun readFile(userInputPath: String) {
    File(baseDir, userInputPath) // userInputPath could be "../../../etc/passwd"
}

// ✅ Safe
fun readFile(userInputPath: String): File? {
    val file = File(baseDir, userInputPath)
    val canonicalPath = file.canonicalPath
    val canonicalBase = baseDir.canonicalPath
    if (!canonicalPath.startsWith(canonicalBase)) {
        Timber.w("Path traversal attempt: $userInputPath")
        return null
    }
    return file
}
```

## Compose Navigation — Deep Link Routes
```kotlin
composable(
    route = "document/{documentId}",
    arguments = listOf(navArgument("documentId") { type = NavType.StringType }),
    deepLinks = listOf(
        navDeepLink {
            uriPattern = "office-reader://document/{documentId}"
        }
    )
) { backStackEntry ->
    val documentId = backStackEntry.arguments?.getString("documentId")
    DocumentViewerScreen(documentId = documentId)
}
```

## Persistent URI Permissions
```kotlin
// Take persistent permission
val takeFlags = intent.flags and (
    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
)
contentResolver.takePersistableUriPermission(uri, takeFlags)

// Store URI as string for later use
dataStore.edit { prefs ->
    prefs[stringPreferencesKey("last_opened_uri")] = uri.toString()
}

// Restore permission when opening later
val uri = Uri.parse(savedUriString)
contentResolver.takePersistableUriPermission(
    uri,
    Intent.FLAG_GRANT_READ_URI_PERMISSION
)
```

## Anti-Patterns
- ❌ Trusting external URI without validation.
- ❌ Using `file://` scheme from external intents (use `content://`).
- ❌ Opening files without checking extension whitelist.
- ❌ Storing file paths without canonical path check.
