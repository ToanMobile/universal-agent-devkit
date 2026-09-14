#!/usr/bin/env node
/**
 * capture-screens.mjs — chụp full-page mọi routes[] × viewports[] khai trong qa.config.json.
 *
 *   node capture-screens.mjs                 # chụp tất cả
 *   node capture-screens.mjs --route home    # chỉ 1 route (lặp được cờ này)
 *   node capture-screens.mjs --headed        # nhìn browser chạy, để debug
 *
 * Ghi ảnh ra <output.screenshotDir>/<route>-<viewport>.png và capture-manifest.json cạnh đó.
 * Phase 4 (audit) và 6 (upload) đọc manifest, không tự glob thư mục.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadConfig } from './config-loader.mjs';
import { ensureAuth } from './authenticate.mjs';
import { launchBrowser, stabilizePage, joinUrl } from './browser-helpers.mjs';

const GOTO_TIMEOUT_MS = 30 * 1000;

/**
 * Bị đá về trang login? CHỈ tin URL.
 *
 * Trước đây hàm này còn coi "vắng readySelector" là bị đá về login — sai: app thật có
 * route nằm ngoài app shell (landing công khai, trang in, trang lỗi độc lập). Route như vậy
 * sẽ bị kết luận nhầm là session hỏng, đốt mất lượt đăng nhập lại duy nhất, rồi làm route
 * hỏng thật sau đó chết oan.
 */
function isOnLoginUrl(page, cfg) {
  if (cfg.auth.mode === 'none') return false;
  try {
    return new URL(page.url()).pathname === new URL(joinUrl(cfg.baseUrl, cfg.auth.loginUrl)).pathname;
  } catch {
    return false;
  }
}

/** Vắng readySelector = CẢNH BÁO cho riêng route đó, không phải phán quyết về session. */
async function missingReadySelector(page, cfg) {
  if (cfg.auth.mode === 'none' || !cfg.auth.readySelector) return false;
  return (await page.locator(cfg.auth.readySelector).count()) === 0;
}

async function captureRoute(page, cfg, route, viewport, outDir) {
  const url = joinUrl(cfg.baseUrl, route.path);
  const file = path.join(outDir, `${route.name}-${viewport.name}.png`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS });
  await stabilizePage(page);
  await page.screenshot({ path: file, fullPage: true });

  return {
    route: route.name,
    path: route.path,
    viewport: viewport.name,
    // Đường dẫn tương đối gốc project — manifest phải mang đi được, không dính máy ai
    file: path.relative(cfg.__projectRoot, file),
    finalUrl: page.url(),
  };
}

async function main() {
  const cfg = loadConfig(process.cwd());

  const onlyRoutes = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--route') onlyRoutes.push(argv[++i]);
  }
  const routes = onlyRoutes.length ? cfg.routes.filter((r) => onlyRoutes.includes(r.name)) : cfg.routes;
  if (!routes.length) {
    throw new Error(`Không route nào khớp --route ${onlyRoutes.join(', ')}. Có: ${cfg.routes.map((r) => r.name).join(', ')}`);
  }

  if (cfg.auth.mode !== 'none') {
    console.error(
      'CẢNH BÁO ảnh chụp là màn hình ĐÃ ĐĂNG NHẬP. Chỉ chạy trên local/dev với dữ liệu giả,\n' +
        '         và nhớ rằng bucket R2 ở phase 6 là public.'
    );
  }

  let storageStatePath = await ensureAuth(cfg);

  const outDir = path.join(cfg.__projectRoot, cfg.output.screenshotDir);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const results = [];
  let reauthed = false; // chỉ cho phép đăng nhập lại ĐÚNG 1 lần, tránh loop vô hạn

  const newContext = async (viewport) =>
    browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
    });

  try {
    for (const viewport of cfg.viewports) {
      let context = await newContext(viewport);

      try {
        for (const route of routes) {
          // MỘT page RIÊNG cho mỗi route. Dùng chung page thì một navigation chết
          // (socket đứt, chrome-error://) để lại tab ở trạng thái hỏng và kéo theo
          // route kế tiếp chết oan — đã gặp thật khi test.
          let page = await context.newPage();

          try {
            let shot = await captureRoute(page, cfg, route, viewport, outDir);

            if (isOnLoginUrl(page, cfg)) {
              if (reauthed) {
                throw new Error('Vẫn bị đá về trang login sau khi đăng nhập lại. Dừng, không thử tiếp.');
              }
              console.error(`Bị đá về login ở ${route.name} — session hỏng, đăng nhập lại đúng 1 lần.`);
              reauthed = true;
              storageStatePath = await ensureAuth(cfg, { force: true });

              // Thay context bằng bản mang session mới, rồi chụp lại chính route này.
              await page.close().catch(() => {});
              await context.close().catch(() => {});
              context = await newContext(viewport);
              page = await context.newPage();

              shot = await captureRoute(page, cfg, route, viewport, outDir);
              if (isOnLoginUrl(page, cfg)) {
                throw new Error('Đăng nhập lại xong vẫn bị đá về trang login. Kiểm tra tài khoản trong .env.');
              }
            }

            const warning = (await missingReadySelector(page, cfg))
              ? `Không thấy auth.readySelector "${cfg.auth.readySelector}" — route này có thể nằm ngoài app shell, hoặc ảnh chụp chưa phải màn đã đăng nhập.`
              : null;

            results.push({ ...shot, status: 'ok', ...(warning ? { warning } : {}) });
            console.error(`  ok    ${route.name}-${viewport.name}${warning ? '  (cảnh báo)' : ''}`);
            if (warning) console.error(`        ${warning}`);
          } catch (e) {
            // Một route hỏng không được giết cả run — ghi lại rồi đi tiếp.
            results.push({
              route: route.name,
              path: route.path,
              viewport: viewport.name,
              file: null,
              status: 'failed',
              error: e.message.split('\n')[0],
            });
            console.error(`  LỖI   ${route.name}-${viewport.name}: ${e.message.split('\n')[0]}`);
          } finally {
            await page.close().catch(() => {});
          }
        }
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    baseUrl: cfg.baseUrl,
    authMode: cfg.auth.mode,
    capturedAt: new Date().toISOString(),
    screenshotDir: cfg.output.screenshotDir,
    shots: results,
  };
  const manifestPath = path.join(outDir, 'capture-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const failed = results.filter((r) => r.status === 'failed');
  console.error(
    `\n${results.length - failed.length}/${results.length} ảnh chụp được → ${cfg.output.screenshotDir}/\n` +
      `manifest: ${path.relative(cfg.__projectRoot, manifestPath)}`
  );
  if (failed.length) {
    console.error(`${failed.length} route lỗi: ${failed.map((f) => `${f.route}-${f.viewport}`).join(', ')}`);
  }
  const warned = results.filter((r) => r.warning);
  if (warned.length) {
    console.error(`${warned.length} route có cảnh báo: ${warned.map((w) => `${w.route}-${w.viewport}`).join(', ')}`);
  }
  process.exit(failed.length ? 1 : 0);
}

try {
  await main();
} catch (e) {
  console.error(`LỖI ${e.message}`);
  process.exit(1);
}
