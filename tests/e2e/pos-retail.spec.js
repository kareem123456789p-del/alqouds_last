// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('POS Retail Sales E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as cashier pos1 before each POS test
    await page.goto('/login.html');
    await page.fill('#login-registration-number', 'pos1');
    await page.fill('#login-password', 'Passw0rd!');
    await page.click('#login-btn');
    await page.waitForURL('**/index.html');
  });

  test('navigates to /pos and loads the retail interface with Arabic RTL layout', async ({ page }) => {
    await page.goto('/pos');
    await expect(page).toHaveTitle(/مبيعات الجمهور \(POS\) \| مركز القدس/);

    const htmlDir = await page.getAttribute('html', 'dir');
    expect(htmlDir).toBe('rtl');

    // Header title
    await expect(page.locator('header h2')).toContainText('مبيعات الجمهور (POS)');

    // Shift management section
    await expect(page.locator('#shift-badge')).toBeVisible();
    await expect(page.locator('#btn-open-shift')).toBeVisible();

    // Cart table container and checkout area
    await expect(page.locator('.cart-wrapper')).toBeVisible();
    await expect(page.locator('.btn-checkout')).toBeVisible();
  });

  test('navigates directly to /retail_sales.html and verifies shift controls', async ({ page }) => {
    await page.goto('/retail_sales.html');
    await expect(page).toHaveTitle(/مبيعات الجمهور \(POS\) \| مركز القدس/);

    // Verify overlay or shift badge displays shift status
    const shiftBadge = page.locator('#shift-badge');
    await expect(shiftBadge).toBeVisible();

    // Link back to dashboard / index
    const homeLink = page.locator('header a[href="index.html"]');
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await page.waitForURL('**/index.html');
    expect(page.url()).toContain('/index.html');
  });
});
