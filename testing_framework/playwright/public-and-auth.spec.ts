import { test, expect } from "@playwright/test";

test("landing page primary CTA routes to signup", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /scan any market/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /get started free/i }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("protected routes redirect anonymous users to login with preserved next paths", async ({ page }) => {
  const protectedPaths = ["/audits", "/billing", "/widget"];

  for (const protectedPath of protectedPaths) {
    await page.goto(protectedPath);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(protectedPath)}`));
    await expect(
      page.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  }
});

test("login and signup pages preserve next-path navigation links", async ({ page }) => {
  await page.goto("/login?next=%2Faudits");

  const signupLink = page.getByRole("link", { name: /sign up/i });
  await expect(signupLink).toHaveAttribute("href", /\/signup\?next=%2Faudits/);
  await signupLink.click();
  await expect(page).toHaveURL(/\/signup\?next=%2Faudits/);

  const loginLink = page.getByRole("link", { name: /^sign in$/i });
  await expect(loginLink).toHaveAttribute("href", /\/login\?next=%2Faudits/);
});

test("public report routes stay public instead of redirecting to auth", async ({ page }) => {
  await page.goto("/r/does-not-exist");
  await expect(page).not.toHaveURL(/\/login/);
});
