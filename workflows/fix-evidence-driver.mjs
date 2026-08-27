#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const SCHEMA_VERSION = 2
const HELPER_VERSION = 'fix-evidence-driver/2'
const MAX_PATCH_BYTES = 256 * 1024
const MAX_TOTAL_PATCH_BYTES = 256 * 1024
const MAX_TOTAL_BINARY_BYTES = 256 * 1024
const MAX_TARGETS = 16
const MAX_EDITS_PER_TARGET = 32
const MAX_FILE_BYTES = 16 * 1024 * 1024
const MAX_BUNDLE_BYTES = 4 * 1024 * 1024
const MAX_PATH_BYTES = 1024
const MAX_REASON_CHARS = 2048
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024
const MAX_AUDIT_STATE_BYTES = 4 * 1024 * 1024
const MAX_ORACLE_CAPTURES = 64
const GENERATED_IGNORED_SEGMENTS = new Set(['build', '.gradle', '.idea', '.kotlin', '.externalNativeBuild'])

let failureCleanupPath = null

function fail(message, code = 1) {
  if (failureCleanupPath) rmSync(failureCleanupPath, { recursive: true, force: true })
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Value(value) {
  return sha256Bytes(stableStringify(value))
}

function jsonArtifact(id, mediaType, value) {
  const bytes = Buffer.from(JSON.stringify(value))
  return {
    id,
    mediaType,
    encoding: 'base64',
    payload: bytes.toString('base64'),
    byteLength: bytes.length,
    sha256: sha256Bytes(bytes),
  }
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

function git(repo, args, options = {}) {
  try {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: options.encoding === null ? null : 'utf8',
      env: options.exactDiff
        ? { ...process.env, GIT_EXTERNAL_DIFF: undefined, GIT_DIFF_OPTS: undefined }
        : process.env,
      stdio: options.allowDiff ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
    })
  } catch (error) {
    if (error?.code === 'ENOBUFS') fail(`Git output exceeds ${MAX_GIT_OUTPUT_BYTES} byte safety limit`, 4)
    throw error
  }
}

function parseCli(argv) {
  const positional = []
  const flags = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`Missing value for --${key}`)
    index += 1
    const prior = flags.get(key)
    flags.set(key, prior === undefined ? value : Array.isArray(prior) ? [...prior, value] : [prior, value])
  }
  return { positional, flags }
}

function flag(flags, name, required = true) {
  const value = flags.get(name)
  if (required && value === undefined) fail(`Missing --${name}`)
  if (name !== 'path' && Array.isArray(value)) fail(`Duplicate --${name}`)
  return value
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function canonicalPath(repo, value) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value) > MAX_PATH_BYTES
    || value !== value.normalize('NFC') || value.includes('\\') || value.includes('"')
    || /[\u0000-\u001f\u007f]/.test(value)) fail(`Invalid repo path: ${value}`)
  if (value.startsWith('/') || value.startsWith('./') || value.endsWith('/') || value.includes('//')
    || value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) fail(`Non-canonical repo path: ${value}`)
  const absolute = resolve(repo, value)
  const rel = relative(repo, absolute)
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) fail(`Path escapes repo: ${value}`)
  if (rel.split(sep).some((segment) => segment.toLowerCase() === '.git')) fail(`Git metadata paths are outside editable scope: ${value}`)
  const realRepo = realpathSync(repo)
  let cursor = realRepo
  for (const segment of rel.split(sep)) {
    cursor = join(cursor, segment)
    if (lstatIfPresent(cursor)?.isSymbolicLink()) fail(`Symbolic-link path components are not supported: ${value}`)
  }
  const existingAncestor = (() => {
    let candidate = absolute
    while (!lstatIfPresent(candidate)) candidate = dirname(candidate)
    return candidate
  })()
  const realAncestor = realpathSync(existingAncestor)
  const realRel = relative(realRepo, realAncestor)
  if (realRel.startsWith(`..${sep}`) || realRel === '..' || isAbsolute(realRel)) fail(`Path resolves outside repo: ${value}`)
  const canonical = rel.split(sep).join('/')
  if (canonical !== value) fail(`Non-canonical repo path: ${value}`)
  return canonical
}

function fileState(path) {
  return captureFile(path).state
}

function captureFile(path) {
  const leaf = lstatIfPresent(path)
  if (!leaf) {
    let witnessPath = dirname(path)
    while (!lstatIfPresent(witnessPath)) witnessPath = dirname(witnessPath)
    const before = statSync(witnessPath, { bigint: true })
    if (!before.isDirectory()) fail(`Nearest existing ancestor is not a directory: ${path}`)
    const after = statSync(witnessPath, { bigint: true })
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || before.mode !== after.mode) {
      fail(`DRIFT while capturing absent file witness: ${path}`, 2)
    }
    return {
      state: { exists: false, sha256: sha256Bytes('ABSENT'), size: 0, mode: null },
      bytes: Buffer.alloc(0),
      observationToken: sha256Value({
        exists: false,
        witness: {
          dev: String(after.dev),
          ino: String(after.ino),
          size: String(after.size),
          mode: String(after.mode),
          mtimeNs: String(after.mtimeNs),
          ctimeNs: String(after.ctimeNs),
        },
      }),
    }
  }
  if (leaf.isSymbolicLink()) fail(`Symbolic-link targets are not supported: ${path}`)
  const before = statSync(path)
  if (!before.isFile()) fail(`Only regular files are supported: ${path}`)
  if (before.nlink > 1) fail(`Hard-linked editable files are not supported: ${path}`)
  const permissionMode = before.mode & 0o7777
  if (permissionMode !== 0o644 && permissionMode !== 0o755) {
    fail(`Editable regular files must use Git-representable mode 644 or 755: ${path}`, 4)
  }
  if (before.size > MAX_FILE_BYTES) fail(`Editable file exceeds ${MAX_FILE_BYTES} byte limit: ${path}`, 4)
  const bytes = readFileSync(path)
  const after = statSync(path)
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.mode !== after.mode) {
    fail(`DRIFT while capturing file: ${path}`, 2)
  }
  const observed = statSync(path, { bigint: true })
  if (Number(observed.dev) !== after.dev || Number(observed.ino) !== after.ino
    || Number(observed.size) !== after.size || Number(observed.mode) !== after.mode) {
    fail(`DRIFT while sealing file observation: ${path}`, 2)
  }
  const observationToken = sha256Value({
    dev: String(observed.dev),
    ino: String(observed.ino),
    size: String(observed.size),
    mode: String(observed.mode),
    mtimeNs: String(observed.mtimeNs),
    ctimeNs: String(observed.ctimeNs),
  })
  return {
    state: { exists: true, sha256: sha256Bytes(bytes), size: bytes.length, mode: after.mode & 0o777, type: 'file' },
    bytes,
    observationToken,
  }
}

function sameState(left, right) {
  return left.exists === right.exists && left.sha256 === right.sha256 && left.size === right.size
    && left.mode === right.mode && (left.type || null) === (right.type || null)
}

