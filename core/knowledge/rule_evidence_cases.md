# Rule Evidence Cases — vì sao từng luật tồn tại

`CLAUDE.md` / `AGENTS.md` giữ **mệnh lệnh**; file này giữ **sự cố sinh ra mệnh lệnh đó**.
Luật trong contract trỏ về đây bằng `→ knowledge/rule_evidence_cases.md#<case>`.

Đọc file này khi: định bỏ/nới một luật, hoặc không hiểu vì sao luật có vẻ khắt khe quá mức.
KHÔNG cần đọc trong lúc làm task bình thường — contract đã đủ để hành động.

**Ranh giới với `rule5_validation.md`:** file kia là tài liệu chuẩn về *các control chống fabrication
là gì, cách validate chúng, và giới hạn của chúng*. File này chỉ giữ *sự cố đo được và chỗ thủng đo
được*. Đừng chép nội dung qua lại — trỏ link.

---

## case-ev01 — Root cause phải là discriminating evidence (`5.8`, `W3` premise hygiene)

Chi tiết đầy đủ: `.claude/memory/feedback_ev01_discriminating_evidence_case.md`.

Tóm tắt: thuyết "lỗi do `pressEnter`" bị bác bằng **pass/fail contrast** —
`navigateNextPrevious` PASS trong khi vẫn dùng chính `pressEnter`. Cause thật là
fixture↔term mismatch, chứng minh bằng **repro toggle**: đổi term → 10 test RED→GREEN.

Bài học thứ hai từ cùng ca: **2 reviewer đã "xác nhận" premise sai** do chính main agent mớm.
Reviewer đọc lại cùng source = thêm một lens đọc, không phải loại evidence độc lập.

---

## case-comment-2026-07-27 — Claim sai lọt vào KDoc/comment (`5.1`, ghi chú cuối Rule 5)

Đo 2026-07-27: **3 claim sai lọt vào KDoc/comment** + **1 line-ref sai**:

1. một negative claim chưa hề grep,
2. một câu "đã được test ở chỗ khác" — sai,
3. một cơ chế runtime không tồn tại.

Cả 4 đều đã bị dòng C1/C4 cấm sẵn từ trước. Nguyên nhân lọt: lúc viết comment nó *cảm giác*
như "đang viết code" chứ không phải "đang phát biểu", nên gate 5.6 không được kích hoạt.

Vì sao nghiêm trọng hơn claim sai trong response: comment ở lại trong code và người sau đọc nó
như fact.

---

## case-review-timing-2026-07-27 — Review cuối batch nhân bản lỗi (`W3`)

Đo 2026-07-27: viết **5 fix rồi mới review một lần ở cuối** → cùng **2 lỗi** xuất hiện ở **3/5 fix**:

- RED-check không phân biệt được (không giết riêng từng phần load-bearing),
- claim tự tin đặt trong code comment mà chưa hề grep.

Review ngay sau fix #1 sẽ chặn pattern ở 1 ca thay vì 3. Đây là lý do W3 đặt tuyến phòng thủ
đầu tiên ở *fix đầu tiên của mỗi lớp defect*, không phải ở cuối batch.

---

## case-redcheck-lies — 3 dạng RED-check nói dối (Deep Audit `check 2`)

Cả 3 đều đã quan sát được trong project:

1. **Revert cả change.** Revert hết rồi thấy đỏ chỉ chứng minh test phụ thuộc change *bằng cách
   nào đó*. Đo 2026-07-27: stash 2 ViewModel → test đỏ; nhưng xoá riêng `.debounce(...)` → test
   vẫn XANH, vì `StateFlow` conflation một mình đã gộp emission. Phần `.debounce` không hề có
   coverage.
2. **Sửa test sau khi RED-check.** Đổi assertion/mock/dispatcher hoặc thêm `mockkStatic` làm
   verdict cũ hết hiệu lực. Đo: một `mockkStatic` thêm vào để "tăng sức mạnh" 2 test lại dựng
   recording surface mới che các call phát ra trong `beforeTest` → mutant xoá
   `.filter { it.isNotEmpty() }` sống sót. Test YẾU đi sau khi "được tăng cường".
