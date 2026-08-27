// KNOWN BROKEN AT LAUNCH — measured 2026-08-05, three launches, zero agents spawned in each.
// This script was written against a Node-like environment, but the workflow sandbox provides
// neither `process` nor `TextEncoder`/`TextDecoder`. Both failures were observed directly, in order:
// launches 1-2 threw "process is not defined" from module scope; after `process` was removed,
// launch 3 threw "TextEncoder is not defined" from parseArgs (that call sits in the string branch,
// outside the object branch's try/catch, so the message escapes rather than being wrapped).
//
// The codecs are load-bearing — six call sites: the two byte-length limits in parseArgs; the
// repo-relative-path length cap in validRepoPath, which guards owned paths, scope changes, oracle
// sources, pre-existing dirty paths and finding.file alike; sha256Text; the UTF-8 decode in
// artifactText; and the lens-result size cap in Consolidate. Until they are replaced with pure-JS
// UTF-8 encode/decode, this workflow produces no findings at all — which reads like a clean audit if
// the caller only looks at the finding count.
//
// The unit tests cannot see this on their own: they run under Node, where these globals exist. The
// harness used to inject `process` too, which is exactly why a `process.env` read survived 95 green
// tests. `workflow source does not reach for host globals the sandbox lacks` now guards the globals
// already cleaned up; extend that list in the same commit that removes the remaining codec use.
export const meta = {
  name: 'multi-lens-audit',
  description: 'Scoped 11-lens v3 audit with inline SHA-256 artifacts, machine oracles, RED/GREEN proof pairing, exact-patch coverage, bounded state, and fail-closed verdicts.',
  whenToUse: 'After a substantive change. This workflow can clear the audit surface but cannot attest host commands/files/devices; terminal CLEAN remains an external /fix-driver decision backed by real tool output.',
  phases: [
    { title: 'Validate', detail: 'Reject malformed/stale scope, ledger, receipts, or fake diff metrics before any audit' },
    { title: 'Audit', detail: '11 complementary lenses review exact task-owned changes, including business logic, performance, and non-code files' },
    { title: 'Consolidate', detail: 'Validate coverage/evidence shape, merge stable identities, reconcile ledger, and compute a non-lossy verdict' },
  ],
}

// Workflow scripts run in a sandbox with no `process`, so reading the repo path from the
// environment throws before a single agent is spawned — the whole audit fails with
// "process is not defined" and reports zero agents. The unit tests here run under Node, where
// `process` does exist, so they cannot see that failure; it only appears when the workflow is
// actually launched. Subagents already start in the repo working directory, so the lens prompt
// only needs to say so instead of naming an absolute path that would go stale anyway.
const REPO = 'this repository checkout (your working directory)'
const SCHEMA_VERSION = 3
const VALID_KINDS = new Set([
  'kotlin', 'java', 'test', 'xml', 'manifest', 'resource', 'gradle', 'toml',
  'proguard', 'properties', 'script', 'native', 'other_text', 'binary',
])
const VALID_STATUSES = new Set(['open', 'fixed', 'deferred', 'rejected', 'blocked'])
const VALID_EVIDENCE_KINDS = new Set(['source', 'command', 'runtime', 'contract'])
const VALID_RECEIPT_OUTCOMES = new Set(['pass', 'validated', 'disproved', 'reviewed'])
const VALID_RECEIPT_KINDS = new Set(['test', 'runtime', 'command', 'scope-manifest', 'manual-review'])
const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }
const ALL_LENS_KEYS = [
  'compile', 'business_logic', 'runtime', 'state', 'tests', 'performance',
  'ux_a11y', 'security', 'build_noncode', 'arch', 'integration',
]
const MAX_INPUT_BYTES = 1024 * 1024
const MAX_ARTIFACT_BYTES = 256 * 1024
const MAX_ARTIFACT_TOTAL_BYTES = 1024 * 1024
const MAX_LENS_FINDINGS = 128
const MAX_LENS_RESULT_BYTES = 256 * 1024
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/
const CHANGE_STATUS = new Set(['added', 'modified', 'deleted', 'renamed', 'untracked'])
const ORACLE_OPS = new Set(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'zero', 'nonzero', 'contains', 'not_contains'])

// --- Pure-JS UTF-8 codecs -----------------------------------------------------------------
// The workflow sandbox provides neither TextEncoder nor TextDecoder (see the header note). Six
// call sites depended on them, and the failure happened in parseArgs BEFORE any agent spawned —
// so the audit reported zero findings, which reads exactly like a clean result. These replace
// them with plain arithmetic so the codecs can never take the audit down again.

function utf8ByteLength(str) {
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) bytes += 1
    else if (c < 0x800) bytes += 2
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const n = str.charCodeAt(i + 1)
      if (n >= 0xdc00 && n <= 0xdfff) { bytes += 4; i++ } else bytes += 3
    } else bytes += 3
  }
  return bytes
}

function utf8Encode(str) {
  const out = []
  for (let i = 0; i < str.length; i++) {
    let cp = str.codePointAt(i)
    if (cp > 0xffff) i++
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  }
  return out
}

// Strict: returns null on any malformed, overlong or surrogate sequence, matching the
// { fatal: true } TextDecoder it replaces.
function utf8Decode(bytes) {
  let out = ''
  let i = 0
  const len = bytes.length
  while (i < len) {
    const b0 = bytes[i]
    let cp, extra
    if (b0 < 0x80) { cp = b0; extra = 0 }
    else if ((b0 & 0xe0) === 0xc0) { cp = b0 & 0x1f; extra = 1 }
    else if ((b0 & 0xf0) === 0xe0) { cp = b0 & 0x0f; extra = 2 }
    else if ((b0 & 0xf8) === 0xf0) { cp = b0 & 0x07; extra = 3 }
    else return null
    if (i + extra >= len) return null
    for (let k = 1; k <= extra; k++) {
      const b = bytes[i + k]
      if ((b & 0xc0) !== 0x80) return null
      cp = (cp << 6) | (b & 0x3f)
    }
    if (extra === 1 && cp < 0x80) return null
    if (extra === 2 && cp < 0x800) return null
    if (extra === 3 && cp < 0x10000) return null
    if (cp > 0x10ffff) return null
    if (cp >= 0xd800 && cp <= 0xdfff) return null
    out += String.fromCodePoint(cp)
    i += extra + 1
  }
  return out
}

function parseArgs(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    try {
      const serialized = JSON.stringify(raw)
      if (utf8ByteLength(serialized) > MAX_INPUT_BYTES) return { value: null, errors: ['args exceed 1 MiB contract limit'] }
      const parsed = JSON.parse(serialized)
      return { value: parsed, errors: [] }
    } catch (error) {
      return { value: null, errors: [`args object must be finite plain JSON: ${String(error && error.message ? error.message : error)}`] }
    }
  }
  if (typeof raw !== 'string') return { value: null, errors: ['args must be a JSON object or JSON-object string'] }
  const trimmed = raw.trim()
  if (utf8ByteLength(trimmed) > MAX_INPUT_BYTES) return { value: null, errors: ['args exceed 1 MiB contract limit'] }
  if (!trimmed.startsWith('{')) return { value: null, errors: ['plain-string scope is no longer supported; pass schemaVersion=3 args'] }
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, errors: ['parsed args must be an object'] }
    }
    return { value: parsed, errors: [] }
  } catch (error) {
    return { value: null, errors: [`args JSON parse failed: ${String(error && error.message ? error.message : error)}`] }
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function validRepoPath(value) {
  if (!nonEmptyString(value) || utf8ByteLength(value) > 1024 || value !== value.normalize('NFC')
    || value.includes('\\') || value.includes('"') || value.includes(' b/') || /[\u0000-\u001f\u007f]/.test(value)
    || value.startsWith('/') || value.startsWith('./') || value.endsWith('/') || value.includes('//')) return false
  const segments = value.split('/')
  return !segments.some((segment) => segment.toLowerCase() === '.git')
    && segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

function canonicalPathKey(value) {
  return String(value || '').normalize('NFC').toLowerCase()
}

function compareCanonicalPathItems(left, right) {
  const leftPath = canonicalPathKey(left?.path)
  const rightPath = canonicalPathKey(right?.path)
  return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0
}

function isOracleSupportPath(value) {
  const path = canonicalPathKey(value)
  return /^app\/tester\/files\//.test(path)
    || /^core\/testing\//.test(path)
    || /(^|\/)src\/(?:test|androidtest|testfixtures|commontest|jvmtest)\//.test(path)
    || /(^|\/)(?:tests?|test[-_]support|fixtures|mocks|harness|probes)(?:\/|$)/.test(path)
    || /(?:^|[._-])(?:test|spec)\.[^/]+$/.test(path)
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Bytes(bytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)
  const w = new Uint32Array(64)
  const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits))
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(offset + index * 4, false)
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(w[index - 15], 7) ^ rotr(w[index - 15], 18) ^ (w[index - 15] >>> 3)
      const s1 = rotr(w[index - 2], 17) ^ rotr(w[index - 2], 19) ^ (w[index - 2] >>> 10)
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const choice = (e & f) ^ (~e & g)
      const t1 = (h + sum1 + choice + K[index] + w[index]) >>> 0
      const sum0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (sum0 + majority) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  return `sha256:${H.map((value) => value.toString(16).padStart(8, '0')).join('')}`
}

function sha256Text(text) {
  return sha256Bytes(utf8Encode(text))
}

function sha256Value(value) {
  return sha256Text(stableStringify(value))
}

