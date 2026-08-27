# 21 — Compose Preview

## Naming Pattern
```
<ComponentName>Preview[_<Variant>]
```
Example: `DocumentCardPreview_Light`, `DocumentCardPreview_Dark`, `DocumentCardPreview_LargeFont`

### ✅ Mandatory
- At least 1 Preview per public Composable.
- Preview must use `MaterialTheme` wrapper.
- Preview must pass representative data (not empty/default).

### Variant Previews (encouraged)
```kotlin
@Preview(name = "Light", showBackground = true)
@Preview(name = "Dark", showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Preview(name = "Large Font", fontScale = 1.5f)
@Preview(name = "Small Screen", widthDp = 320, heightDp = 640)
@Composable
fun DocumentCardPreview() {
    OfficeReaderTheme {
        DocumentCard(
            document = Document(
                id = "1",
                name = "Annual Report 2024.pdf",
                pageCount = 42,
                lastModified = System.currentTimeMillis()
            ),
            onClick = {}
        )
    }
}
```

### ❌ Don't
- Don't put Preview in production source (use `*Preview.kt` file or separate source set).
- Don't use `Preview` with real ViewModel.
- Don't preview empty/null state without explicit naming (e.g., `EmptyStatePreview`).

### Multi-Preview Annotation (reduce boilerplate)
```kotlin
@Preview(name = "Light")
@Preview(name = "Dark", uiMode = UI_MODE_NIGHT_YES)
annotation class ThemePreviews
```

### Accessibility Preview
```kotlin
@Preview(name = "RTL", locale = "ar")
@Preview(name = "Large Font 2x", fontScale = 2.0f)
@Composable
fun DocumentCardAccessibilityPreview() { ... }
```
