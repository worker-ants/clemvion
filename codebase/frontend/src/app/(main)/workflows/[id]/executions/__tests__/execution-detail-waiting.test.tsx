import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
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

// Prevent the events hook from opening real sockets; we drive state via the
// store directly in the tests below.
vi.mock("@/lib/websocket/use-execution-events", () => ({
  useExecutionEvents: () => ({ isConnected: false }),
}));

const emitMock = vi.fn();
const onceMock = vi.fn();
vi.mock("@/lib/websocket/ws-client", () => ({
  getWsClient: () => ({ emit: emitMock, once: onceMock }),
}));

vi.mock("@/lib/node-definitions", () => ({
  getNodeDefinition: () => undefined,
  loadNodeDefinitions: vi.fn().mockResolvedValue(undefined),
  getCategoryColor: () => "#6B7280",
}));

import ExecutionDetailPage from "../[executionId]/page";
import { useExecutionStore } from "@/lib/stores/execution-store";

function makeWaitingExecution(interactionType: "form" | "buttons" | "ai_conversation") {
  const baseNode = {
    id: "ne-1",
    executionId: "exec-w",
    nodeId: "n1",
    startedAt: "2024-01-15T14:02:30Z",
    finishedAt: null,
    durationMs: null,
    inputData: {},
    error: null,
    retryCount: 0,
  };
  const node =
    interactionType === "form"
      ? { ...baseNode, status: "waiting_for_input", outputData: null, node: { id: "n1", type: "form", label: "Approval" } }
      : interactionType === "buttons"
        ? { ...baseNode, status: "waiting_for_input", outputData: null, node: { id: "n1", type: "http_request", label: "Choose" } }
        : { ...baseNode, status: "waiting_for_input", outputData: null, node: { id: "n1", type: "ai_agent", label: "Assistant" } };
  return {
    id: "exec-w",
    workflowId: "wf-1",
    status: "waiting_for_input",
    startedAt: "2024-01-15T14:02:30Z",
    finishedAt: null,
    durationMs: null,
    inputData: {},
    outputData: null,
    error: null,
    nodeExecutions: [node],
  };
}

// V-05 — 완결(비-waiting) 실행의 노드 상세. AI 노드는 Config·LLM Usage 탭이,
// 일반 노드는 Config 탭이 노출돼야 한다(14-execution-history §3.3/§3.4.2).
function makeCompletedExecution(nodeType: "ai_agent" | "http_request") {
  const isAi = nodeType === "ai_agent";
  return {
    id: "exec-w",
    workflowId: "wf-1",
    status: "completed",
    startedAt: "2024-01-15T14:02:30Z",
    finishedAt: "2024-01-15T14:02:31Z",
    durationMs: 1200,
    inputData: {},
    outputData: null,
    error: null,
    nodeExecutions: [
      {
        id: "ne-1",
        executionId: "exec-w",
        nodeId: "n1",
        status: "completed",
        startedAt: "2024-01-15T14:02:30Z",
        finishedAt: "2024-01-15T14:02:31Z",
        durationMs: 1200,
        inputData: { in: 1 },
        outputData: {
          config: { model: "gpt-4o", temperature: 0.5 },
          output: { text: "done" },
          ...(isAi
            ? {
                meta: {
                  model: "gpt-4o",
                  totalTokens: 100,
                  requestTokens: 60,
                  responseTokens: 40,
                  turnCount: 1,
                  toolCalls: 0,
                },
              }
            : {}),
        },
        error: null,
        retryCount: 0,
        node: { id: "n1", type: nodeType, label: isAi ? "Agent" : "Fetch" },
      },
    ],
  };
}

async function renderPage() {
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
        params={Promise.resolve({ id: "wf-1", executionId: "exec-w" })}
      />,
      { wrapper },
    );
  });
}