3. **Xanh trên device coi là evidence.** Đo: một instrumented test PASS y hệt nhau khi có và khi
   không có fix — fresh install rơi vào onboarding nên màn hình cần test chưa bao giờ được compose.
   Xanh cả hai chiều = phân biệt được 0 thứ, dù trên device hay JVM.

---

## case-testsourceset-2026-07-16 — Debug build xanh, CI đỏ (Deep Audit `check 1`)

Nguồn: header `.claude/hooks/testsourceset_gate.sh`.

Thêm một param vào constructor `PermissionViewModel` mà không cập nhật 2 call site trong
`src/test`. `:app:assembleDebug` VÀ `:<module>:compileDebugKotlin` đều xanh — không lệnh nào
compile unit-test source set. Lỗi chỉ lộ khi một reviewer context-sạch chạy tay
`compileDebugUnitTestKotlin`. Nó đã hạ `StoragePermissionReleaseGateTest`, tức release gate.

Ghi chú của chính hook: *"Prose rules did not prevent this (Deep Audit Loop already said
'targeted module compile'); a command that actually runs does."*

---

## case-wired-not-live-2026-07-27 — Wire xong ≠ đang bảo vệ (`W6`)

Chạy thử một task Kotlin thật để kiểm `precode_gate.sh` ngay sau khi wire nó. Trước đó nó đã pass
7/7 fixture và đã được báo cáo là "chặn thật". Kết quả thật khác hẳn, lộ ra **hai** defect:

**Defect A — gate tự vô hiệu hoá chính nó.** Điều kiện "đã xem file" tính MỌI `tool_use` có
`file_path` khớp, gồm cả `Edit`. Nên một lần Edit mù — kể cả lần **thất bại** với lỗi "String to
replace not found" — cũng đánh dấu file là "đã xem", và lần thử lại không bao giờ bị chặn nữa.
Chính hành động mà gate sinh ra để ngăn lại là thứ tháo ngòi nó. Log thật lúc 16:44:37:
`EventName.kt: đã xem trong phiên — pass`, trong khi file đó chưa hề được `Read`.
Đã sửa: chỉ `Read` mới tính. Không cần ngoại lệ cho edit hợp lệ trước đó — harness bắt buộc Read
trước Edit nên cái Read đó luôn có trong transcript. Regression: 7/7, gồm 2 case dựng lại đúng ca này.

**Defect B — hook vừa wire không lập tức có hiệu lực.** Lần Edit `.kt` thật đầu tiên (~16:42) đi lọt
hoàn toàn và **không sinh dòng log nào** — hook chưa được harness gọi. Hai lần sau (16:44:37,
16:45:12) mới có log. Nghĩa là giữa lúc `settings.json` đổi và lúc hook thật sự chạy có một độ trễ.

Bài học chung, đã thành luật ở `W6`: gọi script bằng fixture chứng minh **script đúng**, không chứng
minh **harness gọi nó**. Đó đúng là cặp action/outcome của dòng C5 — "đã wire" (exit 0) không phải
"đang chặn" (cần quan sát nó kêu thật). Không có bước chạy thật này thì cả hai defect đều vô hình:
fixture không dựng được ca "Edit thất bại rồi thử lại", và fixture thì bao giờ cũng gọi script trực tiếp.

---

## case-gate-false-positive-2026-07-27 — Gate chặn nhầm VÀ báo sai nguyên nhân (`W4`)

Ngay trong lượt vừa wire `testsourceset_gate.sh` vào `Stop`, nó chặn với thông điệp
*"test source set không compile — module tôi vừa sửa có call site trong src/test đang vỡ"*.

Ba chi tiết khiến thông điệp đó sai hoàn toàn:

1. Chạy tay `compileDebugUnitTestKotlin` cho đúng 5 module đó → **exit 0**, compile sạch.
2. Tôi **không sửa file `.kt`/`.java` nào** trong lượt đó — chỉ `.sh/.json/.md`. Các file dirty là
   của phiên khác. Câu "module tôi vừa sửa" là bịa từ phía gate.
3. Phần in lỗi trong thông điệp **rỗng**, vì gate lọc `grep -E '^e: |error:'` và không có dòng nào
   khớp — tức gradle fail mà KHÔNG có lỗi compile nào.