function decodeBase64(value) {
  if (!nonEmptyString(value) || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) return null
  try {
    const raw = atob(value)
    return Uint8Array.from(raw, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

function evidenceFingerprint(evidence) {
  return sha256Value(evidence)
}

function findingFingerprint(finding) {
  return sha256Value({
    key: findingKey(finding),
    changeId: finding.changeId,
    file: canonicalPathKey(finding.file),
    ruleId: normalizeToken(finding.ruleId),
    klassId: normalizeToken(finding.klassId),
    subject: normalizeToken(finding.subject),
    scenarioId: normalizeToken(finding.scenarioId),
    acceptanceId: finding.acceptanceId,
    scenarioFingerprint: finding.scenarioFingerprint,
    evidenceFingerprint: evidenceFingerprint(finding.evidence),
  })
}

function auditStateDigest(state) {
  return sha256Value({
    sweepIndex: state.sweepIndex,
    runId: state.runId,
    runNonce: state.runNonce,
    scopeFingerprint: state.scopeFingerprint,
    currentId: state.currentId,
    nextLedger: state.nextLedger,
    nextClassHistory: state.nextClassHistory,
    nextBudgetHistory: state.nextBudgetHistory,
  })
}

function expectedManifestContentHash(manifest) {
  const changes = [...(manifest.changes || [])]
    .map((change) => ({
      id: change.id,
      path: canonicalPathKey(change.path),
      previousPath: change.previousPath ? canonicalPathKey(change.previousPath) : null,
      kind: change.kind,
      status: change.status,
      added: change.added,
      deleted: change.deleted,
      patchHash: change.patchHash,
      patchArtifactId: change.patchArtifactId,
      binaryArtifactId: change.binaryArtifactId || null,
      binaryBaselineArtifactId: change.binaryBaselineArtifactId || null,
      preimageSha256: change.preimageSha256,
      postimageSha256: change.postimageSha256,
      preimageMode: change.preimageMode,
      postimageMode: change.postimageMode,
      firstEditStartedAt: change.firstEditStartedAt,
      lastEditFinishedAt: change.lastEditFinishedAt,
      overlap: change.overlap,
      overlapsPreExisting: change.overlapsPreExisting,
      manualReviewReceiptId: change.manualReviewReceiptId || null,
      approvalDigest: change.approvalDigest || null,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
  return sha256Value({ currentId: manifest.currentId, changes })
}

function findingKey(finding) {
  return [canonicalPathKey(finding.file), finding.ruleId, finding.subject, finding.scenarioId]
    .map(normalizeToken).join('|')
}

function receiptMapOf(receipts) {
  return new Map(receipts.map((receipt) => [receipt.id, receipt]))
}

function artifactMapOf(artifacts) {
  return new Map((Array.isArray(artifacts) ? artifacts : []).filter((artifact) => artifact && nonEmptyString(artifact.id)).map((artifact) => [artifact.id, artifact]))
}

function artifactBytes(artifact) {
  return artifact && artifact.encoding === 'base64' ? decodeBase64(artifact.payload) : null
}

function artifactText(artifact) {
  const bytes = artifactBytes(artifact)
  if (!bytes) return null
  try { return utf8Decode(bytes) } catch { return null }
}

function artifactJson(artifact) {
  const text = artifactText(artifact)
  if (text === null) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function metricValue(measurement, path) {
  const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
  if (!nonEmptyString(path) || path.split('.').some((part) => forbidden.has(part) || !/^[-a-zA-Z0-9_]+$/.test(part))) return undefined
  return path.split('.').reduce((value, part) => (
    value && typeof value === 'object' && Object.hasOwn(value, part) ? value[part] : undefined
  ), measurement)
}

function evaluateOracle(oracle, measurement, depth = 0) {
  if (!oracle || typeof oracle !== 'object' || Array.isArray(oracle) || depth > 2) return { valid: false, pass: false }
  if (Array.isArray(oracle.all)) {
    if (Object.keys(oracle).length !== 1 || oracle.all.length === 0 || oracle.all.length > 10) return { valid: false, pass: false }
    const results = oracle.all.map((item) => evaluateOracle(item, measurement, depth + 1))
    return { valid: results.every((result) => result.valid), pass: results.every((result) => result.valid && result.pass) }
  }
  if (!nonEmptyString(oracle.metric) || !ORACLE_OPS.has(oracle.op)) return { valid: false, pass: false }
  const keys = Object.keys(oracle)
  const unary = oracle.op === 'zero' || oracle.op === 'nonzero'
  if (unary ? (keys.length !== 2 || Object.hasOwn(oracle, 'value')) : (keys.length !== 3 || !Object.hasOwn(oracle, 'value'))) {
    return { valid: false, pass: false }
  }
  if (['lt', 'lte', 'gt', 'gte'].includes(oracle.op) && typeof oracle.value !== 'number') return { valid: false, pass: false }
  if (['contains', 'not_contains'].includes(oracle.op) && typeof oracle.value !== 'string') return { valid: false, pass: false }
  if (['eq', 'neq'].includes(oracle.op) && oracle.value !== null && !['string', 'number', 'boolean'].includes(typeof oracle.value)) {
    return { valid: false, pass: false }
  }
  const actual = metricValue(measurement, oracle.metric)
  if (actual === undefined) return { valid: true, pass: false }
  switch (oracle.op) {
    case 'eq': return { valid: true, pass: Object.is(actual, oracle.value) }
    case 'neq': return { valid: true, pass: !Object.is(actual, oracle.value) }
    case 'lt': return { valid: typeof actual === 'number' && typeof oracle.value === 'number', pass: actual < oracle.value }
    case 'lte': return { valid: typeof actual === 'number' && typeof oracle.value === 'number', pass: actual <= oracle.value }
    case 'gt': return { valid: typeof actual === 'number' && typeof oracle.value === 'number', pass: actual > oracle.value }
    case 'gte': return { valid: typeof actual === 'number' && typeof oracle.value === 'number', pass: actual >= oracle.value }
    case 'zero': return { valid: typeof actual === 'number', pass: actual === 0 }
    case 'nonzero': return { valid: typeof actual === 'number', pass: actual !== 0 }
    case 'contains': return { valid: typeof actual === 'string' && typeof oracle.value === 'string', pass: String(actual).includes(oracle.value) }
    case 'not_contains': return { valid: typeof actual === 'string' && typeof oracle.value === 'string', pass: !String(actual).includes(oracle.value) }
    default: return { valid: false, pass: false }
  }
}

function receiptMeasurement(receipt, artifactsById) {
  return artifactJson(artifactsById.get(receipt && receipt.measurementArtifactId))
}

function receiptMeasurementWindow(receipt, measurement) {
  if (receipt.kind === 'test') return { startedAt: receipt.runStartedAt, finishedAt: receipt.reportMtime }
  if (receipt.kind === 'runtime') return { startedAt: receipt.runStartedAt, finishedAt: receipt.capturedAt }
  if (receipt.kind === 'command') return { startedAt: measurement?.runStartedAt, finishedAt: measurement?.capturedAt }
  return { startedAt: null, finishedAt: null }
}

function receiptOracleResult(receipt, artifactsById) {
  const measurement = receiptMeasurement(receipt, artifactsById)
  return measurement ? evaluateOracle(receipt.machineOracle, measurement) : { valid: false, pass: false }
}

function receiptFailureFingerprint(receipt, artifactsById) {
  const measurement = receiptMeasurement(receipt, artifactsById)
  return measurement && nonEmptyString(measurement.failureSignature)
    ? sha256Text(measurement.failureSignature)
    : null
}

function receiptExecutionIdentity(receipt, artifactsById) {
  const measurement = receiptMeasurement(receipt, artifactsById) || {}
  return sha256Value({
    kind: receipt.kind,
    command: receipt.command || null,
    locator: receipt.locator || null,
    testIdentity: receipt.testIdentity || null,
    task: measurement.task || null,
    executable: measurement.executable || null,
    commandArgs: measurement.commandArgs || null,
    trigger: measurement.trigger || receipt.trigger || null,
    deviceId: measurement.deviceId || receipt.deviceId || null,
    variant: measurement.variant || receipt.variant || null,
    packageName: measurement.packageName || null,
    captureFilter: measurement.captureFilter || null,
    fixtureHash: measurement.fixtureHash || null,
    oracleSourceHash: measurement.oracleSourceHash || null,
  })
}

function analyzePatch(text) {
  if (typeof text !== 'string') return null
  let added = 0
  let deleted = 0
  let inHunk = false
  let oldRemaining = 0
  let newRemaining = 0
  const errors = []
  const metadataIndexes = new Set()
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (inHunk && oldRemaining === 0 && newRemaining === 0) inHunk = false
    if (!inHunk) {
      const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
      if (line.startsWith('@@ ') && !header) {
        errors.push('patch contains malformed hunk header')
        continue
      }
      if (header) {
        oldRemaining = header[2] === undefined ? 1 : Number(header[2])
        newRemaining = header[4] === undefined ? 1 : Number(header[4])
        inHunk = true
        continue
      }
      metadataIndexes.add(index)
      continue
    }
    if (line.startsWith('@@ ')) {
      errors.push('patch starts a new hunk before the prior hunk counts are satisfied')
      inHunk = false
      continue
    }
    if (line.startsWith('+')) {
      added += 1
      newRemaining -= 1
    } else if (line.startsWith('-')) {
      deleted += 1
      oldRemaining -= 1
    } else if (line.startsWith(' ')) {
      oldRemaining -= 1
      newRemaining -= 1
    } else if (line !== '\\ No newline at end of file') {
      errors.push('patch contains non-hunk metadata before hunk counts are satisfied')
      inHunk = false
      metadataIndexes.add(index)
    }
    if (oldRemaining < 0 || newRemaining < 0) {
      errors.push('patch hunk body exceeds declared old/new line counts')
      inHunk = false
    }
  }
  if (inHunk && (oldRemaining !== 0 || newRemaining !== 0)) errors.push('patch hunk body does not satisfy declared old/new line counts')
  return { added, deleted, errors, metadataIndexes }
}

function countPatchLines(text) {
  const analysis = analyzePatch(text)
  return analysis && { added: analysis.added, deleted: analysis.deleted }
}

function binaryEvidenceText(change) {
  const artifactSha256 = change.status === 'deleted' ? change.preimageSha256 : change.postimageSha256
  const mode = (value) => value === null ? 'absent' : Number(value).toString(8)
  return [
    'App binary evidence v1',
    `path ${change.path}`,
    `status ${change.status}`,
    `preimage ${change.preimageSha256} mode ${mode(change.preimageMode)}`,
    `postimage ${change.postimageSha256} mode ${mode(change.postimageMode)}`,
    `artifact ${artifactSha256}`,
    '',
  ].join('\n')
}

function patchBindingErrors(text, change) {
  const errors = []
  if (change.kind === 'binary') {
    if (text !== binaryEvidenceText(change)) errors.push('binary change requires the exact canonical binary evidence manifest')
    return errors
  }
  const diffHeaders = []
  const oldHeaders = []
  const newHeaders = []
  const renameFrom = []
  const renameTo = []
  const modeHeaders = []
  const lines = String(text || '').split('\n')
  const analysis = analyzePatch(String(text || ''))
  errors.push(...(analysis?.errors || []))
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!analysis?.metadataIndexes.has(index)) continue
    const diff = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
    if (diff) { diffHeaders.push({ oldPath: diff[1], newPath: diff[2] }); continue }
    if (line.startsWith('--- ')) oldHeaders.push(line.slice(4).split('\t')[0])
    if (line.startsWith('+++ ')) newHeaders.push(line.slice(4).split('\t')[0])
    if (line.startsWith('rename from ')) renameFrom.push(line.slice('rename from '.length))
    if (line.startsWith('rename to ')) renameTo.push(line.slice('rename to '.length))
    if (/^(old mode|new mode|deleted file mode|new file mode) /.test(line)) modeHeaders.push(line)
  }
  if (diffHeaders.length > 1 || oldHeaders.length > 1 || newHeaders.length > 1) errors.push('patch must describe exactly one file')
  if (diffHeaders.length !== 1) errors.push('patch requires exactly one diff --git header')
  const expectedOld = `a/${change.path}`
  const expectedNew = `b/${change.path}`
  const expectedPreviousPath = change.status === 'renamed' ? change.previousPath : change.path
  if (diffHeaders.length === 1 && (diffHeaders[0].newPath !== change.path || diffHeaders[0].oldPath !== expectedPreviousPath)) {
    errors.push('diff --git header path does not match change.path')
  }
  if (change.kind !== 'binary' && change.added === 0 && change.deleted === 0
    && change.status !== 'renamed' && modeHeaders.length === 0) {
    errors.push('zero-line patch requires explicit mode metadata')
  }
  const oldModeHeaders = modeHeaders.filter((line) => line.startsWith('old mode '))
  const newModeHeaders = modeHeaders.filter((line) => line.startsWith('new mode '))
  if (change.status === 'modified') {
    const modeChanged = change.preimageMode !== change.postimageMode
    if (modeChanged) {
      const expectedOldMode = `old mode 100${Number(change.preimageMode).toString(8)}`
      const expectedNewMode = `new mode 100${Number(change.postimageMode).toString(8)}`
      if (oldModeHeaders.length !== 1 || newModeHeaders.length !== 1
        || oldModeHeaders[0] !== expectedOldMode || newModeHeaders[0] !== expectedNewMode) {
        errors.push('modified mode change requires exact paired old/new mode metadata')
      }
    } else if (oldModeHeaders.length > 0 || newModeHeaders.length > 0) {
      errors.push('unchanged mode cannot carry old/new mode metadata')
    }
    if (change.kind !== 'binary' && change.added === 0 && change.deleted === 0
      && (change.preimageSha256 !== change.postimageSha256 || !modeChanged)) {
      errors.push('zero-line modified patch must be a pure mode change with identical content hashes')
    }
  } else if (change.status === 'added' || change.status === 'untracked') {
    const expected = `new file mode 100${Number(change.postimageMode).toString(8)}`
    if (modeHeaders.filter((line) => line.startsWith('new file mode ')).length !== 1 || !modeHeaders.includes(expected)) {
      errors.push(`${change.status} patch requires exact new file mode metadata`)
    }
  } else if (change.status === 'deleted') {
    const expected = `deleted file mode 100${Number(change.preimageMode).toString(8)}`
    if (modeHeaders.filter((line) => line.startsWith('deleted file mode ')).length !== 1 || !modeHeaders.includes(expected)) {
      errors.push('deleted patch requires exact deleted file mode metadata')
    }
  }
  if (change.status === 'renamed') {
    if (renameFrom.length !== 1 || renameTo.length !== 1
      || renameFrom[0] !== change.previousPath || renameTo[0] !== change.path) {
      errors.push('renamed patch must bind exactly one rename from/to pair')
    }
  } else if (renameFrom.length > 0 || renameTo.length > 0) {
    errors.push('rename metadata requires status=renamed')
  }
  if (oldHeaders.length === 1) {
    const validOld = change.status === 'added' || change.status === 'untracked'
      ? oldHeaders[0] === '/dev/null'
      : change.status === 'renamed' ? oldHeaders[0] === `a/${change.previousPath}` : oldHeaders[0] === expectedOld
    if (!validOld) errors.push('old patch header does not match change path/status')
  }
  if (newHeaders.length === 1) {
    const validNew = change.status === 'deleted' ? newHeaders[0] === '/dev/null' : newHeaders[0] === expectedNew
    if (!validNew) errors.push('new patch header does not match change path/status')
  }
  return errors
}

function validateInputs(input) {
  const errors = []
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must equal ${SCHEMA_VERSION}`)
  if (input.concurrencyWindow !== 'optimistic-unattested') errors.push('concurrencyWindow must equal optimistic-unattested')
  if (!Number.isInteger(input.sweepIndex) || input.sweepIndex < 0) errors.push('sweepIndex must be a non-negative integer')
  if (!nonEmptyString(input.runId)) errors.push('runId is required')
  if (!nonEmptyString(input.runNonce)) errors.push('runNonce is required')
  const runStartedAt = Date.parse(input.runStartedAt)
  if (!nonEmptyString(input.runStartedAt) || !Number.isFinite(runStartedAt)) errors.push('runStartedAt must be a valid timestamp')
  if (Number.isFinite(runStartedAt) && runStartedAt > Date.now() + 60_000) errors.push('runStartedAt cannot be in the future')

  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : []
  if (!Array.isArray(input.artifacts) || artifacts.length === 0 || artifacts.length > 64) errors.push('artifacts must contain 1..64 entries')
  const artifactIds = new Set()
  let artifactTotalBytes = 0
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      errors.push('every artifact must be an object')
      continue
    }
    if (!nonEmptyString(artifact.id)) errors.push('artifact id is required')
    if (artifactIds.has(artifact.id)) errors.push(`duplicate artifact id: ${artifact.id}`)
    artifactIds.add(artifact.id)
    if (!nonEmptyString(artifact.mediaType)) errors.push(`artifact ${artifact.id || '<missing-id>'} requires mediaType`)
    if (artifact.encoding !== 'base64') errors.push(`artifact ${artifact.id || '<missing-id>'} must use base64 encoding`)
    if (!SHA256_PATTERN.test(artifact.sha256 || '')) errors.push(`artifact ${artifact.id || '<missing-id>'} requires sha256:<64 lowercase hex>`)
    const bytes = artifactBytes(artifact)
    if (!bytes) {
      errors.push(`artifact ${artifact.id || '<missing-id>'} has invalid base64 payload`)
      continue
    }
    artifactTotalBytes += bytes.length
    if (!Number.isInteger(artifact.byteLength) || artifact.byteLength !== bytes.length || bytes.length > MAX_ARTIFACT_BYTES) {
      errors.push(`artifact ${artifact.id || '<missing-id>'} byteLength mismatch or exceeds 256 KiB`)
    }
    if (sha256Bytes(bytes) !== artifact.sha256) errors.push(`artifact ${artifact.id || '<missing-id>'} SHA-256 mismatch`)
  }
  if (artifactTotalBytes > MAX_ARTIFACT_TOTAL_BYTES) errors.push('artifact payloads exceed 1 MiB total')
  const artifactsById = artifactMapOf(artifacts)

  if (!Array.isArray(input.acceptance) || input.acceptance.length === 0) errors.push('acceptance must be a non-empty array')
  const acceptanceIds = new Set()
  for (const acceptance of Array.isArray(input.acceptance) ? input.acceptance : []) {
    if (!acceptance || typeof acceptance !== 'object' || Array.isArray(acceptance)) {
      errors.push('every acceptance entry must be an object')
      continue
    }
    for (const field of ['id', 'defect', 'statement', 'scenarioFingerprint']) {
      if (!nonEmptyString(acceptance[field])) errors.push(`acceptance entry requires ${field}`)
    }
    if (acceptanceIds.has(acceptance.id)) errors.push(`duplicate acceptance id: ${acceptance.id}`)
    acceptanceIds.add(acceptance.id)
    if (typeof acceptance.mandatory !== 'boolean') errors.push(`acceptance ${acceptance.id || '<missing-id>'} requires mandatory boolean`)
    if (!acceptance.machineOracle || !evaluateOracle(acceptance.machineOracle, {}).valid) {
      errors.push(`acceptance ${acceptance.id || '<missing-id>'} requires a structurally valid typed machineOracle`)
    }
    if (!Array.isArray(acceptance.blastRadiusAnchors) || acceptance.blastRadiusAnchors.length === 0) {
      errors.push(`acceptance ${acceptance.id || '<missing-id>'} requires blastRadiusAnchors`)
    } else if (acceptance.blastRadiusAnchors.some((anchor) => !nonEmptyString(anchor) || anchor.includes('|'))
      || new Set(acceptance.blastRadiusAnchors.map(normalizeToken)).size !== acceptance.blastRadiusAnchors.length) {
      errors.push(`acceptance ${acceptance.id || '<missing-id>'} blastRadiusAnchors must be unique non-empty stable anchors`)
    }
    if (!Array.isArray(acceptance.oracleSourcePaths) || acceptance.oracleSourcePaths.length === 0
      || acceptance.oracleSourcePaths.some((path) => !validRepoPath(path))
      || new Set(acceptance.oracleSourcePaths.map(canonicalPathKey)).size !== acceptance.oracleSourcePaths.length) {
      errors.push(`acceptance ${acceptance.id || '<missing-id>'} requires unique canonical oracleSourcePaths`)
    }
  }

  const manifest = input.scopeManifest
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('scopeManifest is required')
    return errors
  }
  for (const field of ['baselineId', 'baselineContentId', 'currentId', 'scopeFingerprint', 'generatedAt', 'firstEditStartedAt', 'lastEditFinishedAt', 'contentHash', 'manifestReceiptId']) {
    if (!nonEmptyString(manifest[field])) errors.push(`scopeManifest.${field} is required`)
  }
  if (!SHA256_PATTERN.test(manifest.currentId || '')) errors.push('scopeManifest.currentId must be SHA-256')
  if (!SHA256_PATTERN.test(manifest.baselineContentId || '')) errors.push('scopeManifest.baselineContentId must be SHA-256')
  if (!SHA256_PATTERN.test(manifest.scopeFingerprint || '')) errors.push('scopeManifest.scopeFingerprint must be SHA-256')
  if (!SHA256_PATTERN.test(manifest.contentHash || '')) errors.push('scopeManifest.contentHash must be SHA-256')
  if (!(manifest.priorAuditStateDigest === null || SHA256_PATTERN.test(manifest.priorAuditStateDigest || ''))) {
    errors.push('scopeManifest.priorAuditStateDigest must be null or SHA-256')
  }
  const manifestGeneratedAt = Date.parse(manifest.generatedAt)
  const firstEditStartedAt = Date.parse(manifest.firstEditStartedAt)
  const lastEditFinishedAt = Date.parse(manifest.lastEditFinishedAt)
  if (!Number.isFinite(manifestGeneratedAt)) errors.push('scopeManifest.generatedAt must be a valid timestamp')
  if (Number.isFinite(manifestGeneratedAt) && Number.isFinite(runStartedAt) && manifestGeneratedAt < runStartedAt) {
    errors.push('scopeManifest.generatedAt must not predate runStartedAt')
  }
  if (Number.isFinite(manifestGeneratedAt) && manifestGeneratedAt > Date.now() + 60_000) errors.push('scopeManifest.generatedAt cannot be in the future')
  if (!Number.isFinite(firstEditStartedAt)) errors.push('scopeManifest.firstEditStartedAt must be a valid timestamp')
  if (!Number.isFinite(lastEditFinishedAt)) errors.push('scopeManifest.lastEditFinishedAt must be a valid timestamp')
  if (Number.isFinite(firstEditStartedAt) && Number.isFinite(runStartedAt) && firstEditStartedAt < runStartedAt) {
    errors.push('scopeManifest.firstEditStartedAt must not predate runStartedAt')
  }
  if (Number.isFinite(firstEditStartedAt) && Number.isFinite(manifestGeneratedAt) && firstEditStartedAt > manifestGeneratedAt) {
    errors.push('scopeManifest.firstEditStartedAt must not follow generatedAt')
  }
  if (Number.isFinite(lastEditFinishedAt) && Number.isFinite(firstEditStartedAt) && lastEditFinishedAt < firstEditStartedAt) {
    errors.push('scopeManifest.lastEditFinishedAt must not predate firstEditStartedAt')
  }
  if (Number.isFinite(lastEditFinishedAt) && Number.isFinite(manifestGeneratedAt) && lastEditFinishedAt > manifestGeneratedAt) {
    errors.push('scopeManifest.lastEditFinishedAt must not follow generatedAt')
  }
  if (manifest.source !== 'artifact-driver') errors.push('scopeManifest.source must equal artifact-driver')
  if (!Array.isArray(manifest.ownedPaths) || manifest.ownedPaths.length === 0) {
    errors.push('scopeManifest.ownedPaths must be a non-empty array')
  }
  if (!Array.isArray(manifest.preExistingDirtyPaths)) {
    errors.push('scopeManifest.preExistingDirtyPaths must be an array')
  }
  if (!Array.isArray(manifest.changes) || manifest.changes.length === 0) {
    errors.push('scopeManifest.changes must be a non-empty array')
  }
  if (!Number.isInteger(manifest.diffLines) || manifest.diffLines < 0) {
    errors.push('scopeManifest.diffLines must be an explicit non-negative integer')
  }
  if (!Number.isInteger(manifest.budgetDiffLines) || manifest.budgetDiffLines < manifest.diffLines) {
    errors.push('scopeManifest.budgetDiffLines must be an integer >= current diffLines')
  }

  const receipts = Array.isArray(input.verificationReceipts) ? input.verificationReceipts : []
  if (!Array.isArray(input.verificationReceipts)) errors.push('verificationReceipts must be an array')
  const receiptIds = new Set()
  const successfulPostOraclePathsByReceipt = new Map()
  const manifestChangesByPath = new Map((Array.isArray(manifest.changes) ? manifest.changes : [])
    .filter((change) => change && validRepoPath(change.path))
    .map((change) => [canonicalPathKey(change.path), change]))
  for (const receipt of receipts) {
    if (!receipt || typeof receipt !== 'object') {
      errors.push('every verification receipt must be an object')
      continue
    }
    const receiptErrorStart = errors.length
    const successfulPostPaths = new Set()
    if (!nonEmptyString(receipt.id)) errors.push('verification receipt id is required')
    if (receiptIds.has(receipt.id)) errors.push(`duplicate verification receipt id: ${receipt.id}`)
    receiptIds.add(receipt.id)
    if (receipt.runId !== input.runId || receipt.runNonce !== input.runNonce) {
      errors.push(`stale verification receipt ${receipt.id || '<missing-id>'}: run binding mismatch`)
    }
    const operationalReceipt = ['test', 'runtime', 'command'].includes(receipt.kind)
    const contentPhase = operationalReceipt ? receipt.contentPhase : 'post'
    if (operationalReceipt && !['pre', 'post'].includes(contentPhase)) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires contentPhase=pre|post`)
    }
    if (!operationalReceipt && receipt.contentPhase !== undefined && receipt.contentPhase !== 'post') {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} non-operational contentPhase must be post`)
    }
    if (receipt.scopeFingerprint !== manifest.scopeFingerprint) {
      errors.push(`stale verification receipt ${receipt.id || '<missing-id>'}: scopeFingerprint mismatch`)
    }
    if (contentPhase === 'post' && receipt.currentId !== manifest.currentId) {
      errors.push(`stale verification receipt ${receipt.id || '<missing-id>'}: post currentId mismatch`)
    }
    if (contentPhase === 'post' && receipt.contentHash !== manifest.contentHash) {
      errors.push(`stale verification receipt ${receipt.id || '<missing-id>'}: post contentHash mismatch`)
    }
    if (receipt.status !== 'verified') errors.push(`verification receipt ${receipt.id || '<missing-id>'} must have status=verified`)
    const expectedSource = operationalReceipt ? 'main-tool-call-unattested' : 'artifact-driver'
    if (receipt.source !== expectedSource) errors.push(`verification receipt ${receipt.id || '<missing-id>'} must have source=${expectedSource}`)
    if (!VALID_RECEIPT_KINDS.has(receipt.kind)) errors.push(`verification receipt ${receipt.id || '<missing-id>'} has invalid kind`)
    if (!VALID_RECEIPT_OUTCOMES.has(receipt.outcome)) errors.push(`verification receipt ${receipt.id || '<missing-id>'} has invalid outcome`)
    if (!nonEmptyString(receipt.executedAt)) errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires executedAt`)
    const executedAt = Date.parse(receipt.executedAt)
    if (!Number.isFinite(executedAt)) errors.push(`verification receipt ${receipt.id || '<missing-id>'} executedAt must be a valid timestamp`)
    if (Number.isFinite(executedAt) && Number.isFinite(runStartedAt) && executedAt < runStartedAt) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} predates runStartedAt`)
    }
    if (Number.isFinite(executedAt) && executedAt > Date.now() + 60_000) errors.push(`verification receipt ${receipt.id || '<missing-id>'} cannot be in the future`)
    if (operationalReceipt && Number.isFinite(executedAt) && Number.isFinite(lastEditFinishedAt)) {
      if (contentPhase === 'post' && executedAt < lastEditFinishedAt) errors.push(`verification receipt ${receipt.id || '<missing-id>'} post phase must execute after last edit finishes`)
    }
    if (!acceptanceIds.has(receipt.acceptanceId) && receipt.kind !== 'scope-manifest' && receipt.kind !== 'manual-review') {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} references unknown acceptanceId`)
    }
    if (!nonEmptyString(receipt.scenarioFingerprint) && receipt.kind !== 'scope-manifest' && receipt.kind !== 'manual-review') {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires scenarioFingerprint`)
    }
    const receiptAcceptance = acceptanceIds.has(receipt.acceptanceId)
      ? input.acceptance.find((acceptance) => acceptance.id === receipt.acceptanceId)
      : null
    if (operationalReceipt && receiptAcceptance && receipt.scenarioFingerprint !== receiptAcceptance.scenarioFingerprint) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} scenarioFingerprint must match acceptance`)
    }
    if (operationalReceipt && receiptAcceptance && sha256Value(receipt.machineOracle) !== sha256Value(receiptAcceptance.machineOracle)) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} machineOracle must exactly match acceptance oracle`)
    }
    if (!nonEmptyString(receipt.measurementArtifactId) && ['test', 'runtime', 'command'].includes(receipt.kind)) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires measurementArtifactId`)
    }
    const measurementArtifact = artifactsById.get(receipt.measurementArtifactId)
    if (['test', 'runtime', 'command'].includes(receipt.kind)
      && (!measurementArtifact || measurementArtifact.mediaType !== 'application/json' || !artifactJson(measurementArtifact))) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires a valid inline application/json measurement artifact`)
    }
    const oracleResult = receiptOracleResult(receipt, artifactsById)
    if (['test', 'runtime', 'command'].includes(receipt.kind) && !oracleResult.valid) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} has invalid machine oracle`)
    }
    if (operationalReceipt && receipt.outcome === 'validated' && oracleResult.pass) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} validated RED requires the acceptance oracle to fail`)
    }
    if (!nonEmptyString(receipt.command) && !nonEmptyString(receipt.evidenceRef)) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires command or evidenceRef`)
    }
    const operationalMeasurement = receiptMeasurement(receipt, artifactsById)
    if (operationalReceipt && !SHA256_PATTERN.test(operationalMeasurement?.oracleSourceHash || '')) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires SHA-256 oracleSourceHash`)
    }
    const oracleSourceArtifact = artifactsById.get(operationalMeasurement?.oracleSourceArtifactId)
    const oracleSource = artifactJson(oracleSourceArtifact)
    if (operationalReceipt && (!oracleSourceArtifact
      || oracleSourceArtifact.mediaType !== 'application/vnd.exampleapp.oracle-source+json'
      || !oracleSource)) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} requires a driver-attested oracle source artifact`
        + ` (${String(operationalMeasurement?.oracleSourceArtifactId || '<missing-id>')})`)
    } else if (operationalReceipt) {
      const sourceStates = oracleSource.sourceStates
      const scopeStates = oracleSource.scopeStates
      if (oracleSource.source !== 'artifact-driver' || !Array.isArray(sourceStates) || sourceStates.length === 0
        || sourceStates.some((state) => !state || !nonEmptyString(state.path)
          || !SHA256_PATTERN.test(state.sha256 || '') || !SHA256_PATTERN.test(state.observationToken || '')
          || ![null, 0o644, 0o755].includes(state.mode)
          || ((state.mode === null) !== (state.sha256 === sha256Text('ABSENT'))))
        || oracleSource.sourceHash !== sha256Value(sourceStates)
        || operationalMeasurement.oracleSourceHash !== oracleSource.sourceHash
        || !SHA256_PATTERN.test(oracleSource.scopeContentId || '')) {
        errors.push(`verification receipt ${receipt.id || '<missing-id>'} oracle source artifact is malformed or hash-mismatched`)
      }
      const expectedSourcePaths = [...(receiptAcceptance?.oracleSourcePaths || [])].map(canonicalPathKey).sort()
      const actualSourcePaths = sourceStates.map((state) => canonicalPathKey(state.path)).sort()
      if (stableStringify(actualSourcePaths) !== stableStringify(expectedSourcePaths)) {
        errors.push(`verification receipt ${receipt.id || '<missing-id>'} oracle source paths must exactly match acceptance`)
      } else if (contentPhase === 'post' && ['pass', 'disproved'].includes(receipt.outcome)) {
        for (const state of sourceStates) {
          const path = canonicalPathKey(state.path)
          const change = manifestChangesByPath.get(path)
          if (change && state.sha256 === change.postimageSha256 && state.mode === change.postimageMode) {
            successfulPostPaths.add(path)
          }
        }
      }
      const canonicalScopeStates = Array.isArray(scopeStates)
        ? scopeStates.map((state) => state && ({
          path: state.path,
          postimageSha256: state.postimageSha256,
          mode: state.mode,
        }))
        : []
      const scopePaths = Array.isArray(scopeStates) ? scopeStates.map((state) => canonicalPathKey(state?.path)) : []
      const sortedScopePaths = [...scopePaths].sort()
      const expectedScopePaths = (Array.isArray(manifest.changes) ? manifest.changes : [])
        .map((change) => canonicalPathKey(change?.path))
        .sort()
      const malformedScopeStates = !Array.isArray(scopeStates) || scopeStates.length === 0
        || scopeStates.some((state) => !state || !validRepoPath(state.path)
          || !SHA256_PATTERN.test(state.postimageSha256 || '')
          || !SHA256_PATTERN.test(state.observationToken || '')
          || ![null, 0o644, 0o755].includes(state.mode))
        || new Set(scopePaths).size !== scopePaths.length
        || stableStringify(scopePaths) !== stableStringify(sortedScopePaths)
        || sha256Value(canonicalScopeStates) !== oracleSource.scopeContentId
      if (malformedScopeStates) {
        errors.push(`verification receipt ${receipt.id || '<missing-id>'} scoped states are malformed or do not back scopeContentId`)
      }
      if (stableStringify(sortedScopePaths) !== stableStringify(expectedScopePaths)) {
        errors.push(`verification receipt ${receipt.id || '<missing-id>'} scoped states must exactly cover manifest changes`)
      }
      const measurementWindow = receiptMeasurementWindow(receipt, operationalMeasurement)
      const captureStartedAt = Date.parse(oracleSource.startedAt)
      const captureFinishedAt = Date.parse(oracleSource.finishedAt)
      const measurementStartedAt = Date.parse(measurementWindow.startedAt)
      const measurementFinishedAt = Date.parse(measurementWindow.finishedAt)
      if (!Number.isFinite(captureStartedAt) || !Number.isFinite(captureFinishedAt)
        || !Number.isFinite(measurementStartedAt) || !Number.isFinite(measurementFinishedAt)
        || captureStartedAt > measurementStartedAt || captureFinishedAt < measurementFinishedAt) {
        errors.push(`verification receipt ${receipt.id || '<missing-id>'} measurement must be enclosed by its oracle source capture window`)
      }
      if (contentPhase === 'pre'
        && (receipt.currentId !== oracleSource.scopeContentId || receipt.contentHash !== oracleSource.scopeContentId)) {
        errors.push(`stale verification receipt ${receipt.id || '<missing-id>'}: pre content must match captured scope state`)
      }
      if (contentPhase === 'post' && receipt.currentId !== oracleSource.scopeContentId) {
        errors.push(`stale verification receipt ${receipt.id || '<missing-id>'}: post content must match captured scope state`)
      }
    }
    if (nonEmptyString(receipt.command) && !Number.isInteger(receipt.exitCode)) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} with command requires integer exitCode`)
    }
    if (nonEmptyString(receipt.command) && !Number.isInteger(receipt.expectedExitCode)) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} with command requires integer expectedExitCode`)
    }
    if (Number.isInteger(receipt.expectedExitCode) && receipt.exitCode !== receipt.expectedExitCode) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} exitCode does not match expectedExitCode`)
    }
    if ((receipt.outcome === 'pass' || receipt.outcome === 'disproved') && nonEmptyString(receipt.command) && receipt.exitCode !== 0) {
      errors.push(`verification receipt ${receipt.id || '<missing-id>'} outcome=${receipt.outcome} requires exitCode=0`)
    }
    if (receipt.kind === 'test') {
      for (const field of ['testIdentity', 'runStartedAt', 'reportPath', 'reportMtime', 'reportHash', 'evidenceHash']) {
        if (!nonEmptyString(receipt[field])) errors.push(`test receipt ${receipt.id || '<missing-id>'} requires ${field}`)
      }
      for (const field of ['reportHash', 'evidenceHash']) {
        if (!SHA256_PATTERN.test(receipt[field] || '')) errors.push(`test receipt ${receipt.id || '<missing-id>'} requires SHA-256 ${field}`)
      }
      for (const field of ['executedCount', 'matchedTestCount', 'passedCount', 'failedCount', 'errorCount', 'skippedCount', 'abortedCount']) {
        if (!Number.isInteger(receipt[field]) || receipt[field] < 0) errors.push(`test receipt ${receipt.id || '<missing-id>'} requires non-negative integer ${field}`)
      }
      if (Number.isInteger(receipt.executedCount)
        && receipt.executedCount !== receipt.passedCount + receipt.failedCount + receipt.errorCount + receipt.skippedCount + receipt.abortedCount) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} executedCount must equal parsed result counts`)
      }
      if (!Number.isInteger(receipt.matchedTestCount) || receipt.matchedTestCount <= 0 || receipt.matchedTestCount > receipt.executedCount) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} requires 0 < matchedTestCount <= executedCount`)
      }
      if ((receipt.outcome === 'pass' || receipt.outcome === 'disproved')
        && (receipt.failedCount !== 0 || receipt.errorCount !== 0 || receipt.skippedCount !== 0 || receipt.abortedCount !== 0)) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} outcome=${receipt.outcome} requires failed/error/skipped/aborted counts=0`)
      }
      const measurement = receiptMeasurement(receipt, artifactsById)
      const countFields = ['executedCount', 'matchedTestCount', 'passedCount', 'failedCount', 'errorCount', 'skippedCount', 'abortedCount']
      for (const field of countFields) {
        if (measurement && measurement[field] !== receipt[field]) errors.push(`test receipt ${receipt.id || '<missing-id>'} ${field} must be derived from measurement artifact`)
      }
      if (measurement && measurement.exitCode !== receipt.exitCode) errors.push(`test receipt ${receipt.id || '<missing-id>'} exitCode must be derived from measurement artifact`)
      if (measurement && measurement.testIdentity !== receipt.testIdentity) errors.push(`test receipt ${receipt.id || '<missing-id>'} testIdentity must match measurement artifact`)
      if (measurement && measurement.scenarioFingerprint !== receipt.scenarioFingerprint) errors.push(`test receipt ${receipt.id || '<missing-id>'} scenarioFingerprint must match measurement artifact`)
      for (const field of ['command', 'runStartedAt', 'reportPath', 'reportMtime', 'reportHash', 'evidenceHash']) {
        if (!measurement || measurement[field] !== receipt[field]) errors.push(`test receipt ${receipt.id || '<missing-id>'} ${field} must be derived from measurement artifact`)
      }
      const measurementArgs = measurement && Array.isArray(measurement.commandArgs) ? measurement.commandArgs : []
      const executable = measurement?.executable
      if (!nonEmptyString(executable) || !Array.isArray(measurement?.commandArgs)
        || measurementArgs.some((argument) => !nonEmptyString(argument) || /[\u0000-\u001f\u007f]/.test(argument))) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} requires structured executable and commandArgs`)
      }
      const expectedCommand = nonEmptyString(executable) ? [executable, ...measurementArgs].join(' ') : null
      if (expectedCommand && receipt.command !== expectedCommand) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} command must exactly match structured executable/commandArgs`)
      }
      const executableIsGradle = nonEmptyString(executable) && /(^|\/)gradlew(?:\.bat)?$/.test(executable)
      const isGradle = measurement?.runner === 'gradle' && executableIsGradle
      if (!isGradle) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} requires runner=gradle with gradlew as the direct executable`)
      } else {
        if (!measurementArgs.includes('--rerun-tasks')) {
          errors.push(`test receipt ${receipt.id || '<missing-id>'} Gradle execution requires --rerun-tasks`)
        }
        const connected = /connected.*AndroidTest/i.test(String(measurement?.task || '')) || measurementArgs.some((token) => /connected.*AndroidTest/i.test(token))
        if (connected && measurementArgs.some((token) => token === '--tests' || token.startsWith('--tests='))) {
          errors.push(`test receipt ${receipt.id || '<missing-id>'} connected Android test cannot use --tests`)
        }
      }
      if (receipt.outcome === 'validated' && measurement) {
        if (!['ASSERTION', 'EXPECTED_EXCEPTION', 'OBSERVED_SYMPTOM'].includes(measurement.failureKind)) {
          errors.push(`test receipt ${receipt.id || '<missing-id>'} validated RED requires a genuine failureKind`)
        }
        if (receipt.exitCode === 0 || receipt.failedCount + receipt.errorCount <= 0) {
          errors.push(`test receipt ${receipt.id || '<missing-id>'} validated RED requires nonzero exit and failed/error count`)
        }
      }
      const runStarted = Date.parse(receipt.runStartedAt)
      const reportMtime = Date.parse(receipt.reportMtime)
      if (!Number.isFinite(runStarted) || !Number.isFinite(reportMtime) || reportMtime < runStarted || reportMtime > executedAt) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} requires runStartedAt <= reportMtime <= executedAt`)
      }
      if (Number.isFinite(runStarted) && runStarted < runStartedAt || Number.isFinite(reportMtime) && reportMtime < runStartedAt) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} evidence must be captured in the current session`)
      }
      if (contentPhase === 'post' && (!Number.isFinite(runStarted) || runStarted < lastEditFinishedAt
        || !Number.isFinite(reportMtime) || reportMtime < lastEditFinishedAt)) {
        errors.push(`test receipt ${receipt.id || '<missing-id>'} post evidence must start after last edit finishes`)
      }
    }
    if (receipt.kind === 'runtime') {
      for (const field of ['deviceId', 'variant', 'oracle', 'trigger', 'actual', 'runStartedAt', 'capturedAt', 'evidenceRef', 'evidenceHash']) {
        if (!nonEmptyString(receipt[field])) errors.push(`runtime receipt ${receipt.id || '<missing-id>'} requires ${field}`)
      }
      if (!SHA256_PATTERN.test(receipt.evidenceHash || '')) errors.push(`runtime receipt ${receipt.id || '<missing-id>'} requires SHA-256 evidenceHash`)
      for (const field of ['crashCount', 'anrCount', 'appErrorCount']) {
        if (!Number.isInteger(receipt[field]) || receipt[field] < 0) errors.push(`runtime receipt ${receipt.id || '<missing-id>'} requires non-negative integer ${field}`)
      }
      const runStarted = Date.parse(receipt.runStartedAt)
      const capturedAt = Date.parse(receipt.capturedAt)
      if (!Number.isFinite(runStarted) || !Number.isFinite(capturedAt) || capturedAt < runStarted || capturedAt > executedAt) {
        errors.push(`runtime receipt ${receipt.id || '<missing-id>'} requires runStartedAt <= capturedAt <= executedAt`)
      }
      if (Number.isFinite(runStarted) && runStarted < runStartedAt || Number.isFinite(capturedAt) && capturedAt < runStartedAt) {
        errors.push(`runtime receipt ${receipt.id || '<missing-id>'} evidence must be captured in the current session`)
      }
      if (contentPhase === 'post' && (!Number.isFinite(runStarted) || runStarted < lastEditFinishedAt
        || !Number.isFinite(capturedAt) || capturedAt < lastEditFinishedAt)) {
        errors.push(`runtime receipt ${receipt.id || '<missing-id>'} post evidence must start after last edit finishes`)
      }
      if (receipt.outcome === 'pass' && (receipt.crashCount !== 0 || receipt.anrCount !== 0 || receipt.appErrorCount !== 0)) {
        errors.push(`runtime receipt ${receipt.id || '<missing-id>'} outcome=pass requires crash/anr/appError counts=0`)
      }
      const measurement = receiptMeasurement(receipt, artifactsById)
      for (const field of ['deviceId', 'variant', 'trigger', 'actual', 'crashCount', 'anrCount', 'appErrorCount', 'runStartedAt', 'capturedAt', 'evidenceHash']) {
        if (measurement && measurement[field] !== receipt[field]) errors.push(`runtime receipt ${receipt.id || '<missing-id>'} ${field} must be derived from measurement artifact`)
      }
      for (const field of ['packageName', 'buildId', 'captureFilter', 'fixtureHash', 'appArtifactSha256', 'sourceContentId']) {
        if (!measurement || !nonEmptyString(measurement[field])) errors.push(`runtime receipt ${receipt.id || '<missing-id>'} measurement requires ${field}`)
      }
      if (measurement && !SHA256_PATTERN.test(measurement.appArtifactSha256 || '')) {
        errors.push(`runtime receipt ${receipt.id || '<missing-id>'} measurement requires SHA-256 appArtifactSha256`)
      }
      if (measurement && measurement.sourceContentId !== receipt.currentId) {
        errors.push(`runtime receipt ${receipt.id || '<missing-id>'} sourceContentId must match bound content phase`)
      }
      if ((receipt.outcome === 'pass' || receipt.outcome === 'disproved') && measurement
        && (measurement.crashCount !== 0 || measurement.anrCount !== 0 || measurement.appErrorCount !== 0)) {
        errors.push(`runtime receipt ${receipt.id || '<missing-id>'} outcome=${receipt.outcome} cannot resolve with observed crash/anr/appError`)
      }
    }
    if (receipt.kind === 'command') {
      for (const field of ['locator', 'oracle', 'expected', 'actual', 'outputHash']) {
        if (!nonEmptyString(receipt[field])) errors.push(`command receipt ${receipt.id || '<missing-id>'} requires ${field}`)
      }
      if (!SHA256_PATTERN.test(receipt.outputHash || '')) errors.push(`command receipt ${receipt.id || '<missing-id>'} requires SHA-256 outputHash`)
      if (!nonEmptyString(receipt.command)) errors.push(`command receipt ${receipt.id || '<missing-id>'} requires command`)
      const measurement = receiptMeasurement(receipt, artifactsById)
      const measurementArgs = measurement && Array.isArray(measurement.commandArgs) ? measurement.commandArgs : []
      if (!measurement || !nonEmptyString(measurement.executable) || !Array.isArray(measurement.commandArgs)
        || measurementArgs.some((argument) => !nonEmptyString(argument) || /[\u0000-\u001f\u007f]/.test(argument))
        || receipt.command !== [measurement.executable, ...measurementArgs].join(' ')) {
        errors.push(`command receipt ${receipt.id || '<missing-id>'} requires exact structured executable/commandArgs`)
      }
      const executableName = String(measurement?.executable || '').split('/').at(-1).toLowerCase()
      const shellExecutables = new Set(['sh', 'bash', 'dash', 'zsh', 'ksh', 'fish', 'csh', 'tcsh', 'ash', 'busybox', 'cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'])
      const commandIsGradle = /gradlew(?:\.bat)?$/i.test(executableName) || measurement?.runner === 'gradle'
        || measurementArgs.some((argument) => /gradlew(?:\.bat)?/i.test(argument))
      if (!['direct', 'gradle'].includes(measurement?.runner) || shellExecutables.has(executableName)) {
        errors.push(`command receipt ${receipt.id || '<missing-id>'} requires a direct non-shell runner`)
      }
      if (commandIsGradle && (measurement?.runner !== 'gradle' || !/gradlew(?:\.bat)?$/i.test(executableName)
        || !measurementArgs.includes('--rerun-tasks'))) {
        errors.push(`command receipt ${receipt.id || '<missing-id>'} Gradle command requires direct gradlew argv with --rerun-tasks`)
      }
      if (measurement && measurement.exitCode !== receipt.exitCode) errors.push(`command receipt ${receipt.id || '<missing-id>'} exitCode must be derived from measurement artifact`)
      if (measurement && measurement.outputHash !== receipt.outputHash) errors.push(`command receipt ${receipt.id || '<missing-id>'} outputHash must be derived from measurement artifact`)
      const commandStarted = Date.parse(measurement?.runStartedAt)
      const commandCaptured = Date.parse(measurement?.capturedAt)
      if (!measurement || measurement.command !== receipt.command || !Number.isFinite(commandStarted) || !Number.isFinite(commandCaptured)
        || commandCaptured < commandStarted || commandCaptured > executedAt) {
        errors.push(`command receipt ${receipt.id || '<missing-id>'} requires measured command and runStartedAt <= capturedAt <= executedAt`)
      }
      if (Number.isFinite(commandStarted) && commandStarted < runStartedAt || Number.isFinite(commandCaptured) && commandCaptured < runStartedAt) {
        errors.push(`command receipt ${receipt.id || '<missing-id>'} evidence must be captured in the current session`)
      }
      if (contentPhase === 'post' && (!Number.isFinite(commandStarted) || commandStarted < lastEditFinishedAt
        || !Number.isFinite(commandCaptured) || commandCaptured < lastEditFinishedAt)) {
        errors.push(`command receipt ${receipt.id || '<missing-id>'} post evidence must start after last edit finishes`)
      }
      if ((receipt.outcome === 'pass' || receipt.outcome === 'disproved') && !oracleResult.pass) {
        errors.push(`command receipt ${receipt.id || '<missing-id>'} machine oracle did not pass`)
      }
    }
    if (['test', 'runtime'].includes(receipt.kind) && (receipt.outcome === 'pass' || receipt.outcome === 'disproved') && !oracleResult.pass) {
      errors.push(`${receipt.kind} receipt ${receipt.id || '<missing-id>'} machine oracle did not pass`)
    }
    if (operationalReceipt) {
      const failureFingerprint = receiptFailureFingerprint(receipt, artifactsById)
      if (receipt.outcome === 'validated' && !failureFingerprint) {
        errors.push(`verification receipt ${receipt.id || '<missing-id>'} validated RED requires measured failureSignature`)
      }
      if (receipt.failureFingerprint !== undefined && receipt.failureFingerprint !== failureFingerprint) {
        errors.push(`verification receipt ${receipt.id || '<missing-id>'} failureFingerprint must be derived from measured failureSignature`)
      }
    }
    if (receipt.kind === 'scope-manifest' || receipt.kind === 'manual-review') {
      if (receipt.outcome !== 'reviewed') errors.push(`${receipt.kind} receipt ${receipt.id || '<missing-id>'} requires outcome=reviewed`)
    }
    if (errors.length === receiptErrorStart && successfulPostPaths.size > 0) {
      successfulPostOraclePathsByReceipt.set(receipt.id, successfulPostPaths)
    }
  }
  const receiptById = receiptMapOf(receipts.filter((receipt) => receipt && nonEmptyString(receipt.id)))
  const manifestReceipt = receiptById.get(manifest.manifestReceiptId)
  if (!manifestReceipt
    || manifestReceipt.kind !== 'scope-manifest'
    || manifestReceipt.outcome !== 'reviewed'
    || manifestReceipt.key !== `scope-manifest:${manifest.scopeFingerprint}:${manifest.currentId}`) {
    errors.push('scopeManifest.manifestReceiptId must reference an artifact-driver scope-manifest receipt bound to scopeFingerprint/currentId')
  } else if (manifestReceipt.priorAuditStateDigest !== manifest.priorAuditStateDigest) {
    errors.push('scope-manifest receipt priorAuditStateDigest mismatch')
  }

  const changes = Array.isArray(manifest.changes) ? manifest.changes : []
  const changeIds = new Set()
  const changePaths = new Set()
  const preExistingPaths = new Set()
  if (Array.isArray(manifest.preExistingDirtyPaths)) {
    for (const path of manifest.preExistingDirtyPaths) {
      if (!validRepoPath(path)) errors.push(`invalid pre-existing dirty path: ${path}`)
      const canonical = canonicalPathKey(path)
      if (preExistingPaths.has(canonical)) errors.push(`duplicate pre-existing dirty path: ${path}`)
      preExistingPaths.add(canonical)
    }
  }
  let measuredDiffLines = 0
  for (const change of changes) {
    if (!change || typeof change !== 'object') {
      errors.push('every scope change must be an object')
      continue
    }
    if (!nonEmptyString(change.id)) errors.push('scope change id is required')
    if (changeIds.has(change.id)) errors.push(`duplicate scope change id: ${change.id}`)
    changeIds.add(change.id)
    if (!validRepoPath(change.path)) errors.push(`scope change ${change.id || '<missing-id>'} requires canonical repo-relative path`)
    const canonicalChangePath = canonicalPathKey(change.path)
    if (changePaths.has(canonicalChangePath)) errors.push(`duplicate canonical scope change path: ${change.path}`)
    changePaths.add(canonicalChangePath)
    if (!VALID_KINDS.has(change.kind)) errors.push(`scope change ${change.id || '<missing-id>'} has unsupported kind: ${change.kind}`)
    if (!CHANGE_STATUS.has(change.status)) errors.push(`scope change ${change.id || '<missing-id>'} has invalid status: ${change.status}`)
    if (change.status === 'renamed') {
      if (!validRepoPath(change.previousPath) || canonicalPathKey(change.previousPath) === canonicalChangePath) {
        errors.push(`scope change ${change.id || '<missing-id>'} renamed status requires a distinct canonical previousPath`)
      }
    } else if (change.previousPath !== undefined && change.previousPath !== null) {
      errors.push(`scope change ${change.id || '<missing-id>'} previousPath is only valid for renamed status`)
    }
    if (change.ownership !== 'task') errors.push(`scope change ${change.id || '<missing-id>'} must have ownership=task`)
    if (!Number.isInteger(change.added) || change.added < 0 || !Number.isInteger(change.deleted) || change.deleted < 0) {
      errors.push(`scope change ${change.id || '<missing-id>'} requires non-negative integer added/deleted counts`)
    } else {
      measuredDiffLines += change.added + change.deleted
    }
    if (!SHA256_PATTERN.test(change.patchHash || '')) errors.push(`scope change ${change.id || '<missing-id>'} requires SHA-256 patchHash`)
    if (!nonEmptyString(change.patchArtifactId)) errors.push(`scope change ${change.id || '<missing-id>'} requires patchArtifactId`)
    const patchArtifact = artifactsById.get(change.patchArtifactId)
    const expectedPatchMediaType = change.kind === 'binary' ? 'application/vnd.exampleapp.binary-evidence' : 'text/x-diff'
    if (!patchArtifact || patchArtifact.mediaType !== expectedPatchMediaType || !artifactText(patchArtifact)) {
      errors.push(`scope change ${change.id || '<missing-id>'} requires inline ${expectedPatchMediaType} artifact`)
    } else {
      if (patchArtifact.sha256 !== change.patchHash) errors.push(`scope change ${change.id || '<missing-id>'} patchHash must match patch artifact`)
      const patchText = artifactText(patchArtifact)
      errors.push(...patchBindingErrors(patchText, change).map((error) => `scope change ${change.id || '<missing-id>'} ${error}`))
      const measuredPatch = countPatchLines(patchText)
      if (measuredPatch && (measuredPatch.added !== change.added || measuredPatch.deleted !== change.deleted)) {
        errors.push(`scope change ${change.id || '<missing-id>'} added/deleted counts must match exact patch artifact`)
      }
    }
    if (change.kind === 'binary') {
      const binaryArtifact = artifactsById.get(change.binaryArtifactId)
      const expectedBinarySha256 = change.status === 'deleted' ? change.preimageSha256 : change.postimageSha256
      if (!nonEmptyString(change.binaryArtifactId) || !binaryArtifact
        || binaryArtifact.mediaType !== 'application/octet-stream' || binaryArtifact.sha256 !== expectedBinarySha256) {
        errors.push(`scope change ${change.id || '<missing-id>'} binary change requires exact application/octet-stream pre/postimage artifact`)
      }
      const baselineArtifact = artifactsById.get(change.binaryBaselineArtifactId)
      if (change.status === 'modified') {
        if (!nonEmptyString(change.binaryBaselineArtifactId) || !baselineArtifact
          || baselineArtifact.mediaType !== 'application/octet-stream' || baselineArtifact.sha256 !== change.preimageSha256) {
          errors.push(`scope change ${change.id || '<missing-id>'} modified binary requires exact application/octet-stream baseline artifact`)
        }
      } else if (change.binaryBaselineArtifactId !== undefined && change.binaryBaselineArtifactId !== null) {
        errors.push(`scope change ${change.id || '<missing-id>'} binaryBaselineArtifactId is only valid for modified binary changes`)
      }
    } else if (change.binaryArtifactId !== undefined && change.binaryArtifactId !== null) {
      errors.push(`scope change ${change.id || '<missing-id>'} binaryArtifactId is only valid for binary changes`)
    } else if (change.binaryBaselineArtifactId !== undefined && change.binaryBaselineArtifactId !== null) {
      errors.push(`scope change ${change.id || '<missing-id>'} binaryBaselineArtifactId is only valid for binary changes`)
    }
    for (const field of ['preimageSha256', 'postimageSha256']) {
      if (!SHA256_PATTERN.test(change[field] || '')) errors.push(`scope change ${change.id || '<missing-id>'} requires ${field}`)
    }
    const changeFirstEditStartedAt = Date.parse(change.firstEditStartedAt)
    const changeLastEditFinishedAt = Date.parse(change.lastEditFinishedAt)
    if (!Number.isFinite(changeFirstEditStartedAt) || !Number.isFinite(changeLastEditFinishedAt)
      || changeLastEditFinishedAt < changeFirstEditStartedAt) {
      errors.push(`scope change ${change.id || '<missing-id>'} requires ordered firstEditStartedAt/lastEditFinishedAt`)
    }
    for (const field of ['preimageMode', 'postimageMode']) {
      if (!(change[field] === null || change[field] === 0o644 || change[field] === 0o755)) {
        errors.push(`scope change ${change.id || '<missing-id>'} requires ${field} as null or Git-representable mode 644|755`)
      }
    }
    const absentSha256 = sha256Text('ABSENT')
    if (change.status === 'added' || change.status === 'untracked') {
      if (change.preimageSha256 !== absentSha256 || change.preimageMode !== null || change.postimageMode === null
        || change.postimageSha256 === absentSha256) {
        errors.push(`scope change ${change.id || '<missing-id>'} ${change.status} status requires absent preimage and present postimage`)
      }
    } else if (change.status === 'deleted') {
      if (change.postimageSha256 !== absentSha256 || change.postimageMode !== null || change.preimageMode === null
        || change.preimageSha256 === absentSha256) {
        errors.push(`scope change ${change.id || '<missing-id>'} deleted status requires present preimage and absent postimage`)
      }
    } else if (['modified', 'renamed'].includes(change.status)) {
      if (change.preimageMode === null || change.postimageMode === null
        || change.preimageSha256 === absentSha256 || change.postimageSha256 === absentSha256) {
        errors.push(`scope change ${change.id || '<missing-id>'} ${change.status} status requires present preimage and postimage`)
      }
      if (change.status === 'modified' && change.kind !== 'binary' && change.added + change.deleted > 0
        && change.preimageSha256 === change.postimageSha256) {
        errors.push(`scope change ${change.id || '<missing-id>'} content patch requires different pre/post content hashes`)
      }
    }
    if (!['none', 'approved', 'ambiguous'].includes(change.overlap)) errors.push(`scope change ${change.id || '<missing-id>'} requires overlap classification`)
    if (change.overlap === 'ambiguous') errors.push(`scope change ${change.id || '<missing-id>'} has ambiguous dirty-hunk ownership`)
    if (typeof change.overlapsPreExisting !== 'boolean') {
      errors.push(`scope change ${change.id || '<missing-id>'} requires explicit overlapsPreExisting boolean`)
    }
    if (preExistingPaths.has(canonicalChangePath) && change.overlapsPreExisting !== true) {
      errors.push(`scope change ${change.id || '<missing-id>'} intersects preExistingDirtyPaths and must set overlapsPreExisting=true`)
    }
    if ((preExistingPaths.has(canonicalChangePath) || change.overlapsPreExisting === true) && change.overlap !== 'approved') {
      errors.push(`scope change ${change.id || '<missing-id>'} overlapping pre-existing work requires overlap=approved`)
    }
    if (change.overlap === 'approved' && change.overlapsPreExisting !== true) {
      errors.push(`scope change ${change.id || '<missing-id>'} overlap=approved requires overlapsPreExisting=true`)
    }
    if ((change.kind === 'binary' || change.overlapsPreExisting === true) && !nonEmptyString(change.manualReviewReceiptId)) {
      errors.push(`scope change ${change.id || '<missing-id>'} requires manualReviewReceiptId`)
    }
    if ((change.kind === 'binary' || change.overlapsPreExisting === true) && !SHA256_PATTERN.test(change.approvalDigest || '')) {
      errors.push(`scope change ${change.id || '<missing-id>'} requires approvalDigest`)
    }
    if (nonEmptyString(change.manualReviewReceiptId)) {
      const manualReceipt = receiptById.get(change.manualReviewReceiptId)
      if (!manualReceipt) {
        errors.push(`scope change ${change.id || '<missing-id>'} references missing manual review receipt ${change.manualReviewReceiptId}`)
      } else if (manualReceipt.kind !== 'manual-review' || manualReceipt.outcome !== 'reviewed' || manualReceipt.key !== `scope:${change.id}`
        || manualReceipt.approvalDigest !== change.approvalDigest) {
        errors.push(`scope change ${change.id || '<missing-id>'} manual review receipt must bind kind/outcome/key/approvalDigest`)
      }
    }
  }
  if (Number.isInteger(manifest.diffLines) && manifest.diffLines !== measuredDiffLines) {
    errors.push(`scopeManifest.diffLines=${manifest.diffLines} does not equal summed change lines=${measuredDiffLines}`)
  }
  if (changes.every((change) => change && typeof change === 'object' && !Array.isArray(change))) {
    const recomputedBaselineContentId = sha256Value(changes
      .map((change) => ({ path: change.path, preimageSha256: change.preimageSha256, mode: change.preimageMode }))
      .sort((left, right) => String(left.path).localeCompare(String(right.path))))
    if (manifest.baselineContentId !== recomputedBaselineContentId) {
      errors.push(`scopeManifest.baselineContentId mismatch: expected ${recomputedBaselineContentId}`)
    }
    const recomputedCurrentId = sha256Value(changes
      .map((change) => ({ path: change.path, postimageSha256: change.postimageSha256, mode: change.postimageMode }))
      .sort(compareCanonicalPathItems))
    if (manifest.currentId !== recomputedCurrentId) {
      errors.push(`scopeManifest.currentId mismatch: expected ${recomputedCurrentId}`)
    }
    const recomputedScopeFingerprint = sha256Value({
      sessionId: input.runId,
      headCommit: manifest.baselineId,
      paths: changes.map((change) => change.path),
    })
    if (manifest.scopeFingerprint !== recomputedScopeFingerprint) {
      errors.push(`scopeManifest.scopeFingerprint mismatch: expected ${recomputedScopeFingerprint}`)
    }
    const recomputedContentHash = expectedManifestContentHash(manifest)
    if (manifest.contentHash !== recomputedContentHash) {
      errors.push(`scopeManifest.contentHash mismatch: expected ${recomputedContentHash}`)
    }
  }
  const ownedPaths = Array.isArray(manifest.ownedPaths) ? manifest.ownedPaths : []
  const normalizedOwnedPaths = new Set()
  for (const path of ownedPaths) {
    if (!validRepoPath(path)) errors.push(`invalid owned path: ${path}`)
    normalizedOwnedPaths.add(canonicalPathKey(path))
  }
  if (normalizedOwnedPaths.size !== ownedPaths.length) errors.push('scopeManifest.ownedPaths contains duplicates')
  if (changePaths.size !== normalizedOwnedPaths.size || [...changePaths].some((path) => !normalizedOwnedPaths.has(path))) {
    errors.push('scopeManifest.ownedPaths must exactly match scopeManifest.changes paths')
  }

  const roleBoundOracleSupportPaths = new Set()
  const ledger = input.ledger
  if (!ledger || typeof ledger !== 'object' || !Array.isArray(ledger.entries)) {
    errors.push('ledger.entries is required')
    return errors
  }
  const ledgerKeys = new Set()
  for (const entry of ledger.entries) {
    if (!entry || typeof entry !== 'object') {
      errors.push('every ledger entry must be an object')
      continue
    }
    const ledgerEntryErrorStart = errors.length
    if (!nonEmptyString(entry.key)) errors.push('ledger entry key is required')
    if (nonEmptyString(entry.key) && entry.key !== normalizeToken(entry.key)) {
      errors.push(`ledger entry key must use canonical normalized form: ${entry.key}`)
    }
    if (ledgerKeys.has(entry.key)) errors.push(`conflicting/duplicate ledger state for key: ${entry.key}`)
    ledgerKeys.add(entry.key)
    if (!VALID_STATUSES.has(entry.status)) errors.push(`invalid ledger status for ${entry.key || '<missing-key>'}: ${entry.status}`)
    if (!['open', 'blocked'].includes(entry.status) && !nonEmptyString(entry.receiptId)) {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} requires receiptId`)
    }
    const receipt = nonEmptyString(entry.receiptId) ? receiptById.get(entry.receiptId) : null
    if (nonEmptyString(entry.receiptId) && !receipt) {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} references missing receipt ${entry.receiptId}`)
    } else if (receipt && receipt.key !== entry.key) {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} receipt key mismatch`)
    }
    const expectedOutcome = { open: 'validated', fixed: 'pass', deferred: 'validated', rejected: 'disproved' }[entry.status]
    if (receipt && expectedOutcome && receipt.outcome !== expectedOutcome) {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} requires receipt outcome=${expectedOutcome}`)
    }
    if (!['open', 'blocked'].includes(entry.status) && receipt && !['test', 'runtime', 'command'].includes(receipt.kind)) {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} requires test/runtime/command receipt`)
    }
    if (entry.status === 'open' && receipt && !['test', 'runtime', 'command'].includes(receipt.kind)) {
      errors.push(`validated open ledger entry ${entry.key || '<missing-key>'} requires test/runtime/command receipt`)
    }
    if (entry.status === 'rejected' && receipt && !nonEmptyString(receipt.evidenceFingerprint)) {
      errors.push(`rejected ledger entry ${entry.key || '<missing-key>'} requires receipt evidenceFingerprint`)
    }
    if (entry.status === 'rejected' && receipt && !SHA256_PATTERN.test(receipt.findingFingerprint || '')) {
      errors.push(`rejected ledger entry ${entry.key || '<missing-key>'} requires receipt findingFingerprint`)
    }
    if (entry.status === 'rejected' && receipt) {
      const measurement = receiptMeasurement(receipt, artifactsById)
      if (measurement?.findingFingerprint !== receipt.findingFingerprint
        || measurement?.evidenceFingerprint !== receipt.evidenceFingerprint) {
        errors.push(`rejected ledger entry ${entry.key || '<missing-key>'} finding/evidence fingerprints must be derived from measurement artifact`)
      }
    }
    if (receipt && ['fixed', 'rejected'].includes(entry.status) && !receiptOracleResult(receipt, artifactsById).pass) {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} requires a passing machine oracle`)
    }
    if (receipt && ['fixed', 'rejected'].includes(entry.status) && receipt.contentPhase !== 'post') {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} requires post-fix content receipt`)
    }
    if (receipt && ['open', 'deferred'].includes(entry.status) && receipt.contentPhase !== 'post') {
      errors.push(`${entry.status} ledger entry ${entry.key || '<missing-key>'} requires post-fix content receipt`)
    }
    if (entry.status === 'deferred' && (!nonEmptyString(entry.reason) || !nonEmptyString(entry.followUp))) {
      errors.push(`deferred ledger entry ${entry.key || '<missing-key>'} requires reason and followUp`)
    }
    if (entry.status === 'deferred' && !Object.hasOwn(SEVERITY_ORDER, entry.severity)) {
      errors.push(`deferred ledger entry ${entry.key || '<missing-key>'} requires severity=P0|P1|P2|P3`)
    }
    if (entry.status === 'rejected' && !nonEmptyString(entry.rationale)) {
      errors.push(`rejected ledger entry ${entry.key || '<missing-key>'} requires rationale`)
    }
    if (entry.status === 'blocked' && (!nonEmptyString(entry.reason) || !nonEmptyString(entry.followUp))) {
      errors.push(`blocked ledger entry ${entry.key || '<missing-key>'} requires reason and followUp`)
    }
    if (entry.status === 'rejected' && errors.length === ledgerEntryErrorStart) {
      for (const path of successfulPostOraclePathsByReceipt.get(receipt?.id) || []) roleBoundOracleSupportPaths.add(path)
    }
  }

  if (!Array.isArray(input.regressionProofs)) errors.push('regressionProofs must be an array')
  const proofIds = new Set()
  const fixedReceiptIds = new Set(ledger.entries.filter((entry) => entry && entry.status === 'fixed').map((entry) => entry.receiptId))
  const provenFixedReceipts = new Set()
  for (const proof of Array.isArray(input.regressionProofs) ? input.regressionProofs : []) {
    if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
      errors.push('every regression proof must be an object')
      continue
    }
    const proofErrorStart = errors.length
    if (!nonEmptyString(proof.id) || proofIds.has(proof.id)) errors.push(`invalid/duplicate regression proof id: ${proof.id}`)
    proofIds.add(proof.id)
    if (!acceptanceIds.has(proof.acceptanceId)) errors.push(`regression proof ${proof.id || '<missing-id>'} references unknown acceptanceId`)
    const post = receiptById.get(proof.postReceiptId)
    if (!post || post.outcome !== 'pass' || !receiptOracleResult(post, artifactsById).pass) {
      errors.push(`regression proof ${proof.id || '<missing-id>'} requires passing postReceiptId`)
      continue
    }
    if (post.acceptanceId !== proof.acceptanceId) errors.push(`regression proof ${proof.id || '<missing-id>'} post receipt acceptance mismatch`)
    if (post.contentPhase !== 'post' || Date.parse(post.executedAt) < lastEditFinishedAt) {
      errors.push(`regression proof ${proof.id || '<missing-id>'} requires post-fix receipt after last edit finishes`)
    }
    if (Object.hasOwn(proof, 'waiver')) {
      errors.push(`regression proof ${proof.id || '<missing-id>'} cannot waive an executed pre-fix oracle`)
    }
    const pre = receiptById.get(proof.preReceiptId)
    if (!pre || pre.outcome !== 'validated' || receiptOracleResult(pre, artifactsById).pass) {
      errors.push(`regression proof ${proof.id || '<missing-id>'} requires genuine failing pre-fix acceptance oracle`)
    } else {
      if (pre.acceptanceId !== post.acceptanceId || pre.scenarioFingerprint !== post.scenarioFingerprint) {
        errors.push(`regression proof ${proof.id || '<missing-id>'} RED/GREEN scenario mismatch`)
      }
      if (pre.key !== post.key) {
        errors.push(`regression proof ${proof.id || '<missing-id>'} RED/GREEN fixed key mismatch`)
      }
      if (pre.kind !== post.kind || receiptExecutionIdentity(pre, artifactsById) !== receiptExecutionIdentity(post, artifactsById)) {
        errors.push(`regression proof ${proof.id || '<missing-id>'} RED/GREEN execution identity mismatch`)
      }
      if (pre.contentPhase !== 'pre') {
        errors.push(`regression proof ${proof.id || '<missing-id>'} requires pre/post content phases`)
      }
      const implementationPath = canonicalPathKey(String(post.key || '').split('|')[0])
      const implementationChange = changes.find((change) => change && canonicalPathKey(change.path) === implementationPath)
      const implementationEditStartedAt = Date.parse(implementationChange?.firstEditStartedAt)
      const preMeasurement = receiptMeasurement(pre, artifactsById)
      const preFinishedAt = Date.parse(
        pre.kind === 'test' ? pre.reportMtime
          : pre.kind === 'runtime' ? pre.capturedAt
            : preMeasurement?.capturedAt,
      )
      if (!implementationChange || !Number.isFinite(implementationEditStartedAt)) {
        errors.push(`regression proof ${proof.id || '<missing-id>'} cannot bind its fixed key to an implementation change`)
      } else if (!Number.isFinite(preFinishedAt) || preFinishedAt >= implementationEditStartedAt) {
        errors.push(`regression proof ${proof.id || '<missing-id>'} requires RED before the associated implementation edit`)
      }
    }
    if (errors.length === proofErrorStart) {
      provenFixedReceipts.add(post.id)
      for (const path of successfulPostOraclePathsByReceipt.get(post.id) || []) roleBoundOracleSupportPaths.add(path)
    }
  }
  for (const receiptId of fixedReceiptIds) {
    if (!provenFixedReceipts.has(receiptId)) errors.push(`fixed receipt ${receiptId} requires executed RED/GREEN proof`)
  }
  for (const acceptance of Array.isArray(input.acceptance) ? input.acceptance : []) {
    if (acceptance && acceptance.mandatory && !(Array.isArray(input.regressionProofs) && input.regressionProofs.some((proof) => proof && proof.acceptanceId === acceptance.id))) {
      errors.push(`mandatory acceptance ${acceptance.id} requires regression proof`)
    }
  }
  if (!Array.isArray(input.verificationGates)) errors.push('verificationGates must be an array')
  const gateIds = new Set()
  const gateChecks = new Set()
  for (const gate of Array.isArray(input.verificationGates) ? input.verificationGates : []) {
    if (!gate || typeof gate !== 'object' || Array.isArray(gate) || !nonEmptyString(gate.id) || typeof gate.mandatory !== 'boolean' || typeof gate.applicable !== 'boolean'
      || !['test', 'runtime', 'command'].includes(gate.kind) || !nonEmptyString(gate.checkKey)
      || !acceptanceIds.has(gate.acceptanceId) || !nonEmptyString(gate.scenarioFingerprint)
      || !SHA256_PATTERN.test(gate.executionIdentity || '')) {
      errors.push('every verification gate requires id, mandatory, applicable, kind, checkKey, acceptanceId, scenarioFingerprint, executionIdentity')
      continue
    }
    const gateErrorStart = errors.length
    const gateCheck = [gate.kind, normalizeToken(gate.checkKey), gate.acceptanceId, gate.scenarioFingerprint].join('|')
    if (gateIds.has(gate.id)) errors.push(`duplicate verification gate id: ${gate.id}`)
    if (gateChecks.has(gateCheck)) errors.push(`duplicate verification gate check: ${gate.checkKey}`)
    gateIds.add(gate.id)
    gateChecks.add(gateCheck)
    const gateAcceptance = input.acceptance.find((acceptance) => acceptance.id === gate.acceptanceId)
    if (gateAcceptance && gate.scenarioFingerprint !== gateAcceptance.scenarioFingerprint) {
      errors.push(`verification gate ${gate.id} scenarioFingerprint must match acceptance`)
    }
    if (gate.applicable && nonEmptyString(gate.finalReceiptId) && !receiptById.has(gate.finalReceiptId)) {
      errors.push(`verification gate ${gate.id} references missing final receipt`)
    }
    if (nonEmptyString(gate.baselineReceiptId) && !receiptById.has(gate.baselineReceiptId)) {
      errors.push(`verification gate ${gate.id} references missing baseline receipt`)
    }
    if (!gate.applicable && !gate.mandatory
      && (!nonEmptyString(gate.notApplicableReason) || !nonEmptyString(gate.notApplicableEvidence))) {
      errors.push(`optional verification gate ${gate.id} marked not applicable requires reason and evidence`)
    }
    const finalReceipt = receiptById.get(gate.finalReceiptId)
    if (errors.length === gateErrorStart && gate.applicable && finalReceipt
      && finalReceipt.kind === gate.kind && finalReceipt.key === gate.checkKey
      && finalReceipt.acceptanceId === gate.acceptanceId
      && finalReceipt.scenarioFingerprint === gate.scenarioFingerprint
      && receiptExecutionIdentity(finalReceipt, artifactsById) === gate.executionIdentity
      && finalReceipt.contentPhase === 'post' && finalReceipt.outcome === 'pass'
      && receiptOracleResult(finalReceipt, artifactsById).pass) {
      for (const path of successfulPostOraclePathsByReceipt.get(finalReceipt.id) || []) roleBoundOracleSupportPaths.add(path)
    }
  }
  const changedOracleSupportPaths = changes
    .filter((change) => change?.kind === 'test' || isOracleSupportPath(change?.path))
    .map((change) => canonicalPathKey(change.path))
  for (const path of changedOracleSupportPaths) {
    if (!roleBoundOracleSupportPaths.has(path)) {
      errors.push(`changed oracle-support path requires a role-bound terminal consumer: ${path}`)
    }
  }

  if (!Array.isArray(input.classHistory) || input.classHistory.length !== input.sweepIndex
    || input.classHistory.some((row) => !Array.isArray(row)
      || row.some((item) => !nonEmptyString(item) || !/^[-a-z0-9_.]+$/.test(item) || item !== normalizeToken(item))
      || new Set(row.map(normalizeToken)).size !== row.length)) {
    errors.push('classHistory must contain one unique klassId array per completed sweep')
  }
  if (!Array.isArray(input.budgetHistory)
    || input.budgetHistory.some((value) => !Number.isInteger(value) || value < 0)
    || input.budgetHistory.length !== input.sweepIndex) {
    errors.push('budgetHistory must contain one non-negative budget entry per completed sweep')
  } else {
    if (input.budgetHistory.some((value, index) => index > 0 && value < input.budgetHistory[index - 1])) {
      errors.push('budgetHistory must be non-decreasing')
    }
    const expectedBudget = Math.max(manifest.diffLines, 0, ...input.budgetHistory)
    if (manifest.budgetDiffLines < expectedBudget) {
      errors.push(`scopeManifest.budgetDiffLines must be >= max(current diffLines, budgetHistory)=${expectedBudget}`)
    }
  }
  const priorState = input.priorAuditState
  if (input.sweepIndex === 0) {
    if (priorState !== undefined && priorState !== null) errors.push('priorAuditState must be absent/null for sweepIndex=0')
    if (manifest.priorAuditStateDigest !== null) errors.push('sweepIndex=0 requires a driver manifest with no recorded prior audit state')
  } else if (!priorState || typeof priorState !== 'object' || Array.isArray(priorState)) {
    errors.push('priorAuditState is required for sweepIndex>0')
  } else {
    if (!SHA256_PATTERN.test(priorState.digest || '') || auditStateDigest(priorState) !== priorState.digest) {
      errors.push('priorAuditState digest mismatch')
    }
    if (manifest.priorAuditStateDigest !== priorState.digest) errors.push('priorAuditState must match the driver-recorded manifest digest')
    if (priorState.sweepIndex !== input.sweepIndex - 1) errors.push('priorAuditState sweepIndex must immediately precede current sweep')
    if (priorState.runId !== input.runId || priorState.runNonce !== input.runNonce
      || priorState.scopeFingerprint !== manifest.scopeFingerprint) {
      errors.push('priorAuditState run/scope binding mismatch')
    }
    if (!SHA256_PATTERN.test(priorState.currentId || '')) errors.push('priorAuditState currentId must be SHA-256')
    if (!priorState.nextLedger || !Array.isArray(priorState.nextLedger.entries)
      || !Array.isArray(priorState.nextClassHistory) || !Array.isArray(priorState.nextBudgetHistory)) {
      errors.push('priorAuditState requires nextLedger/nextClassHistory/nextBudgetHistory')
    } else {
      if (stableStringify(input.classHistory) !== stableStringify(priorState.nextClassHistory)) {
        errors.push('classHistory must exactly continue priorAuditState.nextClassHistory')
      }
      if (stableStringify(input.budgetHistory) !== stableStringify(priorState.nextBudgetHistory)) {
        errors.push('budgetHistory must exactly continue priorAuditState.nextBudgetHistory')
      }
      const currentLedgerByKey = new Map(ledger.entries.filter((entry) => entry && nonEmptyString(entry.key)).map((entry) => [entry.key, entry]))
      const allowedTransitions = {
        open: new Set(['open', 'fixed', 'deferred', 'rejected', 'blocked']),
        fixed: new Set(['fixed']),
        deferred: new Set(['open', 'fixed', 'deferred', 'blocked']),
        rejected: new Set(['rejected']),
        blocked: new Set(['open', 'fixed', 'deferred', 'blocked']),
      }
      for (const priorEntry of priorState.nextLedger.entries) {
        const currentEntry = priorEntry && currentLedgerByKey.get(priorEntry.key)
        if (!currentEntry) {
          errors.push(`ledger continuity lost prior key: ${priorEntry?.key || '<missing-key>'}`)
        } else if (!allowedTransitions[priorEntry.status]?.has(currentEntry.status)) {
          errors.push(`invalid ledger transition ${priorEntry.status}->${currentEntry.status} for ${priorEntry.key}`)
        }
      }
    }
  }
  return errors
}

