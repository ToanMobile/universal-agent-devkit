# 17 — Testing

## Naming Pattern
```
methodName_condition_expectedResult
```
Example: `loadDocuments_networkError_emitErrorState`

## Structure — AAA Pattern (Kotest FunSpec)
```kotlin
class DocumentViewModelTest : FunSpec({
    
    test("loadDocuments success should emit loaded state") {
        // Arrange
        val documents = listOf(Document(id = "1", name = "test.pdf"))
        val repository = mockk<DocumentRepository> {
            coEvery { getDocuments() } returns Result.success(documents)
        }
        val viewModel = DocumentViewModel(repository)
        
        // Act
        viewModel.loadDocuments()
        advanceUntilIdle()
        
        // Assert
        viewModel.state.value.documents shouldBe documents
    }
})
```

## Coverage

Coverage threshold chỉ enforce khi current Gradle/CI gate cấu hình thật hoặc User đặt acceptance.
Không dùng tỷ lệ generic theo layer. Ưu tiên map observable behavior và distinct failure mechanism tới
test/evidence phù hợp.

## Libraries
| Purpose | Library |
|:---|:---|
| Test Framework | Kotest (FunSpec) |
| Mocking | MockK |
| Coroutines | Turbine |
| Compose UI | Compose UI Test |
| Screenshots | Roborazzi |
| Performance | Macrobenchmark |
| Assertions | Kotest Assertions + Strikt |

---

## Compose UI Testing

### Setup
```kotlin
class FeatureScreenTest : FunSpec({
    
    test("should show items when data loaded") {
        composeTestRule.setContent {
            MaterialTheme {
                FeatureContent(
                    state = FeatureState(items = listOf(Item("1", "Item 1"))),
                    onAction = {}
                )
            }
        }
        
        composeTestRule.onNodeWithText("Item 1").assertIsDisplayed()
    }
})

// Helper
fun <T : ComponentActivity> AndroidComposeTestRule<ActivityScenarioRule<T>, T>.createComposeRule() =
    createAndroidComposeRule<T>()
```

### Semantic Matchers (preferred)
```kotlin
// ✅ Semantic matchers — stable across UI changes
composeTestRule.onNodeWithTag("item_list").assertIsDisplayed()
composeTestRule.onNodeWithTag("item_1").assertHasClickAction()

// ❌ Text matchers — break on string changes
composeTestRule.onNodeWithText("Apply").performClick()
```

### Async & State Changes
```kotlin
// Wait for state to settle
composeTestRule.waitForIdle()

// Wait for specific condition
composeTestRule.waitUntil(timeoutMillis = 5000) {
    composeTestRule.onAllNodesWithTag("loaded").fetchSemanticsNodes().isNotEmpty()
}
```

### `testTag` for important elements
```kotlin
// In Composable
Modifier.testTag("submit_button")

// In test
composeTestRule.onNodeWithTag("submit_button").performClick()
```

---

## Coroutine Testing with Turbine

### Setup
```kotlin
class ViewModelTest : FunSpec({
    
    test("state flow should emit loading then data") {
        viewModel.state.test {
            awaitItem().isLoading shouldBe true
            awaitItem().data shouldNotBe null
            cancelAndIgnoreRemainingEvents()
        }
    }
})
```

### TestDispatcher (Kotest FunSpec)
```kotlin
// Automatically configured in FunSpec with test dispatcher
// Use advanceUntilIdle() to process all pending coroutines
viewModel.loadData()
advanceUntilIdle()
```

### Coroutine Testing Rules
- Always use `test` extension on flows with Turbine.
- Call `cancelAndIgnoreRemainingEvents()` after asserting.
- Use `advanceUntilIdle()` to process all coroutines.

## Kotest Assertions Cheat Sheet
```kotlin
x shouldBe y
x shouldNotBe y
list shouldContain item
list shouldNotContain item
result shouldBeInstanceOf<Success>()
expression shouldNotThrowAny()
expression shouldThrow<IllegalArgumentException>()
```

---

## Visual và performance testing

- Dùng screenshot/Roborazzi khi thay đổi visual contract hoặc regression chỉ quan sát được bằng ảnh;
  chọn light/dark/RTL/font variants theo acceptance và risk thật, không tạo matrix mặc định cho mọi UI.
- Dùng macro/microbenchmark khi task có performance acceptance hoặc regression evidence. Iteration,
  warmup và threshold phải lấy từ benchmark/gate hiện có hoặc measurement plan đã thống nhất.
- Test/device task phải được verify từ Gradle module hiện tại; không bịa task name từ ví dụ.

## Test Suite Overview
| Test Type | Location | Command |
|:---|:---|:---|
| Unit tests | `src/test/` | `./gradlew :<module>:testDebugUnitTest --tests "*<TestClass>*"` |
| Instrumented tests | `src/androidTest/` | `./gradlew :<module>:connectedDebugAndroidTest` |
| Screenshot tests | module-specific | Dùng task Roborazzi đã verify trong module |
| Macrobenchmark | `baselineprofile/` | `./gradlew :baselineprofile:connectedCheck` |
