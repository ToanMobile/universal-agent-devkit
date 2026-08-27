# Tầng gate máy — chi tiết từng hook

> Tách khỏi `CLAUDE.md` § THẺ THAO TÁC § C ngày 2026-07-28. `CLAUDE.md` giữ phần **quyết định**
> (hook nào chặn thật, cái gì không ai đỡ, gate kêu sai thì làm gì); file này giữ phần **mô tả trạng
> thái** — thứ stale nhanh nhất và chỉ cần khi thật sự đụng vào tầng hook.
>
> Đọc file này TRƯỚC khi sửa/thêm/gỡ hook. Trạng thái verify 2026-07-27, cập nhật 2026-07-29.
> Vì sao từng luật tồn tại: `rule_evidence_cases.md#case-gate-audit-2026-07-27`.

## Tầng 1 — TỰ ĐỘNG, chạy mọi lượt (wire trong `.claude/settings.json`)

| Gate | Chặn được | KHÔNG chặn |
|---|---|---|
| `precode_gate.sh` (**PreToolUse** — chặn TRƯỚC khi code) | sửa file `.kt/.java` mà phiên chưa hề **`Read`** nó và tên chưa xuất hiện trong tool output nào = sửa mù, `W0` ô 2 | không kiểm được `W0` ô 3/ô 4 — `Read` một lần là đủ để nó cho đi; file mới không bị chặn; **chỉ chặn được mỗi file MỘT lần/phiên** (thông điệp chặn của nó lọt vào transcript rồi tự tính là "đã xem" — residual #1); **hook vừa wire có độ trễ trước khi live** (`W6`) |
| `claim_check.sh` (Stop) | `file.kt:NN` chưa có nguồn hoặc **số dòng ngoài range**; past-action 5 động từ, kể cả khi câu có từ phủ định đứng SAU claim | claim hệ quả, negative claim, hedge, **comment/KDoc**; và **số dòng sai nhưng NẰM TRONG range vẫn lọt** |
| `review_gate.sh` (Stop) | .kt/.java sửa trong phiên chưa qua reviewer context-sạch — tuyến cuối | chỉ chặn ở cuối lượt; tự thả sau 3 lần nhắc |
| `comment_claim_guard.sh` (PostToolUse) | 3 họ claim trong comment/KDoc **vừa ghi**: line-ref, "đã test/covered by", negative "không dùng/never called" | không phán được claim ĐÚNG hay SAI — claim đúng cũng kêu, trả lời bằng cách cite evidence |
| `testsourceset_gate.sh` (Stop) | `compileDebugUnitTestKotlin` của mọi module đã sửa — bắt đúng ca "đổi signature, build xanh, `src/test` vỡ" (`check 1`) | chỉ compile; không chạy test |
| `test_evidence_gate.sh` (Stop) — glob + parser mở rộng 2026-08-07 | 4 thứ: **(a)** claim "test pass" mà `TEST-*.xml` không chống lưng — thiếu XML / XML cũ hơn edit cuối / `tests=0` / `failures\|errors>0` / `skipped` không nêu (`check 2`); **(b)** cùng testcase đỏ qua 2 lần chạy = 2 fix hỏng cùng root cause (`6.4`); **(c)** test mình viết trong phiên mà **chưa từng quan sát thấy ĐỎ**, hoặc lần đỏ có trước lần sửa test cuối (**RED-check** + điều khoản hết hiệu lực); **(d)** từng claim outcome "đã fix/hết bug" thiếu kết quả `multi-lens-audit` tương quan từ đúng Workflow/Skill, không lỗi, là tool result cuối, bind exact fixed key + scope/current/content (`check 7`) | không host-attest receipt test/runtime/command bên trong workflow; classifier từ vựng chỉ best-effort, không hiểu mọi paraphrase và việc không chặn không phải evidence; không biết mutant có đúng phần load-bearing hay execution có thật sự chạm boundary sản xuất — `/fix` vẫn phải tự chạy paired oracle bằng tool call thật |
| ⚠️ `testsourceset_gate.sh` — **ca thứ 3, lớp lỗi KHÁC** (2026-07-28) | Tố `:core:data` 15 lỗi `Cannot access '<X>' which is a supertype of '<Y>' — check your module classpath`, trỏ vào file **`src/main`** chứ không phải `src/test`. Chạy lại `:core:common:compileDebugUnitTestKotlin :core:data:compileDebugUnitTestKotlin` @ HEAD `79f27a7fc` → `BUILD SUCCESSFUL` exit `0`; cùng phiên `:core:data` đã xanh 157 test với `--rerun-tasks` | **Heuristic nhanh:** lỗi trỏ `src/main` trong khi gate nói "call site `src/test` vỡ do đổi signature" → gần như chắc là ảnh chụp giữa chừng lúc phiên khác đang build, KHÔNG phải lỗi thật. Luôn compile lại trước khi sửa |
| ⚠️ `testsourceset_gate.sh` — **cùng lớp giới hạn attribution** (đo 2026-07-28, ca thứ 2) | Báo `core/ui/.../FileListItemContentTest.kt` unresolved `FILE_ITEM_TITLE_MAX_LINES`/`FILE_ITEM_TITLE_OVERFLOW`. Thực tế: file đó **untracked**, do phiên song song đang viết; hai hằng số CÓ trong `FileListItemContent.kt` (dòng 50 và 51) cùng module cùng package. Chạy lại `:core:ui:compileDebugUnitTestKotlin` → `BUILD SUCCESSFUL`, exit `0`. Gate bắt được một trạng thái nửa vời của cây (test đã ghi, main chưa kịp / đang sửa) rồi quy cho phiên hiện tại | **Đừng sửa call site theo lời gate trước khi tự compile lại.** Ở đây sửa mù sẽ là sửa file của phiên khác đang viết dở. Quy trình đúng: `git status` xem file có phải của mình không → compile lại module đó → chỉ hành động khi lỗi TÁI HIỆN. Không phân biệt được "artifact cũ" với "phiên kia vừa vá ở giữa" — nhưng cách xử lý giống nhau |
| ✅ `test_evidence_gate.sh` — **đã MÙ với instrumented test cho tới 2026-08-07** (đã sửa) | Hai lỗ độc lập, phải sửa CẢ HAI mới có hiệu lực: **(1) glob** chỉ có `*/build/test-results/*/TEST-*.xml`, trong khi `connectedAndroidTest` ghi vào `build/outputs/androidTest-results/connected/<variant>/`; **(2) parser** loại thẳng file có root `<testsuites>` (`if root.tag != "testsuite": return None`) — đúng format AGP dùng cho instrumented. Hệ quả: MỌI claim dựa trên device run bị chặn với thông báo sai nguyên nhân ("XML cũ hơn lần sửa code cuối"), tức là gate đẩy người đọc đi sửa nhầm chỗ. Ca đo: run xanh thật `tests="1" failures="0"` ở `app/build/outputs/androidTest-results/connected/release/` vẫn bị `exit=2` | Sửa xong chỉ glob thì gate NHẶT được file (279→284 XML) nhưng vẫn chặn — parser vẫn vứt. Bài học: đếm số file tăng lên KHÔNG phải bằng chứng gate đã hoạt động; phải chạy gate với input thật và xem exit code. 4 case harness (`h40`-`h43`) canh cả hai nhánh; 2 trong đó dùng fixture root `<testsuites>` vì fixture `mk_xml` cũ (root `<testsuite>`) không thể bắt được lỗ (2) |
| ⚠️ `test_evidence_gate.sh` — **giới hạn attribution khi có phiên chạy SONG SONG** (đo 2026-07-28) | Nhánh (b) quét `TEST-*.xml` **TOÀN REPO** (`*/build/test-results/*/TEST-*.xml`, dòng 134-136), KHÔNG giới hạn ở test mà PHIÊN NÀY chạy. Nếu một phiên/agent khác chạy test trong cùng working tree, kết quả đỏ của nó bị quy cho phiên hiện tại. Ca đo: phiên chỉ chạy `:core:data --tests '*PdfSplitServiceOutputNameTest*'` (6/6 xanh) nhưng gate báo anti-loop trên 8 `LocaleScreenshot*Test` — vốn là mục **D12 roborazzi** đang mở, do phiên khác sinh ra. | **KHÔNG nới gate và KHÔNG re-record baseline để cho xanh.** Cách xử đúng: đối chiếu testcase bị nêu với backlog (`qa_release_open_items.md`); nếu nó là mục owner-gated đã biết → escalate, không fix. Chỉ coi là "2 fix hỏng cùng root cause" khi phiên này THỰC SỰ có sửa code liên quan testcase đó |
| `security_gate.sh` (Stop) — từ 2026-07-28 | `check 4c`: phiên có sửa file chạm attack surface mà **chưa chạy `/scan`/`security-checklist`/security agent SAU lần sửa đó**. Trigger theo path (`AndroidManifest.xml`, `network_security_config*.xml`, `*.keystore/.jks`, `google-services.json`, thư mục `security/`·`auth/`) và theo **text vừa ghi** (uses-permission, `android:exported`/`intent-filter`, WebView surface, cleartext/TLS-trust, signing/keystore, credential/token, `logEvent(`/`setUserProperty(`/`recordException(`) | không biết review có TỐT hay đúng scope không — chỉ biết *có thứ gì đó đã chạy*; cố ý KHÔNG lấy `getIntent()`/`openInputStream` làm trigger (trong app đọc file thì gần như diff nào cũng có → gate sẽ bị tắt); tự thả sau 3 lần nhắc. **Loại trừ có chủ đích:** `.claude/**` (rule/hook/harness mô tả chính các pattern này), `*.md`/`*.txt`, `plans/`, `/src/test/` |
| `churn_guard.sh` (PostToolUse Edit/Write) | sửa cùng file lần thứ 3 liên tiếp mà không có tool call sinh evidence xen giữa (`6.4b`) | chỉ cảnh báo — edit đã xảy ra rồi; không đếm được "fix hỏng cùng root cause" của `6.4` |
| `block-dangerous-git.sh` (PreToolUse Bash) | lệnh git khó revert; quoted text coi là **dữ liệu** trừ khi có thứ chạy được nó (`bash/sh/zsh/ssh/eval/xargs/env`, `-c`, backtick, `$( )`) → khi đó quét nguyên lệnh (fail-closed) | không parse shell thật; lệnh vừa có executor vừa có phrase trong prose vẫn bị chặn — đúng thiết kế |

## Tầng 2 — CHỈ chạy khi được GỌI

Không tự kích hoạt; `settings.json` không tham chiếu chúng.

| Control | Làm gì | Điều kiện |
|---|---|---|
| Workflow `multi-lens-audit` | 11 lens, machine oracle, ghép RED/GREEN theo exact fixed key, mốc RED theo edit implementation; source set khớp riêng từng acceptance và mọi test-support đã đổi phải được exact POST receipt bind postimage rồi có consumer đúng vai trò: regression proof RED→GREEN, final gate PASS characterization, hoặc `disproved` receipt của ledger `rejected` (declaration/pre/failing/unpaired POST sink bị chặn, deletion dùng tombstone); canonical scoped states phủ exact manifest path-set, tự derive `scopeContentId`, post bind đúng `currentId`; horizon sweep chỉ là checkpoint tiếp tục; verdict fail-closed; `review_gate` công nhận nó là review hợp lệ | Phải tự gọi. Theo `whenToUse` của chính nó: **không attest được host command/file/device ngoài artifact driver** — terminal CLEAN vẫn là quyết định ngoài workflow. ⛔ **KNOWN BROKEN (đo 2026-08-05, 3 lần launch, `agent_count=0` cả ba)**: quan sát trực tiếp theo thứ tự — lần 1-2 throw `process is not defined` từ module scope; sau khi gỡ `process`, lần 3 throw `TextEncoder is not defined` từ `parseArgs`. Sandbox không cung cấp `TextEncoder`/`TextDecoder`, mà script dùng chúng ở **6 call site** (gồm `sha256Text`, không phải `sha256Bytes`) ⇒ **throw ngay lúc launch, 0 agent, 0 finding**. `process` đã gỡ; codec thì chưa. Hệ quả nguy hiểm: `review_gate.sh:67` (`REVIEW_WORKFLOWS`) và `:176` vẫn **công nhận việc GỌI nó là đã review**, nên một lần gọi thất bại vừa thoả mandate vừa trả về 0 finding — đọc y hệt "audit sạch". Cho tới khi codec được thay bằng UTF-8 thuần JS, **coi tầng này là KHÔNG phủ** và dùng `officereader-code-reviewer` (tuỳ change: thêm `test-architect-seti` / `android-principal-architect`). Test đi kèm không bắt được lỗi này vì nó chạy dưới Node — harness từng tiêm cả `process` vào, xem `multi-lens-audit.test.mjs` |
| `fix-evidence-driver.mjs` | Ràng buộc edit → patch → digest, chặn drift ngoài scope; phân loại test-support gồm test resource/fixture/harness/probe, `core/testing/**` và corpus `app/tester/files/**`, không chỉ Kotlin/Java trong `src/test`; cửa sổ `begin-oracle`/`finish-oracle` bind content cùng observation token metadata ở hai đầu nên bắt được thay đổi-rồi-khôi-phục thông thường | Chạy qua `/fix`; vẫn là endpoint sampling optimistic, không chống writer độc hại khôi phục cả bytes lẫn metadata |

## Lịch sử wiring

**`review_timing_guard.sh` đã GỠ khỏi wiring 2026-07-27** — nó mâu thuẫn với `churn_guard`: chèn
evidence giữa các edit thì cái này im cái kia kêu và ngược lại, không nhịp sửa nào thoả cả hai
(đo bằng log đối chiếu 1-1). File vẫn nằm trên disk nhưng không chạy. Tuyến "review sau fix #1" nay
**hoàn toàn do mình tự giữ** theo `W3`.

**~32 residual đã biết của tầng hook** (gate im lặng, false negative, chi phí):
`hook_layer_residual_2026-07-27.md`.

## Harness

`bash .claude/hooks/tests/hook_contract_test.sh` — 145 contract point (đo 2026-07-29), sandbox tạm, không đụng
`.claude/audit-gate` thật, không gradle/device. Kỳ vọng lấy từ **header contract của từng hook**, nên
case đỏ nghĩa là hook và contract của nó đang mâu thuẫn: sửa một trong hai, **cấm nới case cho xanh**
(`W4`).

Giới hạn đã biết:
- Không chạy nhánh compile thật của `testsourceset_gate` (nó gọi `./gradlew`).
- Chỉ có răng ở nhánh có case. Mutation 2026-07-28: harness xanh **28/28 mà vẫn mù 2 nhánh**
  (`failures>0`, `tests==0`) — đúng 2 nhánh đã chặn thật hôm đó. Thêm nhánh mới vào hook thì **phải**
  thêm case, nếu không mutant sống sót mà harness vẫn xanh.
- RED-check hook phải làm trên **bản copy trong thư mục tạm** (hoặc `git show HEAD:<path>`), không
  mutate cây thật: `.claude/memory/redcheck-in-worktree-not-shared-tree.md`.

---

## Giới hạn đo 2026-08-01 — gate người không gác được trạng thái repo

Hook auto-commit **commit VÀ push cả working tree** lên `origin/trunk` mà không ai bấm (`76aef307d`,
`6cf71cbae`; lần sau nuốt luôn việc đang dở của một phiên song song). Nghĩa là tuân thủ tuyệt đối
"không tự commit/push" vẫn **không** ngăn được diff lên remote trước khi User kịp nhìn — Gate 1/Gate 2
gác *hành động của agent*, không gác *trạng thái repo*.

Hệ quả thực hành: mutation in-tree có rủi ro mutant bị quét vào commit. Khôi phục trong **cùng một
lượt** tool call và verify `git diff --stat` rỗng ngay sau đó; an toàn hơn thì mutate ngoài cây.

Chi tiết + các fact về D5/step1 identity gate: `pdf_save_routing_and_gates.md`.