function validateFinding(finding) {
  const errors = []
  if (!finding || typeof finding !== 'object') return ['finding must be an object']
  for (const field of ['changeId', 'file', 'ruleId', 'klassId', 'subject', 'scenarioId', 'severity', 'title', 'detail']) {
    if (!nonEmptyString(finding[field])) errors.push(`${field} is required`)
  }
  if (!validRepoPath(finding.file || '')) errors.push('file must be a canonical repo-relative path')
  if ([finding.subject, finding.scenarioId].some((value) => String(value || '').includes('|'))) {
    errors.push('subject/scenarioId must not contain key separator |')
  }
  if (!/^[-a-z0-9_.]+$/i.test(finding.ruleId || '')) errors.push('ruleId must be a stable taxonomy id')
  if (!/^[-a-z0-9_.]+$/i.test(finding.klassId || '')) errors.push('klassId must be a stable taxonomy id')
  if (finding.klassId !== normalizeToken(finding.klassId)) errors.push('klassId must use canonical lowercase normalized form')
  if (!Object.hasOwn(SEVERITY_ORDER, finding.severity)) errors.push(`invalid severity: ${finding.severity}`)
  if (!nonEmptyString(finding.acceptanceId)) errors.push('acceptanceId is required')
  if (!nonEmptyString(finding.scenarioFingerprint)) errors.push('scenarioFingerprint is required')
  if (!(finding.line === null || (Number.isInteger(finding.line) && finding.line > 0))) errors.push('line must be null or a positive integer')
  if (!Array.isArray(finding.evidence) || finding.evidence.length === 0) {
    errors.push('at least one structured evidence assertion is required')
  } else {
    finding.evidence.forEach((evidence, index) => {
      if (!evidence || typeof evidence !== 'object') {
        errors.push(`evidence[${index}] must be an object`)
        return
      }
      if (!VALID_EVIDENCE_KINDS.has(evidence.kind)) errors.push(`evidence[${index}].kind is invalid`)
      for (const field of ['locator', 'trigger', 'expected', 'actual']) {
        if (!nonEmptyString(evidence[field])) errors.push(`evidence[${index}].${field} is required`)
      }
      if (evidence.kind === 'command' && !nonEmptyString(evidence.command)) {
        errors.push(`evidence[${index}].command is required for command evidence`)
      }
    })
  }
  return errors
}

