import { expect, test } from "@playwright/test";
import { mockAuth, WORKSPACE } from "../helpers/mock-auth";

/**
 * e2e: 워크스페이스 슬러그 URL 라우팅 (spec/2-navigation/9-user-profile.md §3).
 *
 * URL slug 이 활성 워크스페이스의 FE 라우팅 SoT 임을 브라우저 레벨에서 검증한다:
 *   - deep-link: `/w/<slug>/...` 직접 진입이 해소·렌더된다.
 *   - redirect 흡수: 구 무-slug 경로·알림 딥링크·루트(`/`)가 활성 slug 로 forward 된다.
 *   - 사이드바 네비게이션이 slug-aware href 를 만든다 (broken-link 회귀 방지).
 *
 * 인증·워크스페이스 mock 은 공용 헬퍼(e2e/helpers/mock-auth, slug=personal-alice).
 */

const SLUG = WORKSPACE.slug; // "personal-alice"

test.describe("workspace slug routing", () => {
  test("deep-link into /w/<slug> resolves and renders slug-aware sidebar nav", async ({
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

    await page.goto(`/w/${SLUG}/workflows`);

    // 사이드바 네비게이션 링크가 slug-aware 로 렌더된다 (layout chrome 은 gate 밖).
    await expect(
      page.locator(`a[href="/w/${SLUG}/workflows"]`).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator(`a[href="/w/${SLUG}/dashboard"]`).first(),
    ).toBeVisible();
    // URL 은 slug 를 유지한다.
    expect(new URL(page.url()).pathname).toBe(`/w/${SLUG}/workflows`);
  });

  test("bare legacy path redirects to the active workspace slug", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.goto("/workflows");
    await page.waitForURL(new RegExp(`/w/${SLUG}/workflows`), {
      timeout: 15_000,
    });
  });

  test("root path redirects to the active workspace dashboard", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.goto("/");
    await page.waitForURL(new RegExp(`/w/${SLUG}/dashboard`), {
      timeout: 15_000,
    });
  });

  test("notification-style deep link (/integrations/<id>) is absorbed into the slug", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.goto("/integrations/int-abc");
    await page.waitForURL(new RegExp(`/w/${SLUG}/integrations/int-abc`), {
      timeout: 15_000,
    });
  });

  // 슬러그 라우팅 phase 2: 에디터 캔버스(/workflows/<id>)도 slug 아래로 편입.
  test("bare editor path (/workflows/<id>) is absorbed into the slug", async ({
    page,
  }) => {
    await mockAuth(page);
    // 구 북마크·실패류 알림이 발행하는 bare 에디터 경로 → catch-all 이 활성 slug 로 forward.
    await page.goto("/workflows/wf-e2e");
    await page.waitForURL(new RegExp(`/w/${SLUG}/workflows/wf-e2e`), {
      timeout: 15_000,
    });
  });

  test("editor deep-link (/w/<slug>/workflows/<id>) resolves under the slug gate", async ({
    page,
  }) => {
    await mockAuth(page);
    // 에디터 로더의 3 요청을 최소 응답으로 스텁 (라우팅 검증이 목적).
    const wf = { id: "wf-e2e", name: "E2E WF" };
    await page.route(/\/api\/workflows\/wf-e2e$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: wf }),
      }),
    );
    await page.route(/\/api\/workflows\/wf-e2e\/(nodes|edges)$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto(`/w/${SLUG}/workflows/wf-e2e`);

    // slug 게이트가 URL 워크스페이스로 정합 → 무효-slug fallback(dashboard) 으로 튕기지 않고
    // 에디터 경로가 그대로 유지된다.
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toBe(`/w/${SLUG}/workflows/wf-e2e`);
  });
});
