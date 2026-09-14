#!/usr/bin/env node
/**
 * infer-design-tokens.mjs — suy token set từ computed style THỰC TẾ của app.
 *
 *   node infer-design-tokens.mjs              # theo capture-manifest.json
 *   node infer-design-tokens.mjs --url http://…
 *
 * Ghi <output.screenshotDir>/inferred-tokens.json. audit-layout.mjs đọc file đó
 * rồi sinh finding *-drift.
 *
 * KẾT QUẢ LÀ SUY ĐOÁN, KHÔNG PHẢI KHAI BÁO. Cờ `"inferred": true` phải giữ nguyên
 * trong output và phải nói rõ khi trình bày cho người đọc.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadConfig } from './config-loader.mjs';
import { launchBrowser, stabilizePage, joinUrl } from './browser-helpers.mjs';
import { deltaE } from './color-distance.mjs';

const DEFAULTS = {
  minShare: 0.02,        // ≥2% số lần xuất hiện trong nhóm  → coi là token
  minCount: 3,           // và phải xuất hiện đủ nhiều lần   → tránh "token" chỉ vì mẫu quá nhỏ
  maxDeltaE: 5,          // màu: gần token đến mức này thì coi là hardcode nhầm
  maxNumericDrift: 0.15, // số đo: lệch dưới 15% so với token gần nhất
};

/**
 * Gom theo NHÓM chứ không theo từng thuộc tính.
 * Design system định nghĩa một thang dùng chung: bảng màu dùng cho cả chữ/nền/viền,
 * thang khoảng cách dùng cho cả padding/margin/gap. Đếm riêng từng thuộc tính thì
 * mỗi rổ quá nhỏ, giá trị hợp lệ cũng thành "hiếm".
 */
const GROUPS = {
  color: {
    kind: 'color',
    findingType: 'color-drift',
    props: ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'],
  },
  fontSize: { kind: 'length', findingType: 'typography-drift', props: ['fontSize'] },
  fontWeight: { kind: 'number', findingType: 'typography-drift', props: ['fontWeight'] },
  // KHÔNG theo dõi lineHeight: computed line-height suy ra từ font-size × hệ số không đơn vị.
  // Font-size lệch thì line-height lệch theo — báo cả hai là báo một lỗi hai lần.
  spacing: {
    kind: 'length',
    findingType: 'spacing-drift',
    props: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap'],
  },
  borderRadius: {
    kind: 'length',
    findingType: 'spacing-drift',
    props: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
  },
};

/** Chạy TRONG PAGE — phải tự chứa, không tham chiếu gì ngoài tham số. */
function collectStyles(propList) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'BR', 'NOSCRIPT']);
  const out = [];

  for (const el of document.body.querySelectorAll('*')) {
    if (SKIP.has(el.tagName)) continue;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue; // element không chiếm chỗ thì style của nó không ai thấy

    for (const prop of propList) {
      const value = s[prop];
      if (value) out.push([prop, value]);
    }
  }
  return out;
}

const isNoise = (kind, value) =>
  value === 'normal' || value === 'auto' || value === 'none' ||
  // 0px là mặc định của trình duyệt, không phải quyết định thiết kế. Để lẫn vào
  // thì nó áp đảo mọi rổ khoảng cách và đẩy giá trị thật thành "hiếm".
  (kind === 'length' && (value === '0px' || value === '0'));

