#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test_evidence_gate.sh — Stop hook: CLAUDE.md `check 2` + `6.4`.
#
# Closes the hole `claim_check.sh` documents but does not cover: its Check B only
# LOGS "test pass" phrases and defers to "the gradle Stop gate" for the real
# verification. That gate did not exist. This is it.
#
# ── check 2: a test-PASS claim must match the XML ──
# BLOCK when the final message claims tests pass and the counts in
# `**/build/test-results/**/TEST-*.xml` (unit tests) or
# `**/build/outputs/androidTest-results/connected/**/TEST-*.xml` (instrumented)
# do not back it:
#   • no XML at all                          → the tests never ran
#   • every XML older than the last code edit → the run predates the code
#   • tests == 0                             → nothing executed
#   • failures > 0 or errors > 0             → not a pass
#   • skipped > 0 not mentioned in the message → a skip is not a pass
#
# ── 6.4: two failed fixes on the same root cause ──
# Proxy, since "root cause" has no machine definition: the SAME testcase id
# (classname#name) failing across two distinct test RUNS, with code edited in
# between. Two attempts, same test still red = two failed fixes at the same
# thing. State per session in audit-gate/failcycle_<session>.json.
#
# WHAT THIS CANNOT DO — do not read more into a pass than this:
#   • RED-check (`check 2` mutation testing). Nothing here proves a green test
#     would go red without the fix. A green run with no paired red is still
#     BLOCKED by the rule, and only you can honour that.
#   • Whether the tests that ran are the ones covering your change: it compares
#     timestamps and counts, not coverage of the diff.
#   • Host-attest `check 7`. It only recognizes a scoped structured workflow
#     result; the real executable/runtime receipts remain the main `/fix` duty.
#   • Understand every natural-language paraphrase. The vocabulary classifier is
#     best-effort; a message not blocked here is NOT evidence that its claim is
#     true. The no-fabrication and paired-oracle rules remain authoritative.
#
# Escape hatch: TEST_EVIDENCE_GATE=0 (logged). Fail-open on internal error.
# Stop hook protocol: stdin JSON; exit 2 blocks (stderr→Claude); exit 0 allows.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"

INPUT="$(cat)"

[ "${TEST_EVIDENCE_GATE:-1}" = "0" ] && exit 0

TE_INPUT="${INPUT}" TE_LOG="${LOG_DIR}/test_evidence_gate.log" TE_DIR="${LOG_DIR}" \
TE_TS="$(date +%Y-%m-%dT%H:%M:%S)" TE_REPO="${REPO_ROOT}" \
python3 <<'PY'
import os, sys, json, re, glob, time
import xml.etree.ElementTree as ET

raw    = os.environ.get("TE_INPUT", "")
log    = os.environ.get("TE_LOG", "/dev/null")
state_dir = os.environ.get("TE_DIR", "/tmp")
ts     = os.environ.get("TE_TS", "?")
repo   = os.environ.get("TE_REPO", ".")

def logline(s):
    try:
        with open(log, "a") as fh:
            fh.write(s + "\n")
    except Exception:
        pass

try:
    d = json.loads(raw)
except Exception as e:
    logline(f"[{ts}] stdin parse fail: {e!r} — fail-open")
    sys.exit(0)

if d.get("stop_hook_active"):
    sys.exit(0)

msg = d.get("last_assistant_message")
if not isinstance(msg, str):
    msg = ""

# ── is there a test-PASS claim? (cheap, decided BEFORE any XML parsing) ─────
# Keep quoted/inline-code text in the classification view: typography cannot
# turn `Result: "12/12 tests passed"` or ``Status: `fixed` `` into a bypass.
# Explicit prohibition/plan/metalinguistic grammar below exempts non-claims.
# The binding view removes delimiters but keeps identifiers/hashes available.
scan = re.sub(r"```.*?```", " ", msg, flags=re.DOTALL)
scan = scan.replace("**", "")
binding_scan = re.sub(r"[`\"“”]", "", scan)
# A dot inside a symbol/key (`logic.wrong_branch`) is not a sentence boundary.
# Split terminal punctuation only when it is followed by whitespace/end.
sentences = re.split(r"(?:\n|[!?](?=\s|$)|\.(?=\s|$))", scan)
binding_sentences = re.split(r"(?:\n|[!?](?=\s|$)|\.(?=\s|$))", binding_scan)

CLAIM = re.compile(
    r"(test[^.\n]{0,24}(?:pass|xanh|green|thành công)"
    r"|(?:pass|xanh|green)[^.\n]{0,24}test"
    r"|\d+\s*/\s*\d+\s+test"
    r"|tests?\s+passed"
    r"|(?:toàn\s+bộ|tất\s+cả)\s+(?:kiểm\s+thử|tests?)[^.\n]{0,16}(?:đều\s+)?đạt)", re.I)
