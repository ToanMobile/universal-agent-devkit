#!/usr/bin/env node
/**
 * collect-diff.mjs — phần CƠ HỌC của qa-review: lấy diff, đếm, phân loại theo path.
 * Không cố "hiểu" code — việc đó để Claude làm theo references/.
 *
 *   node collect-diff.mjs                 # working tree so với base branch
 *   node collect-diff.mjs --staged        # chỉ phần đã staged
 *   node collect-diff.mjs --pr 123        # diff của PR (cần gh CLI đã auth)
 *   node collect-diff.mjs --base develop  # ép base branch
 *   node collect-diff.mjs --max-lines 500 # ngưỡng cắt diff (mặc định 2000)
 *
 * Output: JSON ra stdout. Mọi log/cảnh báo ra stderr để pipe được.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const MAX_DIFF_LINES_DEFAULT = 2000;

/** Mức rủi ro dùng để ưu tiên khi phải cắt diff. Cao hơn = giữ lại trước. */
const CATEGORY_RISK = { schema: 5, auth: 5, api: 4, deps: 3, config: 3, ui: 2, test: 1, tooling: 0, docs: 0, other: 1 };

/** Thứ tự có ý nghĩa: khớp trước thì thắng. schema/auth đứng trước ui vì blast radius lớn hơn. */
const CATEGORY_RULES = [
  // Đứng đầu: file của chính bộ công cụ agent, không phải thay đổi tính năng.
  // Ngay sau khi cài skill, cả cây .claude/ hiện ra trong diff — gom lại một chỗ,
  // xếp rủi ro thấp nhất để nó nằm cuối danh sách thay vì lẫn vào code thật.
  { category: 'tooling', re: /(^|\/)\.claude\// },
  { category: 'schema', re: /(^|\/)(migrations?|migrate)\//i },
  { category: 'schema', re: /(schema\.prisma|schema\.sql|\.migration\.|models?\/.*\.(ts|js|py|go|rb)$)/i },
  { category: 'auth',   re: /(^|\/)(auth|authn|authz|permissions?|roles?|guards?|policies|rbac)(\/|[.-])/i },
  { category: 'deps',   re: /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|package\.json|go\.(mod|sum)|requirements\.txt|poetry\.lock|Gemfile\.lock|Cargo\.(toml|lock))$/i },
  { category: 'test',   re: /(\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__|e2e|cypress|playwright)\/)/i },
  { category: 'api',    re: /(^|\/)(routes?|controllers?|handlers?|endpoints?|resolvers?|api)(\/|[.-])|(\/route\.[cm]?[jt]s$)/i },
  { category: 'ui',     re: /\.(tsx|jsx|vue|svelte)$/i },
  { category: 'ui',     re: /\.(css|scss|sass|less|styl)$/i },
  { category: 'config', re: /(\.env\.example|\.github\/workflows\/|Dockerfile|docker-compose|\.(yml|yaml|toml|ini)$|(^|\/)(config|configs)\/)/i },
  { category: 'docs',   re: /(\.mdx?$|(^|\/)docs?\/)/i },
];

/**
 * Nơi ghi report, lấy từ qa.config.json qua config-loader dùng chung của qa-visual.
 * Hai skill ship theo cặp nên đường dẫn tương đối này đúng ở cả repo nguồn lẫn
 * .claude/skills/ của project đích. Không có config / config sai → trả null, không chặn.
 */
async function resolveReportDir(cwd) {
  try {
    const { loadConfig } = await import('../../qa-visual/scripts/config-loader.mjs');
    return path.join(cwd, loadConfig(cwd).output.reportDir);
  } catch {
    return null;
  }
}

function classify(filePath) {
  for (const rule of CATEGORY_RULES) if (rule.re.test(filePath)) return rule.category;
  return 'other';
}

