/**
 * `(editor)/w/[slug]/layout.tsx` — 게이트 wiring 테스트 (슬러그 라우팅 phase 2).
 *
 * 에디터도 `(main)/w/[slug]` 와 동일한 공용 `<WorkspaceSlugGate>` 를 쓴다. 게이트 행위 SoT 는
 * `lib/workspace/__tests__/workspace-slug-gate.test.tsx`; 여기선 에디터 layout 이 게이트를 실제로
 * 배선하는지(회귀 시 캔버스가 wrong-workspace 컨텍스트로 렌더되는 것 방지)만 확인한다.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "team-a" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/workspace/use-workspaces", () => ({ useWorkspaces: () => ({}) }));
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({
      workspaces: [{ id: "a", slug: "team-a", name: "A" }],
      loaded: true,
      currentWorkspaceId: "a",
      switchWorkspace: vi.fn(),
    }),
}));

import EditorWorkspaceSlugLayout from "../layout";

describe("EditorWorkspaceSlugLayout (gate wiring)", () => {
  it("renders the canvas through WorkspaceSlugGate when reconciled", () => {
    render(
      <EditorWorkspaceSlugLayout>
        <div data-testid="canvas">editor canvas</div>
      </EditorWorkspaceSlugLayout>,
    );
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });
});
