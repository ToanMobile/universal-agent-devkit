# Localization

## Adding Strings

### Step 1: Add to `strings.xml` (English base)
```xml
<!-- app/src/main/res/values/strings.xml -->
<string name="document_open">Open Document</string>
<string name="document_delete_confirm">Are you sure you want to delete \"%1$s\"?</string>
<string name="page_count">%1$d pages</string>
```

### Step 2: Use in Code
```kotlin
// In Composable
Text(text = stringResource(R.string.document_open))

// In ViewModel (requires Context via AndroidViewModel or resource provider)
// Preferred: pass resource ID to UI, resolve in Composable
Text(
    text = stringResource(
        R.string.document_delete_confirm,
        documentName
    )
)
```

### Step 3: Run Translation Script
```bash
# Auto-translate using translation service
./scripts/translate_strings.sh

# or directly:
# python3 scripts/translate_strings.py --input app/src/main/res/values/strings.xml
```

```bash
# Find hardcoded text in code
grep -rn "\"[A-Z]" --include="*.kt" app/src/main/java/ | grep -v "import\|package\|//\|R\.string\|Timber\|Log\."
```

## Key Naming Rules
- `feature_action_object` — e.g., `document_open_button`, `scanner_capture_title`.
- Group by feature: `document_*`, `scanner_*`, `profile_*`, `dialog_*`.
- Suffixes: `_title`, `_message`, `_button`, `_hint`, `_error`.
- Use `CDATA` for strings with HTML tags.

## Directory Structure
```
app/src/main/res/
├── values/                  # English (base)
│   └── strings.xml
├── values-es/               # Spanish
│   └── strings.xml
├── values-vi/               # Vietnamese
│   └── strings.xml
├── values-ar/               # Arabic (RTL)
│   └── strings.xml
├── values-zh-rCN/           # Chinese Simplified
│   └── strings.xml
└── ... (70+ languages)
```

## Pluralization
```xml
<!-- strings.xml -->
<plurals name="page_count">
    <item quantity="one">%1$d page</item>
    <item quantity="other">%1$d pages</item>
</plurals>

<!-- Additional quantity types for languages that need them -->
<plurals name="document_count">
    <item quantity="zero">No documents</item>
    <item quantity="one">%1$d document</item>
    <item quantity="two">%1$d documents</item>
    <item quantity="few">%1$d documents</item>
    <item quantity="many">%1$d documents</item>
    <item quantity="other">%1$d documents</item>
</plurals>
```

```kotlin
// Usage
Text(
    text = pluralStringResource(
        R.plurals.page_count,
        count = pageCount,
        pageCount
    )
)
```

## RTL (Right-to-Left) Support

### RTL Checklist
- [ ] All layouts use `start`/`end` instead of `left`/`right`.
- [ ] All icons auto-mirror where appropriate.
- [ ] Tested with Arabic (`values-ar`) and Hebrew (`values-iw`).
- [ ] Number formatting respects locale.
- [ ] Date/time format respects locale.

## Important Notes
- Always use `stringResource()` — never hardcode strings.
- Format arguments with `%1$s`, `%2$d` (positional).
- Use `plurals` for quantity strings.
- Test with long strings (German, Finnish can be 2-3x English length).

## Date, Time & Number Formatting

### DateFormat / DateTimeFormatter
```kotlin
// ✅ Use locale-aware formatting
val dateFormatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
    .withLocale(Locale.getDefault())
val formatted = LocalDate.now().format(dateFormatter)

// ✅ Or use android.icu.text.DateFormat
val dateFormat = android.icu.text.DateFormat.getDateInstance(
    android.icu.text.DateFormat.MEDIUM,
    Locale.getDefault()
)
val formatted = dateFormat.format(Date())

// ❌ Don't hardcode format
val formatted = SimpleDateFormat("MM/dd/yyyy").format(Date()) // US-only
```

### NumberFormat
```kotlin
// ✅ File size
val formatter = NumberFormat.getCompactNumberInstance(
    Locale.getDefault(),
    NumberFormat.Style.SHORT
)
val size = formatter.format(fileSizeBytes) // "1.2 MB" or "١٫٢ م.ب" in Arabic

// ✅ Percentage
val percentFormat = NumberFormat.getPercentInstance(Locale.getDefault())
percentFormat.maximumFractionDigits = 1
val progress = percentFormat.format(0.75) // "75%" or "٧٥٪"

// ✅ Page numbers
val pageFormat = NumberFormat.getIntegerInstance(Locale.getDefault())
val pageNum = pageFormat.format(42) // "42" or "٤٢"
```

### General Rules
- **Always** use locale-aware formatters (never hardcode patterns like `MM/dd/yyyy`).
- Test with `ar` (Arabic), `fa` (Persian), `hi` (Hindi) locales — different numeral systems.
- File size, percentages, page numbers — all must use `NumberFormat`.

### Anti-Patterns
```kotlin
// ❌ Hardcoded format
"${fileSize / 1024 / 1024} MB"

// ❌ Hardcoded date format
SimpleDateFormat("MM/dd/yyyy")

// ❌ Assuming decimal numerals
page.toString()

// ✅ Correct
NumberFormat.getCompactNumberInstance(Locale.getDefault(), NumberFormat.Style.SHORT).format(fileSize)
DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(Locale.getDefault())
NumberFormat.getIntegerInstance(Locale.getDefault()).format(page)
```

---

## XML Resource Validation (🔴 P0)

### Principle
**Every locale XML in `res/values-*/` must be well-formed before merge.** AAPT2 strict-parses entity references; an unescaped literal `&` in any string body fails `:app:packageDebugResources` and blocks the entire build. Past incident: 6 locale files had `& ` in `compress_medium_desc` after a vendor translation merge — caught only on CI build, not on contributor's machine.

### Mandatory Escapes
| Literal | XML escape |
|---------|------------|
| `&`     | `&amp;`    |
| `<`     | `&lt;`     |
| `>`     | `&gt;`     |
| `"`     | `&quot;`   |
| `'`     | `&apos;`   |

`&` inside `<!-- ... -->` is tolerated by AAPT2 but **avoid** for clarity.

### Pre-Commit / CI Gate
```bash
# Full repo (1-2s)
python3 scripts/translations/validate_xml.py

# Only changed vs main (fastest)
python3 scripts/translations/validate_xml.py --diff origin/main
```

Wired into `unit-test` job of `.github/workflows/qa-ci.yml` — runs before Gradle for fast PR feedback. Exits non-zero on any invalid file; output names the file + line + offending fragment.

### Translation Merge Workflow
Whenever a translation PR touches `**/res/values-*/*.xml`:
1. Vendor exports translations → contributor commits raw output.
2. **Mandatory**: run `python3 scripts/translations/validate_xml.py` locally before pushing.
3. CI re-runs validator and `:app:packageDebugResources` — both must pass.
4. Lint rule `StringFormatInvalid` provides additional safety net.
