#!/usr/bin/env node
/**
 * config-loader.mjs — module dùng chung cho cả qa-visual và qa-review.
 * Zero-dependency: chỉ node:fs, node:path, node:process.
 *
 * export loadConfig(cwd)  -> object config đã merge default + validate
 * export loadSecrets(cwd, required[]) -> object env, throw nếu thiếu biến bắt buộc
 *   Secret xếp tầng: process.env > .env của project > ~/.claude/qa-skill/.env (dùng chung mọi repo)
 *
 * Chạy trực tiếp (`node config-loader.mjs [dir]`) để validate config:
 * exit 0 khi hợp lệ, exit 1 kèm danh sách lỗi khi sai.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const CONFIG_FILE = 'qa.config.json';

/**
 * Kho secret dùng chung cho mọi repo. Skill vẫn cài per-repo, nhưng credential R2
 * là một — nhập 1 lần ở đây thay vì chép lại vào .env của từng project.
 */
export const GLOBAL_DIR = path.join(os.homedir(), '.claude', 'qa-skill');
export const GLOBAL_ENV_FILE = path.join(GLOBAL_DIR, '.env');

/** Giá trị mặc định — chỉ áp cho field KHÔNG bắt buộc. */
const DEFAULTS = {
  viewports: [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ],
  auth: {
    mode: 'none',
    loginUrl: '/login',
    emailSelector: '',
    passwordSelector: '',
    submitSelector: '',
    readySelector: '',
    statePath: '.auth/state.json',
    stateMaxAgeHours: 8,
  },
  audit: { alignTolerancePx: [1, 8], ignoreSelectors: [], minElementArea: 4 },
  output: { screenshotDir: '.qa-screenshots', reportDir: 'plans/reports' },
  r2: { endpoint: '', bucket: '', publicBaseUrl: '' },
};

/** Merge nông 1 cấp: object con được merge key-by-key, mảng thì thay nguyên cụm. */
function mergeDefaults(raw) {
  const out = { ...raw };
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (Array.isArray(def)) {
      out[key] = raw[key] ?? def;
    } else if (def && typeof def === 'object') {
      out[key] = { ...def, ...(raw[key] ?? {}) };
    }
  }
  return out;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Trả về mảng message lỗi. Rỗng = hợp lệ. Mỗi message nêu rõ field path. */
function validate(cfg) {
  const errors = [];

  // baseUrl
  if (typeof cfg.baseUrl !== 'string' || !cfg.baseUrl.trim()) {
    errors.push('baseUrl: bắt buộc, phải là chuỗi URL');
  } else {
    try {
      new URL(cfg.baseUrl);
    } catch {
      errors.push(`baseUrl: "${cfg.baseUrl}" không phải URL hợp lệ`);
    }
  }

  // routes — bắt buộc, không có auto-detect lúc runtime
  if (!Array.isArray(cfg.routes) || cfg.routes.length === 0) {
    errors.push('routes: bắt buộc, phải là mảng không rỗng');
  } else {
    const seenNames = new Map();
    cfg.routes.forEach((r, i) => {
      if (!isPlainObject(r)) {
        errors.push(`routes[${i}]: phải là object { path, name }`);
        return;
      }
      if (typeof r.path !== 'string' || !r.path.startsWith('/')) {
        errors.push(`routes[${i}].path: bắt buộc, phải bắt đầu bằng "/"`);
      }
      if (typeof r.name !== 'string' || !r.name.trim()) {
        errors.push(`routes[${i}].name: bắt buộc, không được rỗng`);
      } else if (seenNames.has(r.name)) {
        errors.push(`routes[${i}].name: bị trùng với routes[${seenNames.get(r.name)}].name`);
      } else {
        seenNames.set(r.name, i);
      }
    });
  }

  // viewports
  if (!Array.isArray(cfg.viewports) || cfg.viewports.length === 0) {
    errors.push('viewports: phải là mảng không rỗng');
  } else {
    cfg.viewports.forEach((v, i) => {
      if (!isPlainObject(v)) {
        errors.push(`viewports[${i}]: phải là object { name, width, height }`);
        return;
      }
      if (typeof v.name !== 'string' || !v.name.trim()) {
        errors.push(`viewports[${i}].name: bắt buộc`);
      }
      for (const dim of ['width', 'height']) {
        if (!Number.isInteger(v[dim]) || v[dim] <= 0) {
          errors.push(`viewports[${i}].${dim}: phải là số nguyên dương`);
        }
      }
    });
  }

  // auth
  // none   = app không cần đăng nhập (hoặc dev env đã seed sẵn session)
  // form   = app có form email/password của chính nó, script tự điền
  // manual = dev tự login 1 lần trong browser headed, script lưu lại session
  const MODES = ['none', 'form', 'manual'];
  const modeOk = MODES.includes(cfg.auth.mode);
  if (!modeOk) {
    // Mode sai thì mọi kiểm tra phụ thuộc mode đều vô nghĩa — báo thêm chỉ làm nhiễu.
    errors.push(`auth.mode: "${cfg.auth.mode}" không hợp lệ, phải thuộc ${MODES.join('|')}`);
  }
  if (modeOk && cfg.auth.mode !== 'none') {
    // readySelector là tín hiệu duy nhất biết login đã xong — không có thì capture chụp nhầm trang login
    if (!cfg.auth.readySelector) {
      errors.push(`auth.readySelector: bắt buộc khi auth.mode = "${cfg.auth.mode}"`);
    }
    if (!cfg.auth.statePath) {
      errors.push(`auth.statePath: bắt buộc khi auth.mode = "${cfg.auth.mode}"`);
    }
  }
  if (modeOk && cfg.auth.mode === 'form') {
    for (const field of ['emailSelector', 'passwordSelector', 'submitSelector']) {
      if (!cfg.auth[field]) {
        errors.push(`auth.${field}: bắt buộc khi auth.mode = "form"`);
      }
    }
  }

  // audit
  const tol = cfg.audit.alignTolerancePx;
  if (!Array.isArray(tol) || tol.length !== 2 || !tol.every((n) => typeof n === 'number' && n >= 0)) {
    errors.push('audit.alignTolerancePx: phải là mảng 2 số không âm [warn, error]');
  } else if (tol[0] > tol[1]) {
    errors.push(`audit.alignTolerancePx: ngưỡng warn (${tol[0]}) phải ≤ ngưỡng error (${tol[1]})`);
  }
  if (!Array.isArray(cfg.audit.ignoreSelectors)) {
    errors.push('audit.ignoreSelectors: phải là mảng chuỗi selector');
  }

  // output
  for (const key of ['screenshotDir', 'reportDir']) {
    if (typeof cfg.output[key] !== 'string' || !cfg.output[key].trim()) {
      errors.push(`output.${key}: bắt buộc, không được rỗng`);
    }
  }

  return errors;
}

