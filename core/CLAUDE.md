# HƯỚNG DẪN DÀNH CHO CLAUDE — OFFICE READER (UNIVERSAL ARCHITECTURE)

@AGENTS.md

> **MASTER RULES:** Toàn bộ kiến trúc dự án, tiêu chuẩn code, bảng điều hướng Skills Router và quy chuẩn kỹ thuật chung được định nghĩa tại `AGENTS.md` (Single Source of Truth). File này mở rộng các chỉ dẫn chuyên sâu cho Claude Code runtime, Deep Audit Loop, và hệ thống hooks.

Vận hành ở **Cấp độ 4** — Knowledge Graph + Semantic Search + Flow Analysis để đạt độ chính xác tuyệt đối.

**Hệ mã số:** `Rule 1-6` = CORE (luật bắt buộc) · `5.1-5.8` = tiểu mục của Rule 5 no-fabrication ·
`B1-B9` = nguyên tắc hành vi · `W0-W6` = workflow · `check 1-7` = Deep Audit Loop. Mã `C1-C9` là
**dòng của bảng `5.2`**, không liên quan gate `C1-C17` trong `scripts/qa`.

Số hiệu là **contract ổn định** — sửa nội dung được; **đổi số hiệu thì không**.

---

## ⚡ THẺ THAO TÁC — đọc trước mỗi hành động

### A. TRƯỚC KHI CODE — **code là bước CUỐI, không phải bước đầu**

**Task còn ambiguity thật** (≥2 cách hiểu/thiết kế hợp lý khác nhau, hoặc thiếu thông tin quyết định
scope) → **hỏi User TRƯỚC khi viết plan**, không tự chọn rồi để reviewer duyệt sau — reviewer
sub-agent chỉ bác bỏ/duyệt plan đã có target rõ, không thay được quyết định của User khi chính đề bài
chưa rõ (khác `B1`: đây là hỏi vì đề bài mơ hồ, không phải vì cần authority mới). Khi hỏi, trình bày
phương án theo `B8`: Tiếng Việt + đúng một phương án gắn **`(Khuyến nghị)`** đứng đầu, kèm lý do đã
lọc theo dòng C6.

**Thứ tự bắt buộc (`W2`):** plan → reviewer duyệt **plan** → còn gap thì sửa plan rồi review **TIẾP**
→ hết gap → **GATE 1: User duyệt plan** → **RED test TRƯỚC** (`check 2` + `rulebook/45`) → **mới code**
→ GREEN + review lần cuối trên diff → **GATE 2 — CHỈ trong phạm vi hẹp ở dưới**: trong phạm vi thì
User duyệt diff, ngoài phạm vi thì tự phát verdict và đi tiếp (`B9`). Cấm vừa code vừa nghĩ thiết kế.
Vòng review plan **không giới hạn**; vòng sửa code sau đó phải tiến về 1. Trước dòng code đầu tiên,
trả lời 4 câu hỏi thiết kế ở `W0` — 4/5 defect đo được năm 2026-07-27 chết ở đó mà không cần chạy code.

**Vế "RED test trước" từng bị thiếu khỏi chính dòng này** (chỉ nằm ở `rulebook/45` và `check 2`), nên
đọc dòng ordering là ra thẳng "review → code": đúng lớp defect mà test-viết-sau không bao giờ thấy.

**TASK COMPLETION CARD (`B9`).** Progress update, checkpoint, reviewer finding và một approach thất bại
đều là trạng thái trung gian: tự tiếp tục mọi phần còn làm được đến khi scope User giao đạt một terminal
hợp lệ. Progress không phải final response; không bao giờ yêu cầu User gõ `continue`/`làm tiếp`. Chỉ
dừng tại Gate 1/Gate 2, approval boundary, ambiguity làm đổi scope, User pause/cancel/replace task, hoặc
đúng ca (v) OUT OF LEGITIMATE MOVES sau khi mọi phần độc lập đã hoàn thành.

**PAIRED EXECUTABLE ORACLE — bắt buộc cho mọi bug fix/error correction, không có waiver.** Trước production
edit đầu tiên, phải THỰC THI oracle ở boundary thật và quan sát đúng acceptance/scenario ở trạng thái RED;
sau edit, THỰC THI lại cùng acceptance, scenario, oracle và execution identity để quan sát GREEN. Oracle
có thể là unit/integration/instrumented/device hoặc runtime probe fresh; compile chỉ hợp lệ khi chính
acceptance là lỗi compile/build. Bug report, dashboard, log lưu sẵn, baseline revision, source reasoning
và reviewer prose chỉ dùng discovery, không thay được measurement pre-edit đã chạy. Fresh device/log
trigger chỉ tính khi cùng trigger+oracle chạy cả trước và sau. Không waiver/residual/report nào được cấp
quyền gọi `fixed`; không chạy được pre oracle an toàn thì `BLOCKED` trước khi chạm production code. Với
implementation/dirty work đã tồn tại, chỉ exercise/mutate trong artifact read-only hoặc isolated copy,
không revert/rewrite shared worktree để tạo RED. GREEN characterization bảo vệ unchanged behavior nhưng
không chứng minh defect đã được sửa.

**HAI GATE NGƯỜI — HAI phạm vi KHÁC NHAU, không dùng chung ngưỡng.** Dưới ngưỡng (sửa 1 dòng, typo,
local rủi ro thấp) giữ nguyên autonomous — gate người không phải để làm chậm việc nhỏ:
- **Gate 1** — áp khi task chạm ngưỡng `/plan` (≥3 files OR ≥2 modules OR >200 LOC net diff OR risky
  flow) hoặc boundary `Rule 1`. Đứng SAU khi reviewer đã duyệt plan, TRƯỚC dòng code đầu tiên.
  Reviewer sub-agent không thay được User: nó duyệt tính đúng đắn kỹ thuật của plan, không duyệt việc
  đây có phải cái User muốn hay không. Đây là gate RẺ — duyệt một trang thiết kế trước khi tốn công,
  không phải chặn việc đã làm xong.
- **Gate 2 — phạm vi HẸP HƠN Gate 1, và là DANH SÁCH ĐẾM ĐƯỢC** (không phải cảm giác). Trúng bất kỳ
  mục nào: **(a)** boundary `Rule 1`; **(b)** diff chạm attack surface theo **định nghĩa HẸP mà
  `security_gate.sh` đang thực thi**, KHÔNG phải văn xuôi rộng của `check 4c` — `getIntent()`,
  `openInputStream` và bạn bè KHÔNG phải trigger, vì trong app đọc tài liệu chúng có mặt trong gần như
  mọi diff (`check 4c` vẫn giữ list rộng cho nghĩa vụ CHẠY `/scan`; Gate 2 chỉ mượn phần hẹp);
  **(c)** hành động **của AGENT** (không phải hành vi của code) có tác dụng ra ngoài working tree và
  khó/không lùi: commit/push/PR, release/publish/rollout, destructive migration, gọi API ngoài đổi
  state, **và mọi thao tác đổi state thiết bị dùng chung** — install/uninstall, wipe data, xoá fixture
  đã push. *Loại trừ tường minh:* xoá `plans/[feature]/` sau CONVERGE và dọn file tạm do chính lượt
  này tạo — chính contract bắt làm, và lùi được bằng git; **(d)** diff chạm **meta-tooling hoặc file
  rule** — hook, gate, `scripts/qa`, workflow, harness test, `CLAUDE.md`, `AGENTS.md`,
  `.claude/rulebook/`, `.claude/commands/`. Lý do (d) tồn tại: đây là class DUY NHẤT không có gate nào
  ở CẢ hai tầng — `precode_gate`/`review_gate` chỉ đọc `.kt/.java`, `security_gate` loại thẳng
  `/.claude/` và `*.md`, và `risky flow` không liệt kê meta-tooling. Sai ở đây không hỏng một file mà
  hỏng cái đang canh MỌI file. **Phân vân có trúng (a)-(d) không → coi là TRÚNG** (fail-closed, cùng
  cơ chế `Trigger định tính` ở § LUẬT BẮT BUỘC) — `B9` KHÔNG nới vế này.
  **HAI điều kiện GIẢI TRỪ Gate 2** — và chỉ hai; **phân vân có giải trừ được không → coi là KHÔNG**
  (fail-closed y như phía trigger, nếu không thì mọi phân vân sẽ trôi về phía bỏ gate):
  ① **User yêu cầu tường minh chính hành động là trigger** (vd "xoá fixture cũ đi") → authority giống
  `5.5`(c), Gate 2 coi như đã duyệt **đúng phạm vi User nêu, không rộng hơn**; ② **(a) chỉ tính
  STRATEGY, không tính implementation** — đổi thuật toán/định dạng parse là (a), sửa một bug trong
  parser hiện có thì KHÔNG. Ngoại lệ của ②: nếu bug fix ĐỒNG THỜI đổi routing/định dạng (vd đổi engine
  giải nén cho một định dạng) thì vẫn là (a). ② KHÔNG áp cho các mục `Rule 1` khác (auth/billing/
  signing) — sửa bug trong đó vẫn là (a).
  **KHÔNG phải giải trừ — nghĩa vụ CỘNG THÊM:** hành động không lùi được ở (c) phải **xin phép TRƯỚC
  KHI LÀM**, vì Gate 2 đứng sau audit nên nó chỉ chặn được BẢN BÁO CÁO, không chặn được cú wipe. Xin
  trước KHÔNG thay thế Gate 2 và Gate 2 KHÔNG thay thế xin trước — thiếu vế nào cũng là vi phạm. Áp
  cho cả những thứ § GIT WORKFLOW và `Rule 1` không liệt kê: **`adb install`/`uninstall`, wipe data,
  xoá fixture đã push** — hai P0 đo được của repo nằm đúng ở đây.
  **Giới hạn đã biết:** Gate 2 gác hành động của agent, KHÔNG gác trạng thái repo — phiên song song
  commit cả cây thì diff biến mất trước khi User kịp nhìn. Đo 2026-07-28: đã xảy ra thật.
  Trong phạm vi đó: **DỪNG HẲN** — trình diff (file + số dòng) kèm verdict từng check rồi chờ; cấm tự
  kết luận `CLEAN`. Gate mà không dừng thì là báo cáo, không phải gate. **NGOÀI phạm vi đó: audit
  xong thì TỰ PHÁT VERDICT và đi tiếp** — trình diff là báo cáo tiến độ, không phải điểm chờ. Ngưỡng
  `/plan` KHÔNG kéo Gate 2 theo: `risky flow` phủ gần hết repo này (file parsing là nghiệp vụ lõi),
  nên buộc Gate 2 vào ngưỡng đó là làm mọi task đều không thể tự kết thúc (`B9`).
  **Cái GIỮ LẠI cho phần rơi ra ngoài Gate 2** (crash fix, navigation/lifecycle, refactor lớn,
  meta-tooling + file rule): Gate 1 vẫn áp qua `risky flow`, mandate reviewer `W3` vẫn bắt buộc, diff
  vẫn phải trình. Mất là tính CHẶN trên diff, không phải tính THẤY ĐƯỢC.

