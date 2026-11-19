// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Authentication & Session E2E Flows', () => {
  test('unauthenticated visitor to / is served the login portal with Arabic branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Al-Quds Center | مركز القدس — Login/);
    await expect(page.locator('.login-title')).toContainText('Al-Quds Center | مركز القدس');
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#login-registration-number')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('submitting invalid credentials displays error notification', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-registration-number', 'invalid_user');
    await page.fill('#login-password', 'wrong_pass');
    await page.click('#login-btn');

    const toast = page.locator('#login-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/error/);
  });

  test('admin logs in successfully and is redirected to /dashboard', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-registration-number', 'admin');
    await page.fill('#login-password', 'Passw0rd!');
    await page.click('#login-btn');

    // Should redirect to /dashboard
    await page.waitForURL('**/dashboard');
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('regular employee logs in and is redirected to /index.html', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#login-registration-number', 'emp1');
    await page.fill('#login-password', 'Passw0rd!');
    await page.click('#login-btn');

    // Should redirect to /index.html
    await page.waitForURL('**/index.html');
    expect(page.url()).toContain('/index.html');
  });

  test('regular employee attempting to access /dashboard is blocked', async ({ page }) => {
    // Log in as employee
    await page.goto('/login.html');
    await page.fill('#login-registration-number', 'emp1');
    await page.fill('#login-password', 'Passw0rd!');
    await page.click('#login-btn');
    await page.waitForURL('**/index.html');

    // Try navigating to admin dashboard
    await page.goto('/dashboard');
    // Must be redirected away from admin dashboard
    await page.waitForURL(url => !url.pathname.includes('/dashboard'));
    expect(page.url()).not.toContain('/dashboard');
  });
});
