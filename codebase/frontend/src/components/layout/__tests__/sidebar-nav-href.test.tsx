/**
 * sidebar.tsx — 글로벌 네비게이션 항목의 href 생성 규칙 회귀 가드.
 *
 * 회귀 배경: `navItems.map` 이 **예외 없이** `buildWorkspaceHref(slug, item.href)` 를 적용해
 * 워크스페이스 밖 라우트인 `/docs` 까지 `/w/<slug>/docs` 로 만들었다. 그런 라우트는 없어
 * `(main)/[...rest]` catch-all 로 떨어지고, catch-all 이 slug 를 재부착하면서
 * `/w/a/w/a/docs` → `/w/a/w/a/w/a/docs` → … 무한 중첩이 발생했다 (사용자 보고).
 *
 * spec/2-navigation/_layout.md §2.2 각주: "예외 — User Guide(`/docs`)는 워크스페이스 무관
 * 콘텐츠라 slug 밖으로 유지한다". 본 테스트가 그 예외를 고정한다.
 *
 * 기존 `sidebar.test.tsx` 는 store 에 워크스페이스가 없어 slug=null 이라 이 결함을 재현하지
 * 못한다(모든 href 가 bare 로 나옴). 그래서 slug 가 있는 상태를 별도 파일로 세운다.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";

// vi.mock 팩토리는 호이스팅 때문에 각 파일에 인라인이어야 한다 — 그 외 setup 만 공유.
// 사유: sidebar-test-utils 헤더.
import { stubMatchMedia, renderSidebar as renderSidebarWith } from "./sidebar-test-utils";

stubMatchMedia();

let mockPathname = "/w/team-a/dashboard";
vi.mock("next/navigation", () => ({
  // slug 세그먼트가 없는 라우트를 흉내 — useWorkspaceSlug 가 store 로 폴백한다.
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  // className 까지 통과시켜야 isActive 스타일을 관측할 수 있다.
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    patch: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { name: "Test User" }, logout: vi.fn() }),
}));

// 활성 워크스페이스가 **있는** 상태 — 이 조건에서만 /docs 이중 prefix 결함이 재현된다.
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({
      workspaces: [{ id: "a", slug: "team-a", name: "Team A", type: "team", role: "owner" }],
      currentWorkspaceId: "a",
      loaded: true,
      setWorkspaces: vi.fn(),
      switchWorkspace: vi.fn(),
    }),
}));

vi.mock("@/lib/stores/sidebar-store", () => ({
  useSidebarStore: (sel: (s: unknown) => unknown) =>
    sel({
      collapsed: false,
      toggleCollapse: vi.fn(),
      setIsSmall: vi.fn(),
      setIsMedium: vi.fn(),
    }),
  selectCollapsed: (s: { collapsed: boolean }) => s.collapsed,
}));

vi.mock("@/lib/workspace/use-workspaces", () => ({ useWorkspaces: () => ({}) }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: { list: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}));
vi.mock("@/lib/api/auth", () => ({ authApi: { logout: vi.fn() } }));
vi.mock("@/components/workspace/create-team-workspace-dialog", () => ({
  CreateTeamWorkspaceDialog: () => null,
}));
vi.mock("@/components/ui/logo", () => ({
  Logo: () => <span data-testid="logo" />,
  LogoMark: () => <span data-testid="logomark" />,
}));
vi.mock("@/lib/utils/workspace", () => ({
  roleLabelKey: () => "sidebar.roleLabel.member",
}));

import { Sidebar } from "../sidebar";

const renderSidebar = () => renderSidebarWith(Sidebar);

/** 라벨(i18n 키 passthrough)로 nav 링크의 href 를 읽는다. */
function navHref(labelKey: string): string | null {
  return screen.getByText(labelKey).closest("a")?.getAttribute("href") ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = "/w/team-a/dashboard";
});

describe("Sidebar — nav href 생성 (워크스페이스 스코프 예외)", () => {
  it("사용자 가이드는 slug 를 붙이지 않은 bare /docs 로 링크한다", async () => {
    await renderSidebar();
    // 회귀 시 "/w/team-a/docs" 가 되어 catch-all 무한 중첩을 유발한다.
    expect(navHref("sidebar.userGuide")).toBe("/docs");
  });

  it("워크스페이스 스코프 항목에는 활성 slug 를 붙인다", async () => {
    await renderSidebar();
    expect(navHref("sidebar.dashboard")).toBe("/w/team-a/dashboard");
    expect(navHref("sidebar.workflows")).toBe("/w/team-a/workflows");
    expect(navHref("sidebar.agentMemory")).toBe("/w/team-a/agent-memory");
  });

  it("어떤 nav 링크도 /w/<slug>/docs 형태를 만들지 않는다", async () => {
    await renderSidebar();
    const hrefs = Array.from(document.querySelectorAll("nav a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).not.toMatch(/^\/w\/[^/]+\/docs/);
    }
  });

  it("가이드 페이지 안(/docs/ko/...)에서도 사용자 가이드가 활성으로 표시된다", async () => {
    mockPathname = "/docs/ko/01-getting-started/welcome";
    await renderSidebar();
    const link = screen.getByText("sidebar.userGuide").closest("a");
    // 활성 스타일 = primary 배경 (sidebar.tsx 의 isActive 분기).
    expect(link?.className).toContain("bg-[hsl(var(--primary))]");
  });

  it("가이드 페이지 안에서도 다른 메뉴는 활성 slug 링크를 유지한다", async () => {
    // useWorkspaceSlug 가 URL 파라미터 부재 시 store 로 폴백하므로 slug 가 유지된다.
    mockPathname = "/docs/ko/01-getting-started/welcome";
    await renderSidebar();
    expect(navHref("sidebar.workflows")).toBe("/w/team-a/workflows");
  });
});