function mergeFindings(findings) {
  const merged = new Map()
  for (const finding of findings) {
    const key = findingKey(finding)
    const previous = merged.get(key)
    if (!previous) {
      merged.set(key, {
        ...finding,
        key,
        lenses: [finding.lens],
        severityConflict: false,
      })
      continue
    }
    const severityConflict = previous.severity !== finding.severity || previous.severityConflict
    const severity = SEVERITY_ORDER[finding.severity] < SEVERITY_ORDER[previous.severity]
      ? finding.severity
      : previous.severity
    const evidenceByValue = new Map(
      [...previous.evidence, ...finding.evidence].map((evidence) => [JSON.stringify(evidence), evidence]),
    )
    merged.set(key, {
      ...previous,
      severity,
      severityConflict,
      lenses: [...new Set([...previous.lenses, finding.lens])],
      evidence: [...evidenceByValue.values()],
    })
  }
  return [...merged.values()]
}

function requiredLensesFor(change) {
  void change
  return ALL_LENS_KEYS
}

const parsed = parseArgs(typeof args === 'undefined' ? undefined : args)
if (parsed.errors.length > 0) {
  log(`[INCOMPLETE] invalid multi-lens-audit args: ${parsed.errors.join('; ')}`)
  return { verdict: 'INCOMPLETE', auditVerdict: 'INCOMPLETE', terminalRecommendation: 'BLOCKED', reason: 'INVALID_ARGS', errors: parsed.errors, schemaVersion: SCHEMA_VERSION }
}
const INPUT = parsed.value
let inputErrors
try {
  inputErrors = validateInputs(INPUT)
} catch (error) {
  const message = `contract validation failed closed: ${String(error && error.message ? error.message : error)}`
  log(`[INCOMPLETE] ${message}`)
  return { verdict: 'INCOMPLETE', auditVerdict: 'INCOMPLETE', terminalRecommendation: 'BLOCKED', reason: 'INTERNAL_VALIDATION_ERROR', errors: [message], schemaVersion: SCHEMA_VERSION }
}
if (inputErrors.length > 0) {
  log(`[INCOMPLETE] invalid multi-lens-audit v3 contract: ${inputErrors.join('; ')}`)
  return { verdict: 'INCOMPLETE', auditVerdict: 'INCOMPLETE', terminalRecommendation: 'BLOCKED', reason: 'INVALID_CONTRACT', errors: inputErrors, schemaVersion: SCHEMA_VERSION }
}

