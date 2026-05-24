# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 착수 전 검토 (`--impl-prep`, scope=`spec/5-system/`)
**검토 일자**: 2026-05-25
**Target**: `spec/5-system/` 전체 (인증·실행 엔진·WebSocket·에러 처리·그래프 RAG·MCP Client 등)

---

## 발견사항

### [INFO] `spec/5-system/4-execution-engine.md §9.3` — `task-queue` 행 이미 삭제 완료

- **target 위치**: `spec/5-system/4-execution-engine.md §9.3` 큐 목록 표
- **충돌 대상**: 없음 (해소됨)
- **상세**: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 의 변경 1 에서 제기한 `task-queue` placeholder 행은 현재 spec 에 이미 존재하지 않는다. §9.3 표는 `execution-continuation` / `background-execution` 두 행만 남아있고, §9.3 표 아래 각주에 "옛 `task-queue` 행은 검증 결과 미존재로 확정·삭제됨"이 명시되어 있다. §11 Graceful Shutdown 항목 2의 문구도 `execution-continuation` / `background-execution` 두 큐만 언급한다.
- **제안**: 추가 조치 불필요. `spec-update-workflow-resumable-execution-phase2-followup.md` 변경 1 항목은 이미 반영된 상태이다.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.5.1` — `INVALID_EXECUTION_STATE` 정의 이미 신설됨

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5.1`
- **충돌 대상**: 없음 (해소됨)
- **상세**: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 의 변경 2.1 이 제안한 §7.5.1 sub-section 은 현재 spec 에 이미 존재한다. `spec/5-system/3-error-handling.md §1.3` 의 `INVALID_STATE` 행에도 `> WS commands 에서는 동일 의미를 INVALID_EXECUTION_STATE 코드로 표기 …` 역방향 cross-link 가 추가되어 있다. `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표도 `INVALID_EXECUTION_STATE` 행에 WS 전용 코드임을 명시하고 §7.5.1 cross-link 를 포함한다.
- **제안**: 추가 조치 불필요. `spec-update-workflow-resumable-execution-phase2-followup.md` 변경 2.1 / 2.2 항목은 이미 반영된 상태이다.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.5.1` — 구현 gap 주석 (변경 2.3)

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5.1` 마지막 주석 블록
- **충돌 대상**: 없음 (의도적 gap 주석)
- **상세**: 현재 backend 가 `resolveWaitingNodeExecutionId` invalid lookup 을 `__no_node_exec__` sentinel publish 로 우회 처리하여 `RESUME_CHECKPOINT_MISSING` 으로 최종 surface 하는 사실이 spec 본문에 "구현 상태 (Phase 2 cont 시점)" 주석으로 명시되어 있다. 이는 spec-impl 간 의도된 gap 이며, `spec-update-workflow-resumable-execution-phase2-followup.md` 변경 2.3 이 별도 후속 PR 로 분리 권고되어 있다. 따라서 spec 본문과 구현 사이의 편차가 문서화됐고 reader 가 인지 가능하다.
- **제안**: 별도 후속 PR (변경 2.3) 에서 처리. 본 검토 대상 spec 범위 내에서는 cross-spec 충돌 없음.

---

### [INFO] `spec/5-system/6-websocket-protocol.md §4.2` ↔ `spec/5-system/3-error-handling.md §1.3` — `INVALID_EXECUTION_STATE` vs `INVALID_STATE` 의도적 분리 일관됨

- **target 위치**: `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표 / `spec/5-system/4-execution-engine.md §7.5.1` / `spec/5-system/3-error-handling.md §1.3`
- **충돌 대상**: 없음 (의도적 분리, 세 파일 간 일관됨)
- **상세**: WS ack 경로는 `INVALID_EXECUTION_STATE`, REST 422 경로는 `INVALID_STATE` 로 이름을 분리하는 결정이 세 파일 모두에서 일관되게 기술되고 서로를 cross-link 한다. data-flow/3-execution.md §1.3 시퀀스 다이어그램도 `INVALID_EXECUTION_STATE (동기 ack)` 로 표기하여 정합하다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/5-system/4-execution-engine.md` ↔ `spec/1-data-model.md §2.13` — `RESUME_*` / `SERVER_INTERRUPTED` / `WORKER_HEARTBEAT_TIMEOUT` 코드 일관됨

- **target 위치**: `spec/5-system/4-execution-engine.md §7.5`, §11
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution.error` 필드 설명
- **상세**: 데이터 모델의 `Execution.error.code` 어휘 노트에 `SERVER_INTERRUPTED` / `WORKER_HEARTBEAT_TIMEOUT` / `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` 5종이 등재되어 있고, 이들은 실행 엔진 spec 의 §7.4~§7.5, §11 에서 정의된 코드와 완전히 일치한다. 교차 일관성 이상 없음.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/5-system/4-execution-engine.md` ↔ `spec/data-flow/0-overview.md` ↔ `spec/data-flow/3-execution.md` — `execution-continuation` BullMQ 큐 전환 일관됨

- **target 위치**: `spec/5-system/4-execution-engine.md §7.4`, §9.3, §Rationale
- **충돌 대상**: `spec/data-flow/0-overview.md §4 큐 카탈로그`, `spec/data-flow/3-execution.md §2.2/§2.3 Redis 표`
- **상세**: 옛 Redis pub/sub `execution:continuation` 채널에서 BullMQ 영속 큐 `execution-continuation` 으로의 전환이 data-flow 두 파일 모두에서 일관되게 "폐기됨" 으로 기술되고 BullMQ 큐로 교체된 사실이 cross-link 와 함께 명시되어 있다. 실행 엔진 spec 의 §9.3 표, §Rationale 과 data-flow 쪽 설명이 일치한다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/5-system/4-execution-engine.md §1.1` ↔ `spec/1-data-model.md §2.13` — Execution 상태 전이 일관됨

