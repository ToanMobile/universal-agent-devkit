# Core Engineering Rules & Solo-Dev Workflow Baseline

## 1. Quyền hạn AI & Bảo mật Tối cao (BẮT BUỘC)
- CHỈ thực hiện git commit, git push hoặc tạo PR (`gh pr create`) khi người dùng YÊU CẦU TƯỜNG MINH.
- Tuyệt đối KHÔNG commit bí mật / Credentials: `.env`, `*.keystore`, `keystore.properties`, `local.properties`, `google-services.json`, token, cookie.
- Che/mask thông tin nhạy cảm (mật khẩu, access token, OTP, thông tin định danh thật) trước khi chụp ảnh minh chứng.
- Tài khoản kiểm thử (email, mật khẩu, token) phải nạp qua biến môi trường hoặc file cấu hình cục bộ (đã vào `.gitignore`), tuyệt đối không hardcode dạng chuỗi trần.

## 2. Quy trình làm việc tinh gọn (Solo Dev)
Thứ tự: Làm & Chạy test cục bộ → Self Review (Diff + DEMO/LIVE) → Chụp ảnh nghiệm thu thành công → Commit / Báo cáo nghiệm thu.

1. **Quản lý Git tinh giản:**
   - Làm việc trực tiếp trên `main` hoặc tạo 1 nhánh đơn giản khi cần (`feat/<tên>` hoặc `fix/<tên>`).
   - Kéo code mới nhất trước khi push (`git pull --rebase origin main`).
2. **Self review + QA trước khi commit:**
   - Soát git diff: đúng yêu cầu, sửa đổi phẫu thuật tối thiểu (Surgical Edits), không lộ secret, có ghi audit log ở nghiệp vụ mới.
   - Giữ nguyên 2 chế độ DEMO / LIVE (mọi bảng nghiệp vụ mới phải có cột mode nếu hệ thống hỗ trợ dual mode).
   - Chạy đủ bộ test cục bộ (`npm test`, `gradlew test`). Thử nghiệm trên các chế độ tương ứng.
3. **Bằng chứng nghiệm thu & Báo cáo Tự nhiên Súc tích (BẮT BUỘC):**
   - MỌI báo cáo kiểm thử / nghiệm thu BẮT BUỘC phải kèm **ảnh minh chứng trạng thái THÀNH CÔNG (Pass / Success State)** (badge PASS) và xuất trình **Báo Cáo Nghiệm Thu 4 Mục** súc tích bằng ngôn ngữ tự nhiên:
     1. **Đã fix được gì (What Was Fixed):** Tên lỗi, nguyên nhân gốc, cơ chế lỗi, bằng chứng đối lập (RED ➔ GREEN).
     2. **Đã chặn đứng bug cũ nào (Zero Reopened Bugs):** Danh sách các rào chắn bất biến lịch sử (`immutable_guards`) và test hồi quy được chạy lại đạt `[x] PASS`.
     3. **Nguy cơ bug mới nào đã triệt tiêu (Zero Collateral Damage):** Kết quả rà soát điểm gọi ngược (inbound callers) và module liên đới, xác nhận không có tác dụng phụ.
     4. **Trạng thái an toàn mã nguồn:** Kết quả quét bí mật/token (SẠCH), chống code lười biếng (0 placeholder), và phân tích tĩnh Alibaba OCR (0 leak).
   - Báo cáo thiếu ảnh hoặc thiếu 4 mục trên bị coi là CHƯA ĐỦ ĐIỀU KIỆN nghiệm thu.
4. **Commit & Bàn giao:**
   - Commit bằng ngôn ngữ rõ ràng, tiền tố conventional: `feat:`, `fix:`, `test:`, `chore:`, `docs:`.
   - Báo cáo kết quả kiểm thử kèm ảnh nghiệm thu thành công đầy đủ cho Tech Lead / Reviewer.
