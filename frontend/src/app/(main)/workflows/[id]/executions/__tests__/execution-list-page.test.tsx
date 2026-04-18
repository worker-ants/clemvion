import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    get: vi.fn().mockResolvedValue({
      data: { data: { id: "wf-1", name: "Test Workflow" } },
    }),
  },
}));

vi.mock("@/lib/api/executions", () => ({
  executionsApi: {
    getByWorkflow: vi.fn().mockResolvedValue({
          data: [
            {
              id: "exec-1",
              workflowId: "wf-1",
              status: "completed",
              startedAt: "2024-01-15T14:02:30Z",
              finishedAt: "2024-01-15T14:02:33Z",
              durationMs: 3200,
              inputData: {},
              outputData: {},
              error: null,
              nodeExecutions: [
                { id: "ne-1", nodeId: "n1", status: "completed", startedAt: "2024-01-15T14:02:30Z", finishedAt: "2024-01-15T14:02:31Z", durationMs: 800, inputData: {}, outputData: {}, error: null, retryCount: 0, node: { id: "n1", type: "transform", label: "Transform" } },
              ],
            },
            {
              id: "exec-2",
              workflowId: "wf-1",
              status: "failed",
              startedAt: "2024-01-15T13:55:10Z",
              finishedAt: "2024-01-15T13:55:11Z",
              durationMs: 1000,
              inputData: {},
              outputData: null,
              error: { message: "Connection timeout" },
              nodeExecutions: [
                { id: "ne-2", nodeId: "n1", status: "failed", startedAt: "2024-01-15T13:55:10Z", finishedAt: "2024-01-15T13:55:11Z", durationMs: 1000, inputData: {}, outputData: null, error: { message: "Connection timeout" }, retryCount: 0, node: { id: "n1", type: "http_request", label: "API Call" } },
              ],
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            totalItems: 2,
            totalPages: 1,
          },
    }),
  },
}));

import ExecutionListPage from "../page";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </QueryClientProvider>
    );
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <ExecutionListPage params={Promise.resolve({ id: "wf-1" })} />,
      { wrapper: createWrapper() },
    );
  });
}

describe("ExecutionListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
  });

  it("renders workflow name and executions title", async () => {
    await renderPage();
    expect(await screen.findByText(/Test Workflow/)).toBeDefined();
    expect(screen.getByText(/Executions/)).toBeDefined();
  });

  it("renders execution rows with status and duration", async () => {
    await renderPage();
    expect(await screen.findByText("Completed")).toBeDefined();
    // "Failed" appears as both filter button and badge, use getAllByText
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("3.2s")).toBeDefined();
    expect(screen.getByText("1s")).toBeDefined();
  });

  it("renders filter buttons", async () => {
    await renderPage();
    await screen.findByText("Completed");

    expect(screen.getByRole("button", { name: "All" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Failed" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Running" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancelled" })).toBeDefined();
  });

  it("navigates to execution detail on row click", async () => {
    await renderPage();
    await screen.findByText("Completed");
    // Find a table row in tbody (not the filter buttons)
    const rows = document.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);

    expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1/executions/exec-1");
  });

  it("navigates to editor on 'Open in Editor' click", async () => {
    await renderPage();
    const editorLink = await screen.findByText("Open in Editor");
    fireEvent.click(editorLink);

    expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1");
  });

  it("displays node execution counts", async () => {
    await renderPage();
    await screen.findAllByText("Completed");
    expect(screen.getByText(/1 failed/)).toBeDefined();
  });
});
