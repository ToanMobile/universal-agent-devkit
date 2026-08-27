import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const workflowUrl = new URL('./multi-lens-audit.js', import.meta.url)
const rawSource = await readFile(workflowUrl, 'utf8')
const executableSource = `${rawSource.replace('export const meta =', 'const meta =')}\n//# sourceURL=${workflowUrl.href}?test-runtime\n`
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
// `process` is no longer injected, so this list documents what the real sandbox offers. Be clear
// about what that does and does not buy, because the obvious reading is wrong: `new AsyncFunction`
// compiles in global scope, so `process` still resolves to Node's real global whatever the parameter
// list says. Measured: an aliased read (`const env = process`) passes all tests either way. The only
// thing that actually catches this class is the static check below, and its reach is narrow: it
// fires on `process` followed by `.`, `(` or `[`, and misses `globalThis.process.env`, `const env =
// process`, destructuring, and passing `process` as an argument.
const executeWorkflow = new AsyncFunction(
  'args',
  'phase',
  'parallel',
  'agent',
  'log',
  executableSource,
)

// Only names actually confirmed missing from the workflow sandbox belong here. `globalThis` is an
// ES2020 intrinsic present in every conforming engine and was wrongly listed at first; `require` and
// `__dirname` are absent because this is an ES module, not because of the sandbox.
//
// TextEncoder/TextDecoder are deliberately NOT in this list even though the sandbox lacks them and
// they are what currently kills this workflow at launch: the script still uses them at six call
// sites, so listing them would leave a permanently red test in the repo. Add them in the same
// change that replaces those uses with pure-JS UTF-8 codecs — see the header note.
test('workflow source does not reach for host globals the sandbox lacks', () => {
  for (const forbidden of ['process']) {
    assert.doesNotMatch(
      rawSource,
      new RegExp(`(^|[^\\w.'"\`])${forbidden}\\s*[.(\\[]`, 'm'),
      `workflow script must not use ${forbidden}: it is absent in the workflow sandbox and the ` +
        'failure surfaces only at launch, after the run is already lost',
    )
  }
})

const scopeFingerprint = 'scope-v3-owned-boundary'
const runId = 'run-v3-contract'
const runNonce = 'nonce-v3-contract'
const runStartedAt = new Date(Date.now() - 60_000).toISOString()
const preExecutedAt = new Date(Date.now() - 50_000).toISOString()
const firstEditStartedAt = new Date(Date.now() - 40_000).toISOString()
const lastEditFinishedAt = new Date(Date.now() - 35_000).toISOString()
const postRunStartedAt = new Date(Date.now() - 30_000).toISOString()
const executedAt = new Date(Date.now() - 1_000).toISOString()
const acceptanceOracle = { metric: 'observedState', op: 'eq', value: 'INPUT_ERROR' }
const defaultOracleSourceStates = [{
  path: 'feature/reader/src/test/java/example/ReaderTest.kt',
  sha256: sha256TextForTest('reader-test-harness-v1'),
  mode: 0o644,
  observationToken: sha256TextForTest('reader-test-observation-v1'),
}]
const defaultOracleSourceHash = sha256ValueForTest(defaultOracleSourceStates)

function sha256TextForTest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function sha256ValueForTest(value) {
  return sha256TextForTest(stableStringifyForTest(value))
}

function inlineArtifact(id, mediaType, value) {
  const bytes = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? Buffer.from(value)
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
  return {
    id,
    mediaType,
    encoding: 'base64',
    payload: bytes.toString('base64'),
    byteLength: bytes.length,
    sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
  }
}

function binaryEvidenceForTest(item) {
  const artifactSha256 = item.status === 'deleted' ? item.preimageSha256 : item.postimageSha256
  const mode = (value) => value === null ? 'absent' : Number(value).toString(8)
  return [
    'App binary evidence v1',
    `path ${item.path}`,
    `status ${item.status}`,
    `preimage ${item.preimageSha256} mode ${mode(item.preimageMode)}`,
    `postimage ${item.postimageSha256} mode ${mode(item.postimageMode)}`,
    `artifact ${artifactSha256}`,
    '',
  ].join('\n')
}

