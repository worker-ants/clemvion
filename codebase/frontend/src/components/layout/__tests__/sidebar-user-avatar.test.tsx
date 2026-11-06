/**
 * sidebar.tsx — 사용자 영역 아바타 (CLE-ACCT-PROFILE 「사이드바 사용자 영역 › 기본 표시」).
 *
 * 커버 범위:
 *   1. 아바타 주소가 있으면 이미지를 보인다
 *   2. 주소가 없으면 이름 이니셜을 보인다(프로필 카드와 같은 규칙)
 *   3. 이미지를 불러오지 못하면 이니셜로 바꾼다
 *   4. 접힌 사이드바에서는 이미지 대체 텍스트가 사용자 이름이다
 *
 * mock 구성은 sidebar.test.tsx 와 같다. vi.mock 팩토리는 호이스팅 때문에 파일마다 인라인이다
 * (사유: sidebar-test-utils 헤더). 사용자와 접힘 상태만 테스트마다 바꾼다.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { stubMatchMedia, renderSidebar } from "./sidebar-test-utils";

stubMatchMedia();

type MockUser = {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
} | null;

const authState = vi.hoisted(() => ({
  user: null as {
    name?: string;
    email?: string;
    avatarUrl?: string | null;
  } | null,
  collapsed: false,
}));

// ─── next/navigation mock ─────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// ─── next/link mock ───────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// ─── API client mock ──────────────────────────────────────────────────────
const apiGetMock = vi.fn();
const apiPatchMock = vi.fn().mockResolvedValue({});
const apiPostMock = vi.fn().mockResolvedValue({});
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

// ─── auth / workspace / sidebar stores mock ──────────────────────────────
vi.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: authState.user, logout: vi.fn() }),
}));
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({
      workspaces: [],
      currentWorkspaceId: null,
      setWorkspaces: vi.fn(),
      switchWorkspace: vi.fn(),
    }),
}));
vi.mock("@/lib/stores/sidebar-store", () => ({
  useSidebarStore: (sel: (s: unknown) => unknown) =>
    sel({
      collapsed: authState.collapsed,
      toggleCollapse: vi.fn(),
      setIsSmall: vi.fn(),
      setIsMedium: vi.fn(),
    }),
  selectCollapsed: (s: { collapsed: boolean }) => s.collapsed,
}));

// ─── i18n mock — passthrough key as label ────────────────────────────────
vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

// ─── workspace API mock ───────────────────────────────────────────────────
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: {
    list: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

// ─── auth API mock ────────────────────────────────────────────────────────
vi.mock("@/lib/api/auth", () => ({
  authApi: { logout: vi.fn() },
}));

// ─── CreateTeamWorkspaceDialog mock ──────────────────────────────────────
vi.mock("@/components/workspace/create-team-workspace-dialog", () => ({
  CreateTeamWorkspaceDialog: () => null,
}));

// ─── Logo mock ────────────────────────────────────────────────────────────
vi.mock("@/components/ui/logo", () => ({
  Logo: () => <span data-testid="logo" />,
  LogoMark: () => <span data-testid="logomark" />,
}));

// ─── workspace utils mock ─────────────────────────────────────────────────
vi.mock("@/lib/utils/workspace", () => ({
  roleLabelKey: () => "sidebar.roleLabel.member",
}));

import { Sidebar } from "../sidebar";

function setUser(user: MockUser) {
  authState.user = user;
}

describe("Sidebar — 사용자 영역 아바타", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    authState.collapsed = false;
    setUser({ name: "Test User", email: "test@example.com", avatarUrl: null });
  });

  it("아바타 주소가 있으면 이미지를 보인다", async () => {
    setUser({
      name: "Test User",
      email: "test@example.com",
      avatarUrl: "https://cdn.example.com/avatar.png",
    });
    await renderSidebar(Sidebar);

    const img = screen.getByTestId("sidebar-user-avatar-image");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/avatar.png");
    // 펼친 사이드바는 옆에 이름이 보이므로 이미지는 장식이다.
    expect(img).toHaveAttribute("alt", "");
    expect(screen.queryByTestId("sidebar-user-avatar-initials")).toBeNull();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("아바타가 없으면 프로필 카드와 같은 규칙으로 이니셜을 보인다", async () => {
    await renderSidebar(Sidebar);

    expect(screen.queryByTestId("sidebar-user-avatar-image")).toBeNull();
    expect(screen.getByTestId("sidebar-user-avatar-initials")).toHaveTextContent("TU");
  });

  it("이름이 비면 이메일 첫 글자를 쓴다", async () => {
    setUser({ name: "", email: "zoe@example.com", avatarUrl: null });
    await renderSidebar(Sidebar);

    expect(screen.getByTestId("sidebar-user-avatar-initials")).toHaveTextContent("Z");
  });

  it("이미지를 불러오지 못하면 이니셜로 바꾼다", async () => {
    setUser({
      name: "Test User",
      email: "test@example.com",
      avatarUrl: "https://cdn.example.com/broken.png",
    });
    await renderSidebar(Sidebar);

    fireEvent.error(screen.getByTestId("sidebar-user-avatar-image"));

    expect(screen.queryByTestId("sidebar-user-avatar-image")).toBeNull();
    expect(screen.getByTestId("sidebar-user-avatar-initials")).toHaveTextContent("TU");
  });

  it("접힌 사이드바에서는 이미지 대체 텍스트로 사용자 이름을 준다", async () => {
    authState.collapsed = true;
    setUser({
      name: "Test User",
      email: "test@example.com",
      avatarUrl: "https://cdn.example.com/avatar.png",
    });
    await renderSidebar(Sidebar);

    expect(screen.getByTestId("sidebar-user-avatar-image")).toHaveAttribute("alt", "Test User");
  });
});
