import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = require(playwrightModule);

const outDir = path.join(os.tmpdir(), `darkpool-ui-audit-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  outDir,
  url: 'http://127.0.0.1:5173',
  steps: [],
  inventory: [],
  downloads: [],
  screenshots: [],
  console: [],
  pageErrors: [],
  failedRequests: [],
  httpErrors: [],
  ignoredExternalFailures: [],
  failures: [],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeName = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const recordStep = (name, detail = {}) => {
  report.steps.push({ name, detail, at: new Date().toISOString() });
};

const recordFailure = (name, error) => {
  report.failures.push({
    name,
    message: error?.message || String(error),
    at: new Date().toISOString(),
  });
};

const safe = async (name, fn) => {
  try {
    const result = await fn();
    recordStep(name, result || {});
    return result;
  } catch (error) {
    recordFailure(name, error);
    return null;
  }
};

const visible = async (locator) => {
  try {
    return await locator.isVisible({ timeout: 800 });
  } catch {
    return false;
  }
};

const waitSettled = async (page) => {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await sleep(250);
};

const saveScreenshot = async (page, label) => {
  const fileName = `${String(report.screenshots.length + 1).padStart(2, '0')}-${label}.png`
    .replace(/[^a-z0-9._-]+/gi, '-')
    .toLowerCase();
  const filePath = path.join(outDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  report.screenshots.push(filePath);
};

const buttonByName = (page, name) => (
  page.getByRole('button', { name: new RegExp(escapeRegex(name), 'i') })
);

const firstVisible = async (locator) => {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await visible(candidate)) return candidate;
  }
  return null;
};

const clickButton = async (page, name, options = {}) => {
  const locator = await firstVisible(buttonByName(page, name));
  if (!locator) throw new Error(`Button not visible: ${name}`);
  if (options.download) {
    const downloadPromise = page.waitForEvent('download', { timeout: 2500 }).catch(() => null);
    await locator.click({ timeout: 2500 });
    const download = await downloadPromise;
    if (download) {
      const filePath = path.join(outDir, download.suggestedFilename());
      await download.saveAs(filePath);
      report.downloads.push(filePath);
    }
  } else {
    await locator.click({ timeout: 2500 });
  }
  await waitSettled(page);
};

const setInputValue = async (locator, value) => {
  await locator.evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

const exerciseVisibleInputs = async (page, label, scope = page.locator('body')) => {
  const inputs = scope.locator('input, textarea, select');
  const count = await inputs.count();
  let touched = 0;

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    if (!(await visible(input))) continue;

    const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
    const type = tagName === 'input'
      ? await input.evaluate((el) => (el.getAttribute('type') || 'text').toLowerCase())
      : tagName;

    if (tagName === 'select') {
      const values = await input.locator('option').evaluateAll((options) => options.map((option) => option.value));
      for (const value of [...new Set([values.at(-1), values[0]].filter(Boolean))]) {
        await input.selectOption(value);
        await sleep(100);
        touched += 1;
      }
      continue;
    }

    if (type === 'checkbox') {
      await input.check({ force: true }).catch(async () => input.click({ force: true }));
      await sleep(75);
      await input.uncheck({ force: true }).catch(async () => input.click({ force: true }));
      touched += 1;
      continue;
    }

    if (type === 'range') {
      const min = await input.evaluate((el) => el.getAttribute('min') || '0');
      const max = await input.evaluate((el) => el.getAttribute('max') || '100');
      await setInputValue(input, max);
      await sleep(75);
      await setInputValue(input, min);
      touched += 2;
      continue;
    }

    if (type === 'number') {
      const min = await input.evaluate((el) => Number(el.getAttribute('min') || '0'));
      await input.fill(String(Math.max(min, 1)));
      touched += 1;
      continue;
    }

    if (type === 'time') {
      await input.fill(index % 2 === 0 ? '09:30' : '16:00');
      touched += 1;
      continue;
    }

    if (type === 'password') {
      await input.fill('codex-test-key');
      touched += 1;
      continue;
    }

    if (type === 'url') {
      await input.fill(`https://example.test/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
      touched += 1;
      continue;
    }

    if (tagName === 'textarea') {
      const readOnly = await input.evaluate((el) => el.readOnly);
      if (!readOnly) {
        await input.fill('{"settings":{"theme":"DEFAULT","provider":"finra"}}');
        touched += 1;
      }
      continue;
    }

    await input.fill(label === 'Trade Intent' ? 'NVDA' : 'AAPL');
    touched += 1;
  }

  recordStep(`inputs:${label}`, { visibleControls: count, touched });
};

