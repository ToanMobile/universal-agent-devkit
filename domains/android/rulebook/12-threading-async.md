# 12 — Threading & Async

## Main Thread — Forbidden
- ❌ I/O operations (file read/write, network, database).
- ❌ Computation shown by trace/profile to risk blocking frames or responsiveness.
- ❌ `Thread.sleep()`, `runBlocking {}`.
- ❌ Bitmap decoding/encoding.
- ✅ Only UI updates, lightweight calculations.

## Dispatcher Usage

| Operation | Dispatcher |
|:---|:---|
| Network calls (Retrofit) | `Dispatchers.IO` |
| File I/O | `Dispatchers.IO` |
| Database (Room) | `Dispatchers.IO` |
| Image decoding (Coil) | `Dispatchers.IO` (auto) |
| Heavy computation | `Dispatchers.Default` |
| PDF rendering | `Dispatchers.Default` (CPU) |
| UI updates | Main (auto in Compose) |

## ViewModel Patterns

### `withContext` (Preferred for sequential operations)
```kotlin
fun loadData() {
    viewModelScope.launch {
        _state.update { it.copy(isLoading = true) }
        val result = withContext(Dispatchers.IO) {
            repository.getData()
        }
        _state.update { it.copy(isLoading = false, data = result) }
    }
}
```

### `launch(IO)` — Only for fire-and-forget
```kotlin
fun saveInBackground(data: Data) {
    viewModelScope.launch(Dispatchers.IO) {
        repository.save(data)
        // No state update, just side effect
    }
}
```

### Flow Collection
```kotlin
fun observeData() {
    viewModelScope.launch {
        repository.observeData()
            .flowOn(Dispatchers.IO) // upstream on IO
            .catch { e -> _state.update { it.copy(error = e.message) } }
            .collect { data -> _state.update { it.copy(data = data) } }
    }
}
```

## Structured Concurrency

### `coroutineScope` — Parallel operations (fail-fast)
```kotlin
suspend fun loadAll() = coroutineScope {
    val deferred1 = async { repo1.get() }
    val deferred2 = async { repo2.get() }
    // If either fails → both cancelled
    Pair(deferred1.await(), deferred2.await())
}
```

### `supervisorScope` — Independent operations (partial failure OK)
```kotlin
suspend fun loadAllSafe() = supervisorScope {
    val deferred1 = async { repo1.get() }
    val deferred2 = async { repo2.get() }
    // If either fails → other continues, exception caught in try-catch
    Pair(deferred1.await(), deferred2.await())
}
```

### `ensureActive` — Cooperative cancellation
```kotlin
suspend fun processPages(pages: List<Page>) {
    pages.forEach { page ->
        ensureActive() // check cancellation before each iteration
        processPage(page)
    }
}
```

## Flow vs Channel — When to Use What?
| Use Case | Tool |
|:---|:---|
| Continuous state stream | `StateFlow` |
| One-time events | `Channel` |
| Stream of data with backpressure | `Flow` |
| Multiple collectors, each gets all events | `SharedFlow` |

### ViewModel Pattern
- State → `StateFlow` (always has current value).
- Events → `Channel` (one-time consumption).
- Data stream → `Flow` (cold, starts on collect).

## Timeout & Cancellation
```kotlin
// Timeout
suspend fun fetchWithTimeout() = withTimeout(30_000) {
    repository.fetch()
}

// Timeout with default
suspend fun fetchOrDefault() = withTimeoutOrNull(10_000) {
    repository.fetch()
} ?: defaultValue

// Cancel previous job
private var searchJob: Job? = null

fun search(query: String) {
    searchJob?.cancel()
    searchJob = viewModelScope.launch {
        delay(300) // debounce
        val results = withContext(Dispatchers.IO) { repo.search(query) }
        _state.update { it.copy(results = results) }
    }
}
```

## Rules
- `viewModelScope.launch` uses `Dispatchers.Main` by default.
- `withContext(Dispatchers.IO)` for blocking operations.
- Never use `GlobalScope`.
- `runBlocking` → allowed ONLY in `@Test` functions.

### Allowed Exceptions (Documented)
- `runBlocking` in main thread at app startup → blocked by Android system, not us.
- `Dispatchers.Main.immediate` for synchronous state updates when already on Main.
