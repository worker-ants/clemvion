/**
 * create-team-workspace-dialog — 팀 워크스페이스 생성 후 **새 slug URL 로 네비게이션**
 * 하는지 검증한다 (switchWorkspace 로 토큰·store 를 정합한 뒤 `/w/<newSlug>/dashboard`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({}),
}));

const createTeamMock = vi.fn();
const listMock = vi.fn();
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: {
    createTeam: (...a: unknown[]) => createTeamMock(...a),
    list: (...a: unknown[]) => listMock(...a),
  },
}));

const switchWorkspaceMock = vi.fn();
const setWorkspacesMock = vi.fn();
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({ setWorkspaces: setWorkspacesMock, switchWorkspace: switchWorkspaceMock }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/i18n", () => ({ useT: () => (k: string) => k }));

import { CreateTeamWorkspaceDialog } from "../create-team-workspace-dialog";

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("CreateTeamWorkspaceDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches to and navigates to the new workspace's slug dashboard after creation", async () => {
    const created = { id: "new-id", name: "New Team", type: "team", slug: "new-team", role: "owner" };
    createTeamMock.mockResolvedValue(created);
    listMock.mockResolvedValue([created]);

    render(<CreateTeamWorkspaceDialog open onOpenChange={vi.fn()} />, {
      wrapper: wrapper(),
    });

    await userEvent.type(
      screen.getByLabelText("workspace.overviewName"),
      "New Team",
    );
    await userEvent.click(screen.getByText("workspace.createBtn"));

    await waitFor(() =>
      expect(switchWorkspaceMock).toHaveBeenCalledWith("new-id"),
    );
    expect(mockPush).toHaveBeenCalledWith("/w/new-team/dashboard");
  });
});