function stableStringifyForTest(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringifyForTest).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringifyForTest(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function stableHashForTest(value) {
  return sha256ValueForTest(value)
}

function contentHashFor(changes, currentId = 'worktree-1') {
  const canonicalChanges = [...changes]
    .map((item) => ({
      id: item.id,
      path: item.path.toLowerCase(),
      previousPath: item.previousPath ? item.previousPath.toLowerCase() : null,
      kind: item.kind,
      status: item.status,
      added: item.added,
      deleted: item.deleted,
      patchHash: item.patchHash,
      patchArtifactId: item.patchArtifactId,
      binaryArtifactId: item.binaryArtifactId || null,
      binaryBaselineArtifactId: item.binaryBaselineArtifactId || null,
      preimageSha256: item.preimageSha256,
      postimageSha256: item.postimageSha256,
      preimageMode: item.preimageMode,
      postimageMode: item.postimageMode,
      firstEditStartedAt: item.firstEditStartedAt,
      lastEditFinishedAt: item.lastEditFinishedAt,
      overlap: item.overlap,
      overlapsPreExisting: item.overlapsPreExisting,
      manualReviewReceiptId: item.manualReviewReceiptId || null,
      approvalDigest: item.approvalDigest || null,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
  return stableHashForTest({ currentId, changes: canonicalChanges })
}

function change(overrides = {}) {
  return {
    id: 'change-1',
    path: 'feature/reader/src/main/java/example/Reader.kt',
    kind: 'kotlin',
    status: 'modified',
    ownership: 'task',
    added: 1,
    deleted: 0,
    patchHash: sha256TextForTest('placeholder'),
    patchArtifactId: 'patch-change-1',
    preimageSha256: sha256TextForTest('before'),
    postimageSha256: sha256TextForTest('after'),
    preimageMode: 0o644,
    postimageMode: 0o644,
    firstEditStartedAt,
    lastEditFinishedAt,
    overlap: 'none',
    overlapsPreExisting: false,
    ...overrides,
  }
}

function input(overrides = {}) {
  const rawChanges = overrides.changes || [change()]
  const patchArtifacts = []
  const binaryArtifacts = []
  const changes = rawChanges.map((item, index) => {
    if (!item || typeof item !== 'object') return item
    const { patchText, binaryBytes, binaryBaselineBytes, ...manifestItem } = item
    const result = {
      ...manifestItem,
      preimageSha256: item.preimageSha256 || sha256TextForTest(`before-${index}`),
      postimageSha256: item.postimageSha256 || sha256TextForTest(`after-${index}`),
      overlap: item.overlap || 'none',
    }
    if (item.kind === 'binary') {
      const binaryArtifact = inlineArtifact(item.binaryArtifactId || `binary-${item.id || index}`, 'application/octet-stream', binaryBytes || Buffer.from([1]))
      binaryArtifacts.push(binaryArtifact)
      result.binaryArtifactId = binaryArtifact.id
      if (item.status === 'deleted') result.preimageSha256 = binaryArtifact.sha256
      else result.postimageSha256 = binaryArtifact.sha256
      if (item.status === 'modified') {
        const baselineArtifact = inlineArtifact(item.binaryBaselineArtifactId || `binary-baseline-${item.id || index}`, 'application/octet-stream', binaryBaselineBytes || Buffer.from([0]))
        binaryArtifacts.push(baselineArtifact)
        result.binaryBaselineArtifactId = baselineArtifact.id
        result.preimageSha256 = baselineArtifact.sha256
      }
    }
    const oldPath = item.status === 'renamed' ? item.previousPath : item.path
    const patch = patchText || (item.kind === 'binary' ? binaryEvidenceForTest(result) : `diff --git a/${oldPath} b/${item.path}\n--- a/${oldPath}\n+++ b/${item.path}\n@@ -1,${item.deleted} +1,${item.added} @@\n${Array.from({ length: item.deleted }, (_, line) => `-old-${line}`).join('\n')}${item.deleted && item.added ? '\n' : ''}${Array.from({ length: item.added }, (_, line) => `+new-${line}`).join('\n')}\n`)
    const artifact = inlineArtifact(item.patchArtifactId || `patch-${item.id || index}`, item.kind === 'binary' ? 'application/vnd.exampleapp.binary-evidence' : 'text/x-diff', patch)
    patchArtifacts.push(artifact)
    result.patchArtifactId = artifact.id
    result.patchHash = artifact.sha256
    return result
  })
  const diffLines = changes.reduce((sum, item) => sum + item.added + item.deleted, 0)
  const currentId = sha256ValueForTest(changes
    .map((item) => ({ path: item.path, postimageSha256: item.postimageSha256, mode: item.postimageMode }))
    .sort((left, right) => left.path.localeCompare(right.path)))
  const baselineContentId = sha256ValueForTest(changes
    .map((item) => ({ path: item.path, preimageSha256: item.preimageSha256, mode: item.preimageMode }))
    .sort((left, right) => left.path.localeCompare(right.path)))
  const canonicalChanges = changes.map((item) => item && ({
    id: item.id, path: item.path.toLowerCase(), previousPath: item.previousPath ? item.previousPath.toLowerCase() : null, kind: item.kind, status: item.status,
    added: item.added, deleted: item.deleted, patchHash: item.patchHash,
    patchArtifactId: item.patchArtifactId, binaryArtifactId: item.binaryArtifactId || null,
    binaryBaselineArtifactId: item.binaryBaselineArtifactId || null, preimageSha256: item.preimageSha256,
    postimageSha256: item.postimageSha256, overlap: item.overlap,
    preimageMode: item.preimageMode, postimageMode: item.postimageMode,
    firstEditStartedAt: item.firstEditStartedAt, lastEditFinishedAt: item.lastEditFinishedAt,
    overlapsPreExisting: item.overlapsPreExisting,
    manualReviewReceiptId: item.manualReviewReceiptId || null,
    approvalDigest: item.approvalDigest || null,
  })).sort((left, right) => String(left?.id).localeCompare(String(right?.id)))
  const contentHash = sha256ValueForTest({ currentId, changes: canonicalChanges })
  const actualScopeFingerprint = sha256ValueForTest({ sessionId: runId, headCommit: 'head-1', paths: changes.map((item) => item && item.path) })
  const manifestReceipt = {
    id: 'manifest-receipt',
    key: `scope-manifest:${actualScopeFingerprint}:${currentId}`,
    scopeFingerprint: actualScopeFingerprint,
    currentId,
    contentHash,
    status: 'verified',
    source: 'artifact-driver',
    kind: 'scope-manifest',
    outcome: 'reviewed',
    executedAt,
    evidenceRef: 'driver git status/numstat/hash receipt',
    runId,
    runNonce,
    priorAuditStateDigest: null,
  }
  const baseChange = changes.find((item) => !/\/src\/(?:test|androidTest)\//.test(item.path)) || changes[0]
  const baseKey = `${baseChange.path.toLowerCase()}|logic.wrong_branch|example.reader.open|empty-input`
  const red = receipt('base-red', baseKey, {
    outcome: 'validated', expectedExitCode: 1, exitCode: 1, passedCount: 0, failedCount: 1,
    failureKind: 'ASSERTION', observedState: 'BUG_PRESENT', contentPhase: 'pre', executedAt: preExecutedAt,
    runStartedAt, reportMtime: preExecutedAt, currentId: baselineContentId, contentHash: baselineContentId,
  })
  const green = receipt('base-green', baseKey)
  const scopeContentIdAt = (timestamp) => sha256ValueForTest(changes
    .map((item) => {
      const usePostimage = Date.parse(item.lastEditFinishedAt) <= Date.parse(timestamp)
      return {
        path: item.path,
        postimageSha256: usePostimage ? item.postimageSha256 : item.preimageSha256,
        mode: usePostimage ? item.postimageMode : item.preimageMode,
      }
    })
    .sort((left, right) => left.path.localeCompare(right.path)))
  const suppliedReceipts = overrides.verificationReceipts || []
  const allReceipts = [red, green, ...suppliedReceipts].map((item) => {
    const measurementFinishedAt = item.kind === 'test'
      ? item.reportMtime
      : item.kind === 'runtime'
        ? item.capturedAt
        : item._measurement?.capturedAt
    const phaseContentId = item.contentPhase === 'pre'
      ? scopeContentIdAt(measurementFinishedAt)
      : currentId
    return {
      ...item,
      scopeFingerprint: item.scopeFingerprint === scopeFingerprint ? actualScopeFingerprint : item.scopeFingerprint,
      currentId: item.contentPhase === 'pre' ? phaseContentId : (item.currentId === 'worktree-1' ? currentId : item.currentId),
      contentHash: item.contentPhase === 'pre' ? phaseContentId : (item.contentHash === contentHashFor([change()]) ? contentHash : item.contentHash),
    }
  })
  const oracleSourceArtifacts = allReceipts.filter((item) => item._measurement).map((item) => {
    const oracleSourceStates = item._oracleSourceStates || defaultOracleSourceStates
    const oracleSourceHash = sha256ValueForTest(oracleSourceStates)
    const artifactId = `oracle-source-${item.id}`
    item._measurement.oracleSourceHash = oracleSourceHash
    item._measurement.oracleSourceArtifactId = artifactId
    const measurementStartedAt = item.kind === 'test' || item.kind === 'runtime'
      ? item.runStartedAt
      : item._measurement.runStartedAt
    const measurementFinishedAt = item.kind === 'test'
      ? item.reportMtime
      : item.kind === 'runtime'
        ? item.capturedAt
        : item._measurement.capturedAt
    const scopeStates = changes.map((change) => {
      const usePostimage = Date.parse(change.lastEditFinishedAt) <= Date.parse(measurementFinishedAt)
      return {
        path: change.path,
        postimageSha256: usePostimage ? change.postimageSha256 : change.preimageSha256,
        mode: usePostimage ? change.postimageMode : change.preimageMode,
        observationToken: sha256TextForTest(`scope-observation:${item.id}:${change.id}`),
      }
    }).sort((left, right) => left.path.localeCompare(right.path))
    return inlineArtifact(artifactId, 'application/vnd.exampleapp.oracle-source+json', {
      oracleId: item.id,
      source: 'artifact-driver',
      startedAt: measurementStartedAt,
      finishedAt: measurementFinishedAt,
      sourceStates: oracleSourceStates,
      sourceHash: oracleSourceHash,
      scopeStates,
      scopeContentId: item.currentId,
    })
  })
  const measurementArtifacts = allReceipts.filter((item) => item._measurement).map((item) => inlineArtifact(
    item.measurementArtifactId,
    'application/json',
    item.kind === 'runtime'
      ? { ...item._measurement, sourceContentId: item.currentId, appArtifactSha256: item._measurement.appArtifactSha256 || sha256TextForTest(`apk-${item.id}`) }
      : item._measurement,
  ))
  const cleanReceipts = allReceipts.map(({ _measurement, _oracleSourceStates, ...item }) => item)
  const autoFixedProofs = (overrides.ledger?.entries || [])
    .filter((entry) => entry.status === 'fixed')
    .map((entry, index) => ({ id: `proof-fixed-${index}`, acceptanceId: 'acceptance-1', preReceiptId: 'base-red', postReceiptId: entry.receiptId }))
  const result = {
    schemaVersion: 3,
    sweepIndex: 0,
    runId,
    runNonce,
    runStartedAt,
    artifacts: [...patchArtifacts, ...binaryArtifacts, ...measurementArtifacts, ...oracleSourceArtifacts],
    acceptance: [{
      id: 'acceptance-1',
      defect: 'Reader empty input bug',
      statement: 'Empty input returns INPUT_ERROR',
      scenarioFingerprint: 'scenario-empty-v1',
      machineOracle: acceptanceOracle,
      mandatory: true,
      blastRadiusAnchors: ['example.Reader.open'],
      oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'],
    }],
    scopeManifest: {
      baselineId: 'head-1',
      baselineContentId,
      currentId,
      scopeFingerprint: actualScopeFingerprint,
      source: 'artifact-driver',
      generatedAt: executedAt,
      firstEditStartedAt,
      lastEditFinishedAt,
      contentHash,
      priorAuditStateDigest: null,
      manifestReceiptId: manifestReceipt.id,
      ownedPaths: changes.map((item) => item.path),
      preExistingDirtyPaths: ['unrelated/UserWork.kt'],
      changes,
      diffLines,
      budgetDiffLines: diffLines,
    },
    ledger: { entries: [] },
    verificationReceipts: [manifestReceipt, ...cleanReceipts],
    regressionProofs: [{ id: 'proof-base', acceptanceId: 'acceptance-1', preReceiptId: 'base-red', postReceiptId: 'base-green' }, ...autoFixedProofs],
    verificationGates: [],
    classHistory: [],
    budgetHistory: [],
    priorAuditState: null,
    concurrencyWindow: 'optimistic-unattested',
    ...overrides,
    verificationReceipts: [manifestReceipt, ...cleanReceipts],
    changes: undefined,
  }
  if (result.sweepIndex > 0 && !Object.hasOwn(overrides, 'priorAuditState')) {
    const prior = {
      sweepIndex: result.sweepIndex - 1,
      runId: result.runId,
      runNonce: result.runNonce,
      scopeFingerprint: result.scopeManifest.scopeFingerprint,
      currentId: result.scopeManifest.currentId,
      nextLedger: result.ledger,
      nextClassHistory: result.classHistory,
      nextBudgetHistory: result.budgetHistory,
    }
    prior.digest = stableHashForTest(prior)
    result.priorAuditState = prior
    result.scopeManifest.priorAuditStateDigest = prior.digest
    result.verificationReceipts[0].priorAuditStateDigest = prior.digest
  }
  return result
}

function candidate(overrides = {}) {
  return {
    changeId: 'change-1',
    file: 'feature/reader/src/main/java/example/Reader.kt',
    line: 42,
    severity: 'P1',
    ruleId: 'logic.wrong_branch',
    klassId: 'logic.branch_contract',
    subject: 'example.Reader.open',
    scenarioId: 'empty-input',
    acceptanceId: 'acceptance-1',
    scenarioFingerprint: 'scenario-empty-v1',
    title: 'Empty input follows success branch',
    detail: 'The changed condition returns success for an empty input.',
    evidence: [{
      kind: 'source',
      locator: 'Reader.kt:42 example.Reader.open',
      trigger: 'Call open with an empty input',
      expected: 'Return an input error',
      actual: 'Returns success',
    }],
    ...overrides,
  }
}

function evidenceFingerprintFor(evidence) {
  return stableHashForTest(evidence)
}

function findingFingerprintFor(finding) {
  return stableHashForTest({
    key: [finding.file.toLowerCase(), finding.ruleId, finding.subject, finding.scenarioId].map((value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ')).join('|'),
    changeId: finding.changeId,
    file: finding.file.toLowerCase(),
    ruleId: finding.ruleId.trim().toLowerCase(),
    klassId: finding.klassId.trim().toLowerCase(),
    subject: finding.subject.trim().toLowerCase(),
    scenarioId: finding.scenarioId.trim().toLowerCase(),
    acceptanceId: finding.acceptanceId,
    scenarioFingerprint: finding.scenarioFingerprint,
    evidenceFingerprint: evidenceFingerprintFor(finding.evidence),
  })
}

function receipt(id, key, overrides = {}) {
  const value = {
    id,
    key,
    scopeFingerprint,
    currentId: 'worktree-1',
    contentHash: contentHashFor([change()]),
    status: 'verified',
    source: 'main-tool-call-unattested',
    kind: 'test',
    outcome: 'pass',
    contentPhase: 'post',
    executedAt,
    runId,
    runNonce,
    acceptanceId: 'acceptance-1',
    scenarioFingerprint: 'scenario-empty-v1',
    measurementArtifactId: `measurement-${id}`,
    machineOracle: acceptanceOracle,
    command: './gradlew :feature:reader:testDebugUnitTest --tests example.ReaderTest.emptyInput --rerun-tasks',
    exitCode: 0,
    expectedExitCode: 0,
    testIdentity: 'example.ReaderTest#emptyInput',
    executedCount: 1,
    matchedTestCount: 1,
    passedCount: 1,
    failedCount: 0,
    errorCount: 0,
    skippedCount: 0,
    abortedCount: 0,
    runStartedAt: postRunStartedAt,
    reportPath: 'feature/reader/build/test-results/testDebugUnitTest/TEST-example.ReaderTest.xml',
    reportMtime: executedAt,
    reportHash: sha256TextForTest(`report-${id}`),
    evidenceHash: sha256TextForTest(`evidence-${id}`),
    ...overrides,
  }
  if (value.outcome === 'validated') {
    if (overrides.exitCode === undefined) value.exitCode = 1
    if (overrides.expectedExitCode === undefined) value.expectedExitCode = 1
    if (overrides.passedCount === undefined) value.passedCount = 0
    if (overrides.failedCount === undefined) value.failedCount = 1
  }
  if (value.contentPhase === 'pre' && overrides.runStartedAt === undefined) value.runStartedAt = runStartedAt
  value._measurement = {
    runner: 'gradle',
    task: ':feature:reader:testDebugUnitTest',
    executable: './gradlew',
    commandArgs: [':feature:reader:testDebugUnitTest', '--tests', 'example.ReaderTest.emptyInput', '--rerun-tasks'],
    testIdentity: value.testIdentity,
    scenarioFingerprint: value.scenarioFingerprint,
    observedState: overrides.observedState || (value.outcome === 'validated' ? 'BUG_PRESENT' : 'INPUT_ERROR'),
    executedCount: value.executedCount,
    matchedTestCount: value.matchedTestCount,
    passedCount: value.passedCount,
    failedCount: value.failedCount,
    errorCount: value.errorCount,
    skippedCount: value.skippedCount,
    abortedCount: value.abortedCount,
    failureKind: overrides.failureKind || (value.outcome === 'validated' ? 'ASSERTION' : 'NONE'),
    failureSignature: value.outcome === 'validated' ? (overrides.failureSignature || 'AssertionError: expected INPUT_ERROR') : undefined,
    exitCode: value.exitCode,
    command: value.command,
    runStartedAt: value.runStartedAt || (value.contentPhase === 'pre' ? runStartedAt : postRunStartedAt),
    capturedAt: value.executedAt,
    reportPath: value.reportPath,
    reportMtime: value.reportMtime,
    reportHash: value.reportHash,
    evidenceHash: value.evidenceHash,
    oracleSourceHash: defaultOracleSourceHash,
    outputHash: value.outputHash,
    findingFingerprint: value.findingFingerprint,
    evidenceFingerprint: value.evidenceFingerprint,
    ...overrides.measurement,
  }
  return value
}

function validRuntimeReceipt(id, key = 'unused-runtime', overrides = {}) {
  const fields = {
    kind: 'runtime', command: undefined, exitCode: undefined, expectedExitCode: undefined, testIdentity: undefined,
    deviceId: 'pixel-8-api-35', variant: 'debug', oracle: 'empty document returns INPUT_ERROR',
    trigger: 'launch empty.docx', actual: 'INPUT_ERROR', runStartedAt: postRunStartedAt, capturedAt: executedAt,
    evidenceRef: 'artifacts/runtime.json', evidenceHash: sha256TextForTest(`runtime-${id}`),
    crashCount: 0, anrCount: 0, appErrorCount: 0,
    ...overrides,
  }
  const measurement = {
    runner: 'adb', deviceId: fields.deviceId, variant: fields.variant, trigger: fields.trigger, actual: fields.actual,
    observedState: 'INPUT_ERROR', crashCount: fields.crashCount, anrCount: fields.anrCount, appErrorCount: fields.appErrorCount,
    runStartedAt: fields.runStartedAt, capturedAt: fields.capturedAt, evidenceHash: fields.evidenceHash,
    packageName: 'com.exampleapp', buildId: 'debug-build', captureFilter: 'App:*',
    fixtureHash: sha256TextForTest('empty.docx'), appArtifactSha256: sha256TextForTest('debug-apk'),
    ...overrides.measurement,
  }
  return receipt(id, key, { ...fields, measurement })
}

function validCommandReceipt(id, key = 'unused-command', overrides = {}) {
  const fields = {
    kind: 'command', testIdentity: undefined, command: './probe --empty', locator: 'Reader probe',
    oracle: 'returns INPUT_ERROR', expected: 'INPUT_ERROR', actual: 'INPUT_ERROR',
    outputHash: sha256TextForTest(`command-${id}`), exitCode: 0, expectedExitCode: 0,
    ...overrides,
  }
  const [executable, ...commandArgs] = fields.command.split(' ')
  const measurement = {
    runner: 'direct', executable, commandArgs, command: fields.command,
    runStartedAt: postRunStartedAt, capturedAt: executedAt, exitCode: fields.exitCode,
    outputHash: fields.outputHash, observedState: 'INPUT_ERROR',
    ...overrides.measurement,
  }
  return receipt(id, key, { ...fields, measurement })
}

function executionIdentityForTest(receiptValue) {
  const measurement = receiptValue._measurement || {}
  return stableHashForTest({
    kind: receiptValue.kind,
    command: receiptValue.command || null,
    locator: receiptValue.locator || null,
    testIdentity: receiptValue.testIdentity || null,
    task: measurement.task || null,
    executable: measurement.executable || null,
    commandArgs: measurement.commandArgs || null,
    trigger: measurement.trigger || receiptValue.trigger || null,
    deviceId: measurement.deviceId || receiptValue.deviceId || null,
    variant: measurement.variant || receiptValue.variant || null,
    packageName: measurement.packageName || null,
    captureFilter: measurement.captureFilter || null,
    fixtureHash: measurement.fixtureHash || null,
    oracleSourceHash: measurement.oracleSourceHash || null,
  })
}

async function run(args, options = {}) {
  const logs = []
  let coverageArgs = args
  if (typeof args === 'string' && args.trim().startsWith('{')) {
    try { coverageArgs = JSON.parse(args) } catch { coverageArgs = null }
  }
  const coveredIds = options.coveredIds || coverageArgs?.scopeManifest?.changes?.map((item) => item && item.id).filter(Boolean) || []
  const agent = async (_prompt, agentOptions) => {
    const lens = agentOptions.label.replace('lens:', '')
    if (options.throwLens === lens) throw new Error(`simulated ${lens} failure`)
    const lensCoveredIds = options.uncoveredLens === lens ? [] : coveredIds
    return {
      status: 'complete',
      coverage: lensCoveredIds.map((id) => {
        const change = coverageArgs?.scopeManifest?.changes?.find((item) => item.id === id)
        return {
          changeId: id,
          reviewedPatchSha256: options.coveragePatchOverride?.[lens]?.[id] || change?.patchHash,
          ...(change?.kind === 'binary' && !options.omitBinaryCoverage ? { reviewedBinarySha256: coverageArgs.artifacts.find((artifact) => artifact.id === change.binaryArtifactId)?.sha256 } : {}),
          ...(change?.kind === 'binary' && change.binaryBaselineArtifactId && !options.omitBinaryBaselineCoverage ? { reviewedBinaryBaselineSha256: coverageArgs.artifacts.find((artifact) => artifact.id === change.binaryBaselineArtifactId)?.sha256 } : {}),
          locators: [`patch:${id}`],
        }
      }),
      findings: options.findingsByLens?.[lens] || [],
    }
  }
  const result = await executeWorkflow(
    args,
    () => {},
    async (tasks) => Promise.all(tasks.map((task) => task())),
    agent,
    (message) => logs.push(message),
  )
  return { result, logs }
}

test('malformed or legacy args never default to a clean dirty-work audit', async () => {
  const malformed = await run('{bad json')
  assert.equal(malformed.result.verdict, 'INCOMPLETE')
  assert.equal(malformed.result.reason, 'INVALID_ARGS')

  const legacy = await run('the uncommitted Kotlin changes')
  assert.equal(legacy.result.verdict, 'INCOMPLETE')

  const jsonObjectString = await run(JSON.stringify(input()))
  assert.equal(jsonObjectString.result.verdict, 'CLEAR')

  const missingConcurrencyMarker = input({ concurrencyWindow: undefined })
  const missingMarkerResult = (await run(missingConcurrencyMarker)).result
  assert.equal(missingMarkerResult.verdict, 'INCOMPLETE')
  assert.match(missingMarkerResult.errors.join('\n'), /concurrencyWindow must equal optimistic-unattested/)
})

test('valid empty candidate set is audit CLEAR with complete patch-bound coverage', async () => {
  const { result } = await run(input())
  assert.equal(result.verdict, 'CLEAR')
  assert.equal(result.counts.active, 0)
  assert.equal(result.coverageGaps.length, 0)
})

test('new candidate stays open and is never auto-added to fixed', async () => {
  const { result } = await run(input(), { findingsByLens: { business_logic: [candidate()] } })
  assert.equal(result.verdict, 'CONVERGING')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
  assert.equal(result.openKeys.length, 1)
  assert.deepEqual(result.fixedKeys, [])
  assert.equal(result.verificationRequests.length, 1)
})

test('private Handler wording does not auto-defer or create false CLEAN', async () => {
  const finding = candidate({
    detail: 'A private Handler Runnable follows the wrong state transition.',
    klassId: 'state.handler_transition',
  })
  const { result } = await run(input(), { findingsByLens: { state: [finding] } })
  assert.equal(result.verdict, 'CONVERGING')
  assert.equal(result.counts.deferred, 0)
})

test('deferred recurrence is RESIDUALS, not THRASH and never CLEAN', async () => {
  const finding = candidate()
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const verified = receipt('receipt-deferred', key, { outcome: 'validated' })
  const args = input({
    ledger: { entries: [{ key, status: 'deferred', severity: 'P2', receiptId: verified.id, reason: 'Needs approved API change', followUp: 'Open architecture task' }] },
    verificationReceipts: [verified],
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [finding] } })
  assert.equal(result.verdict, 'RESIDUALS')
  assert.equal(result.reason, 'DEFERRED_FINDINGS_REMAIN')
  assert.equal(result.fixedReappeared.length, 0)
})

test('fixed recurrence escalates even when title and line change', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const verified = receipt('receipt-fixed', key)
  const args = input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: verified.id }] },
    verificationReceipts: [verified],
  })
  const changedPresentation = candidate({ title: 'Different wording', line: 99, severity: 'P2' })
  const { result } = await run(args, { findingsByLens: { integration: [changedPresentation] } })
  assert.equal(result.verdict, 'ESCALATE')
  assert.equal(result.reason, 'THRASH_FIXED_FINDING_REAPPEARED')
})

test('a rejected candidate that recurs is reopened instead of being suppressed by generic evidence', async () => {
  const finding = candidate()
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const verified = receipt('receipt-rejected', key, {
    outcome: 'disproved',
    evidenceFingerprint: evidenceFingerprintFor(finding.evidence),
    findingFingerprint: findingFingerprintFor(finding),
  })
  const args = input({
    ledger: { entries: [{ key, status: 'rejected', receiptId: verified.id, rationale: 'Executed branch test proves expected behavior' }] },
    verificationReceipts: [verified],
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [finding] } })
  assert.equal(result.verdict, 'CONVERGING')
  assert.equal(result.counts.active, 1)
  assert.equal(result.counts.rejectedRecurring, 0)
  assert.equal(result.nextLedger.entries.find((entry) => entry.key === key).status, 'open')
})