/**
 * Đọc + validate qa.config.json tại `cwd`.
 * Throw Error kèm toàn bộ danh sách lỗi (không dừng ở lỗi đầu tiên).
 */
export function loadConfig(cwd = process.cwd()) {
  const file = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`Không tìm thấy ${CONFIG_FILE} tại ${cwd}. Chạy install.sh để tạo từ template.`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${CONFIG_FILE} không phải JSON hợp lệ: ${e.message}`);
  }
  if (!isPlainObject(raw)) {
    throw new Error(`${CONFIG_FILE}: root phải là object`);
  }

  const cfg = mergeDefaults(raw);
  const errors = validate(cfg);
  if (errors.length) {
    throw new Error(`${CONFIG_FILE} không hợp lệ:\n  - ${errors.join('\n  - ')}`);
  }

  cfg.__configPath = file;
  cfg.__projectRoot = cwd;
  return cfg;
}

/** Parser .env tối giản: KEY=VALUE, bỏ qua comment/dòng trống, gỡ nháy bao ngoài. */
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

/**
 * Bỏ mọi key có giá trị rỗng khỏi một tầng secret.
 * Hai nguồn đều sinh ra key rỗng: install.sh chép .env.example thành .env với mọi key
 * để trống, và Docker `-e VAR` / một số CI export biến rỗng. Giữ lại thì chúng che mất
 * giá trị thật ở tầng dưới, gây báo "thiếu biến" cho người vừa nhập credential xong.
 */
function stripEmpty(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => String(v ?? '').trim() !== ''));
}

/** Đọc 1 file .env, bỏ luôn các key có giá trị rỗng. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return stripEmpty(parseEnv(fs.readFileSync(file, 'utf8')));
}

/**
 * Gom secret theo thứ tự ưu tiên tăng dần:
 *   ~/.claude/qa-skill/.env  (nhập 1 lần, dùng cho mọi repo)
 *   <project>/.env           (ghi đè riêng cho repo này)
 *   process.env              (CI truyền thẳng, thắng tất cả)
 * KHÔNG BAO GIỜ log giá trị; chỉ nêu TÊN biến thiếu.
 */
export function loadSecrets(cwd = process.cwd(), required = []) {
  const projectFile = path.join(cwd, '.env');
  const env = { ...readEnvFile(GLOBAL_ENV_FILE), ...readEnvFile(projectFile), ...stripEmpty(process.env) };

  const missing = required.filter((k) => !env[k] || !String(env[k]).trim());
  if (missing.length) {
    const isR2 = missing.some((k) => k.startsWith('R2_'));
    throw new Error(
      `Thiếu biến môi trường: ${missing.join(', ')}\n` +
        (isR2
          ? `  Chạy 1 lần cho mọi repo: node .claude/skills/qa-visual/scripts/setup-r2.mjs\n`
          : '') +
        `  Hoặc khai trong ${projectFile} / ${GLOBAL_ENV_FILE}, hoặc export ra shell. Xem .env.example.`
    );
  }
  return env;
}

// CLI: validate config, in tóm tắt. Dùng cho smoke test và cho user tự kiểm.
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirectRun) {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  try {
    const cfg = loadConfig(target);
    const shots = cfg.routes.length * cfg.viewports.length;
    console.log(`OK  ${cfg.__configPath}`);
    console.log(`    baseUrl   ${cfg.baseUrl}`);
    console.log(`    routes    ${cfg.routes.length} × viewports ${cfg.viewports.length} = ${shots} ảnh`);
    console.log(`    auth.mode ${cfg.auth.mode}`);
    process.exit(0);
  } catch (e) {
    console.error(`LỖI ${e.message}`);
    process.exit(1);
  }
}