Nguyên nhân gốc trong script: `RC != 0` được coi thẳng là "test source set vỡ". Gradle exit khác 0
vì rất nhiều lý do hạ tầng — daemon chết, tranh lock với build đang chạy song song, OOM, resolve
plugin/network, timeout của harness. Tệ hơn: `OUT` bị vứt đi khi không khớp pattern, nên **evidence
để chẩn đoán bị xoá**. Đến giờ vẫn không biết lần fail 16:26:37 là do gì — C9, gate đã ăn mất bằng chứng.

Bẫy đi kèm, cả ba đều hấp dẫn và đều sai: lờ block đi tiếp; `TESTSOURCESET_GATE=0` cho qua; hoặc đi
"sửa" file `.kt` của phiên khác cho gate hết kêu. Cái thứ ba nguy nhất — nó phá `5.5` để chiều một
gate đang hỏng.

Đã sửa: phân loại `COMPILE` (có `^e: `/`error:`/`Compilation error`/`compile…FAILED`) → chặn kèm lỗi
thật; còn lại → `INFRA`, fail-open, in 8 dòng cuối và ghi toàn bộ output ra
`.claude/audit-gate/testsourceset_last_failure.txt`. Verify: 5/5 mẫu phân loại đúng, gate chạy lại PASS.

Bài học thành luật ở `W4`: **gate false-positive nguy hiểm hơn gate thiếu** — gate thiếu chỉ là không
bắt được; gate kêu sai kèm nguyên nhân sai thì chủ động đẩy người đọc đi sửa nhầm chỗ, và dạy họ tắt gate.

**Ca thứ hai, cùng ngày — `test_evidence_gate.sh` chặn chính tác giả của nó.** Ngay lượt sau khi wire,
nó chặn với lý do "response claim test pass nhưng XML không chống lưng". Câu bị bắt là
*"Test chuyển xanh thì streak reset"* — tôi đang **mô tả state machine của chính gate đó**, không claim
test nào pass cả.

Cơ chế: regex khớp `test…xanh`, còn `thì` — dấu hiệu câu điều kiện trong tiếng Việt ("X **thì** Y" biến
X thành ĐIỀU KIỆN chứ không phải khẳng định) — lại nằm **SAU** claim, nên bộ lọc hypothetical theo vị
trí (chỉ nhìn marker đứng TRƯỚC) không thấy. Đã thêm veto `thì` xuất hiện sau match. 13 case regression,
gồm đúng câu đã gây ra nó.

Bài học bổ sung: **văn bản mô tả một gate rất dễ trúng chính regex của gate đó.** Khi viết hook nhận
diện claim, phải cho vào bộ test cả những câu *nói về* claim, không chỉ những câu *là* claim. Hai loại
này trông giống hệt nhau với regex.

Phạm vi cố ý của gate: nó chỉ soi `TEST-*.xml` của gradle. Kết quả fixture/probe của chính hook
("13/13 case") không nằm trong đó và **không** bị đòi XML — đúng thiết kế, không phải lỗ hổng.

**Ca thứ ba — gate RED-check phạt đúng người vừa làm đúng.** Cùng ngày, sau khi thêm nhánh RED-check,
tôi làm một RED-check chuẩn sách giáo khoa trên `AnalyticsPiiSanitizerTest`: xanh (67/0/0/0) → gỡ
`.trimEnd()` → đỏ đúng 1 test là test mới → khôi phục → xanh. Cuối lượt gate chặn với lý do *"chưa
từng thấy ĐỎ trong phiên này"*.

Cơ chế: gate chỉ **chụp trạng thái XML tại mỗi Stop**. Cả chu kỳ đỏ→xanh nằm gọn trong MỘT lượt, nên
file XML đỏ đã bị lần chạy xanh ghi đè trước khi có Stop nào xảy ra. Gate không nhìn thấy gì ngoài
trạng thái xanh cuối cùng — và kết luận ngược hoàn toàn với sự thật.

Đây là dạng nguy hiểm nhất trong các false positive đã gặp: nó **phạt đúng hành vi mà rule muốn
khuyến khích**. Ai bị nó chặn vài lần sẽ học được bài học sai là "làm RED-check tử tế thì bị chặn,
thôi đừng làm".

