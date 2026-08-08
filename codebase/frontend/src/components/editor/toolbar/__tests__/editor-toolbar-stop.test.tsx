import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useLocaleStore } from "@/lib/stores/locale-store";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const editorState = {
  workflowId: "wf-1",
  workflowName: "My WF",
  setWorkflowName: vi.fn(),
  isDirty: false,
  isSaving: false,
  undo: vi.fn(),
  redo: vi.fn(),
  saveWorkflow: vi.fn().mockResolvedValue(true),
  undoStack: [],
  redoStack: [],
  selectedNodeId: null,
  setVersionHistoryOpen: vi.fn(),
  graphWarnings: { results: [], hasError: false, hasWarning: false },
};
vi.mock("@/lib/stores/editor-store", () => ({
  useEditorStore: <T,>(selector: (s: typeof editorState) => T) => selector(editorState),
}));

// 실행 중 (running) + executionId — Stop 버튼이 노출되어야 한다.
const executionState = {
  status: "running" as "idle" | "running" | "completed" | "failed" | "waiting_for_input",
  startExecution: vi.fn(),
  executionId: "e1",
};
vi.mock("@/lib/stores/execution-store", () => ({
  useExecutionStore: <T,>(selector: (s: typeof executionState) => T) => selector(executionState),
}));

const assistantState = { isOpen: false, toggle: vi.fn() };
vi.mock("@/lib/stores/assistant-store", () => ({
  useAssistantStore: <T,>(selector: (s: typeof assistantState) => T) => selector(assistantState),
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: { execute: vi.fn(), exportWorkflow: vi.fn(), delete: vi.fn() },
}));

const stopMock = vi.fn().mockResolvedValue({ id: "e1", status: "cancelled" });
vi.mock("@/lib/api/executions", () => ({
  executionsApi: { stop: (...a: unknown[]) => stopMock(...a) },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

import { EditorToolbar } from "../editor-toolbar";

function renderToolbar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EditorToolbar />
    </QueryClientProvider>,
  );
}

describe("EditorToolbar — Stop button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [{ id: "ws-1", name: "T", type: "team", slug: "t", role: "editor" }],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    executionState.status = "running";
  });

  it("shows the Stop button while running and calls executionsApi.stop on click", async () => {
    renderToolbar();
    const stopBtn = screen.getByRole("button", { name: /stop/i });
    expect(stopBtn).toBeInTheDocument();

    fireEvent.click(stopBtn);
    await waitFor(() => expect(stopMock).toHaveBeenCalledWith("e1"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("hides the Stop button when idle", () => {
    executionState.status = "idle";
    renderToolbar();
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  // ai-review WARNING #2 (2026-08-08, review/code/2026/08/08/20_53_48) — backend
  // `POST /executions/:id/stop` 는 `@Roles('editor')` 를 요구한다(auth-workspace-membership-guard).
  // canEdit 가드 없이 노출하면 viewer 에게 실행 중에도 항상 403 으로 실패하는 버튼을
  // 보여주게 된다 — FE 는 그 액션을 아예 숨겨야 한다(다른 mutation 버튼과 동일 패턴).
  it("hides the Stop button for viewer even while running (backend now 403s)", () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: "ws-1", name: "T", type: "team", slug: "t", role: "viewer" }],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    renderToolbar();
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });
});
