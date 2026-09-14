#!/usr/bin/env node
/**
 * setup-r2.mjs — nhập credential Cloudflare R2 MỘT LẦN, dùng cho mọi repo.
 *
 *   node .claude/skills/qa-visual/scripts/setup-r2.mjs           # nhập + kiểm chứng
 *   node .claude/skills/qa-visual/scripts/setup-r2.mjs --show    # chỉ xem trạng thái
 *   node .claude/skills/qa-visual/scripts/setup-r2.mjs --local   # ghi vào .env của repo hiện tại
 *
 * Ghi vào ~/.claude/qa-skill/.env (dir 0700, file 0600). Skill vẫn cài per-repo,
 * nhưng credential là một — không phải chép lại vào .env của từng project.
 *
 * Secret nhập ở terminal với echo TẮT, không bao giờ in ra, không bao giờ log.
 * Đừng nhờ Claude gõ hộ key: làm vậy là nhét secret vào lịch sử hội thoại.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { GLOBAL_DIR, GLOBAL_ENV_FILE } from './config-loader.mjs';
import { signRequest, objectUrl } from './sigv4.mjs';

const KEYS = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const SECRET_KEYS = new Set(['R2_SECRET_ACCESS_KEY']);

const CTRL_C = '\u0003';
const BACKSPACE = ['\u007f', '\u0008'];

// Chết giữa lúc đang raw mode thì terminal của người dùng kẹt luôn (không echo,
// Ctrl+C không ăn). Trả lại mode dù thoát kiểu gì.
process.on('exit', () => {
  if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
});

/** Parser .env tối giản, giữ nguyên mọi key kể cả rỗng (ghi lại không làm mất dữ liệu cũ). */
function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

/**
 * Ghi `updates` vào file .env, VÁ TẠI CHỖ: dòng của key nào có sẵn thì thay giá trị,
 * chưa có thì nối vào cuối. Mọi comment và thứ tự dòng giữ nguyên — quan trọng với
 * `--local`, vì .env của project chứa cả khối hướng dẫn install.sh đặt vào.
 * Ghi file tạm rồi rename: đứt giữa chừng không để lại file cụt.
 */
function writeEnvFile(file, updates) {
  const pending = new Map(Object.entries(updates));
  let lines;

  if (fs.existsSync(file)) {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines = lines.map((line) => {
      const m = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=)/);
      if (!m || !pending.has(m[2])) return line;
      const key = m[2];
      const value = pending.get(key);
      pending.delete(key);
      return `${m[1]}${key}=${value}`;
    });
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  } else {
    lines = [
      '# qa-skill — credential R2. KHÔNG commit, KHÔNG chia sẻ.',
      `# Sinh bởi setup-r2.mjs lúc ${new Date().toISOString()}`,
    ];
  }

  for (const [key, value] of pending) lines.push(`${key}=${value}`);

  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${lines.join('\n')}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
}

/**
 * Nhiều người version-control cả ~/.claude (dotfiles repo). File này chứa credential
 * sống, lọt vào git là hỏng thật — nên trước khi ghi phải chắc nó đã bị ignore.
 * Trả về mô tả việc đã làm, hoặc null nếu không nằm trong repo nào.
 */
function ensureIgnored(file) {
  const dir = path.dirname(file);
  const git = (args, cwd) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return null;
    }
  };

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const root = git(['rev-parse', '--show-toplevel'], dir);
  if (!root) return null;
  if (git(['check-ignore', file], dir) !== null) return `đã nằm trong .gitignore của ${root}`;

  const rel = path.relative(root, file);
  const gitignore = path.join(root, '.gitignore');
  const prev = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
  const sep = prev && !prev.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignore, `${prev}${sep}\n# qa-skill — credential, không bao giờ commit\n/${rel}\n`);
  return `đã thêm "/${rel}" vào ${gitignore}`;
}

/**
 * Đủ để xác nhận "đúng key mình nghĩ" mà không lộ key.
 * Secret thì không hé cả đầu lẫn đuôi — chỉ báo có và dài bao nhiêu.
 */
function mask(key, value) {
  if (!value) return '(chưa có)';
  if (SECRET_KEYS.has(key)) return `(đã có, ${value.length} ký tự)`;
  return value.length <= 8 ? '(đã có)' : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * Đọc một dòng từ terminal. `hidden` = tắt echo, không hiện ký tự nào.
 * Raw mode phải tự bắt Ctrl+C vì signal handling mặc định bị tắt theo.
 */
function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Cần terminal thật để nhập credential (stdin không phải TTY).'));
      return;
    }
    // Raw mode PHẢI bật TRƯỚC khi in prompt. Bật sau thì có một khe hở:
    // ai đó (script tự động, hoặc paste sẵn) gõ ngay khi prompt hiện ra sẽ bị
    // tty echo ra màn hình trước khi echo kịp tắt — đã đo thấy khe này bằng expect.
    if (hidden) process.stdin.setRawMode(true);

    process.stderr.write(question);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    if (!hidden) {
      process.stdin.once('data', (d) => {
        process.stdin.pause();
        resolve(String(d).replace(/[\r\n]+$/, '').trim());
      });
      return;
    }

    const chars = [];

    const finish = (fn, arg) => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write('\n');
      fn(arg);
    };

    const onData = (chunk) => {
      for (const ch of String(chunk)) {
        if (ch === '\r' || ch === '\n') return finish(resolve, chars.join('').trim());
        if (ch === CTRL_C) return finish(reject, new Error('Đã huỷ.'));
        if (BACKSPACE.includes(ch)) chars.pop();
        else chars.push(ch);
      }
    };
    process.stdin.on('data', onData);
  });
}

