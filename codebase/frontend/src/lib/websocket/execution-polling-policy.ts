import type { ExecutionData } from "../api/executions";
import {
  selectShouldPoll,
  type useExecutionStore,
} from "../stores/execution-store";
import { isTerminalServerExecutionStatus } from "./apply-execution-snapshot";

/**
 * 실행 REST 폴링 정책(CLE-EXEC-RUN 「REST 폴링 대체 경로」). 폴링 간격, 실패 뒤 재시도 간격,
 * 받은 응답을 store 에 넣을지 가르는 판정을 여기에 모은다.
 *
 * REST 응답을 store 에 넣는 화면은 둘이고, 늦게 도착한 응답을 다루는 방식이 다르다.
 *
 * - 에디터 실행 패널(`useExecutionPollingFallback`)은 WS 실시간 경로가 막혔을 때만 폴링하고
 *   응답을 `decidePollResponse` 로 거른다. WS 가 살아나면 폴링을 멈추므로, 요청을 보낸 뒤 WS 가
 *   채운 노드 결과를 옛 응답이 덮으면 그 값이 그대로 남기 때문이다.
 * - 실행 상세 페이지(`executions/[executionId]/page.tsx`)는 WS 상태와 관계없이 종결까지
 *   `nextExecutionRefetchInterval` 간격으로 폴링하고 응답을 거르지 않는다. 에디터의 세 가지
 *   거름 기준이 이 페이지에는 맞지 않는다.
 *   - 실행 ID: 페이지가 store 를 비운 뒤 store 의 `executionId` 는 null 이다. WS
 *     `execution.started` 나 idle store 에 들어온 `running` 스냅샷만 이 값을 채우므로 대기 ·
 *     종결 상태로 연 실행에서는 계속 null 이다. 실행 ID 를 비교하면 그런 실행의 응답을 첫
 *     번째부터 버린다. 응답은 query key 의 실행 ID 로 묶여 있고, 실행이 바뀌면 페이지가
 *     store 를 비운다.
 *   - 종결: 종결 응답을 받으면 폴링이 멈춘다. store 가 이미 끝난 뒤에 온 `running` 응답은
 *     `applyExecutionSnapshot` 이 반영하지 않는다.
 *   - 요청 뒤 store 변경: 옛 응답이 WS 가 채운 노드 결과를 덮어도 종결까지 다시 받으므로
 *     다음 응답이 바로잡는다.
 */

/**
 * REST 폴링 간격(CLE-EXEC-RUN 「REST 폴링 대체 경로」의 2초). 실행 상세 페이지
 * (`executions/[executionId]/page.tsx`)의 상시 폴링 `refetchInterval` 도 이 값을 쓴다.
 */
export const EXECUTION_POLL_INTERVAL_MS = 2000;

/** 실패가 이어질 때 재시도 간격의 상한. 2초에서 시작해 두 배씩 늘려 이 값에서 멈춘다. */
export const EXECUTION_POLL_MAX_BACKOFF_MS = 30_000;

/** `Retry-After` 를 따르되 이 값을 넘는 대기는 하지 않는다(잘못된 헤더로 폴링이 사실상 멈추지 않게). */
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * 다시 보내도 같은 결과가 나오는 응답 상태. 400(잘못된 요청) · 401(`apiClient` 가
 * 토큰 갱신을 이미 한 번 시도한 뒤의 인증 실패) · 403(권한 없음) · 404(삭제됐거나
 * 워크스페이스 전환으로 보이지 않는 실행)는 회복할 수 없으므로 폴링을 멈춘다.
 * 그 밖의 오류(429 · 5xx · 네트워크 오류)는 백오프로 다시 받는다.
 */
const UNRECOVERABLE_STATUSES: ReadonlySet<number> = new Set([
  400, 401, 403, 404,
]);

export interface PollFailure {
  /** HTTP 응답 상태. 응답이 없는 네트워크 오류면 `undefined`. */
  status: number | undefined;
  message: string;
  /** 응답의 `Retry-After`(초)를 밀리초로 바꾼 값. 없거나 읽을 수 없으면 `undefined`. */
  retryAfterMs: number | undefined;
}

/**
 * 폴링 오류에서 로그와 재시도 판단에 쓸 값만 꺼낸다. AxiosError 전체를 로그에 넘기지
 * 않는다(요청 헤더의 `Authorization` 과 응답 본문이 콘솔에 남지 않게).
 */
export function describePollFailure(err: unknown): PollFailure {
  const e = err as {
    message?: unknown;
    response?: { status?: unknown; headers?: unknown };
  } | null;
  const status =
    typeof e?.response?.status === "number" ? e.response.status : undefined;
  const message =
    typeof e?.message === "string" && e.message ? e.message : String(err);
  return {
    status,
    message,
    retryAfterMs: readRetryAfterMs(e?.response?.headers),
  };
}