5. **Hoàn tất tự động (Task Completion Card):**
   - Sau mỗi cập nhật tiến độ, checkpoint, reviewer finding, hoặc hướng điều tra thất bại, tự động tiếp tục thực thi các bước tiếp theo cho đến khi toàn bộ phạm vi công việc đạt trạng thái kết thúc hợp lệ.
   - Tiến độ công việc không phải là câu trả lời cuối cùng; tuyệt đối không bao giờ yêu cầu người dùng phải gõ `continue` hay `làm tiếp`.

## 3. Quy chuẩn Test Automation & Chống Spam Thao Tác (Anti-Spam / Debounce)
- **Tương tác UI chặt chẽ:** Tương tác UI bằng các tiện ích an toàn (`safeClick`, `safeFill`) có cơ chế wait visible, scroll into view, kiểm tra disabled; không dùng click mù quáng hoặc sleep cố định.
- **Chống Spam Thao Tác & Tránh Quá Tải Hạ Tầng:**
  - Mọi nút kích hoạt thao tác tốn kém, gọi API hoặc xác nhận giao dịch bắt buộc phải có cơ chế **Debounce / Disable ngay tức thì sau cú click đầu tiên** và hiển thị trạng thái Loading.
  - Test runner: Tuyệt đối không spam tạo mới workflow liên tục hoặc bắn request dồn dập. Chỉ chạy test chỉ định đích danh từng test case cần thiết khi phát triển.

## 4. Triết lý Kỹ sư Già "Lười biếng" (Lazy Senior Dev Principle)
- **Tái sử dụng tiện ích có sẵn trước:** Trước khi viết mới bất kỳ hàm utility, helper hay service nào, bắt buộc phải tìm kiếm trong codebase xem dự án đã có sẵn hàm tương tự chưa. Tuyệt đối không viết trùng lặp logic ("Don't Reinvent the Wheel").
- **Tối giản phụ thuộc (Zero Dependency Bloat):** Không tùy tiện cài thêm third-party dependency nếu standard library hoặc mã nguồn nội bộ có thể giải quyết thanh lịch và ổn định.
- **Tôn vinh Net Diff âm (Celebrate Negative Net Diff):** Dòng code an toàn và ít lỗi nhất là dòng code không cần viết, hoặc dead code được dọn dẹp triệt để. Ưu tiên giải pháp ngắn gọn, trực diện, không over-engineering.

## 5. Quy chuẩn Chống Lười Biếng (Anti-Laziness & Integrity)
- **Nghiêm cấm Code Placeholder lười biếng:** Tuyệt đối KHÔNG ĐƯỢC sinh code chứa các đoạn comment lười biếng như `// ... existing code ...`, `/* keep remaining code */`, `# TODO: implement rest` làm mất mát logic nguyên bản của người dùng.
- **Thay thế nguyên khối liền mạch:** Mọi chỉnh sửa mã nguồn phải bảo toàn tính toàn vẹn của các import, docstring, comment và hàm liên quan.
- **Bảo toàn tính tương thích ngược (Backward Compatibility):** Không tự ý phá vỡ interface/chữ ký hàm công khai đang có khi chưa kiểm tra toàn bộ điểm gọi (caller blast radius).

## 6. Quy chuẩn Giao diện & Trải nghiệm Tiếp cận (UI/UX & a11y Gate)
- **Tuân thủ `DESIGN.md`:** Mọi mã nguồn sinh UI bắt buộc phải lấy token màu sắc, typography và khoảng cách từ `DESIGN.md`.
- **Kích thước Vùng chạm An toàn:** Touch target tối thiểu $\ge 48\times 48\text{dp}$ (hoặc $\ge 44\times 44\text{px}$ trên Web) cho mọi phần tử có thể nhấn/chạm.
- **Phản hồi Tức thì:** Mọi hành động kích hoạt qua UI phải hiển thị trạng thái tương tác tức thì (loading indicator, disabled state, ripple/highlight) để người dùng không bấm lặp lại.