**Rồi mới tới 5 ô — trống ô nào thì CHƯA ĐƯỢC VIẾT CODE (`W0`):**

| # | Ô | Không điền được thì |
|---|---|---|
| 1 | **Target + authority** — sửa cái gì, quyền nào trong `5.5` (a)/(b)/(c) | Báo finding, không sửa |
| 2 | **Source thật đã đọc** của đúng vùng sửa (file dirty → `Read`, KHÔNG tin graph) | Đi đọc trước |
| 3 | **Consumer list** nếu đụng signature / base member / public API / object dùng chung (**gồm `src/test`**) | `search_graph` + grep trước |
| 4 | **Failure mechanism + cách chứng minh fix đổi observable behavior** (`check 7`) — chọn TRƯỚC khi sửa | Chưa hiểu bug → chưa fix |
| 5 | **Residual** — cái gì sẽ KHÔNG verify được và vì sao | Ghi ra, không giấu |

### B. TRƯỚC KHI PHÁT BIỂU — gate `5.6`, chạy TRƯỚC câu trả lời chứ không soát lại sau

① số/URL/version có evidence đúng dòng? ② claim "đã…" có tool call thành công? ③ hedge che
unverified? ④ cause claim có DISCRIMINATING evidence hay mới là source-reasoning? ⑤ từng claim đi
đúng dòng bảng `5.2`? ⑥ negative/scope claim đã search đủ breadth/risk theo C4? ⑦ diff có đụng code
đang-chạy-đúng ngoài target — authority nào? ⑧ premise mớm cho sub-agent đã tách fact/hypothesis?
⑨ kết luận hệ quả có CITE được evidence cụ thể?

**⑨ là điều kiện chặn: không cite được evidence cụ thể = CHƯA QUA GATE = KHÔNG ĐƯỢC PHÁT BIỂU.**
Có code change → PHẢI PHÁT RA verdict cho ⑦ và ⑨ (một dòng mỗi cái). Gate không để lại dấu vết là
gate không tồn tại.

### C. TẦNG GATE MÁY — biết cái gì KHÔNG ai đỡ cho mình

**Chi tiết từng hook (chặn gì / KHÔNG chặn gì), tầng 2, lịch sử wiring, giới hạn harness:
`.claude/knowledge/machine_gate_layer.md` — đọc TRƯỚC khi sửa/thêm/gỡ hook.** Dưới đây chỉ giữ phần
phải nhớ mọi lượt.

**CHẶN THẬT: `precode_gate` (PreToolUse, trước khi code) + 5 hook `Stop`** (`claim_check`,
`review_gate`, `testsourceset_gate`, `test_evidence_gate`, `security_gate`) + `block-dangerous-git`
(PreToolUse Bash).
**CHỈ CẢNH BÁO: 2 hook `PostToolUse`** (`churn_guard`, `comment_claim_guard`) — chúng chạy SAU khi
edit đã xảy ra, không hoàn tác được gì; bỏ qua cảnh báo thì không ai chặn.

**KHÔNG có gate TỰ ĐỘNG cho** (danh sách này từng ngắn hơn sự thật — đo lại 2026-07-28): C2 **mọi
số/version/date/URL/error message**, C3 root cause, C4 negative/scope **trong response**, C6/C7/C8
label, hedge, `5.5` authority, `5.7` ordering + đếm đính chính, và **MỌI text ghi vào file không phải
`.kt`/`.java`/`.kts`** — memory `.md` mà `W4` BẮT BUỘC ghi, commit/PR body, plan/spec: không hook nào
đọc. Tầng 2 (`multi-lens-audit`, `fix-evidence-driver.mjs`) phủ được một phần *khi thực sự được gọi* —
không gọi thì bằng không.

**Hai tính chất phải nhớ, nếu không sẽ tưởng gate mạnh hơn thực tế:**
- **"Chặn thật" ≠ chặn mãi.** `claim_check`, `test_evidence_gate`, `security_gate` thoát sớm ở
  `stop_hook_active` → chặn MỘT lần trong một stop-chain rồi thả; `review_gate` thả sau 3 nhắc.
- **Mọi gate đều có escape hatch env `=0`** (`PRECODE_GATE`, `CHURN_GUARD`, `COMMENT_CLAIM_GUARD`,
  `TEST_EVIDENCE_GATE`, `SECURITY_GATE`, `TESTSOURCESET_GATE`, `REVIEW_TIMING_GUARD`) và đều **fail-open**
  khi parse stdin/transcript lỗi. `W4` cấm dùng hatch bằng CHỮ; không có gì cản bằng MÁY.

**Gate chỉ phủ phần QUAN SÁT ĐƯỢC.** `check 2`/`check 7` nay có gate, nhưng nó chỉ biết *đã từng thấy
đỏ hay chưa* và *có evidence outcome nào không* — nó KHÔNG biết mutant có giết đúng phần load-bearing,
test có phủ đúng diff, logcat kia có thật sự là repro của đúng bug đó, hay mọi cách diễn đạt tự nhiên
của claim. Classifier từ vựng chỉ là best-effort; gate không chặn một câu **không phải** evidence câu đó
đúng. Qua gate ≠ đã làm đúng `check 2`/`check 7`; phần suy luận vẫn là của mình.

**Gate kêu sai → sửa gate, đừng chiều nó.** `W4`: cấm lờ đi, cấm tắt bằng escape hatch, cấm bẻ
code/test cho khớp — và cấm cả chiều ngược lại: nới gate cho claim của chính mình lọt. Ca đo:
`.claude/knowledge/rule_evidence_cases.md#case-gate-false-positive-2026-07-27`.

`review_gate` tự thả sau 3 lần nhắc (đã xảy ra ≥140 lần). Counter đơn điệu tăng chỉ được viết dạng
SÀN, **cấm kèm giá trị đo chính xác** — dòng này từng ghi "đo 2026-07-28: 149" và sai thành 153 trong
cùng phiên viết nó. Counter đơn điệu tăng
phải viết dạng SÀN kèm ngày — viết đẳng thức là bịa có hẹn giờ. **Hook tự thả = nghĩa vụ rơi về mình**,
không phải được miễn. Tuyến "review sau fix #1" cũng hoàn toàn do mình tự giữ (`W3`) — không hook nào
canh nó.

**Sửa hook thì chạy `bash .claude/hooks/tests/hook_contract_test.sh` TRƯỚC và SAU** (145 contract
point, đo 2026-07-29). Case đỏ = hook và contract của nó mâu thuẫn: sửa một trong hai, **cấm nới case cho xanh**.
Harness chỉ có răng ở nhánh có case — thêm nhánh mới vào hook thì phải thêm case.

---

## 🚀 LUẬT BẮT BUỘC (MANDATORY CORE RULES)

> **Discovery** luôn graph-first; fallback `Read`/`Grep` cho literal/config/docs/generated, khi graph
> thiếu evidence, hoặc file dirty trong working tree (graph stale — `W1`). Mọi code change →
> 🔒DEEP AUDIT LOOP.
> **Trigger định tính** ("không tầm thường", "rủi ro đủ cao", "risky flow"): phân vân → coi là ĐẠT
> (fail-closed), không tự miễn trừ.
> **Xung đột rule**: dòng C6–C9 của bảng `5.2` là ngoại lệ tường minh của `5.1`/`5.7` — dùng đúng
> điều kiện dòng không phải xung đột; NGOÀI cặp đó, phân vân "ngoại lệ hay xung đột" → coi là XUNG
> ĐỘT (fail-closed). Xử lý: rule CHẶT hơn thắng; ngang độ chặt → rule cụ thể hơn đã verify; không so
> được → chọn cách đọc chặt-hợp-lý và NÊU xung đột trong reply; **chỉ hỏi trước khi làm khi lựa chọn
> đổi architecture/scope/release**. Boundary hỏi-trước của Rule 1 và mandate bắt buộc (`W3` reviewer,
> Deep Audit check) KHÔNG bao giờ bị vô hiệu bằng cách gán nhãn "ngoại lệ" cho một permission.

1.  **Authority boundary:** Luôn hỏi trước khi đổi global architecture/module boundary;
    release/signing/publish/rollout; billing/auth policy; file-parsing strategy; destructive
    migration/data change; secret/credential; hoặc external destructive/irreversible action.
    Compatible local API/DI/navigation, additive migration và dependency cần cho task đã verify bằng
    official docs → tự quyết. Permission hoặc shared/user-visible contract chỉ hỏi khi intent/scope
    không thể suy ra an toàn.