# A PROHIBITION is not a result. Quoting the rule it enforces ("cấm sửa test cho
# xanh", "đừng gọi là pass") puts the trigger words in the sentence with the
# meaning inverted, and bold `**…**` is not scrubbed the way backticks/quotes are.
# Measured 2026-07-28: this gate blocked a documentation-audit response whose only
# match was the phrase `test cho xanh` inside `**cấm sửa test cho xanh**` — zero
# test claims in the whole message. Positional as with the other markers, so a
# prohibition AFTER a real claim ("Test pass 6/6, cấm sửa test cho xanh") still fires.
# `chạy lại` was in this list and let a REAL claim through: "Đã chạy lại, 12/12
# test pass" disarmed itself, because the marker sits before the claim and the
# check is positional. Past tense is an assertion, not a hypothesis. Removed
# 2026-07-28 — the advice forms it was meant to cover ("cần chạy lại test",
# "nên chạy lại") already carry cần/nên, and "chạy lại test thì pass" is caught
# by the trailing-`thì` rule.
GOVERNING_PREFIX = re.compile(
    r"(?:\b(?:nếu|if|giả sử|khi)\s*$"
    r"|\b(?:cấm|đừng|không được|never|must not)\s+(?:(?:nói|viết|gọi|claim|sửa)\s+)?$"
    r"|\bkhông được đoán và nói\s*$)",
    re.I,
)
TEST_GUIDANCE_PREFIX = re.compile(
    r"(?:\b(?:nên|cần)\s+(?:chạy lại\s+)?$|\bshould\s+(?:rerun\s+)?$)",
    re.I,
)
OUTCOME_GUIDANCE_PREFIX = re.compile(
    r"\b(?:nên|cần)\s+(?:được\s+)?$|\b(?:should|must)\s+(?:be\s+)?$",
    re.I,
)
PLAN_PREFIX = re.compile(r"^\s*(?:verify\s*(?::|that\b)|acceptance\s*:)", re.I)
VERIFY_PREFIX = re.compile(r"\bverify\s*:\s*$", re.I)
META_QUOTE_PREFIX = re.compile(
    r"\b(?:cụm(?:\s+từ)?|chuỗi|từ\s+khóa|ví\s+dụ)\s*$",
    re.I,
)
def is_nonassertive(sentence, match, kind):
    """Only explicit grammar may exempt a matched result/outcome phrase.

    Default is ASSERTION. Generic `chưa/không/thì` elsewhere in the sentence
    cannot erase an independent claim.
    """
    prefix = re.sub(r"[`\"“”]", "", sentence[:match.start()])
    matched_text = match.group(0)
    if GOVERNING_PREFIX.search(prefix):
        return True
    plan_prefix = PLAN_PREFIX.search(sentence)
    plan_boundary = None
    if plan_prefix:
        boundary = re.search(
            r"[,;—–]|\s-\s|\n|\b(?:and\s+in\s+fact|và\s+thực\s+tế"
            r"|nhưng|but|tuy\s+nhiên|song|mà|rồi)\b",
            sentence[plan_prefix.end():],
            re.I,
        )
        if boundary:
            plan_boundary = plan_prefix.end() + boundary.start()
    if ((plan_prefix and (plan_boundary is None or match.start() < plan_boundary))
            or VERIFY_PREFIX.search(prefix)):
        return True
    if META_QUOTE_PREFIX.search(prefix):
        return True
    if kind == "test":
        suffix = sentence[match.end():]
        return bool(
            TEST_GUIDANCE_PREFIX.search(prefix)
            or re.search(r"\b(?:should|must)\b", matched_text, re.I)
            or (
                sentence.lstrip().lower().startswith("test")
                and re.match(r"\s+thì\b", suffix, re.I)
            )
            # "RED" joined directly by "/" or "-" to the match (the compound
            # "RED/GREEN test" this rulebook's own vocabulary uses for the TDD
            # cycle name) is not an assertion that green/pass happened. Measured
            # 2026-07-31: "không thể chạy RED/GREEN test" (an incapacity claim)
            # false-positived because GOVERNING_PREFIX's negation words require
            # zero-gap adjacency to the match, and "RED/" sits in that gap.
            # MUST stay this narrow (literal "red" + "/" or "-", zero gap) —
            # an 8-char free-form window was tried first and adversarial-tested
            # 2026-07-31 to falsely exempt genuine claims: "RED test giờ pass
            # 12/12", "RED test bây giờ green hết" (a real named RED-suffixed
            # test — e.g. DOCXBidiMetadataRedTest — actually passing is exactly
            # the claim this gate must catch). Do not widen the join character
            # class or the gap without re-running that adversarial set.
            or bool(re.search(r"\bred[/-]\s*$", prefix, re.I))
        )
    return bool(OUTCOME_GUIDANCE_PREFIX.search(prefix))

