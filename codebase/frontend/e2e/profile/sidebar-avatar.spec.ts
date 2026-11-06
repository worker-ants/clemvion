import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: 사이드바 사용자 영역 아바타 (CLE-ACCT-PROFILE 「사이드바 사용자 영역 › 기본 표시」).
 *
 * - 아바타 이미지가 있으면 이미지를 보인다.
 * - 이미지를 불러오지 못하면 이름 이니셜로 바꾼다(프로필 카드와 같은 규칙).
 * - 내 프로필에서 이름을 저장하면 새로 고치지 않아도 사이드바에 바로 반영된다.
 */

const ACCESS = "mock-access-token";
// 외부 이미지 주소. 네트워크에 나가지 않게 page.route 가 응답한다.
const AVATAR_URL = "https://cdn.e2e.test/avatars/avatar.png";
const BROKEN_AVATAR_URL = "https://cdn.e2e.test/avatars/broken.png";

// 1x1 투명 PNG.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

interface MockUser {
  id: string;
  email: string;
  name: string;
  locale: "ko";
  theme: "light";
  avatarUrl: string | null;
}

async function setupMocks(page: Page, avatarUrl: string | null) {
  const state: { user: MockUser; patchCalls: Array<Record<string, unknown>> } = {
    user: {
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Kim",
      locale: "ko",
      theme: "light",
      avatarUrl,
    },
    patchCalls: [],
  };

  await page.context().addCookies([
    { name: "has_session", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.route(AVATAR_URL, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 }),
  );
  await page.route(BROKEN_AVATAR_URL, (route) => route.fulfill({ status: 404 }));
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { accessToken: ACCESS } }),
    }),
  );
  await page.route("**/api/users/me", async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      const patch = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      state.patchCalls.push(patch);
      state.user = { ...state.user, ...patch } as MockUser;
    } else if (method !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: state.user }),
    });
  });
  await page.route("**/api/workspaces", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [{ id: "ws-1", name: "Personal", type: "personal", slug: "personal-alice", role: "owner" }],
          }),
        })
      : route.continue(),
  );
  await page.route("**/api/notifications/unread-count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 0 }) }),
  );
  await page.route(/\/api\/notifications(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
  return state;
}

test.describe("사이드바 사용자 영역 아바타", () => {
  test("아바타 이미지가 있으면 사이드바에 이미지를 보인다", async ({ page }) => {
    await setupMocks(page, AVATAR_URL);
    await page.goto("/profile");

    const image = page.getByTestId("sidebar-user-avatar-image");
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", AVATAR_URL);
    await expect(page.getByTestId("sidebar-user-avatar-initials")).toHaveCount(0);
  });

  test("이미지를 불러오지 못하면 이니셜로 바꾼다", async ({ page }) => {
    await setupMocks(page, BROKEN_AVATAR_URL);
    await page.goto("/profile");

    await expect(page.getByTestId("sidebar-user-avatar-initials")).toHaveText("AK");
    await expect(page.getByTestId("sidebar-user-avatar-image")).toHaveCount(0);
  });

  test("프로필에서 이름을 저장하면 새로 고치지 않아도 사이드바 이니셜이 바뀐다", async ({ page }) => {
    const state = await setupMocks(page, null);
    await page.goto("/profile");
    await expect(page.getByTestId("sidebar-user-avatar-initials")).toHaveText("AK");

    await page.getByTestId("profile-info-edit").click();
    await page.getByLabel(/이름|Name/i).fill("Bob Lee");
    await page.getByTestId("profile-info-save").click();
    await page.getByTestId("diff-confirm").click();
    await expect.poll(() => state.patchCalls).toEqual([{ name: "Bob Lee" }]);

    await expect(page.getByTestId("sidebar-user-avatar-initials")).toHaveText("BL");
  });
});
