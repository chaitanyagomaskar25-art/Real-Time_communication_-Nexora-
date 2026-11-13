const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1, // Run sequentially for reproducible state
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        permissions: ['camera', 'microphone']
      }
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        permissions: ['camera', 'microphone']
      }
    }
  ],
  webServer: [
    {
      command: 'npm run start:backend',
      url: 'http://localhost:3000/api/health',
      timeout: 15000,
      reuseExistingServer: true
    },
    {
      command: 'npm run dev:frontend',
      url: 'http://localhost:5173',
      timeout: 15000,
      reuseExistingServer: true
    }
  ]
});

