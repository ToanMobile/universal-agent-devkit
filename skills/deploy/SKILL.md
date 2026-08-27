---
name: deploy
description: Quy trình build, đóng gói APK/AAB, kiểm tra signing và chuẩn bị release cho OfficeReader.
---

# Build & Deployment Pipeline

Skill hướng dẫn và tự động hóa quy trình build artifact (APK/AAB), kiểm tra chữ ký (signing), xác minh ProGuard/R8 mappings và chuẩn bị deployment cho OfficeReader.

## 1. Pre-build Verification

Trước khi thực hiện build hoặc deploy:
1. Đảm bảo toàn bộ unit tests và ktlint đã pass (`./gradlew ktlintCheck testDebugUnitTest`).
2. Xác nhận working tree không có uncommitted dirty code nằm ngoài phạm vi release.
3. Không có secrets hoặc test credentials bị hardcode trong source.

## 2. Build Assembly Commands

```bash
# 1. Build Debug APK (cho thử nghiệm local / QA device testing)
./gradlew assembleDebug

# 2. Build Release APK (chứa ProGuard/R8 optimization)
./gradlew assembleRelease

# 3. Build Android App Bundle (AAB - dùng publish lên Google Play)
./gradlew bundleRelease
```

## 3. Artifact Verification & Inspection

Sau khi build thành công, kiểm tra các output artifacts:

- **Debug APK**: `app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `app/build/outputs/apk/release/app-release.apk`
- **Release AAB**: `app/build/outputs/bundle/release/app-release.aab`
- **ProGuard / R8 Mapping**: `app/build/outputs/mapping/release/mapping.txt`

## 4. Pre-release Security & Gate Verification

```bash
# Xác thực toàn bộ pre-release security & compatibility gates
bash scripts/qa/ci/verify_prerelease_gates.sh
```

> [!CAUTION]
> **Quy tắc an toàn bất khả xâm phạm:**
> Tuyệt đối **KHÔNG** tự ý `git commit`, `git push`, publish lên store hay triển khai release môi trường production mà không có sự phê duyệt và yêu cầu trực tiếp từ User.
