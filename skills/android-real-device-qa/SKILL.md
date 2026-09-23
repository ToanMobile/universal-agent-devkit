---
name: android-real-device-qa
description: Bộ công cụ kiểm thử chất lượng trên thiết bị Android thật hoặc máy ảo (emulator). Tự động kích hoạt khi kiểm thử trên Android, khi kết nối adb, đo FPS bề mặt (Jank/Stutter), trích xuất UI hierarchy XML để audit tọa độ/touch target, chẩn đoán ANR/crash logcat, quét method count DEX ngăn tràn 64K, và xuất báo cáo HTML kèm ảnh chụp thực tế. Tuyệt đối không tạo kết quả PASS ảo khi không có thiết bị thật online.
---

# Android Real-Device Quality Assurance (Thiết Bị Thật & Emulator)

Kỹ năng này cung cấp bộ công cụ đo lường và thẩm định chất lượng thực tế trên thiết bị Android vật lý hoặc máy ảo ADB.

## Nguyên Tắc Cốt Lõi
1. **Thiết bị thật là thẩm phán tối cao (Device as Single Source of Truth):** Kiểm thử trên JVM unit test không thể thay thế cho hành vi render, binder transaction, và bộ nhớ thực tế trên Android OS.
2. **Chống Xanh Rỗng (Anti-False-Green):** Bắt buộc kiểm tra `adb devices -l` trước khi chạy. Nếu không có thiết bị online, trạng thái kiểm thử thực nghiệm phải ghi `UNTESTED`, tuyệt đối cấm giả mạo PASS.
3. **Bảo tồn tài nguyên:** Thu dọn file tạm sau khi đo lường (kéo file XML/screenshot về máy trạm và dọn sạch trên `/sdcard/`).

---

## 🛠️ Bộ Công Cụ Thực Chiến

### 1. Đo Lường Khung Hình & FPS Thực Tế (`adb-fps-measure.sh`)
Đo độ mượt của giao diện (UI Jank / Frame Drop) trực tiếp qua `SurfaceFlinger` và `dumpsys gfxinfo`:
```bash
./profiles/android/scripts/qa/adb-fps-measure.sh <package_name> [duration_seconds]
```
- **Tiêu chuẩn nghiệm thu:** 
  - Khung hình trung bình $\ge 58\text{ FPS}$ (trên màn hình 60Hz) hoặc $\ge 115\text{ FPS}$ (trên màn hình 120Hz).
  - Janky frames $\le 5\%$ tổng số khung hình render trong suốt phiên đo.

### 2. Trích Xuất & Thẩm Định Phân Cấp Giao Diện (`dump-view-hierarchy.sh`)
Trích xuất cây UI dạng XML để kiểm tra cấu trúc layout và accessibility:
```bash
./profiles/android/scripts/qa/dump-view-hierarchy.sh [output_xml_path]
```
- **Tiêu chuẩn nghiệm thu:**
  - Touch Target: Mọi phần tử bấm được (`clickable="true"`) phải có kích thước tối thiểu $\ge 48\times 48\text{dp}$.
  - Content Description: Các nút biểu tượng (icon button) bắt buộc có `content-desc` phục vụ trợ năng.
  - Phân cấp View: Độ sâu view hierarchy không vượt quá 10 tầng lồng nhau để tránh tràn stack render.

### 3. Chẩn Đoán & Triage Lỗi ANR / Crash Logcat (`anr-logcat-triage.sh`)
Phân tích nguyên nhân đơ máy (Application Not Responding) hoặc crash đột ngột từ `/data/anr/traces.txt` và logcat:
```bash
./profiles/android/scripts/qa/anr-logcat-triage.sh <package_name>
```
- **Tiêu chuẩn nghiệm thu:**
  - Xác định chính xác luồng gây tắc nghẽn (Main Thread Starvation, Binder Lock Contention, hoặc Database Lock).
  - Trích xuất stack trace có cấu trúc, định vị chính xác `File.kt:Line` gây chặn luồng chính.

### 4. Quét Dung Lượng & Giới Hạn Bytecode DEX (`dexscan.py`)
Phân tích tệp APK/AAB hoặc thư mục build để kiểm tra method count:
```bash
python3 ./profiles/android/scripts/qa/dexscan.py <path_to_apk_or_dex>
```
- **Tiêu chuẩn nghiệm thu:**
  - Cảnh báo khi số lượng method trong single DEX vượt quá 60,000 (ngưỡng an toàn trước trần 65,536).
  - Phát hiện thư viện bên thứ ba phình to bất thường (Bloatware dependencies).

### 5. Xuất Báo Cáo Nghiệm Thu HTML Kèm Bằng Chứng (`generate_report_html.py`)
Tạo báo cáo kiểm thử độc lập, nhúng Base64 screenshot thực tế và bảng kết quả đo lường:
```bash
python3 ./profiles/android/scripts/qa/generate_report_html.py --output report.html --package <pkg>
```

---

## 🤖 Quy Trình Kích Hoạt Tự Động (Autonomous Execution)
Khi Agent làm việc trong dự án Android, Agent **TỰ ĐỘNG** thực hiện các bước sau mà **KHÔNG CẦN CHẠY TAY**:
1. Khi hoàn tất sửa lỗi liên quan đến UI/Animation/Scroll: Tự động chạy `adb-fps-measure.sh` để xác nhận không giật lag.
2. Khi sửa màn hình giao diện mới: Tự động chạy `dump-view-hierarchy.sh` để kiểm tra touch target $\ge 48\text{dp}$.
3. Khi điều tra bug crash hoặc ANR: Tự động chạy `anr-logcat-triage.sh` để bắt stack trace thật.
4. Khi chuẩn bị bàn giao: Tự động chạy `generate_report_html.py` để sinh báo cáo nghiệm thu có ảnh chụp thật từ thiết bị.
