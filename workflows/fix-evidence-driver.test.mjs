import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, linkSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'

const driver = new URL('./fix-evidence-driver.mjs', import.meta.url).pathname
const workflowUrl = new URL('./multi-lens-audit.js', import.meta.url)
const workflowSource = `${readFileSync(workflowUrl, 'utf8').replace('export const meta =', 'const meta =')}\n//# sourceURL=${workflowUrl.href}?driver-integration\n`
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const executeWorkflow = new AsyncFunction('args', 'process', 'phase', 'parallel', 'agent', 'log', workflowSource)
const temporaryRoots = new Set()

after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true })
})

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
}

function repoFixture() {
  const repo = mkdtempSync(join(tmpdir(), 'fix-evidence-'))
  temporaryRoots.add(repo)
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.email', 'test@example.com')
  git(repo, 'config', 'user.name', 'Test')
  mkdirSync(join(repo, 'src'))
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 1\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'base')
  return repo
}

function run(...args) {
  return spawnSync(process.execPath, [driver, ...args], { encoding: 'utf8' })
}

function runWithEnv(env, ...args) {
  return spawnSync(process.execPath, [driver, ...args], { encoding: 'utf8', env: { ...process.env, ...env } })
}

function sha(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sealedAuditOutput(output, sweepIndex, nextLedger, nextClassHistory, nextBudgetHistory, priorAuditStateDigest = null) {
  const state = {
    sweepIndex, runId: output.runId, runNonce: output.runNonce,
    scopeFingerprint: output.scopeManifest.scopeFingerprint, currentId: output.scopeManifest.currentId,
    nextLedger, nextClassHistory, nextBudgetHistory,
  }
  state.digest = sha(stableStringify(state))
  return {
    schemaVersion: 3, auditVerdict: 'CONVERGING', sweepIndex, scopeFingerprint: state.scopeFingerprint,
    nextLedger, nextClassHistory, nextBudgetHistory, nextAuditState: state, priorAuditStateDigest,
  }
}

function completeEdit(repo, bundlePath, path, contents, mode) {
  const args = ['begin-edit', '--bundle', bundlePath, '--path', path, '--expected-post-sha256', sha(contents)]
  if (mode !== undefined) args.push('--expected-post-mode', mode.toString(8))
  const begin = run(...args)
  assert.equal(begin.status, 0, begin.stderr)
  writeFileSync(join(repo, path), contents)
  if (mode !== undefined) chmodSync(join(repo, path), mode)
  const finish = run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId)
  assert.equal(finish.status, 0, finish.stderr)
}

