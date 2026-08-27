# 18 — Naming Conventions

## Files
- Kotlin files: `PascalCase.kt`
- Resource files: `snake_case.xml`
- Feature module: `feature/<name>/`
- Test files: `<SourceFileName>Test.kt`

## Classes — PascalCase
```kotlin
class DocumentRepository
object AppColors
sealed interface FeatureEvent
data class DocumentState
```

## Functions — camelCase
```kotlin
fun loadDocuments()
fun calculateProgress(): Float
suspend fun fetchRemoteData()
```

## Composable Functions — PascalCase
```kotlin
@Composable
fun DocumentViewer(state: DocumentState)

@Composable
fun PageThumbnail(pageIndex: Int)
```

## Event / Callback — `on{Action}` prefix
```kotlin
// Callbacks
val onClick: () -> Unit
val onDelete: (String) -> Unit
val onPageChanged: (Int) -> Unit

// ViewModel events
sealed interface FeatureEvent {
    data class OnNavigateToDetail(val id: String)
    data class OnShowError(val message: String)
}
```

## Variables — camelCase
```kotlin
val documentCount: Int
var isLoading: Boolean
val pageTitle: String

// Backing properties
private val _state = MutableStateFlow(FeatureState())
val state: StateFlow<FeatureState> = _state.asStateFlow()
```

## Constants — SCREAMING_SNAKE_CASE
```kotlin
const val MAX_PAGE_COUNT = 500
const val DEFAULT_ZOOM_LEVEL = 1.0f
const val ANIMATION_DURATION_MS = 300L

// In companion object
companion object {
    const val KEY_DOCUMENT_ID = "document_id"
}
```

## Packages — lowercase, no underscores
```
com.example.app.core.data.repository
com.example.app.feature.files.presentation.screen
```
