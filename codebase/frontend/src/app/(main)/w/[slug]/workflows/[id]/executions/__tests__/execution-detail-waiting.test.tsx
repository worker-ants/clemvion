import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
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
const mockContinueExecution = vi.fn();

vi.mock("@/lib/api/executions", () => ({
  executionsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getByWorkflow: (...args: unknown[]) => mockGetByWorkflow(...args),
    continueExecution: (...args: unknown[]) => mockContinueExecution(...args),
  },
}));

// Prevent the events hook from opening real sockets; we drive state via the
// store directly in the tests below.
vi.mock("@/lib/websocket/use-execution-events", () => ({
  useExecutionEvents: () => ({ isConnected: false }),
}));

const emitMock = vi.fn();
const onceMock = vi.fn();
const isConnectedMock = vi.fn(() => true);
vi.mock("@/lib/websocket/ws-client", () => ({
  getWsClient: () => ({
    emit: emitMock,
    once: onceMock,
    isConnected: () => isConnectedMock(),
  }),
}));

vi.mock("@/lib/node-definitions", () => ({
  getNodeDefinition: () => undefined,
  loadNodeDefinitions: vi.fn().mockResolvedValue(undefined),
  getCategoryColor: () => "#6B7280",
}));

import ExecutionDetailPage from "../[executionId]/page";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { EXECUTION_POLL_INTERVAL_MS } from "@/lib/websocket/execution-polling-policy";

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
    isConnectedMock.mockReturnValue(true);
    mockContinueExecution.mockResolvedValue(undefined);
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

// CLE-T-5P1ADY — 소켓이 끊겨 있으면 폼은 REST 로 보내고, 버튼 · 대화 명령은 보내지 않는다.
// 보내지 못한 명령은 입력 대기 표시를 풀지 않고, 대화 입력창은 쓴 글을 지우지 않는다.
describe("ExecutionDetailPage - 소켓이 끊겼을 때 입력 대기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitMock.mockReset();
    isConnectedMock.mockReturnValue(false);
    mockContinueExecution.mockResolvedValue(undefined);
    useExecutionStore.getState().reset();
    mockGetByWorkflow.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
    });
  });

  it("폼 제출은 REST 로 보내고 입력 대기를 푼다", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("form"));
    await renderPage();
    await screen.findByText("Approval");

    act(() => {
      useExecutionStore.getState().pauseForForm("n1", {
        title: "Approval",
        fields: [{ name: "comment", type: "text", label: "Comment" }],
      });
    });

    fireEvent.click(await screen.findByText("Submit"));

    expect(mockContinueExecution).toHaveBeenCalledWith(
      "exec-w",
      expect.any(Object),
    );
    expect(emitMock).not.toHaveBeenCalled();
    expect(useExecutionStore.getState().status).toBe("running");
  });

  it("버튼은 보내지 않고 입력 대기를 그대로 둔다", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("buttons"));
    await renderPage();
    await screen.findByText("Choose");

    act(() => {
      useExecutionStore.getState().pauseForButtons("n1", {
        buttons: [{ id: "btn-a", label: "Option A", type: "port" }],
      });
    });

    fireEvent.click(await screen.findByText("Option A"));

    expect(emitMock).not.toHaveBeenCalled();
    const state = useExecutionStore.getState();
    expect(state.status).toBe("waiting_for_input");
    expect(state.waitingNodeId).toBe("n1");
  });

  it("대화 종료는 보내지 않고 입력 대기를 그대로 둔다", async () => {
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

    const endBtn = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("title") === "대화 종료");
    if (!endBtn) throw new Error("End conversation button not found");
    fireEvent.click(endBtn);

    expect(emitMock).not.toHaveBeenCalled();
    const state = useExecutionStore.getState();
    expect(state.status).toBe("waiting_for_input");
    expect(state.waitingNodeId).toBe("n1");
  });

  it("메시지는 보내지 않고 입력창의 글을 남긴다", async () => {
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

    const textarea = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello AI" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    expect(emitMock).not.toHaveBeenCalled();
    expect(textarea.value).toBe("Hello AI");
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
  });
});