test('rejected key with novel evidence reopens and never false-CLEANs', async () => {
  const original = candidate()
  const novel = candidate({
    evidence: [{
      kind: 'runtime',
      locator: 'device logcat Reader.open',
      trigger: 'Open an empty document on API 35',
      expected: 'Input error state',
      actual: 'Fatal crash with a new stack signature',
    }],
  })
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const verified = receipt('receipt-rejected-old-evidence', key, {
    outcome: 'disproved',
    evidenceFingerprint: evidenceFingerprintFor(original.evidence),
    findingFingerprint: findingFingerprintFor(original),
  })
  const args = input({
    ledger: { entries: [{ key, status: 'rejected', receiptId: verified.id, rationale: 'Old source-only claim was disproved' }] },
    verificationReceipts: [verified],
  })
  const { result } = await run(args, { findingsByLens: { runtime: [novel] } })
  assert.equal(result.verdict, 'CONVERGING')
  assert.deepEqual(result.rejectedNovelEvidence, [key])
  assert.equal(result.nextLedger.entries.find((entry) => entry.key === key).status, 'open')
  assert.equal(result.verificationRequests.length, 1)
})

test('prior open finding cannot silently disappear', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const args = input({ ledger: { entries: [{ key, status: 'open' }] } })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.equal(result.reason, 'UNACCOUNTED_PRIOR_OPEN_FINDINGS')
  assert.deepEqual(result.unaccountedKeys, [key])
})

test('invalid evidence blocks completion instead of being dropped', async () => {
  const invalid = candidate({ evidence: [{ kind: 'source', locator: 'x' }] })
  const { result } = await run(input(), { findingsByLens: { business_logic: [invalid] } })
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.equal(result.invalidFindings.length, 1)
})

test('duplicate lenses merge by stable identity and keep strongest severity/evidence', async () => {
  const first = candidate()
  const second = candidate({
    line: 77,
    severity: 'P0',
    title: 'Alternate title from another lens',
    evidence: [{
      kind: 'runtime',
      locator: 'device logcat Reader.open',
      trigger: 'Open an empty document',
      expected: 'A recoverable input error',
      actual: 'Fatal process crash',
    }],
  })
  const { result } = await run(input(), {
    findingsByLens: { business_logic: [first], integration: [second] },
  })
  assert.equal(result.findings.length, 1)
  assert.equal(result.findings[0].severity, 'P0')
  assert.equal(result.findings[0].severityConflict, true)
  assert.equal(result.findings[0].evidence.length, 2)
  assert.deepEqual(result.findings[0].lenses.sort(), ['business_logic', 'integration'])
})

test('same class in one file keeps distinct subjects and scenarios separate', async () => {
  const otherBranch = candidate({ subject: 'example.Reader.close', scenarioId: 'double-close' })
  const args = input({ acceptance: [{ id: 'acceptance-1', defect: 'Reader empty input bug', statement: 'Empty input returns INPUT_ERROR', scenarioFingerprint: 'scenario-empty-v1', machineOracle: acceptanceOracle, mandatory: true, blastRadiusAnchors: ['example.Reader.open', 'example.Reader.close'], oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'] }] })
  const { result } = await run(args, {
    findingsByLens: { business_logic: [candidate(), otherBranch] },
  })
  assert.equal(result.findings.length, 2)
  assert.equal(new Set(result.currentKeys).size, 2)
})

test('failed lens or missing required coverage blocks completion', async () => {
  const failed = await run(input(), { throwLens: 'runtime' })
  assert.equal(failed.result.verdict, 'INCOMPLETE')
  assert.ok(failed.result.lensStatuses.some((status) => status.lens === 'runtime' && status.status === 'incomplete'))

  const uncovered = await run(input(), { uncoveredLens: 'integration' })
  assert.equal(uncovered.result.verdict, 'INCOMPLETE')
  assert.ok(uncovered.result.coverageGaps.some((gap) => gap.requiredLens === 'integration'))

  const composeUxGap = await run(input(), { uncoveredLens: 'ux_a11y' })
  assert.equal(composeUxGap.result.verdict, 'INCOMPLETE')
  assert.ok(composeUxGap.result.coverageGaps.some((gap) => gap.requiredLens === 'ux_a11y'))
})

test('out-of-scope findings and invented coverage ids are incomplete, never clean', async () => {
  const outside = candidate({ file: 'unrelated/UserWork.kt' })
  const outsideResult = await run(input(), { findingsByLens: { integration: [outside] } })
  assert.equal(outsideResult.result.verdict, 'INCOMPLETE')
  assert.match(outsideResult.result.invalidFindings[0].errors.join('\n'), /does not match manifest change/)

  const inventedCoverage = await run(input(), { coveredIds: ['change-1', 'invented-change'] })
  assert.equal(inventedCoverage.result.verdict, 'INCOMPLETE')
  assert.ok(inventedCoverage.result.lensStatuses.every((status) => status.status === 'incomplete'))
})

test('diffLines is exact, has no default, and sweep formula is deterministic', async () => {
  for (const [lines, expectedSweeps] of [[40, 2], [250, 5], [500, 8]]) {
    const measured = change({ added: lines, deleted: 0 })
    const { result } = await run(input({ changes: [measured] }))
    assert.equal(result.diffLines, lines)
    assert.equal(result.reviewHorizon, expectedSweeps)
    assert.equal(Object.hasOwn(result, 'maxSweeps'), false)
  }

  const mismatched = input()
  mismatched.scopeManifest.diffLines = 100
  const invalid = await run(mismatched)
  assert.equal(invalid.result.verdict, 'INCOMPLETE')
  assert.match(invalid.result.errors.join('\n'), /does not equal summed change lines/)
})

test('zero-line rename requires and accepts exact old/new path metadata', async () => {
  const previousPath = 'feature/reader/src/main/java/example/OldReader.kt'
  const path = 'feature/reader/src/main/java/example/Reader.kt'
  const patchText = `diff --git a/${previousPath} b/${path}\nsimilarity index 100%\nrename from ${previousPath}\nrename to ${path}\n`
  const renamed = change({ status: 'renamed', previousPath, added: 0, deleted: 0, patchText })
  const { result } = await run(input({ changes: [renamed] }))
  assert.equal(result.verdict, 'CLEAR')
  assert.equal(result.diffLines, 0)
  assert.equal(result.reviewHorizon, 2)

  const missing = input()
  delete missing.scopeManifest.diffLines
  const invalid = await run(missing)
  assert.equal(invalid.result.verdict, 'INCOMPLETE')
})

test('mode-only chmod patch is a valid zero-line change', async () => {
  const path = 'scripts/verify.sh'
  const patchText = `diff --git a/${path} b/${path}\nold mode 100644\nnew mode 100755\n`
  const preimageSha256 = sha256TextForTest('mode-only-content')
  const modeOnly = change({ path, kind: 'script', added: 0, deleted: 0, preimageMode: 0o644, postimageMode: 0o755, preimageSha256, postimageSha256: preimageSha256, patchText })
  const { result } = await run(input({ changes: [modeOnly] }))
  assert.equal(result.verdict, 'CLEAR')
  assert.equal(result.diffLines, 0)
})

test('stale or model-authored resolution receipts are rejected', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const stale = receipt('stale', key, { scopeFingerprint: 'old-scope' })
  const staleInput = input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: stale.id }] },
    verificationReceipts: [stale],
  })
  const staleResult = await run(staleInput)
  assert.equal(staleResult.result.verdict, 'INCOMPLETE')
  assert.match(staleResult.result.errors.join('\n'), /scopeFingerprint mismatch/)

  const assertedOnly = receipt('asserted-only', key, {
    source: 'model',
    outcome: 'disproved',
    evidenceFingerprint: evidenceFingerprintFor(candidate().evidence),
  })
  const assertedInput = input({
    ledger: { entries: [{ key, status: 'rejected', receiptId: assertedOnly.id, rationale: 'Model said so' }] },
    verificationReceipts: [assertedOnly],
  })
  const assertedResult = await run(assertedInput)
  assert.equal(assertedResult.result.verdict, 'INCOMPLETE')
  assert.match(assertedResult.result.errors.join('\n'), /source=main-tool-call-unattested/)

  const staleContent = receipt('stale-content', key, { currentId: 'older-worktree' })
  const staleContentInput = input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: staleContent.id }] },
    verificationReceipts: [staleContent],
  })
  const staleContentResult = await run(staleContentInput)
  assert.equal(staleContentResult.result.verdict, 'INCOMPLETE')
  assert.match(staleContentResult.result.errors.join('\n'), /currentId mismatch/)
})

test('deterministic manifest hash rejects matching but fabricated manifest/receipt text', async () => {
  const args = input()
  args.scopeManifest.contentHash = 'content-fabricated'
  const manifestReceipt = args.verificationReceipts.find((item) => item.id === args.scopeManifest.manifestReceiptId)
  manifestReceipt.contentHash = 'content-fabricated'
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /contentHash mismatch: expected/)
})

test('per-change edit epochs are sealed into the manifest content hash', async () => {
  const args = input()
  args.scopeManifest.changes[0].firstEditStartedAt =
    new Date(Date.parse(args.scopeManifest.changes[0].firstEditStartedAt) + 1_000).toISOString()
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /contentHash mismatch: expected/)
})

test('failed, zero-test, or stale-report receipts cannot resolve a fixed key', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  for (const [invalidReceipt, expectedError] of [
    [receipt('failed-green', key, { exitCode: 1, expectedExitCode: 1 }), /outcome=pass requires exitCode=0/],
    [receipt('zero-test', key, { executedCount: 0 }), /0 < matchedTestCount <= executedCount/],
    [receipt('stale-report', key, { reportMtime: '2026-07-13T11:58:00+07:00' }), /evidence must be captured in the current session|runStartedAt <= reportMtime/],
    [receipt('invalid-executed-at', key, { executedAt: 'not-a-date' }), /executedAt must be a valid timestamp/],
    [receipt('failed-xml-count', key, { passedCount: 0, failedCount: 1 }), /outcome=pass requires failed\/error\/skipped\/aborted counts=0/],
    [receipt('missing-report-hash', key, { reportHash: undefined }), /requires reportHash|SHA-256 reportHash/],
    [receipt('missing-test-evidence-hash', key, { evidenceHash: undefined }), /requires evidenceHash|SHA-256 evidenceHash/],
    [receipt('count-arithmetic-mismatch', key, { executedCount: 2 }), /executedCount must equal parsed result counts/],
    [receipt('error-count', key, { passedCount: 0, errorCount: 1 }), /outcome=pass requires failed\/error\/skipped\/aborted counts=0/],
    [receipt('skipped-count', key, { passedCount: 0, skippedCount: 1 }), /outcome=pass requires failed\/error\/skipped\/aborted counts=0/],
    [receipt('aborted-count', key, { passedCount: 0, abortedCount: 1 }), /outcome=pass requires failed\/error\/skipped\/aborted counts=0/],
  ]) {
    const args = input({
      ledger: { entries: [{ key, status: 'fixed', receiptId: invalidReceipt.id }] },
      verificationReceipts: [invalidReceipt],
    })
    const { result } = await run(args)
    assert.equal(result.verdict, 'INCOMPLETE')
    assert.match(result.errors.join('\n'), expectedError)
  }
})

test('runtime receipts require complete oracle, evidence, counts, and fresh capture order', async () => {
  const valid = validRuntimeReceipt('valid-runtime')
  assert.equal((await run(input({ verificationReceipts: [valid] }))).result.verdict, 'CLEAR')
  const invalidOverrides = [
    [{ trigger: undefined }, /requires trigger/],
    [{ actual: undefined }, /requires actual/],
    [{ evidenceHash: undefined }, /requires evidenceHash|SHA-256 evidenceHash/],
    [{ capturedAt: runStartedAt }, /pre evidence must finish before first edit|post evidence must start after last edit/],
    [{ crashCount: undefined }, /requires non-negative integer crashCount/],
    [{ anrCount: undefined }, /requires non-negative integer anrCount/],
    [{ appErrorCount: undefined }, /requires non-negative integer appErrorCount/],
  ]
  for (const [index, [invalidOverride, expectedError]] of invalidOverrides.entries()) {
    const invalidReceipt = validRuntimeReceipt(`invalid-runtime-${index}`, 'unused-runtime', invalidOverride)
    const args = input({ verificationReceipts: [invalidReceipt] })
    const { result } = await run(args)
    assert.equal(result.verdict, 'INCOMPLETE')
    assert.match(result.errors.join('\n'), expectedError)
  }
})

test('command receipts require a reproducible locator, oracle, comparison, and output hash', async () => {
  const valid = validCommandReceipt('valid-command')
  assert.equal((await run(input({ verificationReceipts: [valid] }))).result.verdict, 'CLEAR')
  for (const field of ['locator', 'oracle', 'expected', 'actual', 'outputHash']) {
    const invalidReceipt = validCommandReceipt(`invalid-command-${field}`, 'unused-command', { [field]: undefined })
    const args = input({ verificationReceipts: [invalidReceipt] })
    const { result } = await run(args)
    assert.equal(result.verdict, 'INCOMPLETE')
    assert.match(result.errors.join('\n'), new RegExp(`requires ${field}|SHA-256 ${field}`))
  }
})

test('arbitrary receipt kind cannot authorize rejected resolution', async () => {
  const finding = candidate()
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const invalidReceipt = receipt('banana-receipt', key, {
    kind: 'banana',
    outcome: 'disproved',
    evidenceFingerprint: evidenceFingerprintFor(finding.evidence),
  })
  const args = input({
    ledger: { entries: [{ key, status: 'rejected', receiptId: invalidReceipt.id, rationale: 'Invalid kind must not close this' }] },
    verificationReceipts: [invalidReceipt],
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [finding] } })
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /invalid kind/)
})

test('runtime PASS receipt with observed crash cannot resolve fixed key', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const runtimeReceipt = receipt('runtime-crash', key, {
    kind: 'runtime',
    command: undefined,
    exitCode: undefined,
    expectedExitCode: undefined,
    deviceId: 'pixel-8-api-35',
    variant: 'debug',
    oracle: 'open empty document without crash',
    trigger: 'launch fixture empty.docx',
    actual: 'process crashed',
    runStartedAt: '2026-07-13T11:59:00+07:00',
    capturedAt: '2026-07-13T12:00:00+07:00',
    evidenceRef: 'artifacts/logcat-empty-docx.txt',
    evidenceHash: 'sha256-logcat',
    crashCount: 1,
    anrCount: 0,
    appErrorCount: 1,
  })
  const args = input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: runtimeReceipt.id }] },
    verificationReceipts: [runtimeReceipt],
  })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /outcome=pass requires crash\/anr\/appError counts=0/)
})

test('binary or pre-existing overlap requires a manual review receipt', async () => {
  const binaryChange = change({
    path: 'feature/reader/src/main/res/raw/fixture.bin',
    kind: 'binary',
    added: 0,
    deleted: 0,
  })
  const { result } = await run(input({ changes: [binaryChange] }))
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /manualReviewReceiptId/)

  const overlap = change({ overlapsPreExisting: false })
  const overlapInput = input({ changes: [overlap] })
  overlapInput.scopeManifest.preExistingDirtyPaths = [overlap.path]
  const overlapResult = await run(overlapInput)
  assert.equal(overlapResult.result.verdict, 'INCOMPLETE')
  assert.match(overlapResult.result.errors.join('\n'), /must set overlapsPreExisting=true/)
})

test('same stable class across three sweeps escalates without calling it untestable', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const verified = receipt('receipt-validated-open', key, { outcome: 'validated' })
  const args = input({
    sweepIndex: 2,
    classHistory: [['logic.branch_contract'], ['logic.branch_contract']],
    budgetHistory: [1, 1],
    ledger: { entries: [{ key, status: 'open', receiptId: verified.id }] },
    verificationReceipts: [verified],
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [candidate()] } })
  assert.equal(result.verdict, 'ESCALATE')
  assert.equal(result.reason, 'SAME_CLASS_THREE_SWEEPS')
  assert.deepEqual(result.sameClassTriple, ['logic.branch_contract'])
})