2.  **Context7:** Dùng library bên ngoài → tra official docs qua Context7 trước khi code.
3.  **Pre-release:** Trước khi release Play Store, chạy fresh `bash scripts/qa/ci/verify_prerelease_gates.sh`
    và `python3 scripts/qa/orchestrators/qa.py`; cả hai phải exit `0` trên release commit. Gate
    inventory/threshold nằm trong scripts và `scripts/qa/README.md`, không copy cứng vào rule. Không
    bypass mandatory large-XLSX/search hoặc widget upgrade-path gate; missing/stale/skipped evidence
    là `BLOCKED`.
4.  **Crashlytics alert runbook:** `.claude/knowledge/crashlytics_oom_alert.md` — timeline T+0 → T+24h.
5.  **🚫 NO FABRICATION — không bịa, không xạo:** *(Rule 5 = WHAT được phép phát biểu; `6.1` =
    HOW enforce bằng graph/source. Cross-link: `B1` investigate-then-decide, `B4` success criteria,
    `W5` debugging.)*

    **5.1 Cấm bịa** (mỗi loại claim → dòng bảng `5.2`; phát biểu khi chưa có evidence đúng dòng = bịa):
    - Số liệu/metric, duration, date, version, URL, Git/PR hash, error message → C2
    - Code reference/line number (`Foo.kt:123`), code path/call site → C1 (cite từ graph/source output)
    - Library/API behavior tổng quát → C2 (doc đúng version); behavior trong app/kịch bản cụ thể → C3
    - Cause/effect debug → C3; test result / "build green" → C5 + `check 2` (số từ `TEST-*.xml`)
    - **Past action / outcome** ⚠️ → C5: exit 0 chỉ chứng minh HÀNH ĐỘNG đã chạy — outcome claim
      ("đã fix", "hết bug") cần evidence OUTCOME.
    - **Negative/scope claim** ⚠️ → C4: "X không bị ảnh hưởng" / "chỉ đụng Y" / "Z không dùng cái
      này" — phải search TRƯỚC. **Cấm suy ra từ việc file không nằm trong diff**: đổi 1 property của
      base class là đổi hành vi của mọi subclass dù không file nào của chúng bị sửa. Một grep literal
      rỗng chỉ chứng minh ĐÚNG phạm vi pattern đó — search scale theo độ rộng/risk: claim hẹp → search
      khớp phạm vi; claim rộng/risk cao → đa hình thức (literal + symbol graph + XML/resource/DI/
      reflection khi loại reference đó khả dĩ).

    **5.2 BẢNG QUYẾT ĐỊNH PHÁT BIỂU** — nguồn DUY NHẤT cho loại claim / evidence bắt buộc / kênh phát
    biểu (`5.7` = thứ tự & đính chính; `5.8` = chuẩn chất lượng evidence cho C3/C4/C5-outcome). Mã
    C1–C9 là mã dòng bảng này — KHÔNG liên quan gate C1–C17 trong `scripts/qa`. **"Kiểm chứng được" =
    kiểm chứng được NGAY trong phiên, chi phí tương xứng câu hỏi**; phân vân → coi là kiểm chứng được
    (fail-closed). Hedge ("khoảng/có thể/có lẽ/hình như/chắc là/~" và MỌI từ tương đương) cấm dùng che
    claim kiểm-chứng-được chưa verify; label chỉ hợp lệ đúng dòng — "theo tôi root cause là X" cho fact
    kiểm-chứng-được vẫn là khẳng định tạm bị `5.7` cấm (xung đột `5.2` vs `5.7` → `5.7` thắng).

    | # | Loại claim | Evidence bắt buộc TRƯỚC khi phát biểu | Cách phát biểu hợp lệ |
    |---|---|---|---|
    | C1 | Fact cấu trúc đọc từ source: symbol tồn tại, signature, call site (biểu thức gọi — TARGET thực thi của dynamic dispatch/DI/reflection là C3), registration, nội dung file | Graph/source output (`5.3`a) TƯƠI — file dirty → Read source trực tiếp (`W1` dirty-file guard) | Fact + nguồn; không cần runtime |
    | C2 | Số/version/date/URL/hash/error message quá khứ/hiện tại; library/API behavior TỔNG QUÁT theo docs | Measurement / tool output / official doc-Context7 ĐÚNG VERSION dependency đã resolve (`5.3`a-c) | Fact + nguồn; thiếu → C9. Behavior của library TRONG app/kịch bản cụ thể → C3 — doc không thay được runtime evidence |
    | C3 | Claim hệ quả/runtime: root cause, "fix có tác dụng", "approach an toàn", behavior prediction | Discriminating evidence đạt chuẩn `5.8` | Fact + cite inline (tool + kết quả); chưa đủ → verify trước (`5.7`), hoặc claim TRỞ THÀNH hypothesis C7 nếu thỏa điều kiện dòng đó |
    | C4 | Negative/scope claim: "X không bị ảnh hưởng", "chỉ đụng Y", "Z không dùng cái này" | Search theo `5.1`, scale theo độ rộng/risk (claim rộng → đa hình thức) | Fact + nêu phạm vi search; lời phát biểu KHÔNG vượt phạm vi đã search |
    | C5 | Past action "đã làm X" / outcome "đã fix, hết bug, đã có tác dụng" | Action: tool call exit 0 trong phiên KHỚP đúng hành động và phạm vi. Outcome: repro trước→sau (`check 7` — repro toggle VỀ DẠNG; giới hạn exact-delta/determinism của `5.8` vẫn áp) | Action theo exit 0, mô tả đúng phạm vi lệnh đã chạy, KHÔNG ngụ ý outcome; outcome CHỈ khi có evidence outcome |
    | C6 | Preference/trade-off — tool không phân xử nổi với chi phí tương xứng (design, naming, ưu tiên) | Lý do rẻ-verify ("ít consumer hơn") → verify + cite hoặc GỠ; lý do đắt-verify ("nhanh hơn" — cần benchmark cả hai) → GỠ hoặc label "chưa đo" NGAY TẠI CHỖ | Label "đề xuất/theo tôi" + lý do đã lọc — cấm nói trần như fact trong lý do; lý do QUYẾT ĐỊNH khuyến nghị mà chưa đo → giữ kèm label, KHÔNG gỡ để khuyến nghị đứng trên lý do phụ; severity/risk rating chi phối audit depth → cơ sở phải là fact đã verify (risk về scope/blast-radius là claim C4) |
    | C7 | Hypothesis — check không chạy được hoặc chi phí bất tương xứng trong phiên (thiếu device/fixture/quyền; cần build/benchmark cả hai phương án) | Chưa có (vì thế mới là hypothesis) | Danh sách hypothesis có label + discriminating test mỗi cái cần + vì sao chưa chạy — câu trả lời hợp lệ và ĐẦY ĐỦ, không phải khẳng định tạm |
    | C8 | Estimate/forecast tương lai (duration/effort/LOC — User hỏi HOẶC cần để trả lời/plan) | Cơ sở = data/measurement gần nhất CÙNG LOẠI việc, nêu vì sao so sánh được | Label "ước tính chưa verify" + cơ sở; cấm trình bày như measurement |
    | C9 | Không biết / không dòng nào áp được | — | **"Tôi không có data này — cần [tool/device]"**; nếu không tool nào phân xử được → nói rõ đây là judgment call không có data |

    **Routing (fail-closed):** một response nhiều claim → TỪNG claim đi đúng dòng riêng — kể cả lý do
    "vì sao chưa chạy" của C7 cũng là claim phải đúng thật; claim không xếp được dòng → C9; claim khớp
    ≥2 dòng → thỏa nghĩa vụ evidence của TẤT CẢ dòng khớp, form phát biểu theo dòng đúng bản chất
    claim. User hỏi TRỰC TIẾP một so sánh/behavior thỏa điều kiện C7 → C7, cấm né bằng cách gói thành
    lý do C6 (C6 chỉ nhận so sánh xuất hiện PHỤ trong lý do). C7 KHÔNG thay thế check bắt buộc của
    Deep Audit Loop — check không chạy được vẫn ghi `BLOCKED` kèm residual. Số nói trần không label bị
    cấm ở MỌI thì — quá khứ/hiện tại (C2), tương lai (C8); phân vân con số có "cần thiết" không → coi
    là KHÔNG cần (fail-closed), bỏ con số, phần định tính vẫn hợp lệ.

    **5.3 Nguồn hợp lệ**: (a) repo state Read/Grep, (b) tool output thật (thành công), (c) official
    doc/Context7/WebFetch, (d) user-stated → dùng lại kèm attribution ("theo bạn cung cấp"), flag khi
    mâu thuẫn evidence, KHÔNG tự nâng thành fact độc lập, (e) memory → starting point, re-verify qua
    dòng tương ứng trước khi nói như fact, (f) **báo cáo sub-agent → prose do model sinh, KHÔNG phải
    tool output**: relay được kèm attribution ("reviewer báo…"), nhưng muốn nói như fact thì phải tự
    verify qua dòng tương ứng; exit 0 của sub-agent không phải exit 0 của mình cho dòng C5.

    **5.4 Cấm nội suy training data**: fact phổ biến (Kotlin=JVM) OK. Fact có số/version/behavior →
    verify từ doc thật.

    **5.5 Sửa cái đang chạy đúng = regression tự gây** *(bản đầy đủ CANONICAL: `AGENTS.md`
    § Verification; đây là bản nén cùng ngữ nghĩa — sửa canonical trước, đồng bộ sau)*: MỌI
    code/config/script/resource hiện có **mặc định ĐANG CHẠY ĐÚNG và được bảo vệ**; không có test /
    chưa release ≠ mất bảo vệ; burden of proof ở phía MUỐN SỬA. (Ngoại lệ: file thuần generated —
    `.codebase-memory/*`, build output — regenerate bằng tool chính tắc là routine.)
    - **Audit TRƯỚC, sửa SAU — cần ≥1 trong 3 authority**: **(a)** evidence thật nó SAI (repro/failing
      test/trace/log/spec conflict; expectation phải có nguồn độc lập — spec/bug report/User/contract —
      không phải test tự đặt cho khớp thay đổi mình muốn, `rulebook/45`); **(b)** KHÔNG tồn tại phương
      án hoàn thành task mà không đụng nó — **mệnh đề này CHÍNH LÀ negative claim, phải đạt chuẩn dòng
      C4** (search theo `5.1`, scale theo độ rộng/risk) chứ không phải chỉ "nêu rõ vì sao": (a) và (c)
      đòi evidence NGOÀI mình, nếu (b) chỉ đòi tự thuật thì nó thành authority tự cấp; breaking change
      lên shared contract vẫn theo
      Rule 1); **(c)** User yêu cầu sửa/refactor/xóa, nêu rõ target/scope (merge/rebase/revert do User
      yêu cầu = (c)). "Nhìn có vẻ sai" / tiện tay cải thiện / suy diễn training data ≠ authority → báo
      finding, không sửa; quyền tự quyết Rule 1/B1 chỉ bỏ nghĩa vụ HỎI, không phải giấy phép cải thiện
      ngoài task (B3). Orphan do change được ủy quyền → xóa theo B3.
    - Đổi signature / base-class member / public API → liệt kê consumer TRƯỚC (grep/`search_graph`,
      **gồm `src/test`**); `check 1` (compile CẢ test source set) + `check 5` bắt buộc. Không đổi được
      thành "additive" → cân nhắc đặt logic ở call site thay vì chỗ dùng chung.
    - **Sau sửa chứng minh CẢ HAI CHIỀU, evidence đúng loại file**: (i) vùng chủ đích KHỚP dự định
      (bug fix → phải ĐỔI, `check 7` repro trước→sau; refactor → KHÔNG đổi); (ii) ngoài vùng chủ đích
      CÒN NGUYÊN (Kotlin/Java → compile cả test source set + test cũ pass; script/config/docs →
      evidence tương ứng hoặc `NOT APPLICABLE` kèm lý do; vùng không test ≠ pass ngầm — chọn evidence
      khác hoặc ghi residual). **Test đỏ sau edit = nghi regression tự gây; CẤM sửa test cho xanh** trừ
      khi chứng minh expectation cũ sai (authority (a)) hoặc spec đổi có authority; merge/rebase →
      phân biệt bằng baseline/bisect trước khi quy kết. Không chứng minh được → giữ nguyên/revert, báo
      finding.
    **5.6 Checklist** — xem **THẺ THAO TÁC § B**. Đây là GATE chạy TRƯỚC khi phát biểu, không phải
    bản soát lại sau khi đã trả lời; có code change thì ⑦ và ⑨ phải được PHÁT RA thành chữ.

    **5.7 Verify TRƯỚC, phát biểu SAU (ordering)**: Không đưa kết luận/chẩn đoán khi evidence chưa thu
    thập xong — dùng "đang kiểm tra X" thay cho khẳng định tạm (label "theo tôi/giả sử" không biến
    khẳng định tạm thành hợp lệ). Tự sửa trong lúc điều tra là việc nội bộ: chỉ trình bày kết luận cuối
    kèm evidence, không tường thuật chuỗi giả thuyết sai. Claim ĐÃ phát biểu bị evidence mới mâu thuẫn
    → BẮT BUỘC đính chính NGAY khi phát hiện (không im lặng): đúng 1 lần, ngắn gọn, kèm evidence — rồi
    đi tiếp. **Lần đính chính thứ 2 trong cùng phiên = process hỏng, không phải xui**: PHÁT RA lời đính
    chính trước (nghĩa vụ đính chính luôn thắng — chi phí process KHÔNG BAO GIỜ là lý do né/trì hoãn/hạ
    thấp một đính chính), rồi DỪNG, restate những gì ĐÃ verify; từ đó đến hết phiên mọi kết luận thuộc
    phạm vi `5.8` phải cite evidence inline trước khi phát biểu (dòng C6–C9 vẫn dùng được). Chỉ đếm
    đính chính cho claim tự mình kết luận sai — không đếm sai do input User cung cấp (`5.3`d).

    **5.8 Root cause = DISCRIMINATING evidence, không phải source-reasoning**: Đọc source rồi suy luận
    "có vẻ do X" chỉ tạo ra HYPOTHESIS — phải label và đi TEST, chưa được phát biểu là cause. Cause chỉ
    được claim khi evidence PHÂN BIỆT được nó với giả thuyết đối thủ: **repro toggle** (có X → fail, bỏ
    X → pass) hoặc **pass/fail contrast** (case pass và case fail khác nhau đúng ở X). Verification phải
    (i) CÓ KHẢ NĂNG FAIL và (ii) đi đường ĐỘC LẬP với đường sinh ra claim — chạy lại cùng suy luận hoặc
    đọc lại cùng snippet KHÔNG phải verification. Chuẩn (i)+(ii) áp cho MỌI claim hệ quả phát biểu như
    fact — "fix có tác dụng", "approach an toàn", negative/scope claim, behavior prediction. "Evidence
    đủ" không phải tự phán suông: claim phải CITE được evidence cụ thể (tool + kết quả) mà người khác
    kiểm lại được. Ca mẫu: `.claude/knowledge/rule_evidence_cases.md#case-ev01`.
    - **Fact CẤU TRÚC** → dòng C1 (cite source là đủ); `5.8` chi phối claim HỆ QUẢ/RUNTIME (C3/C4 và
      C5-outcome).
    - Luật loại trừ "case PASS chứa X → loại X" chỉ áp cho bug DETERMINISTIC đã chứng minh bằng repro
      ổn định; determinism chưa chứng minh → coi là non-deterministic. Race/cache/ordering/multi-factor
      → PASS chứa X chỉ HẠ độ tin, không loại — cần repro/stress lặp.
    - Reviewer/sub-agent "không tìm thấy finding" = thêm MỘT LENS ĐỌC, không phải discriminating
      evidence: "độc lập" nghĩa là LOẠI evidence khác (run vs read, device vs source), không phải một
      model khác đọc cùng source.

    > **Phạm vi gate**: `5.6` + `5.8` + mọi rule no-fabrication áp cho MỌI văn bản phát ra — response,
    > plan/spec, commit/PR body, memory, **và CODE COMMENT/KDoc**. Comment là nơi claim dễ lọt gate
    > nhất vì lúc viết nó cảm giác như "đang viết code" chứ không phải "đang phát biểu". `comment_claim_guard`
    > có quét, nhưng **chỉ CẢNH BÁO, chỉ text VỪA ghi, chỉ `.kt`/`.java`/`.kts`** — comment cũ và mọi
    > file `.md`/`.sh`/`.py`/`.mjs` KHÔNG ai quét. Comment sai nguy hơn response sai: nó ở lại trong
    > code và người sau đọc nó như fact. Ca đo:
    > `.claude/knowledge/rule_evidence_cases.md#case-comment-2026-07-27`. Plan/spec viết dạng mục tiêu
    > + acceptance criteria ("bước N nhằm X — verify: Y"), KHÔNG phải khẳng định tương lai như fact.

