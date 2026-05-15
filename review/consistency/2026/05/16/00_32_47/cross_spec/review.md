# Cross-Spec 일관성 검토 — backend/src/modules/knowledge-base/graph

검토 모드: `--impl-prep` (구현 착수 전 / 기존 구현 코드 검토)
대상 경로: `backend/src/modules/knowledge-base/graph`

---

## 발견사항

### 1. **[WARNING]** `document:graph_completed` 페이로드 필드명 불일치 — spec vs 코드

- **target 위치**: `graph-extraction.service.ts` line 218~220, 261~263 (`emitEvent(..., 'document:graph_completed', { entityDelta, relationDelta })`)
- **충돌 대상**: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` 표 — `document:graph_completed` 페이로드를 `{ documentId, entityCount, relationCount }` 로 정의
- **상세**: 코드는 `entityDelta` / `relationDelta` (증분값)를 전송하지만, spec 은 `entityCount` / `relationCount` (누적 전체값)를 정의한다. 두 필드는 **의미가 다르다** — `entityDelta` 는 이번 문서에서 신규 삽입된 행 수이고, `entityCount` 는 KB 전체 누적값이다. frontend 가 spec 기준 필드명으로 구독하면 undefined 를 받는다.
- **제안**: 코드를 spec 에 맞춰 `entityCount` / `relationCount` 로 변경하거나, spec 을 실제 의미에 맞게 `entityDelta` / `relationDelta` 로 수정하고 frontend 동작을 재검토한다. KB 누적값은 `kb:graph_stats_updated` 이벤트(또는 `GET /:id/graph/stats` 폴링)로 전달되므로 delta 분리 설계가 더 일관적일 수 있다.

---

### 2. **[WARNING]** `kb:graph_stats_updated` 이벤트 — spec 미정의, 잘못된 WebSocket 메서드 사용

- **target 위치**: `kb-stats.helper.ts` line 42~46 (`this.websocketService.emitExecutionEvent('kb:${knowledgeBaseId}', 'kb:graph_stats_updated' as never, ...)`)
- **충돌 대상**: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` 표 — `kb:graph_stats_updated` 이벤트가 정의되어 있지 않음. `websocket.service.ts` 의 `KbEventType` 에도 해당 이벤트 타입이 없음
- **상세**: 두 가지 문제가 겹쳐있다.
  1. `emitExecutionEvent()` 는 채널을 `execution:{첫번째인자}` 로 구성하므로, 실제 전송 채널이 `execution:kb:{kbId}` 가 된다. frontend 가 구독하는 채널(`kb:{kbId}`)과 채널명이 불일치한다.
  2. 이벤트 타입 `'kb:graph_stats_updated'` 는 `KbEventType` 에 없어 `as never` 로 강제 캐스팅 중 — 타입 시스템을 우회하고 있으며, spec 에서도 이 이벤트를 정의한 섹션이 없다.
- **제안**: `emitKbEvent(knowledgeBaseId, ...)` 메서드로 교체하고, `KbEventType` 에 `'kb:graph_stats_updated'` 를 추가하며, `spec/5-system/10-graph-rag.md §6` 에 해당 이벤트 정의를 추가한다. 또는 stats 변경을 `document:graph_completed` 페이로드에 포함시켜 별도 이벤트를 제거한다.

---

### 3. **[INFO]** `document:graph_error` 이벤트 — 등록만 되고 미발행

- **target 위치**: `graph-extraction.service.ts` 전체 — `document:graph_error` 를 emit 하는 코드가 없음
- **충돌 대상**: `spec/5-system/10-graph-rag.md §6` — `document:graph_error` 이벤트 정의 있음("in-flight 일시 오류 — `document:graph_retry` 또는 `graph_failed` 가 곧 따라온다"). `websocket.service.ts` `KbEventType` 에도 등록됨
- **상세**: spec 에 의하면 `document:graph_error` 는 일시 오류 시점에 발행되어야 하고, 이후 `graph_retry` 가 따라오는 구조다. 그런데 코드는 일시 오류 시 `document:graph_retry` 만 emit 하고 `document:graph_error` 는 전혀 발행하지 않는다. frontend 가 `graph_error` 를 listen 한다면 수신하지 못한다. spec 문서 자체에서 "(의미 변경, 2026-05-11) in-flight 일시 오류 — `document:graph_retry` 또는 `graph_failed` 가 곧 따라온다. **영구 실패 신호로 사용하지 말 것**" 이라 기술해 의미 개편 이력이 있으나, 발행 여부와 발행하지 않는 것이 의도적인지는 spec 에서 명확히 않다.
- **제안**: spec 을 `document:graph_error` 가 발행되지 않는 현 구현 상태로 갱신하거나(등록 타입 제거 또는 "미발행" 주석 추가), 코드에서 `document:graph_error` 를 재시도 진입 시 emit 하도록 추가한다.

---

### 4. **[INFO]** `spec/5-system/10-graph-rag.md §2.2` Document 추가 컬럼 — `graph_extraction_status` enum 에 `failed` 누락

- **target 위치**: `graph-extraction.service.ts` (DocumentRepository.update 에서 `graphExtractionStatus: 'failed'` 사용)
- **충돌 대상**: `spec/5-system/10-graph-rag.md §2.2 Document 추가 컬럼` — `graph_extraction_status` enum 을 `pending / processing / completed / error` 4종으로만 기술 (spec §6 에러 처리에서는 `failed` 상태 전이를 언급함)
- **상세**: `spec/1-data-model.md §2.12 Document` 는 `embedding_status` / `graph_extraction_status` 모두에 `pending / processing / completed / error / failed` 5종을 명시해 일관성이 있다. 그러나 `spec/5-system/10-graph-rag.md §2.2` 는 `failed` 를 빠뜨리고 있다. spec 내부 불일치이며 코드·data-model spec 은 올바르다.
- **제안**: `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` enum 설명에 `failed` 를 추가해 `spec/1-data-model.md §2.12` 와 동기화한다.

---

## 요약

`backend/src/modules/knowledge-base/graph` 모듈은 전반적으로 `spec/5-system/10-graph-rag.md` 의 핵심 설계(entity/relation dedup UPSERT, hybrid 검색 흐름, retryWithBackoff 정책, KbStatsHelper atomic 갱신)를 충실히 따르고 있다. 다만 WebSocket 이벤트 계층에서 두 가지 실질적 불일치가 발견됐다: (1) `document:graph_completed` 페이로드가 spec 의 `entityCount/relationCount` 대신 `entityDelta/relationDelta` 를 전송하고, (2) `KbStatsHelper.refresh()` 가 `emitKbEvent` 대신 `emitExecutionEvent` 를 잘못 사용해 채널명이 `execution:kb:{id}` 가 되어 frontend 구독 채널과 불일치한다. 이 두 항목은 frontend 실시간 갱신에 영향을 주는 WARNING 수준이며, 구현 착수 전 spec 과의 합의를 권장한다. INFO 항목 두 건은 문서 정비 수준의 동기화로 해소 가능하다.

---

## 위험도

MEDIUM
