### 발견사항

없음.

검토 대상 diff(`origin/main` 대비)는 다음 3개 backend 파일만 변경한다:

- `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`
- `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts` (JSDoc 주석 추가만)

변경 내용은 private `emitEvent(event: string, …)` → `emitEvent(event: KbEventType, …)` 로 파라미터 타입을 좁히고 `as` 캐스트를 제거하는 순수 컴파일타임 타입 강화다. `KbEventType` union 멤버(11종 = embedding 6 + graph 5)는 무변경으로 확인했다 (`websocket.service.ts` L347-358). 신규 엔티티·필드·endpoint·요구사항 ID·상태 전이·RBAC·계층 책임 변경이 전혀 없다 — 기존에 이미 정의돼 있던 `KbEventType` 권위 union 을 emit 지점에서도 실제로 강제하도록 만든 것뿐이다.

Cross-Spec 관점에서 점검한 6개 항목 모두 해당 사항 없음을 확인:

1. **데이터 모델 충돌** — 엔티티/필드 변경 없음. `spec/1-data-model.md`(KnowledgeBase/Document/Entity/Relation/ChunkEntity) 와 `spec/5-system/10-graph-rag.md` §2 의 정의는 diff 로 인해 영향받지 않는다.
2. **API 계약 충돌** — REST endpoint 변경 없음 (WebSocket emit 은 endpoint 가 아니며, 이벤트명 집합도 불변).
3. **요구사항 ID 충돌** — 신규 ID 부여 없음.
4. **상태 전이 충돌** — `graph_extraction_status`/`embedding_status` 상태 머신 무변경.
5. **권한·RBAC 충돌** — 해당 없음 (WebSocket emit 경로에 권한 로직 없음, `spec/5-system/1-auth.md` §3 RBAC 매트릭스와 무관).
6. **계층 책임 충돌** — `Embedding/GraphExtractionService` → `WebsocketService.emitKbEvent` 호출 관계·모듈 경계 그대로. 오히려 "문서상 권위 union" 을 emit 지점에서 컴파일타임 강제하는 방향으로 **spec 서술("KB_EVENT_NAMES 가 union 과 1:1")과 코드 실태의 정합성을 강화**한다.

부수 확인: frontend `KB_EVENT_NAMES ↔ backend KbEventType union parity` 테스트(`codebase/frontend/src/lib/websocket/__tests__/use-kb-events.test.ts`)가 이미 11종 parity 를 assert 하고 있으며 이번 diff 로 영향받지 않는다. `spec/5-system/1-auth.md` 는 이번 diff 와 파일 경로상 무관하나 scope 매칭(코드베이스 영역 heuristic)으로 함께 번들된 것으로 보이며, 본 diff 가 인증/세션/RBAC 표면을 전혀 건드리지 않으므로 별도 언급할 충돌도 없다.

### 요약

이번 변경은 `spec_impact: none` 이 선언한 대로 순수 타입 강화 리팩터이며, 신규 계약·엔티티·요구사항·상태·권한 표면을 만들지 않는다. `spec/5-system/1-auth.md`·`10-graph-rag.md` 어느 쪽도 다른 spec 영역(`0-overview.md`, `1-data-model.md`)과 모순되는 신규 서술을 도입하지 않았고, 기존 `KbEventType` union·11종 이벤트 정의는 diff 전후로 동일하다. Cross-Spec 일관성 관점에서 이 diff 는 검토 대상 표면 자체가 존재하지 않는다.

### 위험도
NONE