test('budget cannot shrink across threaded sweeps', async () => {
  const args = input({ sweepIndex: 1, budgetHistory: [500] })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /budgetDiffLines must be >= max/)
})

test('deferred class across three sweeps remains RESIDUALS, not same-class escalation', async () => {
  const finding = candidate()
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const verified = receipt('receipt-deferred-three-sweeps', key, { outcome: 'validated' })
  const args = input({
    sweepIndex: 2,
    classHistory: [['logic.branch_contract'], ['logic.branch_contract']],
    budgetHistory: [1, 1],
    ledger: { entries: [{ key, status: 'deferred', severity: 'P2', receiptId: verified.id, reason: 'Needs device lab', followUp: 'Run OEM matrix' }] },
    verificationReceipts: [verified],
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [finding] } })
  assert.equal(result.verdict, 'RESIDUALS')
  assert.deepEqual(result.sameClassTriple, [])
})

test('contradictory command oracle cannot resolve fixed finding or produce CLEAN', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const contradictory = receipt('contradictory-command', key, {
    kind: 'command', outcome: 'pass', command: 'true', locator: 'Reader.open', oracle: 'document visible',
    expected: 'VISIBLE', actual: 'BLANK', outputHash: sha256TextForTest('command-output'),
    machineOracle: { metric: 'actualState', op: 'eq', value: 'VISIBLE' },
    measurement: { actualState: 'BLANK', exitCode: 0 },
  })
  const args = input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: contradictory.id }] },
    verificationReceipts: [contradictory],
  })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.notEqual(result.verdict, 'CLEAN')
  assert.match(result.errors.join('\n'), /machine oracle did not pass|requires passing postReceiptId/)
})

test('runtime pass or disproval cannot hide observed failure behind caller counts', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  for (const outcome of ['pass', 'disproved']) {
    const runtime = receipt(`runtime-contradiction-${outcome}`, key, {
      kind: 'runtime', outcome, command: undefined, exitCode: undefined, expectedExitCode: undefined,
      deviceId: 'pixel-8', variant: 'debug', oracle: 'document visible', trigger: 'open empty.docx', actual: 'CRASH',
      runStartedAt, capturedAt: executedAt, evidenceRef: 'inline runtime measurement', evidenceHash: sha256TextForTest('runtime'),
      crashCount: 0, anrCount: 0, appErrorCount: 0,
      machineOracle: { metric: 'actualState', op: 'eq', value: 'VISIBLE' },
      measurement: {
        deviceId: 'pixel-8', variant: 'debug', trigger: 'open empty.docx', actual: 'CRASH', actualState: 'CRASH',
        crashCount: 1, anrCount: 0, appErrorCount: 1, packageName: 'com.example', buildId: 'debug-apk-sha',
        captureFilter: 'com.example', fixtureHash: sha256TextForTest('empty.docx'),
      },
    })
    const ledger = outcome === 'pass'
      ? { key, status: 'fixed', receiptId: runtime.id }
      : { key, status: 'rejected', receiptId: runtime.id, rationale: 'must not reject observed crash' }
    const { result } = await run(input({ ledger: { entries: [ledger] }, verificationReceipts: [runtime] }))
    assert.equal(result.verdict, 'INCOMPLETE')
    assert.notEqual(result.verdict, 'CLEAN')
  }
})

test('unrelated GREEN test cannot fix a finding', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const unrelated = receipt('unrelated-green', key, { testIdentity: 'example.MathTest#onePlusOne' })
  const { result } = await run(input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: unrelated.id }] },
    verificationReceipts: [unrelated],
  }))
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /RED\/GREEN execution identity mismatch/)
})

test('invalid or future provenance timestamps fail closed', async () => {
  const invalidManifest = input()
  invalidManifest.scopeManifest.generatedAt = 'not-a-date'
  assert.equal((await run(invalidManifest)).result.verdict, 'INCOMPLETE')

  const future = receipt('future-receipt', 'unused-key', { executedAt: new Date(Date.now() + 3_600_000).toISOString() })
  const futureResult = await run(input({ verificationReceipts: [future] }))
  assert.equal(futureResult.result.verdict, 'INCOMPLETE')
  assert.match(futureResult.result.errors.join('\n'), /cannot be in the future/)
})

test('null nested changes return INCOMPLETE instead of throwing', async () => {
  const args = input()
  args.scopeManifest.changes = [null]
  args.scopeManifest.ownedPaths = ['invalid/null-change']
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.ok(['INVALID_CONTRACT', 'INTERNAL_VALIDATION_ERROR'].includes(result.reason))
})

test('history must align with sweep and budget must remain monotonic', async () => {
  const forgedClassHistory = input({ classHistory: [['logic.x'], ['logic.x']] })
  assert.equal((await run(forgedClassHistory)).result.verdict, 'INCOMPLETE')

  const shrinkingBudget = input({ sweepIndex: 2, classHistory: [[], []], budgetHistory: [500, 1] })
  shrinkingBudget.scopeManifest.budgetDiffLines = 500
  const result = (await run(shrinkingBudget)).result
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /non-decreasing/)
})

test('prototype severity and invalid change status are rejected', async () => {
  const severity = await run(input(), { findingsByLens: { business_logic: [candidate({ severity: 'toString' })] } })
  assert.equal(severity.result.verdict, 'INCOMPLETE')
  assert.match(severity.result.invalidFindings[0].errors.join('\n'), /invalid severity/)

  const invalidStatus = input({ changes: [change({ status: 'potato' })] })
  assert.equal((await run(invalidStatus)).result.verdict, 'INCOMPLETE')
})

test('coverage must bind every lens response to the exact patch SHA', async () => {
  const args = input()
  const result = await run(args, { coveragePatchOverride: { integration: { 'change-1': sha256TextForTest('old patch') } } })
  assert.equal(result.result.verdict, 'INCOMPLETE')
  assert.ok(result.result.lensStatuses.some((status) => status.lens === 'integration' && status.status === 'incomplete'))
})

test('missing RED proof blocks audit completion and terminal CLEAN', async () => {
  const args = input({ regressionProofs: [] })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
})

test('a passing post receipt without a pre receipt cannot prove a bug fixed', async () => {
  const args = input({
    regressionProofs: [{
      id: 'missing-pre-proof',
      acceptanceId: 'acceptance-1',
      postReceiptId: 'base-green',
    }],
  })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
  assert.match(result.errors.join('\n'), /requires genuine failing pre-fix acceptance oracle/)
})

test('a RED waiver is rejected even when the paired RED and GREEN proof is otherwise valid', async () => {
  const args = input()
  args.regressionProofs[0] = {
    ...args.regressionProofs[0],
    waiver: {
      boundary: 'A real RED already exists',
      attemptedLayers: ['unit'],
      residual: true,
    },
  }
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
  assert.match(result.errors.join('\n'), /cannot waive an executed pre-fix oracle/)
})

test('a paired compile command is valid when the acceptance is the build failure itself', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|build.compile_failure|reader-module|compile-debug'
  const buildOracle = { metric: 'observedState', op: 'eq', value: 'BUILD_OK' }
  const command = './gradlew :feature:reader:compileDebugKotlin --rerun-tasks'
  const commandArgs = [':feature:reader:compileDebugKotlin', '--rerun-tasks']
  const acceptanceId = 'build-acceptance'
  const scenarioFingerprint = 'reader-compile-debug-v1'
  const pre = validCommandReceipt('build-red', key, {
    acceptanceId,
    scenarioFingerprint,
    machineOracle: buildOracle,
    command,
    locator: ':feature:reader:compileDebugKotlin',
    oracle: 'Gradle compile exits zero',
    expected: 'BUILD_OK',
    actual: 'BUILD_FAIL',
    outcome: 'validated',
    contentPhase: 'pre',
    executedAt: preExecutedAt,
    runStartedAt,
    exitCode: 1,
    expectedExitCode: 1,
    outputHash: sha256TextForTest('build-red-output'),
    measurement: {
      runner: 'gradle',
      executable: './gradlew',
      commandArgs,
      command,
      runStartedAt,
      capturedAt: preExecutedAt,
      exitCode: 1,
      outputHash: sha256TextForTest('build-red-output'),
      observedState: 'BUILD_FAIL',
      failureSignature: 'Kotlin compilation failed',
    },
  })
  const post = validCommandReceipt('build-green', key, {
    acceptanceId,
    scenarioFingerprint,
    machineOracle: buildOracle,
    command,
    locator: ':feature:reader:compileDebugKotlin',
    oracle: 'Gradle compile exits zero',
    expected: 'BUILD_OK',
    actual: 'BUILD_OK',
    outputHash: sha256TextForTest('build-green-output'),
    measurement: {
      runner: 'gradle',
      executable: './gradlew',
      commandArgs,
      command,
      runStartedAt: postRunStartedAt,
      capturedAt: executedAt,
      exitCode: 0,
      outputHash: sha256TextForTest('build-green-output'),
      observedState: 'BUILD_OK',
    },
  })
  const args = input({
    acceptance: [
      {
        id: 'acceptance-1',
        defect: 'Reader empty input bug',
        statement: 'Empty input returns INPUT_ERROR',
        scenarioFingerprint: 'scenario-empty-v1',
        machineOracle: acceptanceOracle,
        mandatory: true,
        blastRadiusAnchors: ['example.Reader.open'],
        oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'],
      },
      {
        id: acceptanceId,
        defect: 'Reader module does not compile',
        statement: 'Reader debug Kotlin compilation succeeds',
        scenarioFingerprint,
        machineOracle: buildOracle,
        mandatory: true,
        blastRadiusAnchors: ['feature.reader'],
        oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'],
      },
    ],
    ledger: { entries: [{ key, status: 'fixed', receiptId: post.id }] },
    verificationReceipts: [pre, post],
    regressionProofs: [
      {
        id: 'proof-base',
        acceptanceId: 'acceptance-1',
        preReceiptId: 'base-red',
        postReceiptId: 'base-green',
      },
      {
        id: 'build-command-proof',
        acceptanceId,
        preReceiptId: pre.id,
        postReceiptId: post.id,
      },
    ],
  })
  const { result } = await run(args)
  assert.equal(result.verdict, 'CLEAR', JSON.stringify(result.errors))
})

test('a GREEN characterization guard is not forced to become the RED regression proof', async () => {
  const guardPath = 'feature/reader/src/test/java/example/NonEmptyGuardTest.kt'
  const guardSourceStates = [{
    path: guardPath,
    sha256: sha256TextForTest('non-empty-guard-v1'),
    mode: 0o644,
    observationToken: sha256TextForTest('non-empty-guard-observation-v1'),
  }]
  const command = './gradlew :feature:reader:testDebugUnitTest --tests example.ReaderTest.nonEmptyInputStillOpens --rerun-tasks'
  const guard = receipt('unchanged-side-characterization', 'guard|unchanged-side', {
    command,
    acceptanceId: 'acceptance-characterization',
    scenarioFingerprint: 'scenario-non-empty-guard-v1',
    testIdentity: 'example.ReaderTest#nonEmptyInputStillOpens',
    _oracleSourceStates: guardSourceStates,
    measurement: {
      testIdentity: 'example.ReaderTest#nonEmptyInputStillOpens',
      command,
      commandArgs: [':feature:reader:testDebugUnitTest', '--tests', 'example.ReaderTest.nonEmptyInputStillOpens', '--rerun-tasks'],
    },
  })
  const changes = [
    change(),
    change({
      id: 'change-characterization',
      path: guardPath,
      kind: 'test',
      patchArtifactId: 'patch-change-characterization',
      postimageSha256: guardSourceStates[0].sha256,
    }),
  ]
  const acceptance = [
    {
      id: 'acceptance-1',
      defect: 'Reader empty input bug',
      statement: 'Empty input returns INPUT_ERROR',
      scenarioFingerprint: 'scenario-empty-v1',
      machineOracle: acceptanceOracle,
      mandatory: true,
      blastRadiusAnchors: ['example.Reader.open'],
      oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'],
    },
    {
      id: 'acceptance-characterization',
      defect: 'Non-empty behavior must remain unchanged',
      statement: 'Non-empty input still opens',
      scenarioFingerprint: 'scenario-non-empty-guard-v1',
      machineOracle: acceptanceOracle,
      mandatory: false,
      blastRadiusAnchors: ['example.Reader.open'],
      oracleSourcePaths: [guardPath],
    },
  ]
  const withoutGate = (await run(input({ changes, acceptance, verificationReceipts: [guard] }))).result
  assert.equal(withoutGate.verdict, 'INCOMPLETE')
  assert.match(withoutGate.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)

  const gate = {
    id: 'characterization-gate',
    mandatory: false,
    applicable: true,
    kind: 'test',
    checkKey: guard.key,
    acceptanceId: guard.acceptanceId,
    scenarioFingerprint: guard.scenarioFingerprint,
    executionIdentity: executionIdentityForTest(guard),
    finalReceiptId: guard.id,
  }
  const withGate = (await run(input({
    changes,
    acceptance,
    verificationReceipts: [guard],
    verificationGates: [gate],
  }))).result
  assert.equal(withGate.verdict, 'CLEAR', JSON.stringify(withGate.errors))
})

test('a RED run after editing the test but before editing implementation is valid', async () => {
  const testEditStartedAt = new Date(Date.parse(preExecutedAt) - 8_000).toISOString()
  const testEditFinishedAt = new Date(Date.parse(preExecutedAt) - 6_000).toISOString()
  const implementationEditStartedAt = new Date(Date.parse(preExecutedAt) + 8_000).toISOString()
  const implementationEditFinishedAt = new Date(Date.parse(preExecutedAt) + 10_000).toISOString()
  const args = input({
    changes: [
      change({
        id: 'change-test',
        path: 'feature/reader/src/test/java/example/ReaderTest.kt',
        kind: 'test',
        postimageSha256: defaultOracleSourceStates[0].sha256,
        patchArtifactId: 'patch-change-test',
        patchText: 'diff --git a/feature/reader/src/test/java/example/ReaderTest.kt b/feature/reader/src/test/java/example/ReaderTest.kt\n--- a/feature/reader/src/test/java/example/ReaderTest.kt\n+++ b/feature/reader/src/test/java/example/ReaderTest.kt\n@@ -1,0 +1,1 @@\n+new-test\n',
        firstEditStartedAt: testEditStartedAt,
        lastEditFinishedAt: testEditFinishedAt,
      }),
      change({
        id: 'change-implementation',
        firstEditStartedAt: implementationEditStartedAt,
        lastEditFinishedAt: implementationEditFinishedAt,
      }),
    ],
  })
  args.scopeManifest.firstEditStartedAt = testEditStartedAt
  const red = args.verificationReceipts.find((item) => item.id === 'base-red')
  assert.notEqual(red.currentId, args.scopeManifest.baselineContentId)
  const redSourceArtifact = args.artifacts.find((artifact) => artifact.id === 'oracle-source-base-red')
  const redSource = JSON.parse(Buffer.from(redSourceArtifact.payload, 'base64').toString('utf8'))
  assert.equal(red.currentId, redSource.scopeContentId)
  const { result } = await run(args)
  assert.equal(result.verdict, 'CLEAR', JSON.stringify(result.errors))
})

test('a RED run after the associated implementation edit is rejected', async () => {
  const implementationEditStartedAt = new Date(Date.parse(preExecutedAt) - 1_000).toISOString()
  const args = input({
    changes: [change({
      firstEditStartedAt: implementationEditStartedAt,
      lastEditFinishedAt,
    })],
  })
  args.scopeManifest.firstEditStartedAt = implementationEditStartedAt
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /RED.*implementation edit/)
})