/**
 * Kiểm chứng credential bằng một vòng PUT rồi DELETE object rác.
 * Chỉ chạy được khi repo hiện tại có qa.config.json khai r2.endpoint + r2.bucket;
 * không có thì bỏ qua chứ không coi là lỗi — credential vẫn đã lưu.
 */
async function verify(creds) {
  let cfg;
  try {
    const { loadConfig } = await import('./config-loader.mjs');
    cfg = loadConfig(process.cwd());
  } catch {
    return { skipped: 'repo hiện tại chưa có qa.config.json hợp lệ' };
  }
  if (!cfg.r2?.endpoint || !cfg.r2?.bucket) {
    return { skipped: 'qa.config.json chưa khai r2.endpoint / r2.bucket' };
  }

  const key = `_qa-skill-probe/${Date.now()}.txt`;
  const url = objectUrl(cfg.r2.endpoint, cfg.r2.bucket, key);
  const body = 'qa-skill credential probe';

  const put = await fetch(url, {
    method: 'PUT',
    headers: signRequest({
      method: 'PUT',
      url,
      body,
      headers: { 'content-type': 'text/plain', 'content-length': String(Buffer.byteLength(body)) },
      accessKeyId: creds.R2_ACCESS_KEY_ID,
      secretAccessKey: creds.R2_SECRET_ACCESS_KEY,
    }),
    body,
  });
  if (!put.ok) {
    throw new Error(
      `PUT thử thất bại — HTTP ${put.status}. ` +
        `${(await put.text()).slice(0, 200).replace(/\s+/g, ' ')}\n` +
        `  Kiểm lại access key / secret, và quyền ghi vào bucket ${cfg.r2.bucket}.`
    );
  }

  // Dọn object rác. Xoá hụt không phải lỗi credential nên chỉ nhắc, không throw.
  const del = await fetch(url, {
    method: 'DELETE',
    headers: signRequest({
      method: 'DELETE',
      url,
      body: '',
      headers: {},
      accessKeyId: creds.R2_ACCESS_KEY_ID,
      secretAccessKey: creds.R2_SECRET_ACCESS_KEY,
    }),
  });
  return { bucket: cfg.r2.bucket, cleaned: del.ok, key };
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.includes('--local') ? path.join(process.cwd(), '.env') : GLOBAL_ENV_FILE;
  const existing = parseEnvFile(target);

  console.error('\nqa-skill — credential R2');
  console.error(`  File:    ${target}`);
  console.error(
    target === GLOBAL_ENV_FILE
      ? `  Phạm vi: MỌI repo (${GLOBAL_DIR} chỉ mình bạn đọc được)`
      : '  Phạm vi: chỉ repo này — nhớ giữ .env trong .gitignore'
  );
  for (const k of KEYS) console.error(`  ${k.padEnd(22)} ${mask(k, existing[k])}`);

  if (args.includes('--show')) {
    process.exit(KEYS.every((k) => existing[k]) ? 0 : 1);
  }

  console.error('\nEnter để giữ nguyên giá trị hiện có. Secret gõ vào sẽ không hiện lên màn hình.\n');
  const updates = {};
  for (const k of KEYS) {
    const label = existing[k] ? `${k} [giữ nguyên]: ` : `${k}: `;
    const value = await prompt(`  ${label}`, { hidden: SECRET_KEYS.has(k) });
    if (value) updates[k] = value;
    else if (!existing[k]) throw new Error(`${k} bắt buộc, chưa có giá trị nào để giữ.`);
  }

  if (Object.keys(updates).length) {
    // Chặn credential lọt vào git TRƯỚC khi file tồn tại, không phải sau.
    const ignored = ensureIgnored(target);
    writeEnvFile(target, updates);
    console.error(`\n  Đã ghi ${target} (chmod 600).`);
    if (ignored) console.error(`  Git: ${ignored}.`);
  } else {
    console.error('\n  Không có gì thay đổi.');
  }

  console.error('\nKiểm chứng credential…');
  const result = await verify({ ...existing, ...updates });
  if (result.skipped) {
    console.error(`  BỎ QUA — ${result.skipped}.`);
    console.error('  Chạy lại lệnh này trong một repo đã cài qa-skill để kiểm chứng thật.');
  } else {
    console.error(`  OK — ghi và xoá thử thành công trên bucket ${result.bucket}.`);
    if (!result.cleaned) console.error(`  Lưu ý: không xoá được object thử ${result.key}, dọn tay nếu cần.`);
  }
  console.error('');
}

try {
  await main();
} catch (e) {
  console.error(`\nLỖI ${e.message}\n`);
  process.exit(1);
}
