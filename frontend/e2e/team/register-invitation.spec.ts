import { expect, test } from "@playwright/test";

/**
 * e2e: 초대 토큰 가입 페이지 (NAV-UP-05 / spec/2-navigation/10-auth-flow.md §2.6).
 *
 * backend 호출(`GET /api/invitations/:token`, `POST /api/auth/register`)을
 * page.route 로 mock 한다 — backend 의 실제 흐름은 `backend/test/app.e2e-spec.ts`
 * 가 보장하고, 본 spec 은 "프론트엔드가 응답을 받아서 UI 분기를 제대로 하는가"
 * 만 검증한다.
 */

const VALID_TOKEN = "a".repeat(64);

test.describe("Register page — invitation token flow", () => {
  test("ready meta → email prefilled + readOnly + workspace banner", async ({
    page,
  }) => {
    await page.route(`**/api/invitations/${VALID_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            workspaceName: "Team Alpha",
            invitedByName: "Alice",
            email: "invited@example.com",
            role: "editor",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
      });
    });

    await page.goto(`/register?invitationToken=${VALID_TOKEN}`);

    // 배너 — 워크스페이스 이름 + 초대자 이름.
    await expect(
      page.getByText(/Team Alpha .* 초대받으셨어요|invited to join Team Alpha/),
    ).toBeVisible();

    // email input 이 prefill + readOnly.
    const emailInput = page.getByLabel(/이메일|Email/);
    await expect(emailInput).toHaveValue("invited@example.com");
    await expect(emailInput).toHaveAttribute("readonly", "");
  });

  test("410 expired → 에러 배너 + submit 비활성화", async ({ page }) => {
    await page.route(`**/api/invitations/${VALID_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 410,
        contentType: "application/json",
        body: JSON.stringify({
          code: "invitation_expired",
          message: "초대가 만료되었습니다.",
        }),
      });
    });

    await page.goto(`/register?invitationToken=${VALID_TOKEN}`);

    // 사용자에게 "더 이상 유효하지 않은 초대" 안내.
    await expect(
      page.getByText(
        /만료되었거나 이미 사용|expired or already used/i,
      ),
    ).toBeVisible();

    // submit 버튼이 disabled 상태.
    const submit = page.getByRole("button", {
      name: /계정 만들기|Create [Aa]ccount/,
    });
    await expect(submit).toBeDisabled();
  });

  test("404 not found → 안내 배너", async ({ page }) => {
    await page.route(`**/api/invitations/${VALID_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "invitation_not_found" }),
      });
    });

    await page.goto(`/register?invitationToken=${VALID_TOKEN}`);

    await expect(
      page.getByText(
        /확인할 수 없어요|not recognized/i,
      ),
    ).toBeVisible();
  });

  test("no invitationToken → 일반 가입 페이지 (배너 없음, email 자유 입력)", async ({
    page,
  }) => {
    await page.goto("/register");

    // 초대 배너 없음.
    await expect(
      page.getByText(/초대받으셨어요|invited to join/),
    ).not.toBeVisible();

    // email input 이 readOnly 가 아님.
    const emailInput = page.getByLabel(/이메일|Email/);
    await expect(emailInput).not.toHaveAttribute("readonly", "");
  });
});
