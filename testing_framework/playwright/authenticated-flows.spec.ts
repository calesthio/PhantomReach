import { test, expect, type Page } from "@playwright/test";

const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL;
const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;

test.skip(
  !testEmail || !testPassword,
  "Authenticated Playwright flows require PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD.",
);

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail!);
  await page.getByLabel("Password").fill(testPassword!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/audits$/, { timeout: 15_000 });
}

test("authenticated user can run a city scout end to end", async ({ page }) => {
  test.setTimeout(180_000);

  await signIn(page);
  await page.goto("/scouts/new");

  await page.getByLabel("City").fill("Seattle");
  await page.getByLabel("Business Category").fill("Dentists");
  await page.getByRole("button", { name: "Dentists" }).click();
  await page.getByRole("button", { name: /start scout/i }).click();

  await expect(page).toHaveURL(/\/scouts\/loading/);
  await expect(page).toHaveURL(/\/scouts\/[a-f0-9-]+$/i, { timeout: 180_000 });
  await expect(
    page.getByRole("heading", { name: /ranked opportunity cards/i }),
  ).toBeVisible({ timeout: 30_000 });
});

test("authenticated user can run a business audit end to end", async ({ page }) => {
  test.setTimeout(480_000);

  await signIn(page);
  await page.goto("/audits/new");

  await page.getByLabel(/business name/i).fill("Space Needle");
  await page.getByLabel(/^city$/i).fill("Seattle");
  await page.getByLabel(/^state$/i).fill("WA");
  await page.getByLabel(/website url/i).fill("https://www.spaceneedle.com");
  await page.getByRole("button", { name: /run business audit/i }).click();

  await expect(page).toHaveURL(/\/audits\/loading/);
  await expect(page).toHaveURL(/\/audits\/[a-f0-9-]+$/i, { timeout: 480_000 });
  await expect(
    page.getByRole("heading", { name: /strategic intelligence/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: /competitive analysis/i }),
  ).toBeVisible({ timeout: 30_000 });
});
