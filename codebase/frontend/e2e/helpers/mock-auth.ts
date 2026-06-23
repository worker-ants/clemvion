import { type Page } from "@playwright/test";

/**
 * (main) 레이아웃의 AuthProvider/Sidebar 가 호출하는 인증·워크스페이스·알림 API 를 일괄 mock 한다.
 * 모두 mock 하지 않으면 페이지가 loading/redirect 상태에서 멈춘다.
 *
 * 여러 e2e 스펙(web-chat/console·workflows/list 등)이 동일 셋업을 중복 정의하던 것을 단일화한다.
 * 응답 shape: backend `{ data, pagination }` / `{ data }` 래핑(TransformInterceptor).
 */

export const ACCESS = "mock-access-token";

export const USER = {
  id: "user-1",
  email: "alice@example.com",
  name: "Alice",
  locale: "ko",
  theme: "light",
} as const;

/** 워크스페이스 role 을 바꿔 RBAC 분기(viewer/editor/owner)를 검증할 수 있게 한다. */
export function makeWorkspace(role = "owner") {
  return { id: "ws-1", name: "Personal", type: "personal", slug: "personal-alice", role };
}

/** 기본(owner) 워크스페이스 — id 참조용(예: workflows 응답의 workspaceId). */
export const WORKSPACE = makeWorkspace();

/** (main) 페이지가 데이터 도착까지 시간이 걸려 첫 assertion 의 여유 타임아웃. */
export const PAGE_READY_TIMEOUT = 15_000;

export async function mockAuth(page: Page, opts: { role?: string } = {}): Promise<void> {
  const workspace = makeWorkspace(opts.role ?? "owner");
  // proxy.ts 가 has_session cookie 없으면 server-side 로 /login redirect → 진입 전 주입.
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
  await page.route("**/api/users/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: USER }) }),
  );
  await page.route("**/api/workspaces", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [workspace] }) })
      : route.continue(),
  );
  await page.route("**/api/notifications/unread-count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 0 }) }),
  );
  await page.route(/\/api\/notifications(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
}
