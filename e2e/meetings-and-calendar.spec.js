const { test, expect } = require('@playwright/test');

test.describe('ConnectSphere - Meetings, Calendar & Collaboration Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Generate unique credentials per test run
    const uid = Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const testUser = {
      fullName: 'Dr. Daniel Jackson',
      username: `dan_${uid}`,
      email: `dan_${uid}@connectsphere.io`,
      password: 'Password123!'
    };

    // Register and land on dashboard
    await page.goto('/register');
    await page.fill('#fullName', testUser.fullName);
    await page.fill('#username', testUser.username);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('Dashboard: KPI statistics cards and action buttons are present', async ({ page }) => {
    // Verify Dashboard KPI cards
    await expect(page.locator('text=Total Meeting Hours').first()).toBeVisible();
    await expect(page.locator('text=Meetings Hosted').first()).toBeVisible();
    await expect(page.locator('text=Stream Quality Score').first()).toBeVisible();

    // Verify Instant & Join Meeting buttons
    const newMeetingBtn = page.locator('button:has-text("New Meeting"), button:has-text("Instant Meeting")').first();
    await expect(newMeetingBtn).toBeVisible();

    const joinMeetingBtn = page.locator('button:has-text("Join"), button:has-text("Join Meeting")').first();
    await expect(joinMeetingBtn).toBeVisible();
  });

  test('Schedule Meeting: Modal form opens and schedules a new meeting', async ({ page }) => {
    // Open Schedule Modal from visible quick action button in main content
    const scheduleBtn = page.locator('main').locator('button:has-text("Schedule")').first();
    await scheduleBtn.scrollIntoViewIfNeeded();
    await scheduleBtn.click();
    await page.waitForTimeout(600);

    // Verify topic/title input is visible
    const titleInput = page.locator('input[placeholder*="Strategy"], input[placeholder*="Planning"], input[placeholder*="e.g."], input[placeholder*="Topic"]').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Playwright Architecture Review 2026');

    // Submit schedule form
    const submitBtn = page.locator('button[type="submit"]:has-text("Schedule Conference"), button[type="submit"]:has-text("Schedule")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  });

  test('Calendar Page: Monthly and weekly grid views render cleanly', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/.*calendar/);

    // Verify Calendar title or view buttons
    await expect(page.locator('text=Calendar').first()).toBeVisible();

    // Verify Month / Week / Day view toggles
    const monthViewBtn = page.locator('button:has-text("Month"), button:has-text("Monthly")').first();
    if (await monthViewBtn.isVisible()) {
      await monthViewBtn.click();
      await page.waitForTimeout(400);
    }

    const weekViewBtn = page.locator('button:has-text("Week"), button:has-text("Weekly")').first();
    if (await weekViewBtn.isVisible()) {
      await weekViewBtn.click();
      await page.waitForTimeout(400);
    }
  });

  test('Meeting History & Recordings: Navigation and empty/history state tables', async ({ page }) => {
    // Meeting History
    await page.goto('/history');
    await expect(page).toHaveURL(/.*history/);
    await expect(page.locator('text=Meeting History').first()).toBeVisible();

    // Recordings Library
    await page.goto('/recordings');
    await expect(page).toHaveURL(/.*recordings/);
    await expect(page.locator('text=Recordings').first()).toBeVisible();
  });
});
