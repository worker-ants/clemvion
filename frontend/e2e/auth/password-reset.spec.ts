import { expect, test } from "@playwright/test";

/**
 * e2e: /forgot-password 와 /reset-password UI 흐름.
 *
 * spec/2-navigation/10-auth-flow.md §2.5 — 정보 누출 방지를 위해 이메일 존재 여부와
 * 무관하게 동일한 안내를 표시한다.
 */

const OAUTH_PROVIDERS_API = "**/api/auth/oauth/providers";

async function mockOauth(page: import("@playwright/test").Page) {
  await page.route(OAUTH_PROVIDERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { providers: [] } }),
    });
  });
}

test.describe("Forgot / reset password", () => {
  test("forgot-password — 이메일 제출 → 안내 메시지", async ({ page }) => {
    await mockOauth(page);
    await page.route("**/api/auth/forgot-password", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            message: "이메일이 발송되었습니다.",
          },
        }),
      });
    });

    await page.goto("/forgot-password");
    await page
      .getByLabel(/이메일|Email/i)
      .first()
      .fill("user@example.com");
    await page
      .getByRole("button", { name: /재설정|reset|Send|보내기/i })
      .click();

    await expect(
      page.getByText(/발송|sent|확인해 주세요|check your email/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("reset-password — 유효 토큰 → 폼 표시, 제출 성공 → /login", async ({
    page,
  }) => {
    await mockOauth(page);
    await page.route("**/api/auth/reset-password", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { message: "Password reset successful." },
        }),
      });
    });

    await page.goto("/reset-password?token=valid-reset-token");

    const newPw = page.getByLabel(/새 비밀번호|New Password/i).first();
    await newPw.fill("NewPass!4567");

    const confirmPw = page
      .getByLabel(/확인|Confirm/i)
      .first();
    if (await confirmPw.isVisible().catch(() => false)) {
      await confirmPw.fill("NewPass!4567");
    }

    await page
      .getByRole("button", { name: /재설정|Reset password|변경|Save/i })
      .click();

    await expect
      .poll(() => page.url(), { timeout: 5_000 })
      .toMatch(/\/login/);
  });

  test("reset-password — 만료/무효 토큰 → 안내", async ({ page }) => {
    await mockOauth(page);
    await page.route("**/api/auth/reset-password", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid or expired reset token.",
          },
        }),
      });
    });

    await page.goto("/reset-password?token=expired-or-invalid");
    await page
      .getByLabel(/새 비밀번호|New Password/i)
      .first()
      .fill("NewPass!4567");
    const confirmPw = page.getByLabel(/확인|Confirm/i).first();
    if (await confirmPw.isVisible().catch(() => false)) {
      await confirmPw.fill("NewPass!4567");
    }
    await page
      .getByRole("button", { name: /재설정|Reset password|변경|Save/i })
      .click();

    await expect(
      page.getByText(/만료|expired|invalid|유효하지 않/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