/** `Retry-After: <초>` 만 읽는다. 날짜 형식과 음수 · 비정상 값은 무시한다. */
function readRetryAfterMs(headers: unknown): number | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const h = headers as { get?: unknown } & Record<string, unknown>;
  // axios 1.x 의 AxiosHeaders 는 `get` 으로 대소문자 구분 없이 읽는다. 일반 객체는 소문자 키다.
  const raw =
    typeof h.get === "function"
      ? (h.get as (name: string) => unknown).call(headers, "retry-after")
      : (h["retry-after"] ?? h["Retry-After"]);
  const seconds =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim())
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}

/**
 * 요청이 실패한 뒤 다음 요청까지 기다릴 시간. `null` 이면 멈춘다.
 *
 * - 400 · 401 · 403 · 404 는 다시 보내도 같으므로 `null`.
 * - 응답에 읽을 수 있는 `Retry-After` 가 있으면 그 값을 2초~60초로 잘라 따른다.
 * - 그 밖(429 · 5xx · 네트워크 오류)은 연속 실패 `failures`(1부터) 번째에 맞춰
 *   2s → 4s → 8s … 30s 상한으로 늘린다.
 */
export function nextRetryDelayMs(
  failure: PollFailure,
  failures: number,
): number | null {
  if (
    failure.status !== undefined &&
    UNRECOVERABLE_STATUSES.has(failure.status)
  ) {
    return null;
  }
  if (failure.retryAfterMs !== undefined) {
    return Math.min(
      Math.max(failure.retryAfterMs, EXECUTION_POLL_INTERVAL_MS),
      MAX_RETRY_AFTER_MS,
    );
  }
  return Math.min(
    EXECUTION_POLL_INTERVAL_MS * 2 ** (failures - 1),
    EXECUTION_POLL_MAX_BACKOFF_MS,
  );
}

/** 응답 폐기 판정에 쓰는 store 값. 요청을 보낼 때와 응답이 왔을 때 두 번 읽는다. */
export type PollStoreView = Pick<
  ReturnType<typeof useExecutionStore.getState>,
  | "executionId"
  | "status"
  | "nodeStatuses"
  | "nodeResults"
  | "pendingLastTurnRetry"
>;

/**
 * 받은 응답을 어떻게 할지.
 * - `apply`: store 에 넣는다.
 * - `discard`: 이 응답만 버리고 다음 요청을 예약한다.
 * - `stop`: 응답을 버리고 폴링을 멈춘다.
 */
export type PollResponseDecision = "apply" | "discard" | "stop";

/**
 * 응답을 store 에 넣을지 가른다. `sent` 는 요청을 보낼 때, `current` 는 응답이 왔을 때의
 * store 다.
 *
 * - store 의 실행 ID 가 이 폴링의 것과 다르거나(드로어를 닫아 `reset` 됐거나 새 실행이
 *   시작됨) store 가 이미 끝난 실행이면 `stop`. 끝난 실행이어도 마지막 턴 재시도를
 *   기다리는 중이면(`selectAwaitingLastTurnRetry`) 멈추지 않는다.
 * - 요청을 보낸 뒤 다른 경로(WS 이벤트 · 사용자의 대기 응답)가 노드 상태 · 노드 결과 ·
 *   실행 상태를 바꿨으면 `discard`. 노드 상태와 노드 결과는 참조로 가른다. store 는 두
 *   필드를 쓸 때마다 새 참조를 만든다(`execution-store.ts` 의 필드 설명과 계약 테스트).
 * - 그 밖에는 `apply`.
 */
export function decidePollResponse(
  sent: PollStoreView,
  current: PollStoreView,
  executionId: string,
): PollResponseDecision {
  if (current.executionId !== executionId || !selectShouldPoll(current)) {
    return "stop";
  }
  const changedSinceSent =
    current.nodeStatuses !== sent.nodeStatuses ||
    current.nodeResults !== sent.nodeResults ||
    current.status !== sent.status;
  return changedSinceSent ? "discard" : "apply";
}

/**
 * 실행 상세 화면 REST 폴링의 다음 간격. 종결 상태면 `false`(폴링 중단), 상태가 없거나
 * 진행 중이면 `intervalMs`. `waiting_for_input` 도 계속 폴링한다.
 */
export function nextExecutionRefetchInterval(
  status: ExecutionData["status"] | undefined,
  intervalMs: number,
): number | false {
  if (!status) return intervalMs;
  return isTerminalServerExecutionStatus(status) ? false : intervalMs;
}
