#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# testsourceset_gate.sh — Stop hook: compile the TEST source set of every module
# with uncommitted Kotlin/Java changes (kills "debug build green, CI red").
#
# Rationale (real P0, 2026-07-16): a constructor param was added to
# PermissionViewModel without updating its two `src/test` call sites.
# `:app:assembleDebug` and `:<module>:compileDebugKotlin` BOTH stayed green —
# neither compiles the unit-test source set — so the break was invisible until a
# fresh-context reviewer ran `compileDebugUnitTestKotlin` by hand. It had taken
# down StoragePermissionReleaseGateTest, i.e. the release gate. Prose rules did
# not prevent this (Deep Audit Loop already said "targeted module compile"); a
# command that actually runs does.
#
# BLOCK (exit 2) when: a touched module's `compileDebugUnitTestKotlin` fails.
# Skips entirely when there are no uncommitted .kt/.java changes.
#
# Cost: usually seconds — Gradle serves UP-TO-DATE when nothing in that source
# set moved. Escape hatch: TESTSOURCESET_GATE=0 to skip (logged).
#
# Loop-guard: MAX_ATTEMPTS then release with a warning, so a broken gate can
# never trap the session. Fail-open on internal error.
#
# Stop hook protocol: stdin JSON; exit 2 blocks (stderr→Claude); exit 0 allows.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"
LOG="${LOG_DIR}/testsourceset_gate.log"
ATTEMPTS_FILE="${LOG_DIR}/.testsourceset_attempts"
MAX_ATTEMPTS="${TESTSOURCESET_GATE_MAX_ATTEMPTS:-2}"
TS="$(date +%Y-%m-%dT%H:%M:%S)"

# Drain stdin so the caller never blocks on a full pipe.
cat >/dev/null 2>&1 || true

log() { printf '%s %s\n' "${TS}" "$*" >>"${LOG}" 2>/dev/null || true; }

if [ "${TESTSOURCESET_GATE:-1}" = "0" ]; then
  log "SKIP — disabled via TESTSOURCESET_GATE=0"
  exit 0
fi

cd "${REPO_ROOT}" 2>/dev/null || exit 0
[ -x ./gradlew ] || { log "SKIP — no ./gradlew"; exit 0; }

# Uncommitted .kt/.java, staged + unstaged + untracked.
CHANGED="$( { git diff --name-only --diff-filter=ACMR 2>/dev/null
              git diff --cached --name-only --diff-filter=ACMR 2>/dev/null
              git ls-files --others --exclude-standard 2>/dev/null
            } | grep -E '\.(kt|java)$' | grep -v '/build/' | sort -u )"

[ -n "${CHANGED}" ] || { log "PASS — no uncommitted Kotlin/Java changes"; exit 0; }

# Map each path to its Gradle module by walking up to the nearest build.gradle*.
MODULES=""
for f in ${CHANGED}; do
  d="$(dirname "${f}")"
  while [ "${d}" != "." ] && [ "${d}" != "/" ]; do
    if [ -f "${d}/build.gradle.kts" ] || [ -f "${d}/build.gradle" ]; then
      MODULES="${MODULES}
:$(printf '%s' "${d}" | tr '/' ':')"
      break
    fi
    d="$(dirname "${d}")"
  done
done
MODULES="$(printf '%s' "${MODULES}" | grep -v '^$' | sort -u)"

[ -n "${MODULES}" ] || { log "PASS — changed files map to no Gradle module"; exit 0; }

# Only modules that really expose the task (app/library modules do; others don't).
TASKS=""
for m in ${MODULES}; do
  case "${m}" in
    :build-logic*|:gradle*) continue ;;
  esac
  TASKS="${TASKS} ${m}:compileDebugUnitTestKotlin"
done
[ -n "${TASKS}" ] || { log "PASS — no compilable modules"; exit 0; }

OUT="$(./gradlew ${TASKS} --quiet 2>&1)"
RC=$?

if [ ${RC} -eq 0 ]; then
  log "PASS — ${TASKS}"
  rm -f "${ATTEMPTS_FILE}" 2>/dev/null || true
  exit 0
fi

# A module without the task is not a failure — treat "task not found" as skip.
if printf '%s' "${OUT}" | grep -q "not found in project"; then
  log "PASS — some modules lack compileDebugUnitTestKotlin; nothing else failed"
  rm -f "${ATTEMPTS_FILE}" 2>/dev/null || true
  exit 0
fi

