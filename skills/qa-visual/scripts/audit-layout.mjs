#!/usr/bin/env node
/**
 * audit-layout.mjs — chạy audit-checks trên DOM SỐNG của từng route.
 *
 *   node audit-layout.mjs                       # theo capture-manifest.json
 *   node audit-layout.mjs --url http://x/a.html # 1 URL, không cần manifest (debug nhanh)
 *   node audit-layout.mjs --viewport desktop    # lọc viewport
 *   node audit-layout.mjs --headed              # nhìn browser chạy
 *
 * Audit trên DOM chứ không trên ảnh PNG: ảnh không có selector, không có computed style.
 * Ghi <output.screenshotDir>/audit-findings.json theo contract ở phase-04 của plan.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadConfig } from './config-loader.mjs';
import { launchBrowser, stabilizePage, joinUrl } from './browser-helpers.mjs';
import { auditPage } from './audit-checks.mjs';

const GOTO_TIMEOUT_MS = 30 * 1000;

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

/** Danh sách việc cần audit: từ manifest, hoặc từ --url. */
function buildTargets(cfg) {
  const singleUrl = argValue('--url');
  if (singleUrl) {
    const vpName = argValue('--viewport');
    const vp = cfg.viewports.find((v) => v.name === vpName) ?? cfg.viewports[0];
    return [{ route: 'adhoc', viewport: vp.name, url: singleUrl, vp }];
  }

  const manifestPath = path.join(cfg.__projectRoot, cfg.output.screenshotDir, 'capture-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Chưa có ${cfg.output.screenshotDir}/capture-manifest.json.\n` +
        '  Chạy capture-screens.mjs trước, hoặc dùng --url để audit một trang.'
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const only = argValue('--viewport');

  return manifest.shots
    .filter((s) => s.status === 'ok')
    .filter((s) => !only || s.viewport === only)
    .map((s) => {
      const vp = cfg.viewports.find((v) => v.name === s.viewport);
      if (!vp) throw new Error(`viewport "${s.viewport}" có trong manifest nhưng không có trong qa.config.json`);
      // finalUrl là URL thật sau redirect — audit đúng trang đã chụp, không phải trang định chụp.
      return { route: s.route, viewport: s.viewport, url: s.finalUrl ?? joinUrl(cfg.baseUrl, s.path), vp };
    });
}

async function main() {
  const cfg = loadConfig(process.cwd());
  const targets = buildTargets(cfg);
  if (!targets.length) throw new Error('Không có trang nào để audit.');

  const isA11y = process.argv.includes('--a11y');
  const auditCfg = {
    alignTolerancePx: cfg.audit.alignTolerancePx,
    ignoreSelectors: cfg.audit.ignoreSelectors,
    minElementArea: cfg.audit.minElementArea,
    checkContrast: isA11y || cfg.audit.checkContrast === true,
    checkTouchTarget: isA11y || cfg.audit.checkTouchTarget === true,
  };

  // Check *-drift chỉ bật khi đã chạy infer-design-tokens.mjs. Không có file thì
  // audit vẫn chạy đủ 5 check hình học — token inference là tuỳ chọn, không phải điều kiện.
  const tokensPath = path.join(cfg.__projectRoot, cfg.output.screenshotDir, 'inferred-tokens.json');
  if (fs.existsSync(tokensPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    auditCfg.driftByProperty = tokens.driftByProperty ?? null;
    auditCfg.tokensAreInferred = tokens.inferred !== false;
    const n = Object.keys(auditCfg.driftByProperty ?? {}).length;
    console.error(
      `Đã nạp inferred-tokens.json — bật check *-drift trên ${n} thuộc tính ` +
        `(token ${auditCfg.tokensAreInferred ? 'SUY ĐOÁN' : 'khai tay'}).`
    );
  }

  const statePath = path.join(cfg.__projectRoot, cfg.auth.statePath);
  const useState = cfg.auth.mode !== 'none' && fs.existsSync(statePath);

  const browser = await launchBrowser();
  const findings = [];
  const pages = [];
  const failed = [];

  try {
    // Gom theo viewport để mỗi kích thước chỉ dựng context một lần.
    const byViewport = new Map();
    for (const t of targets) {
      if (!byViewport.has(t.viewport)) byViewport.set(t.viewport, []);
      byViewport.get(t.viewport).push(t);
    }

    for (const [vpName, group] of byViewport) {
      const vp = group[0].vp;
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        ...(useState ? { storageState: statePath } : {}),
      });

      try {
        for (const target of group) {
          const page = await context.newPage(); // tab riêng mỗi route — lỗi không lan sang route sau
          const started = Date.now();
          try {
            await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS });
            await stabilizePage(page);

            // Tách riêng thời gian ĐO khỏi thời gian tải trang — ngưỡng "<3s cho trang
            // 500 element" nói về phép đo, không phải về mạng.
            const auditStarted = Date.now();
            const raw = await page.evaluate(auditPage, { ...auditCfg, viewportWidth: vp.width });
            const auditMs = Date.now() - auditStarted;
            const elapsed = Date.now() - started;
            const elementCount = await page.evaluate(() => document.body.querySelectorAll('*').length);

            for (const f of raw) findings.push({ route: target.route, viewport: target.viewport, ...f });
            pages.push({
              route: target.route,
              viewport: target.viewport,
              url: page.url(),
              elementCount,
              findings: raw.length,
              auditMs,
              totalMs: elapsed,
            });
            console.error(
              `  ${String(raw.length).padStart(3)} finding  ${target.route}-${vpName}  ` +
                `(${elementCount} element, đo ${auditMs}ms / tổng ${elapsed}ms)`
            );
          } catch (e) {
            failed.push({ route: target.route, viewport: target.viewport, error: e.message.split('\n')[0] });
            console.error(`  LỖI        ${target.route}-${vpName}: ${e.message.split('\n')[0]}`);
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

  const outDir = path.join(cfg.__projectRoot, cfg.output.screenshotDir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'audit-findings.json');
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ auditedAt: new Date().toISOString(), thresholds: auditCfg, pages, failed, findings }, null, 2)}\n`
  );

  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  console.error(
    `\n${findings.length} finding trên ${pages.length} trang — ` +
      `${bySeverity.high} high · ${bySeverity.medium} medium · ${bySeverity.low} low`
  );
  console.error(`ghi: ${path.relative(cfg.__projectRoot, outPath)}`);
  if (failed.length) console.error(`${failed.length} trang lỗi: ${failed.map((f) => f.route).join(', ')}`);
  process.exit(failed.length ? 1 : 0);
}

try {
  await main();
} catch (e) {
  console.error(`LỖI ${e.message}`);
  process.exit(1);
}