function compareCanonicalPathItems(left, right) {
  const leftPath = String(left.path).normalize('NFC').toLowerCase()
  const rightPath = String(right.path).normalize('NFC').toLowerCase()
  return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0
}

function capturedBytesMatchState(bytes, state) {
  return state.exists ? bytes.length === state.size && sha256Bytes(bytes) === state.sha256 : bytes.length === 0
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  renameSync(temp, path)
  chmodSync(path, 0o600)
}

function writeBundle(path, bundle) {
  const { integritySha256: _priorIntegrity, ...unsigned } = bundle
  const sealed = { ...unsigned, integritySha256: sha256Value(unsigned) }
  atomicJson(path, sealed)
}

function writeSealedJson(path, value) {
  const unsigned = { ...value }
  atomicJson(path, { ...unsigned, integritySha256: sha256Value(unsigned) })
}

function readSealedJson(path, label) {
  const metadata = lstatSync(path)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_BUNDLE_BYTES) fail(`${label} is not a bounded regular file`, 2)
  const value = JSON.parse(readFileSync(path, 'utf8'))
  const { integritySha256, ...unsigned } = value
  if (!/^sha256:[a-f0-9]{64}$/.test(integritySha256 || '') || sha256Value(unsigned) !== integritySha256) {
    fail(`${label} integrity mismatch`, 2)
  }
  return unsigned
}

function loadBundle(path) {
  const metadata = lstatSync(path)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_BUNDLE_BYTES) fail('Evidence bundle is not a bounded regular file', 2)
  const bundle = JSON.parse(readFileSync(path, 'utf8'))
  if (bundle.schemaVersion !== SCHEMA_VERSION || bundle.helperVersion !== HELPER_VERSION) fail('Unsupported evidence bundle')
  const { integritySha256, ...unsigned } = bundle
  if (!/^sha256:[a-f0-9]{64}$/.test(integritySha256 || '') || sha256Value(unsigned) !== integritySha256) {
    fail('Evidence bundle integrity mismatch', 2)
  }
  return bundle
}

