import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.PHANTOM_REACH_BASE_URL || "http://127.0.0.1:3000";
const ids = (process.env.PHANTOM_REACH_REPORT_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const expectedNames = (process.env.PHANTOM_REACH_REPORT_NAMES || "")
  .split("|")
  .map((name) => name.trim())
  .filter(Boolean);

if (ids.length === 0) {
  throw new Error("Set PHANTOM_REACH_REPORT_IDS to comma-separated report IDs.");
}

mkdirSync("output/playwright", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
const cssResponses = [];
const requestFailures = [];

page.on("response", (response) => {
  const url = response.url();
  if (url.includes("/_next/static/css/") || url.endsWith(".css")) {
    cssResponses.push({ url, status: response.status() });
  }
});

page.on("requestfailed", (request) => {
  const url = request.url();
  if (url.includes("/_next/static/") || url.endsWith(".css")) {
    requestFailures.push({ url, failure: request.failure()?.errorText });
  }
});

await page.goto(`${baseUrl}/audits`, { waitUntil: "networkidle", timeout: 60_000 });
const listInfo = await page.evaluate((reportIds) => ({
  text: document.body.innerText,
  bodyFont: getComputedStyle(document.body).fontFamily,
  h1: document.querySelector("h1")?.textContent || "",
  h1Font: getComputedStyle(document.querySelector("h1") || document.body).fontSize,
  links: [...document.querySelectorAll("a")]
    .map((a) => ({ text: a.textContent?.trim(), href: a.href }))
    .filter((a) => reportIds.some((id) => a.href.includes(id))),
}), ids);

await page.screenshot({
  path: "output/playwright/audits-history-after-api-audits.png",
  fullPage: true,
});

for (const name of expectedNames) {
  if (!listInfo.text.includes(name)) failures.push(`/audits missing ${name}`);
}
if (!listInfo.h1.includes("Business Audits")) failures.push("/audits h1 missing");
if (listInfo.bodyFont.includes("Times New Roman")) failures.push("/audits default font detected");
if (listInfo.links.length < ids.length) {
  failures.push(`/audits did not expose links for all reports: ${JSON.stringify(listInfo.links)}`);
}

const reportInfos = [];
for (const id of ids) {
  await page.goto(`${baseUrl}/audits/${id}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return !text.includes("Loading report...") && Boolean(document.querySelector("h1")?.textContent);
    },
    { timeout: 30_000 }
  );
  const info = await page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent || "",
    text: document.body.innerText.slice(0, 8000),
    bodyFont: getComputedStyle(document.body).fontFamily,
    h1Font: getComputedStyle(document.querySelector("h1") || document.body).fontSize,
    roundedCount: document.querySelectorAll(".rounded-lg, .rounded-xl, .rounded-md").length,
  }));

  await page.screenshot({
    path: `output/playwright/audit-report-${id}.png`,
    fullPage: true,
  });

  reportInfos.push({
    id,
    title: info.title,
    hasExecutive: info.text.includes("Executive") || info.text.includes("Overall"),
    hasDataSources: info.text.includes("Data Sources"),
    hasRevenue: info.text.includes("Revenue"),
    bodyFont: info.bodyFont,
    h1Font: info.h1Font,
    roundedCount: info.roundedCount,
  });

  if (info.bodyFont.includes("Times New Roman")) failures.push(`${id} default font detected`);
  if (!info.title) failures.push(`${id} missing h1 title`);
  if (!info.text.includes("Data Sources")) failures.push(`${id} missing Data Sources panel`);
  if (!info.text.includes("Revenue")) failures.push(`${id} missing revenue content`);
}

await browser.close();

const badCss = cssResponses.filter((response) => response.status >= 400);
if (badCss.length > 0) failures.push(`CSS failures ${JSON.stringify(badCss)}`);
if (requestFailures.length > 0) failures.push(`request failures ${JSON.stringify(requestFailures)}`);

const result = {
  listInfo: {
    h1: listInfo.h1,
    links: listInfo.links,
    bodyFont: listInfo.bodyFont,
    h1Font: listInfo.h1Font,
    expectedNamesPresent: Object.fromEntries(
      expectedNames.map((name) => [name, listInfo.text.includes(name)])
    ),
  },
  reportInfos,
  cssResponseCount: cssResponses.length,
  failures,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exit(1);