function jsonArtifact(id, value, mediaType = 'application/json') {
  const bytes = Buffer.from(JSON.stringify(value))
  return { id, mediaType, encoding: 'base64', payload: bytes.toString('base64'), byteLength: bytes.length, sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}` }
}

function testReceipt(id, output, outcome, measurement) {
  const isPre = outcome === 'validated'
  const now = isPre
    ? new Date(Date.parse(output.scopeManifest.firstEditStartedAt) - 1).toISOString()
    : new Date().toISOString()
  const evidenceStartedAt = isPre
    ? output.runStartedAt
    : new Date(Date.parse(output.scopeManifest.lastEditFinishedAt) + 1).toISOString()
  const reportHash = `sha256:${'1'.repeat(64)}`
  const evidenceHash = `sha256:${'2'.repeat(64)}`
  const executable = './gradlew'
  const commandArgs = [':reader:test', '--rerun-tasks']
  const command = [executable, ...commandArgs].join(' ')
  const reportPath = `reports/${id}.xml`
  const sourceStates = [{
    path: 'src/test/ReaderTest.kt',
    sha256: sha('reader-test-harness-v1'),
    mode: 0o644,
    observationToken: sha('reader-test-observation-v1'),
  }]
  const sourceHash = sha(stableStringify(sourceStates))
  const oracleSourceArtifactId = `oracle-source-${id}`
  const scopeStates = output.scopeManifest.changes.map((change) => ({
    path: change.path,
    postimageSha256: isPre ? change.preimageSha256 : change.postimageSha256,
    mode: isPre ? change.preimageMode : change.postimageMode,
    observationToken: sha(`scope-observation:${id}:${change.id}`),
  })).sort((left, right) => left.path.localeCompare(right.path))
  const scopeContentId = sha(stableStringify(
    scopeStates.map(({ path, postimageSha256, mode }) => ({ path, postimageSha256, mode })),
  ))
  output.artifacts.push(jsonArtifact(oracleSourceArtifactId, {
    oracleId: id,
    source: 'artifact-driver',
    startedAt: evidenceStartedAt,
    finishedAt: now,
    sourceStates,
    sourceHash,
    scopeStates,
    scopeContentId,
  }, 'application/vnd.exampleapp.oracle-source+json'))
  Object.assign(measurement, {
    executable, commandArgs, command, runStartedAt: evidenceStartedAt, capturedAt: now,
    reportPath, reportMtime: now, reportHash, evidenceHash,
    oracleSourceHash: sourceHash,
    oracleSourceArtifactId,
  })
  return {
    id, key: `${output.scopeManifest.changes[0].path.toLowerCase()}|logic.wrong_branch|reader.value|value`, scopeFingerprint: output.scopeManifest.scopeFingerprint,
    currentId: scopeContentId,
    contentHash: isPre ? scopeContentId : output.scopeManifest.contentHash,
    status: 'verified', source: 'main-tool-call-unattested', kind: 'test', outcome, contentPhase: isPre ? 'pre' : 'post', executedAt: now,
    runId: output.runId, runNonce: output.runNonce, acceptanceId: 'acceptance-1', scenarioFingerprint: 'reader-value-v1',
    measurementArtifactId: `measurement-${id}`,
    machineOracle: { metric: 'observedState', op: 'eq', value: 'VALUE_2' },
    command, exitCode: measurement.exitCode, expectedExitCode: measurement.exitCode,
    testIdentity: measurement.testIdentity, executedCount: 1, matchedTestCount: 1,
    passedCount: measurement.passedCount, failedCount: measurement.failedCount, errorCount: 0, skippedCount: 0, abortedCount: 0,
    runStartedAt: evidenceStartedAt, reportPath, reportMtime: now,
    reportHash, evidenceHash,
  }
}

test('driver isolates session delta on a pre-dirty file and requires explicit overlap approval', async () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 1\n// user baseline\n')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-overlap-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)

  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n// user baseline\n'))
  assert.equal(begin.status, 0, begin.stderr)
  const { editId } = JSON.parse(begin.stdout)
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 2\n// user baseline\n')
  const finish = run('finish-edit', '--bundle', bundlePath, '--edit-id', editId)
  assert.equal(finish.status, 0, finish.stderr)

  const blocked = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(blocked.status, 3)
  assert.match(blocked.stderr, /Ambiguous pre-existing dirty overlap/)

  const approval = run('approve-overlap', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--reason', 'user-approved same-file merge')
  assert.equal(approval.status, 0, approval.stderr)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  assert.equal(output.schemaVersion, 3)
  assert.equal(output.scopeManifest.changes[0].overlap, 'approved')
  assert.equal(output.scopeManifest.changes[0].manualReviewReceiptId, 'manual-change-0')
  const patchArtifact = output.artifacts[0]
  const bytes = Buffer.from(patchArtifact.payload, 'base64')
  assert.equal(patchArtifact.sha256, `sha256:${createHash('sha256').update(bytes).digest('hex')}`)
  assert.match(bytes.toString('utf8'), /value\(\) = 2/)
  assert.doesNotMatch(bytes.toString('utf8'), /^\+\/\/ user baseline$/m)
  assert.match(bytes.toString('utf8'), /^diff --git a\/src\/Reader\.kt b\/src\/Reader\.kt$/m)
  assert.doesNotMatch(bytes.toString('utf8'), /codex-fix-evidence|\/tmp\//)

  const redMeasurement = {
    runner: 'gradle', task: ':reader:test', commandArgs: [':reader:test', '--rerun-tasks'],
    testIdentity: 'ReaderTest#value', scenarioFingerprint: 'reader-value-v1', observedState: 'BUG_PRESENT',
    executedCount: 1, matchedTestCount: 1, passedCount: 0, failedCount: 1, errorCount: 0, skippedCount: 0, abortedCount: 0,
    failureKind: 'ASSERTION', exitCode: 1,
    failureSignature: 'AssertionError: expected VALUE_2',
  }
  const greenMeasurement = { ...redMeasurement, observedState: 'VALUE_2', passedCount: 1, failedCount: 0, failureKind: 'NONE', exitCode: 0 }
  const red = testReceipt('red', output, 'validated', redMeasurement)
  const green = testReceipt('green', output, 'pass', greenMeasurement)
  const args = {
    ...output,
    artifacts: [...output.artifacts, jsonArtifact('measurement-red', redMeasurement), jsonArtifact('measurement-green', greenMeasurement)],
    acceptance: [{ id: 'acceptance-1', defect: 'Reader returns old value', statement: 'Reader returns value 2', scenarioFingerprint: 'reader-value-v1', machineOracle: { metric: 'observedState', op: 'eq', value: 'VALUE_2' }, mandatory: true, blastRadiusAnchors: ['Reader.value'], oracleSourcePaths: ['src/test/ReaderTest.kt'] }],
    ledger: { entries: [] },
    verificationReceipts: [...output.verificationReceipts, red, green],
    regressionProofs: [{ id: 'proof-1', acceptanceId: 'acceptance-1', preReceiptId: 'red', postReceiptId: 'green' }],
    verificationGates: [], classHistory: [], budgetHistory: [], sweepIndex: 0,
  }
  assert.equal(redMeasurement.oracleSourceArtifactId, 'oracle-source-red')
  const redSourceArtifact = args.artifacts.find((artifact) => artifact.id === redMeasurement.oracleSourceArtifactId)
  assert.equal(redSourceArtifact.mediaType, 'application/vnd.exampleapp.oracle-source+json')
  assert.equal(JSON.parse(Buffer.from(redSourceArtifact.payload, 'base64').toString('utf8')).sourceHash, redMeasurement.oracleSourceHash)
  assert.equal(greenMeasurement.oracleSourceArtifactId, 'oracle-source-green')
  assert.ok(args.artifacts.some((artifact) => artifact.id === greenMeasurement.oracleSourceArtifactId))
  const result = await executeWorkflow(
    args, { env: { CLAUDE_PROJECT_DIR: repo }, cwd: () => repo }, () => {},
    async (tasks) => Promise.all(tasks.map((task) => task())),
    async (_prompt, options) => ({
      status: 'complete',
      coverage: output.scopeManifest.changes.map((change) => ({ changeId: change.id, reviewedPatchSha256: change.patchHash, ...(change.kind === 'binary' ? { reviewedBinarySha256: output.artifacts.find((artifact) => artifact.id === change.binaryArtifactId).sha256 } : {}), ...(change.binaryBaselineArtifactId ? { reviewedBinaryBaselineSha256: output.artifacts.find((artifact) => artifact.id === change.binaryBaselineArtifactId).sha256 } : {}), locators: [`${options.label}:${change.path}`] })),
      findings: [],
    }),
    () => {},
  )
  assert.equal(result.auditVerdict, 'CLEAR', JSON.stringify(result))
  assert.equal(result.terminalRecommendation, 'AUDIT_CLEAR_NEEDS_EXTERNAL_GATES')
  const rawStatePath = join(dirname(bundlePath), 'raw-audit-state.json')
  writeFileSync(rawStatePath, JSON.stringify(result.nextAuditState))
  const rawState = run('record-audit-state', '--bundle', bundlePath, '--state-file', rawStatePath)
  assert.notEqual(rawState.status, 0)
  assert.match(rawState.stderr, /malformed, stale, or not bound/)
  const statePath = join(dirname(bundlePath), 'audit-result.json')
  writeFileSync(statePath, JSON.stringify(result))
  const recorded = run('record-audit-state', '--bundle', bundlePath, '--state-file', statePath)
  assert.equal(recorded.status, 0, recorded.stderr)
  const threaded = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(threaded.status, 0, threaded.stderr)
  const threadedOutput = JSON.parse(threaded.stdout)
  assert.equal(threadedOutput.priorAuditState.digest, result.nextAuditState.digest)
  assert.equal(threadedOutput.scopeManifest.priorAuditStateDigest, result.nextAuditState.digest)
  assert.equal(threadedOutput.verificationReceipts[0].priorAuditStateDigest, result.nextAuditState.digest)
  const threadedResult = await executeWorkflow({
    ...args,
    ...threadedOutput,
    artifacts: [
      ...threadedOutput.artifacts,
      ...args.artifacts.filter((artifact) => artifact.mediaType === 'application/vnd.exampleapp.oracle-source+json'),
      jsonArtifact('measurement-red', redMeasurement),
      jsonArtifact('measurement-green', greenMeasurement),
    ],
    acceptance: args.acceptance,
    ledger: result.nextLedger,
    verificationReceipts: [...threadedOutput.verificationReceipts, red, green],
    regressionProofs: args.regressionProofs,
    verificationGates: [],
    classHistory: result.nextClassHistory,
    budgetHistory: result.nextBudgetHistory,
    sweepIndex: 1,
  }, { env: { CLAUDE_PROJECT_DIR: repo }, cwd: () => repo }, () => {},
  async (tasks) => Promise.all(tasks.map((task) => task())),
  async (_prompt, options) => ({
    status: 'complete',
    coverage: threadedOutput.scopeManifest.changes.map((change) => ({ changeId: change.id, reviewedPatchSha256: change.patchHash, locators: [`${options.label}:${change.path}`] })),
    findings: [],
  }), () => {})
  assert.equal(threadedResult.auditVerdict, 'CLEAR', JSON.stringify(threadedResult))
  const replay = run('record-audit-state', '--bundle', bundlePath, '--state-file', statePath)
  assert.notEqual(replay.status, 0)
  assert.match(replay.stderr, /priorAuditStateDigest does not match|advance exactly one sweep/)
})

test('driver detects pre-edit and post-edit concurrent drift without rollback', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-drift-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 99\n')
  const drift = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n'))
  assert.equal(drift.status, 2)
  assert.match(drift.stderr, /DRIFT before edit/)

  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))
  assert.equal(bundle.targets[0].edits.length, 0)
})

test('driver exposes per-change edit epochs for test-first ordering', () => {
  const repo = repoFixture()
  mkdirSync(join(repo, 'src', 'test'))
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = false\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'test fixture')
  const snapshot = run(
    'snapshot', '--repo', repo, '--session', 'session-test-first-1',
    '--path', 'src/test/ReaderTest.kt', '--path', 'src/Reader.kt',
  )
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/test/ReaderTest.kt', 'fun oracle() = true\n')
  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const changes = JSON.parse(verified.stdout).scopeManifest.changes
  const testChange = changes.find((change) => change.path === 'src/test/ReaderTest.kt')
  const implementationChange = changes.find((change) => change.path === 'src/Reader.kt')
  assert.equal(testChange.kind, 'test')
  assert.ok(Date.parse(testChange.lastEditFinishedAt) <= Date.parse(implementationChange.firstEditStartedAt))
})

test('driver records oracle source state around the executed measurement', () => {
  const repo = repoFixture()
  mkdirSync(join(repo, 'src', 'test'))
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = true\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'oracle fixture')
  const snapshot = run(
    'snapshot', '--repo', repo, '--session', 'session-oracle-source-1',
    '--path', 'src/Reader.kt',
  )
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
  const begin = run(
    'begin-oracle', '--bundle', bundlePath, '--oracle-id', 'reader-oracle',
    '--path', 'src/test/ReaderTest.kt',
  )
  assert.equal(begin.status, 0, begin.stderr)
  const finish = run('finish-oracle', '--bundle', bundlePath, '--oracle-id', 'reader-oracle')
  assert.equal(finish.status, 0, finish.stderr)
  const deletedBegin = run(
    'begin-oracle', '--bundle', bundlePath, '--oracle-id', 'deleted-fixture-oracle',
    '--path', 'src/test/DeletedFixture.json',
  )
  assert.equal(deletedBegin.status, 0, deletedBegin.stderr)
  const deletedFinish = run('finish-oracle', '--bundle', bundlePath, '--oracle-id', 'deleted-fixture-oracle')
  assert.equal(deletedFinish.status, 0, deletedFinish.stderr)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  const artifact = output.artifacts.find((item) => item.id === 'oracle-source-reader-oracle')
  assert.equal(artifact.mediaType, 'application/vnd.exampleapp.oracle-source+json')
  const payload = JSON.parse(Buffer.from(artifact.payload, 'base64').toString('utf8'))
  assert.equal(payload.sourceStates[0].path, 'src/test/ReaderTest.kt')
  assert.equal(payload.sourceStates[0].sha256, sha('fun oracle() = true\n'))
  const deletedArtifact = output.artifacts.find((item) => item.id === 'oracle-source-deleted-fixture-oracle')
  const deletedPayload = JSON.parse(Buffer.from(deletedArtifact.payload, 'base64').toString('utf8'))
  assert.equal(deletedPayload.sourceStates[0].sha256, sha('ABSENT'))
  assert.equal(deletedPayload.sourceStates[0].mode, null)
})

test('driver rejects an absent oracle source created and deleted inside the measurement window', () => {
  const repo = repoFixture()
  mkdirSync(join(repo, 'src', 'test'))
  const snapshot = run(
    'snapshot', '--repo', repo, '--session', 'session-absent-oracle-aba-1',
    '--path', 'src/Reader.kt',
  )
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
  const fixturePath = join(repo, 'src', 'test', 'TransientFixture.json')
  const begin = run(
    'begin-oracle', '--bundle', bundlePath, '--oracle-id', 'transient-absent-oracle',
    '--path', 'src/test/TransientFixture.json',
  )
  assert.equal(begin.status, 0, begin.stderr)
  writeFileSync(fixturePath, '{"transient":true}\n')
  rmSync(fixturePath)
  const finish = run('finish-oracle', '--bundle', bundlePath, '--oracle-id', 'transient-absent-oracle')
  assert.equal(finish.status, 2)
  assert.match(finish.stderr, /DRIFT during oracle execution window/)
})

test('driver oracle artifacts bind operational receipts end to end through the workflow', async () => {
  const repo = repoFixture()
  mkdirSync(join(repo, 'src', 'test'))
  mkdirSync(join(repo, 'a'))
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = true\n')
  writeFileSync(join(repo, 'a', '_x.kt'), 'fun underscore() = 1\n')
  writeFileSync(join(repo, 'a', '-x.kt'), 'fun dash() = 1\n')
  writeFileSync(join(repo, 'src', 'test', 'reader-oracle.mjs'), [
    "import { readFileSync } from 'node:fs'",
    "const source = readFileSync(new URL('../Reader.kt', import.meta.url), 'utf8')",
    "const observedState = source.includes('= 2') ? 'VALUE_2' : 'BUG_PRESENT'",
    "process.stdout.write(JSON.stringify({ observedState }))",
    "process.exit(observedState === 'VALUE_2' ? 0 : 1)",
    '',
  ].join('\n'))
  writeFileSync(join(repo, 'gradlew'), `#!/bin/sh\nexec "${process.execPath}" src/test/reader-oracle.mjs\n`)
  chmodSync(join(repo, 'gradlew'), 0o755)
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'oracle workflow fixture')
  const snapshot = run(
    'snapshot', '--repo', repo, '--session', 'session-oracle-e2e-1',
    '--path', 'src/Reader.kt', '--path', 'a/_x.kt', '--path', 'a/-x.kt',
  )
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const oracleExecutable = './gradlew'
  const oracleArgs = [':reader:test', '--rerun-tasks']
  const executions = new Map()

  for (const oracleId of ['reader-red', 'reader-green']) {
    if (oracleId === 'reader-green') {
      completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
      completeEdit(repo, bundlePath, 'a/_x.kt', 'fun underscore() = 2\n')
      completeEdit(repo, bundlePath, 'a/-x.kt', 'fun dash() = 2\n')
    }
    const begin = run(
      'begin-oracle', '--bundle', bundlePath, '--oracle-id', oracleId,
      '--path', 'src/test/ReaderTest.kt',
      '--path', 'src/test/reader-oracle.mjs',
      '--path', 'gradlew',
    )
    assert.equal(begin.status, 0, begin.stderr)
    const execution = spawnSync(oracleExecutable, oracleArgs, { cwd: repo, encoding: 'utf8' })
    executions.set(oracleId, execution)
    const finish = run('finish-oracle', '--bundle', bundlePath, '--oracle-id', oracleId)
    assert.equal(finish.status, 0, finish.stderr)
  }
  assert.equal(executions.get('reader-red').status, 1)
  assert.equal(executions.get('reader-green').status, 0)

  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  const greenSourceArtifact = output.artifacts.find((artifact) => artifact.id === 'oracle-source-reader-green')
  const greenSourcePayload = JSON.parse(Buffer.from(greenSourceArtifact.payload, 'base64').toString('utf8'))
  assert.equal(greenSourcePayload.scopeContentId, output.scopeManifest.currentId)
  const machineOracle = { metric: 'observedState', op: 'eq', value: 'VALUE_2' }
  const makeReceipt = (id, outcome) => {
    const sourceArtifactId = `oracle-source-${id}`
    const sourceArtifact = output.artifacts.find((artifact) => artifact.id === sourceArtifactId)
    const source = JSON.parse(Buffer.from(sourceArtifact.payload, 'base64').toString('utf8'))
    const isPre = outcome === 'validated'
    const execution = executions.get(id)
    const observedState = JSON.parse(execution.stdout).observedState
    const exitCode = execution.status
    const executable = oracleExecutable
    const commandArgs = oracleArgs
    const command = [executable, ...commandArgs].join(' ')
    const measurement = {
      runner: 'gradle',
      task: ':reader:test',
      executable,
      commandArgs,
      command,
      testIdentity: 'ReaderTest#value',
      scenarioFingerprint: 'reader-value-v1',
      observedState,
      executedCount: 1,
      matchedTestCount: 1,
      passedCount: isPre ? 0 : 1,
      failedCount: isPre ? 1 : 0,
      errorCount: 0,
      skippedCount: 0,
      abortedCount: 0,
      failureKind: isPre ? 'ASSERTION' : 'NONE',
      failureSignature: isPre ? 'AssertionError: expected VALUE_2' : undefined,
      exitCode,
      runStartedAt: source.startedAt,
      capturedAt: source.finishedAt,
      reportPath: `reports/${id}.xml`,
      reportMtime: source.finishedAt,
      reportHash: sha(execution.stdout),
      evidenceHash: sha(`${execution.stdout}\n${execution.stderr}`),
      oracleSourceHash: source.sourceHash,
      oracleSourceArtifactId: sourceArtifactId,
    }
    const currentId = isPre ? source.scopeContentId : output.scopeManifest.currentId
    const contentHash = isPre ? source.scopeContentId : output.scopeManifest.contentHash
    return {
      receipt: {
        id,
        key: 'src/reader.kt|logic.wrong_branch|reader.value|value',
        scopeFingerprint: output.scopeManifest.scopeFingerprint,
        currentId,
        contentHash,
        status: 'verified',
        source: 'main-tool-call-unattested',
        kind: 'test',
        outcome,
        contentPhase: isPre ? 'pre' : 'post',
        executedAt: source.finishedAt,
        runId: output.runId,
        runNonce: output.runNonce,
        acceptanceId: 'acceptance-1',
        scenarioFingerprint: 'reader-value-v1',
        measurementArtifactId: `measurement-${id}`,
        machineOracle,
        command: measurement.command,
        exitCode,
        expectedExitCode: exitCode,
        testIdentity: measurement.testIdentity,
        executedCount: 1,
        matchedTestCount: 1,
        passedCount: measurement.passedCount,
        failedCount: measurement.failedCount,
        errorCount: 0,
        skippedCount: 0,
        abortedCount: 0,
        runStartedAt: source.startedAt,
        reportPath: measurement.reportPath,
        reportMtime: source.finishedAt,
        reportHash: measurement.reportHash,
        evidenceHash: measurement.evidenceHash,
      },
      artifact: jsonArtifact(`measurement-${id}`, measurement),
    }
  }
  const red = makeReceipt('reader-red', 'validated')
  const green = makeReceipt('reader-green', 'pass')
  const args = {
    ...output,
    artifacts: [...output.artifacts, red.artifact, green.artifact],
    acceptance: [{
      id: 'acceptance-1',
      defect: 'Reader returns old value',
      statement: 'Reader returns value 2',
      scenarioFingerprint: 'reader-value-v1',
      machineOracle,
      mandatory: true,
      blastRadiusAnchors: ['Reader.value'],
      oracleSourcePaths: ['gradlew', 'src/test/ReaderTest.kt', 'src/test/reader-oracle.mjs'],
    }],
    ledger: { entries: [] },
    verificationReceipts: [...output.verificationReceipts, red.receipt, green.receipt],
    regressionProofs: [{ id: 'proof-e2e', acceptanceId: 'acceptance-1', preReceiptId: red.receipt.id, postReceiptId: green.receipt.id }],
    verificationGates: [],
    classHistory: [],
    budgetHistory: [],
    sweepIndex: 0,
  }
  const result = await executeWorkflow(
    args,
    { env: { CLAUDE_PROJECT_DIR: repo }, cwd: () => repo },
    () => {},
    async (tasks) => Promise.all(tasks.map((task) => task())),
    async (_prompt, options) => ({
      status: 'complete',
      coverage: output.scopeManifest.changes.map((change) => ({
        changeId: change.id,
        reviewedPatchSha256: change.patchHash,
        locators: [`${options.label}:${change.path}`],
      })),
      findings: [],
    }),
    () => {},
  )
  assert.equal(result.auditVerdict, 'CLEAR', JSON.stringify(result))
})

