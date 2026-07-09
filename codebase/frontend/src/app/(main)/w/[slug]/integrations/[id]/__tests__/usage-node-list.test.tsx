import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UsageWorkflow } from "@/lib/api/integrations";
import type { TFunction } from "@/lib/i18n";

// URL slug 이 SoT — useWorkspaceSlug 이 params.slug 를 우선 반환한다.
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "team-x" }),
}));

import { UsageNodeList } from "../usage-node-list";

const t = ((k: string) => k) as unknown as TFunction;
const usages: UsageWorkflow[] = [
  {
    workflowId: "wf-1",
    workflowName: "My Workflow",
    isActive: true,
    nodes: [{ id: "n1", label: "Node A", type: "http_request", usageKind: "direct" }],
  },
];

describe("UsageNodeList — editor link is slug-prefixed (phase 2)", () => {
  it("tab variant: workflow name links to /w/<slug>/workflows/<id>", () => {
    render(<UsageNodeList usages={usages} t={t} variant="tab" />);
    const link = screen.getByText("My Workflow").closest("a");
    expect(link).toHaveAttribute("href", "/w/team-x/workflows/wf-1");
  });

  it("dialog variant: 'open workflow' action links to /w/<slug>/workflows/<id>", () => {
    render(<UsageNodeList usages={usages} t={t} variant="dialog" />);
    const hrefs = screen
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/w/team-x/workflows/wf-1");
  });
});