function visibleDirtyPaths(repo) {
  const commands = [
    ['diff', '--name-only', '--no-renames', '-z'],
    ['diff', '--cached', '--name-only', '--no-renames', '-z'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ]
  return [...new Set(commands.flatMap((args) => git(repo, args).split('\0').filter(Boolean)))].sort()
}

function ignoredPaths(repo) {
  return git(repo, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0')
    .filter((path) => path && !path.split('/').some((segment) => GENERATED_IGNORED_SEGMENTS.has(segment)))
}

function indexIdentity(repo) {
  return sha256Bytes(git(repo, ['ls-files', '--stage', '-v', '-z'], { encoding: null }))
}

function indexEntry(repo, path) {
  const output = git(repo, ['ls-files', '--stage', '-z', '--', path])
  const records = output.split('\0').filter(Boolean)
  if (records.length === 0) return null
  if (records.length !== 1) return { conflicted: true }
  const match = /^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/.exec(records[0])
  if (!match || match[4] !== path || match[3] !== '0') return { conflicted: true }
  return { mode: Number.parseInt(match[1], 8), objectId: match[2] }
}

function targetDiffersFromIndex(repo, path, captured) {
  const entry = indexEntry(repo, path)
  if (!entry) return captured.state.exists
  if (entry.conflicted || !captured.state.exists) return true
  if (entry.mode !== (captured.state.mode & 0o111 ? 0o100755 : 0o100644)) return true
  const indexBytes = git(repo, ['cat-file', 'blob', entry.objectId], { encoding: null })
  return !Buffer.from(indexBytes).equals(captured.bytes)
}

function hiddenTrackedPaths(repo) {
  return git(repo, ['ls-files', '-v', '-z']).split('\0').filter(Boolean).flatMap((record) => {
    const match = /^(.)(?: )([\s\S]+)$/.exec(record)
    if (!match) return []
    const [tag, path] = [match[1], match[2]]
    return tag === 'S' || tag === tag.toLowerCase() ? [path] : []
  })
}

function inventoryState(repo, path) {
  const absolute = join(repo, path)
  let metadata
  try {
    metadata = lstatSync(absolute)
  } catch (error) {
    if (error?.code === 'ENOENT') return { path, exists: false, sha256: sha256Bytes('ABSENT'), mode: null }
    throw error
  }
  if (metadata.isSymbolicLink()) {
    return { path, exists: true, sha256: sha256Value({ type: 'symlink', target: readlinkSync(absolute) }), mode: metadata.mode & 0o7777 }
  }
  if (!metadata.isFile()) {
    fail(`Unowned dirty non-regular path cannot be inventoried safely: ${path}`, 4)
  }
  if (metadata.size > MAX_FILE_BYTES) {
    // Fingerprint oversized UNOWNED files by identity rather than content.
    //
    // This branch only ever sees files the run does not own — dirty, ignored or hidden-tracked paths
    // inventoried to detect concurrent edits. Hashing them costs a full read, and hard-failing made
    // the driver unusable in any repo that keeps a large gitignored fixture: measured 2026-08-25,
    // `app/src/androidTest/assets/test_files/large_50mb.pdf` (52 MB, .gitignore:80) blocked every
    // snapshot attempt, which is why no run in this repo has ever produced an evidence bundle.
    //
    // Size + mtime + inode still change on any ordinary write, so drift detection survives. The
    // guarantee is weaker than a content hash in exactly one way: a rewrite that restores the
    // original size AND back-dates mtime would pass unnoticed. That is an adversarial edit, not the
    // concurrent-edit accident this inventory exists to catch. Owned targets are untouched by this
    // branch — captureFile still hashes every byte of the files under edit.
    return {
      path,
      exists: true,
      sha256: sha256Value({
        type: 'oversize-identity',
        size: metadata.size,
        mtimeMs: metadata.mtimeMs,
        ino: String(metadata.ino)
      }),
      mode: metadata.mode & 0o7777
    }
  }
  const bytes = readFileSync(absolute)
  const after = statSync(absolute)
  if (metadata.dev !== after.dev || metadata.ino !== after.ino || metadata.size !== after.size
    || metadata.mtimeMs !== after.mtimeMs || metadata.ctimeMs !== after.ctimeMs || metadata.mode !== after.mode) {
    fail(`DRIFT while inventorying unowned path: ${path}`, 2)
  }
  return { path, exists: true, sha256: sha256Bytes(bytes), mode: metadata.mode & 0o7777 }
}

function unownedInventory(repo, targetPaths) {
  const owned = new Set(targetPaths)
  const paths = [...new Set([...visibleDirtyPaths(repo), ...ignoredPaths(repo), ...hiddenTrackedPaths(repo)])]
    .filter((path) => !owned.has(path)).sort()
  return paths.map((path) => inventoryState(repo, path))
}

function diffNoIndex(before, after) {
  try {
    return git(process.cwd(), ['diff', '--no-index', '--no-ext-diff', '--no-textconv', '--binary', '--no-color', '--unified=80', '--', before, after], { allowDiff: true, exactDiff: true })
  } catch (error) {
    if (error.status === 1) return String(error.stdout || '')
    throw error
  }
}

function scopedDiff(before, after, beforeState, afterState, path) {
  let patch = diffNoIndex(before, after)
  if (!patch) {
    if (sameState(beforeState, afterState)) return ''
    const contentUnchanged = beforeState.exists === afterState.exists && beforeState.sha256 === afterState.sha256
      && beforeState.size === afterState.size && (beforeState.type || null) === (afterState.type || null)
    const emptyExistenceChange = beforeState.exists !== afterState.exists
      && (beforeState.exists ? beforeState.size : afterState.size) === 0
    if (!contentUnchanged && !emptyExistenceChange) fail(`Exact diff generator returned no patch for changed content: ${path}`, 2)
  }
  const lines = patch ? patch.split('\n') : []
  const normalized = []
  let inPayload = false
  for (const line of lines) {
    if (line.startsWith('@@ ') || line === 'GIT binary patch') inPayload = true
    if (!inPayload && line.startsWith('diff --git ')) normalized.push(`diff --git a/${path} b/${path}`)
    else if (!inPayload && line.startsWith('--- ')) normalized.push(beforeState.exists ? `--- a/${path}` : '--- /dev/null')
    else if (!inPayload && line.startsWith('+++ ')) normalized.push(afterState.exists ? `+++ b/${path}` : '+++ /dev/null')
    else if (!inPayload && line.startsWith('Binary files ')) normalized.push(`Binary files a/${path} and b/${path} differ`)
    else if (!inPayload && line.startsWith('index ')) {
      const withoutMode = line.replace(/ [0-7]{6}$/, '')
      normalized.push(beforeState.exists && afterState.exists && beforeState.mode === afterState.mode
        ? `${withoutMode} 100${beforeState.mode.toString(8)}` : withoutMode)
    } else if (inPayload || (!/^(old|new|deleted) mode /.test(line) && !/^new file mode /.test(line))) normalized.push(line)
  }
  if (normalized.length === 0) normalized.push(`diff --git a/${path} b/${path}`)
  if (beforeState.exists !== afterState.exists) {
    const mode = (afterState.exists ? afterState.mode : beforeState.mode) || 0o644
    normalized.splice(1, 0, `${afterState.exists ? 'new' : 'deleted'} file mode 100${mode.toString(8)}`)
  } else if (beforeState.exists && beforeState.mode !== afterState.mode) {
    normalized.splice(1, 0, `old mode 100${beforeState.mode.toString(8)}`, `new mode 100${afterState.mode.toString(8)}`)
  }
  if (!patch) {
    normalized.push(beforeState.exists ? `--- a/${path}` : '--- /dev/null')
    normalized.push(afterState.exists ? `+++ b/${path}` : '+++ /dev/null')
  }
  return `${normalized.join('\n').replace(/\n+$/, '')}\n`
}

function patchStats(patch) {
  let added = 0
  let deleted = 0
  const hunks = []
  let inHunk = false
  let sawHunk = false
  for (const line of patch.split('\n')) {
    if (!sawHunk && /^(diff --git |--- |\+\+\+ )/.test(line)) {
      inHunk = false
      continue
    }
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (match) {
      inHunk = true
      sawHunk = true
      hunks.push({ oldStart: Number(match[1]), oldCount: Number(match[2] || 1), newStart: Number(match[3]), newCount: Number(match[4] || 1) })
    } else if (inHunk && line.startsWith('+')) added += 1
    else if (inHunk && line.startsWith('-')) deleted += 1
  }
  return { added, deleted, hunks }
}

function binaryEvidenceText(path, status, beforeState, afterState) {
  const artifactSha256 = status === 'deleted' ? beforeState.sha256 : afterState.sha256
  const mode = (value) => value === null ? 'absent' : value.toString(8)
  return [
    'App binary evidence v1',
    `path ${path}`,
    `status ${status}`,
    `preimage ${beforeState.sha256} mode ${mode(beforeState.mode)}`,
    `postimage ${afterState.sha256} mode ${mode(afterState.mode)}`,
    `artifact ${artifactSha256}`,
    '',
  ].join('\n')
}

function isBinary(path) {
  if (!existsSync(path)) return false
  const bytes = readFileSync(path)
  return bytes.includes(0) || !Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes)
}

function kindFor(path, binary) {
  if (binary) return 'binary'
  if (/^app\/tester\/files\//i.test(path)
    || /^core\/testing\//i.test(path)
    || /(^|\/)src\/(?:test|androidtest|testfixtures|commontest|jvmtest)\//i.test(path)
    || /(^|\/)(?:tests?|test[-_]support|fixtures|mocks|harness|probes)(?:\/|$)/i.test(path)
    || /(?:^|[._-])(?:test|spec)\.[^/]+$/i.test(path)) return 'test'
  if (/(^|\/)androidmanifest\.xml$/i.test(path)) return 'manifest'
  if (/(^|\/)res\//i.test(path)) return 'resource'
  if (/\.kt$/i.test(path)) return 'kotlin'
  if (/\.java$/i.test(path)) return 'java'
  if (/\.xml$/i.test(path)) return 'xml'
  if (/\.(gradle|kts)$/i.test(path)) return 'gradle'
  if (/\.toml$/i.test(path)) return 'toml'
  if (/(^|\/)(proguard[^/]*|consumer-rules)\.pro$/i.test(path) || /\.pro$/i.test(path)) return 'proguard'
  if (/\.properties$/i.test(path)) return 'properties'
  if (/\.(c|cc|cpp|cxx|h|hh|hpp|hxx|s|so)$/i.test(path)) return 'native'
  if (/\.(sh|bash|zsh|py|js|mjs)$/i.test(path)) return 'script'
  return 'other_text'
}

function snapshot(flags) {
  const repoInput = flag(flags, 'repo', false) || process.cwd()
  const repo = git(repoInput, ['rev-parse', '--show-toplevel']).trim()
  const sessionId = flag(flags, 'session', false) || randomUUID()
  if (!/^[a-zA-Z0-9_.-]{8,128}$/.test(sessionId)) fail('Invalid session id')
  const pathFlags = flag(flags, 'path')
  const paths = (Array.isArray(pathFlags) ? pathFlags : [pathFlags]).map((path) => canonicalPath(repo, path))
  if (paths.length === 0 || paths.length > MAX_TARGETS) fail(`Snapshot requires 1..${MAX_TARGETS} target paths`)
  if (new Set(paths.map((path) => path.toLowerCase())).size !== paths.length) fail('Duplicate or case-colliding target path')
  const gitCommonDirRaw = git(repo, ['rev-parse', '--git-common-dir']).trim()
  const gitCommonDir = isAbsolute(gitCommonDirRaw) ? gitCommonDirRaw : resolve(repo, gitCommonDirRaw)
  const evidenceDir = join(gitCommonDir, 'codex-fix-evidence', sessionId)
  if (existsSync(evidenceDir)) fail(`Session already exists: ${sessionId}`)
  failureCleanupPath = evidenceDir
  try {
    mkdirSync(join(evidenceDir, 'baseline'), { recursive: true, mode: 0o700 })
    mkdirSync(join(evidenceDir, 'pending'), { recursive: true, mode: 0o700 })
    mkdirSync(join(evidenceDir, 'edits'), { recursive: true, mode: 0o700 })
    mkdirSync(join(evidenceDir, 'oracle-pending'), { recursive: true, mode: 0o700 })
  const headCommit = git(repo, ['rev-parse', 'HEAD']).trim()
  const indexSha256 = indexIdentity(repo)
  const initialVisibleDirtyPaths = visibleDirtyPaths(repo)
  const initialHiddenTrackedPaths = hiddenTrackedPaths(repo)
  const initialStatusSha256 = sha256Bytes(git(repo, ['status', '--porcelain=v2', '-z'], { encoding: null }))
  const targets = paths.map((path, index) => {
    const absolute = join(repo, path)
    const captured = captureFile(absolute)
    const state = captured.state
    const snapshotPath = join(evidenceDir, 'baseline', `${index}.bin`)
    writeFileSync(snapshotPath, captured.bytes)
    chmodSync(snapshotPath, 0o600)
    const preExistingDirty = initialVisibleDirtyPaths.includes(path) || initialHiddenTrackedPaths.includes(path)
      || targetDiffersFromIndex(repo, path, captured)
    return { path, baseline: state, snapshotPath, preExistingDirty, overlap: preExistingDirty ? 'ambiguous' : 'none', edits: [] }
  })
  const initialDirtyPaths = [...new Set([...initialVisibleDirtyPaths, ...targets.filter((target) => target.preExistingDirty).map((target) => target.path)])].sort()
  const initialUnownedInventory = unownedInventory(repo, paths)
  const finalHeadCommit = git(repo, ['rev-parse', 'HEAD']).trim()
  const finalIndexSha256 = indexIdentity(repo)
  const finalVisibleDirtyPaths = visibleDirtyPaths(repo)
  const finalUnownedInventory = unownedInventory(repo, paths)
  const finalStatusSha256 = sha256Bytes(git(repo, ['status', '--porcelain=v2', '-z'], { encoding: null }))
  if (headCommit !== finalHeadCommit || indexSha256 !== finalIndexSha256 || initialStatusSha256 !== finalStatusSha256
    || stableStringify(initialVisibleDirtyPaths) !== stableStringify(finalVisibleDirtyPaths)
    || stableStringify(initialUnownedInventory) !== stableStringify(finalUnownedInventory)
    || targets.some((target) => !sameState(fileState(join(repo, target.path)), target.baseline))) {
    rmSync(evidenceDir, { recursive: true, force: true })
    fail('DRIFT during snapshot ownership inventory; retry classification', 2)
  }
  const baselineContentId = sha256Value(targets
    .map((target) => ({ path: target.path, preimageSha256: target.baseline.sha256, mode: target.baseline.mode }))
    .sort((left, right) => left.path.localeCompare(right.path)))
  const bundle = {
    schemaVersion: SCHEMA_VERSION,
    helperVersion: HELPER_VERSION,
    sessionId,
    runNonce: randomUUID(),
    repo,
    startedAt: new Date().toISOString(),
    headCommit,
    indexSha256,
    initialStatusSha256,
    initialDirtyPaths,
    unownedInventorySha256: sha256Value(initialUnownedInventory),
    baselineContentId,
    targets,
    oracleCaptures: [],
  }
  const bundlePath = join(evidenceDir, 'bundle.json')
  writeBundle(bundlePath, bundle)
  failureCleanupPath = null
  process.stdout.write(`${JSON.stringify({ sessionId, runNonce: bundle.runNonce, bundlePath })}\n`)
  } catch (error) {
    rmSync(evidenceDir, { recursive: true, force: true })
    failureCleanupPath = null
    throw error
  }
}

function beginEdit(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const bundle = loadBundle(bundlePath)
  const pendingJson = readdirSync(join(dirname(bundlePath), 'pending')).filter((name) => name.endsWith('.json'))
  if (pendingJson.length > 0) fail('Finish or resolve the existing pending edit before beginning another', 3)
  const path = canonicalPath(bundle.repo, flag(flags, 'path'))
  const target = bundle.targets.find((item) => item.path === path)
  if (!target) fail(`Path is outside snapshot scope: ${path}`)
  if (target.edits.length >= MAX_EDITS_PER_TARGET) fail(`Target exceeds ${MAX_EDITS_PER_TARGET} recorded edits`, 4)
  canonicalPath(bundle.repo, path)
  const expected = target.edits.at(-1)?.post || target.baseline
  const captured = captureFile(join(bundle.repo, path))
  const actual = captured.state
  if (!sameState(actual, expected)) fail(`DRIFT before edit: ${path}`, 2)
  const expectedPostModeRaw = flag(flags, 'expected-post-mode', false)
  if (expectedPostModeRaw !== undefined && expectedPostModeRaw !== 'absent' && !/^(644|755)$/.test(expectedPostModeRaw)) fail('Invalid --expected-post-mode')
  const expectedPostMode = expectedPostModeRaw === 'absent'
    ? null
    : expectedPostModeRaw === undefined ? (actual.mode ?? 0o644) : Number.parseInt(expectedPostModeRaw, 8)
  if (!(expectedPostMode === null || expectedPostMode === 0o644 || expectedPostMode === 0o755)) fail('Invalid --expected-post-mode')
  if (expectedPostMode === null && flag(flags, 'expected-post-sha256', false) !== undefined) fail('Deletion must not provide --expected-post-sha256')
  const expectedPostSha256 = expectedPostMode === null ? sha256Bytes('ABSENT') : flag(flags, 'expected-post-sha256')
  if (!/^sha256:[a-f0-9]{64}$/.test(expectedPostSha256)) fail('Invalid --expected-post-sha256')
  const editId = randomUUID()
  const preimagePath = join(dirname(bundlePath), 'pending', `${editId}.pre`)
  writeFileSync(preimagePath, captured.bytes)
  chmodSync(preimagePath, 0o600)
  writeSealedJson(join(dirname(bundlePath), 'pending', `${editId}.json`), {
    editId, path, preimagePath, pre: actual, expectedPostSha256, expectedPostMode, startedAt: new Date().toISOString(),
  })
  process.stdout.write(`${JSON.stringify({ editId, path, preimageSha256: actual.sha256 })}\n`)
}

function finishEdit(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const editId = flag(flags, 'edit-id')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(editId)) fail('Invalid edit id')
  const bundle = loadBundle(bundlePath)
  const pendingPath = join(dirname(bundlePath), 'pending', `${editId}.json`)
  if (!existsSync(pendingPath)) fail(`Unknown pending edit: ${editId}`)
  const pending = readSealedJson(pendingPath, 'Pending edit')
  canonicalPath(bundle.repo, pending.path)
  const target = bundle.targets.find((item) => item.path === pending.path)
  if (!target) fail('Pending edit path is outside bundle')
  const expectedPre = target.edits.at(-1)?.post || target.baseline
  if (!sameState(pending.pre, expectedPre)) fail(`DRIFT in edit chain: ${pending.path}`, 2)
  const pendingBytes = readFileSync(pending.preimagePath)
  if (!capturedBytesMatchState(pendingBytes, pending.pre)) fail(`Pending preimage integrity mismatch: ${pending.path}`, 2)
  const currentPath = join(bundle.repo, pending.path)
  const capturedPost = captureFile(currentPath)
  const post = capturedPost.state
  if (post.sha256 !== pending.expectedPostSha256 || post.mode !== pending.expectedPostMode) {
    fail(`DRIFT in edit window: ${pending.path}; actual postimage does not match predeclared task result`, 2)
  }
  const postimagePath = join(dirname(bundlePath), 'edits', `${editId}.post`)
  writeFileSync(postimagePath, capturedPost.bytes, { mode: 0o600 })
  const diffTarget = post.exists ? postimagePath : '/dev/null'
  const patch = scopedDiff(pending.preimagePath, diffTarget, pending.pre, post, pending.path)
  if (!patch) fail(`No content delta recorded for edit: ${pending.path}`)
  if (Buffer.byteLength(patch) > MAX_PATCH_BYTES) fail(`Exact patch exceeds ${MAX_PATCH_BYTES} byte workflow limit: ${pending.path}`, 4)
  const patchPath = join(dirname(bundlePath), 'edits', `${editId}.patch`)
  writeFileSync(patchPath, patch, { mode: 0o600 })
  const edit = { editId, path: pending.path, pre: pending.pre, post, patchPath, patchSha256: sha256Bytes(patch), ...patchStats(patch), startedAt: pending.startedAt, finishedAt: new Date().toISOString() }
  target.edits.push(edit)
  for (const scopedTarget of bundle.targets) {
    delete scopedTarget.manualReview
    delete scopedTarget.overlapApproval
    if (scopedTarget.preExistingDirty) scopedTarget.overlap = 'ambiguous'
  }
  writeBundle(bundlePath, bundle)
  rmSync(pendingPath)
  rmSync(pending.preimagePath)
  rmSync(postimagePath)
  process.stdout.write(`${JSON.stringify(edit)}\n`)
}

function captureCurrentScopeStates(bundle) {
  return bundle.targets.map((target) => {
    const expected = target.edits.at(-1)?.post || target.baseline
    const captured = captureFile(join(bundle.repo, target.path))
    const actual = captured.state
    if (!sameState(actual, expected)) fail(`DRIFT in scoped state before oracle: ${target.path}`, 2)
    return {
      path: target.path,
      postimageSha256: actual.sha256,
      mode: actual.mode,
      observationToken: captured.observationToken,
    }
  }).sort(compareCanonicalPathItems)
}

function scopeContentIdOf(states) {
  return sha256Value(states.map(({ path, postimageSha256, mode }) => ({ path, postimageSha256, mode })))
}

function captureOracleSourceStates(bundle, paths) {
  return paths.map((path) => {
    canonicalPath(bundle.repo, path)
    const captured = captureFile(join(bundle.repo, path))
    const state = captured.state
    return { path, sha256: state.sha256, mode: state.mode, observationToken: captured.observationToken }
  }).sort(compareCanonicalPathItems)
}

function beginOracle(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const bundle = loadBundle(bundlePath)
  const oracleId = flag(flags, 'oracle-id')
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(oracleId)) fail('Invalid oracle id')
  const captures = Array.isArray(bundle.oracleCaptures) ? bundle.oracleCaptures : []
  if (captures.length >= MAX_ORACLE_CAPTURES) fail(`Bundle exceeds ${MAX_ORACLE_CAPTURES} oracle captures`, 4)
  if (captures.some((capture) => capture.oracleId === oracleId)) fail(`Duplicate oracle id: ${oracleId}`)
  const pendingPath = join(dirname(bundlePath), 'oracle-pending', `${oracleId}.json`)
  if (existsSync(pendingPath)) fail(`Oracle capture already pending: ${oracleId}`)
  const pathFlags = flag(flags, 'path')
  const paths = (Array.isArray(pathFlags) ? pathFlags : [pathFlags]).map((path) => canonicalPath(bundle.repo, path))
  if (paths.length === 0 || paths.length > MAX_TARGETS) fail(`Oracle capture requires 1..${MAX_TARGETS} source paths`)
  if (new Set(paths.map((path) => path.toLowerCase())).size !== paths.length) fail('Duplicate or case-colliding oracle source path')
  const startedAt = new Date().toISOString()
  const sourceStates = captureOracleSourceStates(bundle, paths)
  const scopeStates = captureCurrentScopeStates(bundle)
  const scopeContentId = scopeContentIdOf(scopeStates)
  writeSealedJson(pendingPath, {
    oracleId,
    startedAt,
    sourceStates,
    sourceHash: sha256Value(sourceStates),
    scopeStates,
    scopeContentId,
  })
  process.stdout.write(`${JSON.stringify({ oracleId, startedAt, sourceHash: sha256Value(sourceStates), scopeContentId })}\n`)
}