claimed = False
for sent in sentences:
    for m in CLAIM.finditer(sent):
        if is_nonassertive(sent, m, "test"):
            continue
        claimed = True
        break
    if claimed:
        break

# An outcome claim is separate from a test-pass claim. This must be classified
# before the cheap early exit below; otherwise plain "đã fix bug" bypasses the
# entire outcome-evidence check when no new XML exists.
OUTCOME = re.compile(
    r"(đã\s+fix\b|đã\s+sửa\s+xong|đã\s+(?:được\s+)?sửa\s+(?:xong\s+)?(?:bug|lỗi)"
    r"|(?:bug|lỗi)[^.\n]{0,32}đã\s+(?:được\s+)?sửa\b"
    r"|đã\s+khắc\s+phục|đã\s+xử\s+lý"
    r"|đã\s+giải\s+quyết(?:\s+xong)?|hết\s+bug"
    r"|(?:the\s+)?fix\s+(?:works?|worked|has\s+worked|(?:đã\s+)?có\s+tác\s+dụng)"
    r"|bug\s+đã\s+(?:được\s+)?fix|(?:lỗi|bug)[^.\n]{0,48}không\s+(?:còn\s+)?tái\s+hiện(?:\s+nữa)?"
    r"|\bfixed\b|\bresolved\b)", re.I)

outcome_claims = []
for sent_idx, sent in enumerate(sentences):
    bound_sent = binding_sentences[sent_idx] if sent_idx < len(binding_sentences) else sent
    clauses = re.split(r";", sent)
    bound_clauses = re.split(r";", bound_sent)
    sentence_start = len(outcome_claims)
    for clause_idx, clause in enumerate(clauses):
        bound_clause = bound_clauses[clause_idx] if clause_idx < len(bound_clauses) else clause
        matches = []
        for m in OUTCOME.finditer(clause):
            if is_nonassertive(clause, m, "outcome"):
                continue
            matches.append(m)
        for _ in matches:
            # A pending/residual marker does not erase a definite outcome claim
            # in the same or a neighbouring clause. Every occurrence remains a
            # separately authorized claim.
            outcome_claims.append({
                "clause": bound_clause,
                "sentence": bound_sent,
                "occurrences": len(matches),
            })
    sentence_occurrences = len(outcome_claims) - sentence_start
    for claim in outcome_claims[sentence_start:]:
        claim["sentenceOccurrences"] = sentence_occurrences
outcome_claimed = bool(outcome_claims)

# ── collect XML evidence ────────────────────────────────────────────────────
# stat is cheap, ET.parse is not: this runs on EVERY Stop, and a gate that taxes
# every turn for nothing is the fastest way to get itself switched off. Measured
# 2026-07-27: parsing all 157 suites unconditionally cost ~1.0s per Stop.
# So: stat everything, parse only the subset a live question depends on.
# Bounded globs, NOT `**` recursive: a recursive walk of the whole repo costs
# ~1s per Stop here because it descends every build/ and .gradle/ tree. Gradle
# modules in this project sit at depth 1 (`app/`) or 2 (`core/analytics/`), so
# two fixed-depth patterns cover them and cost milliseconds. Add a depth-3
# pattern here if a module is ever nested deeper.
xmls = []
for pat in ("*/build/test-results/*/TEST-*.xml",
            "*/*/build/test-results/*/TEST-*.xml",
            "*/*/*/build/test-results/*/TEST-*.xml",
            # connectedAndroidTest writes to build/outputs/androidTest-results/,
            # NOT build/test-results/. Without these three the gate is blind to
            # every instrumented run — the exact oracle the release QA lane
            # depends on — and blocks device-backed claims as "never ran".
            # Measured 2026-08-07: a green run at
            # app/build/outputs/androidTest-results/connected/release/TEST-*.xml
            # matched none of the patterns above.
            "*/build/outputs/androidTest-results/connected/TEST-*.xml",
            "*/build/outputs/androidTest-results/connected/*/TEST-*.xml",
            "*/*/build/outputs/androidTest-results/connected/*/TEST-*.xml"):
    xmls.extend(glob.glob(os.path.join(repo, pat)))
mtimes = {}
for p in xmls:
    try:
        mtimes[p] = os.path.getmtime(p)
    except Exception:
        pass

