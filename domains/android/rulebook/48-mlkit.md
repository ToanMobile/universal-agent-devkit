# 48 — ML Kit

## Document Scanner (GmsDocumentScanner)

### Setup
```kotlin
val scanner = GmsDocumentScanning.getClient(
    GmsDocumentScannerOptions.Builder()
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .setGalleryImportAllowed(true)
        .setPageLimit(50)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .build()
)
```

### Usage in Activity/Composable
```kotlin
// In Activity
private val scannerLauncher = registerForActivityResult(
    GmsDocumentScanning.getClient(options).scanResultContract()
) { result ->
    if (result.isSuccess) {
        val pages = result.result?.pages
        pages?.forEach { page ->
            val bitmap = BitmapFactory.decodeFile(page.imageUri?.path)
            addScannedPage(bitmap)
        }
    } else {
        val error = result.error
        Timber.e(error, "Scanner failed")
    }
}

fun startScanner() {
    scannerLauncher.launch(GmsDocumentScanning.SCANNER_MODE_FULL)
}
```

---

## Text Recognition (OCR)

### On-device (No Internet Required)
```kotlin
val recognizer = TextRecognition.getClient(
    TextRecognizerOptions.DEFAULT_OPTIONS
)

fun recognizeText(bitmap: Bitmap): String {
    val image = InputImage.fromBitmap(bitmap, 0)
    val result = recognizer.process(image)
        .await() // kotlinx-coroutines-play-services
    
    return result.text
}
```

### Multi-language OCR (Requires Model Download)
```kotlin
val recognizer = TextRecognition.getClient(
    TextRecognizerOptions.Builder()
        .setLanguageOptions(
            LanguageOptions.Builder()
                .setPossibleLanguages(
                    ImmutableList.of(
                        LanguageInfo("en"),
                        LanguageInfo("vi"),
                        LanguageInfo("ja"),
                        LanguageInfo("zh")
                    )
                )
                .build()
        )
        .build()
)
```

### Model Download (Avoid Download When Offline)
```kotlin
suspend fun ensureModelDownloaded(): Boolean {
    val modelManager = RemoteModelManager.getInstance()
    val conditions = CustomModelDownloadConditions.Builder()
        .requireWifi() // only download on WiFi
        .build()
    
    return try {
        modelManager.download(TextRecognition.MODEL_ID, conditions).await()
        true
    } catch (e: Exception) {
        Timber.w(e, "Model download failed")
        false
    }
}
```

## Barcode Scanning (If Used)
```kotlin
val scanner = BarcodeScanning.getClient(
    BarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        .build()
)

fun scanBarcode(bitmap: Bitmap): String? {
    val image = InputImage.fromBitmap(bitmap, 0)
    val results = scanner.process(image).await()
    return results.firstOrNull()?.rawValue
}
```

## Rules
- ML Kit operations on `Dispatchers.Default` (CPU-intensive).
- Always check model availability before use.
- Download models on WiFi only.
- Cache recognition results (same image → same text).
- Close/cleanup after use.

## Anti-Patterns
- ❌ OCR on Main thread.
- ❌ Downloading language models on mobile data without user consent.
- ❌ Processing full-resolution images for OCR (resize to 1080p max).
- ❌ Not handling model download failures gracefully.