function finishOracle(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const bundle = loadBundle(bundlePath)
  const oracleId = flag(flags, 'oracle-id')
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(oracleId)) fail('Invalid oracle id')
  const pendingPath = join(dirname(bundlePath), 'oracle-pending', `${oracleId}.json`)
  if (!existsSync(pendingPath)) fail(`Unknown pending oracle capture: ${oracleId}`)
  const pending = readSealedJson(pendingPath, 'Pending oracle capture')
  const paths = pending.sourceStates.map((state) => state.path)
  const sourceStates = captureOracleSourceStates(bundle, paths)
  const scopeStates = captureCurrentScopeStates(bundle)
  const scopeContentId = scopeContentIdOf(scopeStates)
  if (stableStringify(sourceStates) !== stableStringify(pending.sourceStates)
    || stableStringify(scopeStates) !== stableStringify(pending.scopeStates)
    || scopeContentId !== pending.scopeContentId) {
    rmSync(pendingPath)
    fail(`DRIFT during oracle execution window: ${oracleId}`, 2)
  }
  const capture = {
    oracleId,
    source: 'artifact-driver',
    startedAt: pending.startedAt,
    finishedAt: new Date().toISOString(),
    sourceStates,
    sourceHash: pending.sourceHash,
    scopeStates,
    scopeContentId,
  }
  bundle.oracleCaptures = [...(bundle.oracleCaptures || []), capture]
  writeBundle(bundlePath, bundle)
  rmSync(pendingPath)
  process.stdout.write(`${JSON.stringify({
    oracleId,
    artifactId: `oracle-source-${oracleId}`,
    sourceHash: capture.sourceHash,
    scopeContentId,
    startedAt: capture.startedAt,
    finishedAt: capture.finishedAt,
  })}\n`)
}