## 7. Quản trị Ngữ cảnh & Chống Thoái hóa Suy luận (Anti-Dumb Zone Context Hygiene)
- **Kiểm soát Ngưỡng Ngữ cảnh (>50%):** Khi phiên làm việc kéo dài và context tiêu tốn lớn, hoặc trước khi bước vào một đợt refactor phức tạp nhiều file, AI Agent bắt buộc phải chủ động tóm tắt tiến độ (checkpoint) và thực hiện nén ngữ cảnh (`/compact` hoặc reset session có handoff) để tránh suy thoái năng lực suy luận.
- **Không nhồi nhét ngữ cảnh thừa:** Tuyệt đối không đọc toàn bộ thư mục lớn hoặc nạp các tệp build/tạp nham vào context; chỉ đọc đúng phạm vi cần sửa đổi và kiểm chứng.

## 8. Quy chuẩn Bắt buộc về Tối ưu Hiệu năng & Quản trị Tài nguyên (Mandatory High-Performance Standard)
Mọi dòng mã sinh ra hoặc sửa đổi BẮT BUỘC phải tuân thủ 5 nguyên tắc tối ưu hiệu năng tối thượng:
1. **Độ phức tạp Thuật toán & Tối ưu Hot Path:**
   - Nghiêm cấm lồng vòng lặp $O(N^2)$ / $O(N^3)$ trên tập dữ liệu động mà không có lý do chính đáng; bắt buộc chuyển đổi sang cấu trúc tra cứu $O(1)$ (HashMap, HashSet, Map, Set, Dictionary) hoặc thuật toán tối ưu $O(N \log N)$.
   - Trong "Hot Path" (vòng lặp lớn, hàm render/frame 60–120 FPS, event dispatch): Tuyệt đối tránh cấp phát object tạm thừa thãi để giảm tải áp lực dọn rác (GC pressure / GC thrashing gây giật lag giao diện).
2. **Bất đồng bộ & Tuyệt đối Không chặn Luồng Chính (Non-blocking UI & Main Thread):**
   - Nghiêm cấm thực hiện I/O (đọc/ghi file, truy vấn CSDL, gọi API Network) hoặc tính toán nặng (mã hóa, parse JSON dung lượng lớn) trên Main Thread / UI Thread / Event Loop chính.
   - Bắt buộc đẩy sang Background Worker / Coroutine Dispatchers (`Dispatchers.IO`, Web Worker, Task Pool) và trả kết quả bất đồng bộ.
3. **Giải phóng Tài nguyên & Triệt tiêu Rò rỉ Bộ nhớ (Zero Memory Leak & Resource Cleanup):**
   - Mọi luồng I/O (FileStream, DB Connection, Socket, Cursor, Http Response Body) BẮT BUỘC phải dùng cơ chế tự động giải phóng (`use`, `try-with-resources`, `using`, hoặc `try...finally`).
   - Quản lý vòng đời chặt chẽ (Lifecycle-Aware): Bắt buộc hủy đăng ký (unsubscribe / unregister / removeListener) mọi Event Listener, Observer, Timer, và Coroutine Scope khi Component, Screen, hoặc Activity bị hủy / unmount. Cấm giữ tham chiếu tĩnh (static reference) đến UI Context / Activity.
4. **Tối ưu Truy vấn Dữ liệu & I/O (Anti N+1 & Smart Caching):**
   - Triệt tiêu hoàn toàn lỗi N+1 Query: Bắt buộc dùng JOIN, Batching, hoặc Bulk Fetching khi truy xuất dữ liệu liên kết.
   - Caching thông minh: Áp dụng In-memory cache (LRU cache, memoization) cho các phép tính đắt đỏ hoặc dữ liệu cấu hình ít thay đổi được truy xuất nhiều lần.
5. **Tải theo Nhu cầu & Tối ưu Dung lượng (Lazy Loading & Virtualization):**
   - Với danh sách dữ liệu dài: Bắt buộc áp dụng phân trang (Pagination), Virtual Scrolling, hoặc Recycler/LazyList; tuyệt đối không render một lúc hàng trăm/hàng nghìn phần tử DOM/View lên bộ nhớ.
   - Tài nguyên nặng (ảnh, video, audio, module phụ): Tải lười (Lazy / On-demand Loading), nén dung lượng phù hợp với màn hình hiển thị.