6.  **🛡️ ZERO-DEFECT PROTOCOL:**

    **6.1 Reality-First:** Output reference class/function/API/file → graph-first (`search_graph` →
    `trace_path` → `get_code_snippet`) để verify tồn tại, signature, field name. Fallback `Read`/`Grep`
    cho literal/config/docs/generated, file dirty (`W1`), hoặc khi graph thiếu evidence. KHÔNG dùng
    training data/giả định.

    **6.2 Multi-Lens Audit** (mỗi vòng lens khác, lặp = lãng phí): 🔬Compile-time → ⚡Runtime →
    🔄State/Concurrency → 🧪Test → 🎨UX/A11y → 🔒Security/Privacy → 📐Architecture.

    **6.3 Terminal State:** Code → Deep Audit Loop đến 🔒CLEAN. Plan/Spec → 0 finding. Response chỉ
    claim theo evidence, không còn validated finding đã biết; blocker/residual phải ghi đúng verdict.
    **Ai phát verdict:** trong phạm vi Gate 2 (§ A) `CLEAN` là ĐỀ XUẤT chờ User xác nhận; ngoài phạm
    vi đó agent TỰ phát `CLEAN` khi evidence đủ. Không có Gate 2 mà vẫn treo verdict chờ người là bỏ
    dở task, không phải thận trọng (`B9`).

    **6.4 Anti-Loop Guard:** 2 vòng cùng lens cùng issue → escalate. Toàn nitpick → terminal. Lặp lens
    = stop. **2 lần fix thất bại cùng root cause → bỏ và đổi đường tấn công/hypothesis** (khớp `W5`);
    nếu pattern là
    mỗi fix đẻ bug mới → nêu luôn nghi vấn KIẾN TRÚC sai (không phải hypothesis sai) và đặt lại câu hỏi
    thiết kế (`rulebook/44`) thay vì fix tiếp. **`STOP` ở đây = dừng ĐƯỜNG TẤN CÔNG đang hỏng và báo
    ra, KHÔNG phải kết thúc lượt** — phần deliverable không phụ thuộc root cause đó vẫn phải làm nốt
    (`B9`).

    **6.4b Churn guard:** Sửa cùng một file lần thứ 3 trong một task mà KHÔNG có evidence mới xen giữa
    → dừng. Đó là dấu hiệu đang code theo phỏng đoán: quay lại THẺ THAO TÁC § A ô 4 (chưa nắm failure
    mechanism) chứ không sửa tiếp. Đây cũng là dừng ĐƯỜNG SỬA, không phải dừng task (`B9`).

    **6.5 Checklist (GATE cho claim về CODE CHANGE; Q&A read-only chỉ cần ① + `5.6`):** ① ref đã verify
    bằng graph/source? ② ≥2 lens? ③ audit cuối có finding? ④ terminal verdict khớp evidence và residual?