/** Giá trị số của một token/ứng viên; null nếu không so sánh được bằng số. */
function numeric(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Giá trị px KHÔNG NGUYÊN gần như luôn là do trình duyệt tự tính, không phải người viết:
 * `h1 { margin: .67em }` trên font 32px ra 21.44px; input mặc định ra font-size 13.3333px.
 * Người thiết kế viết 15px, không viết 21.44px. Coi chúng là ứng viên drift chỉ tạo rác.
 */
function isBrowserDerived(kind, value) {
  if (kind !== 'length') return false;
  const n = numeric(value);
  return n !== null && !Number.isInteger(n);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

function buildTargets(cfg) {
  const single = argValue('--url');
  if (single) return [{ route: 'adhoc', viewport: cfg.viewports[0].name, url: single, vp: cfg.viewports[0] }];

  const manifestPath = path.join(cfg.__projectRoot, cfg.output.screenshotDir, 'capture-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Chưa có ${cfg.output.screenshotDir}/capture-manifest.json. Chạy capture-screens.mjs trước, hoặc dùng --url.`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    .shots.filter((s) => s.status === 'ok')
    .map((s) => ({
      route: s.route,
      viewport: s.viewport,
      url: s.finalUrl ?? joinUrl(cfg.baseUrl, s.path),
      vp: cfg.viewports.find((v) => v.name === s.viewport),
    }))
    .filter((t) => t.vp);
}

/** Tách token (đủ phổ biến) khỏi ứng viên drift (hiếm) trong một nhóm. */
function splitTokens(counts, thresholds) {
  const total = [...counts.values()].reduce((n, c) => n + c, 0);
  const tokens = [];
  const rare = [];

  for (const [value, count] of counts) {
    const share = count / total;
    const entry = { value, count, share: Number(share.toFixed(4)) };
    if (share >= thresholds.minShare && count >= thresholds.minCount) tokens.push(entry);
    else rare.push(entry);
  }
  tokens.sort((a, b) => b.count - a.count);
  rare.sort((a, b) => b.count - a.count);
  return { tokens, rare, total };
}

/**
 * ĐIỀU KIỆN KÉP để gọi là drift: vừa hiếm, vừa GẦN SÁT một token.
 * Thiếu vế "gần sát" thì check này báo mọi thứ hiếm gặp — màu accent dùng đúng một lần
 * cũng bị báo — và trở thành rác.
 */
function findDrift(group, tokens, rare, thresholds) {
  const drift = [];

  for (const candidate of rare) {
    if (isBrowserDerived(group.kind, candidate.value)) continue;
    let best = null;

    for (const token of tokens) {
      if (group.kind === 'color') {
        const d = deltaE(candidate.value, token.value);
        if (d <= thresholds.maxDeltaE && (!best || d < best.delta)) {
          best = { nearestToken: token.value, delta: Number(d.toFixed(2)), deltaKind: 'deltaE' };
        }
      } else {
        const cv = numeric(candidate.value);
        const tv = numeric(token.value);
        if (cv === null || tv === null || tv === 0 || cv === tv) continue;
        const rel = Math.abs(cv - tv) / tv;
        if (rel <= thresholds.maxNumericDrift && (!best || rel < best.delta)) {
          best = { nearestToken: token.value, delta: Number(rel.toFixed(4)), deltaKind: 'relative' };
        }
      }
    }

    if (best) drift.push({ group: group.name, findingType: group.findingType, value: candidate.value, count: candidate.count, ...best });
  }
  return drift;
}

async function main() {
  const cfg = loadConfig(process.cwd());
  const thresholds = { ...DEFAULTS, ...(cfg.audit.tokenDrift ?? {}) };
  const targets = buildTargets(cfg);
  if (!targets.length) throw new Error('Không có trang nào để thu thập style.');

  const allProps = [...new Set(Object.values(GROUPS).flatMap((g) => g.props))];
  const counts = new Map(); // group -> Map<value, count>
  for (const name of Object.keys(GROUPS)) counts.set(name, new Map());

  const propToGroup = new Map();
  for (const [name, g] of Object.entries(GROUPS)) for (const p of g.props) propToGroup.set(p, name);

  const browser = await launchBrowser();
  const visited = [];
  try {
    // Một viewport là đủ: token set không đổi theo bề rộng màn hình, mà chạy đủ
    // mọi viewport thì mỗi giá trị bị đếm lặp, làm sai tỉ lệ.
    const vp = targets[0].vp;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const seen = new Set();

    for (const target of targets) {
      if (seen.has(target.route)) continue;
      seen.add(target.route);

      const page = await context.newPage();
      try {
        await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await stabilizePage(page);
        const samples = await page.evaluate(collectStyles, allProps);

        for (const [prop, value] of samples) {
          const groupName = propToGroup.get(prop);
          const group = GROUPS[groupName];
          if (isNoise(group.kind, value)) continue;
          if (group.kind === 'color' && deltaE(value, value) === Infinity) continue; // màu không parse được / trong suốt
          const bucket = counts.get(groupName);
          bucket.set(value, (bucket.get(value) ?? 0) + 1);
        }
        visited.push({ route: target.route, url: page.url(), samples: samples.length });
        console.error(`  ${String(samples.length).padStart(5)} mẫu  ${target.route}`);
      } catch (e) {
        console.error(`  LỖI        ${target.route}: ${e.message.split('\n')[0]}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
    await context.close().catch(() => {});
  } finally {
    await browser.close();
  }

  const manual = cfg.audit.tokens ?? null;
  const tokensOut = {};
  const driftOut = [];

  for (const [name, group] of Object.entries(GROUPS)) {
    group.name = name;

    if (manual?.[name]) {
      // Project có design system thật → dùng khai báo, bỏ hẳn suy đoán cho nhóm này.
      const declared = manual[name].map((value) => ({ value, count: null, share: null, declared: true }));
      const { rare } = splitTokens(counts.get(name), thresholds);
      tokensOut[name] = declared;
      driftOut.push(...findDrift(group, declared, rare.filter((r) => !manual[name].includes(r.value)), thresholds));
      continue;
    }

    const { tokens, rare, total } = splitTokens(counts.get(name), thresholds);
    tokensOut[name] = tokens;
    if (tokens.length && total >= thresholds.minCount) driftOut.push(...findDrift(group, tokens, rare, thresholds));
  }

  // Bảng tra phẳng theo thuộc tính CSS — audit-checks tra thẳng computed style,
  // không cần biết gì về cách chia nhóm ở đây.
  const driftByProperty = {};
  for (const d of driftOut) {
    for (const prop of GROUPS[d.group].props) {
      driftByProperty[prop] ??= {};
      driftByProperty[prop][d.value] = {
        findingType: d.findingType,
        nearestToken: d.nearestToken,
        delta: d.delta,
        deltaKind: d.deltaKind,
        count: d.count,
      };
    }
  }

  const out = {
    inferred: !manual,
    note: 'Token set này SUY ĐOÁN từ computed style thực tế, không phải khai báo từ design system. Khai tay ở qa.config.json > audit.tokens để ghi đè.',
    thresholds,
    pagesVisited: visited,
    tokens: tokensOut,
    drift: driftOut,
    driftByProperty,
  };

  const outPath = path.join(cfg.__projectRoot, cfg.output.screenshotDir, 'inferred-tokens.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);

  console.error(
    `\n${Object.entries(tokensOut).map(([k, v]) => `${k}:${v.length}`).join(' · ')} token · ${driftOut.length} drift`
  );
  console.error(`ghi: ${path.relative(cfg.__projectRoot, outPath)}`);
}

try {
  await main();
} catch (e) {
  console.error(`LỖI ${e.message}`);
  process.exit(1);
}
