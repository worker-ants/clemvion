import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  EXECUTION_POLL_INTERVAL_MS,
  useExecutionPollingFallback,
} from "../use-execution-polling-fallback";
import {
  useExecutionStore,
  selectSortedNodeResults,
} from "../../stores/execution-store";
import { executionsApi } from "../../api/executions";

vi.mock("../../api/executions", () => ({
  executionsApi: { getById: vi.fn() },
}));

vi.mock("../../node-definitions", () => ({
  getNodeDefinition: (type: string) =>
    type === "manual_trigger" ? { category: "trigger" } : { category: "unknown" },
}));

const getById = vi.mocked(executionsApi.getById);

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    status: "running",
    error: null,
    inputData: {},
    outputData: null,
    startedAt: "2026-10-22T00:00:00.000Z",
    finishedAt: null,
    durationMs: null,
    triggerSource: "manual",
    triggerLabel: null,
    nodeExecutions: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        executionId: "exec-1",
        nodeId: "trigger-1",
        status: "completed",
        startedAt: "2026-10-22T00:00:00.100Z",
        finishedAt: "2026-10-22T00:00:00.200Z",
        durationMs: 100,
        inputData: {},
        outputData: { output: { ok: true } },
        error: null,
        retryCount: 0,
        parentNodeExecutionId: null,
        node: { id: "trigger-1", type: "manual_trigger", label: "Start" },
      },
    ],
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof executionsApi.getById>>;
}

/** 대기 중인 마이크로태스크(모킹한 fetch 의 resolve)를 흘려 보낸다. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useExecutionPollingFallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getById.mockReset();
    useExecutionStore.getState().reset();
    useExecutionStore.getState().startExecution("exec-1");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enabled=false 면 REST 를 부르지 않는다", async () => {
    renderHook(() =>
      useExecutionPollingFallback({ executionId: "exec-1", enabled: false }),
    );
    await flush();
    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS * 3);
    });
    expect(getById).not.toHaveBeenCalled();
  });

  it("executionId 가 없으면 REST 를 부르지 않는다", async () => {
    renderHook(() =>
      useExecutionPollingFallback({ executionId: null, enabled: true }),
    );
    await flush();
    expect(getById).not.toHaveBeenCalled();
  });

  it("켜지면 바로 한 번 받아 applyExecutionSnapshot 으로 store 를 채운다", async () => {
    getById.mockResolvedValue(makeExecution());

    renderHook(() =>
      useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
    );
    await flush();

    expect(getById).toHaveBeenCalledTimes(1);
    expect(getById).toHaveBeenCalledWith("exec-1");
    const state = useExecutionStore.getState();
    expect(state.nodeStatuses.get("trigger-1")?.status).toBe("completed");
    const results = selectSortedNodeResults(state.nodeResults);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      nodeId: "trigger-1",
      nodeLabel: "Start",
      status: "completed",
    });
  });

  it("실행 상세 페이지와 같은 2초 간격으로 다시 받는다", async () => {
    expect(EXECUTION_POLL_INTERVAL_MS).toBe(2000);
    getById.mockResolvedValue(makeExecution());

    renderHook(() =>
      useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
    );
    await flush();
    expect(getById).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS - 1);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(2);
  });

  it("응답이 끝난 실행이면 폴링을 멈춘다", async () => {
    getById.mockResolvedValue(
      makeExecution({ status: "completed", finishedAt: "2026-10-22T00:00:01Z" }),
    );

    renderHook(() =>
      useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
    );
    await flush();
    expect(useExecutionStore.getState().status).toBe("completed");

    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS * 5);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(1);
  });

  it.each(["failed", "cancelled"])(
    "응답 상태가 %s 이면 폴링을 멈춘다",
    async (status) => {
      getById.mockResolvedValue(makeExecution({ status }));

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush();
      act(() => {
        vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS * 5);
      });
      await flush();
      expect(getById).toHaveBeenCalledTimes(1);
      expect(useExecutionStore.getState().status).toBe("failed");
    },
  );

  it("store 가 이미 끝난 실행이면 시작하지 않는다", async () => {
    useExecutionStore.getState().completeExecution();

    renderHook(() =>
      useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
    );
    await flush();
    expect(getById).not.toHaveBeenCalled();
  });

  it("WS 이벤트로 store 가 끝나면 다음 폴링을 하지 않는다", async () => {
    getById.mockResolvedValue(makeExecution());

    renderHook(() =>
      useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
    );
    await flush();
    expect(getById).toHaveBeenCalledTimes(1);

    act(() => {
      useExecutionStore.getState().completeExecution();
    });
    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS * 3);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(1);
  });

  it("enabled 가 false 로 바뀌면(WS 복구) 멈추고 늦게 온 응답은 버린다", async () => {
    let resolveSecond: (v: ReturnType<typeof makeExecution>) => void = () => {};
    getById
      .mockResolvedValueOnce(makeExecution({ nodeExecutions: [] }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled }),
      { initialProps: { enabled: true } },
    );
    await flush();
    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(2);

    // 두 번째 요청이 떠 있는 동안 WS 가 살아나 폴링이 꺼진다.
    rerender({ enabled: false });
    resolveSecond(makeExecution());
    await flush();

    // 꺼진 뒤 도착한 응답은 store 를 바꾸지 않는다.
    expect(selectSortedNodeResults(useExecutionStore.getState().nodeResults)).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS * 3);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(2);
  });

  it("요청이 실패해도 다음 간격에 다시 받는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getById
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(makeExecution());

    renderHook(() =>
      useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
    );
    await flush();
    expect(getById).toHaveBeenCalledTimes(1);
    expect(selectSortedNodeResults(useExecutionStore.getState().nodeResults)).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(2);
    expect(selectSortedNodeResults(useExecutionStore.getState().nodeResults)).toHaveLength(1);
    warn.mockRestore();
  });

  it("executionId 가 바뀌면 새 실행만 받는다", async () => {
    getById.mockImplementation(async (id: string) =>
      makeExecution({ id, nodeExecutions: [] }),
    );

    const { rerender } = renderHook(
      ({ id }: { id: string }) =>
        useExecutionPollingFallback({ executionId: id, enabled: true }),
      { initialProps: { id: "exec-1" } },
    );
    await flush();
    expect(getById).toHaveBeenLastCalledWith("exec-1");

    act(() => {
      useExecutionStore.getState().startExecution("exec-2");
    });
    rerender({ id: "exec-2" });
    await flush();
    expect(getById).toHaveBeenLastCalledWith("exec-2");

    getById.mockClear();
    act(() => {
      vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS);
    });
    await flush();
    expect(getById).toHaveBeenCalledTimes(1);
    expect(getById).toHaveBeenCalledWith("exec-2");
  });
});
