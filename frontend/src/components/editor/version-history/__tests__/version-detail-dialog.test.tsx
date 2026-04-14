import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: { getVersion: vi.fn() },
}));

import { workflowsApi } from "@/lib/api/workflows";
import { VersionDetailDialog } from "../version-detail-dialog";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => vi.clearAllMocks());

describe("VersionDetailDialog", () => {
  it("renders snapshot nodes and edges from API response", async () => {
    vi.mocked(workflowsApi.getVersion).mockResolvedValue({
      data: {
        data: {
          id: "v-1",
          workflowId: "wf-1",
          version: 5,
          changeSummary: "added http",
          createdBy: "u",
          createdAt: "2026-04-14T10:00:00Z",
          snapshot: {
            name: "My WF",
            description: null,
            nodes: [
              {
                id: "n1",
                type: "manual_trigger",
                category: "trigger",
                label: "Start",
                positionX: 10,
                positionY: 20,
                config: {},
                isDisabled: false,
                description: null,
                containerId: null,
                toolOwnerId: null,
              },
            ],
            edges: [
              {
                id: "e1",
                sourceNodeId: "n1",
                sourcePort: "out",
                targetNodeId: "n2",
                targetPort: "in",
                type: "data",
                condition: null,
              },
            ],
          },
        },
      },
    } as never);

    await act(async () => {
      render(
        <VersionDetailDialog
          workflowId="wf-1"
          versionId="v-1"
          onClose={vi.fn()}
        />,
        { wrapper: wrapper() },
      );
    });

    expect(await screen.findByText(/v5/)).toBeInTheDocument();
    expect(screen.getByText(/added http/)).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText(/Nodes \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Edges \(1\)/)).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    vi.mocked(workflowsApi.getVersion).mockRejectedValue(new Error("nope"));

    await act(async () => {
      render(
        <VersionDetailDialog
          workflowId="wf-1"
          versionId="v-1"
          onClose={vi.fn()}
        />,
        { wrapper: wrapper() },
      );
    });

    expect(
      await screen.findByText(/Failed to load version/),
    ).toBeInTheDocument();
  });
});
