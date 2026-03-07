const { test } = require('@playwright/test');

test('record Qanvas5 bouncing dots demo', async ({ page }) => {
  await page.goto('/');

  await page.waitForSelector('#runBtn');
  await page.click('#runBtn');

  // Let the sketch warm up.
  await page.waitForTimeout(1200);

  // Interact with canvas so input path is visible in the recording.
  await page.mouse.move(220, 220);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.move(520, 250, { steps: 20 });
  await page.waitForTimeout(800);
  await page.mouse.up();

  // Show output panel updates + stable animation in clip.
  await page.waitForTimeout(2500);
});
