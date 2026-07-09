/**
 * `(main)/w/[slug]/layout.tsx` — slug 해소 + reconcile gate 테스트.
 *
 * URL slug 가 FE 라우팅 SoT (9-user-profile §3). layout 은:
 *   - slug↔활성 워크스페이스가 정합될 때까지 children 을 gate 하고,
 *   - 불일치면 `switchWorkspace(resolvedId)` 로 URL 우선 reconcile 하며,
 *   - 무효 slug 는 default 워크스페이스 dashboard 로 redirect (UX 전용).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

let mockParams: Record<string, unknown> = {};
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

// 목록 fetch 는 no-op 로 스텁 — store 상태를 테스트가 직접 주입한다.
vi.mock("@/lib/workspace/use-workspaces", () => ({
  useWorkspaces: () => ({}),
}));

const switchWorkspaceSpy = vi.fn();
let storeState: {
  workspaces: Array<{ id: string; slug: string; name: string }>;
  loaded: boolean;
  currentWorkspaceId: string | null;
};
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({ ...storeState, switchWorkspace: switchWorkspaceSpy }),
}));

import WorkspaceSlugLayout from "../layout";

const WS_A = { id: "a", slug: "team-a", name: "A" };
const WS_B = { id: "b", slug: "team-b", name: "B" };

beforeEach(() => {
  vi.clearAllMocks();
  mockParams = { slug: "team-a" };
  storeState = {
    workspaces: [WS_A, WS_B],
    loaded: true,
    currentWorkspaceId: "a",
  };
});

function renderLayout() {
  return render(
    <WorkspaceSlugLayout>
      <div data-testid="child">workspace content</div>
    </WorkspaceSlugLayout>,
  );
}

describe("WorkspaceSlugLayout", () => {
  it("renders children when the URL slug matches the active workspace", () => {
    renderLayout();
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(switchWorkspaceSpy).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("gates children until reconciled and switches to the URL workspace (URL 우선)", async () => {
    // active = b, URL = team-a → mismatch → reconcile to a.
    storeState.currentWorkspaceId = "b";
    renderLayout();
    // gated: content hidden while store ≠ URL workspace.
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await waitFor(() =>
      expect(switchWorkspaceSpy).toHaveBeenCalledWith("a"),
    );
  });

  it("redirects an invalid/non-member slug to the default workspace dashboard (UX 전용)", async () => {
    mockParams = { slug: "does-not-exist" };
    renderLayout();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/dashboard"),
    );
    expect(switchWorkspaceSpy).not.toHaveBeenCalled();
  });

  it("shows the loading gate while workspaces are not yet loaded", () => {
    storeState.loaded = false;
    renderLayout();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(switchWorkspaceSpy).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