const snapshotInventory = async (page, label) => {
  const items = await page.locator('button,input,select,textarea,a').evaluateAll((elements) => (
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const visibleElement = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        const text = element.innerText || element.value || element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.name || element.id || '';
        return {
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || '',
          text: text.replace(/\s+/g, ' ').trim().slice(0, 120),
          disabled: Boolean(element.disabled),
          visible: visibleElement,
        };
      })
      .filter((item) => item.visible)
  ));

  report.inventory.push({
    label,
    total: items.length,
    buttons: items.filter((item) => item.tag === 'button').length,
    inputs: items.filter((item) => item.tag === 'input').length,
    selects: items.filter((item) => item.tag === 'select').length,
    textareas: items.filter((item) => item.tag === 'textarea').length,
    disabled: items.filter((item) => item.disabled).length,
    items,
  });
};

const clickAllVisibleIn = async (page, label, locator, options = {}) => {
  const clicked = [];
  const max = options.max || 30;
  for (let pass = 0; pass < max; pass += 1) {
    const handles = await locator.locator('button').elementHandles();
    let candidate = null;
    for (let index = 0; index < handles.length; index += 1) {
      const button = await handles[index].evaluate((element, buttonIndex) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const name = element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '';
        return {
          index: buttonIndex,
          name: name.replace(/\s+/g, ' ').trim(),
          disabled: Boolean(element.disabled),
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        };
      }, index);
      if (
        button.visible &&
        !button.disabled &&
        !clicked.includes(`${button.index}:${button.name}`) &&
        (button.name || options.includeUnnamed) &&
        !(options.exclude || []).some((pattern) => pattern.test(button.name))
      ) {
        candidate = { ...button, handle: handles[index] };
        break;
      }
    }
    if (!candidate) break;
    await candidate.handle.scrollIntoViewIfNeeded().catch(() => {});
    await candidate.handle.click({ timeout: 2500 }).catch((error) => recordFailure(`${label}:button:${candidate.name || candidate.index}`, error));
    clicked.push(`${candidate.index}:${candidate.name}`);
    await waitSettled(page);
  }
  recordStep(`buttons:${label}`, { clicked: clicked.length, names: clicked });
};

const navigateView = async (page, label) => {
  const nav = page.locator('nav[aria-label="Primary views"]');
  const button = await firstVisible(nav.getByRole('button', { name: new RegExp(escapeRegex(label), 'i') }));
  if (!button) throw new Error(`Primary view button not found: ${label}`);
  await button.click();
  await waitSettled(page);
};

const exerciseDashboard = async (page) => {
  await safe('dashboard:pause-resume', async () => {
    await clickButton(page, 'Pause');
    await clickButton(page, 'Resume');
  });
  await safe('dashboard:reset', async () => clickButton(page, 'Reset simulation'));

  for (const label of ['1H', '4H', '1D']) {
    await safe(`dashboard:timeframe:${label}`, async () => clickButton(page, label));
  }

  await safe('dashboard:stock-select', async () => {
    const select = page.locator('select').first();
    for (const value of ['NVDA', 'TSLA', 'ALL']) {
      await select.selectOption(value);
      await waitSettled(page);
    }
  });
  await safe('dashboard:sliders-checkboxes-sorts', async () => exerciseVisibleInputs(page, 'Dashboard'));
  await safe('dashboard:greeks', async () => {
    for (const codePoint of ['U+0394', 'U+0393', 'U+0398', 'U+03BD', 'U+03C1']) {
      const label = page.locator(`[aria-label*="${codePoint}"]`).first();
      await label.click({ force: true });
      await sleep(80);
    }
  });
  await safe('dashboard:export-csv', async () => clickButton(page, 'Export CSV', { download: true }));
  await safe('dashboard:clear-filters', async () => {
    const button = await firstVisible(buttonByName(page, 'Clear Filters'));
    if (button) {
      await button.click();
      await waitSettled(page);
    }
  });
  await safe('dashboard:pulse-cards', async () => clickAllVisibleIn(page, 'Dashboard Pulse', page.locator('section[aria-label="Session pulse"]'), { max: 8 }));
  await safe('dashboard:focus-queue', async () => clickAllVisibleIn(page, 'Focus Queue', page.locator('section[aria-label="Operator focus queue"]'), { max: 12 }));
  for (const symbol of ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA']) {
    await safe(`dashboard:stock-card:${symbol}`, async () => {
      const button = await firstVisible(page.getByRole('button', { name: new RegExp(symbol) }));
      if (!button) throw new Error(`Stock card not visible: ${symbol}`);
      await button.click();
      await waitSettled(page);
    });
  }
};

