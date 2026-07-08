/**
 * `(main)/[...rest]/page.tsx` — slug 없는 경로를 활성 워크스페이스 slug 로 흡수하는
 * catch-all 리다이렉트 테스트. 구 북마크·알림 딥링크·로그인후 `/dashboard` 를
 * `/w/<활성slug>/...` 로 forward 하며 query/hash 를 보존한다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

let mockParams: Record<string, unknown> = {};
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

vi.mock("@/lib/workspace/use-workspaces", () => ({
  useWorkspaces: () => ({}),
}));

let storeState: {
  workspaces: Array<{ id: string; slug: string }>;
  loaded: boolean;
  currentWorkspaceId: string | null;
};
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) => sel(storeState),
}));

import WorkspaceRedirect from "../[...rest]/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockParams = { rest: ["workflows"] };
  storeState = {
    workspaces: [{ id: "a", slug: "team-a" }],
    loaded: true,
    currentWorkspaceId: "a",
  };
  window.history.replaceState({}, "", "/workflows");
});

describe("WorkspaceRedirect (catch-all)", () => {
  it("forwards a bare path to the active workspace slug", async () => {
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/workflows"),
    );
  });

  it("forwards a nested notification deep-link (e.g. /integrations/<id>)", async () => {
    mockParams = { rest: ["integrations", "abc123"] };
    window.history.replaceState({}, "", "/integrations/abc123");
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/integrations/abc123"),
    );
  });

  it("preserves the query string when forwarding (e.g. invite accept token)", async () => {
    mockParams = { rest: ["invitations", "accept"] };
    window.history.replaceState({}, "", "/invitations/accept?token=xyz");
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/w/team-a/invitations/accept?token=xyz",
      ),
    );
  });

  it("defaults an empty rest to the workspace dashboard", async () => {
    mockParams = { rest: [] };
    window.history.replaceState({}, "", "/");
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/dashboard"),
    );
  });

  it("does not redirect until workspaces are loaded", () => {
    storeState.loaded = false;
    render(<WorkspaceRedirect />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
