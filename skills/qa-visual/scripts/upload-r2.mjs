#!/usr/bin/env node
/**
 * upload-r2.mjs — đẩy screenshot trong capture-manifest.json lên Cloudflare R2.
 *
 *   node upload-r2.mjs           # in cảnh báo bucket public, hỏi xác nhận
 *   node upload-r2.mjs --yes     # bỏ qua hỏi (dùng trong CI hoặc khi đã biết rõ)
 *
 * Ghi upload-manifest.json cạnh ảnh: local path -> public URL.
 * Credential chỉ đọc từ .env, không bao giờ in ra.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { loadConfig, loadSecrets } from './config-loader.mjs';
import { signRequest, objectUrl } from './sigv4.mjs';

function git(args, fallback = null) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return fallback;
  }
}

/** `feature/ABC-123_fix` -> `feature-abc-123-fix`. Key R2 chỉ nên có chữ thường, số, gạch ngang, gạch chéo. */
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

/** Tên repo: lấy từ remote origin, không có remote thì lấy tên thư mục. */
function repoName(projectRoot) {
  const url = git(['remote', 'get-url', 'origin']);
  if (url) return slug(url.replace(/\.git$/, '').split(/[/:]/).pop());
  return slug(path.basename(projectRoot));
}

/**
 * Key có branch + sha, KHÔNG có PR number: chạy qa-visual trước `gh pr create` là hợp lệ,
 * lúc đó chưa có PR number. sha khiến chạy lại trên commit khác sinh key khác,
 * nên ảnh đính vào PR cũ không bị ghi đè.
 */
function buildKeyPrefix(projectRoot) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], 'no-branch');
  const sha = git(['rev-parse', '--short', 'HEAD'], 'no-sha');
  return { prefix: `${repoName(projectRoot)}/${slug(branch)}/${sha}`, branch, sha };
}

async function confirmPublicBucket(cfg) {
  if (process.argv.includes('--yes')) return;

  const warning =
    `\n  Bucket ${cfg.r2.bucket} là PUBLIC. Ảnh đọc được bởi bất kỳ ai có URL.\n` +
    '  sha trong key làm URL khó đoán, nhưng đó KHÔNG PHẢI bảo mật.\n' +
    '  Chỉ chạy trên môi trường dev/staging với dữ liệu giả.\n';
  console.error(warning);

  if (!process.stdin.isTTY) {
    throw new Error('Không có terminal để xác nhận. Đọc kỹ cảnh báo trên rồi chạy lại với --yes.');
  }

  process.stderr.write('  Gõ "yes" để tiếp tục: ');
  const answer = await new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (d) => resolve(d.trim().toLowerCase()));
  });
  if (answer !== 'yes') throw new Error('Đã huỷ, không upload gì.');
}

async function uploadOne({ cfg, secrets, key, body }) {
  const url = objectUrl(cfg.r2.endpoint, cfg.r2.bucket, key);
  const headers = signRequest({
    method: 'PUT',
    url,
    body,
    headers: {
      'content-type': 'image/png',
      'content-length': String(body.length),
      // Key chứa sha nên nội dung là immutable — cache thoải mái.
      'cache-control': 'public, max-age=31536000, immutable',
    },
    accessKeyId: secrets.R2_ACCESS_KEY_ID,
    secretAccessKey: secrets.R2_SECRET_ACCESS_KEY,
  });

  const res = await fetch(url, { method: 'PUT', headers, body });
  if (!res.ok) {
    // Body lỗi của R2 nêu rõ canonical request nào không khớp; giữ lại, nhưng cắt ngắn.
    throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 300).replace(/\s+/g, ' ')}`);
  }
  return `${cfg.r2.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
}

async function main() {
  const cfg = loadConfig(process.cwd());

  for (const field of ['endpoint', 'bucket', 'publicBaseUrl']) {
    if (!cfg.r2?.[field]) throw new Error(`r2.${field}: bắt buộc trong qa.config.json để upload`);
  }
  const secrets = loadSecrets(cfg.__projectRoot, ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']);

  const shotDir = path.join(cfg.__projectRoot, cfg.output.screenshotDir);
  const manifestPath = path.join(shotDir, 'capture-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Chưa có ${cfg.output.screenshotDir}/capture-manifest.json. Chạy capture-screens.mjs trước.`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const shots = manifest.shots.filter((s) => s.status === 'ok' && s.file);
  if (!shots.length) throw new Error('Manifest không có ảnh nào ở trạng thái ok.');

  await confirmPublicBucket(cfg);

  const { prefix, branch, sha } = buildKeyPrefix(cfg.__projectRoot);
  console.error(`\nUpload ${shots.length} ảnh → ${cfg.r2.bucket}/${prefix}/`);

  const uploads = [];
  const failed = [];
  for (const shot of shots) {
    const key = `${prefix}/${path.basename(shot.file)}`;
    try {
      const body = fs.readFileSync(path.join(cfg.__projectRoot, shot.file));
      const publicUrl = await uploadOne({ cfg, secrets, key, body });
      uploads.push({ ...shot, key, publicUrl, bytes: body.length });
      console.error(`  ok    ${path.basename(shot.file)}`);
    } catch (e) {
      // Một file lỗi không được giết cả run.
      failed.push({ file: shot.file, key, error: e.message });
      console.error(`  LỖI   ${path.basename(shot.file)}: ${e.message}`);
    }
  }

  const out = {
    repoPrefix: prefix,
    branch,
    sha,
    bucket: cfg.r2.bucket,
    publicBaseUrl: cfg.r2.publicBaseUrl,
    uploadedAt: new Date().toISOString(),
    uploads,
    failed,
  };
  const outPath = path.join(shotDir, 'upload-manifest.json');
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);

  console.error(`\n${uploads.length}/${shots.length} ảnh đã lên. manifest: ${path.relative(cfg.__projectRoot, outPath)}`);
  if (failed.length) console.error(`${failed.length} lỗi: ${failed.map((f) => path.basename(f.file)).join(', ')}`);
  process.exit(failed.length ? 1 : 0);
}

try {
  await main();
} catch (e) {
  console.error(`LỖI ${e.message}`);
  process.exit(1);
}
