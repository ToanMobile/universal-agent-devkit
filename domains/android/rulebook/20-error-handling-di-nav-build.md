# 20 — Error Handling, DI, Navigation & Build

## Error Handling

### Result Pattern
```kotlin
// Use kotlin.Result or custom AppResult
sealed class AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>()
    data class Error(val exception: AppError) : AppResult<Nothing>()
    data object Loading : AppResult<Nothing>()
}

// Repository
suspend fun getDocument(id: String): AppResult<Document> {
    return try {
        val doc = api.getDocument(id)
        AppResult.Success(doc)
    } catch (e: IOException) {
        AppResult.Error(AppError.NetworkError(0))
    }
}
```

### Rules
- Repository returns `Result<T>` or `AppResult<T>`.
- ViewModel maps errors to user-facing messages in State.
- Never throw exceptions for expected failures (network, file not found).
- Use `runCatching {}` for Kotlin Result.

---

## Dependency Injection (Hilt)

### Module Organization
```
app/src/main/java/.../di/
├── AppModule.kt       # App-level singletons
├── CloudModule.kt     # Cloud services (Firebase, Supabase)
├── CompressModule.kt  # Compression utilities
└── ...
```

### ViewModel
```kotlin
@HiltViewModel
class FeatureViewModel @Inject constructor(
    private val repository: FeatureRepository,
    private val savedStateHandle: SavedStateHandle
) : ViewModel()
```

### Hilt Scoping — Choose the Right Scope
| Scope | Lifetime | When to Use |
|:---|:---|:---|
| `@Singleton` | Application process | Global state, Database, API clients |
| `@ActivityRetainedScoped` | Survives config change | Activity-level state shared across fragments |
| `@ViewModelScoped` | ViewModel lifetime | Repositories used by one ViewModel |
| Unscoped | New instance each inject | Lightweight, stateless objects |

#### Hilt Anti-Patterns
- ❌ `@Singleton` for data that changes per user/document.
- ❌ Scoping heavy objects (PdfRenderer) as `@Singleton`.
- ❌ Injecting `Activity` or `Fragment` directly.

---

## Navigation (Compose)

### Route Definition
```kotlin
sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object DocumentViewer : Screen("document/{documentId}") {
        fun createRoute(documentId: String) = "document/$documentId"
    }
}

// Navigation
NavHost(navController = navController, startDestination = Screen.Home.route) {
    composable(Screen.Home.route) { HomeScreen() }
    composable(
        route = Screen.DocumentViewer.route,
        arguments = listOf(navArgument("documentId") { type = NavType.StringType })
    ) { backStackEntry ->
        val documentId = backStackEntry.arguments?.getString("documentId")
        DocumentViewerScreen(documentId = documentId)
    }
}
```

---

## Image Loading (Coil)
```kotlin
// In Composable
AsyncImage(
    model = ImageRequest.Builder(LocalContext.current)
        .data(file)
        .size(300, 400)
        .memoryCachePolicy(CachePolicy.ENABLED)
        .diskCachePolicy(CachePolicy.ENABLED)
        .build(),
    contentDescription = "Document thumbnail",
    placeholder = painterResource(R.drawable.placeholder),
    error = painterResource(R.drawable.error)
)

// Always check current version at gradle/libs.versions.toml (don't hardcode here)
```

### Rules
- Always specify `size()` to avoid OOM.
- Use `memoryCachePolicy` and `diskCachePolicy` appropriately.
- Thumbnails: small size, memory cache.
- Full images: disk cache, load on demand.

---

## Build Optimization

```properties
# gradle.properties
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configuration-cache=true
```

```properties
# Kotlin incremental compilation
kotlin.incremental=true
kotlin.incremental.useClasspathSnapshot=true
```

### Release Build
- `minifyEnabled = true`
- `shrinkResources = true`
- R8 full mode enabled
- ProGuard rules for all libraries
- Mapping file archived per build
