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

/**
 * e2e: 사용자 가이드(`/docs`)는 워크스페이스 밖 라우트 — slug 무한 중첩 회귀 가드.
 *
 * 사용자 보고 증상: 사이드바 "사용자 가이드" 클릭 시 URL 이
 * `/w/<slug>/w/<slug>/w/<slug>/…/docs` 로 계속 길어지며 가이드에 도달하지 못함.
 *
 * 원인 2단: ① 사이드바가 slug 밖 라우트인 `/docs` 에도 `buildWorkspaceHref` 를 적용해 없는
 * 라우트 `/w/<slug>/docs` 생성 → ② `(main)/[...rest]` catch-all 이 그 경로에 slug 를 재부착.
 * 유닛 테스트는 `useParams` 를 mock 하므로 **실제 Next 라우트 매칭**(`w/[slug]` 하위에 `docs`
 * 가 없어 catch-all 로 떨어지는지)과 클라이언트 `notFound()` 의 실동작을 증명하지 못한다 —
 * 그 계층은 브라우저에서만 검증된다.
 *
 * spec/2-navigation/_layout.md §2.2 각주 · 9-user-profile.md §3.
 */
test.describe("user guide (/docs) is outside the workspace slug", () => {
  test("sidebar user-guide link is bare /docs (no slug prefix)", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.goto(`/w/${SLUG}/dashboard`);

    const guideLink = page.locator('nav a[href="/docs"]');
    await expect(guideLink).toBeVisible({ timeout: 15_000 });
    // 회귀 시 `/w/<slug>/docs` 가 되어 무한 중첩을 유발한다.
    await expect(page.locator(`nav a[href="/w/${SLUG}/docs"]`)).toHaveCount(0);
  });

  test("clicking the sidebar user-guide menu lands on the guide, not a slug-nesting loop", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.goto(`/w/${SLUG}/dashboard`);

    await page.locator('nav a[href="/docs"]').click();

    // `/docs` 인덱스는 첫 문서로 redirect 한다 → `/docs/<locale>/...` 에 착지.
    await page.waitForURL(/\/docs\/(ko|en)\//, { timeout: 15_000 });

    const pathname = new URL(page.url()).pathname;
    // 핵심 회귀 가드: slug 세그먼트가 단 한 번도 끼어들지 않는다.
    expect(pathname).not.toContain("/w/");
    expect(pathname.match(/\/w\//g)).toBeNull();
  });

  test("guide page keeps other nav items slug-aware (store fallback)", async ({
    page,
  }) => {
    await mockAuth(page);
    // `/docs` 에는 slug URL 파라미터가 없다 — useWorkspaceSlug 가 store 로 폴백해야 한다.
    await page.goto("/docs");
    await page.waitForURL(/\/docs\/(ko|en)\//, { timeout: 15_000 });

    await expect(
      page.locator(`nav a[href="/w/${SLUG}/workflows"]`).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("stale /w/<slug>/docs URL terminates on 404 instead of nesting forever", async ({
    page,
  }) => {
    await mockAuth(page);
    // 이 버그로 이미 브라우저 히스토리·북마크에 남은 URL. 재부착 없이 종결되어야 한다
    // (spec/2-navigation/11-error-empty-states.md §1.3 "존재하지 않는 라우트 접근 → 404").
    await page.goto(`/w/${SLUG}/docs`);

    // 404 UI 가 실제로 렌더된다 — URL 고정만 보면 "조용한 blank 렌더" 도 통과해버리므로
    // notFound() 가 실제로 not-found 바운더리를 태웠는지까지 증명한다.
    await expect(
      page.getByRole("heading", { name: /페이지를 찾을 수 없습니다|Page not found/ }),
    ).toBeVisible({ timeout: 15_000 });
    // 404 는 사이드바를 유지한다 (11-error-empty-states.md §1.3 "사이드바 표시").
    await expect(page.locator('nav a[href="/docs"]')).toBeVisible();

    const pathname = new URL(page.url()).pathname;
    // 세그먼트가 늘어나지 않았다 — `/w/<slug>/w/<slug>/docs` 로 forward 되지 않음.
    expect(pathname).toBe(`/w/${SLUG}/docs`);
    expect((pathname.match(/\/w\//g) ?? []).length).toBe(1);
  });

  test("workspace root (/w/<slug>) forwards to that workspace dashboard", async ({
    page,
  }) => {
    await mockAuth(page);
    // `w/[slug]` 레벨에 page 가 없어 이 경로도 catch-all 로 떨어진다 — 재부착 시
    // `/w/<slug>/w/<slug>` 로 같은 무한 루프에 빠졌다.
    await page.goto(`/w/${SLUG}`);
    await page.waitForURL(new RegExp(`/w/${SLUG}/dashboard`), {
      timeout: 15_000,
    });
  });
});