def parse_suites(path):
    """One dict per <testsuite> in the file; [] if the file is not test results.

    Gradle unit-test XML puts <testsuite> at the ROOT. connectedAndroidTest
    wraps one or more suites in a <testsuites> root instead. Until 2026-08-07
    this returned None for anything but a bare <testsuite>, so every
    instrumented run parsed to nothing and the gate reported "tests never ran"
    for device-backed claims — measured against a real green run whose root was
    <testsuites tests="1" failures="0" errors="0" skipped="0">.

    Counts are read PER SUITE, never from the <testsuites> wrapper, so the
    per-suite scoping below (red inside vs outside the touched module) keeps
    working: a wrapper total cannot be attributed to a module.
    """
    try:
        root = ET.parse(path).getroot()
        mtime = os.path.getmtime(path)
    except Exception:
        return []
    if root.tag == "testsuite":
        nodes = [root]
    elif root.tag == "testsuites":
        nodes = list(root.findall("testsuite"))
    else:
        return []
    out = []
    for node in nodes:
        failing = []
        for tc in node.iter("testcase"):
            if tc.find("failure") is not None or tc.find("error") is not None:
                failing.append(f"{tc.attrib.get('classname','?')}#{tc.attrib.get('name','?')}")
        def g(k, _n=node):
            return int(_n.attrib.get(k, "0") or 0)
        out.append({
            "path": path, "mtime": mtime,
            "name": node.attrib.get("name", ""),
            "tests": g("tests"), "failures": g("failures"),
            "errors": g("errors"), "skipped": g("skipped"),
            "failing": failing,
        })
    return out

# ── load 6.4 state, decide whether anything needs parsing at all ────────────
sid = re.sub(r"[^A-Za-z0-9_-]", "_", str(d.get("session_id", "default")))[:64] or "default"
state_path = os.path.join(state_dir, f"failcycle_{sid}.json")
state = {"last_run": 0.0, "streak": {}}
try:
    if os.path.exists(state_path):
        state.update(json.load(open(state_path)))
except Exception:
    pass

newest = max(mtimes.values(), default=0.0)
new_run = newest > state.get("last_run", 0.0)

if not claimed and not outcome_claimed and not new_run:
    logline(f"[{ts}] no test claim, no new run ({len(mtimes)} xml) — pass")
    sys.exit(0)

# ── one transcript pass: edits, RED history, structured scoped proof ─────────
last_edit_mtime = 0.0
authored_tests = {}      # simple class name -> mtime of that test file
touched_modules = set()  # module roots ("core/data") holding a .kt/.java edited this session
structured_fix_proofs = []
blk_idx = 0
tool_uses = {}
tool_results = {}
no_id_tool_indices = []
test_edit_idx = {}       # simple class name -> transcript position of its last edit
red_idx = {}             # suite name -> transcript position where it was seen RED
# Per test file, a LIFO stack of edits not yet undone, and the test_edit_idx value each one
# displaced. Used to recognise a mutate/restore pair — see the rollback below.
pending_edits = {}       # file path -> [(old_string, new_string), ...]
edit_idx_before = {}     # file path -> [test_edit_idx value in force before that edit, ...]

# A full RED→GREEN cycle inside ONE turn is invisible to the Stop-time snapshot:
# the green run overwrites the red XML before any Stop happens, so the gate
# accuses the person who did the RED-check properly of never having done one
# (measured 2026-07-27 — it blocked exactly that). The evidence is still in the
# transcript though: the failing run was printed there. Read it from that side too.
#
# The negated classes exclude \n on purpose. A <testsuite> tag is one line, but
# [^>] matches newlines, so on a block holding SEVERAL suites the greedy run
# crossed line boundaries and backtracked to the LAST name= in the block — every
# suite but the final one was silently dropped. Measured 2026-07-28: a RED-check
# that printed two failing suites in one tool_result registered only the second,
# and the gate accused the first of never having been red.
RED_XML = re.compile(r'<testsuite[^>\n]*name="([^"\n]+)"[^>\n]*(?:failures|errors)="([1-9]\d*)"')
RED_XML2 = re.compile(r'<testsuite[^>\n]*(?:failures|errors)="([1-9]\d*)"[^>\n]*name="([^"\n]+)"')
RED_GRADLE = re.compile(r'([\w.]*\b\w*Test)\b[^\n]{0,80}\bFAILED\b')

def canonical_workflow_script(value):
    if not isinstance(value, str) or not value:
        return False
    candidate = value if os.path.isabs(value) else os.path.join(repo, value)
    expected = os.path.join(repo, ".claude", "workflows", "multi-lens-audit.js")
    return os.path.realpath(candidate) == os.path.realpath(expected)

def workflow_producer(use):
    if not use or use["name"] != "Workflow":
        return False
    inp = use["input"]
    if "name" in inp and inp.get("name") != "multi-lens-audit":
        return False
    if "script" in inp and not canonical_workflow_script(inp.get("script")):
        return False
    return inp.get("name") == "multi-lens-audit" or canonical_workflow_script(inp.get("script"))

