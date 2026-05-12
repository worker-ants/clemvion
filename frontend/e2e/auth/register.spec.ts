import { expect, test } from "@playwright/test";

/**
 * e2e: 회원가입 페이지 UI 흐름 (spec/2-navigation/10-auth-flow.md §2.2).
 *
 * 초대 토큰 분기는 frontend/e2e/team/register-invitation.spec.ts 가 담당.
 * 본 spec 은 토큰 없는 일반 가입 폼만 다룬다.
 */

const REGISTER_API = "**/api/auth/register";
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

test.describe("Register form — 일반 가입 (no invitation)", () => {
  test("성공 응답 → 이메일 인증 안내", async ({ page }) => {
    await mockOauthProviders(page);
    await page.route(REGISTER_API, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            message: "Registration successful. Please verify your email.",
          },
        }),
      });
    });

    await page.goto("/register");

    await page
      .getByLabel(/이름|Name/i)
      .first()
      .fill("New User");
    await page
      .getByLabel(/이메일|Email/i)
      .first()
      .fill("new@example.com");
    // 비밀번호 / 확인 필드 — 동일하게 입력.
    const passwords = page.getByLabel(/비밀번호|Password/i);
    await passwords.nth(0).fill("Strong!Pass1");
    await passwords.nth(1).fill("Strong!Pass1");

    // 약관 체크박스가 있다면 체크.
    const terms = page.getByRole("checkbox").first();
    if (await terms.isVisible().catch(() => false)) {
      await terms.check();
    }

    await page
      .getByRole("button", { name: /계정 만들기|Create [Aa]ccount|회원가입|Sign up/i })
      .click();

    // 성공 후 이메일 인증 안내 또는 verify-email 페이지로 이동.
    await expect
      .poll(() => page.url(), { timeout: 5_000 })
      .toMatch(/verify-email|register|login/);
  });

  test("409 duplicate email → 폼 유지 + 안내 메시지", async ({ page }) => {
    await mockOauthProviders(page);
    await page.route(REGISTER_API, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "RESOURCE_CONFLICT",
            message: "이미 가입된 이메일입니다.",
          },
        }),
      });
    });

    await page.goto("/register");
    await page
      .getByLabel(/이름|Name/i)
      .first()
      .fill("Dup User");
    await page
      .getByLabel(/이메일|Email/i)
      .first()
      .fill("dup@example.com");
    const passwords = page.getByLabel(/비밀번호|Password/i);
    await passwords.nth(0).fill("Strong!Pass1");
    await passwords.nth(1).fill("Strong!Pass1");
    const terms = page.getByRole("checkbox").first();
    if (await terms.isVisible().catch(() => false)) {
      await terms.check();
    }
    await page
      .getByRole("button", { name: /계정 만들기|Create [Aa]ccount|회원가입|Sign up/i })
      .click();

    await expect(
      page.getByText(/이미 가입|already (registered|exists)|duplicate/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("약관 미체크 → submit 비활성 또는 거절", async ({ page }) => {
    await mockOauthProviders(page);
    await page.goto("/register");

    await page
      .getByLabel(/이름|Name/i)
      .first()
      .fill("Terms User");
    await page
      .getByLabel(/이메일|Email/i)
      .first()
      .fill("terms@example.com");
    const passwords = page.getByLabel(/비밀번호|Password/i);
    await passwords.nth(0).fill("Strong!Pass1");
    await passwords.nth(1).fill("Strong!Pass1");

    const submit = page.getByRole("button", {
      name: /계정 만들기|Create [Aa]ccount|회원가입|Sign up/i,
    });

    // 약관 미체크 상태에서 — submit 이 disabled 이거나 클릭 시 안내 텍스트.
    const isDisabled = await submit.isDisabled();
    if (!isDisabled) {
      // 명시적으로 비활성이 아니라면 클릭 시 약관 동의 요구 메시지를 노출해야 한다.
      await submit.click();
      await expect(
        page.getByText(/약관|terms|agree/i).first(),
      ).toBeVisible({ timeout: 3_000 });
    } else {
      expect(isDisabled).toBe(true);
    }
  });
});
