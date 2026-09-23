# Voice & Audio AI Assistant Specific Engineering Rules

## 1. Triết Lý Tối Thượng: "Graceful Silence over Wrong Execution"
- Hệ thống trợ lý giọng nói **thà IM LẶNG còn hơn LÀM SAI**:
  - Khi điểm tin cậy nhận diện (Intent Confidence Score) $< 0.85$, hoặc âm thanh bị nhiễu không chắc chắn, hệ thống BẮT BUỘC:
    1. Yêu cầu người dùng xác nhận lại bằng câu hỏi ngắn gọn ("Tôi chưa nghe rõ, bạn có thể nhắc lại không?"), hoặc
    2. Giữ im lặng văn minh nếu là lệnh gọi bâng quơ không kèm Wake-Word.
  - Tuyệt đối CẤM tự ý thực thi các tác vụ nguy hiểm (mở cửa, thanh toán, gọi điện, gửi tin nhắn, thay đổi thiết lập hệ thống) khi chưa đạt độ tin cậy tuyệt đối.

## 2. Quy Chuẩn Kiểm Thử Âm Thanh 2 Tầng (2-Tier Audio Verification)
- **Tầng 1 — Kiểm thử Cú pháp & Ngữ nghĩa (Semantic Intent Gate):**
  - Chạy bộ unit tests kiểm tra 100% các biến thể ngữ nghĩa, từ đồng nghĩa, phương ngữ và ngữ cảnh hội thoại.
- **Tầng 2 — Kiểm thử Đối chứng Mẫu Âm thanh Thực tế (Acoustic WAV Benchmark):**
  - Bắt buộc kiểm chứng mô hình trên tập mẫu âm thanh WAV thực tế được thu từ micro thiết bị thật.
  - Kiểm tra tỷ lệ lỗi từ (Word Error Rate — WER $\le 5\%$) trong các môi trường nhiễu khác nhau (tiếng ồn quán cafe, xe chạy trên đường, nhạc nền $SNR \ge 10\text{dB}$).

## 3. Quản Trị Độ Trễ Phát Hiện & Streaming (Streaming Latency Standard)
- Thời gian từ khi người dùng kết thúc câu nói (End-of-Speech / VAD silence detected) đến khi trợ lý phát tín hiệu phản hồi đầu tiên: $\le 300\text{ms}$.
- Sử dụng Ring Buffer âm thanh trượt (Circular Audio Buffer) với kích thước cố định; giải phóng tức thì các đoạn audio đã xử lý xong để chống rò rỉ RAM (Memory Leak).

## 4. Xử Lý Tiếng Vọng & Tranh Chấp Âm Thanh (AEC & Audio Focus)
- Bắt buộc kích hoạt Bộ khử tiếng vọng âm học (Acoustic Echo Cancellation — AEC) khi hệ thống vừa phát âm thanh ra loa vừa lắng nghe micro.
- Nhả quyền chiếm dụng Micro (AudioRecord / MediaRecorder) ngay khi mất Audio Focus hoặc ứng dụng chuyển về trạng thái background.
