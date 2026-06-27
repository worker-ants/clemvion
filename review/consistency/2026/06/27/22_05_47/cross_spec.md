# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=107b7617c)
대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
참조 영역: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/`, `spec/conventions/`

---

## 발견사항

### 1. [WARNING] Agent Memory RBAC 가 auth spec §3.2 매트릭스에 누락

- **target 위치**: `spec/5-system/1-auth.md §3` 인가(Authorization) — "플랫폼의 인증·인가·감사 기반의 단일 진실" 선언, §3.2 RBAC 매트릭스
- **충돌 대상**: `spec/5-system/17-agent-memory.md §6` + `spec/2-navigation/16-agent-memory.md §6`
- **상세**: auth spec §3.2 RBAC 매트릭스는 플랫폼 전체 역할 권한의 단일 진실임을 선언한다. 그러나 Agent Memory 리소스가 해당 매트릭스에 행으로 존재하지 않는다. 반면 `17-agent-memory.md`는 "메모리 삭제 API (`DELETE /agent-memories/:id`, `DELETE /agent-memories?scopeKey=`): editor+ 권한"을 정의하고, `16-agent-memory.md`는 "읽기 권한: 화면 진입·조회는 워크스페이스 멤버(viewer+). 삭제 액션은 editor+ (RoleGate)"를 독자적으로 정의한다. 이 권한 정의들이 auth spec 매트릭스에 반영되지 않아 단일 진실 원칙에 위배된다.
- **제안**: auth spec §3.2 RBAC 매트릭스에 `| Agent Memory | CRUD | CRUD | CRUD | R |` 또는 `| Agent Memory (read) | R | R | R | R |` + `| Agent Memory (delete) | D | D | D | — |` 형태로 명시적 행 추가. 혹은 agent memory 접근 규칙을 auth spec에서 포인터로 명시.

---

### 2. [INFO] Entity.type 타입 표기 불일치 (String vs Enum)

- **target 위치**: `spec/5-system/10-graph-rag.md §2.3 Entity` 테이블 — `type | String | entity 타입. P0 enum: person/organization/concept/location/event/other`
- **충돌 대상**: `spec/1-data-model.md §2.12.2 Entity` — `type | Enum | person/organization/concept/location/event/other`
- **상세**: 두 spec 이 동일 Entity.type 컬럼을 서로 다른 타입 명으로 기술한다. graph-rag spec은 "String"이라고 쓰고, data model spec은 "Enum"이라고 쓴다. 실제 DB 구현(`migrations/V025__graph_rag.sql`)은 `TEXT NOT NULL`에 `CONSTRAINT chk_entity_type CHECK (type IN ('person', 'organization', 'concept', 'location', 'event', 'other'))`으로 되어 있어 "CHECK-constrained TEXT"이며 PostgreSQL ENUM 타입이 아니다. 기능적으로는 동일하지만 spec 간 표기 불일치가 독자 혼란을 유발할 수 있다.
- **제안**: 두 spec 중 하나를 일치시킨다. 실제 DB 타입을 따른다면 data model spec의 `Enum`을 `String (CHECK)` 또는 `Enum (TEXT+CHECK)`로 수정하거나, graph-rag spec을 `Enum`으로 맞춘다. 어느 쪽이든 마이그레이션 헤더의 `TEXT` 주석과 일관성을 유지해야 한다.

---

### 3. [INFO] Graph RAG API 엔드포인트에 RBAC 명시 없음

- **target 위치**: `spec/5-system/10-graph-rag.md §5 API` — entity/relation CRUD 및 graph/stats, graph/visualization 엔드포인트 표
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` — Knowledge Base RBAC `| Knowledge Base | CRUD | CRUD | CRUD | R |`
- **상세**: graph-rag spec의 API 섹션(§5.1, §5.2) 엔드포인트 표에는 각 엔드포인트에 대한 역할 제한이 명시되어 있지 않다. Knowledge Base의 서브리소스(entity, relation, chunk_entity)이므로 상위 RBAC(auth spec §3.2: Editor CRUD, Viewer R)를 상속해야 하지만, graph-rag spec이 이를 명시적으로 기술하지 않아 구현자가 RBAC를 추론해야 한다. 특히 `DELETE /api/knowledge-bases/:id/entities/:entityId`(entity 삭제)나 `POST /api/knowledge-bases/:id/re-extract`(전체 재추출)가 Viewer에게 허용되지 않아야 함이 spec에 자명하지 않다.
- **제안**: graph-rag spec §5 API 표에 "권한" 컬럼을 추가하거나, 섹션 도입부에 "Knowledge Base RBAC(auth spec §3.2)를 상속함"을 명시.

---

### 4. [INFO] WebSocket 이벤트 명명 패턴 비대칭 (embedding vs graph)

- **target 위치**: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` — `document:graph_retry`만 emit (in-flight 오류+재시도 신호 겸용)
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §8` — `document:embedding_error` (in-flight 오류 신호) + `document:embedding_retry` (재시도 큐잉 직전) 두 이벤트 분리
- **상세**: 임베딩 파이프라인은 in-flight 일시 오류를 `embedding_error`로 먼저 알리고, 재시도 큐잉 직전에 `embedding_retry`로 추가 신호한다. 그래프 추출은 `graph_retry`만 emit하고 `graph_error`는 dead-declared 상태다. graph-rag spec이 이 비대칭을 명시적으로 기록하고 있어 충돌은 아니지만, 같은 파이프라인 패턴을 따른다고 가정한 클라이언트가 `document:graph_error` 수신을 기대하면 silent 누락이 발생한다. 두 파이프라인의 WS 이벤트 계약이 문서 없이 다르다.
- **제안**: graph-rag spec §6의 dead-declared 주석이 이미 명시되어 있으나, embedding pipeline spec에도 대칭 이벤트 유무 차이를 크로스 참조하거나, 향후 graph 파이프라인에서도 `graph_error`를 실제 emit하도록 구현을 맞추는 방향을 고려.

---

## 요약

`spec/5-system/` 영역(1-auth.md, 10-graph-rag.md)의 cross-spec 일관성을 검토한 결과, CRITICAL 수준의 직접 모순은 발견되지 않았다. 가장 중요한 발견은 auth spec §3.2 RBAC 매트릭스가 "플랫폼 권한의 단일 진실"임을 선언하지만 Agent Memory 리소스를 누락하고 있다는 점(WARNING)이다. 해당 권한 규칙은 현재 `17-agent-memory.md`와 `16-agent-memory.md`에 분산 정의되어 있어 단일 진실 원칙에서 벗어나 있다. 나머지는 Entity.type 타입 명칭 불일치(String vs Enum, 동일 DB 타입을 다르게 표기), graph-rag API 엔드포인트의 RBAC 명시 누락, embedding/graph WS 이벤트 패턴 비대칭 등 INFO 수준의 동기화 권장 사항이다. 데이터 모델(Entity, Relation, ChunkEntity, KnowledgeBase 추가 컬럼)은 두 spec 간 필드·제약조건·인덱스가 일치하며, 감사 액션 명명(audit-actions.md와의 정합)·세션 정책·JWT 구조·초대 플로우 등 주요 도메인 규칙은 인접 spec들과 모순 없이 일관된다.

## 위험도

LOW