## 9. Quy chuẩn Xử lý Ngoại lệ & Hàng rào Phòng thủ (Anti-Swallowing Exceptions & Crash Boundaries)
1. **Nghiêm cấm Nuốt Lỗi Âm Thầm (Anti-Swallowing):**
   - Tuyệt đối KHÔNG ĐƯỢC viết các khối `catch` rỗng (`catch (e) {}`, `except: pass`, `catch (Throwable t) {}`) mà không ghi log hoặc không có phương án cứu vãn. Mọi lỗi phát sinh phải được log có ngữ cảnh (`Contextual Error Logging`) hoặc re-throw có kiểm soát để tránh sinh ra "lỗi ma" (Ghost Bugs).
2. **Hàng rào Phòng thủ Sập Ứng Dụng (Crash Boundaries):**
   - Cấp Giao diện (UI): Triển khai Error Boundary (Web React, Flutter ErrorWidget, Jetpack Compose Fallback). Lỗi render ở một widget con tuyệt đối không được phép làm sập toàn bộ màn hình hoặc văng ứng dụng; bắt buộc hiển thị Fallback UI kèm nút "Thử lại" (Retry).
   - Cấp Dịch vụ & Tiến trình (Process/Worker): Bắt buộc có Global Exception Handler để bắt các lỗi Uncaught Exception, ghi lại breadcrumb chẩn đoán và đóng tài nguyên an toàn trước khi thoát tiến trình.

## 10. Quy chuẩn Khả năng Phục hồi Mạng & Chống Trùng Giao Dịch (Network Resilience & Idempotency)
1. **Timeout Tường Minh Bắt Buộc (Mandatory Timeouts):**
   - 100% kết nối mạng (HTTP, gRPC, WebSocket, TCP Socket) BẮT BUỘC phải cấu hình Timeout rõ ràng.
   - Ngưỡng chuẩn: Connect Timeout $\le 10\text{s}$, Read/Response Timeout $\le 15\text{s}$ (trừ các API stream/long-polling đặc thù có heartbeat). Tuyệt đối cấm để timeout mặc định vô hạn gây treo đơ ứng dụng.
2. **Thử lại Thông minh (Exponential Backoff with Jitter):**
   - Chỉ áp dụng retry tự động cho các request an toàn (idempotent GET/HEAD) hoặc lỗi mạng tạm thời (503 Service Unavailable, 504 Gateway Timeout, SocketTimeout).
   - Bắt buộc tăng thời gian chờ cấp số nhân kèm độ nhiễu ngẫu nhiên (`jitter`) để chống quá tải máy chủ (Thundering Herd Problem).
3. **Khóa Chống Trùng Giao Dịch (Idempotency Key):**
   - Với mọi tác vụ ghi/thay đổi trạng thái nhạy cảm (POST/PUT/PATCH liên quan đến thanh toán, tạo chứng từ, điều phối đơn hàng): Bắt buộc sinh mã `Idempotency-Key` (UUIDv4) gắn vào Header request để máy chủ loại trừ các giao dịch trùng lặp khi mạng chập chờn.
4. **Trải nghiệm Mất Mạng Thân thiện (Offline-First Grace):**
   - Khi thiết bị ngắt kết nối mạng: Không hiển thị màn hình trắng hoặc lỗi crash thô bạo. Bắt buộc hiển thị trạng thái Offline văn minh, cho phép xem dữ liệu cache cục bộ và lưu hàng đợi thao tác để gửi lại khi có mạng.

