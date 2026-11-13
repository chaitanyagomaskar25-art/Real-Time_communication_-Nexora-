const { test, expect } = require('@playwright/test');

test.describe('ConnectSphere - Admin Dashboard Security & Management', () => {
  const uniqueId = Date.now();
  const normalUser = {
    fullName: 'Regular User',
    username: `reg_${uniqueId}`,
    email: `reg_${uniqueId}@connectsphere.io`,
    password: 'Password123!'
  };

  test('Security Check: Regular user attempting to access /admin is redirected to /dashboard', async ({ page }) => {
    // 1. Register normal user
    await page.goto('/register');
    await page.fill('#fullName', normalUser.fullName);
    await page.fill('#username', normalUser.username);
    await page.fill('#email', normalUser.email);
    await page.fill('#password', normalUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. Try navigating to /admin
    await page.goto('/admin');

    // 3. Must be redirected back to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('Admin Console: Admin user can access all 5 management modules', async ({ page }) => {
    // 1. Login with seeded administrator credentials
    await page.goto('/login');
    await page.fill('#identifier', 'admin@connectsphere.com');
    await page.fill('#password', 'AdminSecret123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. Navigate to /admin
    await page.goto('/admin');
    await page.waitForURL('**/admin', { timeout: 10000 });
    await expect(page).toHaveURL(/.*admin/);

    // 3. Verify Admin Header & Overview Module
    await expect(page.locator('text=ADMINISTRATOR CONSOLE').first()).toBeVisible();

    // 4. Test Users Module tab
    const usersTab = page.locator('button:has-text("User Management")').first();
    await usersTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('input[placeholder*="Search by name"]').first()).toBeVisible();

    // 5. Test Meetings Module tab
    const meetingsTab = page.locator('button:has-text("Meeting Oversight")').first();
    await meetingsTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('input[placeholder*="Search meetings by ID"]').first()).toBeVisible();

    // 6. Test Analytics Module tab
    const analyticsTab = page.locator('button:has-text("Analytics")').first();
    await analyticsTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Platform Growth & Real Usage Analytics').first()).toBeVisible();

    // 7. Test System Telemetry Module tab
    const systemTab = page.locator('button:has-text("System & Audit")').first();
    await systemTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=System Health & Security Audit Telemetry').first()).toBeVisible();
  });
});
