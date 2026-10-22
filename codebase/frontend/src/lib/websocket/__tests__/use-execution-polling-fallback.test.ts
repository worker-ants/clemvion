import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import {
  EXECUTION_POLL_INTERVAL_MS,
  EXECUTION_POLL_MAX_BACKOFF_MS,
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

/** `apiClient` 가 던지는 것과 같은 모양의 HTTP 오류(AxiosError). */
function httpError(status: number, headers: Record<string, string> = {}) {
  const axiosHeaders = new AxiosHeaders(headers);
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_RESPONSE",
    { headers: new AxiosHeaders({ Authorization: "Bearer secret-token" }) },
    undefined,
    {
      status,
      statusText: "",
      headers: axiosHeaders,
      config: { headers: new AxiosHeaders() },
      data: {},
    },
  );
}

/** 대기 중인 마이크로태스크(모킹한 fetch 의 resolve)를 흘려 보낸다. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * store 가 바뀐 직후 React 가 effect 를 정리하기 전에 응답이 도착하는 구간을 만든다.
 * 응답을 먼저 풀어 응답 처리 마이크로태스크가 React 의 재렌더(`storeFinished` 가 바뀌면
 * 동기 레인으로 잡힌다)보다 앞에 서게 하고, 그 뒤에 store 를 바꾼다. 응답 처리는 store
 * 가 이미 바뀐 상태에서 돌고 `disposed` 는 아직 false 다.
 */
