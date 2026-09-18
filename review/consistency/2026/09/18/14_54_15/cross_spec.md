# Cross-Spec 일관성 검토 — 그래프 RAG 삭제 연쇄의 FK 인덱스 넷

## 검토 방법

target(`plan/in-progress/spec-draft-graph-fk-indexes.md`)이 고치겠다고 선언한 세 spec 파일(`spec/1-data-model.md`,
`spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md`)의 **현재 본문을 직접 Read** 하여 삽입 앵커 텍스트가
문자 그대로 존재하는지 확인했고, 코드(`entity.entity.ts`·`relation.entity.ts`·`embedding.service.ts`·`graph-query.service.ts`)와
대조해 실측 주장(선두 인덱스 부재, 삭제 코드 경로)을 검증했다. 또한 `spec/conventions/migrations.md`·
`codebase/backend/migrations/README.md`·기존 마이그레이션 파일(V110~V116)·선행 트래커
(`plan/in-progress/spec-draft-nullable-notation-followups.md`)·선례 plan(`plan/complete/spec-draft-deletion-cascade-indexes.md`
부록)과 대조해 새 식별자(V117~V120, 인덱스 이름 넷)의 충돌 여부를 확인했다.

## 발견사항

없음 — CRITICAL·WARNING 없음.

검증한 항목과 결과:

1. **데이터 모델 정합** — `spec/1-data-model.md` §2.12.2 Entity 의 `**인덱스**: (knowledge_base_id, type), (knowledge_base_id, mention_count DESC)`,
   §2.12.3 Relation 의 `**인덱스**: (knowledge_base_id, head_entity_id), (knowledge_base_id, tail_entity_id)` 는 target 이 삽입 앵커로 인용한
   문자열과 완전히 일치했다(라인 437, 455). `codebase/backend/src/modules/knowledge-base/entities/entity.entity.ts`(`@Index('idx_entity_kb_type', …)`,
   `@Index('idx_entity_kb_mention', …)`)와 `relation.entity.ts`(`@Index('idx_relation_kb_head', …)`, `@Index('idx_relation_kb_tail', …)`)도 동일해,
   "기존 인덱스는 전부 `knowledge_base_id` 선두" 라는 target 의 실측 주장이 코드와 맞는다. `last_seen_chunk_id`·`evidence_chunk_id`·`head_entity_id`·
   `tail_entity_id` 를 선두로 하는 인덱스는 현재 존재하지 않는다 — 새로 추가해도 기존 정의와 모순되지 않는다.
2. **§3 인덱스 전략 표 삽입 지점** — target 이 "`LlmUsageLog | (execution_id)` 행 뒤" 라고 지목한 자리가 실제로 §3 표의 마지막 행(라인 957)이며,
   그 위 두 절(«삭제 연쇄의 FK 인덱스 다섯», «Trigger `(workflow_id)` 인덱스», 2026-09-18)이 같은 PR 계열(V111~V116)의 선례로 이미 존재해
   패턴이 일치한다.
3. **문서 내 이중 표기 관행 일치** — `IntegrationUsageLog` 의 §2.10.1 자체 `**인덱스**:` 줄(라인 344)이 기존 선례에서 이미
   `(integration_id, at DESC) — … . (node_execution_id) · (workflow_id) — 부모 삭제의 FK CASCADE 용 (V113 · V114, §3)` 형태로 자기 subsection 과
   §3 표를 동시에 갱신하고 "(Vxxx, §3)" 로 상호 참조한 전례가 있다. target 의 S1(Entity/Relation 자체 `**인덱스**:` 줄에 `(V117, §3)` /
   `(V118~V120, §3)` 부기)·S2(§3 표에 FK 전용 행 추가)가 이 전례와 표기 방식이 일치한다.
4. **`spec/5-system/10-graph-rag.md` 미러** — §2.3 Entity(라인 280-282)·§2.4 Relation(라인 300-302)의 불릿형 "인덱스" 목록이 target 이 인용한
   문자열과 일치했고, `spec/1-data-model.md` 와 동일한 필드·제약을 서술해 두 spec 간 엔티티 정의 모순이 없다.
