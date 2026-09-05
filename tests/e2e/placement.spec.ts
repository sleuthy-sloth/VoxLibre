import { test, expect } from '@playwright/test';

test('French placement exits early for a learner who needs foundations', async ({ page }) => {
  await page.goto('/learn/english-to-french/placement');

  await expect(page.getByText(/placement · question 1/i)).toBeVisible();

  await page.getByRole('radio').last().check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('radio').last().check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel(/your answer/i).fill('wrong answer');
  await page.getByRole('button', { name: 'See my result' }).click();

  await expect(page.getByText(/starting at the beginning/i)).toBeVisible();
  await expect(page.getByText(/0 of 3/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /build my learning plan/i })).toHaveAttribute(
    'href',
    '/learn/english-to-french/plan',
    /^\/learn\/english-to-french\?concept=fr-/,
  );
});

test('dashboard links to the placement quiz', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: /take the 3-minute placement quiz/i }),
  ).toHaveAttribute('href', /\/learn\/.*\/placement/);
});

test('Italian placement checks available beginner patterns', async ({ page }) => {
  await page.goto('/learn/english-to-italian/placement');
  await expect(page.getByText(/placement · question 1 of 8/i)).toBeVisible();
});