// stdio: bắt stderr của subprocess vào buffer, KHÔNG cho lọt ra stderr của mình —
// gh/git hay in cảnh báo vô hại ("no git remotes found") làm nhiễu output thật.
function run(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryRun(cmd, args) {
  try {
    return run(cmd, args);
  } catch {
    return null;
  }
}

/** Như tryRun nhưng vẫn lấy stdout khi exit code khác 0 — `git diff --no-index` luôn exit 1 khi có khác biệt. */
function runAllowFail(cmd, args) {
  try {
    return run(cmd, args);
  } catch (e) {
    return typeof e.stdout === 'string' ? e.stdout : null;
  }
}

function parseArgs(argv) {
  const opts = { mode: 'worktree', pr: null, base: null, maxLines: MAX_DIFF_LINES_DEFAULT };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--staged': opts.mode = 'staged'; break;
      case '--pr': opts.mode = 'pr'; opts.pr = argv[++i]; break;
      case '--base': opts.base = argv[++i]; break;
      case '--max-lines': opts.maxLines = Number(argv[++i]); break;
      case '-h': case '--help': opts.help = true; break;
      default: throw new Error(`Tham số lạ: ${argv[i]}`);
    }
  }
  if (opts.mode === 'pr' && !opts.pr) throw new Error('--pr cần số PR');
  if (!Number.isFinite(opts.maxLines) || opts.maxLines <= 0) throw new Error('--max-lines phải là số dương');
  return opts;
}

/** Base branch: --base > nhánh mặc định trên remote > origin/HEAD > main/master còn tồn tại. */
function resolveBase(explicit) {
  if (explicit) return explicit;
  const fromGh = tryRun('gh', ['repo', 'view', '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name']);
  if (fromGh) return fromGh;
  const originHead = tryRun('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (originHead) return originHead.replace(/^origin\//, '');
  for (const candidate of ['main', 'master']) {
    if (tryRun('git', ['rev-parse', '--verify', '--quiet', candidate])) return candidate;
  }
  return null;
}

/** Ref để so sánh: ưu tiên origin/<base>, lùi về <base> local, lùi nữa về HEAD (repo chưa có base). */
function resolveBaseRef(base) {
  if (!base) return null;
  if (tryRun('git', ['rev-parse', '--verify', '--quiet', `origin/${base}`])) return `origin/${base}`;
  if (tryRun('git', ['rev-parse', '--verify', '--quiet', base])) return base;
  return null;
}

/** `git diff --numstat` → [{path, additions, deletions}]. Bỏ qua dòng binary (`-\t-`). */
function parseNumstat(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [add, del, ...rest] = line.split('\t');
    const filePath = rest.join('\t');
    const binary = add === '-' || del === '-';
    out.push({
      path: filePath,
      additions: binary ? 0 : Number(add),
      deletions: binary ? 0 : Number(del),
      binary,
    });
  }
  return out;
}

function statusMap(raw) {
  const map = new Map();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [code, ...rest] = line.split('\t');
    map.set(rest[rest.length - 1], code[0]); // A|M|D|R...
  }
  return map;
}

/**
 * Parse `gh pr diff` (unified diff thuần) — gh không cho numstat trực tiếp.
 *
 * Chỉ đếm dòng BÊN TRONG hunk (sau `@@`). Đếm theo tiền tố +/- trên toàn file là sai:
 * dòng nội dung `+++ foo` hay `--- bar` (hay gặp trong markdown, docs chứa diff) sẽ bị
 * nhầm là header và bỏ qua. Trong hunk thì tiền tố luôn đúng 1 ký tự nên không nhập nhằng.
 */
export function parseUnifiedDiff(diff) {
  const files = new Map();
  let current = null;
  let inHunk = false;

  for (const line of diff.split('\n')) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      current = { path: header[2], oldPath: header[1], additions: 0, deletions: 0, binary: false, status: 'M' };
      files.set(current.path, current);
      inHunk = false;
      continue;
    }
    if (!current) continue;

    if (!inHunk) {
      if (line.startsWith('@@')) inHunk = true;
      else if (line.startsWith('new file mode')) current.status = 'A';
      else if (line.startsWith('deleted file mode')) current.status = 'D';
      else if (line.startsWith('rename from') || line.startsWith('rename to')) current.status = 'R';
      else if (line.startsWith('copy from') || line.startsWith('copy to')) current.status = 'C';
      else if (line.startsWith('Binary files')) current.binary = true;
      continue;
    }

    // Trong hunk: '\' là dòng "No newline at end of file", không tính.
    if (line.startsWith('+')) current.additions += 1;
    else if (line.startsWith('-')) current.deletions += 1;
    else if (line.startsWith('diff ')) inHunk = false;
  }

  for (const f of files.values()) delete f.oldPath;
  return [...files.values()];
}

