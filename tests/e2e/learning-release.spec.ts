import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

test('a beginner can skip placement and receives teaching before practice', async ({ page }) => {
  await page.goto('/learn/english-to-french/placement');
  await page.getByRole('link', { name: /start with teaching/i }).click();
  await expect(page.getByRole('heading', { name: 'How this works' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build it piece by piece' })).toBeVisible();
  await expect(page.getByText('I would like', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Worked example' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: /French: greeting politely/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeVisible();
});

test('Italian assessment can be skipped question by question and opens its recommended lesson', async ({ page }) => {
  await page.goto('/learn/english-to-italian/placement');
  for (let i = 0; i < 15; i++) await page.getByRole('button', { name: 'I don’t know yet' }).click();
  await expect(page.getByText('Starting at the beginning', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: /start learning/i }).click();
  await expect(page).toHaveURL(/concept=it-greet-politely/);
  await expect(page.getByText('vorrei', { exact: true })).toBeVisible();
});

test('real passkey registration, review persistence, and sign-in against Postgres', async ({ page, context }) => {
  test.skip(process.env.E2E_ACCOUNT_TEST !== '1', 'Requires the configured test database and a virtual authenticator');
  const accountIdentifier = `release-test-${crypto.randomUUID()}`;
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  try {
    await page.goto('/login');
    await page.getByLabel('Account name', { exact: true }).fill(accountIdentifier);
    const registration = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
    expect((await registration).status()).toBe(200);
    await expect(page.getByText('Saved to your account', { exact: true })).toBeVisible();
    const fresh = await (await context.request.get('/api/demo/progress')).json();
    expect(fresh).toMatchObject({ isPreview: false, xp: 0, dailyGoal: { completed: 0 } });
    await page.goto('/learn/english-to-french');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Your answer').fill('Bonjour, je voudrais un café, s’il vous plaît.');
    await page.getByRole('button', { name: 'Check my answer' }).click();
    const saved = page.waitForResponse(response => response.url().endsWith('/api/progress/review'));
    await page.getByRole('button', { name: 'I got it', exact: true }).click();
    expect((await saved).status()).toBe(200);
    const snapshot = await (await context.request.get('/api/demo/progress')).json();
    expect(snapshot).toMatchObject({ isPreview: false, xp: 10, dailyGoal: { completed: 1 } });
    await page.reload();
    await expect(page.getByRole('heading', { name: /French: ordering politely/i })).toBeVisible();
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByText('Preview progress', { exact: true })).toBeVisible();
    await page.goto('/login');
    const login = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Sign in with passkey', exact: true }).click();
    expect((await login).status()).toBe(200);
    await expect(page.getByText('Saved to your account', { exact: true })).toBeVisible();
    expect(await (await context.request.get('/api/demo/progress')).json()).toMatchObject({ xp: 10, dailyGoal: { completed: 1 } });
  } finally {
    await client.user.deleteMany({ where: { accountIdentifier } });
    await client.$disconnect();
  }
});
