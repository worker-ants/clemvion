## 발견사항

### 발견사항 1
- **[WARNING]** `document:graph_error` — `8-embedding-pipeline.md` 와 `10-graph-rag.md` 간 이벤트 이름 불일치
  - target 신규 식별자: `document:graph_error` (이벤트명)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/8-embedding-pipeline.md:293` — "6개 이벤트가 추가 emit 된다 — `document:graph_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`" 로 `_error` 포함 6개를 능동 이벤트로 기술
  - 상세: `spec/5-system/10-graph-rag.md §6` 은 5개 이벤트만 표에 수록하며 "``document:graph_error` 는 `websocket.service.ts` 의 이벤트 타입 union 에 선언돼 있으나 … emit 하지 않는다 (dead-declared)" 라고 명시한다. 실제 코드 `/Volumes/project/private/clemvion/codebase/backend/src/modules/websocket/websocket.service.ts:312` 의 `KbEventType` union 에도 `document:graph_error` 는 없다. `spec/data-flow/6-knowledge-base.md:289` 도 "`document:graph_error` 는 emit 경로가 없어 union 에서 제거됨 — #443" 라고 확인한다. `8-embedding-pipeline.md` 만 아직 "6개" 라고 기술하며 `_error` 를 능동 이벤트로 오독하게 만든다.
  - 제안: `spec/5-system/8-embedding-pipeline.md:293` 을 "5개 이벤트가 추가 emit 된다 — `document:graph_started`, `_progress`, `_completed`, `_retry`, `_failed`" 로 수정해 SoT(`10-graph-rag.md §6`) 및 코드와 일치시킨다. `_error` 의 dead-declared 사실도 해당 줄에 주석으로 부기하면 독자 혼란을 최소화한다.

### 발견사항 2
- **[INFO]** `GraphTraversalSummary` vs `GraphTraversalService` — 동일 `GraphTraversal` 접두사가 두 의미로 쓰임
  - target 신규 식별자: `GraphTraversalSummary` (`spec/5-system/10-graph-rag.md §4.3`), JSON 필드명 `graphTraversal`
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/graph/graph-traversal.service.ts:18` `GraphTraversalService` — 워크플로 실행 엔진 내 노드 도달성(reachability) 계산 서비스. 동일 접두사를 사용하는 DI 토큰 `graphTraversal` 이 `execution-engine.service.ts`, `retry-turn.service.ts` 에 주입돼 있음
  - 상세: `GraphTraversalSummary` 는 KB RAG 검색의 그래프 확장 요약(seed/확장 청크 수 등)이고, `GraphTraversalService` 는 실행 엔진의 워크플로 DAG 순회 계산 서비스다. 도메인이 다르므로 런타임 충돌은 없다. 코드에서도 `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts:23` 에 "``GraphTraversalSummary` (knowledge-base RAG) 와 의미 분리 — 본 타입은 execution-engine 의 워크플로 graph 재구축 결과만 담는다" 라는 분리 주석이 존재한다. 단, 새 개발자가 두 이름을 혼동할 가능성이 있다.
  - 제안: 현재 코드의 분리 주석으로 충분하지만, `10-graph-rag.md §4.3` 에 "`GraphTraversalSummary` 는 KB RAG 전용 타입이며 execution-engine 의 `GraphTraversalService`(노드 도달성)와 무관하다" 라는 한 줄 disambiguation 을 추가하면 spec 독자에게도 명확해진다.

---

## 요약

`spec/5-system/` 전체를 검토한 결과 심각한 식별자 충돌은 없다. 요구사항 ID(KB-GR-*, NF-GR-*)는 `10-graph-rag.md` 에만 쓰이고, 새 엔티티(`Entity`, `Relation`, `ChunkEntity`)·API endpoint(`/knowledge-bases/:id/entities` 등)·환경변수(`WEBAUTHN_RP_ID` 등)·에러 코드(`WEBAUTHN_DISABLED`, `KB_REEXTRACT_IN_PROGRESS` 등)는 모두 기존 식별자와 충돌하지 않는다. 다만 `8-embedding-pipeline.md:293` 이 `document:graph_error` 를 "6개 이벤트" 중 하나로 나열하는 stale 기술이 SoT(`10-graph-rag.md §6`) 및 코드와 불일치하며, 독자가 해당 이벤트를 능동 이벤트로 오독할 위험이 있다. `GraphTraversalSummary`/`GraphTraversalService` 접두사 중복은 코드 주석이 이미 분리 의도를 명시하고 있어 INFO 수준이다.

## 위험도

LOW