# ── exit≠0 does NOT mean "the test source set is broken" ─────────────────────
# Gradle exits non-zero for daemon death, lock contention with a concurrent
# build, OOM, network/plugin resolution, or a harness timeout. Reporting those
# as "src/test vỡ" sends the reader hunting for a signature change that does not
# exist — and the old version also DISCARDED the output, so the real cause was
# unrecoverable. Measured 2026-07-27: this gate blocked with an empty error
# section while `compileDebugUnitTestKotlin` for the same five modules exited 0
# when re-run by hand.
# Classify before blaming, and always persist the raw output.
OUT_FILE="${LOG_DIR}/testsourceset_last_failure.txt"
printf '%s\n' "${OUT}" >"${OUT_FILE}" 2>/dev/null || true

if printf '%s' "${OUT}" | grep -qE '^e: |error:|Compilation error|compileDebugUnitTestKotlin.*FAILED'; then
  : # genuine compile failure — fall through to BLOCK below
else
  log "INFRA (rc=${RC}, không có dấu hiệu lỗi compile) — fail-open; output: ${OUT_FILE}"
  {
    echo "⚠️ TEST-SOURCESET GATE: gradle exit ${RC} nhưng KHÔNG có lỗi compile nào."
    echo "   Đây là hỏng hạ tầng (daemon/lock/OOM/network/timeout), KHÔNG phải src/test vỡ."
    echo "   Gate thả để không chặn nhầm. Output đầy đủ: ${OUT_FILE}"
    printf '%s\n' "${OUT}" | tail -8
  } >&2
  rm -f "${ATTEMPTS_FILE}" 2>/dev/null || true
  exit 0
fi

ATTEMPTS=0
[ -f "${ATTEMPTS_FILE}" ] && ATTEMPTS="$(cat "${ATTEMPTS_FILE}" 2>/dev/null || echo 0)"
ATTEMPTS=$((ATTEMPTS + 1))
printf '%s' "${ATTEMPTS}" >"${ATTEMPTS_FILE}" 2>/dev/null || true

if [ "${ATTEMPTS}" -gt "${MAX_ATTEMPTS}" ]; then
  log "RELEASE after ${ATTEMPTS} attempts — gate may be broken; letting Claude finish"
  rm -f "${ATTEMPTS_FILE}" 2>/dev/null || true
  exit 0
fi

# Name the real cause before blaming signature drift.
#
# An unresolved merge leaves `<<<<<<<` markers inside production sources, and Kotlin reports them as
# a wall of "Syntax error: Expecting an element" — nothing about it looks like a broken call site.
# Sending the reader to hunt for a changed parameter list then costs a full detour, and a gate that
# misnames the cause actively pushes people to edit the wrong file. Measured 2026-08-25: an external
# process merged a stale remote commit into trunk mid-session and this gate blamed signatures.
UNMERGED="$(git -C "${REPO_ROOT}" diff --name-only --diff-filter=U 2>/dev/null || true)"

log "BLOCK (attempt ${ATTEMPTS}) — ${TASKS}"
{
  echo "⛔ TEST-SOURCESET GATE: test source set không compile."
  echo ""
  if [ -n "${UNMERGED}" ]; then
    echo "NGUYÊN NHÂN: repo đang có MERGE CHƯA GIẢI QUYẾT. Dấu xung đột nằm trong source"
    echo "production, nên Kotlin báo hàng loạt lỗi cú pháp — KHÔNG phải call site trong src/test vỡ."
    echo ""
    echo "File chưa merge xong:"
    printf '%s\n' "${UNMERGED}" | sed 's/^/  • /' | head -15
    echo ""
    printf '%s\n' "${OUT}" | grep -E '^e: |error:' | head -8
    echo ""
    echo "Giải quyết merge TRƯỚC (hoặc \`git merge --abort\`) rồi chạy lại: ./gradlew${TASKS}"
    echo "CẤM sửa call site để né lỗi này — làm vậy là tự chọn một bên của merge mà không có quyền."
  else
    echo "Module tôi vừa sửa có call site trong src/test đang vỡ. \`assembleDebug\`"
    echo "và \`compileDebugKotlin\` KHÔNG compile test source set nên chúng vẫn xanh —"
    echo "chỉ CI/release gate mới đỏ. Đây là P0 thật đã xảy ra 2026-07-16."
    echo ""
    printf '%s\n' "${OUT}" | grep -E '^e: |error:' | head -15
    echo ""
    echo "Sửa call site trong src/test (thường do đổi signature: thêm/bớt/đổi thứ tự param),"
    echo "rồi chạy lại: ./gradlew${TASKS}"
  fi
} >&2
exit 2