test('changing the test or harness source invalidates an earlier RED receipt', async () => {
  const args = input()
  for (const [artifactId, oracleSourceHash] of [
    ['measurement-base-red', sha256TextForTest('oracle-source-before')],
    ['measurement-base-green', sha256TextForTest('oracle-source-after')],
  ]) {
    const index = args.artifacts.findIndex((artifact) => artifact.id === artifactId)
    const artifact = args.artifacts[index]
    const measurement = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
    args.artifacts[index] = inlineArtifact(artifactId, 'application/json', {
      ...measurement,
      oracleSourceHash,
    })
  }
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /RED\/GREEN execution identity mismatch/)
})

test('RED and GREEN must bind the exact same fixed key', async () => {
  const args = input()
  const green = args.verificationReceipts.find((item) => item.id === 'base-green')
  green.key = 'feature/reader/src/main/java/example/reader.kt|logic.other_branch|example.reader.open|empty-input'
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /RED\/GREEN fixed key mismatch/)
})

test('an operational receipt without an oracle source hash is incomplete', async () => {
  const args = input()
  const index = args.artifacts.findIndex((artifact) => artifact.id === 'measurement-base-red')
  const artifact = args.artifacts[index]
  const measurement = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
  delete measurement.oracleSourceHash
  args.artifacts[index] = inlineArtifact(artifact.id, 'application/json', measurement)
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /requires SHA-256 oracleSourceHash/)
})

test('an operational receipt requires driver-attested oracle source state', async () => {
  const args = input()
  const index = args.artifacts.findIndex((artifact) => artifact.id === 'measurement-base-red')
  const artifact = args.artifacts[index]
  const measurement = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
  delete measurement.oracleSourceArtifactId
  args.artifacts[index] = inlineArtifact(artifact.id, 'application/json', measurement)
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /oracle source artifact/)
})

test('changed oracle source bytes cannot reuse the prior declared hash', async () => {
  const args = input()
  const index = args.artifacts.findIndex((artifact) => artifact.id === 'oracle-source-base-green')
  const artifact = args.artifacts[index]
  const payload = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
  payload.sourceStates[0].sha256 = sha256TextForTest('changed-reader-test-harness')
  args.artifacts[index] = inlineArtifact(
    artifact.id,
    'application/vnd.exampleapp.oracle-source+json',
    payload,
  )
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /oracle source artifact is malformed or hash-mismatched/)
})

test('deleted oracle source uses an explicit ABSENT tombstone', async () => {
  const applyTombstone = (args, id, sha256 = sha256TextForTest('ABSENT')) => {
    const sourceId = `oracle-source-${id}`
    const sourceIndex = args.artifacts.findIndex((artifact) => artifact.id === sourceId)
    const sourceArtifact = args.artifacts[sourceIndex]
    const source = JSON.parse(Buffer.from(sourceArtifact.payload, 'base64').toString('utf8'))
    source.sourceStates = [{
      path: defaultOracleSourceStates[0].path,
      sha256,
      mode: null,
      observationToken: sha256TextForTest('tombstone-observation'),
    }]
    source.sourceHash = sha256ValueForTest(source.sourceStates)
    args.artifacts[sourceIndex] = inlineArtifact(
      sourceId,
      'application/vnd.exampleapp.oracle-source+json',
      source,
    )
    const measurementId = `measurement-${id}`
    const measurementIndex = args.artifacts.findIndex((artifact) => artifact.id === measurementId)
    const measurementArtifact = args.artifacts[measurementIndex]
    const measurement = JSON.parse(Buffer.from(measurementArtifact.payload, 'base64').toString('utf8'))
    measurement.oracleSourceHash = source.sourceHash
    args.artifacts[measurementIndex] = inlineArtifact(measurementId, 'application/json', measurement)
  }

  const valid = input()
  applyTombstone(valid, 'base-red')
  applyTombstone(valid, 'base-green')
  const validResult = (await run(valid)).result
  assert.equal(validResult.auditVerdict, 'CLEAR', JSON.stringify(validResult))

  const invalid = input()
  applyTombstone(invalid, 'base-green', sha256TextForTest('not-absent'))
  const invalidResult = (await run(invalid)).result
  assert.equal(invalidResult.verdict, 'INCOMPLETE')
  assert.match(invalidResult.errors.join('\n'), /oracle source artifact is malformed or hash-mismatched/)
})

test('oracle source capture window must enclose the measured execution', async () => {
  const args = input()
  const index = args.artifacts.findIndex((artifact) => artifact.id === 'oracle-source-base-red')
  const artifact = args.artifacts[index]
  const payload = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
  payload.finishedAt = new Date(Date.parse(preExecutedAt) - 1).toISOString()
  args.artifacts[index] = inlineArtifact(
    artifact.id,
    'application/vnd.exampleapp.oracle-source+json',
    payload,
  )
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /must be enclosed by its oracle source capture window/)
})

test('pre receipt must bind the captured intermediate scope state', async () => {
  const args = input()
  const index = args.artifacts.findIndex((artifact) => artifact.id === 'oracle-source-base-red')
  const artifact = args.artifacts[index]
  const payload = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
  payload.scopeContentId = sha256TextForTest('invented-intermediate-scope')
  args.artifacts[index] = inlineArtifact(
    artifact.id,
    'application/vnd.exampleapp.oracle-source+json',
    payload,
  )
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /pre content must match captured scope state/)
})

test('oracle source artifact must retain canonical scoped states backing scopeContentId', async () => {
  for (const mutate of [
    (payload) => { payload.scopeStates = [] },
    (payload) => { payload.scopeStates[0].postimageSha256 = sha256TextForTest('invented-scope-state') },
    (payload) => { delete payload.scopeStates[0].observationToken },
  ]) {
    const args = input()
    const index = args.artifacts.findIndex((artifact) => artifact.id === 'oracle-source-base-red')
    const artifact = args.artifacts[index]
    const payload = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
    mutate(payload)
    args.artifacts[index] = inlineArtifact(
      artifact.id,
      'application/vnd.exampleapp.oracle-source+json',
      payload,
    )
    const { result } = await run(args)
    assert.equal(result.verdict, 'INCOMPLETE')
    assert.match(result.errors.join('\n'), /scoped states are malformed or do not back scopeContentId/)
  }

  const subset = input({
    changes: [
      change(),
      change({
        id: 'change-2',
        path: 'feature/reader/src/main/java/example/Other.kt',
        patchArtifactId: 'patch-change-2',
      }),
    ],
  })
  const index = subset.artifacts.findIndex((artifact) => artifact.id === 'oracle-source-base-red')
  const artifact = subset.artifacts[index]
  const payload = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
  payload.scopeStates = payload.scopeStates.filter((state) => state.path.endsWith('/Other.kt'))
  payload.scopeContentId = sha256ValueForTest(
    payload.scopeStates.map(({ path, postimageSha256, mode }) => ({ path, postimageSha256, mode })),
  )
  subset.artifacts[index] = inlineArtifact(
    artifact.id,
    'application/vnd.exampleapp.oracle-source+json',
    payload,
  )
  const redReceipt = subset.verificationReceipts.find((receipt) => receipt.id === 'base-red')
  redReceipt.currentId = payload.scopeContentId
  redReceipt.contentHash = payload.scopeContentId
  const subsetResult = (await run(subset)).result
  assert.equal(subsetResult.verdict, 'INCOMPLETE')
  assert.match(subsetResult.errors.join('\n'), /scoped states must exactly cover manifest changes/)

  const divergentPost = input()
  const postIndex = divergentPost.artifacts.findIndex((item) => item.id === 'oracle-source-base-green')
  const postArtifact = divergentPost.artifacts[postIndex]
  const postPayload = JSON.parse(Buffer.from(postArtifact.payload, 'base64').toString('utf8'))
  postPayload.scopeStates[0].postimageSha256 = sha256TextForTest('divergent-post-scope')
  postPayload.scopeContentId = sha256ValueForTest(
    postPayload.scopeStates.map(({ path, postimageSha256, mode }) => ({ path, postimageSha256, mode })),
  )
  divergentPost.artifacts[postIndex] = inlineArtifact(
    postArtifact.id,
    'application/vnd.exampleapp.oracle-source+json',
    postPayload,
  )
  const divergentResult = (await run(divergentPost)).result
  assert.equal(divergentResult.verdict, 'INCOMPLETE')
  assert.match(divergentResult.errors.join('\n'), /post content must match captured scope state/)
})

test('acceptance owns the exact oracle source set', async () => {
  const missing = input()
  delete missing.acceptance[0].oracleSourcePaths
  const missingResult = (await run(missing)).result
  assert.equal(missingResult.verdict, 'INCOMPLETE')
  assert.match(missingResult.errors.join('\n'), /oracleSourcePaths/)

  const mismatched = input()
  mismatched.acceptance[0].oracleSourcePaths = ['feature/reader/src/test/java/example/OtherHarness.kt']
  const mismatchResult = (await run(mismatched)).result
  assert.equal(mismatchResult.verdict, 'INCOMPLETE')
  assert.match(mismatchResult.errors.join('\n'), /oracle source paths must exactly match acceptance/)

  const changedTest = input({
    changes: [
      change(),
      change({
        id: 'change-test-1',
        path: 'feature/reader/src/test/java/example/ReaderTest.kt',
        kind: 'test',
        patchArtifactId: 'patch-change-test-1',
      }),
    ],
  })
  changedTest.acceptance[0].oracleSourcePaths = ['feature/reader/src/test/java/example/OtherHarness.kt']
  const changedTestResult = (await run(changedTest)).result
  assert.equal(changedTestResult.verdict, 'INCOMPLETE')
  assert.match(changedTestResult.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)
})

test('changed oracle support belongs to at least one acceptance instead of every acceptance', async () => {
  const testAPath = 'feature/reader/src/test/java/example/ReaderTest.kt'
  const testBPath = 'core/testing/src/main/java/example/MainDispatcherRule.kt'
  const otherSourceStates = [{
    path: testBPath,
    sha256: sha256TextForTest('other-reader-test-harness-v1'),
    mode: 0o644,
    observationToken: sha256TextForTest('other-reader-test-observation-v1'),
  }]
  const changes = [
    change(),
    change({
      id: 'change-test-a',
      path: testAPath,
      kind: 'test',
      patchArtifactId: 'patch-change-test-a',
      postimageSha256: defaultOracleSourceStates[0].sha256,
    }),
    change({
      id: 'change-test-b',
      path: testBPath,
      kind: 'kotlin',
      patchArtifactId: 'patch-change-test-b',
      postimageSha256: otherSourceStates[0].sha256,
    }),
  ]
  const acceptance = [
    {
      id: 'acceptance-1',
      defect: 'Reader empty input bug',
      statement: 'Empty input returns INPUT_ERROR',
      scenarioFingerprint: 'scenario-empty-v1',
      machineOracle: acceptanceOracle,
      mandatory: true,
      blastRadiusAnchors: ['example.Reader.open'],
      oracleSourcePaths: [testAPath],
    },
    {
      id: 'acceptance-2',
      defect: 'Other reader branch',
      statement: 'Other branch remains stable',
      scenarioFingerprint: 'scenario-other-v1',
      machineOracle: acceptanceOracle,
      mandatory: false,
      blastRadiusAnchors: ['example.Reader.other'],
      oracleSourcePaths: [testBPath],
    },
  ]
  const sinkResult = (await run(input({ changes, acceptance }))).result
  assert.equal(sinkResult.verdict, 'INCOMPLETE')
  assert.match(sinkResult.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)

  const otherKey = 'feature/reader/src/main/java/example/reader.kt|logic.other_branch|example.reader.other|other'
  const otherRed = receipt('other-red', otherKey, {
    acceptanceId: 'acceptance-2',
    scenarioFingerprint: 'scenario-other-v1',
    outcome: 'validated',
    contentPhase: 'pre',
    executedAt: preExecutedAt,
    runStartedAt,
    reportMtime: preExecutedAt,
    testIdentity: 'example.OtherReaderTest#other',
    _oracleSourceStates: otherSourceStates,
  })
  const stalePreResult = (await run(input({
    changes,
    acceptance,
    verificationReceipts: [otherRed],
  }))).result
  assert.equal(stalePreResult.verdict, 'INCOMPLETE')
  assert.match(stalePreResult.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)

  const failedPost = receipt('other-failed-post', otherKey, {
    acceptanceId: 'acceptance-2',
    scenarioFingerprint: 'scenario-other-v1',
    outcome: 'validated',
    contentPhase: 'post',
    testIdentity: 'example.OtherReaderTest#other',
    _oracleSourceStates: otherSourceStates,
  })
  const failedPostResult = (await run(input({
    changes,
    acceptance,
    verificationReceipts: [failedPost],
  }))).result
  assert.equal(failedPostResult.verdict, 'INCOMPLETE')
  assert.match(failedPostResult.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)

  const wrongPostSource = [{
    ...otherSourceStates[0],
    sha256: sha256TextForTest('stale-other-reader-test-harness'),
  }]
  const wrongPost = receipt('other-wrong-post', otherKey, {
    acceptanceId: 'acceptance-2',
    scenarioFingerprint: 'scenario-other-v1',
    testIdentity: 'example.OtherReaderTest#other',
    _oracleSourceStates: wrongPostSource,
  })
  const wrongPostResult = (await run(input({
    changes,
    acceptance,
    verificationReceipts: [wrongPost],
  }))).result
  assert.equal(wrongPostResult.verdict, 'INCOMPLETE')
  assert.match(wrongPostResult.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)

  const otherGreen = receipt('other-green', otherKey, {
    acceptanceId: 'acceptance-2',
    scenarioFingerprint: 'scenario-other-v1',
    testIdentity: 'example.OtherReaderTest#other',
    _oracleSourceStates: otherSourceStates,
  })
  const unpairedPostResult = (await run(input({
    changes,
    acceptance,
    verificationReceipts: [otherGreen],
    regressionProofs: [
      { id: 'proof-base', acceptanceId: 'acceptance-1', preReceiptId: 'base-red', postReceiptId: 'base-green' },
    ],
  }))).result
  assert.equal(unpairedPostResult.verdict, 'INCOMPLETE')
  assert.match(unpairedPostResult.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)

  const executed = input({
    changes,
    acceptance,
    verificationReceipts: [otherRed, otherGreen],
    regressionProofs: [
      { id: 'proof-base', acceptanceId: 'acceptance-1', preReceiptId: 'base-red', postReceiptId: 'base-green' },
      { id: 'proof-other', acceptanceId: 'acceptance-2', preReceiptId: 'other-red', postReceiptId: 'other-green' },
    ],
  })
  const executedResult = (await run(executed)).result
  assert.equal(executedResult.auditVerdict, 'CLEAR', JSON.stringify(executedResult))

  const omittedFixture = input({
    changes: [
      change(),
      change({
        id: 'change-fixture',
        path: 'feature/reader/src/test/resources/empty-reader.json',
        kind: 'other_text',
        patchArtifactId: 'patch-change-fixture',
      }),
    ],
  })
  const omittedResult = (await run(omittedFixture)).result
  assert.equal(omittedResult.verdict, 'INCOMPLETE')
  assert.match(omittedResult.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)
})