test('driver rejects oracle source drift inside the measurement window', () => {
  const repo = repoFixture()
  mkdirSync(join(repo, 'src', 'test'))
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = true\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'oracle drift fixture')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-oracle-drift-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = run(
    'begin-oracle', '--bundle', bundlePath, '--oracle-id', 'reader-oracle-drift',
    '--path', 'src/test/ReaderTest.kt',
  )
  assert.equal(begin.status, 0, begin.stderr)
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = false\n')
  const finish = run('finish-oracle', '--bundle', bundlePath, '--oracle-id', 'reader-oracle-drift')
  assert.equal(finish.status, 2)
  assert.match(finish.stderr, /DRIFT during oracle execution window/)
})

test('driver rejects oracle source ABA change restored before the window closes', () => {
  const repo = repoFixture()
  mkdirSync(join(repo, 'src', 'test'))
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = true\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'oracle ABA fixture')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-oracle-aba-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = run(
    'begin-oracle', '--bundle', bundlePath, '--oracle-id', 'reader-oracle-aba',
    '--path', 'src/test/ReaderTest.kt',
  )
  assert.equal(begin.status, 0, begin.stderr)
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = false\n')
  writeFileSync(join(repo, 'src', 'test', 'ReaderTest.kt'), 'fun oracle() = true\n')
  const finish = run('finish-oracle', '--bundle', bundlePath, '--oracle-id', 'reader-oracle-aba')
  assert.equal(finish.status, 2)
  assert.match(finish.stderr, /DRIFT during oracle execution window/)
})

