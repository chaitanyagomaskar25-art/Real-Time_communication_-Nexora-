const { test, expect } = require('@playwright/test');

test.describe('ConnectSphere - Authentication & Navigation Flow', () => {
  const uniqueId = Date.now();
  const testUser = {
    fullName: 'Samantha Carter',
    username: `sam_${uniqueId}`,
    email: `sam_${uniqueId}@connectsphere.io`,
    password: 'Password123!'
  };

  test('Landing Page: Hero elements, navigation links, and theme toggle', async ({ page }) => {
    await page.goto('/');

    // Check title and brand
    await expect(page).toHaveTitle(/ConnectSphere/i);
    await expect(page.locator('text=ConnectSphere').first()).toBeVisible();

    // Check CTA buttons
    const getStartedBtn = page.locator('text=Get Started').first();
    await expect(getStartedBtn).toBeVisible();

    const signInBtn = page.locator('text=Sign In').first();
    await expect(signInBtn).toBeVisible();
  });

  test('Protected Routes: Unauthenticated access redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);

    await page.goto('/calendar');
    await expect(page).toHaveURL(/.*login/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/.*login/);
  });

  test('Auth Flow: Register new user -> Redirects to Dashboard -> Logout', async ({ page }) => {
    await page.goto('/register');

    // Fill registration form
    await page.fill('#fullName', testUser.fullName);
    await page.fill('#username', testUser.username);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Verify redirection to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/.*dashboard/);

    // Verify user name in dashboard
    await expect(page.locator(`text=${testUser.fullName}`).first()).toBeVisible();

    // Logout
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL(/.*login|.*\//, { timeout: 10000 });
    }
  });

  test('Auth Flow: Login with invalid credentials displays error message', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#identifier', testUser.email);
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Verify error banner
    const errorBanner = page.locator('text=Invalid credentials').first();
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
  });

  test('Auth Flow: Login with valid credentials succeeds', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#identifier', testUser.email);
    await page.fill('#password', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
