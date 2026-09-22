# Command: `/profile` (hoặc `/config`)

Chuyển đổi hoặc xem Profile cấu hình dự án đang kích hoạt trong Universal Agent DevKit:

## Cú pháp:
```bash
# Hiển thị menu tương tác chọn 1 trong 3 Option:
./bin/profile

# Hoặc chỉ định trực tiếp bằng cờ:
./bin/profile --profile automotive   # [1] 🚗 Xe hơi (AAOS / IVI / FlymeAuto / CAN bus)
./bin/profile --profile android      # [2] 📱 Android (FinOS eSign / Mobile / Jetpack)
./bin/profile --profile game         # [3] 🎮 Game (Unity 6 / Blender 3D / Shaders)

# Xem trạng thái profile hiện tại:
./bin/profile --status
```
