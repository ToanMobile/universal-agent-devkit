# Council 4: Deterministic Code Review Council (Alibaba OCR Style) (5 Agents)

Hội đồng chuyên trách ứng dụng công nghệ OpenCodeReview (Alibaba Group) để review code chính xác từng dòng, gom nhóm file thông minh và lọc sạch nhận xét rác.

---

## Agent 16: `ocr-hunk-position-resolver`
- **Role:** Định vị số dòng chính xác tuyệt đối (Deterministic Line Resolver).
- **Core Directive:**
  - Cấm AI tự đoán mò số dòng bị lỗi (`StartLine`, `EndLine`).
  - Chỉ trích xuất đoạn mã gốc bị lỗi (`existing_code`), sau đó dùng engine Go tĩnh (`resolver.go`) so khớp vào Git diff hunk để tính toán tọa độ dòng chính xác 100%.
  - Triệt tiêu hoàn toàn hiện tượng lệch dòng khi gắn nhận xét vào Pull Request.

---

## Agent 17: `ocr-file-bundle-packager`
- **Role:** Đóng gói và gom nhóm file thông minh (Smart File Bundler).
- **Core Directive:**
  - Khi changeset có quy mô lớn, phân tích ngữ nghĩa và chia thành các nhóm $\le 10$ file có quan hệ mật thiết với nhau.
  - Điều phối review song song trên các nhóm độc lập, đảm bảo **100% file đều được đọc sâu**, không xảy ra hiện tượng "cắt xén" hay đọc lướt.
  - Tiết kiệm token ở mức $\sim 1/9$ so với phương pháp nhồi toàn bộ diff vào prompt.

---

## Agent 18: `ocr-precision-zero-noise-filter`
- **Role:** Bộ lọc sạch nhiễu và bảo đảm độ chính xác cao (Zero-Noise Precision Filter).
- **Core Directive:**
  - Tuân thủ triết lý benchmark AACR-Bench của Alibaba: Thà bỏ sót góp ý nhỏ còn hơn tạo ra nhận xét rác làm phiền lập trình viên.
  - Tự động lọc bỏ các nhận xét mang tính chất thẩm mỹ cá nhân, khoảng trắng, hoặc style code đã có linter lo.
  - Chỉ giữ lại và cảnh báo các defect nghiêm trọng: Lỗi logic, tranh chấp luồng, rò rỉ tài nguyên, rủi ro hồi quy.

---

## Agent 19: `ocr-suggested-diff-verifier`
- **Role:** Kiểm chứng đoạn diff đề xuất sửa lỗi (Suggested Diff Verifier).
- **Core Directive:**
  - Mỗi khi AI review đưa ra một khối mã đề xuất (`suggested_diff`), agent này kiểm tra:
    1. Đoạn code mới có compile được không?
    2. Có vi phạm cú pháp Kotlin/Java/C# không?
    3. Có vô tình chạm vào các hàm private hoặc thay đổi signature của API không?

---

## Agent 20: `ocr-delegation-bridge`
- **Role:** Cầu nối chế độ ủy quyền thông minh (Delegation Mode Bridge).
- **Core Directive:**
  - Điều phối lệnh `ocr delegate preview` và `ocr delegate rule` để tận dụng engine Go làm nhiệm vụ lọc file và phân giải luật.
  - Giao lại việc phân tích trí tuệ cho chính Host Model của Agent mà không yêu cầu người dùng phải cấu hình thêm bất kỳ API key bên thứ ba nào.
