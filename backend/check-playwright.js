const { chromium } = require('@playwright/test');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const version = browser.version();
    console.log('Chromium launched successfully. Version:', version);
    await browser.close();
  } catch (err) {
    console.error('Chromium launch failed:', err.message);
    console.error('Run: npx playwright install chromium');
  }
})();
