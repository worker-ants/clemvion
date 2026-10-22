"use client";

import { useEffect } from "react";
import { executionsApi, type ExecutionData } from "../api/executions";
import { useExecutionStore } from "../stores/execution-store";
import { applyExecutionSnapshot } from "./apply-execution-snapshot";

/**
 * REST 폴링 간격. 실행 상세 페이지의 `refetchInterval` 과 같은 2초다
 * (CLE-EXEC-RUN 「입력 데이터 흐름」).
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

const TERMINAL_EXECUTION_STATUSES: ReadonlySet<ExecutionData["status"]> =
  new Set(["completed", "failed", "cancelled"]);

interface PollFailure {
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
function describePollFailure(err: unknown): PollFailure {
  const e = err as {
    message?: unknown;
    response?: { status?: unknown; headers?: unknown };
  } | null;
  const status =
    typeof e?.response?.status === "number" ? e.response.status : undefined;
  const message =
    typeof e?.message === "string" && e.message ? e.message : String(err);
  return { status, message, retryAfterMs: readRetryAfterMs(e?.response?.headers) };
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

/** 연속 실패 `failures`(1부터) 번째 뒤의 대기 시간: 2s → 4s → 8s … 30s 상한. */
function backoffDelayMs(failures: number): number {
  return Math.min(
    EXECUTION_POLL_INTERVAL_MS * 2 ** (failures - 1),
    EXECUTION_POLL_MAX_BACKOFF_MS,
  );
}

interface UseExecutionPollingFallbackOptions {
  executionId: string | null;
  /** `useExecutionEvents` 의 `realtimeFallback`. WS 실시간 경로가 막혔을 때만 켠다. */
  enabled: boolean;
}

/**
 * WS 실시간 경로가 막혔을 때 쓰는 REST 폴링 대체 경로(에디터 실행 패널).
 *
 * `enabled` 가 켜지면 `GET /executions/:id` 를 바로 한 번 받고 2초마다 다시 받아
 * `applyExecutionSnapshot` 으로 WS 스냅샷과 같은 store 자리를 채운다. WS 가 살아나
 * `enabled` 가 꺼지거나, 응답 · store 가 끝난 실행(completed · failed · cancelled)이면
 * 멈춘다. 실행 상세 페이지는 상시 폴링을 따로 하므로 이 훅을 쓰지 않는다.
 *
 * 요청이 실패하면 상태 코드로 나눈다. 400 · 401 · 403 · 404 는 다시 보내도 같으므로
 * 경고를 한 번 남기고 멈춘다. 429 · 5xx · 네트워크 오류는 2초에서 시작해 두 배씩 늘려
 * 30초에서 멈추는 백오프로 다시 받고, 응답에 `Retry-After`(초)가 있으면 그 값을
 * (최대 60초까지) 따른다. 성공하면 2초로 되돌린다. 401 마다 토큰 갱신을 되풀이하거나
 * 429 를 받고도 같은 간격으로 보내 사용자 요청 한도를 스스로 쓰는 일을 막는다.
 *
 * React Query 의 `refetchInterval` 대신 effect 로 직접 도는 이유:
 *  - 꺼진 뒤 도착한 응답을 버려야 한다. 이미 WS 이벤트로 앞선 store 를 옛 REST
 *    응답이 덮으면 `running` + 이전 `waiting_for_input` 조합이 대기 UI 를 지운다
 *    (`applyExecutionSnapshot` 의 resume 분기).
 *  - 다시 켜질 때 캐시에 남은 옛 응답을 적용하지 않아야 한다. 같은 이유다.
 *  - 요청이 겹치지 않게 응답을 받은 뒤에 다음 요청을 예약한다.
 */
export function useExecutionPollingFallback({
  executionId,
  enabled,
}: UseExecutionPollingFallbackOptions): void {
  const storeFinished = useExecutionStore(
    (s) => s.status === "completed" || s.status === "failed",
  );
  const active = enabled && !!executionId && !storeFinished;

  useEffect(() => {
    if (!active || !executionId) return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const poll = async () => {
      let nextDelayMs: number | null = EXECUTION_POLL_INTERVAL_MS;
      try {
        const execution = await executionsApi.getById(executionId);
        if (disposed) return;
        failures = 0;
        applyExecutionSnapshot(execution, () => disposed);
        if (TERMINAL_EXECUTION_STATUSES.has(execution.status)) {
          nextDelayMs = null;
        }
      } catch (err) {
        if (disposed) return;
        failures += 1;
        const failure = describePollFailure(err);
        if (
          failure.status !== undefined &&
          UNRECOVERABLE_STATUSES.has(failure.status)
        ) {
          console.warn(
            "[useExecutionPollingFallback] REST poll stopped — not recoverable",
            { status: failure.status, message: failure.message },
          );
          return;
        }
        // 연속 실패의 첫 번째만 남긴다(백오프 중에 같은 경고가 쌓이지 않게).
        if (failures === 1) {
          console.warn(
            "[useExecutionPollingFallback] REST poll failed — retrying with backoff",
            { status: failure.status, message: failure.message },
          );
        }
        nextDelayMs =
          failure.retryAfterMs !== undefined
            ? Math.min(
                Math.max(failure.retryAfterMs, EXECUTION_POLL_INTERVAL_MS),
                MAX_RETRY_AFTER_MS,
              )
            : backoffDelayMs(failures);
      }
      if (nextDelayMs !== null) {
        timer = setTimeout(() => void poll(), nextDelayMs);
      }
    };

    void poll();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, executionId]);
}
