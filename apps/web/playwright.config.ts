import { defineConfig, devices } from '@playwright/test';

const PORT = 3211;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Lo smoke test gira contro la build di produzione, non contro il dev server:
 * cio' che verifichiamo e' esattamente l'artefatto che finisce su Vercel.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    // Mai riusare un server gia' in ascolto: sarebbe una build precedente, e uno
    // smoke test che passa su codice vecchio e' peggio di uno smoke test assente.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