const MANIFEST = INPUT.scopeManifest
const RECEIPT_BY_ID = receiptMapOf(INPUT.verificationReceipts)
const ARTIFACT_BY_ID = artifactMapOf(INPUT.artifacts)
const SWEEP_INDEX = INPUT.sweepIndex
const DIFF_LINES = MANIFEST.diffLines
const BUDGET_DIFF_LINES = MANIFEST.budgetDiffLines
const REVIEW_HORIZON = Math.max(2, Math.ceil(Math.sqrt(BUDGET_DIFF_LINES / 10)))
const SCOPE_DESCRIPTION = JSON.stringify({
  baselineId: MANIFEST.baselineId,
  currentId: MANIFEST.currentId,
  scopeFingerprint: MANIFEST.scopeFingerprint,
  acceptance: INPUT.acceptance,
  changes: MANIFEST.changes.map((change) => ({
    ...change,
    exactPatch: artifactText(ARTIFACT_BY_ID.get(change.patchArtifactId)),
    exactBinaryArtifact: change.kind === 'binary' ? ARTIFACT_BY_ID.get(change.binaryArtifactId) : null,
    exactBinaryBaselineArtifact: change.kind === 'binary' && change.binaryBaselineArtifactId
      ? ARTIFACT_BY_ID.get(change.binaryBaselineArtifactId) : null,
  })),
})

