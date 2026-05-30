import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkspaceStore, type WorkspaceRole } from "@/lib/stores/workspace-store";
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
  isDirty: true,
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

const executionState = { status: "idle" as const, startExecution: vi.fn() };
vi.mock("@/lib/stores/execution-store", () => ({
  useExecutionStore: <T,>(selector: (s: typeof executionState) => T) => selector(executionState),
}));

const assistantState = { isOpen: false, toggle: vi.fn() };
vi.mock("@/lib/stores/assistant-store", () => ({
  useAssistantStore: <T,>(selector: (s: typeof assistantState) => T) => selector(assistantState),
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    execute: vi.fn(),
    exportWorkflow: vi.fn(),
    delete: vi.fn(),
  },
}));

import { EditorToolbar } from "../editor-toolbar";

function setRole(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [
      { id: "ws-1", name: "Test", type: "team", slug: "team-1", role },
    ],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}

function renderToolbar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EditorToolbar />
    </QueryClientProvider>,
  );
}

describe("EditorToolbar — RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.getState().reset();
  });

  it("Editor: Save 버튼·이름 입력·More 메뉴 모두 노출", () => {
    setRole("editor");
    renderToolbar();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("My WF")).toBeInTheDocument();
  });

  it("Viewer: Save 버튼·이름 입력 모두 비표시, Run 은 노출", () => {
    setRole("viewer");
    renderToolbar();
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
    expect(screen.queryByDisplayValue("My WF")).toBeNull();
    // Viewer 도 실행 가능 — Run 버튼은 남아 있어야 함
    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
  });

  it("Viewer: 워크플로우 이름은 비편집 텍스트로 노출", () => {
    setRole("viewer");
    renderToolbar();
    expect(screen.getByText("My WF")).toBeInTheDocument();
  });

  it("Editor: More 메뉴 안에 Delete 항목 노출", async () => {
    setRole("editor");
    renderToolbar();
    expect(screen.queryByText(/delete/i)).toBeNull();
    screen.getByTestId("editor-toolbar-more-menu").click();
    expect(await screen.findByText(/delete/i)).toBeInTheDocument();
  });

  it("Viewer: More 메뉴를 펼쳐도 Delete 항목 비표시", async () => {
    setRole("viewer");
    renderToolbar();
    screen.getByTestId("editor-toolbar-more-menu").click();
    // Export(read-only) 는 보이고, Delete 는 안 보여야 함
    expect(await screen.findByText(/export/i)).toBeInTheDocument();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  // SUMMARY#18 — hasError: true 시 Save 버튼 disabled 및 title 검증
  it("Editor: Save 버튼이 graphWarnings.hasError=true 일 때 disabled", () => {
    // hasError=true 상태로 editorState 재설정
    Object.assign(editorState, {
      graphWarnings: {
        results: [{ ruleId: "r1", severity: "error", nodeId: "n1", message: "Graph error occurred" }],
        hasError: true,
        hasWarning: false,
      },
    });
    setRole("editor");
    renderToolbar();
    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).toBeDisabled();
    expect(saveBtn).toHaveAttribute("title", "Graph error occurred");
    // 테스트 후 초기화
    Object.assign(editorState, {
      graphWarnings: { results: [], hasError: false, hasWarning: false },
    });
  });
});
