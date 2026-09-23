# Game 3D (Unity 6 & Blender) Specific Engineering Rules

## 1. Kiểm soát Bộ nhớ & Rò rỉ Event (C# / MonoBehaviour)
- Bắt buộc hủy đăng ký (unsubscribe) mọi C# Action, Event, và UnityEvent trong `OnDisable()` hoặc `OnDestroy()`.
- CẤM tạo rác bộ nhớ (GC allocations) trong các hàm chạy theo frame: `Update()`, `FixedUpdate()`, `LateUpdate()`.
  - Cấm dùng `new List<>()`, `LINQ` (`.Where()`, `.Select()`), boxing/unboxing, hoặc chuỗi string concatenation trong vòng lặp frame.
  - Sử dụng non-alloc physics APIs: `Physics.RaycastNonAlloc()`, `Physics.OverlapSphereNonAlloc()`.

## 2. Tối ưu Hóa Đồ họa & Rendering (DrawCalls)
- Giữ DrawCalls trong ngưỡng ngân sách thiết bị di động / runtime: $\le 100\text{ DrawCalls/frame}$.
- Chia tách UI Canvas động (thay đổi liên tục) và Canvas tĩnh (ít thay đổi) để tránh kích hoạt lại toàn bộ Canvas rebuild.
- Sử dụng Texture Atlasing và GPU Instancing cho các vật thể lặp lại (cây cỏ, chướng ngại vật).

## 3. Tiêu chuẩn Mô hình 3D Blender
- Mesh xuất khẩu cho game phải có cấu trúc Quad sạch, cấm Non-manifold edges, cấm mặt phẳng đảo ngược (Inverted Normals).
- Đảm bảo Texture resolution là lũy thừa của 2 (Power-of-Two: 512, 1024, 2048) để tối ưu nén GPU (ASTC/DXT).
- Xuất khẩu chuẩn format `.fbx` hoặc `.gltf` kèm LOD0, LOD1, LOD2 cho các asset có số đỉnh $\ge 5000\text{ tris}$.

## 4. Kỷ luật Quản trị Tài nguyên & Asset Database Unity (Unity Asset Hygiene)
- CẤM TUYỆT ĐỐI tự ý tạo các tệp tài liệu, ghi chú hoặc tệp tạm (`.md`, `.tmp`, `.bak`, `.log`, `.txt`) bên trong thư mục `Assets/`.
- Mọi tệp không thuộc runtime Unity phải được lưu tại `docs/` hoặc thư mục gốc dự án.
- Vi phạm quy tắc này sẽ làm Unity Editor tự động sinh file `.meta` rác, gây gãy GUID reference và xung đột Git.
- Hook kiểm toán tự động: `profiles/game/hooks/validate-assets.sh`.

## 5. Bot Gameplay Simulation Oracle (Bot Marathon Oracle)
- Đối với thuật toán sinh màn chơi (Level Generator), giải đố (Match-3), hoặc game logic phức tạp: Unit Test đơn lẻ là chưa đủ.
- BẮT BUỘC chạy kiểm chứng qua Simulation Bot (`profiles/game/scripts/unity-bot-marathon.sh`) chạy batchmode headless giải 100/100 màn chơi.
- Tiêu chí nghiệm thu: Chỉ số `[BOT-SUMMARY]` phải đạt tỷ lệ thắng $100\%$ và $0$ deadlocks trước khi bàn giao.

## 6. Ma trận Kiểm định Bố cục Đa Tỉ Lệ (Responsive A-Check Matrix)
- Giao diện UI game mobile bắt buộc kiểm định tự động ma trận A-Check 75/75 (A1 -> A5) trên 3 tỉ lệ màn hình thực tế:
  - Tỉ lệ 1: `16:9` (Thiết bị tiêu chuẩn, tablet).
  - Tỉ lệ 2: `19.5:9` (iPhone có Dynamic Island / notch).
  - Tỉ lệ 3: `20:9` (Android màn hình dài nốt ruồi).
- Phải quét trên 5 trạng thái giao diện chính (HUD, Settings Popup, Inventory Modal, Level Win Modal, Game Over Modal).
- Cấm tuyệt đối: Chữ tràn viền (overflow), đè vào Safe Area / notch tai thỏ, hoặc lệch Canvas scaler.

## 7. Headless GameView & Engine Visual Proof
- Kiểm thử UI/Game bắt buộc chụp ảnh GameView $1080\times 1920$ từ Engine để xác thực trạng thái hình ảnh thực tế (không chỉ tin vào exit code).
- Ngăn ngừa lỗi hiển thị (UI bị lệch, camera đâm tường, material bị màu hồng do lỗi shader).
