# 35 — File Permissions

## Android Storage Model (API Level Matrix)
| API Level | Default Access | Permission Required |
|:---|:---|:---|
| ≤ 9 (API 28-) | Full `READ/WRITE_EXTERNAL_STORAGE` | Runtime permission |
| 10 (API 29) | Scoped Storage | None for media, SAF for others |
| 11+ (API 30+) | Scoped Storage enforced | `MANAGE_EXTERNAL_STORAGE` (special) or SAF |

---

## MANAGE_EXTERNAL_STORAGE (All Files Access)

### Check & Request Permission
```kotlin
fun hasAllFilesPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
    } else {
        true // pre-Android 11
    }
}

fun requestAllFilesPermission(context: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
        intent.data = Uri.parse("package:${context.packageName}")
        context.startActivity(intent)
    }
}
```

### Google Play Policy
- `MANAGE_EXTERNAL_STORAGE` requires Google Play declaration.
- Only allowed for: file managers, backup/restore, document management.
- OfficeReader qualifies as "document management".

---

## SAF (Storage Access Framework)

### Open Single File
```kotlin
private val openFileLauncher = registerForActivityResult(
    ActivityResultContracts.OpenDocument()
) { uri: Uri? ->
    uri?.let { openDocument(it) }
}

fun openFile() {
    openFileLauncher.launch(arrayOf(
        "application/pdf",
        "application/epub+zip",
        "*/*" // fallback
    ))
}
```

### Persist URI Permission
```kotlin
fun takePersistablePermission(uri: Uri) {
    val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
        (intent.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    
    contentResolver.takePersistableUriPermission(uri, takeFlags)
}

// Store URI for later
fun saveRecentFile(context: Context, uri: Uri) {
    context.dataStore.edit { prefs ->
        prefs[stringPreferencesKey("recent_uri")] = uri.toString()
    }
}
```

### Open Directory (Document Tree)
```kotlin
private val openTreeLauncher = registerForActivityResult(
    ActivityResultContracts.OpenDocumentTree()
) { uri: Uri? ->
    uri?.let {
        contentResolver.takePersistableUriPermission(
            it,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
        )
        loadDocumentsFromTree(it)
    }
}
```

---

## ContentProvider — Intent Filter for File Types
```xml
<provider
    android:name=".core.file.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

### Handle Incoming Intent
```kotlin
// In Activity
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    when (intent?.action) {
        Intent.ACTION_VIEW, Intent.ACTION_SEND -> {
            val uri = intent.data ?: intent.getParcelableExtra(Intent.EXTRA_STREAM)
            uri?.let { if (validateUri(it)) openDocument(it) }
        }
    }
}
```

### Read File from content:// URI
```kotlin
suspend fun readFileFromUri(context: Context, uri: Uri): ByteArray? {
    return withContext(Dispatchers.IO) {
        try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                input.readBytes()
            }
        } catch (e: FileNotFoundException) {
            Timber.e(e, "File not found: $uri")
            null
        } catch (e: SecurityException) {
            Timber.e(e, "Permission denied: $uri")
            null
        }
    }
}
```

## Security — File Path Validation
```kotlin
fun isPathSafe(baseDir: File, file: File): Boolean {
    return try {
        file.canonicalPath.startsWith(baseDir.canonicalPath)
    } catch (e: IOException) {
        false
    }
}

fun isExtensionAllowed(fileName: String): Boolean {
    val extension = fileName.substringAfterLast('.', "").lowercase()
    return extension in ALLOWED_EXTENSIONS
}
```

## Cleanup — Cache Management
```kotlin
// Clear app cache periodically
fun clearAppCache(context: Context) {
    context.cacheDir.deleteRecursively()
    context.cacheDir.mkdirs()
}

// Clear files older than 7 days
fun clearOldFiles(context: Context) {
    val cutoff = System.currentTimeMillis() - 7.days.inWholeMilliseconds
    context.filesDir.walkTopDown()
        .filter { it.isFile && it.lastModified() < cutoff }
        .forEach { it.delete() }
}
```

## Anti-Patterns
- ❌ Assuming `file://` path is always accessible.
- ❌ Not taking persistent URI permission for SAF files.
- ❌ Hardcoding `/sdcard/` or `/storage/emulated/0/` paths.
- ❌ Not validating file path for path traversal.
