#!/usr/bin/env node
/**
 * authenticate.mjs — đăng nhập vào app rồi lưu session ra `auth.statePath`.
 *
 *   node authenticate.mjs            # theo auth.mode trong qa.config.json
 *   node authenticate.mjs --manual   # ép chế độ login tay (headed), bỏ qua auth.mode
 *   node authenticate.mjs --force    # bỏ session đang còn hạn, login lại từ đầu
 *
 * KHÔNG BAO GIỜ log giá trị QA_TEST_EMAIL / QA_TEST_PASSWORD, kể cả khi lỗi.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadConfig, loadSecrets } from './config-loader.mjs';
import { launchBrowser, stabilizePage, writeSecretFile, fileAgeHours, joinUrl } from './browser-helpers.mjs';

const MANUAL_TIMEOUT_MS = 5 * 60 * 1000; // dev cần thời gian gõ tay, kể cả khi phải mở app xác thực
const FORM_TIMEOUT_MS = 30 * 1000;

/** Session còn dùng được không? Dùng chung với capture-screens. */
export function stateIsFresh(cfg) {
  const statePath = path.join(cfg.__projectRoot, cfg.auth.statePath);
  return fileAgeHours(statePath) < cfg.auth.stateMaxAgeHours;
}

async function dumpState(context, cfg) {
  const statePath = path.join(cfg.__projectRoot, cfg.auth.statePath);
  const state = await context.storageState();
  writeSecretFile(statePath, JSON.stringify(state, null, 2));
  return statePath;
}

/** Login bằng chính form của app: điền email, password, submit, chờ readySelector. */
async function loginWithForm(page, cfg, secrets) {
  const { auth } = cfg;
  const loginUrl = joinUrl(cfg.baseUrl, auth.loginUrl);

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  for (const [field, selector] of [
    ['emailSelector', auth.emailSelector],
    ['passwordSelector', auth.passwordSelector],
    ['submitSelector', auth.submitSelector],
  ]) {
    if (!(await page.locator(selector).count())) {
      throw new Error(
        `Không tìm thấy ${field} "${selector}" trên ${loginUrl}.\n` +
          '  Mở trang đó trong browser, xem lại selector rồi sửa qa.config.json — đừng sửa code.'
      );
    }
  }

  await page.fill(auth.emailSelector, secrets.QA_TEST_EMAIL);
  await page.fill(auth.passwordSelector, secrets.QA_TEST_PASSWORD);
  await page.click(auth.submitSelector);

  // Chạy đua 2 kết cục thay vì chờ hết timeout: app đã từ chối đăng nhập thì biết ngay
  // sau vài giây, không bắt người dùng ngồi đợi 30s mới thấy "sai mật khẩu".
  const ready = page
    .waitForSelector(auth.readySelector, { timeout: FORM_TIMEOUT_MS })
    .then(() => 'ready', () => 'timeout');

  const rejected = (async () => {
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const stillOnLogin = (await page.locator(auth.passwordSelector).count()) > 0;
    // Chưa kết luận được thì không tham gia đua — để `ready` quyết.
    return stillOnLogin ? 'rejected' : new Promise(() => {});
  })();

  const outcome = await Promise.race([ready, rejected]);

  if (outcome === 'rejected') {
    // Không bao giờ dựng lại nội dung ô password vào message.
    throw new Error(
      'Vẫn ở trang login sau khi submit — app từ chối đăng nhập.\n' +
        '  Kiểm tra QA_TEST_EMAIL / QA_TEST_PASSWORD trong .env.'
    );
  }
  if (outcome === 'timeout') {
    throw new Error(
      `Không thấy auth.readySelector "${auth.readySelector}" sau ${FORM_TIMEOUT_MS / 1000}s.\n` +
        `  URL hiện tại: ${page.url()}\n  Sửa readySelector trong qa.config.json cho khớp app.`
    );
  }
}

/** Login tay: mở browser headed, dev tự đăng nhập, script chỉ chờ readySelector rồi lưu session. */
async function loginManually(page, cfg) {
  const startUrl = joinUrl(cfg.baseUrl, cfg.auth.loginUrl);
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

  console.error('');
  console.error('  Browser đã mở. Hãy tự đăng nhập trong cửa sổ đó.');
  console.error(`  Script chờ tới khi thấy "${cfg.auth.readySelector}" (tối đa 5 phút) rồi tự lưu session.`);
  console.error('');

  try {
    await page.waitForSelector(cfg.auth.readySelector, { timeout: MANUAL_TIMEOUT_MS });
  } catch {
    throw new Error(
      `Hết 5 phút mà không thấy auth.readySelector "${cfg.auth.readySelector}".\n` +
        `  URL hiện tại: ${page.url()}\n` +
        '  Hoặc chưa login xong, hoặc selector sai — mở DevTools kiểm tra rồi sửa qa.config.json.'
    );
  }
}

export async function authenticate(cfg, { manual = false } = {}) {
  const mode = manual || cfg.auth.mode === 'manual' ? 'manual' : cfg.auth.mode;

  if (mode === 'none') {
    console.error('auth.mode = "none" — app không cần đăng nhập, bỏ qua bước này.');
    return null;
  }

  const secrets =
    mode === 'form'
      ? loadSecrets(cfg.__projectRoot, ['QA_TEST_EMAIL', 'QA_TEST_PASSWORD'])
      : {};

  const browser = await launchBrowser({ headed: mode === 'manual' });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    if (mode === 'manual') await loginManually(page, cfg);
    else await loginWithForm(page, cfg, secrets);

    await stabilizePage(page);
    const statePath = await dumpState(context, cfg);
    console.error(`Đăng nhập xong. Session lưu tại ${cfg.auth.statePath} (quyền 0600).`);
    return statePath;
  } finally {
    await browser.close();
  }
}

/**
 * Bảo đảm có session dùng được trước khi capture.
 * `force` bỏ qua session cũ; capture-screens dùng nó khi phát hiện bị đá về login.
 */
export async function ensureAuth(cfg, { force = false } = {}) {
  if (cfg.auth.mode === 'none') return null;

  const statePath = path.join(cfg.__projectRoot, cfg.auth.statePath);
  if (!force && stateIsFresh(cfg)) {
    const age = fileAgeHours(statePath).toFixed(1);
    console.error(`Dùng lại session cũ (${age}h < ${cfg.auth.stateMaxAgeHours}h), không login lại.`);
    return statePath;
  }
  if (force && fs.existsSync(statePath)) fs.rmSync(statePath);
  return authenticate(cfg);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isDirectRun) {
  const manual = process.argv.includes('--manual');
  const force = process.argv.includes('--force');
  try {
    const cfg = loadConfig(process.cwd());
    if (manual) await authenticate(cfg, { manual: true });
    else await ensureAuth(cfg, { force });
    process.exit(0);
  } catch (e) {
    console.error(`LỖI ${e.message}`);
    process.exit(1);
  }
}