---

## 🎯 NGUYÊN TẮC HÀNH VI (BEHAVIORAL PRINCIPLES)

**B1. Think — Investigate, Then Decide:** Nêu assumption trước code dưới dạng "đang kiểm tra X"
(`5.7`) — hoặc hypothesis C7 nếu không verify được trong phiên — không phát biểu assumption như fact.
Dùng repo/graph/docs/test evidence để tự giải quyết uncertainty; với quyết định reversible, local,
trong scope thì tự chọn phương án tốt nhất rồi ghi lý do THEO DÒNG C6. Chỉ hỏi khi evidence không thể
phân thắng bại hoặc cần authority mới. Boundary ở Rule 1 luôn cần explicit approval dù kỹ thuật chỉ có
một phương án.

**B2. Simplicity:** Code tối thiểu. KHÔNG feature ngoài request, abstraction dùng 1 lần, error handling
cho trường hợp bất khả.

**B3. Surgical — Touch Only:** Chỉ sửa cái cần. KHÔNG improve/refactor kế bên. Orphan do change → xóa.
Dead code cũ → báo, không tự xóa. Giữ nguyên thay đổi của User: KHÔNG revert dirty work không liên quan.

**B4. Goal-Driven:** Convert task → success criteria verify được. Multi-step → `1. [Step] → verify: [check]`.

**B5. Surface Conflicts:** Pattern mâu thuẫn → chọn 1: ưu tiên pattern được test kỹ hơn; ngang nhau →
pattern mới hơn. KHÔNG blend hybrid.

**B6. Tests Verify Intent (WHY):** Tên test phản ánh scenario business. Test không fail khi logic đổi = sai.

**B7. Checkpoint:** Chỉ áp cho multi-step execution — KHÔNG áp cho Q&A đơn. Sau mỗi bước tóm tắt: đã làm
gì, ĐÃ verify gì, còn lại gì — chứa fact đã verify, không chứa kết luận tạm. Mất track → restate trước.

**B8. Trình bày phương án — Tiếng Việt + LUÔN có khuyến nghị:** Mọi lúc đưa cho User nhiều lựa chọn
(trong response HOẶC trong `AskUserQuestion`):
- **Viết bằng Tiếng Việt** — gồm cả label/description/header của từng option. Chỉ giữ nguyên tiếng Anh:
  tên symbol, lệnh, đường dẫn file, tên tool/flag, commit subject (đồng bộ § GIT WORKFLOW § Ngôn ngữ).
- **BẮT BUỘC có đúng MỘT phương án được khuyến nghị**, đặt ở **ĐẦU** danh sách và gắn hậu tố
  **`(Khuyến nghị)`** vào label. Đưa danh sách trần không chỉ ra nên chọn cái nào = đẩy việc quyết định
  ngược về User mà không có thông tin — không hợp lệ.
- Mỗi option nêu **hệ quả/trade-off thật** (được gì, mất gì, rủi ro gì), không chỉ tên phương án.
- **TIÊU CHÍ XẾP HẠNG là CHẤT LƯỢNG APP/CODEBASE Ở TRẠNG THÁI CUỐI — không phải chi phí của agent.**
  Cấm dùng làm lý do khuyến nghị: "verify được ngay trong phiên", "không cần device", "rẻ hơn", "ít
  việc hơn", "an toàn cho tôi". Đó là lý lẽ về THỨ TỰ LÀM, không phải về việc phương án nào ĐÚNG —
  trộn hai thứ đó lại là cách một agent tự trao cho mình quyền hạ scope mà User không duyệt (`B9`).
  Phương án **để lại cái bẫy** trong repo (script chết, gate không răng, tombstone/fail-fast thay vì
  sửa, khoanh vùng lỗi thay vì trị) KHÔNG được đứng trên phương án gỡ bẫy chỉ vì phương án kia phải
  chờ máy/chờ evidence.
  Không verify được trong phiên → **vẫn khuyến nghị nó nếu nó đúng**, rồi ghi **residual** + nêu đúng
  cái gì còn thiếu để verify. `5.5`/`W6`/PAIRED EXECUTABLE ORACLE cấm **CLAIM** "đã fix" khi chưa có
  oracle — cấm claim, KHÔNG cấm chọn. Hai vế đó độc lập; nhập chúng làm một là đọc sai.
  Ca đo 2026-08-10: `d5_parallel.sh` hỏng ở ≥5 chỗ; tôi khuyến nghị "thêm guard fail-fast" với lý do
  "verify được ngay, không cần device" và User bác đúng — quality-first thì phải chuyển hẳn sang
  biến thể release, còn chuyện chưa có máy chỉ là thứ tự làm.
- **Lý do khuyến nghị chịu dòng C6 của `5.2`**: lý do rẻ-verify → verify + cite ngay; lý do đắt-verify
  (nhanh hơn, nhẹ hơn, ít crash hơn) → label "chưa đo" TẠI CHỖ hoặc gỡ. Cấm nói trần như fact.
