/**
 * RAG 검색 결과 타입 — `meta.ragSources` / `meta.turnDebug[]` 의 frontend 표현.
 *
 * `@/lib/conversation/` 에 사는 이유: `conversation-utils.ts` 의
 * `mergeRagRetrievalItems` 가 `TurnRagDelta[]` 를 받는데, 그 타입이
 * `@/components/` 에 있으면 `lib/` → `components/` 레이어 역전이 된다.
 * `conversation-utils.ts` 자체가 같은 이유로 lib 에 사는 것과 동일한 판단
 * (`components/editor/run-results/conversation-utils.ts` 의 re-export 주석 참조).
 * `output-shape.ts` 는 기존 소비처 안정성을 위해 re-export 를 유지한다.
 *
 * 스키마 SoT: spec/5-system/10-graph-rag.md §4.3 · spec/5-system/9-rag-search.md §4.1
 */

export interface RagSource {
  chunkId: string;
  documentId: string;
  documentName: string;
  /** 200자 미리보기 */
  content: string;
  /** 0~1 cosine 유사도 */
  score: number;
  /** graph 모드: 'seed' (vector top-K) 또는 'expanded' (그래프 확장) */
  origin?: "seed" | "expanded";
}

export interface RagDiagnostics {
  attempted: boolean;
  searchedKbCount: number;
  queriesUsed: string[];
  resultCount: number;
  skipReason?: "empty_user_prompt" | "empty_kb_list" | "no_results";
}

/**
 * 한 턴 동안 호출된 KB tool 의 chunk delta + 진단 (References 탭 per-turn delta).
 * (formerly `TurnDebugEntry` — `conversation-utils.ts` 의 canonical-shaped
 * `TurnDebugEntry`(llmCalls/toolCalls/totalDurationMs)와의 동명 충돌 해소를 위해
 * `TurnRagDelta` 로 rename. dev 1b.)
 */
export interface TurnRagDelta {
  turnIndex: number;
  ragSources: RagSource[];
  ragDiagnostics: RagDiagnostics | null;
}