- **target 위치**: `spec/5-system/4-execution-engine.md §1.1 Execution 상태 머신`
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution.status` Enum
- **상세**: 데이터 모델에 `pending / running / completed / failed / cancelled / waiting_for_input` 6개 상태가 등재되어 있고, 실행 엔진 spec 의 상태 전이 다이어그램 및 허용 전이 표와 완전히 일치한다. `waiting_for_input → failed` 전이 (AI Agent multi-turn LLM throw) 및 `waiting_for_input → waiting_for_input` (rehydration self-loop) 도 양쪽에서 동일하게 기술된다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/5-system/1-auth.md §1.4.H` — WebAuthn 모듈 분리 결정 ↔ `spec/1-data-model.md §2.21` 일관됨

- **target 위치**: `spec/5-system/1-auth.md §1.4.H`
- **충돌 대상**: `spec/1-data-model.md §2.21 WebAuthnCredential`
- **상세**: 인증 spec 의 `WebAuthnCredential` 엔티티 정의와 데이터 모델의 §2.21 정의가 동일한 필드 집합 (id, user_id, credential_id, public_key, counter, transports, aaguid, device_name, last_used_at, created_at) 과 동일한 제약조건 (counter 역행 시 credential row 즉시 삭제, `suspend` 컬럼 도입 금지) 을 기술한다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/5-system/10-graph-rag.md §2.1~§2.5` ↔ `spec/1-data-model.md §2.11~§2.12.4` — Graph RAG 데이터 모델 일관됨

- **target 위치**: `spec/5-system/10-graph-rag.md §2 데이터 모델`
- **충돌 대상**: `spec/1-data-model.md §2.11 KnowledgeBase`, §2.12 Document, §2.12.2 Entity, §2.12.3 Relation, §2.12.4 ChunkEntity
- **상세**: 두 문서에서 KnowledgeBase (`rag_mode`, `extraction_llm_config_id`, `max_hops`, `vector_seed_top_k`, `expanded_chunk_limit`, `entity_count`, `relation_count`, `reextract_status`), Entity (`UNIQUE(knowledge_base_id, name, type)`), Relation (`UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`), ChunkEntity (`PRIMARY KEY(chunk_id, entity_id)`) 의 필드·제약조건이 완전히 일치한다. 데이터 모델 쪽에 추가로 `reextract_status` 컬럼이 있으며 graph-rag spec §7 에서도 `KB_REEXTRACT_IN_PROGRESS` 잠금으로 그 용도가 설명되어 있어 정합하다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/5-system/11-mcp-client.md §3.1` ↔ `spec/1-data-model.md §2.10 Integration` — `service_type='mcp'` 및 `auth_type` 일관됨

