import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard",
}));

// Mock API modules
vi.mock("@/lib/api/users", () => ({
  usersApi: {
    getMe: vi.fn(),
  },
}));

const mockRefreshAccessToken = vi.fn();
const mockSetSessionRestoreInProgress = vi.fn();

vi.mock("@/lib/api/client", () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  setSessionRestoreInProgress: (...args: unknown[]) =>
    mockSetSessionRestoreInProgress(...args),
  setAccessToken: vi.fn(),
}));

// reconcile-on-load 의존성 mock: 토큰별 활성 워크스페이스 디코드 + switch 호출 스파이.
const mockSwitchWorkspaceApi = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  switchWorkspaceApi: (...args: unknown[]) => mockSwitchWorkspaceApi(...args),
  decodeActiveWorkspaceId: (token: string) =>
    token === "token-personal" ? "personal-ws" : null,
}));

import { AuthProvider } from "../auth-provider";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { usersApi } from "@/lib/api/users";

const mockUser = {
  id: "1",
  email: "test@test.com",
  name: "Test User",
  locale: "en",
  theme: "light",
};

describe("AuthProvider", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: false,
    });
    vi.clearAllMocks();
    mockReplace.mockClear();
  });

  it("shows loading spinner while restoring session", () => {
    mockRefreshAccessToken.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    expect(screen.queryByTestId("content")).toBeNull();
  });

  it("restores session via cookie refresh", async () => {
    mockRefreshAccessToken.mockResolvedValue("refreshed-token");
    vi.mocked(usersApi.getMe).mockResolvedValue({
      data: { data: mockUser },
    } as never);

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("content")).toBeDefined();
    });
    expect(mockRefreshAccessToken).toHaveBeenCalled();
  });

  it("redirects to login when refresh fails", async () => {
    mockRefreshAccessToken.mockRejectedValue(new Error("refresh failed"));

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?redirect=%2Fdashboard",
      );
    });
  });

  it("redirects to login when refresh returns null", async () => {
    mockRefreshAccessToken.mockResolvedValue(null);

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?redirect=%2Fdashboard",
      );
    });
  });

  it("redirects to login when getMe fails after successful refresh", async () => {
    mockRefreshAccessToken.mockResolvedValue("token");
    vi.mocked(usersApi.getMe).mockRejectedValue(new Error("unauthorized"));

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?redirect=%2Fdashboard",
      );
    });
  });

  it("sets sessionRestoreInProgress true then false", async () => {
    mockRefreshAccessToken.mockResolvedValue("token");
    vi.mocked(usersApi.getMe).mockResolvedValue({
      data: { data: mockUser },
    } as never);

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("content")).toBeDefined();
    });
    expect(mockSetSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true);
    expect(mockSetSessionRestoreInProgress).toHaveBeenNthCalledWith(2, false);
  });

  it("reconciles to the persisted workspace when the restored token differs (결정1)", async () => {
    // 재발급 토큰은 personal-ws 로 활성화됐지만 사용자는 team-ws 를 선택해뒀다.
    mockRefreshAccessToken.mockResolvedValue("token-personal");
    vi.mocked(usersApi.getMe).mockResolvedValue({
      data: { data: mockUser },
    } as never);
    useWorkspaceStore.setState({ currentWorkspaceId: "team-ws" });

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockSwitchWorkspaceApi).toHaveBeenCalledWith("team-ws");
    });
  });

  it("does not reconcile when the token already matches the persisted workspace", async () => {
    mockRefreshAccessToken.mockResolvedValue("token-personal");
    vi.mocked(usersApi.getMe).mockResolvedValue({
      data: { data: mockUser },
    } as never);
    useWorkspaceStore.setState({ currentWorkspaceId: "personal-ws" });

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("content")).toBeDefined();
    });
    expect(mockSwitchWorkspaceApi).not.toHaveBeenCalled();
  });

  it("clears the persisted workspace when reconcile switch fails (non-member)", async () => {
    mockRefreshAccessToken.mockResolvedValue("token-personal");
    vi.mocked(usersApi.getMe).mockResolvedValue({
      data: { data: mockUser },
    } as never);
    mockSwitchWorkspaceApi.mockRejectedValue(new Error("NOT_A_MEMBER"));
    useWorkspaceStore.setState({ currentWorkspaceId: "stale-team-ws" });

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
    });
  });

  it("sets sessionRestoreInProgress false even on failure", async () => {
    mockRefreshAccessToken.mockRejectedValue(new Error("fail"));

    render(
      <AuthProvider>
        <div data-testid="content">Protected</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    expect(mockSetSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true);
    expect(mockSetSessionRestoreInProgress).toHaveBeenNthCalledWith(2, false);
  });
});
