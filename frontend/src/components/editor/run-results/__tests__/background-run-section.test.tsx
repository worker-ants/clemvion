import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BackgroundRunSection } from "../background-run-section";
import * as api from "@/lib/api/executions";

// useBackgroundRun depends on WS client; mock the module so subscribe/unsubscribe
// becomes no-op and we focus on rendering behavior.
vi.mock("@/lib/websocket/ws-client", () => ({
  getWsClient: () => ({
    isConnected: () => true,
    connect: () => {},
    waitForConnect: () => Promise.resolve(),
    on: () => {},
    off: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
  }),
}));

vi.mock("@/lib/api/client", () => ({
  ensureFreshAccessToken: () => Promise.resolve("tok"),
  getAccessToken: () => "tok",
  apiClient: { get: vi.fn() },
}));

const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe("BackgroundRunSection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when backgroundRunId is null (legacy NodeExecution)", () => {
    const { container } = renderWithClient(
      <BackgroundRunSection executionId="exec-1" backgroundRunId={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders header, status, and body node list when API returns data", async () => {
    vi.spyOn(api.backgroundRunsApi, "getById").mockResolvedValue({
      backgroundRunId: "bg-1",
      executionId: "exec-1",
      parentNodeExecutionId: "p-1",
      status: "completed",
      startedAt: "2026-05-15T05:04:37.123Z",
      completedAt: "2026-05-15T05:04:50.000Z",
      durationMs: 12877,
      nodeExecutions: {
        data: [
          {
            id: "ne-a",
            executionId: "exec-1",
            nodeId: "node-A",
            parentNodeExecutionId: "p-1",
            status: "completed",
            startedAt: "2026-05-15T05:04:38.000Z",
            finishedAt: "2026-05-15T05:04:39.000Z",
            durationMs: 1000,
            inputData: null,
            outputData: null,
            error: null,
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
      notifications: [],
    });

    renderWithClient(
      <BackgroundRunSection executionId="exec-1" backgroundRunId="bg-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
    expect(screen.getByText(/Run ID: bg-1/)).toBeInTheDocument();
    expect(screen.getByText(/Body nodes/)).toBeInTheDocument();
    expect(screen.getByText("node-A")).toBeInTheDocument();
  });

  it("renders a 'more' hint when hasMore is true", async () => {
    vi.spyOn(api.backgroundRunsApi, "getById").mockResolvedValue({
      backgroundRunId: "bg-1",
      executionId: "exec-1",
      parentNodeExecutionId: "p-1",
      status: "running",
      startedAt: "2026-05-15T05:04:37.123Z",
      completedAt: null,
      durationMs: null,
      nodeExecutions: {
        data: [
          {
            id: "ne-a",
            executionId: "exec-1",
            nodeId: "node-A",
            parentNodeExecutionId: "p-1",
            status: "running",
            startedAt: "2026-05-15T05:04:38.000Z",
            finishedAt: null,
            durationMs: null,
            inputData: null,
            outputData: null,
            error: null,
          },
        ],
        nextCursor: "opaque",
        hasMore: true,
      },
      notifications: [],
    });

    renderWithClient(
      <BackgroundRunSection executionId="exec-1" backgroundRunId="bg-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText(/본문 노드가 더 있어요/)).toBeInTheDocument();
    });
  });

  it("shows an error message when the API call fails", async () => {
    vi.spyOn(api.backgroundRunsApi, "getById").mockRejectedValue(
      new Error("boom"),
    );

    renderWithClient(
      <BackgroundRunSection executionId="exec-1" backgroundRunId="bg-1" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/본문 실행 정보를 가져오지 못했어요/),
      ).toBeInTheDocument();
    });
  });

  it("renders notifications when present", async () => {
    vi.spyOn(api.backgroundRunsApi, "getById").mockResolvedValue({
      backgroundRunId: "bg-1",
      executionId: "exec-1",
      parentNodeExecutionId: "p-1",
      status: "failed",
      startedAt: "2026-05-15T05:04:37.123Z",
      completedAt: "2026-05-15T05:04:40.000Z",
      durationMs: 2877,
      nodeExecutions: { data: [], nextCursor: null, hasMore: false },
      notifications: [
        {
          id: "n1",
          type: "background_failure",
          title: "Background 본문 실패",
          message: "Send email failed",
          channel: "in_app",
          createdAt: "2026-05-15T05:04:40.000Z",
        },
      ],
    });

    renderWithClient(
      <BackgroundRunSection executionId="exec-1" backgroundRunId="bg-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Send email failed")).toBeInTheDocument();
    });
    expect(screen.getByText(/Notifications \(1\)/)).toBeInTheDocument();
  });
});
