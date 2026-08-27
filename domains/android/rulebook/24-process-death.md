# 24 — Process Death

## Problem
Android can kill your app's process in the background to free memory. When the user returns, the Activity is recreated but ViewModel state (in memory) is lost.

### When to Use SavedStateHandle?
- **Always** for data that cannot be re-fetched easily.
- **Always** for navigation arguments.
- **Not** for large data (re-fetch from Repository instead).

### Standard Pattern
```kotlin
@HiltViewModel
class DocumentViewModel @Inject constructor(
    private val repository: DocumentRepository,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {
    
    // Restore from SavedStateHandle
    val documentId: String = savedStateHandle["documentId"] ?: ""
    val currentPage: MutableStateFlow<Int> = MutableStateFlow(
        savedStateHandle["currentPage"] ?: 0
    )
    
    init {
        // Persist to SavedStateHandle on change
        viewModelScope.launch {
            currentPage.collect { page ->
                savedStateHandle["currentPage"] = page
            }
        }
    }
}
```

### Navigation Arguments
```kotlin
// Navigation arguments auto-saved in SavedStateHandle
composable(
    route = "document/{documentId}",
    arguments = listOf(navArgument("documentId") { type = NavType.StringType })
)

// ViewModel
val documentId: String = savedStateHandle.get<String>("documentId") ?: ""
```

## Data Types Supported by SavedStateHandle
- Primitives: `Int`, `Long`, `Float`, `Double`, `Boolean`, `String`.
- `Bundle`, `Parcelable`, `Serializable`.
- `ArrayList<String>` (only String).

### Cannot Save (must re-fetch)
- `Bitmap`, `File`, `InputStream`.
- Custom objects without Parcelable/Serializable.
- Large collections/objects; persist data and save only stable IDs/keys.

### SavedState size
- Keep state small enough for the Android saved-state/Binder contract verified from official docs and
  current platform behavior; this project does not invent a lower numeric cap here.
- Persist durable/large data to Room/DataStore/file storage and save only IDs/keys.

---

## rememberSaveable for UI-Only State
```kotlin
// For transient UI state that should survive process death
var text by rememberSaveable { mutableStateOf("") }
var isExpanded by rememberSaveable { mutableStateOf(false) }

// Custom saver for non-primitive types
var selectedItems by rememberSaveable(
    saver = listSaver(
        save = { it.toList() },
        restore = { it.toMutableStateList() }
    )
) { mutableStateListOf<String>() }
```

### LazyList Scroll Position
```kotlin
// Auto-saved by LazyListState with rememberSaveable
val listState = rememberLazyListState() // auto saved
```

## Process Death Testing Checklist
- [ ] Rotate device → state preserved.
- [ ] Background app → Settings → Developer Options → "Don't keep activities" → return to app.
- [ ] Background app → `adb shell am kill <package>` → return to app.

```bash
# Simulate process death
adb shell am kill com.example.app
```

## Anti-Patterns
- ❌ Saving Bitmap/Files in SavedStateHandle.
- ❌ Using `remember` for data that must survive process death (use `rememberSaveable`).
- ❌ Assuming ViewModel data survives process death without SavedStateHandle.