function boundedReason(flags) {
  const reason = flag(flags, 'reason').trim()
  if (reason.length === 0 || reason.length > MAX_REASON_CHARS || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(reason)) fail(`Reason must contain 1..${MAX_REASON_CHARS} safe characters`)
  return reason
}

function approvalBinding(bundle, target) {
  const last = target.edits.at(-1)
  if (!last) fail(`Approval requires a completed edit: ${target.path}`, 3)
  const current = fileState(join(bundle.repo, target.path))
  if (!sameState(current, last.post)) fail(`DRIFT before approval: ${target.path}`, 2)
  const patchBytes = readFileSync(last.patchPath)
  if (sha256Bytes(patchBytes) !== last.patchSha256) fail(`Recorded edit patch integrity mismatch: ${target.path}`, 2)
  return { editId: last.editId, postimageSha256: last.post.sha256, postimageMode: last.post.mode, patchSha256: last.patchSha256 }
}

function approvalMatchesLastEdit(approval, target) {
  const last = target.edits.at(-1)
  if (!approval || !last) return false
  return stableStringify(approval.binding) === stableStringify({
    editId: last.editId,
    postimageSha256: last.post.sha256,
    postimageMode: last.post.mode,
    patchSha256: last.patchSha256,
  })
}

function approveOverlap(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const bundle = loadBundle(bundlePath)
  const path = canonicalPath(bundle.repo, flag(flags, 'path'))
  const reason = boundedReason(flags)
  const target = bundle.targets.find((item) => item.path === path)
  if (!target || !target.preExistingDirty) fail('Only a pre-existing dirty target can require overlap approval')
  target.overlap = 'approved'
  target.overlapApproval = { reason, approvedAt: new Date().toISOString(), binding: approvalBinding(bundle, target) }
  writeBundle(bundlePath, bundle)
  process.stdout.write(`${JSON.stringify({ path, overlap: target.overlap })}\n`)
}

