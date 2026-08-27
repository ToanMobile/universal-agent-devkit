# 15 — Accessibility

## Content Description

### Icon / Image
```kotlin
// ✅ Always provide contentDescription
Icon(
    imageVector = Icons.Default.Search,
    contentDescription = stringResource(R.string.search)
)

// ✅ Decorative images
Image(
    painter = painterResource(R.drawable.decorative_line),
    contentDescription = null // null = decorative, screen reader ignores
)

// ❌ Missing contentDescription
Icon(imageVector = Icons.Default.Close, contentDescription = null) // ❌ unless truly decorative
```

## Touch Targets
- **Minimum 48dp** touch target size.
- If icon is 24dp → add `Modifier.size(48.dp)` with padding or `Modifier.padding(12.dp)`.

```kotlin
// ✅ 48dp touch target
IconButton(onClick = { }) {
    Icon(Icons.Default.Close, contentDescription = "Close")
}
// IconButton automatically has 48dp minimum touch target

// Custom clickable
Box(
    modifier = Modifier
        .size(48.dp) // minimum touch target
        .clickable { onClick() }
)
```

## Semantics
```kotlin
// Merge semantics for complex components
Row(modifier = Modifier.semantics(mergeDescendants = true) {
    contentDescription = "Document: $name, $pages pages"
}) {
    Icon(...)
    Text(name)
    Text("$pages pages")
}

// Custom actions
Modifier.semantics {
    customActions = listOf(
        CustomAccessibilityAction("Delete") { onDelete(); true }
    )
}
```

## Color Contrast
- Normal text: ≥ 4.5:1 contrast ratio (WCAG AA).
- Large text (≥ 18sp bold or ≥ 24sp): ≥ 3:1.
- Check with Accessibility Scanner or online contrast checker.

### Preview with font scale & dark mode
```kotlin
@Preview(name = "Large font", fontScale = 1.5f)
@Preview(name = "Largest font", fontScale = 2.0f)
@Preview(name = "Dark mode", uiMode = UI_MODE_NIGHT_YES)
@Composable
fun MyComponentPreview() { ... }
```

## Focus & Keyboard Navigation
- Logical tab order (not random).
- Focus indicators visible.
- `Modifier.focusable()` for interactive non-standard elements.
