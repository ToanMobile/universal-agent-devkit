# 40 — Background Work

## When to Use What?

| Scenario | Tool |
|:---|:---|
| Deferred, guaranteed execution | **WorkManager** |
| Immediate, short (< 30s) | `viewModelScope.launch` + `Dispatchers.IO` |
| Long-running foreground | `ForegroundService` + notification |
| Periodic sync (hours) | **WorkManager** `PeriodicWorkRequest` |
| One-time upload/export | **WorkManager** `OneTimeWorkRequest` |
| Exact timing required | `AlarmManager` |
| Background data sync | **WorkManager** with network constraint |

### WorkManager Selection Rules
- ✅ Guaranteed execution (survives app close, reboot).
- ✅ Constraints (network, battery, idle).
- ✅ Chaining multiple tasks.
- ✅ Periodic work (≥ 15 minute interval).
- ❌ Immediate (< 1 min) user-triggered action → use coroutines.
- ❌ Exact time scheduling → use `AlarmManager`.

---

## CoroutineWorker — Standard Pattern

```kotlin
@HiltWorker
class ExportDocumentWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val documentRepository: DocumentRepository
) : CoroutineWorker(context, workerParams) {
    
    override suspend fun doWork(): Result {
        val documentId = inputData.getString("document_id") ?: return Result.failure()
        
        return try {
            val outputFile = documentRepository.exportToPdf(documentId)
            Result.success(
                workDataOf("output_path" to outputFile.absolutePath)
            )
        } catch (e: IOException) {
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure(workDataOf("error" to e.message))
            }
        }
    }
}
```

---

## Work Types

### One-Time Work
```kotlin
val exportRequest = OneTimeWorkRequestBuilder<ExportDocumentWorker>()
    .setConstraints(
        Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .build()
    )
    .setInputData(workDataOf("document_id" to documentId))
    .addTag("export_$documentId")
    .build()

WorkManager.getInstance(context).enqueue(exportRequest)
```

### Periodic Work
```kotlin
val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
    repeatInterval = 6, // hours
    repeatIntervalTimeUnit = TimeUnit.HOURS,
    flexTimeInterval = 30, // flex (runs within 30 min window)
    flexTimeIntervalUnit = TimeUnit.MINUTES
)
    .setConstraints(
        Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresCharging(true)
            .build()
    )
    .build()

WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "daily_sync",
    ExistingPeriodicWorkPolicy.KEEP, // keep existing if already scheduled
    syncRequest
)
```

### Chained Work
```kotlin
val compressWork = OneTimeWorkRequestBuilder<CompressWorker>()
    .setInputData(workDataOf("document_id" to documentId))
    .build()

val uploadWork = OneTimeWorkRequestBuilder<UploadWorker>()
    .setInputData(workDataOf("document_id" to documentId))
    .build()

WorkManager.getInstance(context)
    .beginWith(compressWork)
    .then(uploadWork)
    .enqueue()
```

---

## Observing Work Status

### ViewModel Pattern
```kotlin
@HiltViewModel
class ExportViewModel @Inject constructor(
    private val workManager: WorkManager
) : ViewModel() {
    
    fun observeWork(workId: UUID) {
        viewModelScope.launch {
            workManager.getWorkInfoByIdLiveData(workId)
                .asFlow() // convert LiveData to Flow
                .collect { workInfo ->
                    when (workInfo.state) {
                        WorkInfo.State.SUCCEEDED -> {
                            val outputPath = workInfo.outputData.getString("output_path")
                            _events.send(ExportEvent.Success(outputPath))
                        }
                        WorkInfo.State.FAILED -> {
                            _events.send(ExportEvent.Error("Export failed"))
                        }
                        WorkInfo.State.RUNNING -> {
                            _state.update { it.copy(isExporting = true) }
                        }
                        else -> {}
                    }
                }
        }
    }
}
```

### Compose UI
```kotlin
@Composable
fun ExportProgress(workId: UUID, viewModel: ExportViewModel) {
    val workInfo by viewModel.getWorkInfo(workId).collectAsState()
    
    when (workInfo?.state) {
        WorkInfo.State.RUNNING -> LinearProgressIndicator()
        WorkInfo.State.SUCCEEDED -> Text("Export complete!")
        WorkInfo.State.FAILED -> Text("Export failed", color = MaterialTheme.colorScheme.error)
        else -> {}
    }
}
```

## Constraints — Use Correctly
```kotlin
Constraints.Builder()
    .setRequiredNetworkType(NetworkType.CONNECTED) // WiFi or cellular
    .setRequiredNetworkType(NetworkType.UNMETERED) // WiFi only (large files)
    .setRequiresBatteryNotLow(true)                // Don't drain battery
    .setRequiresCharging(true)                     // Only when charging
    .setRequiresStorageNotLow(true)                // Need disk space
    .setRequiresDeviceIdle(true)                   // Only when idle (API 23+)
    .build()
```

## DI Setup (Hilt)
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object WorkManagerModule {
    @Provides
    @Singleton
    fun provideWorkManager(@ApplicationContext context: Context): WorkManager {
        return WorkManager.getInstance(context)
    }
}
```

## Rules
- Use `@HiltWorker` for all workers (Hilt injection).
- Always tag workers (`addTag()`) for debugging and cancellation.
- Use `setExpedited()` for user-initiated, time-sensitive work (API 31+).
- Max `PeriodicWorkRequest` interval: 15 minutes (system enforced).
- Chain workers when tasks are sequential and dependent.
- Always observe and show progress to users.
