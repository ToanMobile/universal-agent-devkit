---
name: qc
description: Chạy kiểm thử tự động, lint check (ktlint), unit tests, Metalava API check, Translation gate và QA release gates cho Target Project / Codebase.
---

# Quality Control (QC) & Automated Testing

Skill tự động hóa quy trình kiểm thử chất lượng, kiểm tra cú pháp code (linting), unit tests, tính tương thích API (Metalava), độ phủ bản dịch đa ngôn ngữ và chạy production QA gates cho dự án Target Project / Codebase.

## 1. Quick Verification (Module-scoped)

Chạy kiểm tra nhanh cho module đang chỉnh sửa trước khi commit:

```bash
# 1. Kiểm tra định dạng code (ktlint)
./gradlew :<module>:ktlintCheck

# 2. Biên dịch source và test source set
./gradlew :<module>:compileDebugKotlin :<module>:compileDebugUnitTestKotlin

# 3. Chạy unit tests của module (Kotest FunSpec / JUnit)
./gradlew :<module>:testDebugUnitTest --tests "*<TestClass>*"

# 4. Kiểm tra tương thích API Metalava (với các thư viện :libs:*)
./gradlew :libs:epub-reader:metalavaCheckCompatibilityRelease :libs:pdf-viewer:metalavaCheckCompatibilityRelease
```

## 2. Translation & Localization Verification

Đảm bảo mọi chuỗi giao diện mới có mặt đầy đủ ở toàn bộ 80 ngôn ngữ/locale, không bị thiếu hoặc fallback sai:

```bash
# Kiểm tra thiếu bản dịch (Fail-closed build gate)
./gradlew :core:common:checkMissingTranslations
```

## 3. Unit-Test Identity Contract Baseline

Xác thực tính liên tục của bộ test (không cho phép âm thầm xóa/bỏ qua test):

```bash
# Xác thực danh sách test của module khớp với baseline hợp đồng
python3 scripts/qa/ci/validate_unit_test_evidence.py validate \
  --module :<module> \
  --baseline scripts/qa/contracts/unit_test_identity_baseline.tsv \
  --results <module_path>/build/test-results/testDebugUnitTest
```

## 4. Project-wide Quality Checks

Chạy kiểm thử toàn bộ dự án:

```bash
# Chạy toàn bộ ktlint
./gradlew ktlintCheck

# Chạy toàn bộ unit test
./gradlew testDebugUnitTest

# Kiểm tra Detekt tĩnh
./gradlew detekt
```

## 5. Production Release QA Gate

Chạy production gate chính thức phục vụ release verification:

```bash
# Chạy orchestrator QA đầy đủ (mở dashboard + gate)
python3 scripts/qa/orchestrators/qa.py

# Hoặc xác minh các pre-release gates tự động
bash scripts/qa/ci/verify_prerelease_gates.sh
```

## 6. Quy chuẩn kết quả (Evidence Standards)

- **Proof of PASS**: Đọc trực tiếp từ file XML `<module>/build/test-results/**/TEST-*.xml`:
  `tests > 0` AND `failures = 0` AND `errors = 0`.
- **Cảnh báo**: Kết quả `UP-TO-DATE` hoặc `No tests found` (`total = 0`) **KHÔNG** được tính là PASS.
- Mọi lỗi fail phải được phân tích nguyên nhân gốc (Root Cause) trước khi sửa code.