const exerciseSettings = async (page) => {
  await safe('settings:open', async () => clickButton(page, 'Settings'));
  const modal = page.locator('.fixed.inset-0.z-50');
  await modal.waitFor({ state: 'visible', timeout: 5000 });

  const tabs = ['Appearance', 'Profile', 'Layout', 'Cards', 'Providers', 'Integrations', 'Alerts', 'Tutorial'];
  for (const tab of tabs) {
    await safe(`settings:tab:${tab}`, async () => {
      await modal.getByRole('button', { name: new RegExp(escapeRegex(tab), 'i') }).click();
      await waitSettled(page);
      await snapshotInventory(page, `Settings:${tab}`);
      await saveScreenshot(page, `settings-${tab}`);
      await exerciseVisibleInputs(page, `Settings:${tab}`, modal);

      if (tab === 'Appearance') {
        for (const button of ['Default', 'Cyberpunk', 'Matrix', 'Fire/Ice', 'Monochrome', 'Area', 'Bar', 'Line', 'Candlestick']) {
          const match = await firstVisible(modal.getByRole('button', { name: new RegExp(escapeRegex(button), 'i') }));
          if (match) await match.click();
        }
      }
      if (tab === 'Profile') {
        await clickButton(page, 'Export JSON');
        await clickButton(page, 'Download File', { download: true });
        const exportText = await modal.locator('textarea').first().inputValue();
        await modal.locator('textarea').nth(1).fill(exportText || '{"settings":{"theme":"DEFAULT","provider":"finra"}}');
        await clickButton(page, 'Apply Import');
        await clickButton(page, 'Reset Defaults');
      }
      if (tab === 'Layout') {
        for (const button of ['GRID', 'LIST', 'HEATMAP']) {
          const match = await firstVisible(modal.getByRole('button', { name: new RegExp(button, 'i') }));
          if (match) await match.click();
        }
      }
      if (tab === 'Cards') {
        for (const button of ['compact', 'normal', 'expanded']) {
          const match = await firstVisible(modal.getByRole('button', { name: new RegExp(button, 'i') }));
          if (match) await match.click();
        }
      }
      if (tab === 'Providers') {
        const finra = await firstVisible(modal.getByRole('button', { name: /FINRA/i }));
        if (finra) await finra.click();
      }
      if (tab === 'Alerts') {
        const toggles = modal.locator('button.w-12');
        const toggleCount = await toggles.count();
        for (let index = 0; index < toggleCount; index += 1) {
          await toggles.nth(index).click();
          await sleep(100);
          await toggles.nth(index).click();
        }
      }
    });
  }

  await safe('settings:close', async () => {
    await page.locator('button.absolute.top-4.right-4').click();
    await waitSettled(page);
  });
};

const exerciseIntent = async (page) => {
  for (const label of ['Balanced', 'Momentum', 'Defensive']) {
    await safe(`intent:preset:${label}`, async () => clickButton(page, label));
  }
  await safe('intent:inputs', async () => exerciseVisibleInputs(page, 'Trade Intent'));
  for (const label of ['Buy', 'Sell', 'Pulse', 'Source Gate', 'Price', 'Liquidity', 'News']) {
    await safe(`intent:toggle:${label}`, async () => clickButton(page, label));
  }
  await safe('intent:refresh', async () => clickButton(page, 'Refresh Intent'));
};

const exerciseGenericWorkspace = async (page, label) => {
  await safe(`${label}:inputs`, async () => exerciseVisibleInputs(page, label));
  await safe(`${label}:buttons`, async () => clickAllVisibleIn(page, label, page.locator('body'), {
    max: 40,
    exclude: primaryViewExcludes,
  }));
};