const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['source', 'command', 'runtime', 'contract'] },
    locator: { type: 'string' },
    trigger: { type: 'string' },
    expected: { type: 'string' },
    actual: { type: 'string' },
    command: { type: 'string' },
  },
  required: ['kind', 'locator', 'trigger', 'expected', 'actual'],
}
const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    changeId: { type: 'string', description: 'exact id from scopeManifest.changes' },
    file: { type: 'string' },
    line: { type: ['integer', 'null'] },
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    ruleId: { type: 'string', description: 'stable taxonomy id, not prose' },
    klassId: { type: 'string', description: 'stable defect-class id for grouping/anti-loop' },
    subject: { type: 'string', description: 'qualified symbol, XML id, Gradle property, config key, or deleted/renamed anchor' },
    scenarioId: { type: 'string', description: 'stable scenario branch id' },
    acceptanceId: { type: 'string', description: 'exact id from acceptance' },
    scenarioFingerprint: { type: 'string', description: 'stable fingerprint bound to acceptance and receipt' },
    title: { type: 'string' },
    detail: { type: 'string' },
    evidence: { type: 'array', minItems: 1, items: EVIDENCE_SCHEMA },
  },
  required: ['changeId', 'file', 'line', 'severity', 'ruleId', 'klassId', 'subject', 'scenarioId', 'acceptanceId', 'scenarioFingerprint', 'title', 'detail', 'evidence'],
}
const COVERAGE_SCHEMA = {
  type: 'object',
  properties: {
    changeId: { type: 'string' },
    reviewedPatchSha256: { type: 'string' },
    reviewedBinarySha256: { type: 'string' },
    reviewedBinaryBaselineSha256: { type: 'string' },
    locators: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
  required: ['changeId', 'reviewedPatchSha256', 'locators'],
}
const LENS_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['complete'] },
    coverage: { type: 'array', items: COVERAGE_SCHEMA },
    findings: { type: 'array', items: FINDING_SCHEMA },
  },
  required: ['status', 'coverage', 'findings'],
}