test('driver does not impose a hard twelve-sweep terminal', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-sweep-continuation-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  let priorDigest = null
  for (let sweepIndex = 0; sweepIndex <= 12; sweepIndex += 1) {
    const stateFile = join(repo, `audit-state-${sweepIndex}.json`)
    const history = Array.from({ length: sweepIndex + 1 }, () => [])
    const budgets = Array(sweepIndex + 1).fill(1)
    const state = sealedAuditOutput(output, sweepIndex, { entries: [] }, history, budgets, priorDigest)
    writeFileSync(stateFile, JSON.stringify(state))
    const recorded = run('record-audit-state', '--bundle', bundlePath, '--state-file', stateFile)
    assert.equal(recorded.status, 0, recorded.stderr)
    priorDigest = state.nextAuditState.digest
  }
})

test('driver-recorded audit state cannot drop a prior ledger key with a recomputed digest', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-state-ledger-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  const key = 'src/reader.kt|logic.keep|reader.value|default'
  const sweep0 = sealedAuditOutput(output, 0, { entries: [{ key, status: 'open' }] }, [[]], [1])
  const wrongRun = structuredClone(sweep0)
  wrongRun.nextAuditState.runId = 'different-run'
  const { digest: _wrongDigest, ...wrongRunState } = wrongRun.nextAuditState
  wrongRun.nextAuditState.digest = sha(stableStringify(wrongRunState))
  const wrongRunPath = join(dirname(bundlePath), 'state-wrong-run.json')
  writeFileSync(wrongRunPath, JSON.stringify(wrongRun))
  const stale = run('record-audit-state', '--bundle', bundlePath, '--state-file', wrongRunPath)
  assert.equal(stale.status, 2)
  assert.match(stale.stderr, /malformed, stale, or not bound/)
  const sweep0Path = join(dirname(bundlePath), 'state-sweep-0.json')
  writeFileSync(sweep0Path, JSON.stringify(sweep0))
  assert.equal(run('record-audit-state', '--bundle', bundlePath, '--state-file', sweep0Path).status, 0)

  const forgedSweep1 = sealedAuditOutput(output, 1, { entries: [] }, [[], []], [1, 1], sweep0.nextAuditState.digest)
  const sweep1Path = join(dirname(bundlePath), 'state-sweep-1-drop.json')
  writeFileSync(sweep1Path, JSON.stringify(forgedSweep1))
  const dropped = run('record-audit-state', '--bundle', bundlePath, '--state-file', sweep1Path)
  assert.equal(dropped.status, 2)
  assert.match(dropped.stderr, /ledger continuity lost prior key/)
})

test('driver inventories both sides of a pre-existing rename', () => {
  const repo = repoFixture()
  git(repo, 'mv', 'src/Reader.kt', 'src/Renamed.kt')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-rename-1', '--path', 'src/Renamed.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const bundle = JSON.parse(readFileSync(JSON.parse(snapshot.stdout).bundlePath, 'utf8'))
  assert.equal(bundle.targets[0].preExistingDirty, true)
  assert.ok(bundle.initialDirtyPaths.includes('src/Reader.kt'))
  assert.ok(bundle.initialDirtyPaths.includes('src/Renamed.kt'))
})

test('driver inventories an oversized ignored file by identity and still catches drift on it', () => {
  const repo = repoFixture()
  // A large gitignored fixture is ordinary in an Android repo (this one carries a 52 MB test PDF).
  // Content-hashing every unowned path used to hard-fail here, which made snapshot impossible.
  writeFileSync(join(repo, '.gitignore'), 'big.bin\n')
  writeFileSync(join(repo, 'big.bin'), Buffer.alloc(17 * 1024 * 1024, 7))

  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-oversize-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)

  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n'))
  assert.equal(begin.status, 0, begin.stderr)
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 2\n')
  const finish = run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId)
  assert.equal(finish.status, 0, finish.stderr)

  const clean = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(clean.status, 0, clean.stderr)

  // Identity fingerprint must still move when the file is rewritten — otherwise the cheaper
  // inventory would have silently dropped concurrent-edit detection for large files.
  writeFileSync(join(repo, 'big.bin'), Buffer.alloc(17 * 1024 * 1024 + 4096, 9))
  const drifted = run('verify-bundle', '--bundle', bundlePath)
  assert.notEqual(drifted.status, 0, 'rewriting the oversized unowned file must be detected')
})

test('driver rejects a symlink target that escapes the repository', () => {
  const repo = repoFixture()
  const outside = mkdtempSync(join(tmpdir(), 'fix-evidence-outside-'))
  temporaryRoots.add(outside)
  writeFileSync(join(outside, 'secret.txt'), 'outside\n')
  symlinkSync(join(outside, 'secret.txt'), join(repo, 'src', 'escape.txt'))
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-symlink-1', '--path', 'src/escape.txt')
  assert.notEqual(snapshot.status, 0)
  assert.match(snapshot.stderr, /Symbolic-link (?:targets|path components) are not supported|resolves outside repo/)

  symlinkSync(join(outside, 'missing.txt'), join(repo, 'src', 'broken.txt'))
  const broken = run('snapshot', '--repo', repo, '--session', 'session-broken-link-1', '--path', 'src/broken.txt')
  assert.notEqual(broken.status, 0)
  assert.match(broken.stderr, /Symbolic-link path components/)
})

