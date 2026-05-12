import { expect, test, type Page } from "@playwright/test";

/**
 * e2e: /profile 안전성 개선 — readonly + 위험 비례 편집 패턴
 * (spec/2-navigation/9-user-profile.md §2).
 *
 * 핵심 회귀 안전망:
 *  - 디폴트 readonly 진입 (편집 인풋이 자동 활성화되지 않음)
 *  - 이름 인라인 편집 → diff 확인 모달 → 확정 시에만 PATCH
 *  - 환경설정 [취소] 시 라이브 프리뷰 원복 + PATCH 미호출
 *  - 비밀번호는 sub-route /profile/change-password 로 분리
 */

const ACCESS = "mock-access-token";

interface MockUser {
  id: string;
  email: string;
  name: string;
  locale: "ko" | "en";
  theme: "light" | "dark";
  avatarUrl?: string | null;
}

const BASE_USER: MockUser = {
  id: "user-1",
  email: "alice@example.com",
  name: "Alice",
  locale: "ko",
  theme: "light",
};

const WORKSPACE = {
  id: "ws-1",
  name: "Personal",
  type: "personal",
  slug: "personal-alice",
  role: "owner",
};

interface SetupResult {
  user: MockUser;
  patchCalls: Array<Record<string, unknown>>;
  changePasswordCalls: Array<Record<string, unknown>>;
}

/**
 * /profile 진입에 필요한 인증·워크스페이스·알림 mock 을 모두 등록하고,
 * /api/users/me 와 /api/users/me/change-password 를 dynamic mock 으로 등록한다.
 * PATCH 결과는 다음 GET 응답에 즉시 반영되어 react-query invalidate 후 UI 갱신을 검증할 수 있다.
 */
async function setupProfileMocks(page: Page): Promise<SetupResult> {
  const state: SetupResult = {
    user: { ...BASE_USER },
    patchCalls: [],
    changePasswordCalls: [],
  };

  await page.context().addCookies([
    { name: "has_session", value: "1", domain: "localhost", path: "/" },
  ]);

  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { accessToken: ACCESS } }),
    });
  });

  await page.route("**/api/users/me", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: state.user }),
      });
    } else if (method === "PATCH") {
      const patch = (route.request().postDataJSON() ?? {}) as Record<
        string,
        unknown
      >;
      state.patchCalls.push(patch);
      state.user = { ...state.user, ...patch } as MockUser;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: state.user }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/users/me/change-password", async (route) => {
    if (route.request().method() === "POST") {
      const body = (route.request().postDataJSON() ?? {}) as Record<
        string,
        unknown
      >;
      state.changePasswordCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ok: true } }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/workspaces", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [WORKSPACE] }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/notifications/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: 0 }),
    });
  });

  await page.route(/\/api\/notifications(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  return state;
}

test.describe("/profile readonly + 인라인 편집", () => {
  test("디폴트 진입 시 모든 카드가 readonly — input 이 자동 활성화되지 않는다", async ({
    page,
  }) => {
    await setupProfileMocks(page);
    await page.goto("/profile");

    // readonly 표시 출현
    await expect(page.getByTestId("profile-name-readonly")).toHaveText(
      /Alice/,
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("pref-theme-readonly")).toBeVisible();
    await expect(page.getByTestId("pref-language-readonly")).toBeVisible();

    // 편집 input 은 보이지 않아야 한다
    expect(await page.getByRole("textbox").count()).toBe(0);

    // 편집 진입 버튼은 보인다
    await expect(page.getByTestId("profile-info-edit")).toBeVisible();
    await expect(page.getByTestId("profile-pref-edit")).toBeVisible();

    // 비밀번호 카드는 sub-route 로의 링크로 노출
    await expect(page.getByTestId("profile-change-password-link")).toHaveAttribute(
      "href",
      "/profile/change-password",
    );
  });

  test("이름 인라인 편집 → diff 모달 → 확정 시에만 PATCH 가 호출된다", async ({
    page,
  }) => {
    const state = await setupProfileMocks(page);
    await page.goto("/profile");
    await expect(page.getByTestId("profile-name-readonly")).toBeVisible({
      timeout: 10_000,
    });

    // 편집 토글 → input 활성
    await page.getByTestId("profile-info-edit").click();
    const nameInput = page.getByLabel(/이름|Name/i);
    await expect(nameInput).toBeVisible();

    // 입력 → [저장] 클릭 시점에는 아직 PATCH 호출되지 않아야 한다
    await nameInput.fill("Alice Kim");
    await page.getByTestId("profile-info-save").click();
    expect(state.patchCalls).toEqual([]);

    // diff 모달의 before/after 검증
    await expect(page.getByTestId("diff-before-이름")).toHaveText("Alice");
    await expect(page.getByTestId("diff-after-이름")).toHaveText("Alice Kim");

    // [확정] → PATCH 호출 + readonly 복귀 + 새 이름 표시
    await page.getByTestId("diff-confirm").click();
    await expect.poll(() => state.patchCalls.length).toBe(1);
    expect(state.patchCalls[0]).toEqual({ name: "Alice Kim" });

    await expect(page.getByTestId("profile-name-readonly")).toHaveText(
      /Alice Kim/,
      { timeout: 10_000 },
    );
    expect(await page.getByRole("textbox").count()).toBe(0);
  });

  test("환경설정 [편집] → 테마 변경 → [취소] 시 PATCH 가 호출되지 않는다", async ({
    page,
  }) => {
    const state = await setupProfileMocks(page);
    await page.goto("/profile");
    await expect(page.getByTestId("pref-theme-readonly")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("profile-pref-edit").click();
    await page.getByTestId("pref-theme-dark").click();
    await page.getByTestId("profile-pref-cancel").click();

    // PATCH 미호출 + readonly 복귀
    expect(state.patchCalls).toEqual([]);
    await expect(page.getByTestId("pref-theme-readonly")).toBeVisible();
    expect(await page.getByTestId("pref-theme-dark").count()).toBe(0);
  });

  test("비밀번호 카드 [변경하기 →] → /profile/change-password 진입 → 폼 제출 → /profile 리다이렉트", async ({
    page,
  }) => {
    const state = await setupProfileMocks(page);
    await page.goto("/profile");
    await expect(page.getByTestId("profile-change-password-link")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("profile-change-password-link").click();
    await expect(page).toHaveURL(/\/profile\/change-password$/);

    await page
      .getByLabel(/현재 비밀번호|Current password/i)
      .fill("old-password-123");
    await page
      .getByLabel(/^새 비밀번호$|^New password$/i)
      .fill("new-password-456");
    await page
      .getByLabel(/비밀번호 확인|Confirm password/i)
      .fill("new-password-456");

    await page.getByRole("button", { name: /^변경$|^Change$/i }).click();

    // POST 호출 검증
    await expect.poll(() => state.changePasswordCalls.length).toBe(1);
    expect(state.changePasswordCalls[0]).toEqual({
      currentPassword: "old-password-123",
      newPassword: "new-password-456",
    });

    // /profile 으로 리다이렉트
    await expect(page).toHaveURL(/\/profile$/, { timeout: 10_000 });
  });
});