## 11. Quy chuẩn Nhật ký Vận hành & Bảo vệ Dữ liệu Nhạy cảm (Structured Logging & PII Masking)
1. **Chuẩn hóa Nhật ký Cấu trúc (Structured Logging):**
   - Nghiêm cấm sử dụng các lệnh in chuỗi thô (`console.log()`, `println()`, `System.out.println()`, `e.printStackTrace()`) trong mã nguồn production.
   - Bắt buộc sử dụng hệ thống Logger chuyên dụng có cấp độ rõ ràng: `DEBUG` (chỉ chạy môi trường dev/local), `INFO`, `WARN`, `ERROR` kèm mã lỗi (ErrorCode) và mã liên kết phiên (`TraceId` / `CorrelationId`).
2. **Bắt buộc Che Giấu Dữ liệu Nhạy cảm (PII Masking Engine):**
   - Tuyệt đối KHÔNG BAO GIỜ in thông tin cá nhân hoặc bí mật lên log, console, telemetry hay Crashlytics.
   - Bắt buộc mask dữ liệu trước khi log: Mật khẩu, JWT Access Token, Mã OTP, Số CMND/CCCD, Số thẻ thanh toán, Số điện thoại (Ví dụ: `0987***321`, `tok_****`, `card_****1234`).

## 12. Quy chuẩn An toàn Di trú CSDL & Dữ liệu Cục bộ (Database Migration & Backward Data Safety)
1. **An toàn Cấu trúc Bảng & Dữ liệu Người Dùng:**
   - Mọi thay đổi schema CSDL (SQLite, Room, Realm, IndexedDB, Postgres, MySQL) BẮT BUỘC phải có kịch bản di trú (Migration Script) tường minh.
   - Tuyệt đối cấm sử dụng cơ chế xóa sạch bảng để tạo lại (`destructive migration / drop tables`) trên môi trường LIVE/Production làm bay màu dữ liệu người dùng.
2. **Kiểm thử Tự động Di trú Dữ liệu (Automated Migration Tests):**
   - Mỗi bản di trú schema phải đi kèm một bài kiểm thử tự động giả lập: Nạp dữ liệu từ schema phiên bản $N-1$, thực thi script migration lên phiên bản $N$, và kiểm tra tính toàn vẹn 100% của dữ liệu sau khi nâng cấp.

## 13. Kỷ luật Giao tiếp Ngắn gọn & Báo cáo B10 (Plain-Language B10 Discipline)
1. **Quy tắc 3 dòng mở đầu:**
   - Mọi báo cáo tiến độ/kết quả bàn giao BẮT BUỘC mở đầu bằng 3 dòng súc tích:
     - **Dòng 1 — Trạng thái một từ:** `XONG` / `CHƯA XONG` / `CHỜ DUYỆT`.
     - **Dòng 2 — Kết quả người dùng nhận được:** Mô tả giá trị thực tế bằng ngôn ngữ đời thường, ngắn gọn.
     - **Dòng 3 — Bước tiếp theo:** Hành động kế tiếp cần thực hiện.
2. **Giới hạn độ dài & Tránh rối mắt:**
   - Báo cáo tóm tắt khống chế tối đa 12 dòng.
   - Tuyệt đối KHÔNG xổ logcat thô, terminal trace dài dòng hay thuật ngữ nội bộ gây rối mắt người dùng trừ khi được yêu cầu phân tích sâu.

## 14. Kỷ luật Chống Spam Thao Tác Nâng Cao (Debounce >= 1000ms & Instant Disable)
1. **Khóa nút bấm ngay mili-giây đầu tiên:**
   - Mọi nút bấm kích hoạt hành động quan trọng (gọi API, thanh toán, ký chứng từ, submit form, xử lý file nặng) bắt buộc phải Disable tức thì ngay cú click đầu tiên + hiển thị Loading spinner.
   - Duy trì khoảng nghỉ (cooldown/debounce) tối thiểu $\ge 1000\text{ms}$ giữa các thao tác để ngăn chặn người dùng hoặc mạng lag kích đúp gây trùng lặp giao dịch.
2. **Kỷ luật Runner & Test Automation:**
   - Cấm spam tạo workflow hoặc bắn request dồn dập làm nghẽn job queue và tràn rác CSDL.
   - Duy trì khoảng nghỉ tối thiểu giữa các lượt kiểm thử để hệ thống backend kịp đồng bộ trạng thái.