test('changed oracle support can be consumed by an exact disproved rejection', async () => {
  const supportPath = 'feature/reader/src/test/java/example/FalsePositiveProbe.kt'
  const supportStates = [{
    path: supportPath,
    sha256: sha256TextForTest('false-positive-probe-v1'),
    mode: 0o644,
    observationToken: sha256TextForTest('false-positive-probe-observation-v1'),
  }]
  const changes = [
    change(),
    change({
      id: 'change-disproof-probe',
      path: supportPath,
      kind: 'test',
      patchArtifactId: 'patch-change-disproof-probe',
      postimageSha256: supportStates[0].sha256,
    }),
  ]
  const acceptance = [
    {
      id: 'acceptance-1',
      defect: 'Reader empty input bug',
      statement: 'Empty input returns INPUT_ERROR',
      scenarioFingerprint: 'scenario-empty-v1',
      machineOracle: acceptanceOracle,
      mandatory: true,
      blastRadiusAnchors: ['example.Reader.open'],
      oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'],
    },
    {
      id: 'acceptance-disproof',
      defect: 'Reported branch failure may be a false positive',
      statement: 'Reported branch follows expected behavior',
      scenarioFingerprint: 'scenario-disproof-v1',
      machineOracle: acceptanceOracle,
      mandatory: false,
      blastRadiusAnchors: ['example.Reader.open'],
      oracleSourcePaths: [supportPath],
    },
  ]
  const finding = candidate({
    ruleId: 'logic.reported_branch',
    klassId: 'logic.reported_branch',
    scenarioId: 'reported-branch',
    acceptanceId: 'acceptance-disproof',
    scenarioFingerprint: 'scenario-disproof-v1',
  })
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.reported_branch|example.reader.open|reported-branch'
  const disproved = receipt('disproved-reported-branch', key, {
    outcome: 'disproved',
    acceptanceId: 'acceptance-disproof',
    scenarioFingerprint: 'scenario-disproof-v1',
    _oracleSourceStates: supportStates,
    evidenceFingerprint: evidenceFingerprintFor(finding.evidence),
    findingFingerprint: findingFingerprintFor(finding),
  })
  const result = (await run(input({
    changes,
    acceptance,
    ledger: {
      entries: [{
        key,
        status: 'rejected',
        receiptId: disproved.id,
        rationale: 'Executed probe disproves the reported branch failure',
      }],
    },
    verificationReceipts: [disproved],
  }))).result
  assert.equal(result.verdict, 'CLEAR', JSON.stringify(result.errors))
})

test('project tester corpus requires an exact role-bound consumer', async () => {
  const corpusPath = 'app/tester/files/input.csv'
  const corpusStates = [{
    path: corpusPath,
    sha256: sha256TextForTest('tester-corpus-v1'),
    mode: 0o644,
    observationToken: sha256TextForTest('tester-corpus-observation-v1'),
  }]
  const changes = [
    change(),
    change({
      id: 'change-tester-corpus',
      path: corpusPath,
      kind: 'other_text',
      patchArtifactId: 'patch-change-tester-corpus',
      postimageSha256: corpusStates[0].sha256,
    }),
  ]
  const acceptance = [
    {
      id: 'acceptance-1',
      defect: 'Reader empty input bug',
      statement: 'Empty input returns INPUT_ERROR',
      scenarioFingerprint: 'scenario-empty-v1',
      machineOracle: acceptanceOracle,
      mandatory: true,
      blastRadiusAnchors: ['example.Reader.open'],
      oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'],
    },
    {
      id: 'acceptance-corpus',
      defect: 'Tester corpus remains readable',
      statement: 'Tester corpus opens without an app error',
      scenarioFingerprint: 'scenario-tester-corpus-v1',
      machineOracle: acceptanceOracle,
      mandatory: false,
      blastRadiusAnchors: ['tester.corpus'],
      oracleSourcePaths: [corpusPath],
    },
  ]
  const corpusReceipt = receipt('tester-corpus-post', 'gate|tester-corpus', {
    acceptanceId: 'acceptance-corpus',
    scenarioFingerprint: 'scenario-tester-corpus-v1',
    testIdentity: 'example.TesterCorpusTest#inputCsv',
    _oracleSourceStates: corpusStates,
  })
  const unbound = (await run(input({ changes, acceptance }))).result
  assert.equal(unbound.verdict, 'INCOMPLETE')
  assert.match(unbound.errors.join('\n'), /changed oracle-support path requires a role-bound terminal consumer/)

  const boundArgs = input({
    changes,
    acceptance,
    verificationReceipts: [corpusReceipt],
  })
  const gate = {
    id: 'tester-corpus-gate',
    mandatory: false,
    applicable: true,
    kind: 'test',
    checkKey: corpusReceipt.key,
    acceptanceId: corpusReceipt.acceptanceId,
    scenarioFingerprint: corpusReceipt.scenarioFingerprint,
    executionIdentity: executionIdentityForTest(corpusReceipt),
    finalReceiptId: corpusReceipt.id,
  }
  boundArgs.verificationGates = [gate]
  const bound = (await run(boundArgs)).result
  assert.equal(bound.verdict, 'CLEAR', JSON.stringify(bound.errors))
})

test('sweep horizon is a continuation checkpoint, not a terminal escalation', async () => {
  const measured = change({ added: 2_000, deleted: 0 })
  const args = input({
    changes: [measured],
    sweepIndex: 14,
    classHistory: Array.from({ length: 14 }, () => []),
    budgetHistory: Array(14).fill(2_000),
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [candidate()] } })
  assert.equal(result.verdict, 'CONVERGING')
  assert.equal(result.reason, 'OPEN_CANDIDATES_REQUIRE_DRIVER_VALIDATION')
})

test('mandatory missing gate blocks while new and pre-existing failures are distinguished', async () => {
  const gateBase = { kind: 'command', checkKey: 'gate-key', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1', executionIdentity: sha256TextForTest('missing-command-spec') }
  const missing = input({ verificationGates: [{ id: 'runtime', mandatory: true, applicable: true, ...gateBase }] })
  const missingResult = (await run(missing)).result
  assert.equal(missingResult.auditVerdict, 'CLEAR')
  assert.equal(missingResult.terminalRecommendation, 'BLOCKED')

  const key = 'gate-key'
  const failed = receipt('gate-final-fail', key, {
    kind: 'command', outcome: 'validated', command: './gradlew compile --rerun-tasks', locator: 'compile', oracle: 'exit zero',
    expected: 'INPUT_ERROR', actual: 'BUG_PRESENT', outputHash: sha256TextForTest('compile-fail'),
    measurement: { runner: 'gradle', executable: './gradlew', commandArgs: ['compile', '--rerun-tasks'], command: './gradlew compile --rerun-tasks', exitCode: 1, outputHash: sha256TextForTest('compile-fail'), observedState: 'BUG_PRESENT', failureSignature: 'compile-error-x' }, exitCode: 1, expectedExitCode: 1,
  })
  const failedGateBase = { ...gateBase, executionIdentity: executionIdentityForTest(failed) }
  const failedArgs = input({
    verificationReceipts: [failed],
    verificationGates: [{ id: 'compile', mandatory: true, applicable: true, finalReceiptId: failed.id, ...failedGateBase }],
  })
  assert.equal((await run(failedArgs)).result.terminalRecommendation, 'FAILED')

  const optionalFailedArgs = input({
    verificationReceipts: [failed],
    verificationGates: [{ id: 'optional-compile', mandatory: false, applicable: true, finalReceiptId: failed.id, ...failedGateBase }],
  })
  assert.equal((await run(optionalFailedArgs)).result.terminalRecommendation, 'VERIFIED_WITH_RESIDUALS')

  const baseline = receipt('gate-baseline-fail', key, {
    kind: 'command', outcome: 'validated', command: './gradlew compile --rerun-tasks', locator: 'compile', oracle: 'exit zero',
    expected: 'INPUT_ERROR', actual: 'BUG_PRESENT', outputHash: sha256TextForTest('baseline-fail'), contentPhase: 'pre',
    currentId: 'baseline-placeholder', contentHash: 'baseline-placeholder', executedAt: preExecutedAt,
    measurement: { runner: 'gradle', executable: './gradlew', commandArgs: ['compile', '--rerun-tasks'], command: './gradlew compile --rerun-tasks', runStartedAt, capturedAt: preExecutedAt, exitCode: 1, outputHash: sha256TextForTest('baseline-fail'), observedState: 'BUG_PRESENT', failureSignature: 'compile-error-x' }, exitCode: 1, expectedExitCode: 1,
  })
  const residualArgs = input({
    verificationReceipts: [baseline, failed],
    verificationGates: [{ id: 'compile', mandatory: true, applicable: true, baselineReceiptId: baseline.id, finalReceiptId: failed.id, ...failedGateBase }],
  })
  const residualResult = (await run(residualArgs)).result
  assert.equal(residualResult.terminalRecommendation, 'VERIFIED_WITH_RESIDUALS', JSON.stringify({ errors: residualResult.errors, gates: residualResult.gateResults }))
})

test('Gradle and connected-test execution rules are machine checked', async () => {
  const noRerun = receipt('no-rerun', 'unused', { measurement: { commandArgs: [':feature:reader:testDebugUnitTest'] } })
  const noRerunResult = (await run(input({ verificationReceipts: [noRerun] }))).result
  assert.equal(noRerunResult.verdict, 'INCOMPLETE')
  assert.match(noRerunResult.errors.join('\n'), /requires --rerun-tasks/)

  const connected = receipt('connected-tests-flag', 'unused', {
    measurement: { task: ':app:connectedDebugAndroidTest', commandArgs: [':app:connectedDebugAndroidTest', '--rerun-tasks', '--tests', 'ExampleTest'] },
  })
  const connectedResult = (await run(input({ verificationReceipts: [connected] }))).result
  assert.equal(connectedResult.verdict, 'INCOMPLETE')
  assert.match(connectedResult.errors.join('\n'), /connected Android test cannot use --tests/)
})

test('SHA-256 uses a known-answer vector and artifact mutation is rejected', async () => {
  const args = input()
  args.artifacts.push({
    id: 'nist-abc', mediaType: 'text/plain', encoding: 'base64', payload: 'YWJj', byteLength: 3,
    sha256: 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  })
  assert.equal((await run(args)).result.auditVerdict, 'CLEAR')

  const mutated = input()
  mutated.artifacts[0].payload = Buffer.from('mutated patch').toString('base64')
  mutated.artifacts[0].byteLength = Buffer.byteLength('mutated patch')
  const result = (await run(mutated)).result
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /SHA-256 mismatch/)
})

test('audit CLEAR never self-promotes to terminal CLEAN without host attestation', async () => {
  const args = input()
  const { result } = await run(args)
  assert.equal(result.auditVerdict, 'CLEAR')
  assert.equal(result.verificationVerdict, 'ASSERTED_ONLY')
  assert.equal(result.terminalRecommendation, 'AUDIT_CLEAR_NEEDS_EXTERNAL_GATES')
  assert.equal(result.runId, args.runId)
  assert.equal(result.runNonce, args.runNonce)
  assert.equal(result.currentId, args.scopeManifest.currentId)
  assert.equal(result.contentHash, args.scopeManifest.contentHash)
  assert.notEqual(result.terminalRecommendation, 'CLEAN')
})

test('a fake all-green result cannot serve as validated RED evidence', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const fakeRed = receipt('fake-red', key, {
    outcome: 'validated', contentPhase: 'pre', executedAt: preExecutedAt, reportMtime: preExecutedAt,
    exitCode: 0, expectedExitCode: 0, passedCount: 1, failedCount: 0, observedState: 'BUG_PRESENT',
  })
  const args = input({
    verificationReceipts: [fakeRed],
    regressionProofs: [{ id: 'fake-proof', acceptanceId: 'acceptance-1', preReceiptId: fakeRed.id, postReceiptId: 'base-green' }],
  })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /validated RED requires nonzero exit and failed\/error count/)
})

test('receipt cannot replace the acceptance-owned oracle with a tautology', async () => {
  const args = input()
  const green = args.verificationReceipts.find((item) => item.id === 'base-green')
  green.machineOracle = { metric: 'exitCode', op: 'eq', value: 0 }
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /must exactly match acceptance oracle/)
})

test('machine oracle metric traversal rejects inherited prototype properties', async () => {
  const args = input()
  const inheritedOracle = { metric: 'constructor.name', op: 'eq', value: 'Object' }
  args.acceptance[0].machineOracle = inheritedOracle
  for (const item of args.verificationReceipts.filter((receiptItem) => ['test', 'runtime', 'command'].includes(receiptItem.kind))) {
    item.machineOracle = inheritedOracle
  }
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.notEqual(result.auditVerdict, 'CLEAR')
})

test('rejection receipt for another acceptance cannot suppress a current finding', async () => {
  const finding = candidate()
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const wrongAcceptance = receipt('wrong-acceptance-rejection', key, {
    outcome: 'disproved', acceptanceId: 'acceptance-2', scenarioFingerprint: 'scenario-other-v1',
    evidenceFingerprint: evidenceFingerprintFor(finding.evidence),
    findingFingerprint: findingFingerprintFor({ ...finding, acceptanceId: 'acceptance-2', scenarioFingerprint: 'scenario-other-v1' }),
  })
  const args = input({
    acceptance: [
      { id: 'acceptance-1', defect: 'Reader empty input bug', statement: 'Empty input returns INPUT_ERROR', scenarioFingerprint: 'scenario-empty-v1', machineOracle: acceptanceOracle, mandatory: true, blastRadiusAnchors: ['example.Reader.open'], oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'] },
      { id: 'acceptance-2', defect: 'Other branch', statement: 'Other branch returns INPUT_ERROR', scenarioFingerprint: 'scenario-other-v1', machineOracle: acceptanceOracle, mandatory: false, blastRadiusAnchors: ['example.Reader.other'], oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'] },
    ],
    ledger: { entries: [{ key, status: 'rejected', receiptId: wrongAcceptance.id, rationale: 'Different scenario was disproved' }] },
    verificationReceipts: [wrongAcceptance],
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [finding] } })
  assert.equal(result.verdict, 'CONVERGING')
  assert.equal(result.counts.active, 1)
})

test('blocked ledger state is representable without a fabricated receipt', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|environment.device|example.reader.open|api-legacy'
  const args = input({ ledger: { entries: [{ key, status: 'blocked', reason: 'No compatible device is attached', followUp: 'Run on API 23 device' }] } })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.equal(result.reason, 'BLOCKED_FINDINGS_REMAIN')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
})

