import { expect, test } from "@playwright/test";
import { mockAuth, PAGE_READY_TIMEOUT, WORKSPACE } from "../helpers/mock-auth";

/**
 * e2e: 초대 알림을 누르면 그 초대의 수락 페이지가 초대 id 모드로 열린다 (CLE-T-86E38Q).
 *
 * 근거: CLE-OBS-NOTIFY-INBOX 딥링크 표(`team_invite` → `/invitations/accept?invitationId=<resource_id>`),
 * CLE-ACCT-WS-INVITE 「이미 가입한 사용자의 수락 경로」. 수락 페이지는 토큰 없이
 * `/api/users/me/invitations/:invitationId` 로 본인 초대를 보고 수락한다.
 */

const SLUG = WORKSPACE.slug;
const INVITATION_ID = "0b9d6f0e-1c2a-4b8e-9a51-3f2d7c6e8a10";
const json = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ data }),
});

test.describe("초대 알림 → 수락 페이지", () => {
  test("알림을 누르면 초대 id 모드의 수락 페이지가 열리고 수락할 수 있다", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route(/\/api\/workflows(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { total: 0 } }),
      }),
    );
    // mockAuth 의 알림 mock 보다 나중에 등록해 이쪽이 먼저 응답한다.
    await page.route("**/api/notifications/unread-count", (route) =>
      route.fulfill(json({ count: 1 })),
    );
    await page.route(/\/api\/notifications(\?|$)/, (route) =>
      route.fulfill(
        json([
          {
            id: "n-1",
            type: "team_invite",
            title: "Team Alpha 에 초대되었어요",
            message: "Bob 님이 초대했어요",
            isRead: false,
            createdAt: "2026-11-26T00:00:00Z",
            resourceType: "workspace_invitation",
            resourceId: INVITATION_ID,
          },
        ]),
      ),
    );
    await page.route("**/api/notifications/n-1/read", (route) =>
      route.fulfill(json({ ok: true })),
    );
    const metaRequests: string[] = [];
    await page.route(
      `**/api/users/me/invitations/${INVITATION_ID}`,
      (route) => {
        metaRequests.push(route.request().method());
        return route.fulfill(
          json({
            workspaceName: "Team Alpha",
            invitedByName: "Bob",
            email: "alice@example.com",
            role: "editor",
            expiresAt: "2099-01-01T00:00:00Z",
          }),
        );
      },
    );
    let accepted = false;
    await page.route(
      `**/api/users/me/invitations/${INVITATION_ID}/accept`,
      (route) => {
        accepted = route.request().method() === "POST";
        return route.fulfill(
          json({ workspaceId: WORKSPACE.id, role: "editor" }),
        );
      },
    );

    await page.goto(`/w/${SLUG}/workflows`);
    await page
      .getByRole("button", { name: "알림" })
      .first()
      .click({ timeout: PAGE_READY_TIMEOUT });
    await page
      .getByRole("button", { name: /Team Alpha 에 초대되었어요/ })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/invitations/accept\\?invitationId=${INVITATION_ID}$`),
      { timeout: PAGE_READY_TIMEOUT },
    );
    await expect(
      page.getByText("'Team Alpha' 워크스페이스에 초대되었어요"),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    expect(metaRequests).toContain("GET");
    // 서버가 로그인 이메일로 온 초대만 돌려주므로 불일치 안내는 없다.
    await expect(page.getByText("다른 계정으로 로그인")).toHaveCount(0);

    await page.getByRole("button", { name: "수락" }).click();
    await expect(page.getByText("워크스페이스에 합류했어요!")).toBeVisible();
    expect(accepted).toBe(true);
  });
});
