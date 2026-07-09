/**
 * `(editor)/w/[slug]/layout.tsx` — 에디터 slug 게이트 (슬러그 라우팅 phase 2).
 *
 * 에디터도 `(main)/w/[slug]` 와 동일한 공용 `<WorkspaceSlugGate>` 를 써서 slug↔활성 워크스페이스가
 * 정합될 때까지 캔버스를 gate 하고 URL 우선 reconcile 한다. 이 테스트는 **에디터 layout 이 게이트를
 * 실제로 배선하는지**(회귀 시 캔버스가 wrong-workspace 컨텍스트로 렌더되는 것 방지)를 고정한다.
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

import EditorWorkspaceSlugLayout from "../layout";

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
    <EditorWorkspaceSlugLayout>
      <div data-testid="canvas">editor canvas</div>
    </EditorWorkspaceSlugLayout>,
  );
}

describe("EditorWorkspaceSlugLayout", () => {
  it("renders the canvas when the URL slug matches the active workspace", () => {
    renderLayout();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(switchWorkspaceSpy).not.toHaveBeenCalled();
  });

  it("gates the canvas until reconciled and switches to the URL workspace (URL 우선)", async () => {
    // active = b, URL = team-a → mismatch → 캔버스 gate + reconcile to a.
    storeState.currentWorkspaceId = "b";
    renderLayout();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await waitFor(() => expect(switchWorkspaceSpy).toHaveBeenCalledWith("a"));
  });

  it("redirects an invalid slug to the default workspace dashboard (UX 전용)", async () => {
    mockParams = { slug: "does-not-exist" };
    renderLayout();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/dashboard"),
    );
  });
});
