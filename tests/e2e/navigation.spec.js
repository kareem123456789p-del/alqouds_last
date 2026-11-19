// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Operational Navigation & Multi-Page Views E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as an employee before each navigation test
    await page.goto('/login.html');
    await page.fill('#login-registration-number', 'emp1');
    await page.fill('#login-password', 'Passw0rd!');
    await page.click('#login-btn');
    await page.waitForURL('**/index.html');
  });

  test('loads inventory management view with Arabic RTL layout', async ({ page }) => {
    await page.goto('/inventory.html');
    await expect(page).toHaveTitle(/المخزون | مركز القدس/);
    const htmlDir = await page.getAttribute('html', 'dir');
    expect(htmlDir).toBe('rtl');
    await expect(page.locator('body')).toBeVisible();
  });

  test('loads wholesale orders view', async ({ page }) => {
    await page.goto('/orders.html');
    await expect(page).toHaveTitle(/إدارة الطلبات \/ المبيعات | مركز القدس/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('loads product catalog view', async ({ page }) => {
    await page.goto('/products.html');
    await expect(page.locator('body')).toBeVisible();
  });

  test('loads stock transfer view', async ({ page }) => {
    await page.goto('/transfer.html');
    await expect(page.locator('body')).toBeVisible();
  });

  test('loads warehouse configuration view', async ({ page }) => {
    await page.goto('/warehouse.html');
    await expect(page.locator('body')).toBeVisible();
  });
});
