# 44 — Systematic Debugging

## 4-Phase Debugging Process

### Phase 1: Investigate Root Cause
1. Reproduce the bug reliably.
2. Collect evidence: Logcat, screenshots, video, crash logs.
3. Identify the **exact** failure point (not symptoms).
4. Check if it's a regression (when did it break?).

### Phase 2: Analyze Pattern
1. Is the bug in: UI, ViewModel, Repository, Native, or Data?
2. Check recent changes (git log, blame).
3. Check project memory (`.claude/memory/`) for similar issues.
4. Determine blast radius (how many features affected?).

### Phase 3: Hypothesize & Verify
1. Form hypothesis about root cause.
2. Test hypothesis with targeted logging or breakpoints.
3. If wrong → go back to Phase 2.
4. Sau 2 hypothesis thất bại → bỏ hypothesis/đường tấn công đó, quay lại Phase 2 với oracle phân biệt
   mới; tiếp tục mọi phần độc lập theo `CLAUDE.md B9`.

### Phase 4: Implement Fix
1. Bắt buộc chạy pre-edit RED của **PAIRED EXECUTABLE ORACLE**, không có waiver, cho root cause đã phân biệt.
2. Fix **root cause**, not symptom.
3. Chạy GREEN bằng cùng acceptance/scenario/oracle/execution identity.
4. Update project memory if P0/P1.
5. Verify fix doesn't break anything else.

## Escalation Rule
- After **2 failed fix attempts** on the same root cause → abandon/đổi hypothesis và đường tấn công,
  không vá tiếp cùng premise.
- Đây là checkpoint đổi cách làm, không phải kết thúc task hay mặc định hỏi User. Chỉ dừng khi lựa chọn
  còn lại thật sự trúng terminal đóng của `CLAUDE.md B9`.

## Architecture Smell — ≥3 Fixes Each Spawning a New Problem
> Adapted từ obra/superpowers (systematic-debugging). Bổ sung cho CLAUDE.md Rule 6.4.

- **≥3 fix liên tiếp, mỗi fix lại đẻ ra một bug mới** → đây KHÔNG phải chuỗi hypothesis sai; đây là dấu hiệu **kiến trúc/thiết kế sai**. STOP đường vá đó, đặt lại câu hỏi thiết kế (seam đặt sai? state ở nhầm layer? contract giữa 2 module mơ hồ?) rồi tiếp tục theo plan đã revise/review.
- Khác với "2 failed hypothesis" (Phase 3): 2-failed = một root cause chưa tìm ra. 3-fixes-spawn-new = mỗi fix đúng cục bộ nhưng phá chỗ khác → vấn đề nằm ở boundary, không ở logic đơn lẻ.

## Boundary Instrumentation — Khoanh Vùng Component Lỗi Trước Khi Đoán
- Bug đi qua nhiều layer (UI → VM → Repo → Native)? **Log data VÀO và RA mỗi ranh giới** trước khi hình thành hypothesis.
- So input/output từng chặng với kỳ vọng → chặng đầu tiên lệch = component lỗi. Tránh đoán mù ở sai layer.
- App: `Timber.d` với event name ổn định + correlation id tại mỗi boundary; xem [[observability-instrumentation]].

## Red Flags — Stop and Return to Phase 1
- Fix breaks something else.
- Logcat shows new/different errors after fix.
- Root cause changes during investigation.
- Bug behavior changes after seemingly unrelated code change.

## Debugging by Layer

| Layer | Tools |
|:---|:---|
| Compose UI | Layout Inspector, Compose compiler reports, `Modifier.debugBorder()` |
| ViewModel | Log state transitions, `Timber.d()` in init block |
| Repository | Log network calls, check Room queries with Database Inspector |
| Native (PDF) | `adb logcat -s "PDFRenderer"`, native crash tombstone |
| Coroutines | Debug coroutine agent (`-Dkotlinx.coroutines.debug`), thread dumps |
| Memory | Memory Profiler, heap dump analysis, LeakCanary |

## Anti-Patterns
- ❌ Fixing without understanding root cause.
- ❌ Adding `try-catch` to suppress symptoms.
- ❌ Changing multiple things at once (can't isolate fix).
- ❌ Not checking recent changes before debugging.
- ❌ Not writing regression test after fix.