test('mandatory gate marked not applicable blocks instead of silently becoming N/A', async () => {
  const gate = { id: 'runtime', mandatory: true, applicable: false, kind: 'runtime', checkKey: 'runtime-key', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1', executionIdentity: sha256TextForTest('runtime-spec') }
  const { result } = await run(input({ verificationGates: [gate] }))
  assert.equal(result.auditVerdict, 'CLEAR')
  assert.equal(result.gateResults[0].status, 'BLOCKED')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
})

test('gate receipt must match kind, key, acceptance, and scenario', async () => {
  const finalReceipt = receipt('gate-wrong-kind', 'gate-key')
  const gate = { id: 'runtime', mandatory: true, applicable: true, kind: 'runtime', checkKey: 'gate-key', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1', executionIdentity: executionIdentityForTest(finalReceipt), finalReceiptId: finalReceipt.id }
  const { result } = await run(input({ verificationReceipts: [finalReceipt], verificationGates: [gate] }))
  assert.equal(result.gateResults[0].status, 'BLOCKED')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
})

test('Gradle detection cannot be bypassed by spoofing runner or using --tests=value', async () => {
  const spoofed = receipt('spoofed-gradle', 'unused', {
    command: './gradlew :reader:test', measurement: { runner: 'shell', commandArgs: [':reader:test'] },
  })
  assert.equal((await run(input({ verificationReceipts: [spoofed] }))).result.verdict, 'INCOMPLETE')

  const connected = receipt('connected-equals-filter', 'unused', {
    command: './gradlew :app:connectedDebugAndroidTest --rerun-tasks --tests=ExampleTest',
    measurement: { task: ':app:connectedDebugAndroidTest', commandArgs: [':app:connectedDebugAndroidTest', '--rerun-tasks', '--tests=ExampleTest'] },
  })
  const result = (await run(input({ verificationReceipts: [connected] }))).result
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /connected Android test cannot use --tests/)
})

test('direct object args and lens output are bounded', async () => {
  const oversizedArgs = input()
  oversizedArgs.padding = 'x'.repeat(1024 * 1024)
  const direct = await run(oversizedArgs)
  assert.equal(direct.result.reason, 'INVALID_ARGS')

  const hugeFinding = candidate({ detail: 'x'.repeat(300 * 1024) })
  const lens = await run(input(), { findingsByLens: { integration: [hugeFinding] } })
  assert.equal(lens.result.verdict, 'INCOMPLETE')
  assert.ok(lens.result.lensStatuses.some((status) => status.lens === 'integration' && status.status === 'incomplete'))
})

test('diff accounting treats source lines beginning with ++ or -- as hunk content', async () => {
  const path = 'feature/reader/src/main/java/example/Reader.kt'
  const patchText = `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n---old\n+++new\n`
  const args = input({ changes: [change({ added: 1, deleted: 1, patchText })] })
  const { result } = await run(args)
  assert.equal(result.verdict, 'CLEAR')
  assert.equal(result.diffLines, 2)
})

test('pre-phase or reviewed receipts cannot satisfy a final verification gate', async () => {
  const gateBase = { id: 'final-gate', mandatory: true, applicable: true, kind: 'test', checkKey: 'gate-key', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1' }
  const prePass = receipt('pre-pass-gate', 'gate-key', {
    contentPhase: 'pre', executedAt: preExecutedAt, runStartedAt, reportMtime: preExecutedAt,
  })
  const preResult = (await run(input({ verificationReceipts: [prePass], verificationGates: [{ ...gateBase, executionIdentity: executionIdentityForTest(prePass), finalReceiptId: prePass.id }] }))).result
  assert.equal(preResult.gateResults[0].status, 'BLOCKED')

  const reviewed = receipt('reviewed-final-gate', 'gate-key', { outcome: 'reviewed' })
  const reviewedResult = (await run(input({ verificationReceipts: [reviewed], verificationGates: [{ ...gateBase, executionIdentity: executionIdentityForTest(reviewed), finalReceiptId: reviewed.id }] }))).result
  assert.equal(reviewedResult.gateResults[0].status, 'FAIL')
  assert.equal(reviewedResult.terminalRecommendation, 'FAILED')
})

test('rejected finding and RED waiver still require postimage provenance', async () => {
  const finding = candidate()
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const preRejection = receipt('pre-rejection', key, {
    outcome: 'disproved', contentPhase: 'pre', executedAt: preExecutedAt, runStartedAt, reportMtime: preExecutedAt,
    evidenceFingerprint: evidenceFingerprintFor(finding.evidence),
  })
  const rejectedArgs = input({
    ledger: { entries: [{ key, status: 'rejected', receiptId: preRejection.id, rationale: 'Old content only' }] },
    verificationReceipts: [preRejection],
  })
  const rejected = await run(rejectedArgs, { findingsByLens: { business_logic: [finding] } })
  assert.equal(rejected.result.verdict, 'INCOMPLETE')
  assert.match(rejected.result.errors.join('\n'), /requires post-fix content receipt/)

  const prePass = receipt('pre-pass-for-waiver', key, {
    contentPhase: 'pre', executedAt: preExecutedAt, runStartedAt, reportMtime: preExecutedAt,
  })
  const waiverArgs = input({
    verificationReceipts: [prePass],
    regressionProofs: [{ id: 'waiver-with-pre-post', acceptanceId: 'acceptance-1', postReceiptId: prePass.id, waiver: { boundary: 'No safe RED', attemptedLayers: ['unit'], residual: true } }],
  })
  const waived = (await run(waiverArgs)).result
  assert.equal(waived.verdict, 'INCOMPLETE')
  assert.match(waived.errors.join('\n'), /requires post-fix receipt/)
})

test('post receipt cannot wrap a pre-edit XML report', async () => {
  const stale = receipt('post-with-old-report', 'unused', { runStartedAt, reportMtime: preExecutedAt })
  const { result } = await run(input({ verificationReceipts: [stale] }))
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /post evidence must start after last edit finishes/)
})

test('command RED and GREEN must use the same execution identity', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const commandFields = {
    kind: 'command', locator: 'Reader probe', oracle: 'returns INPUT_ERROR', expected: 'INPUT_ERROR', outputHash: sha256TextForTest('probe'),
  }
  const pre = receipt('command-pre', key, {
    ...commandFields, outcome: 'validated', contentPhase: 'pre', executedAt: preExecutedAt,
    command: './probe --empty', exitCode: 1, expectedExitCode: 1, actual: 'BUG_PRESENT',
    measurement: { runner: 'shell', command: './probe --empty', runStartedAt, capturedAt: preExecutedAt, observedState: 'BUG_PRESENT', exitCode: 1, failureSignature: 'wrong branch' },
  })
  const post = receipt('command-post-other', key, {
    ...commandFields, outcome: 'pass', command: './probe --different', actual: 'INPUT_ERROR',
    measurement: { runner: 'shell', command: './probe --different', runStartedAt: postRunStartedAt, capturedAt: executedAt, observedState: 'INPUT_ERROR', exitCode: 0 },
  })
  const args = input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: post.id }] },
    verificationReceipts: [pre, post],
    regressionProofs: [{ id: 'command-identity-proof', acceptanceId: 'acceptance-1', preReceiptId: pre.id, postReceiptId: post.id }],
  })
  const { result } = await run(args)
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /execution identity mismatch/)
})

test('finding identity collision across acceptance contracts is incomplete', async () => {
  const secondAcceptance = { id: 'acceptance-2', defect: 'Alternate defect', statement: 'Alternate state is visible', scenarioFingerprint: 'scenario-second-v1', machineOracle: acceptanceOracle, mandatory: false, blastRadiusAnchors: ['example.Reader.open'], oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'] }
  const args = input({ acceptance: [
    { id: 'acceptance-1', defect: 'Reader empty input bug', statement: 'Empty input returns INPUT_ERROR', scenarioFingerprint: 'scenario-empty-v1', machineOracle: acceptanceOracle, mandatory: true, blastRadiusAnchors: ['example.Reader.open'], oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'] },
    secondAcceptance,
  ] })
  const collision = candidate({ acceptanceId: secondAcceptance.id, scenarioFingerprint: secondAcceptance.scenarioFingerprint })
  const { result } = await run(args, { findingsByLens: { business_logic: [candidate()], integration: [collision] } })
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.invalidFindings.flatMap((item) => item.errors).join('\n'), /collides across acceptance/)
})

test('patch path and control-character paths are rejected fail-closed', async () => {
  const path = 'feature/reader/src/main/java/example/Reader.kt'
  const wrongPathPatch = `--- a/other/Other.kt\n+++ b/other/Other.kt\n@@ -1 +1 @@\n-old\n+new\n`
  const wrong = await run(input({ changes: [change({ added: 1, deleted: 1, patchText: wrongPathPatch })] }))
  assert.equal(wrong.result.verdict, 'INCOMPLETE')
  assert.match(wrong.result.errors.join('\n'), /patch header does not match change path/)

  const injected = await run(input({ changes: [change({ path: `${path}\nnew file mode 100755` })] }))
  assert.equal(injected.result.verdict, 'INCOMPLETE')
  assert.match(injected.result.errors.join('\n'), /canonical repo-relative path/)

  for (const invalidPath of ['feature/reader b/Other.kt', 'feature/Cafe\u0301.kt', 'feature/Bad"Name.kt']) {
    const invalid = await run(input({ changes: [change({ path: invalidPath })] }))
    assert.equal(invalid.result.verdict, 'INCOMPLETE')
    assert.match(invalid.result.errors.join('\n'), /canonical repo-relative path/)
  }
})

test('pre evidence must be from this session and post evidence must follow the last edit', async () => {
  const staleTime = new Date(Date.parse(runStartedAt) - 10_000).toISOString()
  const stalePre = receipt('stale-session-pre', 'unused', {
    outcome: 'validated', contentPhase: 'pre', executedAt: preExecutedAt,
    runStartedAt: staleTime, reportMtime: staleTime,
  })
  const staleResult = (await run(input({ verificationReceipts: [stalePre] }))).result
  assert.equal(staleResult.verdict, 'INCOMPLETE')
  assert.match(staleResult.errors.join('\n'), /captured in the current session/)

  const duringEdit = receipt('during-edit-post', 'unused', {
    runStartedAt: new Date(Date.parse(firstEditStartedAt) + 1).toISOString(),
    reportMtime: new Date(Date.parse(lastEditFinishedAt) - 1).toISOString(),
  })
  const duringResult = (await run(input({ verificationReceipts: [duringEdit] }))).result
  assert.equal(duringResult.verdict, 'INCOMPLETE')
  assert.match(duringResult.errors.join('\n'), /after last edit finishes/)
})

test('gate PASS requires the intended execution identity', async () => {
  const finalReceipt = receipt('wrong-gate-command', 'gate-key')
  const gate = {
    id: 'targeted-test', mandatory: true, applicable: true, kind: 'test', checkKey: 'gate-key',
    acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1',
    executionIdentity: sha256TextForTest('different intended test'), finalReceiptId: finalReceipt.id,
  }
  const { result } = await run(input({ verificationReceipts: [finalReceipt], verificationGates: [gate] }))
  assert.equal(result.gateResults[0].status, 'BLOCKED')
  assert.equal(result.terminalRecommendation, 'BLOCKED')
})

test('runtime RED and GREEN allow different build artifacts while binding stable environment and source phase', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const runtimeFields = {
    kind: 'runtime', command: undefined, exitCode: undefined, expectedExitCode: undefined,
    deviceId: 'pixel-8-api-35', variant: 'debug', oracle: 'empty document returns INPUT_ERROR',
    trigger: 'launch empty.docx', evidenceRef: 'artifacts/runtime.json', evidenceHash: sha256TextForTest('runtime-evidence'),
    crashCount: 0, anrCount: 0, appErrorCount: 0,
  }
  const pre = receipt('runtime-pre-build', key, {
    ...runtimeFields, outcome: 'validated', contentPhase: 'pre', executedAt: preExecutedAt,
    runStartedAt, capturedAt: preExecutedAt, actual: 'BUG_PRESENT',
    measurement: {
      runner: 'adb', deviceId: runtimeFields.deviceId, variant: runtimeFields.variant, trigger: runtimeFields.trigger,
      actual: 'BUG_PRESENT', observedState: 'BUG_PRESENT', crashCount: 0, anrCount: 0, appErrorCount: 0,
      packageName: 'com.exampleapp', buildId: 'pre-build', captureFilter: 'App:*', fixtureHash: sha256TextForTest('fixture'),
      appArtifactSha256: sha256TextForTest('pre-apk'), failureSignature: 'wrong branch',
    },
  })
  const post = receipt('runtime-post-build', key, {
    ...runtimeFields, outcome: 'pass', runStartedAt: postRunStartedAt, capturedAt: executedAt, actual: 'INPUT_ERROR',
    measurement: {
      runner: 'adb', deviceId: runtimeFields.deviceId, variant: runtimeFields.variant, trigger: runtimeFields.trigger,
      actual: 'INPUT_ERROR', observedState: 'INPUT_ERROR', crashCount: 0, anrCount: 0, appErrorCount: 0,
      packageName: 'com.exampleapp', buildId: 'post-build', captureFilter: 'App:*', fixtureHash: sha256TextForTest('fixture'),
      appArtifactSha256: sha256TextForTest('post-apk'),
    },
  })
  const args = input({
    ledger: { entries: [{ key, status: 'fixed', receiptId: post.id }] },
    verificationReceipts: [pre, post],
    regressionProofs: [{ id: 'runtime-build-proof', acceptanceId: 'acceptance-1', preReceiptId: pre.id, postReceiptId: post.id }],
  })
  const { result } = await run(args)
  assert.equal(result.verdict, 'CLEAR')
})

test('fresh receipt labels cannot hide stale test or runtime measurement timestamps', async () => {
  const staleTest = receipt('stale-inner-test', 'unused', {
    measurement: { runStartedAt, reportMtime: preExecutedAt, command: './gradlew staleTest --rerun-tasks' },
  })
  const testResult = (await run(input({ verificationReceipts: [staleTest] }))).result
  assert.equal(testResult.verdict, 'INCOMPLETE')
  assert.match(testResult.errors.join('\n'), /must be derived from measurement artifact/)

  const runtime = receipt('stale-inner-runtime', 'unused', {
    kind: 'runtime', command: undefined, exitCode: undefined, expectedExitCode: undefined,
    deviceId: 'pixel-8-api-35', variant: 'debug', oracle: 'document opens', trigger: 'launch fixture', actual: 'INPUT_ERROR',
    runStartedAt: postRunStartedAt, capturedAt: executedAt, evidenceRef: 'artifacts/runtime.json', evidenceHash: sha256TextForTest('runtime-stale'),
    crashCount: 0, anrCount: 0, appErrorCount: 0,
    measurement: {
      runner: 'adb', deviceId: 'pixel-8-api-35', variant: 'debug', trigger: 'launch fixture', actual: 'INPUT_ERROR', observedState: 'INPUT_ERROR',
      crashCount: 0, anrCount: 0, appErrorCount: 0, runStartedAt, capturedAt: preExecutedAt,
      packageName: 'com.exampleapp', buildId: 'post-build', captureFilter: 'App:*', fixtureHash: sha256TextForTest('fixture'),
      appArtifactSha256: sha256TextForTest('post-apk'), evidenceHash: sha256TextForTest('runtime-stale'),
    },
  })
  const runtimeResult = (await run(input({ verificationReceipts: [runtime] }))).result
  assert.equal(runtimeResult.verdict, 'INCOMPLETE')
  assert.match(runtimeResult.errors.join('\n'), /must be derived from measurement artifact/)
})

test('receipt labels cannot override measured test exit code or command output hash', async () => {
  const relabeledExit = receipt('relabeled-test-exit', 'unused', { measurement: { exitCode: 1 } })
  const exitResult = (await run(input({ verificationReceipts: [relabeledExit] }))).result
  assert.equal(exitResult.verdict, 'INCOMPLETE')
  assert.match(exitResult.errors.join('\n'), /exitCode must be derived from measurement artifact/)

  const relabeledHash = receipt('relabeled-command-hash', 'unused', {
    kind: 'command', locator: 'Reader probe', oracle: 'returns INPUT_ERROR', expected: 'INPUT_ERROR', actual: 'INPUT_ERROR',
    outputHash: sha256TextForTest('receipt-output'),
    measurement: { outputHash: sha256TextForTest('different-measured-output') },
  })
  const hashResult = (await run(input({ verificationReceipts: [relabeledHash] }))).result
  assert.equal(hashResult.verdict, 'INCOMPLETE')
  assert.match(hashResult.errors.join('\n'), /outputHash must be derived from measurement artifact/)
})

test('hidden second-file patch cannot pass exact single-file binding', async () => {
  const path = 'feature/reader/src/main/java/example/Reader.kt'
  const other = 'feature/reader/src/main/java/example/Other.kt'
  const patchText = `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n--- a/${other}\n+++ b/${other}\n@@ -1 +1 @@\n-old-other\n+new-other\n`
  const { result } = await run(input({ changes: [change({ added: 2, deleted: 2, patchText })] }))
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /patch must describe exactly one file/)

  const metadataSmuggling = `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n--- a/${other}\n+++ b/${other}\nindex 1111111..2222222 100644\n@@ -1 +1 @@\n-old-other\n+new-other\n`
  const invalidHunks = await run(input({ changes: [change({ added: 3, deleted: 3, patchText: metadataSmuggling })] }))
  assert.equal(invalidHunks.result.verdict, 'INCOMPLETE')
  assert.match(invalidHunks.result.errors.join('\n'), /exactly one file|hunk counts|non-hunk metadata/)
})