async function respondBeforeCleanup(
  change: () => void,
  respond: () => void,
): Promise<void> {
  await act(async () => {
    respond();
    change();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** 첫 요청은 바로 응답하고 두 번째 요청을 연 채로 둔다. 돌려준 함수로 두 번째 응답을 푼다. */
async function startWithPendingSecondRequest() {
  let resolveSecond: (v: ReturnType<typeof makeExecution>) => void = () => {};
  getById
    .mockResolvedValueOnce(makeExecution({ nodeExecutions: [] }))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );
  renderHook(() =>
    useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
  );
  await flush();
  act(() => {
    vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS);
  });
  await flush();
  expect(getById).toHaveBeenCalledTimes(2);
  return (v: ReturnType<typeof makeExecution>) => resolveSecond(v);
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
  describe("요청이 실패할 때", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
      warn.mockRestore();
    });

    async function advance(ms: number): Promise<void> {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
      await flush();
    }

    it.each([400, 401, 403, 404])(
      "%s 은 회복할 수 없는 실패라 경고를 한 번 남기고 폴링을 멈춘다",
      async (status) => {
        getById.mockRejectedValue(httpError(status));

        renderHook(() =>
          useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
        );
        await flush();
        expect(getById).toHaveBeenCalledTimes(1);

        await advance(EXECUTION_POLL_MAX_BACKOFF_MS * 3);
        expect(getById).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
      },
    );

    it("로그에는 AxiosError 전체가 아니라 상태 코드와 메시지만 남긴다", async () => {
      getById.mockRejectedValue(httpError(403));

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush();

      expect(warn).toHaveBeenCalledTimes(1);
      const args = warn.mock.calls[0];
      expect(args[1]).toEqual({
        status: 403,
        message: "Request failed with status code 403",
      });
      expect(JSON.stringify(args)).not.toContain("secret-token");
    });

    it.each([500, 502, 503])(
      "%s 은 2초에서 시작해 두 배씩 늘려 30초에서 멈추는 백오프로 다시 받는다",
      async (status) => {
        getById.mockRejectedValue(httpError(status));

        renderHook(() =>
          useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
        );
        await flush();
        expect(getById).toHaveBeenCalledTimes(1);

        // 실패 n 번째 뒤의 대기: 2s · 4s · 8s · 16s · 30s · 30s.
        const waits = [2000, 4000, 8000, 16000, 30000, 30000];
        for (let i = 0; i < waits.length; i += 1) {
          await advance(waits[i] - 1);
          expect(getById).toHaveBeenCalledTimes(i + 1);
          await advance(1);
          expect(getById).toHaveBeenCalledTimes(i + 2);
        }
      },
    );

    it("백오프 중에는 경고를 한 번만 남긴다", async () => {
      getById.mockRejectedValue(httpError(503));

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush();
      for (const wait of [2000, 4000, 8000]) {
        await advance(wait);
      }
      expect(getById).toHaveBeenCalledTimes(4);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("응답이 없는 네트워크 오류도 백오프로 다시 받는다", async () => {
      getById.mockRejectedValue(new Error("Network Error"));

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush();
      await advance(2000);
      expect(getById).toHaveBeenCalledTimes(2);
      await advance(3999);
      expect(getById).toHaveBeenCalledTimes(2);
      await advance(1);
      expect(getById).toHaveBeenCalledTimes(3);
    });

    it("성공하면 간격을 2초로 되돌린다", async () => {
      getById
        .mockRejectedValueOnce(httpError(503))
        .mockRejectedValueOnce(httpError(503))
        .mockRejectedValueOnce(httpError(503))
        .mockResolvedValueOnce(makeExecution())
        .mockRejectedValueOnce(httpError(503))
        .mockResolvedValue(makeExecution());

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush(); // 1: 실패 -> 2s
      await advance(2000); // 2: 실패 -> 4s
      await advance(4000); // 3: 실패 -> 8s
      await advance(8000); // 4: 성공 -> 2s
      expect(getById).toHaveBeenCalledTimes(4);

      await advance(2000); // 5: 실패(연속 1번째) -> 다시 2s
      expect(getById).toHaveBeenCalledTimes(5);
      await advance(2000); // 6
      expect(getById).toHaveBeenCalledTimes(6);
    });

    it("429 의 Retry-After(초)를 따른다", async () => {
      getById
        .mockRejectedValueOnce(httpError(429, { "Retry-After": "7" }))
        .mockResolvedValue(makeExecution());

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush();
      expect(getById).toHaveBeenCalledTimes(1);

      await advance(6999);
      expect(getById).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getById).toHaveBeenCalledTimes(2);
    });

    it("Retry-After 가 너무 크면 60초에서 자르고 너무 작으면 기본 간격을 지킨다", async () => {
      getById
        .mockRejectedValueOnce(httpError(429, { "Retry-After": "3600" }))
        .mockRejectedValueOnce(httpError(429, { "Retry-After": "0" }))
        .mockResolvedValue(makeExecution());

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush();
      await advance(59_999);
      expect(getById).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getById).toHaveBeenCalledTimes(2);

      await advance(EXECUTION_POLL_INTERVAL_MS - 1);
      expect(getById).toHaveBeenCalledTimes(2);
      await advance(1);
      expect(getById).toHaveBeenCalledTimes(3);
    });

    it("읽을 수 없는 Retry-After(날짜 형식)는 백오프로 대신한다", async () => {
      getById
        .mockRejectedValueOnce(
          httpError(503, { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" }),
        )
        .mockResolvedValue(makeExecution());

      renderHook(() =>
        useExecutionPollingFallback({ executionId: "exec-1", enabled: true }),
      );
      await flush();
      await advance(1999);
      expect(getById).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getById).toHaveBeenCalledTimes(2);
    });

    it("꺼진 뒤 실패로 끝난 요청은 경고를 남기지 않고 다시 보내지 않는다", async () => {
      let rejectSecond: (e: unknown) => void = () => {};
      getById
        .mockResolvedValueOnce(makeExecution({ nodeExecutions: [] }))
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectSecond = reject;
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

      rerender({ enabled: false });
      rejectSecond(httpError(503));
      await flush();
      await advance(EXECUTION_POLL_MAX_BACKOFF_MS * 3);

      expect(warn).not.toHaveBeenCalled();
      expect(getById).toHaveBeenCalledTimes(2);
    });
  });
  describe("effect 정리 전에 도착한 옛 응답", () => {
    it("드로어를 닫아 store 가 reset 됐으면 응답으로 실행을 되살리지 않는다", async () => {
      const respond = await startWithPendingSecondRequest();

      await respondBeforeCleanup(
        () => useExecutionStore.getState().reset(),
        () => respond(makeExecution()),
      );

      const state = useExecutionStore.getState();
      expect(state.executionId).toBeNull();
      expect(state.status).toBe("idle");
      expect(selectSortedNodeResults(state.nodeResults)).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS * 3);
      });
      await flush();
      expect(getById).toHaveBeenCalledTimes(2);
    });

    it("새 실행이 시작됐으면 옛 실행의 응답이 새 실행 store 에 섞이지 않는다", async () => {
      const respond = await startWithPendingSecondRequest();

      await respondBeforeCleanup(
        () => useExecutionStore.getState().startExecution("exec-2"),
        // 옛 실행이 끝난 응답이어도 새 실행을 완료로 만들면 안 된다.
        () => respond(makeExecution({ status: "completed" })),
      );

      const state = useExecutionStore.getState();
      expect(state.executionId).toBe("exec-2");
      expect(state.status).toBe("running");
      expect(selectSortedNodeResults(state.nodeResults)).toHaveLength(0);
    });

    it.each([
      ["completed", () => useExecutionStore.getState().completeExecution()],
      ["failed", () => useExecutionStore.getState().failExecution("boom")],
    ] as const)(
      "WS 이벤트로 store 가 %s 가 된 뒤에 도착한 응답은 적용하지 않는다",
      async (status, change) => {
        const respond = await startWithPendingSecondRequest();

        await respondBeforeCleanup(change, () => respond(makeExecution()));

        const state = useExecutionStore.getState();
        expect(state.status).toBe(status);
        expect(selectSortedNodeResults(state.nodeResults)).toHaveLength(0);
      },
    );

    it("같은 실행이면 정리 전에 도착한 응답도 적용한다", async () => {
      const respond = await startWithPendingSecondRequest();

      await respondBeforeCleanup(
        () => {},
        () => respond(makeExecution()),
      );

      expect(
        selectSortedNodeResults(useExecutionStore.getState().nodeResults),
      ).toHaveLength(1);
    });
  });

  describe("요청이 떠 있는 동안 다른 경로가 store 를 바꾸면", () => {
    const [completedNode] = makeExecution().nodeExecutions;
    /** WS 보다 앞선 시점의 응답: 노드가 아직 실행 중이고 출력이 없다. */
    const staleExecution = () =>
      makeExecution({
        nodeExecutions: [
          {
            ...completedNode,
            status: "running",
            finishedAt: null,
            durationMs: null,
            outputData: null,
          },
        ],
      });

    it.each([
      [
        "노드 상태",
        () =>
          useExecutionStore
            .getState()
            .updateNodeStatus("trigger-1", {
              status: "completed",
              duration: 100,
            }),
        () =>
          expect(
            selectSortedNodeResults(useExecutionStore.getState().nodeResults),
          ).toHaveLength(0),
      ],
      [
        "노드 결과",
        () =>
          useExecutionStore.getState().addNodeResult({
            nodeExecutionId: completedNode.id,
            nodeId: "trigger-1",
            nodeLabel: "Start",
            nodeType: "manual_trigger",
            nodeCategory: "trigger",
            status: "completed",
            duration: 100,
            outputData: { output: { ok: true } },
            startedAt: completedNode.startedAt ?? undefined,
          }),
        () => {
          const [row] = selectSortedNodeResults(
            useExecutionStore.getState().nodeResults,
          );
          expect(row.status).toBe("completed");
          expect(row.outputData).toEqual({ output: { ok: true } });
        },
      ],
      [
        "실행 상태",
        () => useExecutionStore.getState().pauseForForm("trigger-1", {}),
        () => {
          const state = useExecutionStore.getState();
          expect(state.status).toBe("waiting_for_input");
          expect(state.waitingInteractionType).toBe("form");
        },
      ],
    ] as const)(
      "%s가 바뀌었으면 그 응답만 버리고 다음 요청은 적용한다",
      async (_label, change, expectKept) => {
        const respond = await startWithPendingSecondRequest();

        // WS 가 복구돼 먼저 들어온 이벤트(또는 사용자의 대기 응답)를 흉내 낸다.
        act(() => change());
        respond(staleExecution());
        await flush();
        expectKept();

        getById.mockResolvedValueOnce(makeExecution({ status: "completed" }));
        act(() => {
          vi.advanceTimersByTime(EXECUTION_POLL_INTERVAL_MS);
        });
        await flush();
        expect(getById).toHaveBeenCalledTimes(3);
        expect(useExecutionStore.getState().status).toBe("completed");
      },
    );
  });

});
