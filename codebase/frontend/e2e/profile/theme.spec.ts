import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: 저장한 테마를 앱 전체에 적용한다 (CLE-ACCT-PROFILE §테마).
 *
 * - REQ-PROFILE-028: 로그인 뒤 어느 화면을 열거나 새로 고쳐도 저장된 테마로 그린다.
 * - REQ-PROFILE-029: 첫 화면은 이 브라우저에 기억한 테마로 그린다(`<head>` 인라인 스크립트).
 * - REQ-PROFILE-023: `system` 은 OS 색상 모드가 바뀌면 새로 고치지 않아도 따라 바꾼다.
 *
 * 테마는 `<html>` 의 `.light` · `.dark` 클래스 하나로 그린다.
 */

const ACCESS = "mock-access-token";
const THEME_STORAGE_KEY = "clemvion.theme";

type Theme = "light" | "dark" | "system";

interface MockUser {
  id: string;
  email: string;
  name: string;
  locale: "ko" | "en";
  theme: Theme;
  avatarUrl: string | null;
}

const WORKSPACE = {
  id: "ws-1",
  name: "Personal",
  type: "personal",
  slug: "personal-alice",
  role: "owner",
};

interface ThemeMocks {
  user: MockUser;
  patchCalls: Array<Record<string, unknown>>;
}

/**
 * (main) 화면에 필요한 인증 · 워크스페이스 · 알림 · 워크플로우 목록을 mock 한다.
 * `/api/users/me` 는 상태를 갖는다. PATCH 결과가 다음 GET 에 반영된다.
 */
async function setupMocks(page: Page, theme: Theme): Promise<ThemeMocks> {
  const state: ThemeMocks = {
    user: {
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      locale: "ko",
      theme,
      avatarUrl: null,
    },
    patchCalls: [],
  };

  await page.context().addCookies([
    { name: "has_session", value: "1", domain: "localhost", path: "/" },
  ]);
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
          body: JSON.stringify({ data: [WORKSPACE] }),
        })
      : route.continue(),
  );
  await page.route("**/api/notifications/unread-count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 0 }) }),
  );
  await page.route(/\/api\/notifications(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
  await page.route(/\/api\/workflows(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "wf-1",
            name: "Onboarding flow",
            description: null,
            isActive: true,
            tags: [],
            folderId: null,
            settings: {},
            workspaceId: WORKSPACE.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownership: "mine",
          },
        ],
        pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
      }),
    }),
  );
  return state;
}

async function gotoWorkflows(page: Page) {
  await page.goto("/workflows");
  await expect(page.getByText(/Onboarding flow/i)).toBeVisible();
}

const html = (page: Page) => page.locator("html");

test.describe("저장한 테마를 앱 전체에 적용한다", () => {
  test("프로필에서 다크를 저장하면 다른 화면을 열고 새로 고쳐도 다크다 (REQ-PROFILE-028)", async ({
    page,
  }) => {
    const state = await setupMocks(page, "light");
    await page.goto("/profile");
    await expect(page.getByTestId("pref-theme-readonly")).toBeVisible();
    await expect(html(page)).toHaveClass(/\blight\b/);

    await page.getByTestId("profile-pref-edit").click();
    await page.getByTestId("pref-theme-dark").click();
    // 미리보기는 화면만 바꾼다.
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await page.getByTestId("profile-pref-save").click();
    await page.getByTestId("diff-confirm").click();
    await expect.poll(() => state.patchCalls).toEqual([{ theme: "dark" }]);
    await expect(page.getByTestId("pref-theme-readonly")).toBeVisible();
    await expect(html(page)).toHaveClass(/\bdark\b/);

    await gotoWorkflows(page);
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(html(page)).not.toHaveClass(/\blight\b/);

    await page.reload();
    await expect(page.getByText(/Onboarding flow/i)).toBeVisible();
    await expect(html(page)).toHaveClass(/\bdark\b/);
  });

  test("다크를 저장한 사용자가 /profile 을 거치지 않고 다른 화면을 열어도 다크다", async ({
    page,
  }) => {
    await setupMocks(page, "dark");
    await gotoWorkflows(page);

    await expect(html(page)).toHaveClass(/\bdark\b/);
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe("dark");
  });

  test("편집 중 미리보기를 [취소] 하면 저장한 테마로 돌아가고 기억한 값도 그대로다", async ({
    page,
  }) => {
    await setupMocks(page, "light");
    await page.goto("/profile");
    await expect(page.getByTestId("pref-theme-readonly")).toBeVisible();

    await page.getByTestId("profile-pref-edit").click();
    await page.getByTestId("pref-theme-dark").click();
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await page.getByTestId("profile-pref-cancel").click();

    await expect(html(page)).toHaveClass(/\blight\b/);
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe("light");
  });

  test("첫 화면은 React 가 뜨기 전에 기억한 테마로 그린다 (REQ-PROFILE-029)", async ({ page }) => {
    await setupMocks(page, "dark");
    await gotoWorkflows(page);
    await expect(html(page)).toHaveClass(/\bdark\b/);

    // 앱 번들을 막으면 hydrate 도 사용자 조회도 일어나지 않는다. 그래도 다크면 클래스를 붙인 것은
    // 서버 HTML 의 <head> 인라인 스크립트다.
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(html(page)).not.toHaveClass(/\blight\b/);
  });

  test("로그아웃 뒤 로그인 화면도 마지막으로 확정한 테마로 그린다", async ({ page }) => {
    await setupMocks(page, "dark");
    await gotoWorkflows(page);
    await expect(html(page)).toHaveClass(/\bdark\b/);

    await page.context().clearCookies();
    await page.goto("/login");

    await expect(html(page)).toHaveClass(/\bdark\b/);
  });
});

test.describe("system 테마는 OS 색상 모드를 따른다", () => {
  test("OS 색상 모드가 바뀌면 새로 고치지 않아도 바로 바꾼다 (REQ-PROFILE-023)", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await setupMocks(page, "system");
    await gotoWorkflows(page);
    await expect(html(page)).toHaveClass(/\blight\b/);

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(html(page)).not.toHaveClass(/\blight\b/);

    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveClass(/\blight\b/);
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe(
      "system",
    );
  });

  test("OS 가 다크면 첫 화면부터 다크로 그린다", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await setupMocks(page, "system");
    await gotoWorkflows(page);

    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(html(page)).toHaveClass(/\bdark\b/);
  });
});
