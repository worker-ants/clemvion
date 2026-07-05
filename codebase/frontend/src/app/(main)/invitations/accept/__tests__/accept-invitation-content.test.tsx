import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";

let mockSearch = "token=tok-1";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const mockGetByToken = vi.fn();
vi.mock("@/lib/api/invitations", () => ({
  invitationsApi: { getByToken: (...a: unknown[]) => mockGetByToken(...a) },
}));
const mockAccept = vi.fn();
const mockList = vi.fn();
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: {
    acceptInvitation: (...a: unknown[]) => mockAccept(...a),
    list: (...a: unknown[]) => mockList(...a),
  },
}));
const mockLogout = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  authApi: { logout: (...a: unknown[]) => mockLogout(...a) },
}));
vi.mock("@/lib/api/client", () => ({ setAccessToken: vi.fn() }));

let mockUser: { email: string } | null = null;
const setUserMock = vi.fn();
vi.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: { getState: () => ({ user: mockUser, setUser: setUserMock }) },
}));
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({ setWorkspaces: vi.fn(), switchWorkspace: vi.fn() }),
}));
const localeState = { locale: "en" };
vi.mock("@/lib/stores/locale-store", () => ({
  useLocaleStore: Object.assign(
    (sel: (s: typeof localeState) => unknown) => sel(localeState),
    { getState: () => localeState },
  ),
}));
vi.mock("@/lib/i18n", () => ({
  useT: () => (k: string) => k,
  translate: (_l: string, k: string) => k,
}));

import { AcceptInvitationContent } from "../accept-invitation-content";

const META = {
  workspaceName: "Acme",
  invitedByName: "Alice",
  email: "invitee@example.com",
  role: "editor" as const,
  expiresAt: "2099-01-01T00:00:00Z",
};

describe("AcceptInvitationContent (§1.5.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch = "token=tok-1";
    mockUser = null;
  });

  it("shows the [Accept] button when logged-in email matches token email", async () => {
    mockUser = { email: "invitee@example.com" };
    mockGetByToken.mockResolvedValue(META);
    render(<AcceptInvitationContent />);
    await waitFor(() =>
      expect(screen.getByText("invitations.accept.accept")).toBeInTheDocument(),
    );
    expect(mockAccept).not.toHaveBeenCalled(); // 자동수락 아님 — 클릭 대기
  });

  it("accepts only after the button is clicked", async () => {
    mockUser = { email: "invitee@example.com" };
    mockGetByToken.mockResolvedValue(META);
    mockAccept.mockResolvedValue({ workspaceId: "ws-1" });
    mockList.mockResolvedValue([]);
    render(<AcceptInvitationContent />);
    const btn = await screen.findByText("invitations.accept.accept");
    await userEvent.click(btn);
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith("tok-1"));
  });

  it("shows mismatch notice + logout when logged-in email differs", async () => {
    mockUser = { email: "other@example.com" };
    mockGetByToken.mockResolvedValue(META);
    render(<AcceptInvitationContent />);
    await waitFor(() =>
      expect(
        screen.getByText("invitations.accept.logoutAndSwitch"),
      ).toBeInTheDocument(),
    );
    // 불일치 시 수락 버튼 미노출 + 자동수락 안 함
    expect(screen.queryByText("invitations.accept.accept")).toBeNull();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("logout clears session and routes to /login", async () => {
    mockUser = { email: "other@example.com" };
    mockGetByToken.mockResolvedValue(META);
    mockLogout.mockResolvedValue(undefined);
    render(<AcceptInvitationContent />);
    const btn = await screen.findByText("invitations.accept.logoutAndSwitch");
    await userEvent.click(btn);
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(setUserMock).toHaveBeenCalledWith(null);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("shows error on expired/invalid token (410)", async () => {
    mockUser = { email: "invitee@example.com" };
    mockGetByToken.mockRejectedValue(
      new AxiosError("gone", "410", undefined, undefined, {
        status: 410,
        data: { message: "expired" },
      } as never),
    );
    render(<AcceptInvitationContent />);
    await waitFor(() => expect(screen.getByText("expired")).toBeInTheDocument());
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("shows missing state when token query param is absent", () => {
    mockSearch = "";
    render(<AcceptInvitationContent />);
    expect(
      screen.getByText("invitations.accept.missingHint"),
    ).toBeInTheDocument();
    expect(mockGetByToken).not.toHaveBeenCalled();
  });
});
