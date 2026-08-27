# 06 — ViewModel & State Management Rules

## State Rules
1. **Single State data class** per ViewModel — `data class XState(...)`.
2. State is `@Immutable` — all properties are `val`, types are stable.
3. `MutableStateFlow<State>` private, expose as `StateFlow<State>`.
4. Update state via `_state.update { it.copy(...) }` — atomic, thread-safe.
5. **No `var` in State** — all fields immutable.
6. State contains ALL UI-visible data (no hidden state in ViewModel).

## Event Rules
1. Events via **`sealed interface`** — type-safe, exhaustive `when`.
2. One-Time Events (Navigation, Snackbar) via `Channel<Event>(Channel.BUFFERED)`.
3. Expose as `Flow<Event>` via `.receiveAsFlow()`.
4. Collect events in `LaunchedEffect(Unit)` at Screen level.

---

## Derived State

### `derivedStateOf` for Leaf Composables
```kotlin
@Composable
fun ItemList(state: FeatureState) {
    val isEmpty by remember(state.items) {
        derivedStateOf { state.items.isEmpty() }
    }
    // isEmpty recomputes only when state.items changes
}
```

### Derive at ViewModel (Preferred)
```kotlin
// In ViewModel — cleaner, testable
val isEmpty: StateFlow<Boolean> = _state
    .map { it.items.isEmpty() }
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)
```

## One-Time Events (Navigation, Snackbar)
```kotlin
// ViewModel
private val _events = Channel<FeatureEvent>(Channel.BUFFERED)
val events: Flow<FeatureEvent> = _events.receiveAsFlow()

fun showError(message: String) {
    _events.trySend(FeatureEvent.ShowSnackbar(message))
}

// Screen
LaunchedEffect(Unit) {
    viewModel.events.collect { event ->
        when (event) {
            is FeatureEvent.ShowSnackbar -> snackbarHostState.showSnackbar(event.message)
        }
    }
}
```

## StateFlow Sharing Strategy
- Use `SharingStarted.WhileSubscribed(5000)` — keep upstream active 5s after last subscriber gone (survives config change).
- `SharingStarted.Eagerly` — only for global state (theme, auth).
- `SharingStarted.Lazily` — rarely used, can miss initial events.

## Algorithms in ViewModel
- Business logic stays in `ViewModel` or `UseCase`, **not** in Composable.
- Composable only renders state and forwards actions.