- **target 위치**: `spec/5-system/11-mcp-client.md §3.1~§3.2`
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration` — `service_type`, `auth_type`, `scope` 필드
- **상세**: MCP client spec 의 `service_type='mcp'`, `auth_type ∈ {bearer_token, api_key, none}`, `scope=organization` 이 데이터 모델 §2.10 에서 `auth_type Enum` 에 포함된 값들이고, `service_type String` 컬럼 설명에서도 `mcp` 를 명시적으로 예시하고 있다. Internal Bridge `cafe24` 도 동일하게 양쪽에서 기술된다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` ↔ `spec/1-data-model.md §2.3 WorkspaceMember.role` 일관됨

- **target 위치**: `spec/5-system/1-auth.md §3 Authorization`
- **충돌 대상**: `spec/1-data-model.md §2.3 WorkspaceMember.role` Enum
- **상세**: 인증/인가 spec 의 역할 정의 (Owner / Admin / Editor / Viewer) 와 데이터 모델의 `role Enum (owner / admin / editor / viewer)` 이 일치한다. 대소문자 표기 차이 (인가 spec 은 타이틀케이스, 데이터 모델은 소문자) 는 스펙 서술체 vs DB 값 표기의 정상 관행이다.
- **제안**: 추가 조치 불필요.

---

### [WARNING] `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` — 반영 상태 추적 불일치

- **target 위치**: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 변경 1 / 변경 2.1 / 변경 2.2
- **충돌 대상**: `spec/5-system/4-execution-engine.md §9.3`, §7.5.1; `spec/5-system/6-websocket-protocol.md §4.2`; `spec/5-system/3-error-handling.md §1.3`
- **상세**: plan 파일이 아직 `plan/in-progress/` 에 있고 완료로 표시되지 않았다. 그런데 plan 이 제안하는 변경 1 (task-queue 삭제), 변경 2.1 (§7.5.1 신설), 변경 2.2 (§4.2 주석 추가) 가 실제 spec 파일에는 이미 반영되어 있다. plan 파일의 상태가 실제 spec 상태를 반영하지 않아 reader 에게 혼동을 줄 수 있다. 변경 2.3 (구현 후행 작업) 은 아직 미완료이므로 plan 자체를 complete 로 이동할 수는 없으나, 현재 완료된 항목에 대한 status 표시가 없다.
- **제안**: plan 파일의 변경 1 / 변경 2.1 / 변경 2.2 항목에 "완료" 체크를 추가하거나, 미완료 항목 (변경 2.3) 만 남긴 별도 후속 plan 으로 분리하는 것이 권장된다.

---

## 요약

`spec/5-system/` 전체에 걸쳐 데이터 모델 충돌, API 계약 충돌, 상태 전이 충돌, RBAC 충돌은 발견되지 않았다. 실행 엔진의 핵심 변경 (BullMQ `execution-continuation` 큐 전환, `task-queue` 삭제, `INVALID_EXECUTION_STATE` 정의 신설, `INVALID_STATE` 와의 의도적 이름 분리) 이 `spec/1-data-model.md`, `spec/data-flow/0-overview.md`, `spec/data-flow/3-execution.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/3-error-handling.md` 전반에 걸쳐 일관되게 기술되어 있다. Graph RAG 및 MCP Client 의 데이터 모델도 `spec/1-data-model.md` 와 정합된다. 유일한 주의 사항은 `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 의 완료 항목들이 plan 파일 내에 반영 상태로 표시되지 않아 발생하는 추적 불일치이며, 이는 spec 충돌이 아니라 plan 관리 상의 INFO/WARNING 수준 이슈이다.

---

## 위험도

LOW

---

STATUS: OK