test('binary evidence requires explicit manual review and remains binary', async () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'fixture.bin'), Buffer.from([0, 1, 2]))
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'binary base')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-binary-1', '--path', 'src/fixture.bin')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/fixture.bin', '--expected-post-sha256', sha(Buffer.from([0, 1, 3])))
  const { editId } = JSON.parse(begin.stdout)
  writeFileSync(join(repo, 'src', 'fixture.bin'), Buffer.from([0, 1, 3]))
  assert.equal(run('finish-edit', '--bundle', bundlePath, '--edit-id', editId).status, 0)
  const blocked = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(blocked.status, 3)
  assert.match(blocked.stderr, /Binary target requires explicit manual review/)
  assert.equal(run('approve-manual', '--bundle', bundlePath, '--path', 'src/fixture.bin', '--reason', 'binary bytes inspected').status, 0)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  assert.equal(output.scopeManifest.changes[0].kind, 'binary')
  assert.equal(output.scopeManifest.changes[0].manualReviewReceiptId, 'manual-change-0')
  assert.equal(output.scopeManifest.changes[0].binaryArtifactId, 'binary-0')
  assert.equal(output.scopeManifest.changes[0].binaryBaselineArtifactId, 'binary-baseline-0')
  const exactBinary = output.artifacts.find((artifact) => artifact.id === 'binary-0')
  const baselineBinary = output.artifacts.find((artifact) => artifact.id === 'binary-baseline-0')
  assert.equal(exactBinary.mediaType, 'application/octet-stream')
  assert.deepEqual(Buffer.from(exactBinary.payload, 'base64'), Buffer.from([0, 1, 3]))
  assert.equal(exactBinary.sha256, output.scopeManifest.changes[0].postimageSha256)
  assert.deepEqual(Buffer.from(baselineBinary.payload, 'base64'), Buffer.from([0, 1, 2]))
  assert.equal(baselineBinary.sha256, output.scopeManifest.changes[0].preimageSha256)
  const binaryPatch = Buffer.from(output.artifacts[0].payload, 'base64').toString('utf8')
  assert.match(binaryPatch, /^App binary evidence v1$/m)
  assert.match(binaryPatch, new RegExp(`^artifact ${exactBinary.sha256}$`, 'm'))
  assert.doesNotMatch(binaryPatch, /^GIT binary patch$/m)

  const redMeasurement = {
    runner: 'gradle', task: ':reader:test', commandArgs: [':reader:test', '--rerun-tasks'],
    testIdentity: 'BinaryFixtureTest#bytes', scenarioFingerprint: 'reader-value-v1', observedState: 'BUG_PRESENT',
    executedCount: 1, matchedTestCount: 1, passedCount: 0, failedCount: 1, errorCount: 0, skippedCount: 0, abortedCount: 0,
    failureKind: 'ASSERTION', exitCode: 1, failureSignature: 'AssertionError: expected new bytes',
  }
  const greenMeasurement = { ...redMeasurement, observedState: 'VALUE_2', passedCount: 1, failedCount: 0, failureKind: 'NONE', exitCode: 0 }
  const red = testReceipt('binary-red', output, 'validated', redMeasurement)
  const green = testReceipt('binary-green', output, 'pass', greenMeasurement)
  const result = await executeWorkflow(
    {
      ...output,
      artifacts: [...output.artifacts, jsonArtifact('measurement-binary-red', redMeasurement), jsonArtifact('measurement-binary-green', greenMeasurement)],
      acceptance: [{ id: 'acceptance-1', defect: 'Fixture has old bytes', statement: 'Fixture has new bytes', scenarioFingerprint: 'reader-value-v1', machineOracle: { metric: 'observedState', op: 'eq', value: 'VALUE_2' }, mandatory: true, blastRadiusAnchors: ['BinaryFixture.bytes'], oracleSourcePaths: ['src/test/ReaderTest.kt'] }],
      ledger: { entries: [] }, verificationReceipts: [...output.verificationReceipts, red, green],
      regressionProofs: [{ id: 'proof-binary', acceptanceId: 'acceptance-1', preReceiptId: 'binary-red', postReceiptId: 'binary-green' }],
      verificationGates: [], classHistory: [], budgetHistory: [], sweepIndex: 0,
    },
    { env: { CLAUDE_PROJECT_DIR: repo }, cwd: () => repo }, () => {},
    async (tasks) => Promise.all(tasks.map((task) => task())),
    async (prompt, options) => {
      assert.match(prompt, new RegExp(exactBinary.payload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.match(prompt, new RegExp(baselineBinary.payload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      return {
        status: 'complete',
        coverage: output.scopeManifest.changes.map((change) => ({ changeId: change.id, reviewedPatchSha256: change.patchHash, ...(change.kind === 'binary' ? { reviewedBinarySha256: exactBinary.sha256, reviewedBinaryBaselineSha256: baselineBinary.sha256 } : {}), locators: [`${options.label}:${change.path}`] })),
        findings: [],
      }
    },
    () => {},
  )
  assert.equal(result.auditVerdict, 'CLEAR', JSON.stringify(result))
})

test('empty-file creation has a canonical non-empty exact patch while no-op edits fail', () => {
  const repo = repoFixture()
  const created = run('snapshot', '--repo', repo, '--session', 'session-empty-add-1', '--path', 'src/Empty.kt')
  const { bundlePath } = JSON.parse(created.stdout)
  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Empty.kt', '--expected-post-sha256', sha(''))
  const { editId } = JSON.parse(begin.stdout)
  writeFileSync(join(repo, 'src', 'Empty.kt'), '')
  assert.equal(run('finish-edit', '--bundle', bundlePath, '--edit-id', editId).status, 0)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const patch = Buffer.from(JSON.parse(verified.stdout).artifacts[0].payload, 'base64').toString('utf8')
  assert.match(patch, /new file mode/)
  assert.match(patch, /^--- \/dev\/null$/m)
  assert.match(patch, /^\+\+\+ b\/src\/Empty\.kt$/m)

  const noOp = run('snapshot', '--repo', repo, '--session', 'session-no-op-1', '--path', 'src/Reader.kt')
  const noOpBundle = JSON.parse(noOp.stdout).bundlePath
  const noOpBegin = run('begin-edit', '--bundle', noOpBundle, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 1\n'))
  const noOpFinish = run('finish-edit', '--bundle', noOpBundle, '--edit-id', JSON.parse(noOpBegin.stdout).editId)
  assert.notEqual(noOpFinish.status, 0)
  assert.match(noOpFinish.stderr, /No content delta recorded/)
})

test('predeclared postimage rejects a concurrent writer inside the edit window', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-window-race-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n'))
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 99 // concurrent writer\n')
  const finish = run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId)
  assert.equal(finish.status, 2)
  assert.match(finish.stderr, /DRIFT in edit window/)
})

test('file modes participate in exact patch provenance and later drift', () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'tool.sh'), '#!/bin/sh\nexit 0\n')
  chmodSync(join(repo, 'src', 'tool.sh'), 0o755)
  git(repo, 'add', 'src/tool.sh')
  git(repo, 'commit', '-qm', 'add executable')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-mode-1', '--path', 'src/tool.sh')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/tool.sh', '--expected-post-sha256', sha('#!/bin/sh\nexit 1\n'), '--expected-post-mode', '644')
  writeFileSync(join(repo, 'src', 'tool.sh'), '#!/bin/sh\nexit 1\n')
  chmodSync(join(repo, 'src', 'tool.sh'), 0o644)
  assert.equal(run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId).status, 0)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const patch = Buffer.from(JSON.parse(verified.stdout).artifacts[0].payload, 'base64').toString('utf8')
  assert.match(patch, /^old mode 100755$/m)
  assert.match(patch, /^new mode 100644$/m)
  chmodSync(join(repo, 'src', 'tool.sh'), 0o755)
  const drift = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(drift.status, 2)
  assert.match(drift.stderr, /DRIFT after recorded edit/)
})

