"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  backgroundRunsApi,
  type BackgroundRunData,
} from "@/lib/api/executions";
import { getWsClient } from "./ws-client";
import { ensureFreshAccessToken, getAccessToken } from "../api/client";

const QUERY_KEY = "background-run";

const BACKGROUND_RUN_EVENT_NAMES = [
  "execution.background_run.started",
  "execution.background_run.completed",
] as const;

/**
 * Background 본문 실행 조회 + WebSocket 실시간 갱신.
 *
 * spec/4-nodes/1-logic/12-background.md §8.5 의 `background:run:<id>` 채널을
 * 구독해 run 수명주기 변화를 받아오며, 이벤트 수신 시 React Query 캐시를
 * invalidate 해 fresh data 로 갱신한다. 본문 안의 NodeExecution 개별 변화는
 * 기존 `execution:<id>` 채널을 받아 main timeline 측에서 처리하고 본 훅은
 * background run 의 집계 상태만 책임진다.
 *
 * 첫 페이지만 fetch — `Load more` UI 는 별도 페이지네이션 hook 으로 확장 가능.
 */
export function useBackgroundRun(
  executionId: string | null,
  backgroundRunId: string | null,
): {
  data: BackgroundRunData | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const queryClient = useQueryClient();

  const queryEnabled = !!(executionId && backgroundRunId);
  const queryKey = [QUERY_KEY, executionId, backgroundRunId] as const;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => backgroundRunsApi.getById(executionId!, backgroundRunId!),
    enabled: queryEnabled,
    // status 가 진행 중일 때 백그라운드 polling 도 함께 — WS 단절 fallback.
    refetchInterval: (query) => {
      const cached = query.state.data as BackgroundRunData | undefined;
      if (!cached) return false;
      return cached.status === "running" || cached.status === "pending"
        ? 5000
        : false;
    },
  });

  useEffect(() => {
    if (!backgroundRunId) return;
    const ws = getWsClient();
    const channel = `background:run:${backgroundRunId}`;
    let cancelled = false;

    // closure 가 stale queryKey 를 잡지 않도록 effect 안에서 재구성. deps 에
    // executionId 가 포함되므로 변경 시 effect 가 재실행되며 새 키로 갱신.
    const handler = () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, executionId, backgroundRunId] as const,
      });
    };

    const ackHandler = (ack: unknown) => {
      if (
        typeof ack === "object" &&
        ack !== null &&
        "success" in ack &&
        (ack as { success: boolean }).success === false
      ) {
        // 권한 거부 / 채널 부재. polling fallback (위 refetchInterval) 이 계속
        // 동작하므로 사용자 영향은 없음 — 진단용 warn 만.
        console.warn("[useBackgroundRun] subscribe rejected:", ack);
      }
    };

    void (async () => {
      try {
        const token = await ensureFreshAccessToken().catch(() =>
          getAccessToken(),
        );
        if (cancelled) return;
        if (token && !ws.isConnected()) {
          ws.connect(token);
          await ws.waitForConnect();
        }
        if (cancelled) return;
        ws.on("subscribed", ackHandler);
        for (const name of BACKGROUND_RUN_EVENT_NAMES) ws.on(name, handler);
        ws.subscribe(channel);
      } catch {
        // best-effort — polling fallback 이 갱신을 담당.
      }
    })();

    return () => {
      cancelled = true;
      for (const name of BACKGROUND_RUN_EVENT_NAMES) ws.off(name, handler);
      ws.off("subscribed", ackHandler);
      ws.unsubscribe(channel);
    };
  }, [backgroundRunId, executionId, queryClient]);

  return { data, isLoading, isError, refetch: () => void refetch() };
}