tp = d.get("transcript_path")
if tp and os.path.exists(tp):
    try:
        with open(tp) as fh:
            for rawline in fh:
                rawline = rawline.strip()
                if not rawline:
                    continue
                try:
                    rec = json.loads(rawline)
                except Exception:
                    continue
                content = (rec.get("message") or {}).get("content")
                if not isinstance(content, list):
                    continue
                for blk in content:
                    if not isinstance(blk, dict):
                        continue
                    blk_idx += 1
                    if blk.get("type") == "tool_result":
                        c = blk.get("content")
                        if isinstance(c, str):
                            txt = c
                        elif isinstance(c, list):
                            txt = "\n".join(
                                part.get("text", "")
                                for part in c
                                if isinstance(part, dict) and isinstance(part.get("text"), str)
                            )
                        else:
                            txt = json.dumps(c, ensure_ascii=False)
                        try:
                            proof = json.loads(txt)
                        except Exception:
                            proof = None
                        use = tool_uses.get(blk.get("tool_use_id"))
                        result_id = blk.get("tool_use_id")
                        if isinstance(result_id, str):
                            tool_results[result_id] = {
                                "index": blk_idx,
                                "isError": blk.get("is_error") is True,
                            }
                        producer_ok = bool(
                            use
                            and (
                                workflow_producer(use)
                                or
                                (use["name"] == "Skill"
                                 and use["input"].get("skill") == "multi-lens-audit")
                            )
                        )
                        if (producer_ok
                                and blk.get("is_error") is not True
                                and isinstance(proof, dict)
                                and proof.get("schemaVersion") == 3
                                and proof.get("auditVerdict") == "CLEAR"
                                and proof.get("terminalRecommendation") == "AUDIT_CLEAR_NEEDS_EXTERNAL_GATES"
                                and proof.get("verificationVerdict") == "ASSERTED_ONLY"
                                and isinstance(proof.get("runId"), str)
                                and len(proof["runId"]) > 0
                                and isinstance(proof.get("runNonce"), str)
                                and len(proof["runNonce"]) > 0
                                and isinstance(proof.get("fixedKeys"), list)
                                and len(proof["fixedKeys"]) > 0
                                and all(isinstance(key, str) and key for key in proof["fixedKeys"])
                                and re.fullmatch(r"sha256:[0-9a-f]{64}", str(proof.get("scopeFingerprint", "")))
                                and re.fullmatch(r"sha256:[0-9a-f]{64}", str(proof.get("currentId", "")))
                                and re.fullmatch(r"sha256:[0-9a-f]{64}", str(proof.get("contentHash", "")))):
                            structured_fix_proofs.append({
                                "index": blk_idx,
                                "useIndex": use["index"],
                                "toolUseId": result_id,
                                "fixedKeys": proof["fixedKeys"],
                                "scopeFingerprint": proof["scopeFingerprint"],
                                "currentId": proof["currentId"],
                                "contentHash": proof["contentHash"],
                            })
                        for m in RED_XML.finditer(txt):
                            red_idx[m.group(1)] = blk_idx
                        for m in RED_XML2.finditer(txt):
                            red_idx[m.group(2)] = blk_idx
                        for m in RED_GRADLE.finditer(txt):
                            red_idx[m.group(1)] = blk_idx
                        continue
                    if blk.get("type") != "tool_use":
                        continue
                    nm = blk.get("name", "")
                    binp = blk.get("input") or {}
                    use_id = blk.get("id")
                    if isinstance(use_id, str) and isinstance(binp, dict):
                        tool_uses[use_id] = {"name": nm, "input": binp, "index": blk_idx}
                    elif not isinstance(use_id, str):
                        # With no correlation id there is no later result that
                        # can prove failure. Treat the tool as successful/unknown
                        # so a prior proof cannot authorize a later outcome.
                        no_id_tool_indices.append(blk_idx)
                    if nm not in ("Edit", "Write", "NotebookEdit"):
                        continue
                    fp = binp.get("file_path") or ""
                    if not (isinstance(fp, str) and fp.endswith((".kt", ".java")) and os.path.exists(fp)):
                        continue
                    mt = os.path.getmtime(fp)
                    last_edit_mtime = max(last_edit_mtime, mt)
                    # Module root of the edited file, so a red suite somewhere else in the
                    # repo cannot veto a truthful claim about the module actually touched.
                    rel = os.path.relpath(fp, repo)
                    if "/src/" in rel:
                        touched_modules.add(rel.split("/src/")[0])
                    if "/src/test/" in fp or "/src/androidTest/" in fp:
                        cls = os.path.basename(fp).rsplit(".", 1)[0]
                        authored_tests[cls] = max(authored_tests.get(cls, 0.0), mt)
                        # A mutate/restore pair must not expire the red it exists to produce.
                        # check 2's RED-check REQUIRES mutating a load-bearing line, running it red,
                        # then putting the line back — so the restore is ALWAYS the last edit, and
                        # counting it moved the expiry marker past the red every time. The better
                        # someone followed the protocol, the surer this gate was to reject them
                        # (measured 2026-08-09: it rejected a fix whose mutant had just gone red
                        # 3 runs out of 4). When an edit is the EXACT inverse of the most recent
                        # un-undone edit to the same file, roll the marker back to where it stood
                        # before the mutation instead of advancing it.
                        #
                        # Deliberately LIFO and exact: a real edit between the mutation and the
                        # restore leaves the stack top unmatched, so the verdict still expires.
                        # `Write` carries no old_string/new_string and so never matches — only an
                        # Edit that literally swaps a previous Edit's two strings qualifies.
                        old_s = binp.get("old_string")
                        new_s = binp.get("new_string")
                        stack = pending_edits.get(fp) or []
                        undoes_last = (
                            bool(stack)
                            and isinstance(old_s, str)
                            and isinstance(new_s, str)
                            and stack[-1] == (new_s, old_s)
                        )
                        if undoes_last:
                            stack.pop()
                            test_edit_idx[cls] = edit_idx_before[fp].pop()
                        else:
                            pending_edits.setdefault(fp, []).append((old_s, new_s))
                            edit_idx_before.setdefault(fp, []).append(test_edit_idx.get(cls, -1))
                            test_edit_idx[cls] = blk_idx
    except Exception as e:
        logline(f"[{ts}] transcript scan fail: {e!r}")

