# 31 — DataStore Patterns

## When to Use DataStore?
- User preferences (theme, language, font size).
- Feature flags (simple toggles).
- Small, structured key-value data.
- **NOT** for: large datasets, relational data, frequent writes → use Room.

---

## Setup

### Preferences DataStore
```kotlin
// At top level (singleton)
val Context.dataStore by preferencesDataStore(name = "settings")

// or
val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "settings",
    corruptionHandler = ReplaceFileCorruptionHandler { e ->
        Timber.e(e, "DataStore corrupted, replacing with empty")
        preferencesOf()
    }
)
```

### Hilt Module
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object DataStoreModule {
    
    @Provides
    @Singleton
    fun provideDataStore(@ApplicationContext context: Context): DataStore<Preferences> {
        return context.dataStore
    }
}
```

## Read — Always Async
```kotlin
// Flow-based (reactive)
val themeFlow: Flow<Theme> = dataStore.data
    .map { preferences ->
        val themeKey = stringPreferencesKey("theme")
        val themeName = preferences[themeKey] ?: "system"
        Theme.valueOf(themeName)
    }

// One-shot read (suspend)
suspend fun getTheme(): Theme {
    return dataStore.data.first()
        .let { prefs ->
            val key = stringPreferencesKey("theme")
            Theme.valueOf(prefs[key] ?: "system")
        }
}
```

## Write — Always in Suspend
```kotlin
suspend fun setTheme(theme: Theme) {
    dataStore.edit { preferences ->
        val key = stringPreferencesKey("theme")
        preferences[key] = theme.name
    }
}

// Or with Flow
fun setTheme(theme: Theme) {
    viewModelScope.launch {
        dataStore.edit { preferences ->
            preferences[stringPreferencesKey("theme")] = theme.name
        }
    }
}
```

## ViewModel Pattern
```kotlin
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val dataStore: DataStore<Preferences>
) : ViewModel() {
    
    val theme: StateFlow<Theme> = dataStore.data
        .map { preferences ->
            val key = stringPreferencesKey("theme")
            Theme.valueOf(preferences[key] ?: "system")
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), Theme.SYSTEM)
    
    fun setTheme(theme: Theme) {
        viewModelScope.launch {
            dataStore.edit { prefs ->
                prefs[stringPreferencesKey("theme")] = theme.name
            }
        }
    }
}
```

## Theme Loading at App Start
```kotlin
// In Application or InitialRouteScreen
LaunchedEffect(Unit) {
    dataStore.data.first().let { prefs ->
        val theme = prefs[stringPreferencesKey("theme")] ?: "system"
        applyTheme(Theme.valueOf(theme))
    }
}
```

## Migration from SharedPreferences
```kotlin
val Context.dataStore by preferencesDataStore(
    name = "settings",
    produceMigrations = { context ->
        listOf(SharedPreferencesMigration(context, "legacy_prefs"))
    }
)
```

## Anti-Patterns
- ❌ Reading DataStore on Main thread (use Flow or suspend).
- ❌ Using DataStore for large/domain datasets instead of small preferences/settings.
- ❌ Repeated writes from hot UI events without coalescing/debounce justified by behavior.
- ❌ Multiple DataStore instances for same file.
