import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

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
const mockGetChain = vi.fn();

vi.mock("@/lib/api/executions", () => ({
  executionsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getByWorkflow: (...args: unknown[]) => mockGetByWorkflow(...args),
    getChain: (...args: unknown[]) => mockGetChain(...args),
  },
}));

vi.mock("@/lib/node-definitions", () => ({
  getNodeDefinition: () => undefined,
  loadNodeDefinitions: vi.fn().mockResolvedValue(undefined),
  getCategoryColor: () => "#6B7280",
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

function setupAuth(
  role: "owner" | "admin" | "editor" | "viewer" | null,
  userId = "user-me",
) {
  useAuthStore.setState({
    user: userId
      ? {
          id: userId,
          email: "me@test.dev",
          name: "Me",
          locale: "en",
          theme: "light",
        }
      : null,
    isAuthenticated: !!userId,
    isLoading: false,
  });
  useWorkspaceStore.setState({
    workspaces: role
      ? [{ id: "ws-1", name: "WS", type: "team", slug: "ws", role }]
      : [],
    currentWorkspaceId: role ? "ws-1" : null,
    loaded: true,
  });
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
    useLocaleStore.setState({ locale: "en" });
    setupAuth("editor");
    const exec = makeExecution({ executedBy: "user-me" });
    mockGetById.mockResolvedValue(exec);
    mockGetByWorkflow.mockResolvedValue({
      data: [exec],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });
    mockGetChain.mockResolvedValue([]);
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
    useLocaleStore.setState({ locale: "en" });
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
    setupAuth("editor");
    mockGetById.mockResolvedValue(failedExec);
    mockGetByWorkflow.mockResolvedValue({
      data: [failedExec],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });
    mockGetChain.mockResolvedValue([]);

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

describe("ExecutionDetailPage - Re-run entry point (spec §10.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    mockGetByWorkflow.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
    });
    mockGetChain.mockResolvedValue([]);
  });

  function rerunButton(): HTMLButtonElement | undefined {
    return screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Re-run")) as
      | HTMLButtonElement
      | undefined;
  }

  it("editor + 본인 실행이면 Re-run 버튼이 enabled", async () => {
    setupAuth("editor", "user-me");
    mockGetById.mockResolvedValue(
      makeExecution({ executedBy: "user-me" }),
    );
    await renderPage();
    await screen.findByText("Completed");
    const btn = rerunButton();
    expect(btn).toBeDefined();
    expect(btn).not.toBeDisabled();
  });

  it("viewer 면 Re-run 버튼이 disabled", async () => {
    setupAuth("viewer", "user-me");
    mockGetById.mockResolvedValue(
      makeExecution({ executedBy: "user-me" }),
    );
    await renderPage();
    await screen.findByText("Completed");
    const btn = rerunButton();
    expect(btn).toBeDefined();
    expect(btn).toBeDisabled();
  });

  it("editor 인데 타인 실행이면 Re-run 버튼이 disabled", async () => {
    setupAuth("editor", "user-me");
    mockGetById.mockResolvedValue(
      makeExecution({ executedBy: "user-other" }),
    );
    await renderPage();
    await screen.findByText("Completed");
    expect(rerunButton()).toBeDisabled();
  });

  it("reRunOf 가 있으면 chain badge 와 원본 링크를 표시", async () => {
    setupAuth("editor", "user-me");
    const root = {
      id: "exec-root",
      workflowId: "wf-1",
      status: "completed",
      triggerSource: "manual",
      triggerLabel: null,
      startedAt: "2024-01-15T14:00:00Z",
      finishedAt: "2024-01-15T14:00:03Z",
      durationMs: 3000,
      recursionDepth: 0,
      executionPath: [],
      reRunOf: null,
      chainId: "exec-root",
      dryRun: false,
    };
    const me = {
      ...root,
      id: "exec-1",
      startedAt: "2024-01-15T14:05:00Z",
      reRunOf: "exec-root",
      dryRun: true,
    };
    mockGetById.mockResolvedValue(
      makeExecution({
        executedBy: "user-me",
        reRunOf: "exec-root",
        chainId: "exec-root",
        dryRun: true,
      }),
    );
    mockGetChain.mockResolvedValue([root, me]);
    await renderPage();
    await screen.findByText("Completed");
    // "#1-th re-run" (root 제외, 재실행 목록 1번째) + dry-run suffix
    expect(await screen.findByText(/#1-th re-run/)).toBeDefined();
    expect(screen.getByText("#exec-root")).toBeDefined();
    // chain 길이 2 → View chain 드롭다운
    expect(screen.getByText(/View chain \(2\)/)).toBeDefined();
  });
});