Đã sửa bằng cách thêm **nguồn evidence thứ hai, độc lập với snapshot**: quét transcript tìm output
báo suite ĐỎ (`<testsuite … failures="N">` với N>0, hoặc dòng gradle `…Test … FAILED`) và so vị trí
với lần sửa file test cuối, nên điều khoản hết hiệu lực vẫn giữ nguyên. 4 case regression dựng lại
đúng ca này, cộng 16 case cũ không vỡ.

Bài học tổng quát: **một gate lấy mẫu theo mốc thời gian sẽ mù với mọi chu kỳ hoàn tất giữa hai mốc.**
Khi thiết kế, hỏi ngay "hành vi đúng có thể bắt đầu VÀ kết thúc giữa hai lần lấy mẫu không?" — nếu có
thì cần nguồn evidence thứ hai, không phụ thuộc tần suất lấy mẫu.

**Ca thứ tư, cùng chu kỳ RED-check đó — `review_timing_guard` kêu 5 lần liên tiếp.** Mỗi mutation của
RED-check là một edit vào main source, và mỗi cái được đóng lại bằng một lần chạy gradle — tức đúng
hình dạng "một fix" theo proxy của guard. Nên nó đếm 5 fix chưa review, trong khi thực tế là MỘT
verification bắt buộc của `check 2`.

Cùng lớp với ca RED-check ở trên: **gate phạt đúng hành vi rule bắt buộc**. Nếu để nguyên, bài học mà
người dùng rút ra sẽ là "làm RED-check thì bị hai gate khác nhau chửi".

Đã sửa phần chắc chắn sai: edit khiến file trở về **trùng khớp HEAD** là REVERT, không phải fix — bỏ
qua, cả với edit đang kích hoạt hook lẫn edit đọc từ transcript. Cờ `dirty_ok` phân biệt "git nói
không có gì dirty" với "git lỗi", để lỗi git không biến thành miễn trừ toàn bộ. 5 case regression.

Residual chưa xử: bản thân edit MUTATION (chưa revert) vẫn bị tính là mở fix mới. Không phân biệt được
tại thời điểm `PostToolUse` — lúc đó chưa biết nó sẽ được revert. Muốn triệt để thì phải dời quyết định
sang `Stop`, nơi cặp mutation/revert đã triệt tiêu; chưa làm, ghi lại ở đây.

---

## case-gate-conflict-2026-07-27 — Hai gate đúng riêng lẻ, đóng kín không gian hành động (`W2`)

`churn_guard` cảnh báo khi sửa cùng file 3 lần **không có evidence xen giữa**. `review_timing_guard`
cảnh báo khi mở edit mới **sau một lần chạy evidence** mà fix trước chưa review. Ghép lại:

- Chèn evidence giữa các edit → `churn_guard` im, `review_timing_guard` **kêu**.
- Gom edit không chèn evidence → `review_timing_guard` im, `churn_guard` **kêu**.

**Không nhịp sửa nào thoả cả hai.** Bằng chứng đối chiếu 1-1, cùng 5 edit cùng timestamp:
`churn_guard.log` ghi "1/3 — pass" cả 5 lần trong khi `review_timing_guard.log` ghi WARN cả 5 lần.