# Anchor for "fresh". With no .kt/.java edited this session last_edit_mtime is 0,
# and then EVERY xml in the tree counts as fresh — including results from months
# ago. Measured 2026-07-27: the repo held 2 red suites from an earlier run, so any
# turn saying "test pass" without a Kotlin edit was blocked, and the message called
# a January file "tươi" — a gate blocking valid work AND naming the wrong cause.
# With no edit to anchor on, judge the LATEST run only, not the whole history.
RUN_WINDOW = 300.0
anchor = last_edit_mtime if last_edit_mtime else (newest - RUN_WINDOW if newest else 0.0)

# Parse only the suites a live question actually depends on.
need = set()
if claimed:
    need |= {p for p, mt in mtimes.items() if mt >= anchor}
if new_run:
    need |= {p for p, mt in mtimes.items() if mt > state.get("last_run", 0.0)}
# Keyed by (path, index): one file can hold several suites under a <testsuites>
# root. Only the VALUES are read below, so the key shape is free to change.
parsed = {(p, i): s for p in need for i, s in enumerate(parse_suites(p))}

fresh_all = [s for p, s in parsed.items() if s["mtime"] >= anchor] if claimed else []

# Scope the arithmetic to the modules edited this session. A repo can hold suites that are
# red for reasons this turn did not cause and cannot fix (measured 2026-07-28: :app's
# Roborazzi suites fail on any machine without the gitignored baselines, while the three
# modules under change were green), and summing across all of them made every truthful,
# per-suite report unstatable — a gate that no honest sentence can satisfy teaches people to
# switch it off. Red OUTSIDE the touched modules is not silently forgiven: it still blocks
# unless the response names the failing suite, so "green" can never be claimed over a hidden
# red. With no .kt/.java edited there is nothing to scope by, so judge everything, exactly as
# before.
def module_of(path):
    rel = os.path.relpath(path, repo)
    return rel.split("/build/")[0] if "/build/" in rel else ""

if claimed and touched_modules:
    fresh = [s for s in fresh_all if module_of(s["path"]) in touched_modules]
    outside_red = [s for s in fresh_all
                   if module_of(s["path"]) not in touched_modules and (s["failures"] or s["errors"])]
else:
    fresh = fresh_all
    outside_red = []

# Naming the suite IS the disclosure — a claim that stays silent about it still blocks.
undisclosed_red = [s for s in outside_red
                   if s["name"].rsplit(".", 1)[-1] not in msg]

# ── 6.4 — same testcase red across two runs with edits in between ───────────
repeat_failures = []
if new_run:
    now_failing = set()
    for p, s in parsed.items():
        if s["mtime"] > state.get("last_run", 0.0):
            now_failing.update(s["failing"])
    streak = dict(state.get("streak", {}))
    for t in list(streak):
        if t not in now_failing:
            streak.pop(t, None)          # went green (or not re-run) → reset
    for t in now_failing:
        streak[t] = streak.get(t, 0) + 1
        if streak[t] >= 2:
            repeat_failures.append((t, streak[t]))

    # Per-suite red/green history. XML files are OVERWRITTEN by the next run, so
    # a green run erases the red that came before it — the only way to know a
    # test was ever red is to remember it here, Stop by Stop.
    cls_hist = dict(state.get("cls", {}))
    for p, s in parsed.items():
        if s["mtime"] <= state.get("last_run", 0.0) or not s["name"]:
            continue
        h = dict(cls_hist.get(s["name"], {}))
        h["red" if (s["failures"] or s["errors"]) else "green"] = s["mtime"]
        cls_hist[s["name"]] = h
    state = {"last_run": newest, "streak": streak, "cls": cls_hist}
    try:
        json.dump(state, open(state_path, "w"))
    except Exception:
        pass

