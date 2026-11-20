import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const executablePath = process.env.CHROME_PATH || (existsSync(windowsChrome) ? windowsChrome : undefined)
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', timeout: 60000, workers: 1,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chrome-desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    { name: 'chrome-android-emulado', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    { name: 'webkit-iphone-emulado', use: { ...devices['iPhone 13'] } },
  ],
})
