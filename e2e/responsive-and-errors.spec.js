const { test, expect } = require('@playwright/test');

test.describe('ConnectSphere - Responsive Layouts & Console Health', () => {
  test('Console Health: Zero unhandled React errors or crashes on core landing and auth pages', async ({ page }) => {
    const errorLogs = [];
    page.on('pageerror', (err) => {
      errorLogs.push(err.message);
    });

    // 1. Visit Landing Page
    await page.goto('/');
    await page.waitForTimeout(500);

    // 2. Visit Login Page
    await page.goto('/login');
    await page.waitForTimeout(500);

    // 3. Visit Register Page
    await page.goto('/register');
    await page.waitForTimeout(500);

    expect(errorLogs).toEqual([]);
  });

  test('Responsive Layout: Navigation and UI adapt gracefully across Mobile (375px)', async ({ page }) => {
    // Emulate Mobile Device Viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await expect(page.locator('text=ConnectSphere').first()).toBeVisible();

    // Verify Mobile Layout elements are visible without horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5);
  });

  test('Responsive Layout: Tablet Viewport (768px)', async ({ page }) => {
    // Emulate Tablet Device Viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/login');
    await expect(page.locator('#identifier')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('Theme Toggle: Switching between Dark and Light mode applies HTML theme class', async ({ page }) => {
    await page.goto('/');

    const themeToggleBtn = page.locator('button:has(svg.lucide-sun), button:has(svg.lucide-moon)').first();
    if (await themeToggleBtn.isVisible()) {
      const initialClass = await page.locator('html').getAttribute('class');
      await themeToggleBtn.click();
      await page.waitForTimeout(300);
      const newClass = await page.locator('html').getAttribute('class');
      expect(newClass).not.toEqual(initialClass);
    }
  });
});

