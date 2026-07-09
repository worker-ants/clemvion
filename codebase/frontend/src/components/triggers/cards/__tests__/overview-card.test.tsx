import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { TriggerDetail } from "@/lib/api/triggers";

// URL slug 이 SoT — useWorkspaceSlug 이 params.slug 를 우선 반환한다.
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "team-x" }),
}));

import { OverviewCard } from "../overview-card";

const trigger = {
  id: "t1",
  name: "My Trigger",
  type: "webhook",
  isActive: true,
  workflowId: "wf-1",
  workflowName: "My Workflow",
} as unknown as TriggerDetail;

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OverviewCard trigger={trigger} onSaved={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("OverviewCard — workflow link is slug-prefixed (phase 2)", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws-1", name: "Team", type: "team", slug: "team-x", role: "editor" },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
  });

  it("workflow name links to /w/<slug>/workflows/<id> (buildEditorHref)", () => {
    renderCard();
    const link = screen.getByText("My Workflow").closest("a");
    expect(link).toHaveAttribute("href", "/w/team-x/workflows/wf-1");
  });
});
