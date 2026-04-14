import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEditorStore } from "@/lib/stores/editor-store";

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    restoreVersion: vi.fn(),
  },
}));

import { workflowsApi } from "@/lib/api/workflows";
import { VersionHistoryPanel } from "../version-history-panel";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

async function renderPanel() {
  await act(async () => {
    render(<VersionHistoryPanel />, { wrapper: wrapper() });
  });
}

describe("VersionHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      workflowId: "wf-1",
      versionHistoryOpen: true,
    });
  });

  it("renders nothing when closed", async () => {
    useEditorStore.setState({ versionHistoryOpen: false });
    await renderPanel();
    expect(screen.queryByTestId("version-history-panel")).toBeNull();
  });

  it("renders version list when open", async () => {
    vi.mocked(workflowsApi.listVersions).mockResolvedValue({
      data: {
        data: [
          {
            id: "v-1",
            workflowId: "wf-1",
            version: 2,
            changeSummary: "added http node",
            createdBy: "u",
            createdAt: "2026-04-14T10:00:00Z",
            creator: { id: "u", name: "Alice" },
          },
          {
            id: "v-2",
            workflowId: "wf-1",
            version: 1,
            changeSummary: null,
            createdBy: "u",
            createdAt: "2026-04-14T09:00:00Z",
            creator: { id: "u", name: "Alice" },
          },
        ],
      },
    } as never);

    await renderPanel();
    expect(await screen.findByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("added http node")).toBeInTheDocument();
  });

  it("shows empty state when no versions exist", async () => {
    vi.mocked(workflowsApi.listVersions).mockResolvedValue({
      data: { data: [] },
    } as never);

    await renderPanel();
    expect(
      await screen.findByText(/No versions yet/i),
    ).toBeInTheDocument();
  });

  it("shows error state on failure", async () => {
    vi.mocked(workflowsApi.listVersions).mockRejectedValue(
      new Error("boom"),
    );

    await renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Failed to load versions/,
    );
  });

  it("refetches versions when saveCount bumps", async () => {
    vi.mocked(workflowsApi.listVersions)
      .mockResolvedValueOnce({ data: { data: [] } } as never)
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: "v-new",
              workflowId: "wf-1",
              version: 1,
              changeSummary: "first save",
              createdBy: "u",
              createdAt: "2026-04-14T10:00:00Z",
              creator: null,
            },
          ],
        },
      } as never);

    await renderPanel();
    await screen.findByText(/No versions yet/i);
    expect(workflowsApi.listVersions).toHaveBeenCalledTimes(1);

    await act(async () => {
      useEditorStore.setState((s) => ({ saveCount: s.saveCount + 1 }));
    });

    expect(await screen.findByText("first save")).toBeInTheDocument();
    expect(workflowsApi.listVersions).toHaveBeenCalledTimes(2);
  });

  it("closes panel via close button", async () => {
    vi.mocked(workflowsApi.listVersions).mockResolvedValue({
      data: { data: [] },
    } as never);

    await renderPanel();
    const closeBtn = await screen.findByLabelText("Close version history");
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    expect(useEditorStore.getState().versionHistoryOpen).toBe(false);
  });
});
