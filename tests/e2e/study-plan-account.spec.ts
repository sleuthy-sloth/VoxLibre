import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

test('account plan drives practice and resumes on another browser', async ({ page, context, browser, baseURL }) => {
  test.skip(process.env.E2E_ACCOUNT_TEST !== '1', 'Requires disposable local Postgres and virtual passkeys');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const name = `study-plan-${crypto.randomUUID()}`;
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  let second;
  try {
    await page.goto('/login');
    await page.getByLabel('Account name', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
    await expect(page.getByText('Saved to your account', { exact: true })).toBeVisible();
    const user = await db.user.findUniqueOrThrow({ where: { accountIdentifier: name } });
    await page.goto('/learn/english-to-french/plan');
    await page.getByRole('button', { name: /save my plan/i }).click();
    await expect(page.getByText(/week 1 of/i)).toBeVisible();
    await expect.poll(() => db.studyPlan.count({ where: { userId: user.id } })).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('verbalibera_plan:english-to-french'))).toBeNull();
    await page.goto('/learn/english-to-french');
    await expect(page.getByText(/Step 1 of/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText(/Step 2 of.*Drill sprint/)).toBeVisible();
    await page.getByRole('button', { name: 'I got it', exact: true }).click();
    await expect.poll(() => db.userProgress.count({ where: { userId: user.id, drillItemId: 'fr-greet-politely-drill', lastQuality: { gte: 3 } } })).toBe(1);

    second = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, storageState: { cookies: await context.cookies(), origins: [] } });
    const secondPage = await second.newPage();
    await secondPage.goto('/learn/english-to-french/plan');
    await expect(secondPage.getByRole('checkbox').first()).toBeChecked();
    await expect(secondPage.getByRole('checkbox').first()).toBeDisabled();
    expect(await secondPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await secondPage.goto('/?course=english-to-french');
    await expect(secondPage.getByRole('link', { name: /review your study plan/i })).toBeVisible();
    await secondPage.goto('/learn/english-to-french');
    await expect(secondPage.getByRole('heading', { name: /French: ordering politely/ })).toBeVisible();
    await secondPage.goto('/learn/english-to-french/plan');
    await secondPage.getByRole('button', { name: /start over with a new plan/i }).click();
    await expect(secondPage.getByRole('button', { name: /save my plan/i })).toBeVisible();
    expect(await db.studyPlan.count({ where: { userId: user.id } })).toBe(0);
    // Resetting a plan preserves the learner's practice history.
    expect(await db.userProgress.count({ where: { userId: user.id } })).toBe(1);
    // A placement-derived stretch drill must be reachable from its own plan row.
    await secondPage.evaluate(() => localStorage.setItem('verbalibera_placement:english-to-french', JSON.stringify({ startCefr: 'A2', startConceptId: 'fr-ordering-politely' })));
    await secondPage.reload();
    await secondPage.getByRole('button', { name: /save my plan/i }).click();
    const drillLink = secondPage.locator('a[href*="drill=fr-ordering-politely-cloze"]');
    await expect(drillLink).toBeVisible();
    await drillLink.click();
    await secondPage.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(secondPage.getByText(/Hier soir, nous/).first()).toBeVisible();
    await secondPage.getByRole('button', { name: 'I got it', exact: true }).click();
    await expect.poll(() => db.userProgress.count({ where: { userId: user.id, drillItemId: 'fr-ordering-politely-cloze', lastQuality: { gte: 3 } } })).toBe(1);
  } finally {
    await second?.close();
    await db.user.deleteMany({ where: { accountIdentifier: name } });
    await db.$disconnect();
  }
});