function collect(opts) {
  const base = opts.mode === 'pr' ? null : resolveBase(opts.base);

  if (opts.mode === 'pr') {
    const diff = run('gh', ['pr', 'diff', String(opts.pr)]);
    const meta = tryRun('gh', ['pr', 'view', String(opts.pr), '--json', 'baseRefName,headRefName,title', '-q',
      '[.baseRefName,.headRefName,.title] | @tsv']);
    const [baseRef, headRef, title] = (meta ?? '\t\t').split('\t');
    return { files: parseUnifiedDiff(diff), base: baseRef || null, head: headRef || null, title: title || null, diff };
  }

  let scope;
  let baseRef = null;
  if (opts.mode === 'staged') {
    scope = ['--staged'];
  } else {
    baseRef = resolveBaseRef(base);
    // So từ MERGE-BASE tới working tree (không phải `base...HEAD`), để gộp cả commit
    // trên nhánh lẫn thay đổi chưa commit — dev thường chạy qa-review khi còn đang sửa dở.
    const mergeBase = baseRef ? tryRun('git', ['merge-base', baseRef, 'HEAD']) : null;
    scope = mergeBase ? [mergeBase] : [];
  }

  const numstat = parseNumstat(run('git', ['diff', '--numstat', ...scope]));
  const statuses = statusMap(tryRun('git', ['diff', '--name-status', ...scope]) ?? '');
  let diff = run('git', ['diff', ...scope]);

  // File mới chưa `git add` không nằm trong `git diff` — dev tạo component mới rồi chạy
  // qa-review ngay là chuyện thường, bỏ sót thì report phủ thiếu mà không ai biết.
  if (opts.mode === 'worktree') {
    const untracked = (tryRun('git', ['ls-files', '--others', '--exclude-standard']) ?? '')
      .split('\n')
      .filter(Boolean);
    for (const filePath of untracked) {
      const body = runAllowFail('git', ['diff', '--no-index', '--', '/dev/null', filePath]);
      const lines = body ? body.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length : 0;
      numstat.push({ path: filePath, additions: lines, deletions: 0, binary: false });
      statuses.set(filePath, 'A');
      if (body) diff += `\n${body}`;
    }
  }
  const head = tryRun('git', ['rev-parse', '--short', 'HEAD']);
  const branch = tryRun('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  return {
    files: numstat.map((f) => ({ ...f, status: statuses.get(f.path) ?? 'M' })),
    base: baseRef,
    head: branch && head ? `${branch}@${head}` : head,
    title: null,
    diff,
  };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (opts.help) {
    console.log(`node collect-diff.mjs [--staged | --pr <n>] [--base <branch>] [--max-lines <n>]`);
    process.exit(0);
  }

  let raw;
  try {
    raw = collect(opts);
  } catch (e) {
    console.error(`Không lấy được diff: ${e.message.split('\n')[0]}`);
    process.exit(1);
  }

  const files = raw.files.map((f) => ({ ...f, category: classify(f.path) }));
  const totalLines = files.reduce((n, f) => n + f.additions + f.deletions, 0);
  const byCategory = {};
  for (const f of files) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }

  const truncated = totalLines > opts.maxLines;
  if (truncated) {
    console.error(
      `CẢNH BÁO diff ${totalLines} dòng > ngưỡng ${opts.maxLines} — chỉ trả danh sách file + thống kê, không kèm nội dung diff.\n` +
        `  Đọc từng file rủi ro cao trước: ${files
          .slice()
          .sort((a, b) => CATEGORY_RISK[b.category] - CATEGORY_RISK[a.category])
          .slice(0, 5)
          .map((f) => f.path)
          .join(', ')}`
    );
  }

  const reportDir = await resolveReportDir(process.cwd());
  if (!reportDir) {
    console.error('Không đọc được qa.config.json — hỏi người dùng nơi ghi report.');
  }

  const output = {
    mode: opts.mode,
    reportDir,
    base: raw.base,
    head: raw.head,
    title: raw.title,
    stats: {
      files: files.length,
      additions: files.reduce((n, f) => n + f.additions, 0),
      deletions: files.reduce((n, f) => n + f.deletions, 0),
      totalLines,
      byCategory,
    },
    // Rủi ro cao lên đầu để Claude đọc đúng thứ tự khi context hẹp
    files: files.sort(
      (a, b) => CATEGORY_RISK[b.category] - CATEGORY_RISK[a.category] ||
                (b.additions + b.deletions) - (a.additions + a.deletions)
    ),
    truncated,
    diff: truncated ? null : raw.diff,
  };

  if (files.length === 0) {
    console.error('Không có thay đổi nào so với base. Kiểm tra --base hoặc đã commit chưa.');
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirectRun) await main();
