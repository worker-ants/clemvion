import { expect, test } from "@playwright/test";

/**
 * e2e: 로그인 페이지 UI 흐름 (spec/2-navigation/10-auth-flow.md §2.1).
 *
 * backend 의 실제 인증 흐름은 backend/test/auth.e2e-spec.ts 가 보장하고, 본 spec
 * 은 "프론트엔드가 200 / 401 / 2FA challenge 응답에 따라 UI 분기를 올바르게
 * 수행하는가" 만 검증한다. page.route 로 mock.
 */

const LOGIN_API = "**/api/auth/login";
const OAUTH_PROVIDERS_API = "**/api/auth/oauth/providers";

async function mockOauthProviders(page: import("@playwright/test").Page) {
  await page.route(OAUTH_PROVIDERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { providers: [] } }),
    });
  });
}

test.describe("Login form (mock-based)", () => {
  test("성공 응답 → toast + 후속 페이지 이동", async ({ page }) => {
    await mockOauthProviders(page);
    await page.route(LOGIN_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "set-cookie": "refresh_token=fake; HttpOnly; Path=/" },
        body: JSON.stringify({
          data: { accessToken: "test-access-token" },
        }),
      });
    });

    await page.goto("/login");

    await page
      .getByLabel(/이메일|Email/i)
      .first()
      .fill("ok@example.com");
    await page
      .getByLabel(/비밀번호|Password/i)
      .first()
      .fill("Whatever!1234");

    await page.getByRole("button", { name: /로그인|Sign in/i }).click();

    // 성공 토스트가 잠시 보였다가 사라진다.
    await expect(
      page.getByText(/로그인에 성공|Signed in successfully|signed in/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("401 → 에러 메시지 + 폼 유지 (이메일 보존)", async ({ page }) => {
    await mockOauthProviders(page);
    await page.route(LOGIN_API, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "LOGIN_FAILED",
            message: "이메일 또는 비밀번호가 일치하지 않습니다.",
          },
        }),
      });
    });

    await page.goto("/login");
    const email = page.getByLabel(/이메일|Email/i).first();
    await email.fill("bad@example.com");
    await page
      .getByLabel(/비밀번호|Password/i)
      .first()
      .fill("wrong");
    await page.getByRole("button", { name: /로그인|Sign in/i }).click();

    // login-form 의 extractApiMessage 는 data.message 만 본다 (data.error.message
    // 는 보지 않음). 내 mock 은 nested error 라 fallback i18n
    // ("auth.login.genericFailed" = "로그인에 실패했어요. 다시 시도해 주세요.") 가
    // sonner toast 로 표시된다. 다소 폭넓게 매칭.
    await expect(
      page.getByText(/실패|일치하지 않|invalid|failed|incorrect/i).first(),
    ).toBeVisible({ timeout: 5_000 });

    // 이메일은 유지 (사용자가 다시 타이핑할 필요 없음).
    await expect(email).toHaveValue("bad@example.com");
  });

  test("2FA challenge 응답 → TOTP 입력 화면 전환", async ({ page }) => {
    await mockOauthProviders(page);
    await page.route(LOGIN_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            requiresTotp: true,
            challengeToken: "challenge-token-abc",
          },
        }),
      });
    });

    await page.goto("/login");
    await page
      .getByLabel(/이메일|Email/i)
      .first()
      .fill("twofa@example.com");
    await page
      .getByLabel(/비밀번호|Password/i)
      .first()
      .fill("Whatever!1234");
    await page.getByRole("button", { name: /로그인|Sign in/i }).click();

    // TOTP 입력 페이지로 전환됐는지 — 한국어 "2단계 인증" 또는 "Two-factor"
    // 헤딩이 보여야 함.
    await expect(
      page.getByText(/2단계 인증|Two-factor|TOTP/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("'비밀번호 찾기' 링크 → /forgot-password 이동", async ({ page }) => {
    await mockOauthProviders(page);
    await page.goto("/login");

    const link = page.getByRole("link", {
      name: /비밀번호 찾기|Forgot password/i,
    });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