const COMMON_PROMPT = `
Review only the v3 task-owned exact patches and acceptance contract below. Do not inspect or propose edits to unrelated dirty work.
SCOPE_MANIFEST=${SCOPE_DESCRIPTION}

The exact task patch and acceptance contract are embedded above. Return status='complete', one coverage item per inspected change, and findings.
Each coverage item must echo changeId + exact patch/evidence SHA-256 and list concrete source/diff locators reviewed. Binary coverage must inspect the embedded base64 raw-octet artifact and echo its SHA-256 as reviewedBinarySha256; modified binary coverage must also inspect/echo reviewedBinaryBaselineSha256.
A finding is a CANDIDATE until the main driver verifies it with tools. Never claim a command ran.
Use stable ruleId/klassId taxonomy tokens, a stable subject anchor, and scenarioId; title/line are display-only.
Evidence must be a structured ASSERTION with locator, concrete trigger, expected, and actual behavior.
If your lens is clean, return an empty findings array but still return exact patch-bound coverage items.
Do not manufacture findings and do not silently omit an unreadable/unsupported change.
`

const LENSES = [
  {
    key: 'compile',
    agentType: 'exampleapp-code-reviewer',
    focus: 'Compile/API/resources: imports, signatures, visibility, annotations, call-site compatibility, generated/resource references, deleted or renamed symbols.',
  },
  {
    key: 'business_logic',
    agentType: 'exampleapp-code-reviewer',
    focus: 'End-to-end behavior: read complete changed function bodies and branches; check wrong conditions, off-by-one, mappings, parser semantics, data transformations, fallbacks, and acceptance-to-output flow.',
  },
  {
    key: 'runtime',
    agentType: 'exampleapp-code-reviewer',
    focus: 'Runtime/error/resource safety: exception propagation, CancellationException, try/finally masking, lifecycle/native failure, cleanup ownership, nullability, device/OEM behavior.',
  },
  {
    key: 'state',
    agentType: null,
    focus: 'State/concurrency/lifecycle: transitions, races, re-entry, process death, rotation, callbacks, coroutine cancellation, atomicity, thread confinement, stale state.',
  },
  {
    key: 'tests',
    agentType: 'test-architect-seti',
    focus: 'Regression evidence and determinism: inspect changed production branches plus tests; genuine RED feasibility, behavioral forks, fresh execution/count, stale XML, fixture/device boundaries, skips/flakes.',
  },
  {
    key: 'performance',
    agentType: null,
    focus: 'Performance/I/O/memory: loops, allocations, main-thread work, large-file bounds, recomposition, resource pressure, cancellation and latency regressions.',
  },
  {
    key: 'ux_a11y',
    agentType: null,
    focus: 'UX/a11y/localization: Compose and XML views, semantics, contrast, touch size, dark/RTL/large font, state restoration, error/empty/loading behavior.',
  },
  {
    key: 'security',
    agentType: null,
    focus: 'Security/privacy/trust boundaries: external input, intents/URI/path traversal, permissions, auth, serialization, secrets, logs/analytics/PII, file and network boundaries.',
  },
  {
    key: 'build_noncode',
    agentType: null,
    focus: 'Non-code/build/native configuration: Manifest/XML/resources, Gradle/KTS/TOML, ProGuard/properties, shell scripts, C/C++/headers, variants, packaging, signing-facing behavior.',
  },
  {
    key: 'arch',
    agentType: 'android-principal-architect',
    focus: 'Architecture/contracts: module direction, public API/DI/navigation contracts, invariants, ownership, compatibility, misuse resistance, scope expansion and approval boundaries.',
  },
  {
    key: 'integration',
    agentType: 'exampleapp-code-reviewer',
    focus: 'Generalist whole-diff integration: trace acceptance through callers/consumers; inspect deletes/renames, cross-file glue, interactions between changes, and gaps between specialized lenses.',
  },
]

phase('Audit')
const lensResults = await parallel(LENSES.map((lens) => () =>
  agent(
    `You are a senior App reviewer working in ${REPO}.\nLENS [${lens.key}]: ${lens.focus}\n${COMMON_PROMPT}`,
    {
      label: `lens:${lens.key}`,
      phase: 'Audit',
      schema: LENS_SCHEMA,
      ...(lens.agentType ? { agentType: lens.agentType } : {}),
    },
  )
    .then((result) => ({ lens: lens.key, result, error: null }))
    .catch((error) => ({ lens: lens.key, result: null, error: String(error && error.message ? error.message : error) })),
))

phase('Consolidate')
const lensStatuses = []
const coverageReceipts = []
const rawFindings = []
const invalidFindings = []
for (const lensResult of lensResults) {
  const result = lensResult && lensResult.result
  let resultBytes = Infinity
  try { resultBytes = utf8ByteLength(JSON.stringify(result)) } catch { resultBytes = Infinity }
  const validShape = !lensResult.error
    && result
    && result.status === 'complete'
    && Array.isArray(result.coverage)
    && Array.isArray(result.findings)
    && result.coverage.length <= MANIFEST.changes.length
    && result.findings.length <= MAX_LENS_FINDINGS
    && resultBytes <= MAX_LENS_RESULT_BYTES
  const coverage = validShape ? result.coverage : []
  const coveredChangeIds = coverage.map((item) => item && item.changeId)
  const coverageShapeErrors = validShape
    ? [
      ...(new Set(coveredChangeIds).size === coveredChangeIds.length ? [] : ['coverage contains duplicate changeId']),
      ...coveredChangeIds.filter((id) => !MANIFEST.changes.some((change) => change.id === id)).map((id) => `unknown covered change id: ${id}`),
      ...coverage.flatMap((item) => {
        if (!item || typeof item !== 'object') return ['coverage item must be an object']
        const change = MANIFEST.changes.find((candidate) => candidate.id === item.changeId)
        const itemErrors = []
        if (change && item.reviewedPatchSha256 !== change.patchHash) itemErrors.push(`coverage ${item.changeId} patch SHA mismatch`)
        if (change?.kind === 'binary') {
          const binaryArtifact = ARTIFACT_BY_ID.get(change.binaryArtifactId)
          if (!binaryArtifact || item.reviewedBinarySha256 !== binaryArtifact.sha256) itemErrors.push(`coverage ${item.changeId} binary SHA mismatch`)
          const baselineArtifact = ARTIFACT_BY_ID.get(change.binaryBaselineArtifactId)
          if (change.status === 'modified' && (!baselineArtifact || item.reviewedBinaryBaselineSha256 !== baselineArtifact.sha256)) {
            itemErrors.push(`coverage ${item.changeId} binary baseline SHA mismatch`)
          }
        } else if (item.reviewedBinarySha256 !== undefined && item.reviewedBinarySha256 !== null) {
          itemErrors.push(`coverage ${item.changeId} reviewedBinarySha256 is only valid for binary changes`)
        } else if (item.reviewedBinaryBaselineSha256 !== undefined && item.reviewedBinaryBaselineSha256 !== null) {
          itemErrors.push(`coverage ${item.changeId} reviewedBinaryBaselineSha256 is only valid for binary changes`)
        }
        if (!Array.isArray(item.locators) || item.locators.length === 0 || item.locators.some((locator) => !nonEmptyString(locator))) {
          itemErrors.push(`coverage ${item.changeId || '<missing-id>'} requires locators`)
        }
        return itemErrors
      }),
    ]
    : []
  lensStatuses.push({
    lens: lensResult.lens,
    status: validShape && coverageShapeErrors.length === 0 ? 'complete' : 'incomplete',
    error: lensResult.error || (!validShape ? 'missing/malformed/oversized lens result' : coverageShapeErrors.join('; ')),
    coveredChangeIds,
  })
  if (!validShape || coverageShapeErrors.length > 0) continue
  for (const item of coverage) {
    coverageReceipts.push({
      runId: INPUT.runId,
      lens: lensResult.lens,
      changeId: item.changeId,
      inputPatchSha256: item.reviewedPatchSha256,
      inputBinarySha256: item.reviewedBinarySha256 || null,
      inputBinaryBaselineSha256: item.reviewedBinaryBaselineSha256 || null,
      responseSha256: sha256Value(result),
      status: 'delivered-and-acknowledged',
    })
  }
  for (const finding of result.findings) {
    const errors = validateFinding(finding)
    const referencedChange = finding && MANIFEST.changes.find((change) => change.id === finding.changeId)
    if (finding && !referencedChange) {
      errors.push(`finding changeId is outside task-owned scope: ${finding.changeId}`)
    } else if (finding && canonicalPathKey(referencedChange.path) !== canonicalPathKey(finding.file)) {
      errors.push(`finding file does not match manifest change ${finding.changeId}: ${finding.file}`)
    }
    const acceptance = finding && INPUT.acceptance.find((item) => item.id === finding.acceptanceId)
    if (finding && !acceptance) errors.push(`finding references unknown acceptanceId: ${finding.acceptanceId}`)
    if (finding && acceptance && finding.scenarioFingerprint !== acceptance.scenarioFingerprint) {
      errors.push(`finding scenarioFingerprint does not match acceptance ${finding.acceptanceId}`)
    }
    if (finding && acceptance && !acceptance.blastRadiusAnchors.map(normalizeToken).includes(normalizeToken(finding.subject))) {
      errors.push(`finding subject is not declared in acceptance ${finding.acceptanceId} blastRadiusAnchors`)
    }
    if (errors.length > 0) {
      invalidFindings.push({ lens: lensResult.lens, finding, errors })
    } else {
      rawFindings.push({ ...finding, lens: lensResult.lens })
    }
  }
}