5. **`spec/data-flow/6-knowledge-base.md` sink 표** — `entity`(라인 258) 행 끝이 `V025 idx_entity_kb_type, idx_entity_kb_mention (mention_count DESC)`,
   `relation`(라인 259) 행 끝이 `V027 (kb, head) / (kb, tail) 인덱스` 로 끝나 target 이 지목한 삽입 지점과 일치한다.
6. **요구사항·식별자 충돌 없음** — `V117`~`V120`, `idx_entity_last_seen_chunk_id`·`idx_relation_evidence_chunk_id`·`idx_relation_head_entity_id`·
   `idx_relation_tail_entity_id` 를 `codebase/`·`spec/`·`plan/` 전수 grep 한 결과 0건이었다. 현재 `codebase/backend/migrations/` 의 최대 V번호는
   116(`V115__…`·`V116__…`)이라 V117~V120 이 `spec/conventions/migrations.md` §2 "단조 증가·gap 금지" 규칙과 맞는 다음 번호다.
7. **트래커 수치 정합** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «32개 남음» 항목이 "다음 후보 — 지식 베이스 연쇄"로
   지목한 네 FK(`entity.last_seen_chunk_id`·`relation.evidence_chunk_id`·`relation.head_entity_id`·`relation.tail_entity_id`)와
   `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록의 "다음 후보(지식 베이스)" 행 넷이 target 이 닫겠다는 네 FK 와 정확히 일치해,
   "32개 → 28개" 갱신 산수가 부록 표(및 §비대상 표의 model_config/user 잔여 항목)와 맞는다.
8. **삭제 코드 경로 실측** — `embedding.service.ts` 의 `chunkRepository.delete({ documentId })`, `graph-query.service.ts` 의
   `entityRepository.remove(entity)` 호출이 target 의 "재임베딩" · "엔티티 하나 삭제" 행과 일치했다.
9. **마이그레이션 구현 계획** — `.conf executeInTransaction=false` + `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS`
   패턴은 `codebase/backend/migrations/README.md` §5·선례 `V112__node_execution_node_id_index.sql`/`.conf` 와 동일하다.
10. **레이어 책임** — `spec/1-data-model.md`(SoT) → `spec/5-system/10-graph-rag.md`(미러) → `spec/data-flow/6-knowledge-base.md`(sink 표) 순
    갱신 순서는 V111(Trigger)·V112~V116(NodeExecution/IntegrationUsageLog/LlmUsageLog) PR 들이 따른 것과 동일한 기존 결정이라 계층 책임 충돌이 없다.

참고로 짚어둘 정도이지 결함은 아닌 점: `spec/1-data-model.md` §3 표는 테이블마다 "전체 인덱스" 를 싣는 경우(예: `IntegrationUsageLog` —
business 인덱스 `(integration_id, at DESC)`·`(at)` 까지 포함)와 "FK-근거 인덱스만" 싣는 경우(예: 이번 target 의 Entity/Relation — 기존
`(knowledge_base_id, …)` 계열은 §3 에 없고 새 FK 인덱스 넷만 들어감)가 혼재한다. 이는 target 이 새로 만드는 비일관이 아니라 §3 표의 기존
서술 관행(예: `DocumentChunk`·`ChunkEntity` 도 §3 에 없음)이며, S1 이 자체 `**인덱스**:` 줄에 전체를 유지하므로 정보 유실은 없다. 수정 불필요.

## 요약

target 은 선행 PR(V111~V116, `plan/complete/spec-draft-deletion-cascade-indexes.md`)이 확립한 "실측 → §1 데이터모델 SoT 갱신 →
§5-system 미러 → data-flow sink 표 미러 → §3 Rationale 신설 → 트래커 반영" 패턴을 그대로 반복하는 기계적 후속 PR 이다. 세 spec 파일의
삽입 앵커 문자열은 실제 파일 내용과 정확히 일치했고, 실측 주장(기존 인덱스 전부 `knowledge_base_id` 선두)은 엔티티 코드와 대조해 사실로
확인됐으며, 새로 도입하는 마이그레이션 번호(V117~V120)와 인덱스 이름 넷은 `codebase/`·`spec/`·`plan/` 전수에서 충돌이 없다. 데이터 모델·
API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 영역 spec 과 모순되는 지점을 찾지 못했다.

## 위험도

NONE
