/**
 * `<WorkspaceSlugGate>` — slug 해소 + reconcile gate 의 행위 SoT 테스트.
 *
 * URL slug 가 FE 라우팅 SoT (9-user-profile §3). 게이트는:
 *   - slug↔활성 워크스페이스가 정합될 때까지 children 을 gate 하고,
 *   - 불일치면 `switchWorkspace(resolvedId)` 로 URL 우선 reconcile 하며,
 *   - 무효 slug 는 default 워크스페이스 dashboard 로 redirect (UX 전용).
 *
 * `(main)/w/[slug]/layout` 과 `(editor)/w/[slug]/layout` 이 이 컴포넌트를 공유하므로 행위 검증은
 * 여기서 단일화하고, 두 layout 테스트는 "게이트가 배선됐는지"만 확인하는 얇은 wiring 테스트로 둔다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

let mockParams: Record<string, unknown> = {};
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

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

import { WorkspaceSlugGate } from "../workspace-slug-gate";

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

function renderGate() {
  return render(
    <WorkspaceSlugGate>
      <div data-testid="child">content</div>
    </WorkspaceSlugGate>,
  );
}

describe("WorkspaceSlugGate", () => {
  it("renders children when the URL slug matches the active workspace", () => {
    renderGate();
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(switchWorkspaceSpy).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("gates children until reconciled and switches to the URL workspace (URL 우선)", async () => {
    storeState.currentWorkspaceId = "b"; // active=b, URL=team-a → mismatch → reconcile to a
    renderGate();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await waitFor(() => expect(switchWorkspaceSpy).toHaveBeenCalledWith("a"));
  });

  it("redirects an invalid/non-member slug to the default workspace dashboard (UX 전용)", async () => {
    mockParams = { slug: "does-not-exist" };
    renderGate();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/dashboard"),
    );
    expect(switchWorkspaceSpy).not.toHaveBeenCalled();
  });

  it("shows the loading gate while workspaces are not yet loaded", () => {
    storeState.loaded = false;
    renderGate();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(switchWorkspaceSpy).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