function approveManual(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const bundle = loadBundle(bundlePath)
  const path = canonicalPath(bundle.repo, flag(flags, 'path'))
  const reason = boundedReason(flags)
  const target = bundle.targets.find((item) => item.path === path)
  if (!target) fail(`Path is outside snapshot scope: ${path}`)
  target.manualReview = { reason, approvedAt: new Date().toISOString(), binding: approvalBinding(bundle, target) }
  writeBundle(bundlePath, bundle)
  process.stdout.write(`${JSON.stringify({ path, manualReview: 'approved' })}\n`)
}

function recordAuditState(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const statePath = resolve(flag(flags, 'state-file'))
  const bundle = loadBundle(bundlePath)
  const metadata = lstatSync(statePath)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_AUDIT_STATE_BYTES) {
    fail('Audit state input is not a bounded regular file', 2)
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    fail('Audit state input is not valid JSON', 2)
  }
  const state = parsed?.nextAuditState
  const stateEntries = state?.nextLedger?.entries
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.schemaVersion !== 3
    || !['CLEAR', 'CONVERGING', 'RESIDUALS', 'INCOMPLETE', 'ESCALATE'].includes(parsed.auditVerdict)
    || !state || typeof state !== 'object' || Array.isArray(state)
    || parsed.sweepIndex !== state.sweepIndex || parsed.scopeFingerprint !== state.scopeFingerprint
    || stableStringify(parsed.nextLedger) !== stableStringify(state.nextLedger)
    || stableStringify(parsed.nextClassHistory) !== stableStringify(state.nextClassHistory)
    || stableStringify(parsed.nextBudgetHistory) !== stableStringify(state.nextBudgetHistory)
    || !Number.isSafeInteger(state.sweepIndex) || state.sweepIndex < 0
    || !/^sha256:[a-f0-9]{64}$/.test(state.digest || '') || auditStateDigest(state) !== state.digest
    || state.runId !== bundle.sessionId || state.runNonce !== bundle.runNonce
    || !bundle.lastVerifiedScope || state.scopeFingerprint !== bundle.lastVerifiedScope.scopeFingerprint
    || state.currentId !== bundle.lastVerifiedScope.currentId
    || !state.nextLedger || !Array.isArray(stateEntries)
    || stateEntries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.key !== 'string' || entry.key.length === 0
      || !['open', 'fixed', 'deferred', 'rejected', 'blocked'].includes(entry.status))
    || new Set(stateEntries.map((entry) => entry.key)).size !== stateEntries.length
    || !Array.isArray(state.nextClassHistory) || state.nextClassHistory.length !== state.sweepIndex + 1
    || !Array.isArray(state.nextBudgetHistory) || state.nextBudgetHistory.length !== state.sweepIndex + 1
    || state.nextBudgetHistory.some((value, index, values) => !Number.isInteger(value) || value < 0 || (index > 0 && value < values[index - 1]))) {
    fail('Audit state is malformed, stale, or not bound to the last verified scope', 2)
  }
  const priorState = bundle.priorAuditState || null
  if (parsed.priorAuditStateDigest !== (priorState?.digest || null)) {
    fail('Workflow output priorAuditStateDigest does not match the sealed bundle state', 2)
  }
  if (priorState && state.sweepIndex !== priorState.sweepIndex + 1) {
    fail('Audit state must advance exactly one sweep; rewind, replay, and skipped sweeps are rejected', 2)
  }
  if (!priorState && state.sweepIndex !== 0) fail('First recorded audit state must be sweep 0', 2)
  if (priorState) {
    if (stableStringify(state.nextClassHistory.slice(0, -1)) !== stableStringify(priorState.nextClassHistory)
      || stableStringify(state.nextBudgetHistory.slice(0, -1)) !== stableStringify(priorState.nextBudgetHistory)) {
      fail('Audit state history continuity mismatch', 2)
    }
    const currentByKey = new Map(stateEntries.map((entry) => [entry.key, entry]))
    const allowedTransitions = {
      open: new Set(['open', 'fixed', 'deferred', 'rejected', 'blocked']),
      fixed: new Set(['fixed']),
      deferred: new Set(['open', 'fixed', 'deferred', 'blocked']),
      rejected: new Set(['rejected', 'open']),
      blocked: new Set(['open', 'fixed', 'deferred', 'blocked']),
    }
    for (const priorEntry of priorState.nextLedger.entries) {
      const currentEntry = currentByKey.get(priorEntry.key)
      if (!currentEntry) fail(`Audit state ledger continuity lost prior key: ${priorEntry.key}`, 2)
      if (!allowedTransitions[priorEntry.status]?.has(currentEntry.status)
        || (priorEntry.status === 'rejected' && currentEntry.status === 'open'
          && (currentEntry.reopenedFrom !== 'rejected' || typeof currentEntry.reason !== 'string' || currentEntry.reason.length === 0))) {
        fail(`Invalid audit state transition ${priorEntry.status}->${currentEntry.status} for ${priorEntry.key}`, 2)
      }
    }
  }
  bundle.priorAuditState = state
  const { integritySha256: _priorIntegrity, ...unsignedBundle } = bundle
  const prospectiveBundle = { ...unsignedBundle, integritySha256: `sha256:${'0'.repeat(64)}` }
  if (Buffer.byteLength(`${JSON.stringify(prospectiveBundle, null, 2)}\n`) > MAX_BUNDLE_BYTES) {
    fail(`Recorded audit state would exceed the ${MAX_BUNDLE_BYTES} byte bundle limit`, 4)
  }
  writeBundle(bundlePath, bundle)
  process.stdout.write(`${JSON.stringify({ recordedSweepIndex: state.sweepIndex, digest: state.digest })}\n`)
}

