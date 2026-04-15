import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    get: vi.fn().mockResolvedValue({
      data: { data: { id: "wf-1", name: "Test Workflow" } },
    }),
  },
}));

const mockGetById = vi.fn();
const mockGetByWorkflow = vi.fn();

vi.mock("@/lib/api/executions", () => ({
  executionsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getByWorkflow: (...args: unknown[]) => mockGetByWorkflow(...args),
  },
}));

vi.mock("@/lib/node-definitions", () => ({
  getNodeDefinition: () => undefined,
  loadNodeDefinitions: vi.fn().mockResolvedValue(undefined),
  CATEGORY_COLORS: {} as Record<string, string>,
}));

import ExecutionDetailPage from "../[executionId]/page";

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    status: "completed",
    startedAt: "2024-01-15T14:02:30Z",
    finishedAt: "2024-01-15T14:02:33Z",
    durationMs: 3200,
    inputData: { key: "value" },
    outputData: { result: "success" },
    error: null,
    nodeExecutions: [
      {
        id: "ne-1",
        executionId: "exec-1",
        nodeId: "n1",
        status: "completed",
        startedAt: "2024-01-15T14:02:30Z",
        finishedAt: "2024-01-15T14:02:31Z",
        durationMs: 800,
        inputData: { input: "data" },
        outputData: { output: "result" },
        error: null,
        retryCount: 0,
        node: { id: "n1", type: "transform", label: "Data Transform" },
      },
      {
        id: "ne-2",
        executionId: "exec-1",
        nodeId: "n2",
        status: "completed",
        startedAt: "2024-01-15T14:02:31Z",
        finishedAt: "2024-01-15T14:02:33Z",
        durationMs: 2400,
        inputData: { from: "transform" },
        outputData: { final: "data" },
        error: null,
        retryCount: 0,
        node: { id: "n2", type: "http_request", label: "API Call" },
      },
    ],
    ...overrides,
  };
}

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

async function renderPage(executionId = "exec-1") {
  // Create fresh wrapper per render to avoid query cache from previous tests
  const wrapper = createWrapper();
  await act(async () => {
    render(
      <ExecutionDetailPage
        params={Promise.resolve({ id: "wf-1", executionId })}
      />,
      { wrapper },
    );
  });
}

describe("ExecutionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const exec = makeExecution();
    mockGetById.mockResolvedValue(exec);
    mockGetByWorkflow.mockResolvedValue({
      data: [exec],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });
  });

  it("renders execution summary card with status", async () => {
    await renderPage();
    expect(await screen.findByText("Completed")).toBeDefined();
  });

  it("renders duration in summary", async () => {
    await renderPage();
    expect(await screen.findByText("3.2s")).toBeDefined();
  });

  it("renders node count summary", async () => {
    await renderPage();
    expect(await screen.findByText(/2\/2 completed/)).toBeDefined();
  });

  it("renders node list with names", async () => {
    await renderPage();
    expect(await screen.findByText("Data Transform")).toBeDefined();
    expect(screen.getByText("API Call")).toBeDefined();
  });

  it("shows placeholder when no node is selected", async () => {
    await renderPage();
    await screen.findByText("Data Transform");
    expect(screen.getByText("Select a node to view details")).toBeDefined();
  });

  it("shows node detail when clicking a node", async () => {
    await renderPage();
    await screen.findByText("Data Transform");

    const buttons = screen.getAllByRole("button");
    const transformButton = buttons.find(
      (btn) => btn.textContent?.includes("Data Transform"),
    );
    if (transformButton) fireEvent.click(transformButton);

    expect(screen.getByText("transform")).toBeDefined();
  });

  it("navigates to execution list on back button click", async () => {
    await renderPage();
    await screen.findByText("Completed");

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1/executions");
  });
});

describe("ExecutionDetailPage - Failed Execution", () => {
  it("renders error message for failed execution", async () => {
    vi.clearAllMocks();
    const failedExec = makeExecution({
      status: "failed",
      error: { message: "Connection timeout" },
      nodeExecutions: [
        {
          id: "ne-1",
          executionId: "exec-1",
          nodeId: "n1",
          status: "completed",
          startedAt: "2024-01-15T14:02:30Z",
          finishedAt: "2024-01-15T14:02:31Z",
          durationMs: 800,
          inputData: {},
          outputData: {},
          error: null,
          retryCount: 0,
          node: { id: "n1", type: "transform", label: "Data Transform" },
        },
        {
          id: "ne-2",
          executionId: "exec-1",
          nodeId: "n2",
          status: "failed",
          startedAt: "2024-01-15T14:02:31Z",
          finishedAt: "2024-01-15T14:02:33Z",
          durationMs: 1000,
          inputData: {},
          outputData: null,
          error: { message: "Connection timeout" },
          retryCount: 0,
          node: { id: "n2", type: "http_request", label: "API Call" },
        },
      ],
    });
    mockGetById.mockResolvedValue(failedExec);
    mockGetByWorkflow.mockResolvedValue({
      data: [failedExec],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </QueryClientProvider>
    );

    await act(async () => {
      render(
        <ExecutionDetailPage
          params={Promise.resolve({ id: "wf-1", executionId: "exec-fail" })}
        />,
        { wrapper },
      );
    });

    expect(await screen.findByText("Failed")).toBeDefined();
    expect(screen.getAllByText(/Connection timeout/).length).toBeGreaterThanOrEqual(1);
  });
});