const primaryViewExcludes = [
  /Dashboard/i,
  /Intent/i,
  /Options/i,
  /Scanner/i,
  /Flow Map/i,
  /Alerts/i,
  /Watchlist/i,
  /Replay/i,
  /Admin/i,
  /Health/i,
  /Settings/i,
];

const exerciseWatchlist = async (page) => {
  await exerciseGenericWorkspace(page, 'Watchlist');
  await safe('watchlist:create', async () => {
    const newButton = await firstVisible(buttonByName(page, 'New'));
    if (newButton) await newButton.click();
    await page.locator('input[placeholder="Desk review"]').fill('Codex Audit');
    await page.locator('input[placeholder="AAPL, NVDA, MSFT"]').fill('AAPL, NVDA, MSFT');
    await clickButton(page, 'Create');
  });
};

const exerciseAdmin = async (page) => {
  for (const tab of ['API Keys', 'Audit Log', 'Retention']) {
    await safe(`admin:tab:${tab}`, async () => {
      await clickButton(page, tab);
      await waitSettled(page);
      await snapshotInventory(page, `Admin:${tab}`);
      await exerciseVisibleInputs(page, `Admin:${tab}`);
      await clickAllVisibleIn(page, `Admin:${tab}`, page.locator('body'), {
        max: 12,
        exclude: [...primaryViewExcludes, /Audit Log/i, /Retention/i, /API Keys/i],
      });
    });
  }
};

const main = async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE || chromium.executablePath(),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      const location = message.location();
      if (location.url.includes('fonts.googleapis.com')) {
        report.ignoredExternalFailures.push({ type: 'console', text: message.text(), location });
        return;
      }
      report.console.push({ type: message.type(), text: message.text(), location });
    }
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push({ message: error.message, stack: error.stack });
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('fonts.googleapis.com')) {
      report.ignoredExternalFailures.push({
        type: 'requestfailed',
        method: request.method(),
        url: request.url(),
        failure: request.failure()?.errorText,
      });
      return;
    }
    report.failedRequests.push({
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText,
    });
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400 && !response.url().includes('favicon')) {
      report.httpErrors.push({
        status,
        method: response.request().method(),
        url: response.url(),
      });
    }
  });

  await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('nav[aria-label="Primary views"]').waitFor({ state: 'visible', timeout: 15000 });
  await waitSettled(page);
  await snapshotInventory(page, 'Initial Dashboard');
  await saveScreenshot(page, 'dashboard-initial');

  await exerciseDashboard(page);
  await saveScreenshot(page, 'dashboard-after-controls');
  await exerciseSettings(page);
  await saveScreenshot(page, 'settings-closed');

  const views = ['Intent', 'Options', 'Scanner', 'Flow Map', 'Alerts', 'Watchlist', 'Replay', 'Admin', 'Health'];
  for (const view of views) {
    await safe(`view:navigate:${view}`, async () => navigateView(page, view));
    await snapshotInventory(page, `View:${view}`);
    await saveScreenshot(page, `view-${view}`);

    if (view === 'Intent') {
      await exerciseIntent(page);
    } else if (view === 'Watchlist') {
      await exerciseWatchlist(page);
    } else if (view === 'Admin') {
      await exerciseAdmin(page);
    } else {
      await exerciseGenericWorkspace(page, view);
    }
    await saveScreenshot(page, `view-${view}-after-controls`);
  }

  await context.close();
  await browser.close();

  report.finishedAt = new Date().toISOString();
  report.summary = {
    steps: report.steps.length,
    failures: report.failures.length,
    consoleMessages: report.console.length,
    pageErrors: report.pageErrors.length,
    failedRequests: report.failedRequests.length,
    httpErrors: report.httpErrors.length,
    ignoredExternalFailures: report.ignoredExternalFailures.length,
    downloads: report.downloads.length,
    screenshots: report.screenshots.length,
    inventorySnapshots: report.inventory.length,
  };

  const reportPath = path.join(outDir, 'ui-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, summary: report.summary }, null, 2));

  if (report.failures.length || report.pageErrors.length || report.failedRequests.length || report.httpErrors.length) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  recordFailure('audit:fatal', error);
  const reportPath = path.join(outDir, 'ui-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error(JSON.stringify({ reportPath, fatal: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
