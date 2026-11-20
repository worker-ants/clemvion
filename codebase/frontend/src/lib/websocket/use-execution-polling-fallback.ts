"use client";

import { useEffect } from "react";
import { executionsApi } from "../api/executions";
import {
  selectAwaitingLastTurnRetry,
  selectShouldPoll,
  useExecutionStore,
} from "../stores/execution-store";
import {
  applyExecutionSnapshot,
  isTerminalServerExecutionStatus,
} from "./apply-execution-snapshot";
import {
  EXECUTION_POLL_INTERVAL_MS,
  decidePollResponse,
  describePollFailure,
  nextRetryDelayMs,
} from "./execution-polling-policy";

interface UseExecutionPollingFallbackOptions {
  executionId: string | null;
  /** `useExecutionEvents` 의 `needsRestPolling`. WS 실시간 경로가 막혔을 때만 켠다. */
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
 * 마지막 턴 재시도 ack 가 성공하면 실행은 재시도 턴이 끝날 때까지 `failed` 다. store 가
 * 재시도를 기다리는 동안(`selectAwaitingLastTurnRetry`)은 끝난 실행이어도 폴링을 다시 켜고
 * `failed` 응답에서도 멈추지 않는다. 재시도 턴이 park 하거나 그래프를 이어 가면
 * `applyExecutionSnapshot` 이 대기 · 실행 중으로 돌리고, 다시 실패하면 실패로 마감해
 * 멈춘다(CLE-T-GKVH1B).
 *
 * 요청이 실패하면 상태 코드로 나눈다. 400 · 401 · 403 · 404 는 다시 보내도 같으므로
 * 경고를 한 번 남기고 멈춘다. 429 · 5xx · 네트워크 오류는 2초에서 시작해 두 배씩 늘려
 * 30초에서 멈추는 백오프로 다시 받고, 응답에 `Retry-After`(초)가 있으면 그 값을
 * (최대 60초까지) 따른다. 성공하면 2초로 되돌린다. 401 마다 토큰 갱신을 되풀이하거나
 * 429 를 받고도 같은 간격으로 보내 사용자 요청 한도를 스스로 쓰는 일을 막는다.
 * API 를 다른 출처로 부르는 배포에서는 백엔드 CORS 가 `Retry-After` 를 노출하지 않아
 * 브라우저가 이 헤더를 숨기므로 백오프로 대신한다(NERV Task CLE-T-1XDNY3).
 *
 * React Query 의 `refetchInterval` 대신 effect 로 직접 도는 이유:
 *  - 늦게 도착한 응답을 버려야 한다. 이미 WS 이벤트로 앞선 store 를 옛 REST
 *    응답이 덮으면 `running` + 이전 `waiting_for_input` 조합이 대기 UI 를 지운다
 *    (`applyExecutionSnapshot` 의 resume 분기).
 *  - 다시 켜질 때 캐시에 남은 옛 응답을 적용하지 않아야 한다. 같은 이유다.
 *  - 요청이 겹치지 않게 응답을 받은 뒤에 다음 요청을 예약한다.
 *
 * 응답을 버리는 기준과 그 범위:
 *  - effect 가 정리된 뒤 도착한 응답은 버린다(`disposed`). 다만 정리는 React 가 렌더를
 *    마친 뒤 passive effect 를 비울 때 돌므로, store 가 바뀐 시점보다 한 macrotask 늦다.
 *  - 그 사이에 도착한 응답은 적용 직전에 store 를 동기로 읽어 거른다. store 의
 *    `executionId` 가 이 폴링의 것과 다르거나(드로어를 닫아 `reset` 됐거나 새 실행이
 *    시작됨) store 가 이미 끝난 실행이면 응답을 버리고 폴링을 멈춘다.
 *  - 요청을 보낸 뒤 응답이 오기 전에 다른 경로가 store 의 노드 상태 · 노드 결과 · 실행
 *    상태를 바꿨으면 그 응답만 버리고 다음 요청을 예약한다. WS 가 복구돼 스냅샷이나
 *    이벤트가 먼저 들어간 직후(`enabled` 가 꺼지기 전) 도착한 옛 응답이 WS 가 채운
 *    노드 결과를 되돌리지 않게 한다. 사용자가 폼 · 버튼 대기를 이어 가 store 가 바뀐
 *    경우도 같은 이유로 한 번 버린다.
 */
export function useExecutionPollingFallback({
  executionId,
  enabled,
}: UseExecutionPollingFallbackOptions): void {
  const shouldPoll = useExecutionStore(selectShouldPoll);
  const active = enabled && !!executionId && shouldPoll;

  useEffect(() => {
    if (!active || !executionId) return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const poll = async () => {
      // 요청을 보내는 시점의 store. 응답이 올 때까지 다른 경로가 바꿨는지 가른다.
      const sent = useExecutionStore.getState();
      let nextDelayMs: number | null = EXECUTION_POLL_INTERVAL_MS;
      try {
        const execution = await executionsApi.getById(executionId);
        if (disposed) return;
        failures = 0;
        // effect 정리가 아직 돌지 않은 구간의 응답도 여기서 거른다(위 docblock). 정리가 곧
        // 이 폴링을 끝내는 경우가 대부분이지만, 정리가 늦어도 옛 응답이 닫은 드로어를
        // 다시 열거나 새 실행에 섞이지 않게 멈춘다.
        const decision = decidePollResponse(
          sent,
          useExecutionStore.getState(),
          executionId,
        );
        if (decision === "stop") return;
        if (decision === "apply") {
          // 실행 이벤트를 받지 못하므로 AI 대화도 저장된 메시지로 갱신한다(CLE-T-5P1ADY).
          applyExecutionSnapshot(execution, () => disposed, {
            refreshConversation: true,
          });
          // 재시도 턴을 기다리는 중의 `failed` 응답은 아직 끝난 실행이 아니다.
          if (
            isTerminalServerExecutionStatus(execution.status) &&
            !selectAwaitingLastTurnRetry(useExecutionStore.getState())
          ) {
            return;
          }
        }
      } catch (err) {
        if (disposed) return;
        failures += 1;
        const failure = describePollFailure(err);
        nextDelayMs = nextRetryDelayMs(failure, failures);
        if (nextDelayMs === null) {
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
      }
      timer = setTimeout(() => void poll(), nextDelayMs);
    };

    void poll();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, executionId]);
}
