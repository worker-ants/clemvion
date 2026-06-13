import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useLocaleStore } from "@/lib/stores/locale-store";

vi.mock("next/navigation", () => ({
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
  useEditorStore: <T,>(selector: (s: typeof editorState) => T) =>
    selector(editorState),
}));

const executionState = {
  status: "idle" as
    | "idle"
    | "running"
    | "completed"
    | "failed"
    | "waiting_for_input",
  startExecution: vi.fn(),
  executionId: null as string | null,
};
vi.mock("@/lib/stores/execution-store", () => ({
  useExecutionStore: <T,>(selector: (s: typeof executionState) => T) =>
    selector(executionState),
}));

const assistantState = { isOpen: false, toggle: vi.fn() };
vi.mock("@/lib/stores/assistant-store", () => ({
  useAssistantStore: <T,>(selector: (s: typeof assistantState) => T) =>
    selector(assistantState),
}));

const executeMock = vi.fn().mockResolvedValue({
  data: { data: { executionId: "e-new" } },
});
vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    execute: (...a: unknown[]) => executeMock(...a),
    exportWorkflow: vi.fn(),
    delete: vi.fn(),
  },
}));

const getByWorkflowMock = vi.fn();
const getByIdMock = vi.fn();
vi.mock("@/lib/api/executions", () => ({
  executionsApi: {
    getByWorkflow: (...a: unknown[]) => getByWorkflowMock(...a),
    getById: (...a: unknown[]) => getByIdMock(...a),
    stop: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

// Open the "Run with Input" dialog via the run-options dropdown.
async function openRunWithInput() {
  fireEvent.click(screen.getByRole("button", { name: /Run options/i }));
  fireEvent.click(screen.getByRole("button", { name: /Run with Input/i }));
  await screen.findByTestId("run-with-input-submit");
}

describe("EditorToolbar — Run with Input (§2.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws-1", name: "T", type: "team", slug: "t", role: "editor" },
      ],
      currentWorkspaceId: "ws-1",
      loaded: true,
    });
    executionState.status = "idle";
  });

  it("realtime JSON validation: invalid input shows an error and disables Run", async () => {
    renderToolbar();
    await openRunWithInput();

    const textarea = screen.getByPlaceholderText('{"key": "value"}');
    const submit = screen.getByTestId("run-with-input-submit");

    // Default "{}" is valid → Run enabled.
    expect(submit).not.toBeDisabled();

    // Invalid JSON → alert message + Run disabled (no submit-time-only parsing).
    fireEvent.change(textarea, { target: { value: "{" } });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(submit).toBeDisabled();

    // Back to valid → re-enabled.
    fireEvent.change(textarea, { target: { value: '{"a":1}' } });
    await waitFor(() => expect(submit).not.toBeDisabled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("empty input is treated as invalid", async () => {
    renderToolbar();
    await openRunWithInput();
    fireEvent.change(screen.getByPlaceholderText('{"key": "value"}'), {
      target: { value: "   " },
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("run-with-input-submit")).toBeDisabled();
  });

  it("Load from History fetches prior executions and loads the selected input into the textarea", async () => {
    getByWorkflowMock.mockResolvedValue({
      data: [
        {
          id: "ex-1",
          workflowId: "wf-1",
          status: "completed",
          startedAt: "2026-06-13T10:00:00.000Z",
          triggerSource: "manual",
          inputData: {},
        },
      ],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    getByIdMock.mockResolvedValue({
      id: "ex-1",
      workflowId: "wf-1",
      status: "completed",
      inputData: { foo: "bar" },
      startedAt: "2026-06-13T10:00:00.000Z",
    });

    renderToolbar();
    await openRunWithInput();

    // Open the history picker → triggers getByWorkflow.
    fireEvent.click(screen.getByRole("button", { name: /Load from History/i }));
    await waitFor(() =>
      expect(getByWorkflowMock).toHaveBeenCalledWith("wf-1", {
        limit: 10,
        sort: "started_at",
        order: "desc",
      }),
    );

    // Pick the listed execution → getById then textarea filled with its input.
    const item = await screen.findByRole("button", { name: /Manual/i });
    fireEvent.click(item);

    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith("ex-1"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText('{"key": "value"}')).toHaveValue(
        JSON.stringify({ foo: "bar" }, null, 2),
      ),
    );
  });
});