test('binary artifact must use a canonical manifest bound to exact raw octets', async () => {
  const binary = change({
    path: 'feature/reader/src/main/res/raw/fixture.bin', kind: 'binary', added: 0, deleted: 0,
    patchText: 'x', manualReviewReceiptId: 'missing-review', approvalDigest: sha256TextForTest('approval'),
  })
  const { result } = await run(input({ changes: [binary] }))
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /exact canonical binary evidence manifest/)

  const path = 'feature/reader/src/main/res/raw/fixture.bin'
  const approvalDigest = sha256TextForTest('binary-approval')
  const corruptPatch = `diff --git a/${path} b/${path}\nindex 1111111..2222222 100644\nGIT binary patch\nliteral 1\nIc${'A'.repeat(8)}\n`
  const corrupt = await run(input({ changes: [change({
    path, kind: 'binary', added: 0, deleted: 0, patchText: corruptPatch,
    manualReviewReceiptId: 'missing-review', approvalDigest,
  })] }))
  assert.equal(corrupt.result.verdict, 'INCOMPLETE')
  assert.match(corrupt.result.errors.join('\n'), /exact canonical binary evidence manifest/)

  const boundChange = change({
    path, kind: 'binary', added: 0, deleted: 0,
    manualReviewReceiptId: 'binary-review', approvalDigest, binaryBytes: Buffer.from([1]),
  })
  const boundArgs = input({ changes: [boundChange] })
  boundArgs.verificationReceipts.push({
    id: 'binary-review', key: 'scope:change-1', scopeFingerprint: boundArgs.scopeManifest.scopeFingerprint,
    currentId: boundArgs.scopeManifest.currentId, contentHash: boundArgs.scopeManifest.contentHash,
    status: 'verified', source: 'artifact-driver', kind: 'manual-review', outcome: 'reviewed',
    contentPhase: 'post', executedAt, evidenceRef: 'manual binary postimage review', approvalDigest,
    runId, runNonce,
  })
  assert.equal((await run(boundArgs)).result.verdict, 'CLEAR')

  const missingCoverage = await run(boundArgs, { omitBinaryCoverage: true, omitBinaryBaselineCoverage: true })
  assert.equal(missingCoverage.result.verdict, 'INCOMPLETE')
  assert.match(missingCoverage.result.lensStatuses.map((item) => item.error).join('\n'), /binary SHA mismatch|binary baseline SHA mismatch/)

  const wrongMedia = input({ changes: [boundChange] })
  wrongMedia.artifacts.find((artifact) => artifact.id === wrongMedia.scopeManifest.changes[0].binaryArtifactId).mediaType = 'text/plain'
  const wrongMediaResult = (await run(wrongMedia)).result
  assert.equal(wrongMediaResult.verdict, 'INCOMPLETE')
  assert.match(wrongMediaResult.errors.join('\n'), /exact application\/octet-stream pre\/postimage artifact/)
})

test('fake rename without distinct previousPath and rename metadata fails closed', async () => {
  const { result } = await run(input({ changes: [change({ status: 'renamed', added: 0, deleted: 0 })] }))
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /distinct canonical previousPath|rename from\/to pair/)
})

test('audit state continuity rejects missing state, tampering, and dropped prior ledger keys', async () => {
  const missing = input({ sweepIndex: 1, classHistory: [[]], budgetHistory: [1], priorAuditState: null })
  assert.match((await run(missing)).result.errors.join('\n'), /priorAuditState is required/)

  const tampered = input({ sweepIndex: 1, classHistory: [[]], budgetHistory: [1] })
  tampered.priorAuditState.nextBudgetHistory = [2]
  assert.match((await run(tampered)).result.errors.join('\n'), /digest mismatch/)

  const dropped = input({ sweepIndex: 1, classHistory: [[]], budgetHistory: [1], ledger: { entries: [] } })
  dropped.priorAuditState.nextLedger = { entries: [{ key: 'prior|rule|subject|scenario', status: 'open' }] }
  const { digest: _oldDigest, ...statePayload } = dropped.priorAuditState
  dropped.priorAuditState.digest = stableHashForTest(statePayload)
  const droppedResult = (await run(dropped)).result
  assert.equal(droppedResult.verdict, 'INCOMPLETE')
  assert.match(droppedResult.errors.join('\n'), /continuity lost prior key/)

  const reset = input()
  reset.scopeManifest.priorAuditStateDigest = sha256TextForTest('recorded-state')
  reset.verificationReceipts[0].priorAuditStateDigest = reset.scopeManifest.priorAuditStateDigest
  const resetResult = (await run(reset)).result
  assert.equal(resetResult.verdict, 'INCOMPLETE')
  assert.match(resetResult.errors.join('\n'), /sweepIndex=0 requires a driver manifest with no recorded prior audit state/)
})

test('rejection must bind the exact finding fingerprint, not only copied evidence', async () => {
  const finding = candidate()
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const unrelated = candidate({ ruleId: 'logic.other_rule' })
  const rejected = receipt('wrong-finding-rejection', key, {
    outcome: 'disproved', evidenceFingerprint: evidenceFingerprintFor(finding.evidence),
    findingFingerprint: findingFingerprintFor(unrelated),
  })
  const args = input({
    ledger: { entries: [{ key, status: 'rejected', receiptId: rejected.id, rationale: 'Unrelated probe passed' }] },
    verificationReceipts: [rejected],
  })
  const { result } = await run(args, { findingsByLens: { business_logic: [finding] } })
  assert.equal(result.verdict, 'CONVERGING')
  assert.equal(result.counts.active, 1)
})

test('structured argv rejects Gradle hidden behind shell indirection', async () => {
  const shell = receipt('shell-gradle-bypass', 'unused', {
    command: "sh -c ./gradlew :reader:test --rerun-tasks",
    measurement: {
      runner: 'shell', executable: 'sh', commandArgs: ['-c', './gradlew :reader:test --rerun-tasks'],
      command: "sh -c ./gradlew :reader:test --rerun-tasks",
    },
  })
  const { result } = await run(input({ verificationReceipts: [shell] }))
  assert.equal(result.verdict, 'INCOMPLETE')
  assert.match(result.errors.join('\n'), /runner=gradle with gradlew as the direct executable/)

  for (const executable of ['/bin/dash', '/usr/bin/fish']) {
    const indirect = receipt(`shell-${executable.split('/').at(-1)}`, 'unused', {
      command: `${executable} -c g=./gradlew; "$g" :reader:test`,
      measurement: {
        runner: 'shell', executable, commandArgs: ['-c', 'g=./gradlew; "$g" :reader:test'],
        command: `${executable} -c g=./gradlew; "$g" :reader:test`,
      },
    })
    const indirectResult = (await run(input({ verificationReceipts: [indirect] }))).result
    assert.equal(indirectResult.verdict, 'INCOMPLETE')
    assert.match(indirectResult.errors.join('\n'), /runner=gradle with gradlew as the direct executable/)
  }

  const wrappedCommand = validCommandReceipt('command-shell-gradle', 'command-shell-gate', {
    command: '/bin/dash -c g=./gradlew; "$g" :reader:test',
    measurement: {
      runner: 'shell', executable: '/bin/dash', commandArgs: ['-c', 'g=./gradlew; "$g" :reader:test'],
      command: '/bin/dash -c g=./gradlew; "$g" :reader:test',
    },
  })
  const commandGate = {
    id: 'command-shell', mandatory: true, applicable: true, kind: 'command', checkKey: 'command-shell-gate',
    acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1',
    executionIdentity: executionIdentityForTest(wrappedCommand), finalReceiptId: wrappedCommand.id,
  }
  const commandResult = (await run(input({ verificationReceipts: [wrappedCommand], verificationGates: [commandGate] }))).result
  assert.equal(commandResult.verdict, 'INCOMPLETE')
  assert.match(commandResult.errors.join('\n'), /direct non-shell runner/)
})

test('mode-only patches require exact paired metadata and identical content hashes', async () => {
  const path = 'feature/reader/src/main/java/example/Reader.kt'
  for (const patchText of [
    `diff --git a/${path} b/${path}\nold mode 100644\n`,
    `diff --git a/${path} b/${path}\nnew mode 100755\n`,
  ]) {
    const result = (await run(input({ changes: [change({
      added: 0, deleted: 0, patchText, preimageMode: 0o644, postimageMode: 0o755,
      postimageSha256: sha256TextForTest('before'),
    })] }))).result
    assert.equal(result.verdict, 'INCOMPLETE')
    assert.match(result.errors.join('\n'), /exact paired old\/new mode metadata/)
  }

  const contentChanged = (await run(input({ changes: [change({
    added: 0, deleted: 0,
    patchText: `diff --git a/${path} b/${path}\nold mode 100644\nnew mode 100755\n`,
    preimageMode: 0o644, postimageMode: 0o755,
  })] }))).result
  assert.equal(contentChanged.verdict, 'INCOMPLETE')
  assert.match(contentChanged.errors.join('\n'), /identical content hashes/)
})

test('change status is bound to absent/present image and content-delta semantics', async () => {
  const path = 'feature/reader/src/main/java/example/Reader.kt'
  const sameHash = sha256TextForTest('same-content')
  const modified = (await run(input({ changes: [change({ preimageSha256: sameHash, postimageSha256: sameHash })] }))).result
  assert.equal(modified.verdict, 'INCOMPLETE')
  assert.match(modified.errors.join('\n'), /content patch requires different pre\/post content hashes/)

  const addedPatch = `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1 @@\n+new\n`
  const added = (await run(input({ changes: [change({ status: 'added', added: 1, deleted: 0, patchText: addedPatch })] }))).result
  assert.equal(added.verdict, 'INCOMPLETE')
  assert.match(added.errors.join('\n'), /added status requires absent preimage/)

  const deletedPatch = `diff --git a/${path} b/${path}\ndeleted file mode 100644\n--- a/${path}\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n`
  const deleted = (await run(input({ changes: [change({ status: 'deleted', added: 0, deleted: 1, patchText: deletedPatch })] }))).result
  assert.equal(deleted.verdict, 'INCOMPLETE')
  assert.match(deleted.errors.join('\n'), /deleted status requires present preimage and absent postimage/)
})

test('high-severity deferred findings escalate and open/deferred receipts require post phase', async () => {
  const key = 'feature/reader/src/main/java/example/reader.kt|logic.wrong_branch|example.reader.open|empty-input'
  const deferredReceipt = receipt('deferred-p1', key, { outcome: 'validated' })
  const escalated = await run(input({
    ledger: { entries: [{ key, status: 'deferred', severity: 'P1', receiptId: deferredReceipt.id, reason: 'Needs approval', followUp: 'Escalate owner' }] },
    verificationReceipts: [deferredReceipt],
  }))
  assert.equal(escalated.result.verdict, 'ESCALATE')
  assert.equal(escalated.result.reason, 'HIGH_SEVERITY_DEFERRED_FINDINGS')

  for (const status of ['open', 'deferred']) {
    const pre = receipt(`pre-${status}`, key, {
      outcome: 'validated', contentPhase: 'pre', executedAt: preExecutedAt, runStartedAt, reportMtime: preExecutedAt,
    })
    const entry = status === 'deferred'
      ? { key, status, severity: 'P2', receiptId: pre.id, reason: 'Later', followUp: 'Recheck' }
      : { key, status, receiptId: pre.id }
    const result = (await run(input({ ledger: { entries: [entry] }, verificationReceipts: [pre] }))).result
    assert.equal(result.verdict, 'INCOMPLETE')
    assert.match(result.errors.join('\n'), new RegExp(`${status} ledger entry .* requires post-fix`))
  }
})

test('mandatory FAIL takes precedence over a simultaneous BLOCKED gate', async () => {
  const failed = validCommandReceipt('mixed-fail', 'failed-check', {
    outcome: 'validated', actual: 'BUG_PRESENT', exitCode: 1, expectedExitCode: 1,
    measurement: { observedState: 'BUG_PRESENT', exitCode: 1, failureSignature: 'probe failed' },
  })
  const gates = [
    { id: 'failed', mandatory: true, applicable: true, kind: 'command', checkKey: 'failed-check', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1', executionIdentity: executionIdentityForTest(failed), finalReceiptId: failed.id },
    { id: 'missing', mandatory: true, applicable: true, kind: 'test', checkKey: 'missing-check', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1', executionIdentity: sha256TextForTest('missing') },
  ]
  const { result } = await run(input({ verificationReceipts: [failed], verificationGates: gates }))
  assert.equal(result.terminalRecommendation, 'FAILED')
  assert.equal(result.verificationVerdict, 'FAILED')
})

test('optional N/A gate requires and returns explicit reason and evidence', async () => {
  const base = { id: 'optional-runtime', mandatory: false, applicable: false, kind: 'runtime', checkKey: 'runtime-na', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1', executionIdentity: sha256TextForTest('runtime-na') }
  const missing = (await run(input({ verificationGates: [base] }))).result
  assert.equal(missing.verdict, 'INCOMPLETE')
  assert.match(missing.errors.join('\n'), /requires reason and evidence/)

  const complete = (await run(input({ verificationGates: [{ ...base, notApplicableReason: 'No runtime surface changed', notApplicableEvidence: 'scope: Kotlin pure function only' }] }))).result
  assert.equal(complete.gateResults[0].status, 'N/A')
  assert.equal(complete.gateResults[0].reason, 'No runtime surface changed')
  assert.equal(complete.gateResults[0].evidence, 'scope: Kotlin pure function only')
})

test('acceptance anchors, duplicate gates/checks, and klass normalization are fail closed', async () => {
  const blankAnchor = input({ acceptance: [{ id: 'acceptance-1', defect: 'd', statement: 's', scenarioFingerprint: 'scenario-empty-v1', machineOracle: acceptanceOracle, mandatory: true, blastRadiusAnchors: [' '], oracleSourcePaths: ['feature/reader/src/test/java/example/ReaderTest.kt'] }] })
  assert.match((await run(blankAnchor)).result.errors.join('\n'), /blastRadiusAnchors must be unique/)

  const outsideAnchor = await run(input(), { findingsByLens: { business_logic: [candidate({ subject: 'example.Reader.close' })] } })
  assert.equal(outsideAnchor.result.verdict, 'INCOMPLETE')
  assert.match(outsideAnchor.result.invalidFindings.flatMap((item) => item.errors).join('\n'), /not declared.*blastRadiusAnchors/)

  const gateBase = { mandatory: true, applicable: true, kind: 'test', acceptanceId: 'acceptance-1', scenarioFingerprint: 'scenario-empty-v1', executionIdentity: sha256TextForTest('gate') }
  const duplicateId = input({ verificationGates: [{ ...gateBase, id: 'same', checkKey: 'one' }, { ...gateBase, id: 'same', checkKey: 'two' }] })
  assert.match((await run(duplicateId)).result.errors.join('\n'), /duplicate verification gate id/)
  const duplicateCheck = input({ verificationGates: [{ ...gateBase, id: 'one', checkKey: 'same' }, { ...gateBase, id: 'two', checkKey: 'same' }] })
  assert.match((await run(duplicateCheck)).result.errors.join('\n'), /duplicate verification gate check/)

  const upperFinding = await run(input(), { findingsByLens: { business_logic: [candidate({ klassId: 'Logic.Branch_Contract' })] } })
  assert.match(upperFinding.result.invalidFindings.flatMap((item) => item.errors).join('\n'), /canonical lowercase/)
  const upperHistory = input({ sweepIndex: 1, classHistory: [['Logic.Branch']], budgetHistory: [1] })
  assert.match((await run(upperHistory)).result.errors.join('\n'), /classHistory must contain/)
})