describe("ExecutionDetailPage - waiting interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitMock.mockReset();
    useExecutionStore.getState().reset();
    mockGetByWorkflow.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
    });
  });

  it("renders dynamic form and submits via WebSocket on Submit click", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("form"));
    await renderPage();
    await screen.findByText("Approval");

    // Seed the store as if useExecutionEvents populated it from REST.
    act(() => {
      useExecutionStore.getState().pauseForForm("n1", {
        title: "Approval",
        fields: [
          { name: "comment", type: "text", label: "Comment" },
        ],
      });
    });

    // Auto-select the waiting node → Preview tab shows form.
    const submitBtn = await screen.findByText("Submit");
    fireEvent.click(submitBtn);

    expect(emitMock).toHaveBeenCalledWith("execution.submit_form", {
      executionId: "exec-w",
      formData: expect.any(Object),
    });
  });

  it("renders buttons and emits click_button on port button press", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("buttons"));
    await renderPage();
    await screen.findByText("Choose");

    act(() => {
      useExecutionStore.getState().pauseForButtons("n1", {
        buttons: [
          { id: "btn-a", label: "Option A", type: "port" },
          { id: "btn-b", label: "Option B", type: "port" },
        ],
      });
    });

    const optionBtn = await screen.findByText("Option A");
    fireEvent.click(optionBtn);

    expect(emitMock).toHaveBeenCalledWith("execution.click_button", {
      executionId: "exec-w",
      buttonId: "btn-a",
    });
  });

  it("resets waitingNodeId after form submit to prevent stale prompts", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("form"));
    await renderPage();
    await screen.findByText("Approval");

    act(() => {
      useExecutionStore.getState().pauseForForm("n1", {
        fields: [{ name: "ok", type: "text", label: "OK" }],
      });
    });

    const submitBtn = await screen.findByText("Submit");
    fireEvent.click(submitBtn);

    expect(useExecutionStore.getState().waitingNodeId).toBeNull();
    expect(useExecutionStore.getState().status).toBe("running");
  });

  it("does not re-auto-select when the same waitingNodeId re-renders", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("form"));
    await renderPage();
    await screen.findByText("Approval");

    act(() => {
      useExecutionStore.getState().pauseForForm("n1", {
        fields: [{ name: "a", type: "text", label: "A" }],
      });
    });

    // Same waitingNodeId re-emitted (e.g., polling re-fires pauseForForm) —
    // the derived-state guard must not thrash the user's selection.
    const firstRenderCount = useExecutionStore.getState().conversationMessages.length;
    act(() => {
      useExecutionStore.getState().pauseForForm("n1", {
        fields: [{ name: "a", type: "text", label: "A" }],
      });
    });
    expect(
      useExecutionStore.getState().conversationMessages.length,
    ).toBe(firstRenderCount);
    expect(useExecutionStore.getState().waitingNodeId).toBe("n1");
  });

  it("emits end_conversation when end button is clicked", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("ai_conversation"));
    await renderPage();
    await screen.findByText("Assistant");

    act(() => {
      useExecutionStore.getState().pauseForConversation("n1", {
        message: "Hi",
        messages: [{ role: "assistant", content: "Hi" }],
        turnCount: 1,
        maxTurns: 5,
      });
    });

    // ConversationInspector exposes an icon-only End button with a
    // localized title attribute (ko default in vitest env).
    const endBtn = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("title") === "대화 종료");
    if (!endBtn) throw new Error("End conversation button not found");
    fireEvent.click(endBtn);

    expect(emitMock).toHaveBeenCalledWith("execution.end_conversation", {
      executionId: "exec-w",
      nodeId: "n1",
    });
  });

  // V-05: 완결 실행 노드 상세가 에디터 ResultDetail 과 동일 서브탭 구성을 노출.
  it("completed AI node exposes Config and LLM Usage sub-tabs (V-05)", async () => {
    mockGetById.mockResolvedValue(makeCompletedExecution("ai_agent"));
    await renderPage();
    // 완결 실행은 자동 선택이 없으므로 좌측 목록에서 노드를 클릭해 선택.
    const nodeBtn = await screen.findByText("Agent");
    fireEvent.click(nodeBtn);

    // 노드 레벨: Config(설정) + LLM Usage(LLM 사용량) 탭이 노출돼야 한다.
    expect(await screen.findByText("설정")).toBeInTheDocument();
    expect(screen.getByText("LLM 사용량")).toBeInTheDocument();
  });

  it("completed non-AI node exposes Config but not LLM Usage (V-05)", async () => {
    mockGetById.mockResolvedValue(makeCompletedExecution("http_request"));
    await renderPage();
    const nodeBtn = await screen.findByText("Fetch");
    fireEvent.click(nodeBtn);

    expect(await screen.findByText("설정")).toBeInTheDocument();
    // 일반 노드는 LLM Usage 탭이 없어야 한다.
    expect(screen.queryByText("LLM 사용량")).toBeNull();
  });

  // 회귀: toNodeResult 가 inputData 를 매핑하지 않으면 Input 탭이 영구히
  // "입력 데이터 로드 중..." placeholder 로만 뜬다(ai-review requirement CRITICAL).
  it("completed node Input tab renders inputData, not the loading placeholder (V-05)", async () => {
    mockGetById.mockResolvedValue(makeCompletedExecution("http_request"));
    await renderPage();
    fireEvent.click(await screen.findByText("Fetch"));
    fireEvent.click(await screen.findByText("입력"));
    expect(screen.queryByText("입력 데이터 로드 중...")).toBeNull();
  });

  // 회귀: dry-run 실행의 비-effect 노드(output 에 _dryRun 마커 없음)도
  // execution-level 플래그로 dry-run 배지가 떠야 한다(ai-review side_effect WARNING).
  it("shows dry-run badge on a non-effect node when the whole execution is dry-run (V-05)", async () => {
    const exec = makeCompletedExecution("http_request");
    mockGetById.mockResolvedValue({ ...exec, dryRun: true });
    await renderPage();
    fireEvent.click(await screen.findByText("Fetch"));
    expect(await screen.findByText(/dry-run/)).toBeInTheDocument();
  });

  it("renders conversation inspector and emits submit_message", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("ai_conversation"));
    await renderPage();
    await screen.findByText("Assistant");

    act(() => {
      useExecutionStore.getState().pauseForConversation("n1", {
        message: "Hi",
        messages: [{ role: "assistant", content: "Hi" }],
        turnCount: 1,
        maxTurns: 5,
      });
    });

    // The chat input should be present (ConversationInspector renders a textarea).
    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello AI" } });

    // Submit the message (Enter key or Send button)
    const sendBtn = screen.getAllByRole("button").find(
      (b) => b.textContent === "Send" || b.getAttribute("aria-label") === "Send",
    );
    if (sendBtn) {
      fireEvent.click(sendBtn);
    } else {
      fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });
    }

    expect(emitMock).toHaveBeenCalledWith(
      "execution.submit_message",
      expect.objectContaining({
        executionId: "exec-w",
        nodeId: "n1",
        message: "Hello AI",
      }),
    );
  });
});