test('driver rejects git metadata targets and edit-id traversal', () => {
  const repo = repoFixture()
  const metadata = run('snapshot', '--repo', repo, '--session', 'session-git-meta-1', '--path', '.git/config')
  assert.notEqual(metadata.status, 0)
  assert.match(metadata.stderr, /Git metadata paths/)

  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-edit-id-1', '--path', 'src/Reader.kt')
  const traversal = run('finish-edit', '--bundle', JSON.parse(snapshot.stdout).bundlePath, '--edit-id', '../bundle')
  assert.notEqual(traversal.status, 0)
  assert.match(traversal.stderr, /Invalid edit id/)
})

test('hand-edited approval or scope bundle fails its integrity seal', () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 1\n// pre-existing\n')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-tamper-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))
  bundle.targets[0].overlap = 'approved'
  bundle.targets[0].overlapApproval = { reason: 'self-authored', approvedAt: new Date().toISOString() }
  writeFileSync(bundlePath, JSON.stringify(bundle))
  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n'))
  assert.equal(begin.status, 2)
  assert.match(begin.stderr, /bundle integrity mismatch/i)
})

test('budgetDiffLines persists the high-water mark across shrinking sweeps', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-budget-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const large = Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n') + '\n'
  const first = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha(large))
  writeFileSync(join(repo, 'src', 'Reader.kt'), large)
  assert.equal(run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(first.stdout).editId).status, 0)
  const high = JSON.parse(run('verify-bundle', '--bundle', bundlePath).stdout).scopeManifest.budgetDiffLines

  const small = 'fun value() = 2\n'
  const second = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha(small))
  writeFileSync(join(repo, 'src', 'Reader.kt'), small)
  assert.equal(run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(second.stdout).editId).status, 0)
  const finalManifest = JSON.parse(run('verify-bundle', '--bundle', bundlePath).stdout).scopeManifest
  assert.ok(finalManifest.diffLines < high)
  assert.equal(finalManifest.budgetDiffLines, high)
})

test('linked worktrees store evidence in the common git dir and hardlinks are rejected', () => {
  const repo = repoFixture()
  const linked = mkdtempSync(join(tmpdir(), 'fix-linked-parent-'))
  temporaryRoots.add(linked)
  const worktree = join(linked, 'worktree')
  git(repo, 'worktree', 'add', '-q', worktree)
  const snapshot = run('snapshot', '--repo', worktree, '--session', 'session-linked-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  assert.match(JSON.parse(snapshot.stdout).bundlePath, /codex-fix-evidence/)

  const outside = join(linked, 'outside.txt')
  writeFileSync(outside, 'shared inode\n')
  linkSync(outside, join(worktree, 'src', 'hardlink.txt'))
  const hardlink = run('snapshot', '--repo', worktree, '--session', 'session-hardlink-1', '--path', 'src/hardlink.txt')
  assert.notEqual(hardlink.status, 0)
  assert.match(hardlink.stderr, /Hard-linked editable files/)
})

test('baseline artifact tampering is detected before exact patch emission', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-baseline-tamper-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n'))
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 2\n')
  assert.equal(run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId).status, 0)
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))
  writeFileSync(bundle.targets[0].snapshotPath, 'tampered baseline\n')
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 2)
  assert.match(verified.stderr, /Baseline snapshot integrity mismatch/)
})

test('deletion derives the ABSENT sentinel and path/count bounds fail early', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-delete-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-mode', 'absent')
  assert.equal(begin.status, 0, begin.stderr)
  rmSync(join(repo, 'src', 'Reader.kt'))
  assert.equal(run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId).status, 0)
  assert.equal(run('verify-bundle', '--bundle', bundlePath).status, 0)

  const control = run('snapshot', '--repo', repo, '--session', 'session-control-path-1', '--path', 'src/Bad\nmode')
  assert.notEqual(control.status, 0)
  assert.match(control.stderr, /Invalid repo path/)

  const manyArgs = ['snapshot', '--repo', repo, '--session', 'session-too-many-1']
  for (let index = 0; index < 17; index += 1) manyArgs.push('--path', `src/File${index}.kt`)
  const tooMany = run(...manyArgs)
  assert.notEqual(tooMany.status, 0)
  assert.match(tooMany.stderr, /1\.\.16 target paths/)
})

test('driver rejects repository-internal ancestor symlink aliases and non-canonical patch paths', () => {
  const repo = repoFixture()
  mkdirSync(join(repo, 'real'))
  writeFileSync(join(repo, 'real', 'Alias.kt'), 'fun alias() = 1\n')
  symlinkSync(join(repo, 'real'), join(repo, 'alias'))
  const alias = run('snapshot', '--repo', repo, '--session', 'session-ancestor-link-1', '--path', 'alias/Alias.kt')
  assert.notEqual(alias.status, 0)
  assert.match(alias.stderr, /Symbolic-link path components/)

  for (const path of ['./src/Reader.kt', 'src//Reader.kt', 'src/Bad"Name.kt', `src/Cafe\u0301.kt`]) {
    const result = run('snapshot', '--repo', repo, '--session', `session-path-${createHash('sha1').update(path).digest('hex').slice(0, 10)}`, '--path', path)
    assert.notEqual(result.status, 0, path)
    assert.match(result.stderr, /Invalid repo path|Non-canonical repo path/)
  }
})

test('ignored, assume-unchanged, and skip-worktree targets remain pre-existing user work', () => {
  const ignoredRepo = repoFixture()
  writeFileSync(join(ignoredRepo, '.gitignore'), 'local.properties\n')
  git(ignoredRepo, 'add', '.gitignore')
  git(ignoredRepo, 'commit', '-qm', 'ignore local config')
  writeFileSync(join(ignoredRepo, 'local.properties'), 'sdk.dir=/private/user-sdk\n')
  const ignored = run('snapshot', '--repo', ignoredRepo, '--session', 'session-ignored-1', '--path', 'local.properties')
  assert.equal(ignored.status, 0, ignored.stderr)
  assert.equal(JSON.parse(readFileSync(JSON.parse(ignored.stdout).bundlePath, 'utf8')).targets[0].preExistingDirty, true)

  for (const [flagName, session] of [['--assume-unchanged', 'session-assume-1'], ['--skip-worktree', 'session-skip-1']]) {
    const repo = repoFixture()
    git(repo, 'update-index', flagName, 'src/Reader.kt')
    writeFileSync(join(repo, 'src', 'Reader.kt'), `fun value() = ${flagName.length}\n`)
    const snapshot = run('snapshot', '--repo', repo, '--session', session, '--path', 'src/Reader.kt')
    assert.equal(snapshot.status, 0, snapshot.stderr)
    const bundle = JSON.parse(readFileSync(JSON.parse(snapshot.stdout).bundlePath, 'utf8'))
    assert.equal(bundle.targets[0].preExistingDirty, true, flagName)
    assert.ok(bundle.initialDirtyPaths.includes('src/Reader.kt'), flagName)
  }
})

test('verify rejects Git-visible worktree changes outside the declared snapshot scope', () => {
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-unowned-drift-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
  writeFileSync(join(repo, 'src', 'Unowned.kt'), 'fun unowned() = true\n')
  const result = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(result.status, 2)
  assert.match(result.stderr, /outside snapshot scope/)
})

test('verify inventories hidden tracked paths outside scope despite Git index flags', () => {
  for (const [flagName, session] of [['--assume-unchanged', 'session-unowned-assume-1'], ['--skip-worktree', 'session-unowned-skip-1']]) {
    const repo = repoFixture()
    writeFileSync(join(repo, 'src', 'Hidden.kt'), 'fun hidden() = 1\n')
    git(repo, 'add', 'src/Hidden.kt')
    git(repo, 'commit', '-qm', 'hidden fixture')
    git(repo, 'update-index', flagName, 'src/Hidden.kt')
    const snapshot = run('snapshot', '--repo', repo, '--session', session, '--path', 'src/Reader.kt')
    assert.equal(snapshot.status, 0, snapshot.stderr)
    const { bundlePath } = JSON.parse(snapshot.stdout)
    completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
    writeFileSync(join(repo, 'src', 'Hidden.kt'), 'fun hidden() = 2\n')
    const result = run('verify-bundle', '--bundle', bundlePath)
    assert.equal(result.status, 2, flagName)
    assert.match(result.stderr, /outside snapshot scope/, flagName)
  }
})