Nghiêm trọng vì chuỗi bị kẹt chính là vòng *sửa → chạy test → sửa* mà `check 2` RED-check **bắt buộc**.
Đã xử lý bằng cách **gỡ `review_timing_guard`** khỏi wiring, không phải vá thêm — mục đích của nó
(review sau fix #1) đã có `review_gate` phủ ở Stop.

Bài học: hai luật cùng đúng riêng lẻ vẫn có thể loại trừ nhau. Phải thử **giao** của các gate trước
khi wire, không chỉ từng cái một.

---

## case-subagent-coordination-2026-07-27 — Hai cái bẫy khi chạy sub-agent song song (`W3`)

**Scope chồng lấn.** Reviewer đang đọc `test_evidence_gate.sh` thì main context vá chính file đó (một
gate vừa chặn, `W4` bắt sửa ngay trong lượt). Finding trả về nhắm vào bản đã cũ. → Scope các agent
phải rời nhau, và main context không sửa file agent đang đọc; buộc phải sửa thì nêu rõ độ lệch khi
đối chiếu finding.

**Agent chết im lặng.** Một reviewer nền kết thúc ở trạng thái `stopped`, trả về **0 finding** — nó
đang chạy khi process phiên trước thoát. Nếu tính "đã delegate" là "đã review" thì 7 file hook coi
như đã qua review trong khi chưa ai nhìn. → Chỉ tính là đã review khi kết quả THỰC SỰ về tay.
`review_gate` chỉ thấy agent **được gọi**, không thấy nó có trả lời hay không.

---

## case-token-oracle — "Token còn" KHÔNG chứng minh "nghĩa vụ còn"

Ca đo 2026-07-27, khi viết lại `CLAUDE.md`/`AGENTS.md` với cam kết "giữ 100% luật".

Oracle đã dùng: trích ~300 token đặc trưng (identifier, path, lệnh, ngưỡng số, mã luật) từ bản cũ,
đối chiếu bản mới, báo "chỉ thiếu chữ IN HOA nhấn mạnh" → kết luận không mất luật. **Kết luận đó sai.**

Một vòng review độc lập sau đó tìm ra 2 nghĩa vụ đã biến mất mà oracle báo sạch:

1. "JetBrains MCP offline → `Read`/`Grep` fallback, **ghi rõ lý do fallback**" — `grep -c offline
   CLAUDE.md` = 0.
2. Vế cưỡng chế của `5.6`⑨: "không cite được = chưa qua gate, KHÔNG phát biểu".

Vì sao lọt: token `offline`, `cite`, `Read`, `Grep` vẫn tồn tại ở chỗ khác trong file, nên phép so
tập hợp token không thấy gì mất. Oracle chứng minh **từ vựng**, không chứng minh **mệnh lệnh**.

Cách làm đúng khi refactor tài liệu chuẩn: liệt kê từng **câu mệnh lệnh** của bản cũ (BẮT BUỘC/CẤM/
PHẢI/chỉ khi/→) rồi map 1-1 sang bản mới; token oracle chỉ dùng làm lưới chặn thô chạy trước.

Tổng quát hơn: một verification chỉ có giá trị khi nó **có khả năng fail đúng chỗ mình lo**. Oracle
này không bao giờ fail vì mất nghĩa vụ — cấu trúc của nó không cho phép, nên nó không phải evidence
cho câu hỏi đang hỏi (`5.8` (i)).

---

## case-gate-audit-2026-07-27 — Tầng gate máy thủng ở đâu (`§ TẦNG GATE MÁY`)

Audit toàn bộ enforcement layer, 2026-07-27. Evidence là tool output trong phiên.

**Đang wire lúc audit:** `PreToolUse(Bash)` → `block-dangerous-git.sh`; `SessionStart` →
`detect_changes`; `Stop` → `claim_check.sh`, `review_gate.sh`.

> **Trạng thái sau khắc phục (cùng ngày):** F1 đã vá (verify bằng RED/GREEN 10 case), F2 đã wire
> (dry-run PASS trên 5 module đang dirty), và thêm `churn_guard.sh` ở `PostToolUse` cho `6.4b`.
> F3 (timing end-of-batch) và F4 (comment/KDoc) **vẫn mở** — đọc phần dưới như hồ sơ sự cố, còn
> trạng thái gate hiện tại thì xem `CLAUDE.md` § TẦNG GATE MÁY.

**F1 — `claim_check.sh` bỏ lọt đúng 2 lớp lỗi nó nhắm tới.** Repro toggle, cùng dạng câu, khác
đúng 1 yếu tố:

| input | exit | ý nghĩa |
|---|---|---|
| `Xem NeverReadFile.kt:12` | 2 | control — file chưa Read → chặn đúng |
| `Tôi đã chạy test cho module này.` | 2 | control — không có từ phủ định → chặn đúng |
| `Xem CLAUDE.md:99999` | **0** | file đã Read → **mọi số dòng đều lọt** |
| `Tôi đã chạy test và không có failure nào.` | **0** | có "không" cùng câu → **lọt** |
| `Tôi đã chạy test, cần xem thêm logcat.` | **0** | có "cần" cùng câu → **lọt** |

Cơ chế: `claim_check.sh:188-191` nhận citation chỉ vì `base in accessed_basenames`
(đúng-file, không kiểm số dòng); `claim_check.sh:101` `PA_HYP` loại **cả câu** khi gặp bất kỳ
từ nào trong `nếu|giả sử|nên|should|if|sẽ|chưa|cần|không`.

**F2 — `testsourceset_gate.sh` tồn tại nhưng KHÔNG được wire.** Không xuất hiện trong
`settings.json`/`settings.local.json`; log dừng ở `2026-07-16T14:00:16`. Hệ quả kép: check 1 mất
gate máy, và `claim_check.sh` header tự ủy thác *"The gradle Stop gate is the real check for
build/test claims"* — Stop hook không có gate nào chạy gradle.

**F3 — `review_gate.sh` chạy ở `Stop` nên ngữ nghĩa là end-of-batch**, đúng cái W3 cấm. Entry
`2026-07-27T13:04:03` liệt kê **14 file** .kt/.java tích luỹ trong một lần block. Theo
`gate_stats.sh`: **462 BLOCK** thật, cộng **140 lần** `BLOCK suppressed after 3 attempts` — gate tự
thả kèm dòng "manual review still required". *(Đếm bằng `grep -c BLOCK` ra 602 vì gộp cả 140 dòng
suppressed — dùng `gate_stats.sh`, đừng grep tay.)*

**F4 — `claim_check` chỉ quét `last_assistant_message`**, không quét nội dung Edit/Write, và
settings không có `PostToolUse` → comment/KDoc (case-comment-2026-07-27) có 0 enforcement.

**Số liệu vận hành — đọc kèm cảnh báo.** Đếm bằng `bash .claude/knowledge/gate_stats.sh` (công cụ
có sẵn, đừng grep tay): `claim_check` **56 BLOCK** = 48 citation + 8 past-action.

⚠️ **Con số này KHÔNG phải tần suất lỗi thật.** `rule5_validation.md` § Limits đã ghi từ trước: log
`.claude/audit-gate/` là artifact local, **có thể chứa entry do test sinh**, aggregate ≠ số sự cố
fabrication thật. Xác nhận cụ thể: 3 trong 56 BLOCK là do chính probe của phiên 2026-07-27 tạo ra
(`NeverReadFile.kt:12`) — trước probe là 53. Dùng số này để nói "gate có fire và fire ở đâu nhiều
nhất" thì được; **suy ra phân bố lỗi thật thì không**.

Điều rút ra KHÔNG dựa vào con số: lớp lỗi bị chặn nhiều nhất (~86% là citation) rơi vào đúng gạch
đầu dòng **ngắn nhất và nổi nhất** của `5.1`. Nên vấn đề không phải luật bị chôn vì dài → rút gọn
luật không tự nó cải thiện chất lượng.

Liên quan: `.claude/knowledge/rule5_validation.md` (validation của chính các control này + Limits).

**Kết luận dùng để thiết kế card `§ TẦNG GATE MÁY`:** C3 (root cause), C4 (negative/scope), hedge,
comment/KDoc, 5.5 authority và test-PASS đều **không có gate chặn** — chúng sống hoàn toàn bằng
kỷ luật của agent.

---

## case-pdf-renderer-robolectric-2026-07-29 — Shadow trả cùng tín hiệu cho hai fixture đối chứng

**Claim/premise đã bị bác bỏ:** plan preflight từng dùng kết quả Robolectric
`PdfRenderer.pageCount == 0` trên PDF 0 trang làm bằng chứng rằng unit-test path có thể phân biệt PDF
0 trang với PDF hợp lệ. Premise này đến từ một probe chỉ có positive case, không có one-page control.

**Bằng chứng phân biệt:** cùng test stack và cùng API 34, fixture zero-page 233 byte và fixture
one-page 1.753 byte đều trả `pageCount == 0`; trong khi `mdls` trả `(null)` cho zero-page và `1` cho
one-page. Chuyển Robolectric sang API 35 không giải quyết: constructor thất bại bằng
`NoSuchMethodError: java.io.FileDescriptor.getOwnerId$()`.

**Hệ quả:** Robolectric `PdfRenderer` trong cấu hình này không phải oracle cho page count thật. Một
test xanh sau guard có thể đồng thời chặn PDF một trang, nên không được dùng nó để claim fixture/page
regression safety.

**Prevention:** mọi parser/shadow probe phải có positive và negative control trong cùng lượt trước khi
được chọn làm oracle. Với branch `pageCount == 0`, tách:

- runtime acceptance qua `compressPdf` để chứng minh nhánh zero bị reject;
- pure 0/1 guard oracle để giết comparator mutant;
- resource-ownership oracle qua mock session;
- fixture classification bằng parser độc lập, còn device-level `PdfRenderer` giữ là residual cho đến
  khi có authority thay đổi shared device state.

---

## case-mutant-false-survivor-2026-08-01 — Harness mutation nói dối theo hướng có lợi (`check 2`, `W4`)

**Đo được 3 lần trong một task.** Mỗi lần harness báo `SURVIVED`, mỗi lần đều sai, và mỗi lần cái sai
đó đẩy kết luận về phía "phần này chưa có coverage" — tức về phía viết thêm code.

| Lần | Vì sao lượt chạy không có test nào chạy | Harness thấy gì |
|---|---|---|
| 1 | build vỡ do module khác (`:libs:office-reader`) đang sửa dở | XML cũ còn nguyên → đọc thành "không mutant nào chết" |
| 2 | anchor thay thế trúng dòng comment, mutant chưa từng được áp | test xanh thật → "mutant sống" |
| 3 | Gradle vỡ ở `mergeDebugUnitTestResources` (`Cannot access output property 'blameLogOutputFolder'`) | không XML mới → "không có failure" |

**Gốc chung:** harness coi *"không thấy đỏ"* là *"mutant sống"*. Hai mệnh đề đó chỉ tương đương khi
test **đã thực sự chạy với mutant đã thực sự được biên dịch** — và đúng ba điều kiện đó là thứ không
được kiểm.

**Điều kiện tối thiểu cho một verdict mutation hợp lệ** — thiếu bất kỳ vế nào thì verdict vô hiệu,
không phải "SURVIVED":
1. Anchor thay thế **khớp và làm đổi source** (`text != baseline` sau replace).
2. Lượt chạy **có ít nhất 1 test được thực thi** (`ran > 0` đếm từ `<testcase>`), không phải chỉ
   "gradle không in `e:`". Lỗi hạ tầng Gradle không tạo dòng `e:`.
3. XML **mới hơn thời điểm áp mutant**.
4. Production **khôi phục đúng byte** sau đó (`git diff --stat` rỗng).

**Lỗi anh em, cùng bản chất, đo được 2 lần cùng task:** verdict `SURVIVED` ở **phạm vi file** bị đọc
thành `SURVIVED` ở **phạm vi repo**. Chạy `--tests "*ConvertBatchConfirmation*"` cho SURVIVED và sinh
ra kết luận "tính năng không có test nào canh"; chạy `--tests "*Convert*"` thì 5 test trong
`ConvertViewModelTest` đỏ. Một mutant chỉ **sống** khi không test nào **trong toàn repo** giết nó.

→ `CLAUDE.md` `check 2` RED-check, `W4` cấm nới gate cho claim của mình lọt.

---

## case-source-text-pin-2026-08-01 — Test đọc source không có răng hành vi (`B6`, `check 2`)

`ConvertBatchConfirmationContractTest` assert `source.contains("uiState.showBatchConfirmation")` —
đọc file nguồn dạng văn bản, không chạy ViewModel. Đo: mutant vô hiệu hoá hẳn ngưỡng
(`imageCount >= WORKER_THRESHOLD` → `false`) **không** làm nó đỏ, vì chuỗi kia vẫn còn trong source.

Cùng lớp: `PdfSaveUtilsApiContractTest` dùng reflection (`declaredMethods`, `Class.forName`) để pin
sự **tồn tại** của API. Mutant duy nhất giết được là xoá/đổi tên chính API đó, mà việc ấy vỡ compile
ở call site ⇒ không phải mutant hợp lệ.

**Cả hai đều KHÔNG phải lỗi** — chúng canh wiring và API shape, việc mà test hành vi không làm. Nhưng
verdict RED-check của chúng là **`BLOCKED` kèm lý do cấu trúc**, không phải `PASS`. Gọi chúng là PASS
là ghi nhận một tuyến phòng thủ không tồn tại.

Trước khi kết luận một tính năng "không có test nào canh" vì loại test này không đỏ: chạy mutant ở
phạm vi module trước — xem `case-mutant-false-survivor-2026-08-01`.
