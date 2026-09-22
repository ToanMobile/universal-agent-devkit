# Automotive Hardware & IVI Domain Pack

Domain pack chuyên biệt dành riêng cho các dự án **Android Automotive OS (AAOS), IVI, Flyme Auto, ECARX và CAN Bus**.

> **Kiến trúc Modular:**
> Gói này được tách biệt hoàn toàn khỏi lõi `universal-agent-devkit` để đảm bảo DevKit luôn mang tính phổ quát (domain-agnostic). Khi bạn làm việc trên dự án xe hơi độc lập, chỉ cần sao chép hoặc liên kết gói này vào thư mục cấu hình agent của repo xe hơi.

---

## 1. Cách tích hợp vào Dự án Xe hơi

### Cách 1: Tạo Symlink vào Repo Xe hơi
```bash
# Đứng tại thư mục gốc của repo Android Automotive / IVI:
mkdir -p .agents/councils
ln -s /path/to/universal-agent-devkit/domain-packs/automotive/councils/* .agents/councils/
```

### Cách 2: Copy trực tiếp vào Repo Xe hơi
```bash
cp -r /path/to/universal-agent-devkit/domain-packs/automotive/councils/ path/to/your-car-project/.agents/councils/
```

---

## 2. Các Hội Đồng Chuyên Sâu (Automotive Councils)

- **`01-automotive-hardware.md`**:
  - `automotive-shared-flow-auditor`: Cô lập luồng dùng chung trong `MediaKeyProxyService.kt`, `GoogleMapsNavigator.kt`.
  - `automotive-guard-preserver`: Bảo vệ tuyệt đối các guard `Build.VERSION.SDK_INT <= 28`, `FlymeAuto`, `ECARX`.
  - `automotive-mediasession-auditor`: Kiểm soát tranh chấp MediaSession & Audio Focus giữa các app nghe nhạc/bản đồ.
  - `automotive-keyevent-dispatcher-auditor`: Debounce phím vô lăng cứng (Next, Prev, Voice), cấm nuốt phím SOS/Volume.
  - `automotive-splitscreen-auditor`: Đảm bảo giao diện không vỡ khi chia đôi màn hình 50/50 hoặc 70/30 trên IVI.

- **`02-automotive-compliance.md`**:
  - `aspice-traceability-auditor`: Truy vết yêu cầu 1-1 theo chuẩn ASPICE / ISO 26262.
  - `can-bus-protocol-auditor`: Kiểm tra đóng gói & giải mã CAN frame (checksum, payload, timeout buffer).
  - `distraction-hmi-safety-auditor`: Chuẩn an toàn HMI tránh phân tâm tài xế (NHTSA / ECE R130, touch target $\ge 48\text{dp}$).
  - `offline-resilience-auditor`: Xử lý ngoại tuyến khi xe vào hầm đỗ xe ngầm, mất sóng GPS/4G.
  - `pr-lead-handover-auditor`: Bàn giao PR chuẩn Conventional Commits cho Tech Lead kèm ảnh nghiệm thu.
