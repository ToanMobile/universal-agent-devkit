# 14 — Null Safety

## Prioritize Non-Nullable
- Default: non-nullable types (`String`, `Int`, `List<Item>`).
- Add `?` only when null is a valid business state.

## Safe Patterns

### ✅ Prefer
```kotlin
// Safe call
val length = text?.length

// Elvis operator
val name = user.name ?: "Unknown"

// Safe cast
val textView = view as? TextView
textView?.text = "Hello"

// requireNotNull for preconditions
fun process(user: User?) {
    val nonNullUser = requireNotNull(user) { "User must not be null" }
    // nonNullUser is now User (non-null)
}

// checkNotNull for validation
fun validate(input: String?) {
    checkNotNull(input) { "Input must not be null" }
}

// ?.let for null-safe block
document?.let { doc ->
    processDocument(doc)
}

// filterNotNull for collections
val validItems = items.filterNotNull()

// .orEmpty() for nullable collections
val list = maybeNullList.orEmpty()
```

### ❌ Avoid
```kotlin
// ❌ Force unwrap
val length = text!!.length  // CRASH if null

// ❌ Implicit null check with if
if (text != null) {
    // text is smart-cast but verbose
}

// ❌ Manual null check with throw
if (text == null) throw IllegalStateException()
// use requireNotNull(text) instead
```

## Platform Types (Java Interop)
```kotlin
// Java returns @Nullable String → Kotlin sees String!
// Always explicitly type:
val result: String? = javaMethod() // safe — nullable
val result: String = javaMethod()  // dangerous — NPE possible if null

// Best: annotate Java code with @Nullable/@NonNull
// Fallback: wrap with explicit null check
val result = javaMethod() ?: "default"
```