# ── check 2 — does the XML back the claim? ──────────────────────────────────
problems = []
if claimed:
    if not mtimes:
        problems.append("KHÔNG có TEST-*.xml nào trong repo — test chưa từng chạy.")
    elif not fresh:
        problems.append(
            f"Tất cả {len(mtimes)} XML đều CŨ hơn lần sửa code cuối — run này chưa "
            f"chạy code mới (check 2: XML phải mới hơn edit cuối).")
    else:
        tot   = sum(s["tests"] for s in fresh)
        fail  = sum(s["failures"] for s in fresh)
        err   = sum(s["errors"] for s in fresh)
        skip  = sum(s["skipped"] for s in fresh)
        if tot == 0:
            problems.append("XML có nhưng tests=0 — CHƯA CHẠY, cấm gọi là PASS.")
        if fail or err:
            problems.append(f"failures={fail}, errors={err} trong XML tươi — đây KHÔNG phải pass.")
        if skip and not re.search(r"skip|bỏ qua|@Ignore", msg, re.I):
            problems.append(
                f"skipped={skip} mà response không nêu — skip không phải pass, "
                f"check 2 bắt nêu tường minh.")
    if undisclosed_red:
        names = ", ".join(sorted(s["name"].rsplit(".", 1)[-1] for s in undisclosed_red))
        problems.append(
            f"có suite ĐỎ ngoài module đã sửa mà response không nêu tên: {names}. "
            f"Claim pass ở module khác vẫn hợp lệ, nhưng phải nói ra suite đang đỏ.")

# ── RED-check: a test I wrote this session must have been seen RED once ─────
# What a machine CAN check: whether red was ever observed for that suite in this
# session, and whether that red predates the last edit of the test file (the
# rule's expiry clause). What it CANNOT check: that the red came from mutating
# the right load-bearing part, or that it failed for the mechanism under test.
# So this catches the coarse failure the rule was written for — "green in both
# directions, worth zero" — and nothing finer.
cls_hist = state.get("cls", {})
def hist_for(simple_cls):
    for suite, h in cls_hist.items():
        if suite == simple_cls or suite.endswith("." + simple_cls):
            return h
    return None

def red_in_transcript(simple_cls):
    """Was this suite printed as FAILING after its test file was last edited?

    Second, independent source of red evidence — needed because the Stop-time XML
    snapshot cannot see a RED→GREEN cycle completed inside a single turn.
    Position-based, so it honours the same expiry rule: a red printed BEFORE the
    last edit of the test file does not count.
    """
    edit_at = test_edit_idx.get(simple_cls, -1)
    for suite, idx in red_idx.items():
        if (suite == simple_cls or suite.endswith("." + simple_cls)) and idx > edit_at:
            return True
    return False

redcheck = []
if claimed:
    for cls, edited_at in sorted(authored_tests.items()):
        h = hist_for(cls)
        if not h or not h.get("green"):
            continue                      # never ran green → check 2 above covers it
        if red_in_transcript(cls):
            continue                      # red observed in-turn
        red = h.get("red", 0.0)
        if not red:
            redcheck.append((cls, "chưa từng thấy ĐỎ trong phiên này"))
        elif red < edited_at:
            redcheck.append((cls, "lần đỏ gần nhất có TRƯỚC lần sửa test cuối → verdict hết hiệu lực"))

# ── check 7: an outcome claim needs scoped structured proof ─────────────────
check7 = None
if outcome_claimed:
    def cites_exact_value(text, value):
        # Values are whole fields, not prefixes. A terminal period is allowed
        # only at sentence end; `.extra`, `@extra`, `-extra`, Unicode, etc.
        # cannot inherit authority.
        return bool(re.search(
            rf"(?:^|[\s(\[{{,:;]){re.escape(value)}"
            rf"(?=$|[\s)\]}},;:!?]|\.(?=\s|$))",
            text,
        ))

    def proof_is_final(proof):
        for use_id, use in tool_uses.items():
            if use_id == proof["toolUseId"]:
                continue
            result = tool_results.get(use_id)
            if result and result["isError"] and use["name"] == "Edit":
                continue
            if result is None:
                return False
            if result["index"] > proof["useIndex"]:
                return False
        return not any(index > proof["useIndex"] for index in no_id_tool_indices)

    def cites_bound_key(sentence, key, scope):
        return bool(re.search(
            rf"(?:^|[\s(\[{{,:]){re.escape(key)}\s*;\s*scope\s+{re.escape(scope)}"
            rf"(?=$|[\s)\]}},;:!?]|\.(?=\s|$))",
            sentence,
            re.I,
        ))

    unbound_claims = []
    for claim in outcome_claims:
        bound_proof = None
        for proof in structured_fix_proofs:
            if not proof_is_final(proof):
                continue
            cited_keys = {
                key for key in proof["fixedKeys"]
                if cites_bound_key(claim["sentence"], key, proof["scopeFingerprint"])
            }
            if (cites_exact_value(claim["sentence"], proof["scopeFingerprint"])
                    and cites_exact_value(claim["sentence"], proof["currentId"])
                    and cites_exact_value(claim["sentence"], proof["contentHash"])
                    and len(cited_keys) >= claim["sentenceOccurrences"]):
                bound_proof = proof
                break
        if not bound_proof:
            unbound_claims.append(claim["clause"].strip())
    if unbound_claims:
        check7 = ("claim OUTCOME ('đã fix'/'hết bug') nhưng phiên này không có "
                  "kết quả multi-lens-audit tương quan, không lỗi, sau edit cuối, "
                  "và bind đúng fixed key + scope cho TỪNG claim.")

