"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getWsClient } from "./ws-client";
import { ensureFreshAccessToken, getAccessToken } from "../api/client";

/**
 * Backend 의 EmbeddingService / GraphExtractionService 가 문서별로 emit 하는 KB 이벤트를
 * `kb:${documentId}` 채널로 구독한다. 어떤 이벤트가 와도 KB 상세 페이지의 React Query
 * 캐시(`kb-documents`, `kb-graph-stats`, `kb-embedding-stats`, `knowledge-base`)를
 * invalidate 해 즉시 새 상태로 갱신한다.
 *
 * 5s polling fallback 은 페이지 useQuery 에 그대로 두어 WS 단절 시에도 progress 가
 * 따라가도록 한다. 둘이 동시에 동작해도 React Query dedup 이 합쳐주므로 안전.
 *
 * 이벤트 종류 (backend WebsocketService.emitExecutionEvent 가 emit):
 *   document:embedding_started / _progress / _completed / _error / _retry / _failed
 *   document:graph_started     / _progress / _completed / _error / _retry / _failed
 *
 * documentIds 배열이 바뀔 때마다 구독을 재계산. (문서 신규 업로드/삭제 시 자동 반영)
 */
export function useKbEvents(
  knowledgeBaseId: string | null,
  documentIds: string[],
): void {
  const queryClient = useQueryClient();
  const lastInvalidateAtRef = useRef<number>(0);
  const channelsRef = useRef<string[]>([]);

  // 1초 throttle — WS 이벤트가 폭발적으로 들어와도 invalidate 빈도를 제한해 네트워크 부하 완화.
  const scheduleInvalidate = () => {
    const now = Date.now();
    if (now - lastInvalidateAtRef.current < 1000) return;
    lastInvalidateAtRef.current = now;
    if (!knowledgeBaseId) return;
    queryClient.invalidateQueries({
      queryKey: ["kb-documents", knowledgeBaseId],
    });
    queryClient.invalidateQueries({
      queryKey: ["kb-graph-stats", knowledgeBaseId],
    });
    queryClient.invalidateQueries({
      queryKey: ["kb-embedding-stats", knowledgeBaseId],
    });
    queryClient.invalidateQueries({
      queryKey: ["knowledge-base", knowledgeBaseId],
    });
  };

  useEffect(() => {
    if (!knowledgeBaseId || documentIds.length === 0) return;

    const ws = getWsClient();
    let cancelled = false;

    // WS handler — KB 채널의 모든 이벤트가 동일한 invalidate 로직을 트리거.
    // 이벤트 이름(`document:*`)이 다양해도 캐시 invalidate 만 하면 useQuery 가 새 데이터를 fetch.
    const handler = (...args: unknown[]) => {
      // socket.io 의 event handler 가 (payload, ack) 형태로 인자 전달. payload 자체는 무시 (invalidate 만).
      void args;
      scheduleInvalidate();
    };

    const KB_EVENT_NAMES = [
      "document:embedding_started",
      "document:embedding_progress",
      "document:embedding_completed",
      "document:embedding_error",
      "document:embedding_retry",
      "document:embedding_failed",
      "document:graph_started",
      "document:graph_progress",
      "document:graph_completed",
      "document:graph_error",
      "document:graph_retry",
      "document:graph_failed",
    ] as const;

    (async () => {
      try {
        // 1) auth: 페이지 진입 시 WS 가 아직 connect 안 됐을 수 있으니 freshen + connect.
        const token = await ensureFreshAccessToken().catch(() =>
          getAccessToken(),
        );
        if (cancelled) return;
        if (token && !ws.isConnected()) {
          ws.connect(token);
          await ws.waitForConnect();
        }
        if (cancelled) return;

        // 2) channel subscribe — 문서마다 별도 채널 (backend `kb:${documentId}` 명명규약)
        const channels = documentIds.map((docId) => `kb:${docId}`);
        channelsRef.current = channels;
        for (const ch of channels) ws.subscribe(ch);

        // 3) event listener — KB 이벤트 12종 모두 동일 handler.
        for (const name of KB_EVENT_NAMES) ws.on(name, handler);
      } catch {
        // best-effort: WS 가 안 붙어도 페이지의 5s polling 으로 fallback.
      }
    })();

    return () => {
      cancelled = true;
      for (const name of KB_EVENT_NAMES) ws.off(name, handler);
      for (const ch of channelsRef.current) ws.unsubscribe(ch);
      channelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeBaseId, documentIds.join(",")]);
}