test('approvals bind the final edit postimage and use the real approval timestamp', () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 1\n// user baseline\n')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-approval-binding-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const early = run('approve-overlap', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--reason', 'too early')
  assert.equal(early.status, 3)
  assert.match(early.stderr, /completed edit/)

  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n// user baseline\n')
  const approval = run('approve-overlap', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--reason', 'reviewed first final bytes')
  assert.equal(approval.status, 0, approval.stderr)
  const approvedAt = JSON.parse(readFileSync(bundlePath, 'utf8')).targets[0].overlapApproval.approvedAt
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  assert.equal(JSON.parse(verified.stdout).verificationReceipts.find((receipt) => receipt.kind === 'manual-review').executedAt, approvedAt)

  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 3\n// user baseline\n')
  const stale = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(stale.status, 3)
  assert.match(stale.stderr, /Ambiguous pre-existing dirty overlap/)
})

test('mode-only edits emit exact mode provenance and round-trip through the workflow', async () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'mode.sh'), '#!/bin/sh\nexit 0\n')
  chmodSync(join(repo, 'src', 'mode.sh'), 0o644)
  git(repo, 'add', 'src/mode.sh')
  git(repo, 'commit', '-qm', 'mode fixture')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-mode-only-1', '--path', 'src/mode.sh')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const invalid = run('begin-edit', '--bundle', bundlePath, '--path', 'src/mode.sh', '--expected-post-sha256', sha('#!/bin/sh\nexit 0\n'), '--expected-post-mode', '755junk')
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stderr, /Invalid --expected-post-mode/)

  const begin = run('begin-edit', '--bundle', bundlePath, '--path', 'src/mode.sh', '--expected-post-sha256', sha('#!/bin/sh\nexit 0\n'), '--expected-post-mode', '755')
  assert.equal(begin.status, 0, begin.stderr)
  chmodSync(join(repo, 'src', 'mode.sh'), 0o755)
  const finish = run('finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId)
  assert.equal(finish.status, 0, finish.stderr)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  const patch = Buffer.from(output.artifacts[0].payload, 'base64').toString('utf8')
  assert.match(patch, /^old mode 100644$/m)
  assert.match(patch, /^new mode 100755$/m)
  const redMeasurement = {
    runner: 'gradle', task: ':reader:test', commandArgs: [':reader:test', '--rerun-tasks'], testIdentity: 'ModeTest#executable',
    scenarioFingerprint: 'mode-v1', observedState: 'NOT_EXECUTABLE', executedCount: 1, matchedTestCount: 1,
    passedCount: 0, failedCount: 1, errorCount: 0, skippedCount: 0, abortedCount: 0, failureKind: 'ASSERTION', exitCode: 1,
    failureSignature: 'AssertionError: expected executable mode',
  }
  const greenMeasurement = { ...redMeasurement, observedState: 'EXECUTABLE', passedCount: 1, failedCount: 0, failureKind: 'NONE', exitCode: 0 }
  const red = testReceipt('mode-red', output, 'validated', redMeasurement)
  const green = testReceipt('mode-green', output, 'pass', greenMeasurement)
  red.scenarioFingerprint = green.scenarioFingerprint = 'mode-v1'
  red.machineOracle = green.machineOracle = { metric: 'observedState', op: 'eq', value: 'EXECUTABLE' }
  const result = await executeWorkflow({
    ...output,
    artifacts: [...output.artifacts, jsonArtifact('measurement-mode-red', redMeasurement), jsonArtifact('measurement-mode-green', greenMeasurement)],
    acceptance: [{ id: 'acceptance-1', defect: 'Script is not executable', statement: 'Script is executable', scenarioFingerprint: 'mode-v1', machineOracle: red.machineOracle, mandatory: true, blastRadiusAnchors: ['mode.sh'], oracleSourcePaths: ['src/test/ReaderTest.kt'] }],
    ledger: { entries: [] }, verificationReceipts: [...output.verificationReceipts, red, green],
    regressionProofs: [{ id: 'proof-mode', acceptanceId: 'acceptance-1', preReceiptId: 'mode-red', postReceiptId: 'mode-green' }],
    verificationGates: [], classHistory: [], budgetHistory: [], sweepIndex: 0,
  }, { env: { CLAUDE_PROJECT_DIR: repo }, cwd: () => repo }, () => {},
  async (tasks) => Promise.all(tasks.map((task) => task())),
  async (_prompt, options) => ({
    status: 'complete',
    coverage: output.scopeManifest.changes.map((change) => ({ changeId: change.id, reviewedPatchSha256: change.patchHash, locators: [`${options.label}:${change.path}`] })),
    findings: [],
  }), () => {})
  assert.equal(result.auditVerdict, 'CLEAR', JSON.stringify(result))
})

test('Android and oracle-support files receive precise workflow kinds', () => {
  const repo = repoFixture()
  const fixtures = [
    ['app/src/main/AndroidManifest.xml', '<manifest/>\n', '<manifest package="example"/>\n', 'manifest'],
    ['app/src/main/res/values/strings.xml', '<resources/>\n', '<resources><string name="app">Reader</string></resources>\n', 'resource'],
    ['gradle.properties', 'org.gradle.jvmargs=-Xmx1g\n', 'org.gradle.jvmargs=-Xmx2g\n', 'properties'],
    ['app/proguard-rules.pro', '-dontwarn old\n', '-dontwarn new\n', 'proguard'],
    ['app/src/main/cpp/native.cpp', 'int value = 1;\n', 'int value = 2;\n', 'native'],
    ['app/src/test/java/ReaderTest.kt', 'fun oldTest() = Unit\n', 'fun newTest() = Unit\n', 'test'],
    ['app/src/test/resources/reader.json', '{"value":1}\n', '{"value":2}\n', 'test'],
    ['app/tester/files/input.csv', 'old,value\n', 'new,value\n', 'test'],
    ['core/testing/src/main/java/example/MainDispatcherRule.kt', 'class OldRule\n', 'class MainDispatcherRule\n', 'test'],
    ['.claude/workflows/reader.test.mjs', 'export const value = 1\n', 'export const value = 2\n', 'test'],
    ['.claude/hooks/tests/reader_probe.sh', 'exit 1\n', 'exit 0\n', 'test'],
  ]
  for (const [path, before] of fixtures) {
    mkdirSync(join(repo, path.split('/').slice(0, -1).join('/')), { recursive: true })
    writeFileSync(join(repo, path), before)
  }
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'Android kind fixtures')
  const snapshotArgs = ['snapshot', '--repo', repo, '--session', 'session-kinds-1']
  for (const [path] of fixtures) snapshotArgs.push('--path', path)
  const snapshot = run(...snapshotArgs)
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  for (const [path, , afterContents] of fixtures) completeEdit(repo, bundlePath, path, afterContents)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const actual = Object.fromEntries(JSON.parse(verified.stdout).scopeManifest.changes.map((change) => [change.path, change.kind]))
  for (const [path, , , kind] of fixtures) assert.equal(actual[path], kind, path)
})

test('file and approval inputs are bounded before evidence emission', () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'Huge.bin'), Buffer.alloc((16 * 1024 * 1024) + 1))
  const huge = run('snapshot', '--repo', repo, '--session', 'session-huge-file-1', '--path', 'src/Huge.bin')
  assert.equal(huge.status, 4)
  assert.match(huge.stderr, /Editable file exceeds/)
  assert.equal(existsSync(join(repo, '.git', 'codex-fix-evidence', 'session-huge-file-1')), false)
  rmSync(join(repo, 'src', 'Huge.bin'))

  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-reason-bound-1', '--path', 'src/Reader.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 1\n// user baseline\n')
  // The new unowned/user state happened after this clean snapshot, so approval itself must not be usable as an ownership bypass.
  const reason = run('approve-manual', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--reason', 'x'.repeat(2049))
  assert.notEqual(reason.status, 0)
  assert.match(reason.stderr, /1\.\.2048/)
})

