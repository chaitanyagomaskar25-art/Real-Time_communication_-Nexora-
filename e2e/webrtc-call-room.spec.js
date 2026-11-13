const { test, expect } = require('@playwright/test');

test.describe('ConnectSphere - WebRTC Video Room & In-Call Collaboration', () => {
  const roomId = `e2e-room-${Date.now()}`;

  test('Direct Room Entry: Media initialization, controls bar, and collaborative tools', async ({ page }) => {
    // Navigate directly into room
    await page.goto(`/room/${roomId}`);

    // Wait for the room container to be mounted
    await page.waitForSelector('video, [data-testid="controls-bar"], button:has-text("Leave")', {
      timeout: 20000
    });

    // 1. Verify Video Element is present and rendering
    const videoElements = page.locator('video');
    await expect(videoElements.first()).toBeVisible({ timeout: 10000 });

    // 2. Test Audio Mute / Unmute Toggle
    const micBtn = page.locator('button[title*="Microphone"], button[title*="Mute"], button[aria-label*="Mute"], button:has(svg.lucide-mic), button:has(svg.lucide-mic-off)').first();
    await expect(micBtn).toBeVisible();
    await micBtn.click();
    await page.waitForTimeout(500);
    // Click again to restore audio
    await micBtn.click();
    await page.waitForTimeout(500);

    // 3. Test Video Camera Toggle
    const cameraBtn = page.locator('button[title*="Camera"], button[title*="Video"], button[aria-label*="Video"], button:has(svg.lucide-video), button:has(svg.lucide-video-off)').first();
    await expect(cameraBtn).toBeVisible();
    await cameraBtn.click();
    await page.waitForTimeout(500);
    await cameraBtn.click();
    await page.waitForTimeout(500);

    // 4. Test Chat Drawer & Message Sending
    const chatToggleBtn = page.locator('button[title*="Chat"], button:has(svg.lucide-message-square)').first();
    if (await chatToggleBtn.isVisible()) {
      await chatToggleBtn.click();
      await page.waitForTimeout(600);

      // Verify chat input is visible
      const chatInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]').first();
      if (await chatInput.isVisible()) {
        await chatInput.fill('Automated E2E Test Message via Playwright');
        const sendBtn = page.locator('button:has(svg.lucide-send), button[type="submit"]:has-text("Send")').first();
        if (await sendBtn.isVisible()) {
          await sendBtn.click();
          await page.waitForTimeout(600);
          await expect(page.locator('text=Automated E2E Test Message via Playwright').first()).toBeVisible();
        }
      }
      // Close chat drawer
      await chatToggleBtn.click();
      await page.waitForTimeout(400);
    }

    // 5. Test Participants Drawer
    const participantsToggleBtn = page.locator('button[title*="Participant"], button:has(svg.lucide-users)').first();
    if (await participantsToggleBtn.isVisible()) {
      await participantsToggleBtn.click();
      await page.waitForTimeout(600);

      // Verify participant panel heading or badges
      const participantHeader = page.locator('text=Participants').first();
      await expect(participantHeader).toBeVisible();

      // Close participants drawer
      await participantsToggleBtn.click();
      await page.waitForTimeout(400);
    }

    // 6. Test Whiteboard Collaboration Toggle
    const whiteboardToggleBtn = page.locator('button[title*="Whiteboard"], button:has(svg.lucide-palette)').first();
    if (await whiteboardToggleBtn.isVisible()) {
      await whiteboardToggleBtn.click();
      await page.waitForTimeout(1000);

      // Canvas element should be visible
      const canvasEl = page.locator('canvas').first();
      await expect(canvasEl).toBeVisible();

      // Close whiteboard
      await whiteboardToggleBtn.click();
      await page.waitForTimeout(500);
    }

    // 7. Test Leave Call
    const leaveBtn = page.locator('button[title*="Leave"], button:has(svg.lucide-phone-off), button:has-text("Leave")').first();
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();

    // Verify leaving redirects to home or dashboard
    await page.waitForTimeout(1500);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain(`/room/${roomId}`);
  });
});