if not problems and not repeat_failures and not redcheck and not check7:
    logline(f"[{ts}] claim={claimed} outcome={outcome_claimed} xml={len(mtimes)} "
            f"parsed={len(parsed)} fresh={len(fresh)} — pass")
    sys.exit(0)

out = []
if problems:
    out += ["⛔ TEST-EVIDENCE (CLAUDE.md check 2): response claim test pass nhưng XML không chống lưng.", ""]
    for p in problems:
        out.append(f"  • {p}")
    if fresh:
        out += ["", "  XML tươi đã đọc:"]
        for s in sorted(fresh, key=lambda x: -x["mtime"])[:6]:
            out.append(f"    {os.path.relpath(s['path'], repo)} — tests={s['tests']} "
                       f"failures={s['failures']} errors={s['errors']} skipped={s['skipped']}")
    out += ["", "  → Chạy lại test cho module đã sửa rồi đọc số từ TEST-*.xml, hoặc sửa câu",
            "    thành 'chưa chạy test' / ghi BLOCKED kèm residual.",
            "  Nhắc: gate này KHÔNG kiểm RED-check. Xanh mà chưa có đỏ đi kèm vẫn là BLOCKED."]

if repeat_failures:
    if out:
        out.append("")
    out += ["⛔ ANTI-LOOP (CLAUDE.md 6.4): cùng testcase đỏ qua nhiều lần fix.", ""]
    for t, n in repeat_failures[:8]:
        out.append(f"  • {t} — đỏ ở {n} lần chạy liên tiếp")
    out += ["",
            "  2 lần fix thất bại cùng root cause → bỏ và đổi đường tấn công/hypothesis.",
            "  Đây KHÔNG phải lý do kết thúc task; tiếp tục mọi phần độc lập theo B9.",
            "  Nếu mỗi fix lại đẻ bug mới: nêu nghi vấn KIẾN TRÚC sai, không phải hypothesis sai",
            "  (6.4 + rulebook/44), rồi đặt lại câu hỏi thiết kế."]

if redcheck:
    if out:
        out.append("")
    out += ["⛔ RED-CHECK (CLAUDE.md check 2): test viết trong phiên này chưa từng đỏ.", ""]
    for cls, why in redcheck[:6]:
        out.append(f"  • {cls} — {why}")
    out += ["",
            "  Test xanh cả hai chiều phân biệt được 0 thứ. Trước khi gọi là PASS: giết RIÊNG",
            "  từng phần load-bearing của fix, chạy lại, xem test có đỏ ĐÚNG failure mechanism",
            "  đang test không. Mutant sống sót = phần đó chưa có coverage.",
            "  Chưa làm được → ghi BLOCKED kèm residual, đừng gọi là PASS."]

if check7:
    if out:
        out.append("")
    out += ["⛔ CHECK 7 (fix có tác dụng thật): " + check7, "",
            "  Test xanh KHÔNG phải bằng chứng bug đã fix — unit test cho pure function tách rời",
            "  vẫn xanh khi signal thật không bao giờ tới được nó.",
            "  Cần paired executable RED→GREEN trong scoped `/fix` proof; device/runtime dùng",
            "  structured receipt cùng acceptance/scenario, không phải một lệnh ADB bất kỳ.",
            "  Thiếu proof → nói đúng phạm vi và ghi BLOCKED, không gọi outcome là đã fix."]

logline(f"[{ts}] BLOCK — problems={len(problems)} repeat={[t for t,_ in repeat_failures]} "
        f"redcheck={[c for c,_ in redcheck]} check7={bool(check7)}")
sys.stderr.write("\n".join(out) + "\n")
sys.exit(2)
PY
rc=$?
[ "${rc}" -eq 2 ] && exit 2
exit 0
