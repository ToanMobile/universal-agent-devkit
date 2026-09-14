#!/usr/bin/env node
/**
 * attach-to-pr.mjs — đưa report ảnh vào PR.
 *
 *   node attach-to-pr.mjs          # có PR -> comment; chưa có PR -> ghi file cho PR body
 *   node attach-to-pr.mjs --pr 12  # ép comment vào PR số 12
 *   node attach-to-pr.mjs --dry    # chỉ in markdown, không gửi gì
 *
 * KHÔNG giả định PR đã mở: chạy qa-visual TRƯỚC `gh pr create` là hoàn toàn hợp lệ.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './config-loader.mjs';
import { renderMarkdown } from './render-report-markdown.mjs';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Tra PR đang mở cho branch hiện tại.
 * Phân biệt "chưa có PR" với "gh hỏng": gộp hai ca lại rồi nói "chưa có PR" là
 * khẳng định sai — user tưởng chưa tạo PR trong khi thật ra chỉ là chưa `gh auth login`.
 *
 * @returns {{ number: number|null, reason: 'found'|'no-pr'|'gh-error', detail?: string }}
 */
function lookupPr() {
  try {
    const n = gh(['pr', 'view', '--json', 'number', '-q', '.number']);
    return n ? { number: Number(n), reason: 'found' } : { number: null, reason: 'no-pr' };
  } catch (e) {
    const msg = `${e.stderr ?? ''}${e.message ?? ''}`;
    // gh nói rõ khi branch chưa có PR. Repo không có remote thì cũng chắc chắn không có PR
    // — đó là sự thật, không phải phỏng đoán. Mọi lỗi khác là hạ tầng (auth, mạng, rate limit),
    // lúc đó KHÔNG được khẳng định "chưa có PR" vì branch có thể đã có.
    const noPr = /no pull requests found|no open pull requests|could not find any pull requests|no git remotes found/i.test(msg);
    return noPr
      ? { number: null, reason: 'no-pr' }
      : { number: null, reason: 'gh-error', detail: msg.split('\n').find((l) => l.trim()) ?? 'gh lỗi' };
  }
}

function readJsonIfExists(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

async function main() {
  const cfg = loadConfig(process.cwd());
  const shotDir = path.join(cfg.__projectRoot, cfg.output.screenshotDir);

  const upload = readJsonIfExists(path.join(shotDir, 'upload-manifest.json'));
  if (!upload) throw new Error('Chưa có upload-manifest.json. Chạy upload-r2.mjs trước.');
  const audit = readJsonIfExists(path.join(shotDir, 'audit-findings.json'));

  const markdown = renderMarkdown({ upload, findings: audit?.findings ?? null });

  if (process.argv.includes('--dry')) {
    process.stdout.write(`${markdown}\n`);
    return;
  }

  const prIdx = process.argv.indexOf('--pr');
  const lookup = prIdx !== -1 ? { number: Number(process.argv[prIdx + 1]), reason: 'found' } : lookupPr();
  const prNumber = lookup.number;

  // Ghi file trước trong mọi trường hợp — comment có thể fail, file thì luôn còn để dùng tay.
  const reportDir = path.join(cfg.__projectRoot, cfg.output.reportDir);
  fs.mkdirSync(reportDir, { recursive: true });
  const bodyFile = path.join(reportDir, 'qa-visual-pr-body.md');
  fs.writeFileSync(bodyFile, `${markdown}\n`);
  const relBody = path.relative(cfg.__projectRoot, bodyFile);

  if (!prNumber) {
    const head =
      lookup.reason === 'gh-error'
        ? `KHÔNG XÁC ĐỊNH ĐƯỢC PR — gh lỗi: ${lookup.detail}\n` +
          `  Có thể branch này ĐÃ có PR. Kiểm tra \`gh auth status\` rồi chạy lại, hoặc dùng --pr <số>.`
        : 'Chưa có PR cho branch này.';
    console.error(
      `${head}\n` +
        `  Đã ghi ${relBody}\n` +
        `  Tạo PR rồi dán nội dung file đó vào phần mô tả, hoặc:\n` +
        `    gh pr create --body-file ${relBody}`
    );
    process.exit(lookup.reason === 'gh-error' ? 1 : 0);
  }

  try {
    gh(['pr', 'comment', String(prNumber), '--body-file', bodyFile]);
    console.error(`Đã comment vào PR #${prNumber}. Bản markdown cũng lưu ở ${relBody}`);
  } catch (e) {
    throw new Error(
      `Không comment được vào PR #${prNumber}: ${e.message.split('\n')[0]}\n` +
        `  Markdown vẫn ở ${relBody} — dán tay được.`
    );
  }
}

try {
  await main();
} catch (e) {
  console.error(`LỖI ${e.message}`);
  process.exit(1);
}