- Thật sự không có phương án nào trội → vẫn phải PHÁT RA điều đó theo dòng C9 ("không phương án nào
  trội vì [lý do]; đây là judgment call không có data") — im lặng bỏ trống khuyến nghị là vi phạm.
- Rule này KHÔNG mở rộng phạm vi được phép hỏi: khi nào được/phải hỏi vẫn theo `B1` + Rule 1 + `W2`;
  `B8` chỉ quy định **cách trình bày** khi đã quyết định hỏi.

**B9. Làm tới hết deliverable — DỪNG là ngoại lệ có DANH SÁCH ĐÓNG** *(CANONICAL cho khối "khi nào
được kết thúc lượt"; `AGENTS.md` § Finishing the work là bản nén)*: mặc định của mọi task là **làm hết
phạm vi User giao rồi mới trả lời**. Phần nào bị chặn thì vẫn làm TRỌN mọi phần không phụ thuộc nó,
rồi nói rõ cái gì còn thiếu và vì sao — **thu hẹp scope là quyết định của User, không phải của mình**.
Chỉ được kết thúc lượt khi trúng ĐÚNG một trong năm:
  **(i)** mọi phần deliverable đã xong, hoặc phần chưa xong đều đã trúng (ii)-(v); **(ii)** Gate 1 /
  Gate 2 trong ĐÚNG phạm vi của nó (THẺ THAO TÁC § A); **(iii)** boundary `Rule 1` cần approval;
  **(iv)** ambiguity thật theo `W2` (≥2 cách hiểu đổi scope); **(v)** **cạn đường hợp lệ** — thiếu
  authority `5.5` cho đúng phần đó, hoặc **cạn ĐƯỜNG TẤN CÔNG**, hoặc một mandatory check `BLOCKED` mà
  mọi phần còn lại đều phụ thuộc nó. Ca (v) kết thúc **kèm finding + residual nói rõ cái gì cạn và vì
  sao**, không phải kèm im lặng.
  **"Đường tấn công" = một GIẢ THUYẾT NGUYÊN NHÂN phân biệt được, không phải một lần sửa.** Cạn đường
  chỉ khi: đã liệt kê được không gian giả thuyết, MỌI giả thuyết trong đó đã bị evidence loại, và
  không nghĩ ra được giả thuyết mới nào có discriminating test chạy được trong phiên. **Bộ đếm của
  `6.4`/`W5`/`rulebook/44` (2 lần) KHÔNG chứng minh cạn** — nó chỉ chứng minh đường ĐANG đi đã hỏng,
  và nghĩa vụ lúc đó là đổi giả thuyết chứ không phải kết thúc. Chưa liệt kê được không gian giả
  thuyết thì theo định nghĩa CHƯA cạn.
- **"escalate" / "STOP" ≠ TỰ ĐỘNG kết thúc lượt.** `6.4`, `6.4b`, `W0`④, `W5`, `rulebook/44` và `5.7`
  (đính chính lần 2) là lệnh **ĐỔI CÁCH LÀM**: bỏ một đường tấn công đang hỏng, báo ra, rồi tiếp tục
  deliverable bằng đường khác. Chỉ khi không còn đường nào VÀ không còn phần độc lập nào để làm thì
  mới rơi vào ca (v) — chúng không cấp phép bỏ dở khi vẫn còn việc làm được.
- **`BLOCKED` / C7 / C9 MẶC ĐỊNH là verdict cho MỘT check hoặc MỘT claim.** Dùng nó để đóng cả task
  khi các phần khác vẫn làm được là sai. **Ngoại lệ tường minh:** terminal status cấp task của `/fix`
  (`fix.md` § Terminal status), `/plan` CONVERGE và `/scan` — hợp lệ khi thoả ca (v), tức mọi phần
  deliverable đều phụ thuộc đúng blocker đó. C7 giữ NGUYÊN điều kiện của dòng C7 bảng `5.2` (gồm cả
  "cần build/benchmark cả hai phương án"); `B9` không siết thêm — siết C7 chỉ đẩy sang bịa số (`5.1`).
- Danh sách (i)-(v) là ĐÓNG, và đây là **luật TỔNG QUÁT, không phải allowlist**: MỌI lệnh "DỪNG" /
  "STOP" / "escalate" trong toàn bộ contract, rulebook, command và skill — **kể cả câu viết ra sau
  này** — mặc định có tân ngữ là **đường tấn công đang hỏng**, không phải lượt làm việc, trừ khi chính
  câu đó trúng một trong năm ca. Liệt kê tên vài rule ở bullet trên chỉ là ví dụ, không phải phạm vi.
- **PHẠM VI OVERRIDE — đọc kỹ, đây là chỗ dễ đọc rộng nhất.** `B9` là ngoại lệ tường minh của DUY
  NHẤT một thứ: mệnh đề "rule CHẶT hơn thắng" trong khối **Xung đột rule** (§ LUẬT BẮT BUỘC), và CHỈ
  cho câu hỏi *"dừng hay đi tiếp"* — đi tiếp thắng trừ khi trúng (i)-(v). `B9` **KHÔNG** đụng điều
  khoản fail-closed của **Trigger định tính** nằm ngay trên khối đó: "không tầm thường / rủi ro đủ cao
  / risky flow" vẫn **phân vân → coi là ĐẠT**, vì chúng quyết định Gate 1, mandate reviewer `W3` và độ
  sâu Deep Audit — không quyết định dừng-hay-đi-tiếp. **Mọi** trigger của Gate 2 (§ A) cũng fail-closed
  y vậy. Đọc `B9` thành giấy phép hạ một trigger định tính bất kỳ là đọc SAI.

---

## 🧠 AI BEHAVIOR RULES (MASTER WORKFLOW)

### W0 — Pre-Code Gate (BẮT BUỘC, chạy trước Edit/Write đầu tiên của mỗi change)
- Điền đủ 5 ô ở **THẺ THAO TÁC § A**. Ô nào trống → chưa được viết code; đi thu evidence hoặc
  escalate theo C7/C9.
- **Risky flow** (crash fix, file parsing, auth/cloud, navigation, lifecycle, security/privacy,
  module boundary, ≥2 module) → 5 ô này phải được **reviewer duyệt TRƯỚC khi viết code**, không phải
  review code sau khi viết (`W3`).
- Ô 4 quyết định trước khi sửa: "cái gì SET giá trị tôi đang gate vào, và nó có chạy trong kịch bản
  bug không?". Chưa trả lời được = chưa hiểu bug (`check 7`).
- **4 câu hỏi thiết kế — trả lời TRƯỚC khi gõ dòng code đầu tiên.** Mỗi câu ứng với một lớp defect đã
  đo được trong project (`.claude/knowledge/rule_evidence_cases.md`):
  ① Điều kiện tôi viết có chứa luôn **chính hành động tôi định chặn/phát hiện** không? *(tự tháo ngòi)*
  ② Hành vi ĐÚNG có thể **bắt đầu VÀ kết thúc giữa hai lần lấy mẫu** không? *(mù theo mốc)*
  ③ Tín hiệu tôi đang tin còn **sinh ra từ nguyên nhân nào khác**? *(exit≠0 ≠ lỗi compile)*
  ④ **Mutant nào SỐNG SÓT** qua oracle/điều kiện này? *(oracle quan hệ thay vì literal)*
  Và: viết danh sách **"KHÔNG được kêu / không được đổi" TRƯỚC** danh sách "phải kêu", lấy case từ
  **văn bản và hành vi THẬT** chứ không phải case bịa — mọi false positive đo được đều sinh ra từ vế
  này bị bỏ trống.

- **ÉP BUG LÒI SỚM — mục tiêu là ÍT VÒNG NHẤT, không phải sửa nhanh nhất.** Đo 2026-07-28: 5 defect,
  4 vòng, và **0 cái do tự đọc lại mà thấy** — 3 do gate máy kêu, 2 do mutation. Bốn thao tác dưới đây
  gom chúng về gần một vòng; bỏ thao tác nào là mua thêm một vòng:
  ① **Oracle trước code**: khai báo cái MÁY sẽ phân xử thay đổi này (test/hook/script/log) trước khi
     gõ dòng đầu. "Tôi sẽ đọc lại kỹ" không phải oracle — nó chưa bắt được lỗi nào.
  ② **Mutation NGAY khi test xanh lần đầu**, không để cuối: giết riêng từng nhánh load-bearing;
     nhánh nào không case nào đỏ = bug tương lai, đang có sẵn. Ca đo: harness xanh **28/28 mà vẫn mù
     2 nhánh** (`failures>0`, `tests==0`) — đúng 2 nhánh vừa chặn thật hôm đó.
  ③ **Bung lens SONG SONG trong CÙNG một message** (`W3`), mỗi lens MỘT câu hỏi khác nhau: (a) liệt kê
     "không được kêu" từ văn bản thật, (b) nhánh code nào không có oracle, (c) contract header ↔ code
     lệch chỗ nào, (d) mâu thuẫn với gate/rule đã có. Mỗi lens chỉ thấy lớp defect của nó — chạy tuần
     tự thì mỗi vòng lòi đúng một lớp.
  ④ **Đếm vòng**: sang vòng thứ 3 mà vẫn lòi ra lớp defect **MỚI** (khác lớp, không phải cùng lớp như
     `6.4`) → DỪNG. Đó là dấu hiệu chưa từng liệt kê không gian thất bại, không phải xui; quay lại ①.

### W1 — Intelligence Discovery
- **Graph-first:** `search_graph` → `trace_path` → `get_code_snippet`; `query_graph`/`get_architecture`
  cho quan hệ hoặc overview phức tạp.
- **Dirty-file guard (stale ≠ thiếu):** file trong dirty working tree (`git status`) → `Read` source
  trực tiếp là chân lý — graph index theo commit nên trả nội dung CŨ một cách tự tin; graph chỉ dùng
  tìm consumer/call path cho file đó, cross-check bằng `detect_changes`. Commit giữa phiên cũng làm
  index tụt sau HEAD → `detect_changes` trước khi tin graph.
- **Fallback `Read`/`Grep`:** string literal, config/docs/generated, hoặc khi graph không đủ evidence.
- **Không** dùng `ls`/`cat` để khám phá codebase (và `cat` không cho số dòng → citation sẽ sai).

### W2 — Planning (Plan First)
- **Trước khi viết plan**: task có ambiguity thật (nhiều cách hiểu/thiết kế khác nhau hợp lý, hoặc
  thiếu thông tin quyết định scope) → hỏi User để chọn/làm rõ TRƯỚC, không tự chọn rồi để reviewer
  duyệt sau (xem THẺ THAO TÁC § A). Không có ambiguity thật → bỏ qua bước này, đi thẳng viết plan.
- Trigger `/plan` khi bất kỳ điều kiện đúng: ≥ 3 files OR ≥ 2 modules OR > 200 LOC net diff OR risky flow.
- Plan **BẮT BUỘC** có: Impact Analysis, Flow Analysis, Test Gap từ Graph.
- **Thứ tự plan → review → GATE 1 → RED test → code → GREEN/review → GATE 2: xem THẺ THAO TÁC § A**
  (bản hành động). Vòng review plan không giới hạn; vòng sửa code sau đó phải tiến về 1, vì review
  một trang thiết kế rẻ hơn review 300 dòng và bắt đúng lớp defect mà test-sau-khi-viết không thấy.
- **Gate 1 và Gate 2 KHÔNG dùng chung ngưỡng — canonical ở THẺ THAO TÁC § A**: Gate 1 theo ngưỡng
  `/plan` ở trên (+ boundary `Rule 1`); Gate 2 HẸP hơn, theo **danh sách (a)-(d) ở § A** — KHÔNG chép
  lại ở đây, vì bản chép sẽ trôi (đã trôi thật một lần: bản cũ chỗ này chỉ còn 2 mục, thiếu (b) và
  (d)). Đây là ngoại lệ tường minh của "không xin approve mặc định"
  trong `.claude/commands/plan.md`: hai gate này là điểm dừng bắt buộc **trong đúng phạm vi của
  chúng**, phần TỰ QUYẾT còn lại của `/plan` (chọn approach, chọn default reversible) giữ nguyên. Task
  dưới ngưỡng không có gate người; task TRÊN ngưỡng `/plan` nhưng ngoài phạm vi Gate 2 thì audit xong
  là tự phát verdict và đi tiếp (`B9`), không treo chờ người.
- **Gate/guard mới phải kiểm MÂU THUẪN với gate đã có TRƯỚC khi wire** — hai luật đúng riêng lẻ vẫn
  có thể đóng kín không gian hành động; phải thử giao của chúng, không chỉ từng cái. Ca đo:
  `.claude/knowledge/rule_evidence_cases.md#case-gate-conflict-2026-07-27`.
- Plan tại `plans/[feature]/` hội tụ CLEAN → xóa folder khỏi working tree (git history giữ bản lưu);
  nội dung có giá trị lâu dài → chuyển vào `.claude/knowledge/`, không để cùng finding trùng lặp ở cả hai.

### W3 — Intelligence Delegation (Sub-Agents)
- Delegate khi: generate > 5 files, refactor > 500 LOC, viết > 20 test case.
- **Tự dùng expert review khi rủi ro đủ cao, không chờ User nhắc:**
  - `officereader-code-reviewer`: sau mọi Kotlin/Java change không tầm thường; bắt buộc nếu chạm crash
    fix, file parsing, auth/cloud, navigation, lifecycle, error handling, security/privacy, hoặc diff
    nhiều file.
  - `test-architect-seti`: thêm/sửa test, flaky, QA script/CI, test orchestration, fix phụ thuộc
    deterministic test.
  - `android-principal-architect`: trước khi chạm module boundary, DI graph, public API, navigation
    contract, shared architecture, hoặc change ≥ 2 modules.
- **Review NGAY SAU fix ĐẦU TIÊN của mỗi lớp defect, không đợi hết batch** *(CANONICAL: `AGENTS.md`
  § Automatic Expert Review)*: sửa nhiều lỗi rồi review một lần ở cuối = kỹ thuật sai được nhân bản
  sang mọi fix trước khi có ai nhìn thấy. Làm xong fix đầu → review → áp bài học → mới làm tiếp.
  Review cuối batch vẫn chạy nhưng thôi làm tuyến phòng thủ đầu tiên. Ca đo:
  `.claude/knowledge/rule_evidence_cases.md#case-review-timing-2026-07-27`. **`review_gate.sh` chạy ở
  Stop nên chỉ enforce được tuyến cuối — tuyến "sau fix #1" hoàn toàn do mình tự giữ.**
- **Ngoại lệ gọn (đã siết):** edit 1 dòng/local, rủi ro thấp, có compile/test/ktlint targeted cover →
  manual multi-lens self-review đủ. **KHÔNG áp ngoại lệ này khi** diff chạm: (i) risky flow bất kỳ
  (crash, file parsing, auth/cloud, navigation, lifecycle, security/privacy, module boundary, ≥2
  module); (ii) **meta-tooling** — hook, gate, script `scripts/qa`, workflow, harness test; (iii) file
  rule (`CLAUDE.md`, `AGENTS.md`, `.claude/rulebook/`, `.claude/commands/`). Lý do cho (ii)+(iii): sai
  ở đây không hỏng một file mà hỏng cái đang canh MỌI file — 5 defect tầng hook đo 2026-07-27 và một
  false positive 2026-07-28 đều lọt qua đúng khe "chỉ sửa một dòng". Self-review phải **viết ra**
  (lens nào, thấy gì), không phải làm trong đầu — self-review không để lại dấu vết là không tồn tại.
- **Fallback:** harness không có sub-agent tool → tự chạy lens tương ứng bằng Read/Grep/Graph và báo rõ
  "sub-agent unavailable".
- **Premise hygiene (bắt buộc):** prompt cho sub-agent/reviewer phải TÁCH RÕ fact (kèm evidence) khỏi
  hypothesis (label "giả thuyết chưa verify", kể cả giả thuyết mình đang tin nhất); yêu cầu reviewer
  BÁC BỎ, không phải xác nhận. Reviewer "confirm" một premise do chính mình mớm ≠ evidence độc lập.
  Premise bị bác → MỌI kết luận/review/fix xây trên nó VÔ HIỆU, phải re-derive từ đầu, không vá tiếp.
- **Chạy SONG SONG khi task độc lập:** nhiều sub-agent phải được gọi trong **CÙNG một message** để
  chạy đồng thời — gọi tuần tự từng cái là tự nhân thời gian chờ lên. Nhiều task độc lập → mỗi task
  một agent riêng; nhiều change độc lập → mỗi change một reviewer riêng, đừng dồn vào một reviewer
  rồi chờ.
- **Scope giữa các agent phải RỜI NHAU, và main context KHÔNG sửa file đang có agent đọc** — nếu buộc
  phải sửa thì nêu rõ độ lệch khi đối chiếu finding, đừng áp thẳng.
- **Delegate xong ≠ đã review.** Agent nền có thể chết cùng process mà không trả kết quả. Chỉ tính là
  đã review khi kết quả THỰC SỰ về tay; chưa về thì ghi residual, cấm coi như xong. `review_gate` chỉ
  thấy agent đã được GỌI, không thấy nó có trả lời — chỗ hở này do mình tự giữ.
  Cả hai ca đo: `.claude/knowledge/rule_evidence_cases.md#case-subagent-coordination-2026-07-27`.
- **Protocol:** main context là **Master Architect** review output của sub-agent, chỉ fix finding có
  bằng chứng thật, giữ Scope Lock/B3. Báo cáo sub-agent đi theo `5.3`(f).

### W4 — Self-Improving Memory (Bắt buộc)
- Sau khi fix lỗi **P0/P1/P2** → ghi memory vào `.claude/memory/`.
- **Claim sai đã phát biểu với User bị phát hiện** (cause đoán sai, số liệu sai, "đã xong" sai, negative
  claim sai) → BẮT BUỘC ghi memory: claim sai là gì → vì sao tin nhầm (thiếu loại evidence nào, lách
  rule nào) → prevention. Sai mà không ghi = sẽ sai lại.
- Format: `[severity] — vấn đề → giải pháp → prevention`.
- **Phát hiện RULE hoặc GATE sai trong lúc làm → sửa NGAY trong cùng lượt, không để lại sau.**
  Áp cho: gate chặn nhầm (false positive), luật mâu thuẫn với thực tế đo được, gate báo sai nguyên
  nhân, hoặc rule mô tả sai trạng thái hệ thống. Sửa rule/gate vẫn theo `5.5` — cần authority (a):
  evidence thật nó sai, không phải "thấy phiền".
  **CẤM 3 lối tắt**: (i) lờ cảnh báo đi tiếp; (ii) tắt bằng escape hatch để cho qua; (iii) bẻ
  code/dữ liệu/test cho khớp gate. Cả ba đều biến gate thành thứ trang trí.
  **Gate false-positive nguy hiểm hơn gate thiếu** — gate thiếu chỉ là không bắt được; gate kêu sai
  dạy người ta tắt gate, và nếu nó còn báo sai NGUYÊN NHÂN thì nó chủ động đẩy người đọc đi sửa nhầm
  chỗ. Ca đo: `.claude/knowledge/rule_evidence_cases.md#case-gate-false-positive-2026-07-27`.
  Sửa xong → đồng bộ `CLAUDE.md` ↔ `AGENTS.md` và cập nhật `.claude/knowledge/machine_gate_layer.md`
  (bảng chi tiết từng hook) cho khớp sự thật mới; chỉ sửa § THẺ THAO TÁC § C nếu đổi *hook nào chặn
  thật* hoặc *cái gì không có gate*.

### W5 — Auto-Fix & Debugging
- Gặp lỗi → **KHÔNG hỏi ngay**. Dùng `adb-logcat` (replicant-mcp) + `query_graph`/`trace_path` tìm root
  cause trong call stack. Root cause chỉ KẾT LUẬN khi đạt chuẩn `5.8`; trước đó là hypothesis nội bộ
  (`5.7`) — chỉ phát biểu với User theo dòng C7 khi check không chạy được trong phiên.
- Sau 2 lần fix thất bại cùng 1 root cause, bỏ đường tấn công đó, đổi hypothesis/oracle và tiếp tục
  mọi phần độc lập; chỉ hỏi User khi chính lựa chọn còn lại chạm một terminal hợp lệ của `B9`.

### W6 — Prove It Works
- Mỗi completion claim phải có evidence trực tiếp tương xứng vùng thay đổi; test, runtime/logcat,
  security, performance, release gate chỉ bắt buộc khi outcome đó applicable.
- Bug fix/error correction luôn theo **PAIRED EXECUTABLE ORACLE** ở thẻ thao tác: cùng oracle đã chạy
  RED trước production edit và GREEN sau edit; không có evidence này thì không được claim outcome.
- **A11y bắt buộc:** normal text contrast ≥ 4.5:1 theo
  [WCAG 2.1 SC 1.4.3](https://www.w3.org/TR/WCAG21/#contrast-minimum); touch target tương tác
  ≥ 48×48dp theo
  [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps);
  graphic có ý nghĩa/custom control phải có semantics phù hợp, còn graphic thuần trang trí dùng
  `contentDescription = null` theo
  [Compose accessibility guidance](https://developer.android.com/develop/ui/compose/accessibility/api-defaults).
- UI change bắt buộc check trên ≥ 1 device thật trước khi release.
- **Wire xong ≠ đang bảo vệ.** Fixture chỉ chứng minh SCRIPT chạy đúng, không chứng minh harness có
  gọi hook. Đúng cặp action/outcome của dòng C5: "đã wire" là action, "đang chặn" là outcome — chỉ
  nói được khi **thấy nó kêu thật từ một hành động đi qua harness**. Sau khi wire hook mới: chạy một
  hành động thật rồi đọc log của nó; chưa thấy log thì báo "đã wire, chưa quan sát được hiệu lực".
  Ca đo: `.claude/knowledge/rule_evidence_cases.md#case-wired-not-live-2026-07-27`.

---

## 🔒 DEEP AUDIT LOOP (ZERO-DEFECT GATE)

> Bắt buộc cho MỌI thay đổi code; ĐỘ SÂU từng check scale theo risk/blast radius. Mỗi check phải ghi
> `PASS`, `NOT APPLICABLE` kèm lý do, hoặc `BLOCKED` kèm residual — "risk thấp" thể hiện bằng NOT
> APPLICABLE có lý do, KHÔNG phải skip im lặng. **Risk assessment và lý do NA là negative/scope claim
> theo `5.1`** — "không có runtime surface/concurrency/consumer" phải có grep/`search_graph` chống
> lưng, không phải cảm giác. Không gọi `CLEAN` khi còn finding hoặc residual đã validate.

**Protocol:** `[1] FIX` → `[2] AUDIT` → `[3] EVALUATE` → `[4] CLEAN ✅` hoặc `⛔ ANTI-LOOP`.

| # | Check | Tool / Command |
| :--- | :--- | :--- |
| 1 | Build + compile | `:<module>:compileDebugKotlin` **VÀ** `:<module>:compileDebugUnitTestKotlin` cho MỌI module đã sửa — 0 error. `assembleDebug`/`compileDebugKotlin` **KHÔNG** compile test source set: đổi signature vỡ call site trong `src/test` mà build vẫn xanh → CI/release gate mới đỏ. Ca: `.claude/knowledge/rule_evidence_cases.md#case-testsourceset-2026-07-16`. |
| 2 | Test | Targeted test cho behavior/failure mechanism. **Bằng chứng PASS = số đếm đọc từ `<module>/build/test-results/**/TEST-*.xml` (unit test) hoặc `<module>/build/outputs/androidTest-results/connected/**/TEST-*.xml` (instrumented — root là `<testsuites>` bọc `<testsuite>`, số đếm lấy từ `<testsuite>` con): `tests`>0 VÀ `failures`=0 VÀ `errors`=0, và `skipped` phải được nêu tường minh** (skip không phải pass — `@Ignore` vẫn đếm vào `skipped`). KHÔNG dùng summary của wrapper/MCP. **XML phải MỚI hơn lần edit cuối (so timestamp)** — XML cũ = CHƯA CHẠY code mới. `total=0`, `UP-TO-DATE`, `No tests found` = **CHƯA CHẠY**, cấm gọi là PASS. Test mới phải RED-check trước khi tin nó có răng — đỏ vì ĐÚNG failure mechanism đang test, không phải throw bất kỳ ở đầu method. **RED-check = MUTATE từng phần load-bearing, KHÔNG phải revert cả change; HẾT HIỆU LỰC mỗi khi test hoặc harness của test thay đổi** *(CANONICAL: `AGENTS.md` § Verification)*: (a) fix có 2 phần → giết RIÊNG từng phần, mutant sống sót = phần đó chưa có coverage; (b) sửa assertion/mock/dispatcher/thêm `mockkStatic` → chạy lại mutant, cấm thừa kế verdict cũ; (c) test xanh trên device KHÔNG phải evidence cho tới khi cùng test đó đỏ lúc gỡ fix. Xanh mà không có đỏ đi kèm → `BLOCKED`, không phải PASS. 3 ca đã quan sát: `.claude/knowledge/rule_evidence_cases.md#case-redcheck-lies`. |
| 3 | Runtime | Device/logcat khi UI, lifecycle, file-open, native hoặc runtime outcome applicable. |
| 4 | Static analysis | Targeted detekt/lint khi vùng/risk cần; không ép toàn repo mặc định. |
| 4b | Style (ktlint) | `:<module>:ktlintCheck` cho module hỗ trợ task; không dùng root gate mặc định. |
| 4c | **Security (BẮT BUỘC theo trigger)** | Diff chạm BẤT KỲ thứ nào sau đây → phải chạy `/scan` hoặc `security-checklist` trên đúng scope, KHÔNG được `NOT APPLICABLE`: external Intent/URI/file handling, exported component, permission, WebView, auth/cloud, network, secret/credential, telemetry/PII/analytics payload, release/signing. Không chạy được → `BLOCKED` + residual. Diff KHÔNG chạm trigger nào → `NOT APPLICABLE` kèm grep/`search_graph` chống lưng (đây là negative claim C4, không phải cảm giác). |
| 5 | Master Review | `detect_changes` + `trace_path` verify logic & blast radius. Đổi member của **base class / interface / public API / object dùng chung** → liệt kê HẾT consumer **TRƯỚC** khi sửa (`search_graph` hoặc grep toàn repo). Xem `5.5`. |
| 6 | Edge Cases | Chọn null/empty/large/config/concurrency/security case theo failure mechanism thật. |
| 7 | **Fix có tác dụng thật** | Bug fix phải chứng minh **đổi observable behavior** (repro trước → sau, device/logcat/log). Test xanh KHÔNG phải bằng chứng bug đã fix: unit test cho pure function tách rời vẫn xanh khi signal thật không bao giờ tới được nó. |

---

## 📂 NGUỒN TRI THỨC & TOOL

| Cần gì | Dùng gì |
| :--- | :--- |
| Code structure / architecture overview | Graph `get_architecture` + `search_graph` |
| Tìm/đọc code symbol | `search_graph` → `get_code_snippet` |
| Caller, flow, blast radius | `trace_path(mode=calls\|data_flow\|cross_service)` / `query_graph` |
| Literal, config, scripts, docs, generated | `Read` / `Grep` |
| Graph thiếu/stale/không resolve semantic | JetBrains MCP (PSI/compiler context cho overload, generated symbol, SDK/dependency) |
| **JetBrains MCP offline hoặc evidence vẫn thiếu** | `Read`/`Grep` fallback — source hiện tại thắng, **ghi rõ lý do fallback** và nêu risk nào còn chưa verify vì thiếu IDE check |
| Kotlin/Java diagnostics | JetBrains `get_file_problems` |
| Rename symbol toàn project | JetBrains `rename_refactoring` (không text replace) |
| Breakpoint, step, stack, live variable | `android-studio-debugger` (chỉ khi có hypothesis rõ) |
| Build, test, logcat, device | `replicant-mcp` |
| Docs thư viện ngoài | `context7` |
| Coding standard / convention | `.claude/rulebook/` |
| Gotcha đã gặp | `.claude/memory/INDEX.md` — memory THỦ CÔNG của project; tách biệt với auto-memory của harness ở `~/.claude/projects/.../memory/MEMORY.md` |
| Bối cảnh dự án | `.claude/knowledge/project_context.md` — feature mới: `<project_overview>`+`<core_logic>`+`<folder_structure>`; fix bug: `<key_files>`; test: `<qa_testing_guidelines>`; version: `<tech_stack>`; convention: `<coding_conventions>` |
| Vì sao luật tồn tại | `.claude/knowledge/rule_evidence_cases.md` |

- `codebase-memory-mcp` là mặc định cho mọi code discovery kể cả đã biết tên symbol — NGOẠI TRỪ file
  dirty (`W1`). Không áp ngưỡng số file/tool-call; dừng khi evidence đủ chứng minh conclusion.
- ⚠️ `gradle-test` hay trả `{passed:0, failed:0, total:0, "UP-TO-DATE"}` khi **không chạy test nào** —
  KHÔNG phải PASS. Lấy số thật từ `TEST-*.xml` (`check 2`).
- JetBrains MCP (`http://localhost:64342/stream`) là companion cho PSI/inspection/refactor khi Android
  Studio chạy, không thay graph cho architecture/call path/blast radius; giữ Brave Mode tắt. Debugger
  MCP dùng `http://127.0.0.1:29191/debugger-mcp/streamable-http`, giữ expression evaluation
  `read_only`; replicant/ADB/logcat vẫn là nguồn chính cho device/native crash.
- Task nhắc **`memory leak`, `OOM`/`OutOfMemoryError`, retained Activity/Fragment/View, RAM tăng bất
  thường, heap dump, HPROF** →
  tự phân loại và chạy workflow, không chờ User yêu cầu tool riêng. Trước hết phân biệt app-runtime
  với Gradle/Kotlin daemon/IDE heap (LeakCanary/LeakLens KHÔNG chẩn đoán build-process OOM — cái đó đi
  JVM/build diagnostics). Static: graph scope → JetBrains `get_file_problems` lấy LeakLens inspection
  nếu plugin đã load → verify lifecycle/ownership trong source (inspection = hypothesis). Runtime:
  debug build trên test device → tái hiện bằng replicant/ADB → thu LeakCanary trace/logcat → LeakLens
  Auto-Detect hoặc heap import/analysis nếu action IDE khả dụng. Action LeakLens không được MCP expose
  → KHÔNG claim đã chạy; nêu đúng một bước UI cần handoff rồi tiếp tục với evidence thu được. LeakLens
  AI mặc định tắt; chỉ dùng debug/test data, không upload/gửi HPROF cho AI provider khi chưa có approval.

---

## 📢 GIT WORKFLOW & HYGIENE

- **Chỉ commit / push / mở PR khi User YÊU CẦU.** Vô điều kiện — không phụ thuộc ngưỡng nào, không
  phụ thuộc phạm vi Gate 2 (thu hẹp Gate 2 không nới luật này). Ba hành động đó đồng thời là trigger
  (c) của Gate 2 ở THẺ THAO TÁC § A. Đang đứng trên nhánh mặc định → tạo branch trước.
- **Ngôn ngữ:** trả lời User, PR body, commit body bằng **Tiếng Việt**; commit subject **Tiếng Anh**.
- **Branch:** `feat/`, `fix/`, `refactor/`, `perf/`, `test/`, `docs/`, `chore/` + `<scope>-<desc>`.
- **Commit:** `<type>(<scope>): <subject EN>` + `<body VI giải thích WHY>`. Body/PR chịu gate
  `5.6`/`5.8`: "fixes X" chỉ khi outcome evidence đã có (`check 7`); verify chưa trọn → ghi rõ
  "runtime verification pending".
- **CHANGELOG:** thay đổi **người dùng thấy được** (feature, bug fix đổi hành vi, perf đo được,
  thay đổi/xoá chức năng, sửa lỗi security/privacy) → thêm dòng vào `[Unreleased]` của `CHANGELOG.md`
  **trong cùng change**, không để dồn tới lúc release. Refactor nội bộ, test, CI/QA, hook, docs và file
  rule → KHÔNG ghi (git history đã giữ). Entry chịu cùng gate `5.6`/`5.8` như commit body: "Fixed X"
  chỉ khi có outcome evidence (`check 7`). Không có thay đổi user-visible → không thêm entry, và đó là
  câu trả lời hợp lệ, không phải bỏ sót.
- **Secrets:** NEVER commit `*.keystore`, `google-services.json`, `.env`, `local.properties`.

---

## 🔁 ĐỒNG BỘ CLAUDE / CODEX

- `CLAUDE.md` = hợp đồng chi tiết cho Claude (giữ bản ĐẦY ĐỦ của bảng `5.2`).
- `AGENTS.md` = baseline dùng chung cho Codex và coding agent khác.
- Cập nhật rule cốt lõi về discovery, verification, no-fabrication, scope, QA gate, tool policy → cập
  nhật **cả hai** để tránh lệch hành vi.
- CANONICAL theo khối: "working code is protected" / verification / RED-check ở `AGENTS.md`
  § Verification; review timing ở `AGENTS.md` § Automatic Expert Review; bảng `5.2` ở `CLAUDE.md`.
  Sửa bản canonical trước, đồng bộ bản nén sau.
- Codex không cần full ECC/Agency/Caveman/Strix/CodeRabbit stack — dùng `AGENTS.md` + MCP hiện có,
  tham chiếu `.claude/commands/` khi cần workflow chi tiết.