test('ignored out-of-scope files and index flag changes are ownership drift', () => {
  const repo = repoFixture()
  writeFileSync(join(repo, '.gitignore'), 'private/\nbuild/\n')
  git(repo, 'add', '.gitignore')
  git(repo, 'commit', '-qm', 'ignore private files')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-ignored-drift-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Reader.kt', 'fun value() = 2\n')
  mkdirSync(join(repo, 'private'))
  writeFileSync(join(repo, 'private', 'secret.txt'), 'out-of-scope\n')
  const ignoredDrift = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(ignoredDrift.status, 2)
  assert.match(ignoredDrift.stderr, /outside snapshot scope/)

  rmSync(join(repo, 'private'), { recursive: true })
  mkdirSync(join(repo, 'build'))
  writeFileSync(join(repo, 'build', 'generated.txt'), 'generated output is excluded\n')
  const generatedOutput = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(generatedOutput.status, 0, generatedOutput.stderr)
  git(repo, 'update-index', '--assume-unchanged', 'src/Reader.kt')
  const indexDrift = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(indexDrift.status, 2)
  assert.match(indexDrift.stderr, /index changed/)
})

test('pre-existing index flags classify owned targets as ambiguous even when bytes equal index', () => {
  for (const [flagName, session] of [['--assume-unchanged', 'session-clean-assume-1'], ['--skip-worktree', 'session-clean-skip-1']]) {
    const repo = repoFixture()
    git(repo, 'update-index', flagName, 'src/Reader.kt')
    const snapshot = run('snapshot', '--repo', repo, '--session', session, '--path', 'src/Reader.kt')
    assert.equal(snapshot.status, 0, snapshot.stderr)
    const bundle = JSON.parse(readFileSync(JSON.parse(snapshot.stdout).bundlePath, 'utf8'))
    assert.equal(bundle.targets[0].preExistingDirty, true, flagName)
    assert.equal(bundle.targets[0].overlap, 'ambiguous', flagName)
  }
})

test('diff normalization preserves header-like hunk lines and executable index modes', () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'Header.txt'), '-- original\n')
  writeFileSync(join(repo, 'src', 'tool.sh'), '#!/bin/sh\nexit 0\n')
  chmodSync(join(repo, 'src', 'tool.sh'), 0o755)
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'diff fixtures')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-diff-grammar-1', '--path', 'src/Header.txt', '--path', 'src/tool.sh')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Header.txt', '++ replacement\n')
  completeEdit(repo, bundlePath, 'src/tool.sh', '#!/bin/sh\nexit 1\n', 0o755)
  const verified = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  const output = JSON.parse(verified.stdout)
  const headerChange = output.scopeManifest.changes.find((change) => change.path === 'src/Header.txt')
  assert.equal(headerChange.added, 1)
  assert.equal(headerChange.deleted, 1)
  const headerPatch = Buffer.from(output.artifacts.find((artifact) => artifact.id === headerChange.patchArtifactId).payload, 'base64').toString('utf8')
  assert.match(headerPatch, /^--- original$/m)
  assert.match(headerPatch, /^\+\+\+ replacement$/m)
  assert.equal((headerPatch.match(/^--- a\/src\/Header\.txt$/gm) || []).length, 1)
  assert.equal((headerPatch.match(/^\+\+\+ b\/src\/Header\.txt$/gm) || []).length, 1)
  const executableChange = output.scopeManifest.changes.find((change) => change.path === 'src/tool.sh')
  const executablePatch = Buffer.from(output.artifacts.find((artifact) => artifact.id === executableChange.patchArtifactId).payload, 'base64').toString('utf8')
  assert.match(executablePatch, /^index [a-f0-9]+\.\.[a-f0-9]+ 100755$/m)
})

test('non-Git and special target modes fail closed', () => {
  for (const [mode, session] of [[0o600, 'session-mode-600-1'], [0o4755, 'session-mode-setuid-1']]) {
    const repo = repoFixture()
    chmodSync(join(repo, 'src', 'Reader.kt'), mode)
    const snapshot = run('snapshot', '--repo', repo, '--session', session, '--path', 'src/Reader.kt')
    assert.equal(snapshot.status, 4)
    assert.match(snapshot.stderr, /Git-representable mode 644 or 755/)
  }
  const repo = repoFixture()
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-mode-argument-1', '--path', 'src/Reader.kt')
  const invalid = run('begin-edit', '--bundle', JSON.parse(snapshot.stdout).bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n'), '--expected-post-mode', '600')
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stderr, /Invalid --expected-post-mode/)
})

test('dirty submodules outside scope fail closed instead of using directory timestamps', () => {
  const submodule = repoFixture()
  writeFileSync(join(submodule, 'data.txt'), 'one\n')
  git(submodule, 'add', 'data.txt')
  git(submodule, 'commit', '-qm', 'submodule content')
  const repo = repoFixture()
  execFileSync('git', ['-c', 'protocol.file.allow=always', '-C', repo, 'submodule', 'add', '-q', submodule, 'deps/sub'])
  git(repo, 'commit', '-qam', 'add submodule')
  writeFileSync(join(repo, 'deps', 'sub', 'data.txt'), 'two\n')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-dirty-submodule-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 4)
  assert.match(snapshot.stderr, /non-regular path cannot be inventoried safely/)
  assert.equal(existsSync(join(repo, '.git', 'codex-fix-evidence', 'session-dirty-submodule-1')), false)
})

test('exact diff ignores external diff configuration and successful edits release temporary full-file blobs', () => {
  const repo = repoFixture()
  const snapshot = runWithEnv({ GIT_EXTERNAL_DIFF: '/bin/true' }, 'snapshot', '--repo', repo, '--session', 'session-external-diff-1', '--path', 'src/Reader.kt')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const { bundlePath } = JSON.parse(snapshot.stdout)
  const begin = runWithEnv({ GIT_EXTERNAL_DIFF: '/bin/true' }, 'begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 2\n'))
  const duplicatePending = run('begin-edit', '--bundle', bundlePath, '--path', 'src/Reader.kt', '--expected-post-sha256', sha('fun value() = 3\n'))
  assert.equal(duplicatePending.status, 3)
  assert.match(duplicatePending.stderr, /existing pending edit/)
  writeFileSync(join(repo, 'src', 'Reader.kt'), 'fun value() = 2\n')
  const finish = runWithEnv({ GIT_EXTERNAL_DIFF: '/bin/true' }, 'finish-edit', '--bundle', bundlePath, '--edit-id', JSON.parse(begin.stdout).editId)
  assert.equal(finish.status, 0, finish.stderr)
  const evidenceDir = join(bundlePath, '..')
  assert.deepEqual(readdirSync(join(evidenceDir, 'pending')), [])
  assert.equal(readdirSync(join(evidenceDir, 'edits')).filter((name) => name.endsWith('.post')).length, 0)
  const verified = runWithEnv({ GIT_EXTERNAL_DIFF: '/bin/true' }, 'verify-bundle', '--bundle', bundlePath)
  assert.equal(verified.status, 0, verified.stderr)
  assert.equal(readdirSync(join(evidenceDir, 'edits')).filter((name) => name.startsWith('verify-')).length, 0)
})

test('a later edit anywhere in scope invalidates earlier target approvals', () => {
  const repo = repoFixture()
  writeFileSync(join(repo, 'src', 'Dirty.kt'), 'fun dirty() = 1\n')
  writeFileSync(join(repo, 'src', 'Clean.kt'), 'fun clean() = 1\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'two targets')
  writeFileSync(join(repo, 'src', 'Dirty.kt'), 'fun dirty() = 1\n// user\n')
  const snapshot = run('snapshot', '--repo', repo, '--session', 'session-global-approval-1', '--path', 'src/Dirty.kt', '--path', 'src/Clean.kt')
  const { bundlePath } = JSON.parse(snapshot.stdout)
  completeEdit(repo, bundlePath, 'src/Dirty.kt', 'fun dirty() = 2\n// user\n')
  assert.equal(run('approve-overlap', '--bundle', bundlePath, '--path', 'src/Dirty.kt', '--reason', 'reviewed dirty merge').status, 0)
  completeEdit(repo, bundlePath, 'src/Clean.kt', 'fun clean() = 2\n')
  const stale = run('verify-bundle', '--bundle', bundlePath)
  assert.equal(stale.status, 3)
  assert.match(stale.stderr, /Ambiguous pre-existing dirty overlap/)
  assert.equal(run('approve-overlap', '--bundle', bundlePath, '--path', 'src/Dirty.kt', '--reason', 're-reviewed after all scope edits').status, 0)
  assert.equal(run('verify-bundle', '--bundle', bundlePath).status, 0)
})
