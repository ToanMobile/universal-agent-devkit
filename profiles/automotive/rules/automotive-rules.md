# Automotive & IVI Specific Engineering Rules

## 1. Cô lập Luồng Dùng chung (Shared Flow Isolation)
- CẤM sửa trực tiếp logic mặc định trong `MediaKeyProxyService.kt`, `GoogleMapsNavigator.kt`, hoặc `CarAudioService.kt`.
- Khi sửa lỗi cho app cụ thể (VD: YouTube, Google Maps split-screen), bắt buộc bọc trong:
  ```kotlin
  if (isTargetPackage(packageName, TARGET_PACKAGE)) {
      // Logic riêng cho target app
  } else {
      // Luồng mặc định cho ứng dụng bên thứ 3 (Media, Radio, Navigation) giữ nguyên 100%
      super.handleEvent(event)
  }
  ```

## 2. Bảo tồn Rào chắn Phần cứng Bất biến
- CẤM xóa bỏ hoặc sửa đổi các điều kiện kiểm tra:
  - `Build.VERSION.SDK_INT <= 28`
  - `Build.MANUFACTURER.contains("GenericAutomotiveIVI")`
  - IVI Head-Unit & CAN hardware quirks
  - Timeout trễ CAN bus đã đo đạc trên phần cứng thật.

## 3. Quản lý Sự kiện & Tranh chấp Âm thanh
- Bắt buộc Debounce phím vô lăng $\ge 80\text{ms}$.
- Xử lý Audio Focus tranh chấp giữa Navigation và Media Player.
- Đảm bảo Touch Target trên màn hình IVI $\ge 48\times 48\text{dp}$.