function verifyBundle(flags) {
  const bundlePath = resolve(flag(flags, 'bundle'))
  const bundle = loadBundle(bundlePath)
  if (git(bundle.repo, ['rev-parse', 'HEAD']).trim() !== bundle.headCommit) fail('DRIFT: HEAD changed', 2)
  if (indexIdentity(bundle.repo) !== bundle.indexSha256) fail('DRIFT: index changed', 2)
  if (sha256Value(unownedInventory(bundle.repo, bundle.targets.map((target) => target.path))) !== bundle.unownedInventorySha256) {
    fail('DRIFT: worktree changed outside snapshot scope', 2)
  }
  const artifacts = []
  const changes = []
  let totalPatchBytes = 0
  let totalBinaryBytes = 0
  for (const [index, target] of bundle.targets.entries()) {
    canonicalPath(bundle.repo, target.path)
    if (target.edits.length === 0) fail(`Target has no recorded edit: ${target.path}`)
    if (target.preExistingDirty && (target.overlap !== 'approved' || !target.overlapApproval?.reason
      || !target.overlapApproval.approvedAt || !approvalMatchesLastEdit(target.overlapApproval, target))) {
      fail(`Ambiguous pre-existing dirty overlap: ${target.path}`, 3)
    }
    const baselineBytes = readFileSync(target.snapshotPath)
    if (!capturedBytesMatchState(baselineBytes, target.baseline)) fail(`Baseline snapshot integrity mismatch: ${target.path}`, 2)
    for (const edit of target.edits) {
      const editPatch = readFileSync(edit.patchPath)
      if (sha256Bytes(editPatch) !== edit.patchSha256) fail(`Recorded edit patch integrity mismatch: ${target.path}`, 2)
    }
    const currentPath = join(bundle.repo, target.path)
    const capturedCurrent = captureFile(currentPath)
    const current = capturedCurrent.state
    const last = target.edits.at(-1)
    if (!sameState(current, last.post)) fail(`DRIFT after recorded edit: ${target.path}`, 2)
    for (let editIndex = 1; editIndex < target.edits.length; editIndex += 1) {
      if (!sameState(target.edits[editIndex - 1].post, target.edits[editIndex].pre)) fail(`Broken edit chain: ${target.path}`, 2)
    }
    const verifySnapshotPath = join(dirname(bundlePath), 'edits', `verify-${index}.post`)
    writeFileSync(verifySnapshotPath, capturedCurrent.bytes, { mode: 0o600 })
    const diffTarget = current.exists ? verifySnapshotPath : '/dev/null'
    const binary = isBinary(target.snapshotPath) || isBinary(verifySnapshotPath)
    const status = !target.baseline.exists && current.exists ? 'added' : target.baseline.exists && !current.exists ? 'deleted' : 'modified'
    let patch = scopedDiff(target.snapshotPath, diffTarget, target.baseline, current, target.path)
    if (!patch) fail(`Target has no task-owned content delta: ${target.path}`)
    if (binary) patch = binaryEvidenceText(target.path, status, target.baseline, current)
    const stats = patchStats(patch)
    rmSync(verifySnapshotPath)
    if (binary && (!target.manualReview?.reason || !target.manualReview.approvedAt || !approvalMatchesLastEdit(target.manualReview, target))) {
      fail(`Binary target requires explicit manual review bound to final postimage: ${target.path}`, 3)
    }
    const artifactId = `patch-${index}`
    const patchSha256 = sha256Bytes(patch)
    totalPatchBytes += Buffer.byteLength(patch)
    if (totalPatchBytes > MAX_TOTAL_PATCH_BYTES) fail(`Exact patches exceed ${MAX_TOTAL_PATCH_BYTES} byte aggregate workflow limit`, 4)
    artifacts.push({
      id: artifactId,
      mediaType: binary ? 'application/vnd.exampleapp.binary-evidence' : 'text/x-diff',
      encoding: 'base64', payload: Buffer.from(patch).toString('base64'), byteLength: Buffer.byteLength(patch), sha256: patchSha256,
    })
    const binaryArtifactId = binary ? `binary-${index}` : undefined
    const binaryBaselineArtifactId = binary && status === 'modified' ? `binary-baseline-${index}` : undefined
    if (binary) {
      const exactBinaryBytes = current.exists ? capturedCurrent.bytes : baselineBytes
      const baselineBinaryBytes = binaryBaselineArtifactId ? baselineBytes : Buffer.alloc(0)
      totalBinaryBytes += exactBinaryBytes.length + baselineBinaryBytes.length
      if (totalBinaryBytes > MAX_TOTAL_BINARY_BYTES) fail(`Exact binary payloads exceed ${MAX_TOTAL_BINARY_BYTES} byte aggregate workflow limit`, 4)
      if (binaryBaselineArtifactId) {
        artifacts.push({
          id: binaryBaselineArtifactId, mediaType: 'application/octet-stream', encoding: 'base64',
          payload: baselineBinaryBytes.toString('base64'), byteLength: baselineBinaryBytes.length, sha256: sha256Bytes(baselineBinaryBytes),
        })
      }
      artifacts.push({
        id: binaryArtifactId, mediaType: 'application/octet-stream', encoding: 'base64',
        payload: exactBinaryBytes.toString('base64'), byteLength: exactBinaryBytes.length, sha256: sha256Bytes(exactBinaryBytes),
      })
    }
    const approvalDigest = target.preExistingDirty || binary
      ? sha256Value({ path: target.path, postimageSha256: current.sha256, postimageMode: current.mode, overlapApproval: target.overlapApproval || null, manualReview: target.manualReview || null })
      : undefined
    changes.push({
      id: `change-${index}`, path: target.path, kind: kindFor(target.path, binary),
      status,
      ownership: 'task', added: stats.added, deleted: stats.deleted, patchHash: patchSha256, patchArtifactId: artifactId,
      preimageSha256: target.baseline.sha256, postimageSha256: current.sha256, overlap: target.overlap,
      preimageMode: target.baseline.mode, postimageMode: current.mode,
      firstEditStartedAt: target.edits.map((edit) => edit.startedAt).sort()[0],
      lastEditFinishedAt: target.edits.map((edit) => edit.finishedAt).sort().at(-1),
      overlapsPreExisting: target.preExistingDirty,
      ...(binaryArtifactId ? { binaryArtifactId } : {}),
      ...(binaryBaselineArtifactId ? { binaryBaselineArtifactId } : {}),
      ...(approvalDigest ? { approvalDigest } : {}),
      ...(target.preExistingDirty || binary ? { manualReviewReceiptId: `manual-change-${index}` } : {}),
    })
  }
  const currentId = sha256Value(changes
    .map((change) => ({ path: change.path, postimageSha256: change.postimageSha256, mode: change.postimageMode }))
    .sort(compareCanonicalPathItems))
  const scopeFingerprint = sha256Value({ sessionId: bundle.sessionId, headCommit: bundle.headCommit, paths: changes.map((change) => change.path) })
  const canonicalChanges = changes.map((change) => ({
    id: change.id, path: change.path.toLowerCase(), previousPath: change.previousPath ? change.previousPath.toLowerCase() : null, kind: change.kind, status: change.status,
    added: change.added, deleted: change.deleted, patchHash: change.patchHash, patchArtifactId: change.patchArtifactId,
    preimageSha256: change.preimageSha256, postimageSha256: change.postimageSha256, overlap: change.overlap,
    preimageMode: change.preimageMode, postimageMode: change.postimageMode,
    firstEditStartedAt: change.firstEditStartedAt, lastEditFinishedAt: change.lastEditFinishedAt,
    overlapsPreExisting: change.overlapsPreExisting, manualReviewReceiptId: change.manualReviewReceiptId || null,
    approvalDigest: change.approvalDigest || null, binaryArtifactId: change.binaryArtifactId || null,
    binaryBaselineArtifactId: change.binaryBaselineArtifactId || null,
  })).sort((left, right) => left.id.localeCompare(right.id))
  const contentHash = sha256Value({ currentId, changes: canonicalChanges })
  const generatedAt = new Date().toISOString()
  const firstEditStartedAt = bundle.targets.flatMap((target) => target.edits.map((edit) => edit.startedAt)).sort()[0]
  const lastEditFinishedAt = bundle.targets.flatMap((target) => target.edits.map((edit) => edit.finishedAt)).sort().at(-1)
  if (!firstEditStartedAt) fail('Evidence bundle has no edit start timestamp')
  if (!lastEditFinishedAt) fail('Evidence bundle has no edit finish timestamp')
  const manifestReceiptId = `manifest-${bundle.sessionId}`
  const diffLines = changes.reduce((sum, change) => sum + change.added + change.deleted, 0)
  bundle.maxBudgetDiffLines = Math.max(bundle.maxBudgetDiffLines || 0, diffLines)
  bundle.lastVerifiedScope = { scopeFingerprint, currentId }
  const priorAuditStateDigest = bundle.priorAuditState?.digest || null
  const scopeManifest = {
    baselineId: bundle.headCommit, baselineContentId: bundle.baselineContentId, currentId, scopeFingerprint, source: 'artifact-driver', generatedAt, firstEditStartedAt, lastEditFinishedAt, contentHash,
    priorAuditStateDigest,
    manifestReceiptId, ownedPaths: changes.map((change) => change.path), preExistingDirtyPaths: bundle.initialDirtyPaths,
    changes, diffLines, budgetDiffLines: bundle.maxBudgetDiffLines,
  }
  for (const capture of bundle.oracleCaptures || []) {
    artifacts.push(jsonArtifact(
      `oracle-source-${capture.oracleId}`,
      'application/vnd.exampleapp.oracle-source+json',
      capture,
    ))
  }
  const manifestReceipt = {
    id: manifestReceiptId, key: `scope-manifest:${scopeFingerprint}:${currentId}`, scopeFingerprint, currentId, contentHash, contentPhase: 'post',
    status: 'verified', source: 'artifact-driver', kind: 'scope-manifest', outcome: 'reviewed', executedAt: generatedAt,
    evidenceRef: bundlePath, runId: bundle.sessionId, runNonce: bundle.runNonce, priorAuditStateDigest,
  }
  const manualReceipts = changes.filter((change) => change.manualReviewReceiptId).map((change) => {
    const target = bundle.targets.find((item) => item.path === change.path)
    const approvalTimes = [target.overlapApproval?.approvedAt, target.manualReview?.approvedAt].filter(Boolean).sort()
    return {
      id: change.manualReviewReceiptId, key: `scope:${change.id}`, scopeFingerprint, currentId, contentHash, contentPhase: 'post', approvalDigest: change.approvalDigest,
      status: 'verified', source: 'artifact-driver', kind: 'manual-review', outcome: 'reviewed', executedAt: approvalTimes.at(-1),
      evidenceRef: bundlePath, runId: bundle.sessionId, runNonce: bundle.runNonce,
    }
  })
  for (const target of bundle.targets) {
    const finalState = fileState(join(bundle.repo, target.path))
    if (!sameState(finalState, target.edits.at(-1).post)) fail(`DRIFT during bundle verification: ${target.path}`, 2)
  }
  if (sha256Value(unownedInventory(bundle.repo, bundle.targets.map((target) => target.path))) !== bundle.unownedInventorySha256) {
    fail('DRIFT during bundle verification outside snapshot scope', 2)
  }
  writeBundle(bundlePath, bundle)
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 3, runId: bundle.sessionId, runNonce: bundle.runNonce, runStartedAt: bundle.startedAt,
    scopeManifest, artifacts, verificationReceipts: [manifestReceipt, ...manualReceipts], priorAuditState: bundle.priorAuditState || null,
    concurrencyWindow: 'optimistic-unattested',
    trustBoundary: 'Tool-generated optimistic-concurrency evidence; does not attest malicious writers or model cognition.',
  }, null, 2)}\n`)
}

const { positional, flags } = parseCli(process.argv.slice(2))
const command = positional[0]
if (command === 'snapshot') snapshot(flags)
else if (command === 'begin-edit') beginEdit(flags)
else if (command === 'finish-edit') finishEdit(flags)
else if (command === 'begin-oracle') beginOracle(flags)
else if (command === 'finish-oracle') finishOracle(flags)
else if (command === 'approve-overlap') approveOverlap(flags)
else if (command === 'approve-manual') approveManual(flags)
else if (command === 'record-audit-state') recordAuditState(flags)
else if (command === 'verify-bundle') verifyBundle(flags)
else fail('Usage: fix-evidence-driver.mjs snapshot|begin-edit|finish-edit|begin-oracle|finish-oracle|approve-overlap|approve-manual|record-audit-state|verify-bundle ...')
