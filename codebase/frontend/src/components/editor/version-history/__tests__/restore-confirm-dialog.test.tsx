import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: { restoreVersion: vi.fn() },
}));

import { workflowsApi } from "@/lib/api/workflows";
import { RestoreConfirmDialog } from "../restore-confirm-dialog";
import { useLocaleStore } from "@/lib/stores/locale-store";

const reloadSpy = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  useLocaleStore.setState({ locale: "en" });
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { reload: reloadSpy } as unknown as Location,
  });
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const baseVersion = {
  id: "v-1",
  workflowId: "wf-1",
  version: 3,
  changeSummary: null,
  createdBy: "u",
  createdAt: "2026-04-14T10:00:00Z",
};

describe("RestoreConfirmDialog", () => {
  it("calls restoreVersion API and reloads on confirm", async () => {
    vi.mocked(workflowsApi.restoreVersion).mockResolvedValue({
      data: { data: { workflow: {}, nodes: [], edges: [] } },
    } as never);

    const onClose = vi.fn();
    await act(async () => {
      render(
        <RestoreConfirmDialog
          workflowId="wf-1"
          version={baseVersion}
          onClose={onClose}
        />,
        { wrapper: wrapper() },
      );
    });

    const restoreBtn = screen.getByRole("button", { name: /Restore$/ });
    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    expect(workflowsApi.restoreVersion).toHaveBeenCalledWith("wf-1", "v-1");
    expect(reloadSpy).toHaveBeenCalled();
  });

  it("hands the cleared integration refs to the reloaded editor before reloading (REQ-WFVER-027)", async () => {
    window.sessionStorage.clear();
    const cleared = [
      { nodeId: "n-1", nodeLabel: "Fetch", field: "config.integrationId" },
    ];
    vi.mocked(workflowsApi.restoreVersion).mockResolvedValue({
      data: {
        data: { workflow: {}, nodes: [], edges: [], clearedIntegrationRefs: cleared },
      },
    } as never);
    // 다시 불러오는 순간 저장소에 이미 목록이 있어야 한다.
    let storedAtReload: string | null = null;
    reloadSpy.mockImplementationOnce(() => {
      storedAtReload = window.sessionStorage.getItem(
        "clemvion.restoreClearedIntegrationRefs:wf-1",
      );
    });

    await act(async () => {
      render(
        <RestoreConfirmDialog
          workflowId="wf-1"
          version={baseVersion}
          onClose={vi.fn()}
        />,
        { wrapper: wrapper() },
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Restore$/ }));
    });

    expect(reloadSpy).toHaveBeenCalled();
    expect(JSON.parse(storedAtReload ?? "null")).toEqual(cleared);
  });

  it("stores nothing when the restore cleared no refs", async () => {
    window.sessionStorage.clear();
    vi.mocked(workflowsApi.restoreVersion).mockResolvedValue({
      data: {
        data: { workflow: {}, nodes: [], edges: [], clearedIntegrationRefs: [] },
      },
    } as never);

    await act(async () => {
      render(
        <RestoreConfirmDialog
          workflowId="wf-1"
          version={baseVersion}
          onClose={vi.fn()}
        />,
        { wrapper: wrapper() },
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Restore$/ }));
    });

    expect(reloadSpy).toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("shows error when restore fails", async () => {
    vi.mocked(workflowsApi.restoreVersion).mockRejectedValue(
      new Error("Network down"),
    );

    await act(async () => {
      render(
        <RestoreConfirmDialog
          workflowId="wf-1"
          version={baseVersion}
          onClose={vi.fn()}
        />,
        { wrapper: wrapper() },
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Restore$/ }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("closes dialog on cancel", async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(
        <RestoreConfirmDialog
          workflowId="wf-1"
          version={baseVersion}
          onClose={onClose}
        />,
        { wrapper: wrapper() },
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
