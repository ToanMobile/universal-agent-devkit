# 26 — Structured Concurrency

## Core Principles
1. **Coroutines are structured** — parent waits for children, cancellation propagates down.
2. **Exceptions propagate up** — unless using `supervisorScope`.
3. **Cancellation is cooperative** — coroutines must check `isActive` or call `ensureActive()`.

## Scope Types

### `coroutineScope` — Fail-fast (1 fail → cancel all)
```kotlin
suspend fun loadAllData(): Pair<Data1, Data2> = coroutineScope {
    val d1 = async { repo1.get() }
    val d2 = async { repo2.get() }
    // If d1 fails → d2 is cancelled → exception rethrown
    Pair(d1.await(), d2.await())
}
```

### `supervisorScope` — Partial failure OK
```kotlin
suspend fun loadAllDataSafe(): Pair<Data1?, Data2?> = supervisorScope {
    val d1 = async { repo1.get() }
    val d2 = async { repo2.get() }
    // If d1 fails → d2 continues, d1.await() throws
    Pair(
        try { d1.await() } catch (e: Exception) { null },
        try { d2.await() } catch (e: Exception) { null }
    )
}
```

### Comparison
| Scope | Child Failure | When to Use |
|:---|:---|:---|
| `coroutineScope` | Cancels all siblings | All must succeed (e.g., loading page + metadata) |
| `supervisorScope` | Siblings continue | Independent operations (e.g., thumbnails) |

## ViewModel Patterns

### `viewModelScope` — SupervisorJob built-in
```kotlin
fun loadMultiple() {
    viewModelScope.launch {
        // launch 1
        launch {
            val data1 = repo1.get() // if fails, UI updates with error
            _state.update { it.copy(data1 = data1) }
        }
        // launch 2
        launch {
            val data2 = repo2.get() // continues even if launch 1 fails
            _state.update { it.copy(data2 = data2) }
        }
    }
}
```

### Nested Scope in ViewModel
```kotlin
fun processPages() {
    viewModelScope.launch {
        coroutineScope {
            // All pages must process or none
            pages.map { page ->
                async { processPage(page) }
            }.awaitAll()
        }
    }
}
```

## Cooperative Cancellation

### `ensureActive()` — Cooperative cancellation
```kotlin
suspend fun processLargeList(items: List<Item>) {
    items.forEach { item ->
        ensureActive() // check before each iteration
        processItem(item) // heavy work
    }
}
```

### `yield()` — Allow other coroutines to run
```kotlin
suspend fun longComputation() {
    repeat(1_000_000) {
        doWork()
        if (it % 1000 == 0) yield() // let other coroutines run
    }
}
```

### CancellationException — Don't Catch!
```kotlin
// ❌ WRONG — suppresses cancellation
try {
    delay(1000)
} catch (e: Exception) {
    // catches CancellationException → coroutine doesn't cancel!
}

// ✅ CORRECT — catch specific exceptions
try {
    delay(1000)
} catch (e: IOException) {
    Timber.e(e, "IO error")
}
// CancellationException propagates naturally
```

## NonCancellable — Cleanup Operations
```kotlin
suspend fun saveData() {
    try {
        // main operation
        repository.save(data)
    } finally {
        // MUST run even if cancelled
        withContext(NonCancellable) {
            repository.cleanup()
        }
    }
}
```

---

## Error Handling in Coroutines

### CoroutineExceptionHandler — Last Resort
```kotlin
val handler = CoroutineExceptionHandler { _, throwable ->
    Timber.e(throwable, "Unhandled coroutine error")
    Firebase.crashlytics.recordException(throwable)
}

viewModelScope.launch(handler) {
    // risky operation
}
```

### try-catch in launch
```kotlin
viewModelScope.launch {
    try {
        val data = repository.fetch()
        _state.update { it.copy(data = data) }
    } catch (e: IOException) {
        _state.update { it.copy(error = e.message) }
    }
}
```

## Composable Coroutine Lifecycle

### Cleanup When Composable Leaves Composition
```kotlin
@Composable
fun DataLoader(viewModel: MyViewModel) {
    LaunchedEffect(Unit) {
        viewModel.loadData()
    }
    // Auto-cancelled when composable leaves composition
}

// Wait for key change
LaunchedEffect(key) {
    // Cancelled if key changes, restarted with new key
}
```

### DisposableEffect for Non-Suspend Cleanup
```kotlin
@Composable
fun SensorListener() {
    DisposableEffect(Unit) {
        val sensor = registerSensor()
        onDispose {
            sensor.unregister() // non-suspend cleanup
        }
    }
}
```

### Important Notes
- `LaunchedEffect` is cancelled when key changes or composable leaves composition.
- `DisposableEffect` `onDispose` runs when key changes or composable leaves.
- `rememberCoroutineScope()` — for coroutines triggered by user actions (not lifecycle-bound).

## Anti-Patterns
- ❌ `GlobalScope.launch` — use `viewModelScope` or `rememberCoroutineScope`.
- ❌ Catching `CancellationException` — let it propagate.
- ❌ `runBlocking` on Main thread (except tests).
- ❌ Fire-and-forget coroutines without error handling.
