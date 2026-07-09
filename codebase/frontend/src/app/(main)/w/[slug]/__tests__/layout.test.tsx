/**
 * `(main)/w/[slug]/layout.tsx` — 게이트 wiring 테스트.
 *
 * slug 해소·reconcile·redirect·gate 의 행위 SoT 는
 * `lib/workspace/__tests__/workspace-slug-gate.test.tsx`. 여기선 layout 이 공용
 * `<WorkspaceSlugGate>` 를 실제로 배선하는지(정합 시 children 렌더)만 확인한다.
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

import WorkspaceSlugLayout from "../layout";

describe("WorkspaceSlugLayout (gate wiring)", () => {
  it("renders children through WorkspaceSlugGate when reconciled", () => {
    render(
      <WorkspaceSlugLayout>
        <div data-testid="child">content</div>
      </WorkspaceSlugLayout>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
