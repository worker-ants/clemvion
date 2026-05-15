---
worktree: dead-path-removal-2f1c8a
started: 2026-05-16
owner: developer
decision: option-B (코드 제거, spec 변경 reverse 없음)
---

# KB-level WS 이벤트 dead path 처리

> 작성 배경: `spec-pipeline-consistency-4c9e1f` worktree 의 spec 정합성 정비 (PR 생성 예정) 에서 발견된 코드 측 결함. spec 에서는 해당 이벤트들을 제거했지만, backend 코드는 그대로 남아있어 정리 필요.

## 배경

`backend/src/modules/websocket/websocket.service.ts:131-145` 의 `emitExecutionEvent` 는 첫 인자를 `executionId` 로 받아 채널을 `execution:${executionId}` 로 prefix 한다.

`backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:42-46` 가 이 함수를 다음과 같이 호출:

```ts
this.websocketService.emitExecutionEvent(
  `kb:${knowledgeBaseId}`,
  'kb:graph_stats_updated' as never,
  { knowledgeBaseId, entityCount, relationCount },
);
```

→ 실제 broadcast 되는 채널: `execution:kb:${knowledgeBaseId}`

frontend `useKbEvents` 는 `kb:${documentId}` 채널을 구독하므로 본 이벤트는 도달 불가. `KbEventType` union 에도 없으며 `as never` 강제 캐스트로만 통과.

`spec/data-flow/knowledge-base.md §2.5` 의 `kb:reembed_started/finished`, `kb:reextract_started/finished` 도 코드상 존재 확인되지 않은 동일 카테고리.

## 처리 옵션

옵션 A — **emit 경로 수정**: `emitKbEvent` 에 신규 type 추가 + `kb-stats.helper.ts` 호출을 그쪽으로 전환. spec 도 함께 reverse 해 이벤트를 권위로 다시 명시. KB 단위 통계가 정말 필요한 UX 시나리오가 있을 때 적합.

옵션 B — **코드 제거**: `kb-stats.helper.ts:42-49` 의 broadcast 블록 + `kb:reembed_started/finished` 등 emit 시도가 있다면 함께 제거. spec 은 본 PR 의 정비 상태 그대로 유지. 현재 UX 가 `document:graph_completed` payload 의 `entityCount`/`relationCount` 또는 `GET /:id/graph/stats` 폴링으로 충분히 작동한다면 적합.

## 의사결정 필요

- frontend KB 상세에서 graph 통계 카드가 어떤 경로로 갱신되는지 확인 (`document:graph_completed` 만으로 충분한지)
- `kb:reembed_started/finished` 가 실제 어디서 emit 되는지 grep — 발견 안 되면 옵션 B 로 spec 표기만 정합화로 끝남
- 옵션 A 선택 시 `spec/5-system/6-websocket-protocol.md §4.3` 와 `spec/5-system/8-embedding-pipeline.md §8`, `spec/5-system/10-graph-rag.md §6`, `spec/data-flow/knowledge-base.md §2.5` 를 다시 갱신 필요

## 옵션 결정 (2026-05-16, 사용자)

**옵션 B 선택**: 코드 제거 + spec 변경 reverse 없음.

근거:
- frontend `useKbEvents` 가 12개 `document:*` 이벤트 수신 시 `kb-graph-stats` React Query invalidate → REST `GET /:id/graph/stats` 재조회로 KB 통계 갱신. 본 broadcast 가 도달조차 못 하므로 제거해도 UX 변동 0.
- 옵션 A 가 추가로 주는 가치는 "동시 admin 의 단건 삭제 실시간 반영" 한 가지뿐, 실제 발생 빈도 매우 낮음.
- 옵션 A 는 frontend 까지 신규 채널 구독 추가 필요 — 변경 폭이 dead path 한 줄 제거보다 훨씬 큼.
- `kb:reembed_*` 등 spec 환상은 코드에 emit 지점이 없어 옵션 B 에서 추가 작업 없음.

## 작업 단위 (옵션 B)

- [x] 옵션 결정 — 옵션 B
- [x] consistency-check --impl-prep 통과 (`review/consistency/2026/05/16/00_32_47/SUMMARY.md`, BLOCK: NO)
- [x] `kb-stats.helper.spec.ts` 신규 작성 — refresh() SQL UPDATE 동작 회귀 방지 (TDD)
- [x] `kb-stats.helper.ts` broadcast 블록 (L41-49) 제거 + WebsocketService import/constructor 의존성 정리
- [x] TEST WORKFLOW — lint(0 errors), unit 3507/3507 통과, build OK. [skip-e2e]
- [x] REVIEW WORKFLOW — `/ai-review` 13 reviewer (Critical 0 / Warning 0 / Info 14). PR scope 내 항목 모두 조치. RESOLUTION.md 작성.
- [ ] plan complete/ 이동 + PR 생성

## 후속 (본 PR scope 외, 별도 plan/PR)

- `document:graph_completed` payload 필드명 정합화 (`entityDelta`/`relationDelta` vs spec `entityCount`/`relationCount`) — consistency-check WARNING #1
- `GraphController.listEntities/listRelations` 반환 타입 Swagger 명시 — WARNING #4
- `spec/5-system/10-graph-rag.md §2.2` enum 에 `failed` 추가 (project-planner) — INFO #2
- `document:graph_error` emit 코드 추가 또는 spec 갱신 — INFO #1

## 의존성

- 본 PR (`spec-pipeline-consistency-4c9e1f` → main) 머지 후에 처리 시작.
- 옵션 A 선택 시 본 PR 의 spec 변경 중 `kb:graph_stats_updated` 관련 부분이 reverse 됨.