## 15. Giao Thức Điều Phối Dual-Agent (Leader PM ↔ Worker Sandbox Protocol)
1. **Phân tách trách nhiệm chuyên biệt:**
   - **Leader (PM / Architect):** Chuyên trách tư duy cấp cao — lập Game Design Document (GDD), Architecture Decision Records (ADR), kiểm soát Blast Radius, phân tích rủi ro và sinh test specification chi tiết.
   - **Worker (Coder / Implementer):** Nhận task độc lập, code trong môi trường sandbox với chính sách bất di bất dịch `commitPolicy: forbid`.
2. **Vòng lặp nghiệm thu 2 lớp (Two-Tier Handover Loop):**
   - Worker chỉ nộp kết quả thực thi kèm bằng chứng ảnh chụp (Visual Proof) và danh sách test đã pass.
   - Leader soi git diff độc lập, chạy lại cổng kiểm toán chất lượng (`postfix-gate`), và chỉ khi 100% tiêu chí đạt chuẩn mới thực hiện bàn giao hoặc commit.

## 16. Cơ Chế Tự Động Kích Hoạt Kỹ Năng (Autonomous Skill Execution — Zero Manual Effort)
1. **Quy tắc Tự Giác Kỹ Nghệ (Zero Manual Overhead):**
   - AI Agent BẮT BUỘC phải chủ động phân tích ngữ cảnh, yêu cầu và phạm vi ảnh hưởng của tác vụ để nạp và thực thi các Kỹ năng chuyên biệt (`skills/`) phù hợp.
   - TUYỆT ĐỐI KHÔNG bắt người dùng phải gõ lệnh slash command (như `/fix`, `/qc`, `/ocr`, `/giao`) hay chạy thủ công bằng tay.
2. **Tự Động Chuỗi Hóa Quy Trình (Autonomous Skill Chaining):**
   - **Mọi yêu cầu đầu vào (Prompt ngắn đời thường):** Bắt buộc chạy `context-enricher` (`./scripts/enrich_context.py`) để mở rộng 5 chiều (dò AST/Graph, nạp active profile, tra cứu bẫy instincts, tiêm yêu cầu ngầm định debounce/a11y/mainthread) trước khi viết dòng code đầu tiên.
   - **Khi sửa bug:** Tự động kết hợp `fixbugs` (Paired Executable Oracle RED ➔ GREEN) ➔ `observability-instrumentation` (log audit) ➔ `verification-before-completion`.
   - **Khi thiết kế / refactor:** Tự động kết hợp `grill-plan` (stress-test) ➔ `deep-module-design` (interface seam) / `deprecation-migration` ➔ `documentation-and-adrs` (ghi ADR).
   - **Khi làm việc với Android:** Tự động kích hoạt `android-real-device-qa` (đo FPS SurfaceFlinger, dump view hierarchy, ANR logcat triage, DEX scan).
   - **Khi điều phối Leader PM ↔ Worker:** Tự động kích hoạt `giao` (giao thức 7 giai đoạn có cổng nghiệm thu cứng).
   - **Trước khi hoàn tất:** Tự động chạy `open-code-review` và xuất báo cáo nghiệm thu 4 mục kèm ảnh chụp PASS.
3. **Bao Phủ Toàn Bộ 26 Kỹ Năng (100% Zero-Touch Automation):**
   - 100% kỹ năng trong bộ 26 skills (`skills/`) đã được quy định điều kiện kích hoạt tự động theo 6 giai đoạn vòng đời trong `AGENTS.md` Mục 8.2.
   - Senior Developer không cần phải ghi nhớ cú pháp slash command (`/cmd`), không cần can thiệp thủ công bất kỳ bước nào. Mọi rào chắn chất lượng, kiểm toán TIA hồi quy, đo đạc thiết bị thật, chụp ảnh nghiệm thu và xuất báo cáo B10 đều được hệ thống tự giác thực thi 100%.



