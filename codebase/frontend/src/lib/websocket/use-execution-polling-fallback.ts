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

const TERMINAL_EXECUTION_STATUSES: ReadonlySet<ExecutionData["status"]> =
  new Set(["completed", "failed", "cancelled"]);

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
      let finished = false;
      try {
        const execution = await executionsApi.getById(executionId);
        if (disposed) return;
        failures = 0;
        applyExecutionSnapshot(execution, () => disposed);
        finished = TERMINAL_EXECUTION_STATUSES.has(execution.status);
      } catch (err) {
        if (disposed) return;
        // 연속 실패의 첫 번째만 남긴다(2초마다 같은 경고가 쌓이지 않게).
        failures += 1;
        if (failures === 1) {
          console.warn(
            "[useExecutionPollingFallback] REST poll failed — retrying",
            err,
          );
        }
      }
      if (!finished) {
        timer = setTimeout(() => void poll(), EXECUTION_POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, executionId]);
}
