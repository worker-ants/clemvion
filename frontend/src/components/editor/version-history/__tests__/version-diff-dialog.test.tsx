import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: { getVersion: vi.fn() },
}));

import { workflowsApi } from "@/lib/api/workflows";
import { VersionDiffDialog } from "../version-diff-dialog";
import { useLocaleStore } from "@/lib/stores/locale-store";

function makeVersion(version: number, name: string) {
  return {
    id: `v-${version}`,
    workflowId: "wf-1",
    version,
    changeSummary: null,
    createdBy: "u",
    createdAt: "2026-04-14T10:00:00Z",
    snapshot: {
      name,
      description: null,
      nodes:
        version === 1
          ? []
          : [
              {
                id: "n1",
                type: "manual_trigger",
                category: "trigger",
                label: "Start",
                positionX: 0,
                positionY: 0,
                config: {},
                isDisabled: false,
                description: null,
                containerId: null,
                toolOwnerId: null,
              },
            ],
      edges: [],
    },
  };
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocaleStore.setState({ locale: "en" });
});

describe("VersionDiffDialog", () => {
  it("orders versions so the lower number is 'before' regardless of selection order", async () => {
    vi.mocked(workflowsApi.getVersion).mockImplementation(
      async (_wf: string, vid: string) => {
        const n = vid === "v-1" ? 1 : 2;
        return { data: { data: makeVersion(n, n === 1 ? "Old" : "New") } };
      },
    );

    await act(async () => {
      render(
        <VersionDiffDialog
          workflowId="wf-1"
          aId="v-2"
          bId="v-1"
          onClose={vi.fn()}
        />,
        { wrapper: wrapper() },
      );
    });

    expect(await screen.findByText(/Diff: v1 → v2/)).toBeInTheDocument();
    expect(screen.getByText(/Added nodes/)).toBeInTheDocument();
    expect(screen.getByText("Old")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders error when one of the versions fails to load", async () => {
    vi.mocked(workflowsApi.getVersion).mockRejectedValue(new Error("boom"));

    await act(async () => {
      render(
        <VersionDiffDialog
          workflowId="wf-1"
          aId="v-1"
          bId="v-2"
          onClose={vi.fn()}
        />,
        { wrapper: wrapper() },
      );
    });

    expect(
      await screen.findByText(/Failed to load versions/),
    ).toBeInTheDocument();
  });
});
