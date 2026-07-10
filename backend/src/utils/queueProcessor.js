const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { chromium } = require("@playwright/test");
const { autoDiscoverAndGenerateSteps } = require("./testGenerator");

const execAsync = promisify(exec);

async function processAutomaticE2EJob(job, updateGlobalStore) {
  const tempDir = path.join(__dirname, "../../storage/temp_payloads");
  const screenshotDir = path.join(__dirname, "../../storage/screenshots");

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  if (!fs.existsSync(screenshotDir))
    fs.mkdirSync(screenshotDir, { recursive: true });

  const payloadFilePath = path.join(tempDir, `${job.id}.json`);
  let status = "passed";
  let failureReason = null;
  let savedScreenshotUrl = null;

  try {
    // STEP 1: Website scan karke raw HTML nikalo
    console.log(`[Auto-Pilot] Scanning website structure: ${job.targetUrl}`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(job.targetUrl, { waitUntil: "networkidle" });

    const htmlSnippet = await page.evaluate(() => {
      return (
        document.querySelector("body")?.innerHTML.substring(0, 10000) || ""
      );
    });
    await browser.close();

    // STEP 2: Pipeline ko update karo ki ab E2E Automation shuru ho gaya hai
    // Taaki aapke Frontend Pipeline component par loader dikhe
    if (updateGlobalStore) {
      updateGlobalStore(job.id, {
        currentStage: "functional_e2e",
        status: "running",
      });
    }

    // AI se steps generate karwao
    console.log(
      `[Auto-Pilot] AI is analyzing HTML and generating test scenarios...`,
    );
    const autoSteps = await autoDiscoverAndGenerateSteps(
      job.targetUrl,
      htmlSnippet,
    );

    if (!autoSteps || autoSteps.length === 0) {
      throw new Error(
        "AI could not automatically find any interactive elements to test.",
      );
    }

    fs.writeFileSync(payloadFilePath, JSON.stringify(autoSteps, null, 2));

    // STEP 3: Playwright run karo
    console.log(`[Auto-Pilot] Executing automated tests live on browser...`);
    const configPath = path.join(__dirname, "../../playwright.config.ts");

    // Note: Playwright runner config abhi bhi .ts rkh sakte hain kyunki npx playwright use internal transpile kar leta hai
    await execAsync(
      `npx playwright test src/tests/dynamicEngine.spec.ts --config=${configPath}`,
      {
        env: { ...process.env, CURRENT_PLAYWRIGHT_PAYLOAD: payloadFilePath },
      },
    );
  } catch (error) {
    status = "failed";
    failureReason = error.message || "Auto execution failed";

    // Failure screenshot filter karo
    const artifactPath = path.join(
      __dirname,
      "../../test-results/dynamicEngine-Execute-AI-Generated-E2E-Steps-chromium/test-failed-1.png",
    );
    if (fs.existsSync(artifactPath)) {
      const dest = path.join(screenshotDir, `${job.id}_fail.png`);
      fs.copyFileSync(artifactPath, dest);
      savedScreenshotUrl = `/storage/screenshots/${job.id}_fail.png`;
    }
  } finally {
    if (fs.existsSync(payloadFilePath)) {
      fs.unlinkSync(payloadFilePath);
    }
  }

  // Final structure object for jsonStore
  const finalReport = {
    testId: job.id,
    targetUrl: job.targetUrl,
    status: status,
    currentStage: "done",
    type: "AUTOMATIC_CRAWL",
    executedAt: new Date().toISOString(),
    error: failureReason,
    screenshot: savedScreenshotUrl,
  };

  // Global store/DB update logic call karo final status ke sath
  if (updateGlobalStore) {
    updateGlobalStore(job.id, finalReport);
  }

  console.log(`[Auto-Pilot] Done! Saved execution results.`);
  return finalReport;
}

module.exports = { processAutomaticE2EJob };