// CLE-T-V6KWEE — 실행 상세 페이지의 상시 REST 폴링과 REST → store 배선(CLE-EXEC-RUN).
// 이 페이지는 에디터와 달리 store 의 실행 ID 로 응답을 거르지 않는다. 대기 · 종결 상태로 연 실행은
// store executionId 가 null 로 남으므로, 실행 ID 비교를 넣으면 첫 응답부터 버려진다.
describe("ExecutionDetailPage - 상시 REST 폴링", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 타이머만 가짜로 둔다. Promise 는 실제로 풀려야 react-query 와 `use(params)` 가 진행한다.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    isConnectedMock.mockReturnValue(true);
    useExecutionStore.getState().reset();
    mockGetByWorkflow.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeRunningExecution() {
    const exec = makeWaitingExecution("form");
    return {
      ...exec,
      status: "running",
      nodeExecutions: [{ ...exec.nodeExecutions[0], status: "running" }],
    };
  }

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("waiting_for_input 으로 연 실행의 첫 응답이 store 에 들어간다(store 실행 ID 가 null 이어도)", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("form"));
    await renderPage();
    await advance(0);

    expect(mockGetById).toHaveBeenCalledTimes(1);
    const state = useExecutionStore.getState();
    // 전제: 대기 상태 스냅샷은 store 의 실행 ID 를 채우지 않는다.
    expect(state.executionId).toBeNull();
    expect(state.nodeStatuses.get("n1")?.status).toBe("waiting_for_input");
    expect(state.nodeResults.some((r) => r.nodeId === "n1")).toBe(true);
  });

  it("폴링 간격은 EXECUTION_POLL_INTERVAL_MS 다", async () => {
    mockGetById.mockResolvedValue(makeRunningExecution());
    await renderPage();
    await advance(0);
    expect(mockGetById).toHaveBeenCalledTimes(1);

    await advance(EXECUTION_POLL_INTERVAL_MS - 1);
    expect(mockGetById).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(mockGetById).toHaveBeenCalledTimes(2);

    await advance(EXECUTION_POLL_INTERVAL_MS);
    expect(mockGetById).toHaveBeenCalledTimes(3);
  });

  it("waiting_for_input 응답 뒤에도 폴링을 이어 간다", async () => {
    mockGetById.mockResolvedValue(makeWaitingExecution("form"));
    await renderPage();
    await advance(0);

    await advance(EXECUTION_POLL_INTERVAL_MS * 2);
    expect(mockGetById).toHaveBeenCalledTimes(3);
  });

  it("종결 응답을 받으면 폴링이 멈춘다", async () => {
    mockGetById
      .mockResolvedValueOnce(makeRunningExecution())
      .mockResolvedValue(makeCompletedExecution("http_request"));
    await renderPage();
    await advance(0);
    expect(mockGetById).toHaveBeenCalledTimes(1);

    await advance(EXECUTION_POLL_INTERVAL_MS);
    expect(mockGetById).toHaveBeenCalledTimes(2);

    await advance(EXECUTION_POLL_INTERVAL_MS * 5);
    expect(mockGetById).toHaveBeenCalledTimes(2);
    expect(useExecutionStore.getState().status).toBe("completed");
  });
});

// CLE-T-99QHNG — 실행 상세 화면도 REST 로 받은 cancelled 노드를 종료 상태로 그린다
// (CLE-EXEC-RUN-DRAWER 「결과 상세 탭」 · 「라이프사이클 · 노드 취소」).
describe("ExecutionDetailPage - cancelled 노드", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionStore.getState().reset();
    mockGetByWorkflow.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
    });
  });

  it("노드 목록은 Ban 아이콘을, 결과 상세는 Cancelled 배지와 입력 · 출력 탭을 보여 준다", async () => {
    const exec = makeCompletedExecution("http_request");
    mockGetById.mockResolvedValue({
      ...exec,
      status: "cancelled",
      nodeExecutions: [
        { ...exec.nodeExecutions[0], status: "cancelled", outputData: null },
      ],
    });
    await renderPage();

    const nodeBtn = await screen.findByText("Fetch");
    expect(
      nodeBtn.closest("button")?.querySelector(".lucide-ban"),
    ).not.toBeNull();

    fireEvent.click(nodeBtn);
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "입력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "출력" })).toBeInTheDocument();
  });
});
