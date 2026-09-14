#!/usr/bin/env node
/**
 * scaffold-playwright.mjs — chuyển ma trận scenario của qa-review thành file test Playwright runnable.
 * Tuân thủ triết lý Paired Executable Oracle: biến kịch bản lý thuyết thành code test có thể chạy RED -> GREEN.
 *
 *   node scaffold-playwright.mjs                                 # tự tìm report mới nhất trong plans/reports/
 *   node scaffold-playwright.mjs --report plans/reports/x.md     # chỉ định report cụ thể
 *   node scaffold-playwright.mjs --out tests/e2e/qa.spec.ts      # đường dẫn file test đầu ra
 *   node scaffold-playwright.mjs --dry-run                       # in code test ra stdout, không ghi file
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

function findLatestReport(cwd) {
  const searchDirs = [
    path.join(cwd, 'plans', 'reports'),
    path.join(cwd, '.qa-reports'),
    cwd,
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('qa-review-') && f.endsWith('.md'))
      .map((f) => path.join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

    if (files.length > 0) return files[0];
  }
  return null;
}

export function parseScenariosFromMarkdown(markdown) {
  const lines = markdown.split('\n');
  const scenarios = [];
  let inScenarioSection = false;
  let tableHeaderFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#') && (trimmed.includes('Ma trận scenario') || trimmed.includes('Scenario'))) {
      inScenarioSection = true;
      continue;
    }

    if (inScenarioSection && trimmed.startsWith('#') && !trimmed.includes('Scenario')) {
      break;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cols = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      if (cols.length >= 5) {
        if (!tableHeaderFound) {
          if (cols.some((c) => c.toLowerCase().includes('trục') || c.toLowerCase().includes('thao tác'))) {
            tableHeaderFound = true;
          }
          continue;
        }

        if (cols[0].startsWith('---') || cols[0].startsWith(':-')) continue;

        const [num, axis, precondition, action, expected, priority] = cols;
        scenarios.push({
          num: num || String(scenarios.length + 1),
          axis: axis || 'Happy',
          precondition: precondition || '',
          action: action || '',
          expected: expected || '',
          priority: (priority || 'P1').toUpperCase(),
        });
      }
    }
  }

  return scenarios;
}

export function generatePlaywrightSpec(scenarios, options = {}) {
  const title = options.title || 'QA Acceptance Scenarios';
  const baseUrl = options.baseUrl || '/';

  const codeBlocks = scenarios.map((s) => {
    const cleanAction = s.action.replace(/[`"]/g, "'").slice(0, 70);
    const testTitle = `[${s.priority}] [${s.axis}] TC${s.num.padStart(2, '0')}: ${cleanAction}`;

    return `  // ---------------------------------------------------------------------------
  // TC${s.num}: ${s.axis} (${s.priority})
  // Tiền đề : ${s.precondition.replace(/\n/g, ' ')}
  // Thao tác: ${s.action.replace(/\n/g, ' ')}
  // Kỳ vọng : ${s.expected.replace(/\n/g, ' ')}
  // ---------------------------------------------------------------------------
  test('${testTitle}', async ({ page }) => {
    // 1. Thiết lập tiền đề / Điều hướng
    await page.goto('${baseUrl}');

    // 2. Thao tác: ${s.action}
    // TODO: Bổ sung các bước tương tác (click, fill, select...)

    // 3. Nghiệm thu kết quả: ${s.expected}
    // TODO: Bổ sung assertion kiểm chứng (expect(...).toBeVisible()...)
  });`;
  });

  return `import { test, expect } from '@playwright/test';

/**
 * Tự động sinh bởi qa-review (scaffold-playwright.mjs).
 * Khung test nghiệm thu theo chuẩn Paired Executable Oracle (RED -> GREEN).
 */
test.describe('${title}', () => {
${codeBlocks.join('\n\n')}
});
`;
}

async function main() {
  const cwd = process.cwd();
  const reportPath = argValue('--report') || findLatestReport(cwd);
  const isDryRun = process.argv.includes('--dry-run');
  const outPath = argValue('--out') || path.join(cwd, 'tests', 'e2e', 'qa-acceptance.spec.ts');

  let markdown = '';
  if (reportPath && fs.existsSync(reportPath)) {
    console.error(`Đọc kịch bản từ: ${path.relative(cwd, reportPath)}`);
    markdown = fs.readFileSync(reportPath, 'utf8');
  } else if (!process.stdin.isTTY) {
    markdown = fs.readFileSync(0, 'utf8');
  } else {
    console.error('LỖI: Không tìm thấy qa-review report nào. Hãy chỉ định --report <path> hoặc pipe markdown qua stdin.');
    process.exit(1);
  }

  const scenarios = parseScenariosFromMarkdown(markdown);
  if (!scenarios.length) {
    console.error('CẢNH BÁO: Không tìm thấy bảng scenario nào trong report.');
    process.exit(0);
  }

  console.error(`Tìm thấy ${scenarios.length} test scenario(s) (${scenarios.filter((s) => s.priority === 'P0').length} P0).`);

  const specCode = generatePlaywrightSpec(scenarios, {
    title: `QA Acceptance Criteria (${path.basename(reportPath || 'report.md', '.md')})`,
  });

  if (isDryRun) {
    console.log(specCode);
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, specCode, 'utf8');
  console.error(`Đã sinh file test: ${path.relative(cwd, outPath)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  await main();
}
