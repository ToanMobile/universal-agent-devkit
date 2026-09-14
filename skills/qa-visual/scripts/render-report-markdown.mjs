#!/usr/bin/env node
/**
 * render-report-markdown.mjs — gộp upload-manifest.json (+ audit-findings.json nếu có)
 * thành markdown để đính vào PR.
 *
 *   node render-report-markdown.mjs [--out <file>]
 *
 * Không có audit-findings.json thì vẫn chạy: report chỉ có ảnh, không có bảng finding.
 * Ảnh gói trong <details> — 10 route × 2 viewport là 20 ảnh, để trần thì PR ngập.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadConfig } from './config-loader.mjs';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function readJsonIfExists(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** Gom finding theo `<route>-<viewport>` để ghép với ảnh tương ứng. */
function indexFindings(findings) {
  const byShot = new Map();
  for (const f of findings ?? []) {
    const key = `${f.route}-${f.viewport}`;
    if (!byShot.has(key)) byShot.set(key, []);
    byShot.get(key).push(f);
  }
  for (const list of byShot.values()) {
    list.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  }
  return byShot;
}

function findingTable(findings) {
  const rows = findings
    .map((f) => `| ${f.severity} | ${f.type} | \`${f.selector}\` | ${f.evidence ?? ''} |`)
    .join('\n');
  return `| Severity | Type | Selector | Bằng chứng |\n|---|---|---|---|\n${rows}`;
}

export function renderMarkdown({ upload, findings }) {
  const byShot = indexFindings(findings);
  const all = findings ?? [];
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of all) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

  const lines = [];
  lines.push(`## QA Visual — \`${upload.branch}\` @ \`${upload.sha}\``);
  lines.push('');

  if (all.length) {
    lines.push(
      `**${all.length} finding** — ${counts.high} high · ${counts.medium} medium · ${counts.low} low · ` +
        `${upload.uploads.length} ảnh`
    );
  } else {
    lines.push(
      findings
        ? `**Không có finding nào** · ${upload.uploads.length} ảnh`
        : `${upload.uploads.length} ảnh — _chưa chạy audit-layout, report này chỉ có ảnh_`
    );
  }
  lines.push('');

  for (const shot of upload.uploads) {
    const name = `${shot.route}-${shot.viewport}`;
    const shotFindings = byShot.get(name) ?? [];
    const parts = [];
    if (shotFindings.length) parts.push(`${shotFindings.length} finding`);
    if (shot.warning) parts.push('cảnh báo');
    const summary = parts.length ? `${name} (${parts.join(', ')})` : name;

    lines.push(`<details><summary>${summary}</summary>`);
    lines.push('');
    // Cảnh báo từ lúc capture phải lên tới đây: reviewer không có cách nào khác để biết
    // ảnh này có thể là màn chưa đăng nhập.
    if (shot.warning) {
      lines.push(`> ${shot.warning}`);
      lines.push('');
    }
    lines.push(`![${name}](${shot.publicUrl})`);
    if (shotFindings.length) {
      lines.push('');
      lines.push(findingTable(shotFindings));
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  const warned = upload.uploads.filter((s) => s.warning);
  if (warned.length) {
    lines.push(
      `> **${warned.length} ảnh có cảnh báo** (${warned.map((w) => `${w.route}-${w.viewport}`).join(', ')}) — ` +
        'không thấy `auth.readySelector`, có thể không phải màn đã đăng nhập.'
    );
    lines.push('');
  }

  if (upload.failed?.length) {
    lines.push(`> ${upload.failed.length} ảnh upload lỗi: ${upload.failed.map((f) => path.basename(f.file)).join(', ')}`);
    lines.push('');
  }

  lines.push('<sub>Sinh bởi skill `qa-visual`. Ảnh nằm trên bucket public, sẽ không tự xoá.</sub>');
  return lines.join('\n');
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isDirectRun) {
  try {
    const cfg = loadConfig(process.cwd());
    const shotDir = path.join(cfg.__projectRoot, cfg.output.screenshotDir);

    const upload = readJsonIfExists(path.join(shotDir, 'upload-manifest.json'));
    if (!upload) throw new Error('Chưa có upload-manifest.json. Chạy upload-r2.mjs trước.');

    const auditFile = path.join(shotDir, 'audit-findings.json');
    const audit = readJsonIfExists(auditFile);
    if (!audit) console.error('Chưa có audit-findings.json — report sẽ chỉ có ảnh, không có bảng finding.');

    const md = renderMarkdown({ upload, findings: audit?.findings ?? null });

    const outIdx = process.argv.indexOf('--out');
    if (outIdx !== -1) {
      const out = path.resolve(process.argv[outIdx + 1]);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, `${md}\n`);
      console.error(`Đã ghi ${path.relative(cfg.__projectRoot, out)}`);
    } else {
      process.stdout.write(`${md}\n`);
    }
    process.exit(0);
  } catch (e) {
    console.error(`LỖI ${e.message}`);
    process.exit(1);
  }
}
