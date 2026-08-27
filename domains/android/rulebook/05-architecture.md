# Feature Architecture

## Feature Directory Structure
```
feature/<name>/
├── data/              # Repository implementations, data sources
│   └── repository/
├── domain/            # Use cases, domain models
│   ├── model/
│   └── usecase/
└── presentation/      # UI layer
    ├── screen/
    ├── component/
    └── viewmodel/
```

## Architecture Rules
- **Unidirectional Data Flow (UDF)**: ViewModel → State → UI → Events → ViewModel.
- **Presentation** depends on **Domain**. Domain does NOT depend on Presentation.
- **Data** implements Domain interfaces. Domain does NOT depend on Data.
- Feature modules can depend on `core/*` and `libs/*`, but NOT on other features.

## ViewModel Scope
- ViewModel scoped to Navigation Destination (not Activity).
- Use `SavedStateHandle` for process death survival.
- State via `StateFlow<State>`, Events via `Channel<Event>` (one-time).

---

## 6-Step Feature Creation Process

### Reference: Feature `home` (standard template)
Use `feature/home/` as reference for new feature structure.

### Step 1: Create Directory Structure
```bash
feature/<name>/
├── build.gradle.kts
├── consumer-rules.pro
└── src/
    ├── main/
    │   ├── java/.../feature/<name>/
    │   │   ├── data/repository/
    │   │   ├── domain/model/
    │   │   ├── domain/usecase/
    │   │   └── presentation/
    │   │       ├── screen/
    │   │       ├── component/
    │   │       └── viewmodel/
    │   └── res/values/
    └── test/
```

### Step 2: Create State & Event
```kotlin
// State
data class FeatureState(
    val isLoading: Boolean = false,
    val items: List<Item> = emptyList(),
    val error: String? = null
)

// Event (one-time)
sealed interface FeatureEvent {
    data class NavigateToDetail(val id: String) : FeatureEvent
    data class ShowSnackbar(val message: String) : FeatureEvent
}
```

### Step 3: Create ViewModel
```kotlin
@HiltViewModel
class FeatureViewModel @Inject constructor(
    private val useCase: FeatureUseCase,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {
    
    private val _state = MutableStateFlow(FeatureState())
    val state: StateFlow<FeatureState> = _state.asStateFlow()
    
    private val _events = Channel<FeatureEvent>(Channel.BUFFERED)
    val events: Flow<FeatureEvent> = _events.receiveAsFlow()
    
    fun onAction(action: FeatureAction) {
        when (action) {
            is FeatureAction.Load -> loadData()
            // ...
        }
    }
    
    private fun loadData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            useCase()
                .onSuccess { items ->
                    _state.update { it.copy(isLoading = false, items = items) }
                }
                .onFailure { error ->
                    _state.update { it.copy(isLoading = false, error = error.message) }
                }
        }
    }
}
```

### Step 4: Create Screen + Content
```kotlin
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel = hiltViewModel(),
    onNavigateToDetail: (String) -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is FeatureEvent.NavigateToDetail -> onNavigateToDetail(event.id)
                is FeatureEvent.ShowSnackbar -> { /* show snackbar */ }
            }
        }
    }
    
    FeatureContent(
        state = state,
        onAction = viewModel::onAction
    )
}

@Composable
private fun FeatureContent(
    state: FeatureState,
    onAction: (FeatureAction) -> Unit
) {
    // UI here
}
```

### Step 5: Add Navigation Route
```kotlin
// In AppNavigation.kt or feature's NavGraph
composable("feature_route") {
    FeatureScreen(
        onNavigateToDetail = { id -> navController.navigate("detail/$id") }
    )
}
```

### Step 6: Localization
- All user-facing strings in `res/values/strings_<feature>.xml`.
- Use `stringResource()` in Composables, never hardcoded text.

### Pre-Merge Checklist
- [ ] State is `@Immutable` or `@Stable`.
- [ ] ViewModel has unit tests (TDD).
- [ ] Screen has Compose UI tests.
- [ ] All strings in `strings.xml` (no hardcoded text).
- [ ] Dark Mode preview works.
- [ ] RTL layout tested.
- [ ] Process death handled (SavedStateHandle).
- [ ] Accessibility: content descriptions, touch targets ≥ 48dp.
