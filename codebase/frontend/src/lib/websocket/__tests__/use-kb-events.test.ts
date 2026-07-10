import { describe, it, expect } from "vitest";

import { KB_EVENT_NAMES } from "../use-kb-events";

/**
 * KB_EVENT_NAMES 는 backend `WebsocketService` 의 `KbEventType` union(권위 정의)과 1:1 이어야
 * 한다. 과거 frontend 가 backend 에 없는 `document:graph_error` 를 구독해 count drift(12 vs
 * 11)가 발생했다(#443 에서 backend union 은 graph `_error` 제거). 이 테스트는 그 재발을
 * 감시한다 — 새 KB 이벤트 추가/삭제 시 backend union 과 함께 이 목록도 갱신해야 통과한다.
 */
describe("KB_EVENT_NAMES ↔ backend KbEventType union parity", () => {
  const embedding = KB_EVENT_NAMES.filter((n) =>
    n.startsWith("document:embedding_"),
  );
  const graph = KB_EVENT_NAMES.filter((n) => n.startsWith("document:graph_"));

  it("총 11종 (embedding 6 + graph 5) — union 과 동일 카운트", () => {
    expect(KB_EVENT_NAMES).toHaveLength(11);
    expect(embedding).toHaveLength(6);
    expect(graph).toHaveLength(5);
  });

  it("정확한 이벤트 이름 집합 (권위 union 미러)", () => {
    expect([...KB_EVENT_NAMES]).toEqual([
      "document:embedding_started",
      "document:embedding_progress",
      "document:embedding_completed",
      "document:embedding_error",
      "document:embedding_retry",
      "document:embedding_failed",
      "document:graph_started",
      "document:graph_progress",
      "document:graph_completed",
      "document:graph_retry",
      "document:graph_failed",
    ]);
  });

  it("graph 에는 `_error` 이벤트가 없다 (#443 에서 union 제거 — emit 경로 없음)", () => {
    expect(KB_EVENT_NAMES).not.toContain("document:graph_error");
    expect(graph.some((n) => n.endsWith("_error"))).toBe(false);
  });

  it("embedding `_error` 는 union 선언분이라 구독 유지 (forward-compat, 현재 미emit)", () => {
    // backend union 에 declared 돼 있으므로 구독 목록에도 존재해야 count 가 일치한다.
    expect(KB_EVENT_NAMES).toContain("document:embedding_error");
  });

  it("중복 없는 unique 집합", () => {
    expect(new Set(KB_EVENT_NAMES).size).toBe(KB_EVENT_NAMES.length);
  });
});
