# 47 — CameraX

## Use Case Architecture
```
CameraProvider → ProcessCameraProvider.bindToLifecycle()
    ├── Preview (display)
    ├── ImageCapture (take photo)
    └── ImageAnalysis (real-time processing, auto-detect edges)
```

## Setup with ProcessCameraProvider
```kotlin
class ScannerActivity : BaseActivity() {
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    
    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.viewFinder.surfaceProvider)
            }
            
            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()
            
            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            
            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageCapture
                )
            } catch (e: Exception) {
                Timber.e(e, "Camera binding failed")
            }
        }, ContextCompat.getMainExecutor(this))
    }
}
```

## Image Capture
```kotlin
fun captureDocument() {
    val imageCapture = imageCapture ?: return
    
    val outputFile = File(cacheDir, "scan_${System.currentTimeMillis()}.jpg")
    val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile)
        .build()
    
    imageCapture.takePicture(
        outputOptions,
        ContextCompat.getMainExecutor(this),
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                processCapturedImage(outputFile)
            }
            
            override fun onError(exception: ImageCaptureException) {
                Timber.e(exception, "Capture failed")
                showError("Capture failed")
            }
        }
    )
}
```

## Camera Permission Handling
```kotlin
private val requestPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
) { isGranted ->
    if (isGranted) {
        startCamera()
    } else {
        showPermissionDeniedMessage()
    }
}

fun checkAndRequestCameraPermission() {
    when {
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED -> {
            startCamera()
        }
        shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) -> {
            showPermissionRationale()
        }
        else -> {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }
}
```

## Torch (Flash) Control
```kotlin
var isTorchOn by mutableStateOf(false)

fun toggleTorch() {
    val camera = camera ?: return
    if (camera.cameraInfo.hasFlashUnit()) {
        camera.cameraControl.enableTorch(!isTorchOn)
        isTorchOn = !isTorchOn
    }
}

// Auto-disable torch when camera stops
override fun onStop() {
    super.onStop()
    camera?.cameraControl?.enableTorch(false)
    isTorchOn = false
}
```

## Zoom Control
```kotlin
fun setZoom(zoomRatio: Float) {
    camera?.cameraControl?.setZoomRatio(zoomRatio.coerceIn(1f, maxZoomRatio))
}

// Pinch-to-zoom
Modifier.pointerInput(Unit) {
    detectTransformGestures { _, _, zoom, _ ->
        currentZoom *= zoom
        setZoom(currentZoom)
    }
}
```

## ImageAnalysis (Real-time — for auto-detect edges)
```kotlin
val imageAnalysis = ImageAnalysis.Builder()
    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
    .build()

imageAnalysis.setAnalyzer(Executors.newSingleThreadExecutor()) { imageProxy ->
    // Process frame (edge detection, document detection)
    detectDocumentEdges(imageProxy)
    imageProxy.close() // MUST close!
}
```

## Cleanup
```kotlin
override fun onDestroy() {
    super.onDestroy()
    camera?.cameraControl?.enableTorch(false)
    // ProcessCameraProvider auto-unbinds on lifecycle destroy
}
```

## Rules
- Always close `ImageProxy` after analysis.
- Bind camera in `onStart`, unbind auto on `onStop` (via lifecycle).
- Check camera availability before binding.
- Disable torch in `onStop`.
- Use `CAPTURE_MODE_MINIMIZE_LATENCY` for document scanning (faster than MAXIMIZE_QUALITY).

## Anti-Patterns
- ❌ Not closing `ImageProxy` → memory leak + camera freeze.
- ❌ Binding camera without permission check.
- ❌ Keeping torch on when activity stops.
- ❌ Using `CAPTURE_MODE_MAXIMIZE_QUALITY` for scanner (too slow).
