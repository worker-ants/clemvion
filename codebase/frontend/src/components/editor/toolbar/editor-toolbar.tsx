"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useAssistantStore } from "@/lib/stores/assistant-store";
import { workflowsApi } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Bot,
  Undo2,
  Redo2,
  Save,
  Play,
  ChevronRight,
  ChevronDown,
  Loader2,
  MoreVertical,
  FileDown,
  History,
  Trash2,
  PlayCircle,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n";
import { translateGraphWarning } from "@/lib/i18n/backend-labels";
import { useHasRole } from "@/components/auth/role-gate";
import { executionsApi } from "@/lib/api/executions";
import { timeAgo } from "@/lib/utils/date";

export function EditorToolbar() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const workflowId = useEditorStore((s) => s.workflowId);
  const workflowName = useEditorStore((s) => s.workflowName);
  const setWorkflowName = useEditorStore((s) => s.setWorkflowName);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const graphWarnings = useEditorStore((s) => s.graphWarnings);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const saveWorkflow = useEditorStore((s) => s.saveWorkflow);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const setVersionHistoryOpen = useEditorStore((s) => s.setVersionHistoryOpen);

  const executionStatus = useExecutionStore((s) => s.status);
  const startExecution = useExecutionStore((s) => s.startExecution);
  const executionId = useExecutionStore((s) => s.executionId);

  const toggleAssistant = useAssistantStore((s) => s.toggle);
  const assistantOpen = useAssistantStore((s) => s.isOpen);

  const isRunning = executionStatus === "running";
  // 실행 중단 가능 상태 — running / waiting_for_input (spec/conventions/node-cancellation.md)
  const isCancellable =
    executionStatus === "running" || executionStatus === "waiting_for_input";
  const [cancelling, setCancelling] = useState(false);
  const canEdit = useHasRole("editor");

  // Dropdown states
  const [runDropdownOpen, setRunDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [runWithInputOpen, setRunWithInputOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("{}");
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // §2.2 검증 — 제출 시점뿐 아니라 입력 중 실시간으로 JSON 유효성을 평가한다.
  // 유효하면 null, 아니면 파서 에러 메시지. 빈 입력은 "필요" 로 간주(유효치 않음).
  const jsonError = useMemo<string | null>(() => {
    const trimmed = jsonInput.trim();
    if (trimmed === "") return t("editor.runWithInputEmpty");
    try {
      JSON.parse(trimmed);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : t("editor.invalidJsonInput");
    }
  }, [jsonInput, t]);

  // §2.2 히스토리 로드 — 다이얼로그에서 "히스토리에서 불러오기" 를 펼쳤을 때만
  // 워크플로의 최근 실행을 조회한다 (기존 GET /executions/workflow/:id 재사용).
  const historyQuery = useQuery({
    queryKey: ["editor-run-history", workflowId],
    queryFn: () =>
      executionsApi.getByWorkflow(workflowId as string, {
        limit: 10,
        sort: "started_at",
        order: "desc",
      }),
    enabled: !!workflowId && runWithInputOpen && historyPickerOpen,
  });

  // 선택한 과거 실행의 입력 데이터를 textarea 로 적재한다 (상세 조회로 inputData 확보).
  const handleLoadFromHistory = useCallback(
    async (id: string) => {
      try {
        const detail = await executionsApi.getById(id);
        setJsonInput(JSON.stringify(detail.inputData ?? {}, null, 2));
        setHistoryPickerOpen(false);
      } catch (error) {
        console.error("Load from history failed:", error);
        toast.error(t("editor.historyLoadFailed"));
      }
    },
    [t],
  );

  const runDropdownRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        runDropdownRef.current &&
        !runDropdownRef.current.contains(event.target as Node)
      ) {
        setRunDropdownOpen(false);
      }
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(event.target as Node)
      ) {
        setMoreDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // saveCanvas in the editor store updates the workflow's `name` (line ~630
  // of editor-store.ts), so a save here can rename the workflow. The list
  // page caches results for 60s — invalidate after every successful save so
  // returning to /workflows shows the new name.
  const saveAndInvalidate = useCallback(async (): Promise<boolean> => {
    const saved = await saveWorkflow();
    if (saved) {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    }
    return saved;
  }, [saveWorkflow, queryClient]);

  const saveBeforeRun = useCallback(async (): Promise<boolean> => {
    if (!workflowId || isRunning) return false;
    if (isDirty) {
      const saved = await saveAndInvalidate();
      if (!saved) return false;
    }
    return true;
  }, [workflowId, isRunning, isDirty, saveAndInvalidate]);

  const handleRun = useCallback(async () => {
    const ready = await saveBeforeRun();
    if (!ready || !workflowId) return;

    try {
      const response = await workflowsApi.execute(workflowId);
      const { executionId } = (response.data as { data: { executionId: string } }).data;
      startExecution(executionId);
    } catch (error) {
      console.error("Execution failed:", error);
    }
  }, [workflowId, saveBeforeRun, startExecution]);

  const handleRunWithInput = useCallback(async () => {
    const ready = await saveBeforeRun();
    if (!ready || !workflowId) return;

    try {
      const parsedInput = JSON.parse(jsonInput) as Record<string, unknown>;
      const parameterValues =
        (parsedInput.parameterValues as Record<string, unknown> | undefined) ??
        (parsedInput.parameters as Record<string, unknown> | undefined);
      const response = await workflowsApi.execute(workflowId, {
        input: parsedInput,
        parameterValues,
      });
      const { executionId } = (response.data as { data: { executionId: string } }).data;
      startExecution(executionId);
      setRunWithInputOpen(false);
      setHistoryPickerOpen(false);
      setJsonInput("{}");
    } catch (error) {
      if (error instanceof SyntaxError) {
        alert(t("editor.invalidJsonInput"));
        return;
      }
      console.error("Execution failed:", error);
    }
  }, [workflowId, saveBeforeRun, startExecution, jsonInput, t]);

  const handleRunFromSelected = useCallback(async () => {
    if (!selectedNodeId) {
      alert(t("editor.selectNodeFirst"));
      return;
    }
    const ready = await saveBeforeRun();
    if (!ready || !workflowId) return;

    try {
      const response = await workflowsApi.execute(workflowId, {
        input: { fromNodeId: selectedNodeId },
      });
      const { executionId } = (response.data as { data: { executionId: string } }).data;
      startExecution(executionId);
    } catch (error) {
      console.error("Execution failed:", error);
    }
  }, [workflowId, selectedNodeId, saveBeforeRun, startExecution, t]);

  // 실행 중단 — POST /executions/:id/stop. 최종 cancelled 전이는 WS
  // `execution.cancelled` 이벤트가 store status 를 갱신한다.
  const handleStop = useCallback(async () => {
    if (!executionId || cancelling) return;
    setCancelling(true);
    try {
      await executionsApi.stop(executionId);
      toast.success(t("executions.stopped"));
    } catch (error) {
      console.error("Stop failed:", error);
      toast.error(t("executions.stopFailed"));
    } finally {
      setCancelling(false);
    }
  }, [executionId, cancelling, t]);

  const handleExport = useCallback(async () => {
    if (!workflowId) return;
    try {
      const response = await workflowsApi.exportWorkflow(workflowId);
      const data = response.data.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workflowName || "workflow"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
    setMoreDropdownOpen(false);
  }, [workflowId, workflowName]);

  const handleDelete = useCallback(async () => {
    if (!workflowId) return;
    try {
      await workflowsApi.delete(workflowId);
      // Refresh the list + dashboard caches before navigating, otherwise the
      // 60s default staleTime keeps the deleted row visible on the list.
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push("/workflows");
    } catch (error) {
      console.error("Delete failed:", error);
    }
    setDeleteConfirmOpen(false);
    setMoreDropdownOpen(false);
  }, [workflowId, router, queryClient]);

  return (
    <>
      <div className="flex h-12 shrink-0 items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3">
        {/* Left section: back + breadcrumb */}
        <div className="flex items-center gap-1.5">
          <Link href="/workflows">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("common.back")}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
          </Link>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("editor.workflowsBreadcrumb")}
          </span>
          <ChevronRight
            size={12}
            className="text-[hsl(var(--muted-foreground))]"
          />
        </div>

        <div className="ml-2 flex flex-1 items-center justify-center">
          {canEdit ? (
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="h-7 max-w-[240px] border-transparent bg-transparent text-center text-sm font-medium hover:border-[hsl(var(--input))] focus:border-[hsl(var(--input))]"
            />
          ) : (
            <span className="max-w-[240px] truncate text-sm font-medium">
              {workflowName}
            </span>
          )}
        </div>

        {/* Right section: actions */}
        <div className="flex items-center gap-1.5">
          {/* Dirty indicator */}
          <span className="mr-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            {isSaving
              ? t("editor.toolbarSaving")
              : isDirty
                ? t("editor.toolbarUnsaved")
                : t("editor.toolbarSaved")}
          </span>

          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={undoStack.length === 0}
            title={t("editor.undoTooltip")}
          >
            <Undo2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={redoStack.length === 0}
            title={t("editor.redoTooltip")}
          >
            <Redo2 size={14} />
          </Button>

          {/* AI Assistant toggle */}
          <Button
            variant={assistantOpen ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={toggleAssistant}
            title={t("assistant.toggleButton")}
            aria-label={t("assistant.toggleButton")}
            aria-pressed={assistantOpen}
          >
            <Bot size={14} />
          </Button>

          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={!isDirty || isSaving || graphWarnings.hasError}
              onClick={() => void saveAndInvalidate()}
              title={(() => {
                if (!graphWarnings.hasError) return undefined;
                const err = graphWarnings.results.find(
                  (r) => r.severity === "error",
                );
                // i18n Principle 3-C: 동적 rule 메시지를 ko 로 localize (영문 fallback).
                return err ? translateGraphWarning(err, locale) : undefined;
              })()}
            >
              <Save size={14} />
              {t("common.save")}
            </Button>
          )}

          {/* Stop button — 실행 중단 (running / waiting_for_input) */}
          {isCancellable && executionId && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5 text-xs"
              disabled={cancelling}
              onClick={() => void handleStop()}
              title={t("executions.stop")}
            >
              {cancelling ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Square size={14} />
              )}
              {t("executions.stop")}
            </Button>
          )}

          {/* Run split button */}
          <div className="relative" ref={runDropdownRef}>
            <div className="flex">
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-r-none text-xs"
                disabled={isRunning || !workflowId}
                onClick={() => void handleRun()}
              >
                {isRunning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("editor.running")}
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    {t("editor.runBtn")}
                  </>
                )}
              </Button>
              <Button
                size="sm"
                className="h-8 w-6 rounded-l-none border-l border-l-[hsl(var(--primary-foreground)/0.2)] px-0"
                disabled={isRunning || !workflowId}
                aria-label={t("editor.runOptions")}
                onClick={() => setRunDropdownOpen((prev) => !prev)}
              >
                <ChevronDown size={12} />
              </Button>
            </div>

            {runDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-md">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))]"
                  onClick={() => {
                    setRunDropdownOpen(false);
                    void handleRun();
                  }}
                >
                  <Play size={14} />
                  {t("editor.runBtn")}
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))]"
                  onClick={() => {
                    setRunDropdownOpen(false);
                    setRunWithInputOpen(true);
                  }}
                >
                  <PlayCircle size={14} />
                  {t("editor.runWithInput")}
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))] disabled:opacity-50"
                  disabled={!selectedNodeId}
                  onClick={() => {
                    setRunDropdownOpen(false);
                    void handleRunFromSelected();
                  }}
                >
                  <ChevronRight size={14} />
                  {t("editor.runFromSelected")}
                </button>
              </div>
            )}
          </div>

          <div className="relative" ref={moreDropdownRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              data-testid="editor-toolbar-more-menu"
              aria-label={t("editor.moreMenu")}
              onClick={() => setMoreDropdownOpen((prev) => !prev)}
            >
              <MoreVertical size={16} />
            </Button>

            {moreDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-md">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))]"
                  onClick={() => {
                    setMoreDropdownOpen(false);
                    setVersionHistoryOpen(true);
                  }}
                >
                  <History size={14} />
                  {t("editor.versionHistoryTitle")}
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))]"
                  onClick={() => void handleExport()}
                >
                  <FileDown size={14} />
                  {t("editor.exportMenu")}
                </button>
                {canEdit && (
                  <>
                    <div className="my-1 border-t border-[hsl(var(--border))]" />
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-[hsl(var(--accent))]"
                      onClick={() => {
                        setMoreDropdownOpen(false);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 size={14} />
                      {t("editor.deleteMenu")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Run with Input dialog */}
      {runWithInputOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[hsl(var(--card-foreground))]">
                {t("editor.runWithInputTitle")}
              </h3>
              {/* §2.2 히스토리 로드 — 이전 실행의 입력 데이터 불러오기 */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setHistoryPickerOpen((prev) => !prev)}
              >
                <History size={13} />
                {t("editor.loadFromHistory")}
              </Button>
            </div>

            {historyPickerOpen && (
              <div className="mb-3 max-h-44 overflow-y-auto rounded-md border border-[hsl(var(--border))]">
                {historyQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 p-3 text-xs text-[hsl(var(--muted-foreground))]">
                    <Loader2 size={13} className="animate-spin" />
                    {t("common.loading")}
                  </div>
                ) : historyQuery.data && historyQuery.data.data.length > 0 ? (
                  historyQuery.data.data.map((ex) => (
                    <button
                      key={ex.id}
                      className="flex w-full items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-3 py-2 text-left text-xs last:border-b-0 hover:bg-[hsl(var(--accent))]"
                      onClick={() => void handleLoadFromHistory(ex.id)}
                    >
                      <span className="text-[hsl(var(--foreground))]">
                        {t(`executions.triggerSource.${ex.triggerSource}`)}
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {timeAgo(ex.startedAt, locale)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
                    {t("editor.runHistoryEmpty")}
                  </div>
                )}
              </div>
            )}

            <textarea
              aria-invalid={jsonError != null}
              className={`mb-1 h-40 w-full resize-none rounded-md border bg-[hsl(var(--background))] p-3 font-mono text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 ${
                jsonError != null
                  ? "border-red-500 focus:ring-red-500"
                  : "border-[hsl(var(--input))] focus:ring-[hsl(var(--ring))]"
              }`}
              placeholder={t("editor.runWithInputPlaceholder")}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            {/* §2.2 검증 — 실시간 JSON 유효성 피드백 */}
            <p
              role={jsonError != null ? "alert" : undefined}
              className={`mb-4 min-h-[1rem] text-xs ${
                jsonError != null
                  ? "text-red-500"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {jsonError != null ? jsonError : t("editor.jsonValid")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRunWithInputOpen(false);
                  setHistoryPickerOpen(false);
                  setJsonInput("{}");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                data-testid="run-with-input-submit"
                disabled={isRunning || jsonError != null}
                onClick={() => void handleRunWithInput()}
              >
                <Play size={14} className="mr-1.5" />
                {t("editor.runBtn")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--card-foreground))]">
              {t("editor.deleteWorkflowTitle")}
            </h3>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              {t("editor.deleteWorkflowMessage", { name: workflowName })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleDelete()}
              >
                <Trash2 size={14} className="mr-1.5" />
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
