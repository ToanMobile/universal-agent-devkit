/**
 * browser-helpers.mjs — khởi động browser và ổn định trang trước khi đo/chụp.
 * Dùng chung bởi authenticate.mjs, capture-screens.mjs (phase 3) và audit-layout.mjs (phase 4).
 *
 * Playwright PHẢI được cài trong project đích (`npm i -D playwright`).
 * `npx -p playwright` không làm `import 'playwright'` resolve được — đã kiểm, không có đường vòng.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const INSTALL_HINT =
  'Thiếu Playwright trong project này.\n' +
  '  npm i -D playwright && npx playwright install chromium\n' +
  '  (hoặc yarn/pnpm tương đương). qa-review không cần Playwright, chỉ qa-visual cần.';

/**
 * Nạp Playwright từ project đích. Thử `playwright` trước, rồi `@playwright/test`
 * (nhiều project chỉ cài gói test — nó re-export cùng các browser type).
 */
export async function loadPlaywright() {
  for (const pkg of ['playwright', '@playwright/test']) {
    try {
      const mod = await import(pkg);
      if (mod.chromium) return mod;
    } catch (e) {
      if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    }
  }
  throw new Error(INSTALL_HINT);
}

/** Mở chromium. `--headed` trên argv hoặc headed:true để nhìn thấy browser (debug / login tay). */
export async function launchBrowser({ headed = false } = {}) {
  const { chromium } = await loadPlaywright();
  const visible = headed || process.argv.includes('--headed');
  try {
    return await chromium.launch({ headless: !visible });
  } catch (e) {
    if (/Executable doesn't exist|browserType.launch/.test(e.message)) {
      throw new Error(`Chưa tải browser cho Playwright.\n  npx playwright install chromium\n\n${e.message.split('\n')[0]}`);
    }
    throw e;
  }
}

/** CSS tắt mọi animation/transition — chèn trước khi đo để layout không nhúc nhích giữa chừng. */
const FREEZE_CSS = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  animation-duration: 0s !important;
  transition-duration: 0s !important;
  caret-color: transparent !important;
}`;

/**
 * Đưa trang về trạng thái đo được. Chụp sớm là nguồn false-positive lớn nhất của
 * audit-layout: font chưa load thì mọi phép đo text sai, ảnh chưa xong thì chiều cao sai.
 *
 * Mỗi bước chờ đều có timeout riêng và KHÔNG ném lỗi — trang chậm vẫn chụp được,
 * chỉ là chụp muộn hơn; ném lỗi ở đây sẽ giết cả run vì một route lười.
 */
export async function stabilizePage(page, { timeout = 15000 } = {}) {
  const soft = (promise) => promise.catch(() => {});

  await soft(page.waitForLoadState('networkidle', { timeout }));
  await soft(page.addStyleTag({ content: FREEZE_CSS }));
  await soft(page.evaluate(() => document.fonts?.ready));

  // Ảnh: chờ mọi <img> đã gắn src xong việc, kể cả ảnh lỗi (complete = true khi lỗi).
  await soft(
    page.waitForFunction(
      () => [...document.images].every((img) => !img.src || img.complete),
      undefined,
      { timeout: 5000 }
    )
  );

  // Cuộn hết trang để kích hoạt lazy-load rồi về đầu — nếu không, ảnh dưới fold
  // sẽ hiện thành ô trống trong ảnh fullPage.
  await soft(
    page.evaluate(async () => {
      const step = window.innerHeight;
      // Chốt chiều cao MỘT LẦN và chặn số vòng: nội dung lazy-load có thể đẩy
      // scrollHeight dài ra mãi, đọc lại mỗi vòng thì vòng lặp không bao giờ dừng.
      const height = document.body.scrollHeight;
      const maxSteps = 30;
      for (let i = 0; i < maxSteps && i * step < height; i += 1) {
        window.scrollTo(0, i * step);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    })
  );
  await soft(page.waitForLoadState('networkidle', { timeout: 5000 }));
  await page.waitForTimeout(300);
}

/** Ghi file với quyền 0600 — dùng cho storageState (chứa session token). */
export function writeSecretFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600); // file đã tồn tại thì mode ở writeFileSync bị bỏ qua
}

/** Tuổi file tính bằng giờ; Infinity nếu chưa có file. */
export function fileAgeHours(filePath) {
  if (!fs.existsSync(filePath)) return Infinity;
  return (Date.now() - fs.statSync(filePath).mtimeMs) / 3_600_000;
}

/** Ghép baseUrl + path, không sinh dấu `/` đúp. */
export function joinUrl(baseUrl, routePath) {
  return new URL(routePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}
