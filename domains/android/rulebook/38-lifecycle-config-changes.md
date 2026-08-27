# 38 — Lifecycle & Configuration Changes

## Resource Management by Lifecycle

| Resource | Acquire | Release |
|:---|:---|:---|
| `PdfRenderer` | `Activity.onCreate()` | `Activity.onDestroy()` |
| Camera (CameraX) | `Activity.onStart()` | `Activity.onStop()` |
| Location updates | `Activity.onResume()` | `Activity.onPause()` |
| `DisposableEffect` | Composition | `onDispose` block |
| `LaunchedEffect` | Composition | Auto-cancel on leave |
| Flow collection | `collectAsStateWithLifecycle()` | Auto on lifecycle stop |
| Bitmap | On render | `.recycle()` after use |

### Compose Lifecycle Effects
```kotlin
@Composable
fun MyScreen(viewModel: MyViewModel) {
    // Starts when screen enters composition, cancelled when leaving
    LaunchedEffect(Unit) {
        viewModel.startObserving()
    }
    
    // Lifecycle-aware collection
    val state by viewModel.state.collectAsStateWithLifecycle()
    
    // Cleanup on composition leave
    DisposableEffect(Unit) {
        val observer = registerObserver()
        onDispose { observer.unregister() }
    }
}
```

### Lifecycle-Aware Collection
```kotlin
// ✅ Stops collection when lifecycle drops below STARTED
val state by viewModel.state.collectAsStateWithLifecycle()

// Manual lifecycle control
val state by viewModel.state
    .flowWithLifecycle(lifecycle, Lifecycle.State.STARTED)
    .collectAsState()
```

---

## Configuration Change Handling

### What Survives Configuration Change
| Item | Survives? | Notes |
|:---|:---|:---|
| `ViewModel` | ✅ Yes | Retained across rotation |
| `SavedStateHandle` | ✅ Yes | Persistent storage |
| `remember` | ❌ No | Lost on config change |
| `rememberSaveable` | ✅ Yes | Auto-saved to Bundle |
| `MutableStateFlow` | ✅ Yes | Inside ViewModel |
| Static fields | ✅ Yes | Process-level |
| `CompositionLocal` | ✅ Yes | Re-initialized but values survive |

### Handling Rotation / Dark Mode Toggle
```kotlin
// ViewModel — no special handling, survives automatically
@HiltViewModel
class ReaderViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {
    val currentPage = MutableStateFlow(savedStateHandle["page"] ?: 0)
    
    init {
        viewModelScope.launch {
            currentPage.collect { page ->
                savedStateHandle["page"] = page
            }
        }
    }
}

// Composable — use rememberSaveable for UI state
@Composable
fun ReaderScreen() {
    var showToolbar by rememberSaveable { mutableStateOf(true) }
    val listState = rememberLazyListState() // auto-saved
}
```

### When to Use `android:configChanges` in Manifest?
```xml
<!-- Use ONLY when you handle the change manually -->
<!-- App: DO NOT use — let Activity recreate -->
```

---

## Multi-Window & Multi-Instance

### Pattern for App
```kotlin
// Each document opens in its own Activity instance
class ReaderOfficeActivity : BaseActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Handle new document opened while existing instance is active
        if (intent?.action == Intent.ACTION_VIEW) {
            handleDocumentIntent(intent)
        }
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Called when Activity is re-used in singleTop mode
        handleDocumentIntent(intent)
    }
}
```

### Lifecycle Rules
- `onCreate` → initialize UI, ViewModel.
- `onStart` → bind lifecycle-aware components.
- `onResume` → start active operations (Camera, animations).
- `onPause` → pause active operations.
- `onStop` → release UI-bound resources.
- `onDestroy` → release all resources (PdfRenderer, close files).
- `onNewIntent` → handle new document open.

---

## Lifecycle in Multi-Window
```kotlin
// Check if in multi-window mode
if (isInMultiWindowMode) {
    // Reduce memory usage: fewer cached pages, lower resolution
}

// Handle multi-window resize (API 24+)
override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean, newConfig: Configuration) {
    super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig)
    // Adjust layout for new window size
}
```

---

## In-App Language Change
```kotlin
// Set locale programmatically
fun setLocale(context: Context, languageCode: String) {
    val locale = Locale(languageCode)
    Locale.setDefault(locale)
    val config = Configuration(context.resources.configuration)
    config.setLocale(locale)
    context.createConfigurationContext(config)
    // Requires Activity.recreate() to apply
}

// Store preference
dataStore.edit { prefs ->
    prefs[stringPreferencesKey("language")] = languageCode
}
```

## Checklist
- [ ] ViewModel uses `SavedStateHandle` for critical state.
- [ ] `remember` used only for transient UI state.
- [ ] `rememberSaveable` for state that must survive process death.
- [ ] Heavy resources released in `onStop`/`onDestroy`.
- [ ] Multi-window tested.
- [ ] In-app language change tested.
