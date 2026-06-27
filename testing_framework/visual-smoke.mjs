import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.PHANTOM_REACH_BASE_URL || "http://127.0.0.1:3000";
const routes = ["/audits", "/settings"];

mkdirSync("output/playwright", { recursive: true });

const browser = await chromium.launch();
const failures = [];

try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const cssResponses = [];
    const requestFailures = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/_next/static/css/") || url.endsWith(".css")) {
        cssResponses.push({
          url,
          status: response.status(),
          contentType: response.headers()["content-type"],
        });
      }
    });

    page.on("requestfailed", (request) => {
      const url = request.url();
      if (url.includes("/_next/static/") || url.endsWith(".css")) {
        requestFailures.push({
          url,
          failure: request.failure()?.errorText,
        });
      }
    });

    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    const renderState = await page.evaluate(() => ({
      bodyFont: getComputedStyle(document.body).fontFamily,
      h1FontSize: getComputedStyle(document.querySelector("h1") || document.body).fontSize,
      classCount: document.querySelectorAll("[class]").length,
      bodyText: document.body.innerText.trim(),
    }));

    const screenshotName = route.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home";
    await page.screenshot({
      path: `output/playwright/${screenshotName}-smoke.png`,
      fullPage: true,
    });

    if (!response || !response.ok()) {
      failures.push(`${route}: page returned ${response?.status() ?? "no response"}`);
    }

    const badCss = cssResponses.filter((item) => item.status >= 400);
    if (badCss.length > 0) {
      failures.push(`${route}: CSS failed ${JSON.stringify(badCss)}`);
    }

    if (requestFailures.length > 0) {
      failures.push(`${route}: static requests failed ${JSON.stringify(requestFailures)}`);
    }

    if (cssResponses.length === 0) {
      failures.push(`${route}: no CSS response observed`);
    }

    if (renderState.bodyFont.includes("Times New Roman")) {
      failures.push(`${route}: browser default font detected`);
    }

    if (renderState.classCount < 10) {
      failures.push(`${route}: too few styled elements detected`);
    }

    if (!renderState.bodyText) {
      failures.push(`${route}: page rendered no visible text`);
    }

    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Visual smoke passed for ${routes.join(", ")}`);