const coverageGaps = []
for (const change of MANIFEST.changes) {
  const required = requiredLensesFor(change)
  for (const lens of required) {
    const status = lensStatuses.find((candidate) => candidate.lens === lens)
    if (!status || status.status !== 'complete' || !status.coveredChangeIds.includes(change.id)) {
      coverageGaps.push({ changeId: change.id, path: change.path, requiredLens: lens })
    }
  }
}

const rawFindingsByKey = new Map()
for (const finding of rawFindings) {
  const key = findingKey(finding)
  if (!rawFindingsByKey.has(key)) rawFindingsByKey.set(key, [])
  rawFindingsByKey.get(key).push(finding)
}
const conflictedFindingKeys = new Set()
for (const [key, findings] of rawFindingsByKey) {
  const contracts = new Set(findings.map((finding) => `${finding.acceptanceId}|${finding.scenarioFingerprint}`))
  if (contracts.size > 1) {
    conflictedFindingKeys.add(key)
    invalidFindings.push({ lens: 'consolidate', finding: { key }, errors: ['stable finding identity collides across acceptance/scenario contracts'] })
  }
}
const mergedFindings = mergeFindings(rawFindings.filter((finding) => !conflictedFindingKeys.has(findingKey(finding))))
  .map((finding) => ({ ...finding, evidenceFingerprint: evidenceFingerprint(finding.evidence) }))
const ledgerByKey = new Map(INPUT.ledger.entries.map((entry) => [entry.key, entry]))
const currentKeySet = new Set(mergedFindings.map((finding) => finding.key))
const fixedReappeared = mergedFindings.filter((finding) => ledgerByKey.get(finding.key)?.status === 'fixed')
// A recurring candidate is new current-state evidence. Operational receipts can establish
// consistency, but the named workflow cannot prove that a generic command/test semantically
// disproves model-authored finding prose. Therefore a prior rejection never suppresses a
// candidate that appears again; the driver must re-triage the recurrence.
const rejectionMatches = () => false
const rejectedRecurring = mergedFindings.filter(rejectionMatches)
const rejectedNovelEvidence = mergedFindings.filter((finding) => ledgerByKey.get(finding.key)?.status === 'rejected' && !rejectionMatches(finding))
const activeFindings = mergedFindings.filter((finding) => !rejectionMatches(finding))
const deferredEntries = INPUT.ledger.entries.filter((entry) => entry.status === 'deferred')
const blockedEntries = INPUT.ledger.entries.filter((entry) => entry.status === 'blocked')
const priorOpenEntries = INPUT.ledger.entries.filter((entry) => entry.status === 'open')
const unaccountedKeys = priorOpenEntries
  .filter((entry) => !currentKeySet.has(entry.key))
  .map((entry) => entry.key)

const currentClasses = new Set(activeFindings
  .filter((finding) => {
    const entry = ledgerByKey.get(finding.key)
    const receipt = entry && entry.receiptId ? RECEIPT_BY_ID.get(entry.receiptId) : null
    return entry?.status === 'open' && receipt && receipt.outcome === 'validated'
  })
  .map((finding) => normalizeToken(finding.klassId)))
const classHistory = [...INPUT.classHistory.map((row) => [...row]), [...currentClasses]]
let sameClassTriple = []
if (classHistory.length >= 3) {
  const lastThree = classHistory.slice(-3).map((row) => new Set(row))
  sameClassTriple = [...lastThree[0]].filter((klassId) => lastThree[1].has(klassId) && lastThree[2].has(klassId))
}

const nextEntriesByKey = new Map(INPUT.ledger.entries.map((entry) => [entry.key, { ...entry }]))
for (const finding of mergedFindings) {
  if (!nextEntriesByKey.has(finding.key)) {
    nextEntriesByKey.set(finding.key, { key: finding.key, status: 'open' })
  } else if (ledgerByKey.get(finding.key)?.status === 'rejected' && !rejectionMatches(finding)) {
    nextEntriesByKey.set(finding.key, { key: finding.key, status: 'open', reopenedFrom: 'rejected', reason: 'novel evidence fingerprint' })
  }
}
const nextLedger = { entries: [...nextEntriesByKey.values()] }
const nextClassHistory = classHistory
const nextBudgetHistory = [...INPUT.budgetHistory, BUDGET_DIFF_LINES]
const nextAuditState = {
  sweepIndex: SWEEP_INDEX,
  runId: INPUT.runId,
  runNonce: INPUT.runNonce,
  scopeFingerprint: MANIFEST.scopeFingerprint,
  currentId: MANIFEST.currentId,
  nextLedger,
  nextClassHistory,
  nextBudgetHistory,
}
nextAuditState.digest = auditStateDigest(nextAuditState)
const verificationRequests = activeFindings
  .filter((finding) => {
    const status = ledgerByKey.get(finding.key)?.status
    return status === undefined || status === 'open' || (status === 'rejected' && !rejectionMatches(finding))
  })
  .map((finding) => ({
    key: finding.key,
    severity: finding.severity,
    file: finding.file,
    subject: finding.subject,
    scenarioId: finding.scenarioId,
    assertedEvidence: finding.evidence,
    required: 'Driver must read/execute safe evidence and add a scope-bound verified receipt before resolving this key.',
  }))

const incompleteLenses = lensStatuses.filter((status) => status.status !== 'complete')
let verdict
let reason
if (incompleteLenses.length > 0 || coverageGaps.length > 0 || invalidFindings.length > 0) {
  verdict = 'INCOMPLETE'
  reason = 'LENS_OR_COVERAGE_INCOMPLETE'
} else if (unaccountedKeys.length > 0) {
  verdict = 'INCOMPLETE'
  reason = 'UNACCOUNTED_PRIOR_OPEN_FINDINGS'
} else if (fixedReappeared.length > 0) {
  verdict = 'ESCALATE'
  reason = 'THRASH_FIXED_FINDING_REAPPEARED'
} else if (sameClassTriple.length > 0) {
  verdict = 'ESCALATE'
  reason = 'SAME_CLASS_THREE_SWEEPS'
  } else if (deferredEntries.some((entry) => entry.severity === 'P0' || entry.severity === 'P1')) {
    verdict = 'ESCALATE'
    reason = 'HIGH_SEVERITY_DEFERRED_FINDINGS'
  } else if (blockedEntries.length > 0) {
    verdict = 'INCOMPLETE'
    reason = 'BLOCKED_FINDINGS_REMAIN'
  } else if (deferredEntries.length > 0) {
    verdict = 'RESIDUALS'
    reason = 'DEFERRED_FINDINGS_REMAIN'
} else if (activeFindings.length > 0) {
  verdict = 'CONVERGING'
  reason = 'OPEN_CANDIDATES_REQUIRE_DRIVER_VALIDATION'
} else {
  verdict = 'CLEAR'
  reason = 'ZERO_ACTIVE_FINDINGS_COMPLETE_PATCH_BOUND_COVERAGE'
}

const gateReceiptMatches = (gate, receipt) => receipt
  && receipt.kind === gate.kind
  && receipt.key === gate.checkKey
  && receipt.acceptanceId === gate.acceptanceId
  && receipt.scenarioFingerprint === gate.scenarioFingerprint
  && receiptExecutionIdentity(receipt, ARTIFACT_BY_ID) === gate.executionIdentity
const gateResults = INPUT.verificationGates.map((gate) => {
  if (!gate.applicable) return {
    id: gate.id,
    mandatory: gate.mandatory,
    status: gate.mandatory ? 'BLOCKED' : 'N/A',
    ...(gate.mandatory ? {} : { reason: gate.notApplicableReason, evidence: gate.notApplicableEvidence }),
  }
  const finalReceipt = nonEmptyString(gate.finalReceiptId) ? RECEIPT_BY_ID.get(gate.finalReceiptId) : null
  if (!gateReceiptMatches(gate, finalReceipt) || finalReceipt.contentPhase !== 'post') {
    return { id: gate.id, mandatory: gate.mandatory, status: gate.mandatory ? 'BLOCKED' : 'OPTIONAL_GAP' }
  }
  const finalOracle = receiptOracleResult(finalReceipt, ARTIFACT_BY_ID)
  if (finalOracle.valid && finalOracle.pass && finalReceipt.outcome === 'pass') {
    return { id: gate.id, mandatory: gate.mandatory, status: 'PASS', receiptId: finalReceipt.id }
  }
  const baselineReceipt = nonEmptyString(gate.baselineReceiptId) ? RECEIPT_BY_ID.get(gate.baselineReceiptId) : null
  const baselineOracle = baselineReceipt ? receiptOracleResult(baselineReceipt, ARTIFACT_BY_ID) : null
  const baselineFailure = receiptFailureFingerprint(baselineReceipt, ARTIFACT_BY_ID)
  const finalFailure = receiptFailureFingerprint(finalReceipt, ARTIFACT_BY_ID)
  if (gateReceiptMatches(gate, baselineReceipt)
    && baselineReceipt.contentPhase === 'pre'
    && finalReceipt.contentPhase === 'post'
    && baselineReceipt.outcome === 'validated'
    && finalReceipt.outcome === 'validated'
    && baselineOracle?.valid && !baselineOracle.pass
    && nonEmptyString(baselineFailure)
    && finalFailure === baselineFailure
    && receiptExecutionIdentity(baselineReceipt, ARTIFACT_BY_ID) === receiptExecutionIdentity(finalReceipt, ARTIFACT_BY_ID)) {
    return { id: gate.id, mandatory: gate.mandatory, status: 'PRE_EXISTING', receiptId: finalReceipt.id }
  }
  return { id: gate.id, mandatory: gate.mandatory, status: 'FAIL', receiptId: finalReceipt.id }
})
const mandatoryGateFailed = gateResults.some((gate) => gate.mandatory && gate.status === 'FAIL')
const mandatoryGateBlocked = gateResults.some((gate) => gate.mandatory && ['BLOCKED', 'OPTIONAL_GAP'].includes(gate.status))
const hasGateResidual = gateResults.some((gate) => ['PRE_EXISTING', 'OPTIONAL_GAP'].includes(gate.status)
  || (!gate.mandatory && gate.status === 'FAIL'))
let terminalRecommendation
if (mandatoryGateFailed) terminalRecommendation = 'FAILED'
else if (verdict === 'ESCALATE') terminalRecommendation = 'ESCALATE'
else if (verdict === 'INCOMPLETE' || verdict === 'CONVERGING' || mandatoryGateBlocked) terminalRecommendation = 'BLOCKED'
else if (blockedEntries.length > 0) terminalRecommendation = 'BLOCKED'
else if (verdict === 'RESIDUALS' || hasGateResidual) terminalRecommendation = 'VERIFIED_WITH_RESIDUALS'
else terminalRecommendation = 'AUDIT_CLEAR_NEEDS_EXTERNAL_GATES'
const verificationVerdict = mandatoryGateFailed ? 'FAILED' : mandatoryGateBlocked ? 'MISSING' : 'ASSERTED_ONLY'

const counts = {
  totalCandidates: mergedFindings.length,
  active: activeFindings.length,
  open: nextLedger.entries.filter((entry) => entry.status === 'open').length,
  fixed: nextLedger.entries.filter((entry) => entry.status === 'fixed').length,
  deferred: deferredEntries.length,
  blocked: blockedEntries.length,
  rejected: nextLedger.entries.filter((entry) => entry.status === 'rejected').length,
  fixedReappeared: fixedReappeared.length,
  rejectedRecurring: rejectedRecurring.length,
  rejectedNovelEvidence: rejectedNovelEvidence.length,
  invalidFindings: invalidFindings.length,
  coverageGaps: coverageGaps.length,
  unaccounted: unaccountedKeys.length,
}
for (const severity of ['P0', 'P1', 'P2', 'P3']) {
  counts[severity] = activeFindings.filter((finding) => finding.severity === severity).length
}

log(`[${verdict}] ${reason}; terminal=${terminalRecommendation}; sweep=${SWEEP_INDEX}; reviewHorizon=${REVIEW_HORIZON}; scope=${MANIFEST.scopeFingerprint}; `
  + `diffLines=${DIFF_LINES}; budgetDiffLines=${BUDGET_DIFF_LINES}; active=${counts.active}; deferred=${counts.deferred}; invalid=${counts.invalidFindings}; `
  + `coverageGaps=${counts.coverageGaps}; unaccounted=${counts.unaccounted}. `
  + 'Inline artifacts are integrity-checked but not host-attested; terminal completion requires external /fix-driver gates from real tool output.')

return {
  schemaVersion: SCHEMA_VERSION,
  verdict,
  auditVerdict: verdict,
  verificationVerdict,
  terminalRecommendation,
  reason,
  runId: INPUT.runId,
  runNonce: INPUT.runNonce,
  scopeFingerprint: MANIFEST.scopeFingerprint,
  currentId: MANIFEST.currentId,
  contentHash: MANIFEST.contentHash,
  diffLines: DIFF_LINES,
  budgetDiffLines: BUDGET_DIFF_LINES,
  sweepIndex: SWEEP_INDEX,
  reviewHorizon: REVIEW_HORIZON,
  counts,
  findings: mergedFindings,
  activeFindings,
  invalidFindings,
  verificationRequests,
  coverageGaps,
  lensStatuses,
  coverageReceipts,
  gateResults,
  fixedReappeared: fixedReappeared.map((finding) => finding.key),
  rejectedRecurring: rejectedRecurring.map((finding) => finding.key),
  rejectedNovelEvidence: rejectedNovelEvidence.map((finding) => finding.key),
  residuals: deferredEntries,
  blockedEntries,
  unaccountedKeys,
  sameClassTriple,
  currentKeys: mergedFindings.map((finding) => finding.key),
  openKeys: nextLedger.entries.filter((entry) => entry.status === 'open').map((entry) => entry.key),
  fixedKeys: nextLedger.entries.filter((entry) => entry.status === 'fixed').map((entry) => entry.key),
  deferredKeys: deferredEntries.map((entry) => entry.key),
  rejectedKeys: nextLedger.entries.filter((entry) => entry.status === 'rejected').map((entry) => entry.key),
  nextLedger,
  nextClassHistory,
  nextBudgetHistory,
  nextAuditState,
  priorAuditStateDigest: INPUT.priorAuditState?.digest || null,
}
