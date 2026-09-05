import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.QA_BASE_URL ?? 'http://localhost:3210';
const report = [];
mkdirSync('docs/astra/screenshots', { recursive: true });
mkdirSync('docs/astra/reports', { recursive: true });
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const language of ['italian', 'french']) {
    await page.goto(`${base}/courses/${language}`);
    await page.getByRole('button', { name: 'Names and introductions', exact: true }).click();
    await page.screenshot({ path: `docs/astra/screenshots/${name}-${language}-390.png` });
    for (const width of [320, 390, 430, 844, 1280]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${language} overflow at ${width}`);
    }
    await page.addScriptTag({ content: readFileSync('node_modules/axe-core/axe.min.js', 'utf8') });
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
    report.push({ engine: name, language, widths: [320, 390, 430, 844, 1280], violations });
    assert.equal(violations.length, 0, `${name}/${language} accessibility violations: ${JSON.stringify(violations)}`);
    if (name === 'chromium' && language === 'italian') {
      await page.getByRole('button', { name: 'Course', exact: true }).click();
      await page.screenshot({ path: 'docs/astra/screenshots/chromium-course-1280.png' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }
  assert.deepEqual(errors, [], `${name} browser exceptions`);
  await browser.close();
}
writeFileSync('docs/astra/reports/browser-qa.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
