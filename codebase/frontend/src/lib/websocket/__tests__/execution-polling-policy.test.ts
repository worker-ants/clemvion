import { describe, it, expect } from "vitest";
import {
  EXECUTION_POLL_INTERVAL_MS,
  decidePollResponse,
  nextExecutionRefetchInterval,
  nextRetryDelayMs,
} from "../execution-polling-policy";

// CLE-T-TP2T6Q — `poll()` 에서 뺀 순수 함수. 훅 테스트가 타이머와 store 로 확인하는 판정을
// 입력 · 출력만으로 고정한다.
describe("decidePollResponse — 응답을 넣을지 가르는 판정", () => {
  function view(
    overrides: Partial<Parameters<typeof decidePollResponse>[0]> = {},
  ): Parameters<typeof decidePollResponse>[0] {
    return {
      executionId: "exec-1",
      status: "running",
      nodeStatuses: new Map(),
      nodeResults: [],
      pendingLastTurnRetry: null,
      ...overrides,
    };
  }

  it("store 가 failed 여도 마지막 턴 재시도를 기다리는 중이면 넣는다", () => {
    const sent = view({
      status: "failed",
      pendingLastTurnRetry: { nodeExecutionId: "ne-r" },
    });
    expect(decidePollResponse(sent, { ...sent }, "exec-1")).toBe("apply");
  });

  it("요청 뒤 재시도 기다림이 끝나 store 가 failed 로 남으면 멈춘다", () => {
    const sent = view({
      status: "failed",
      pendingLastTurnRetry: { nodeExecutionId: "ne-r" },
    });
    expect(
      decidePollResponse(
        sent,
        { ...sent, pendingLastTurnRetry: null },
        "exec-1",
      ),
    ).toBe("stop");
  });

  it("요청 뒤 store 가 그대로면 넣는다", () => {
    const sent = view();
    expect(decidePollResponse(sent, { ...sent }, "exec-1")).toBe("apply");
  });

  it("store 의 실행 ID 가 다르면 멈춘다", () => {
    const sent = view();
    expect(
      decidePollResponse(sent, { ...sent, executionId: "exec-2" }, "exec-1"),
    ).toBe("stop");
    expect(
      decidePollResponse(sent, { ...sent, executionId: null }, "exec-1"),
    ).toBe("stop");
  });

  it.each(["completed", "failed"] as const)(
    "store 가 끝난 실행(%s)이면 멈춘다",
    (status) => {
      const sent = view();
      expect(decidePollResponse(sent, { ...sent, status }, "exec-1")).toBe(
        "stop",
      );
    },
  );

  it("store 가 다른 실행이면서 바뀌었어도 멈춤이 앞선다", () => {
    const sent = view();
    expect(
      decidePollResponse(
        sent,
        { ...sent, executionId: "exec-2", nodeResults: [] },
        "exec-1",
      ),
    ).toBe("stop");
  });

  it("요청 뒤 노드 상태가 바뀌었으면 이 응답만 버린다", () => {
    const sent = view();
    expect(
      decidePollResponse(sent, { ...sent, nodeStatuses: new Map() }, "exec-1"),
    ).toBe("discard");
  });

  it("요청 뒤 노드 결과가 바뀌었으면 이 응답만 버린다", () => {
    const sent = view();
    expect(
      decidePollResponse(sent, { ...sent, nodeResults: [] }, "exec-1"),
    ).toBe("discard");
  });

  it("요청 뒤 실행 상태가 바뀌었으면 이 응답만 버린다", () => {
    const sent = view();
    expect(
      decidePollResponse(
        sent,
        { ...sent, status: "waiting_for_input" },
        "exec-1",
      ),
    ).toBe("discard");
  });
});

describe("nextRetryDelayMs — 실패한 요청 뒤의 대기 시간", () => {
  const failure = (
    status: number | undefined,
    retryAfterMs?: number,
  ): Parameters<typeof nextRetryDelayMs>[0] => ({
    status,
    message: "x",
    retryAfterMs,
  });

  it.each([400, 401, 403, 404])("%s 는 회복할 수 없어 멈춘다(null)", (status) => {
    expect(nextRetryDelayMs(failure(status), 1)).toBeNull();
    // Retry-After 가 있어도 멈춘다.
    expect(nextRetryDelayMs(failure(status, 5_000), 1)).toBeNull();
  });

  it.each([
    [1, 2_000],
    [2, 4_000],
    [3, 8_000],
    [4, 16_000],
    [5, 30_000],
    [10, 30_000],
  ])("연속 %s 번째 실패면 %sms 를 기다린다", (failures, expected) => {
    expect(nextRetryDelayMs(failure(503), failures)).toBe(expected);
    expect(nextRetryDelayMs(failure(undefined), failures)).toBe(expected);
  });

  it("Retry-After 가 있으면 백오프 대신 따르고 2초~60초로 자른다", () => {
    expect(nextRetryDelayMs(failure(429, 7_000), 1)).toBe(7_000);
    expect(nextRetryDelayMs(failure(429, 7_000), 5)).toBe(7_000);
    expect(nextRetryDelayMs(failure(429, 0), 3)).toBe(EXECUTION_POLL_INTERVAL_MS);
    expect(nextRetryDelayMs(failure(503, 600_000), 1)).toBe(60_000);
  });
});

describe("nextExecutionRefetchInterval", () => {
  it.each(["completed", "failed", "cancelled"] as const)(
    "%s 이면 폴링을 멈춘다",
    (status) => {
      expect(nextExecutionRefetchInterval(status, 2000)).toBe(false);
    },
  );

  it.each([undefined, "pending", "running", "waiting_for_input"] as const)(
    "%s 이면 간격을 돌려준다",
    (status) => {
      expect(nextExecutionRefetchInterval(status, 2000)).toBe(2000);
    },
  );
});
