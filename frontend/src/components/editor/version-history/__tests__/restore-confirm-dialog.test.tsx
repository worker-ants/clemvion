import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: { restoreVersion: vi.fn() },
}));

import { workflowsApi } from "@/lib/api/workflows";
import { RestoreConfirmDialog } from "../restore-confirm-dialog";

const reloadSpy = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
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
