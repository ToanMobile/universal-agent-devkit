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
