# Cross-Spec 일관성 검토 결과

**검토 모드**: --impl-done (구현 완료 후)
**Target**: `spec/5-system` (exec-park-durable-resume Plan 반영분)
**비교 대상**: `spec/1-data-model.md`, `spec/0-overview.md`, `spec/conventions/conversation-thread.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

### 1. `RESUME_INCOMPATIBLE_STATE` 발생 조건 — WebSocket 프로토콜 spec 부분 누락

- **[WARNING]** `resume_call_stack` 버전 불일치 시 `RESUME_INCOMPATIBLE_STATE` 발생 조건 미기술
  - target 위치: `spec/5-system/4-execution-engine.md §7.5` — `resume_call_stack.version > CALL_STACK_SCHEMA_VERSION` 시 `RESUME_INCOMPATIBLE_STATE` 로 안전 종결하는 경로가 정의됨
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` 오류 코드 표 (라인 298) — `RESUME_INCOMPATIBLE_STATE` 항목이 "Multi-turn AI 의 `_resumeCheckpoint` 부재·손상·미래 버전" 만 나열하고, exec-park D6 가 추가한 **`resume_call_stack` 미래 버전** 케이스를 언급하지 않음
  - 상세: WS spec 의 `RESUME_INCOMPATIBLE_STATE` 설명이 AI checkpoint 경우만 다루므로, 운영자·FE 개발자가 중첩 sub-workflow park 의 롤링 배포 실패 케이스를 인지하지 못할 수 있음. 두 원인(checkpoint 버전 / call-stack 버전)은 같은 코드로 나오나 원인이 다르다
  - 제안: `spec/5-system/6-websocket-protocol.md` 의 `RESUME_INCOMPATIBLE_STATE` 행에 "(또는 `resume_call_stack.version` 이 `CALL_STACK_SCHEMA_VERSION` 초과인 경우 — exec-park D6, 미구현 중)" 주석 추가

---

### 2. `spec/0-overview.md §2.4 Execution Engine` 설명 — durable park 모델 미반영

- **[INFO]** `spec/0-overview.md §2.4` 의 실행 엔진 설명이 durable park 전환 이전 표현을 그대로 유지
  - target 위치: `spec/5-system/4-execution-engine.md §4.x` — "park 즉시 코루틴 해제 + 모든 재개 = rehydration(slow-path 일원화)" 정책 기술
  - 충돌 대상: `spec/0-overview.md §2.4` — "실행 상태 관리 및 장애 시 복구 (active 세그먼트 stalled-job 재배달; `waiting_for_input` 은 무기한 보존)" 문구가 있으나, Phase B 전환(park = 세그먼트 종료)이나 세 durable 컬럼(conversation_thread/user_variables/resume_call_stack)에 대한 언급 없음. `active 세그먼트 stalled-job 재배달` 설명도 현재 미구현(maxStalledCount:0)인 상태를 반영 안 함
  - 상세: `spec/0-overview.md` 가 아키텍처 개요 문서로서 실행 엔진 설계의 핵심 변경(bounded memory park / durable 영속 / slow-path 일원화)을 기술하지 않아 신규 합류 개발자에게 혼란을 줄 수 있음. 단, `0-overview.md` 는 상세 링크 참조 구조이므로 strict 한 모순은 아님
  - 제안: `spec/0-overview.md §2.4` 에 "park 즉시 해제 + rehydration 단일 경로 (Phase B)" 설명과 3개 durable 컬럼 링크 추가 (동기화 권장 — breaking change 아님)

---

### 3. `spec/1-data-model.md §2.13` Execution 컬럼 표 — `resume_call_stack` 구현 상태 주석 일치

- **[INFO]** `spec/1-data-model.md` 의 `resume_call_stack` 항목이 "설계 확정"으로 기술되었으나, 구현 상태 표기가 실행 엔진 spec 과 교차 확인 필요
  - target 위치: `spec/5-system/4-execution-engine.md §6.2 / §7.5` — V087 컬럼·타입·CALL_STACK_SCHEMA_VERSION 추가됨, park stage 와 재귀 재진입 로직은 PR-B2 미구현
  - 충돌 대상: `spec/1-data-model.md §2.13` 라인 467 — `resume_call_stack` 항목 내 `(V087)` 언급만 있고, "park stage·§7.5 재귀 재진입이 PR-B2 미구현" 이라는 구현 상태 괄호 주석이 없음
  - 상세: 데이터 모델 spec 만 읽는 독자가 `resume_call_stack` 이 이미 완전 동작한다고 오해할 수 있음. 실행 엔진 spec §6.2 에는 명확히 "(구현 상태 2026-06-06: …PR-B2 후속 커밋에서 구현)" 이 있으나 data-model spec 에는 없음
  - 제안: `spec/1-data-model.md §2.13` 의 `resume_call_stack` 항목 끝에 "(V087; park stage·재귀 재진입은 PR-B2 후속 — 현재 컬럼은 `NULL` 유지)" 한 줄 추가 (동기화 권장)

---

### 4. `spec/5-system/4-execution-engine.md` — `D6` 레이블 충돌 위험 명문화 불완전

- **[INFO]** exec-park D6 레이블이 AI 노드 spec 의 D6 과 동명임을 실행 엔진 spec 에서 경고하지만, 해당 AI 노드 spec 에는 반대 방향 경고 없음
  - target 위치: `spec/5-system/4-execution-engine.md §7.5 / §Rationale` — "(레이블: `exec-park-durable-resume` plan 결정 D6 — AI 노드 spec 의 동명 D6 와 무관)" 주의 명시
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` — 해당 문서의 D6 (AI 노드 output 경로 단일화)에는 실행 엔진 spec 의 동명 레이블을 역방향으로 경고하는 문구 없음
  - 상세: 직접 기능 모순은 없으나, 두 D6 간 참조 혼동이 생기면 리뷰·추적 시 오인 가능성 있음
  - 제안: 단방향 경고로 충분히 관리 가능한 수준 — 필요 시 AI 노드 spec 에 역방향 메모 추가

---

### 5. `spec/5-system/6-websocket-protocol.md` — `applyCancellation` async 전환이 WS 프로토콜 계약에 미반영

- **[WARNING]** PR-B1 에서 `applyCancellation` 이 async 로 전환됐으나 WS 프로토콜 취소 응답 사양에 반영 미확인
  - target 위치: `spec/5-system/4-execution-engine.md §7.4` — "취소 경로 (PR-B1): `ContinuationExecutionProcessor` 가 `await applyCancellation(executionId)` 를 호출하며(async 전환 — SPEC-DRIFT W2)" 기술
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.2` — 실행 취소 명령(`execution.cancel`) 의 응답/이벤트 순서에서 form/button park 취소 시 `cancelParkedExecution` → DB 직접 CANCELLED 마킹의 비동기적 특성이 명시되지 않음
  - 상세: WS 취소 흐름이 "동기 ack + 이후 이벤트" 패턴인지 "비동기 처리 후 CANCELLED 이벤트만" 패턴인지 WS 프로토콜 spec 에서 명확하지 않을 수 있음. form/button park 의 경우 in-memory 코루틴이 없어 직접 DB 마킹 후 CANCELLED WS 이벤트 발행하는 경로가 실행 엔진 spec 에는 기술됐으나 WS spec 에는 누락
  - 제안: `spec/5-system/6-websocket-protocol.md` 의 취소 흐름 절에 "park-released(form/button) execution 취소는 DB 직접 CANCELLED 마킹 → `EXECUTION_CANCELLED` WS 이벤트 발행" 주석 추가

---

### 6. `spec/5-system/1-auth.md` — 변경 없음, 충돌 없음

- 인증/인가 spec 과 실행 엔진 durable resume 변경 사이에 데이터 모델·API 계약·상태 전이·RBAC 충돌 없음. 두 영역은 기능적으로 독립적이며 교차 의존성 없음.

---

### 7. `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md` — 변경 없음, 충돌 없음

- Graph RAG 와 MCP Client spec 은 Knowledge Base / AI Agent 도구 계층에 속하며 실행 엔진 park/rehydration 변경과 API 계약·데이터 모델 충돌 없음. Graph RAG 큐(`graph-extraction`)는 `execution-run`/`execution-continuation` 큐와 독립적이며 동일 BullMQ infra 공유에 의한 의미 충돌 없음.

---

## 요약

`spec/5-system` 의 exec-park-durable-resume 변경(Phase A 완료 + PR-B1 완료 + D6 설계 확정)은 `spec/1-data-model.md` 의 Execution 컬럼 정의(`conversation_thread`/`user_variables`/`resume_call_stack` — V084/V085/V087)와 일관되게 동기화되어 있으며, `spec/conventions/conversation-thread.md` 의 durable park 영속 정책과도 상호 정합성이 유지된다. 발견된 이슈는 모두 WARNING 1건·INFO 3건으로, 기능 모순에 해당하지 않는다. WARNING 1건(`RESUME_INCOMPATIBLE_STATE` WS spec 누락)은 운영 디버깅 시 오인 가능성이 있으므로 sync 권장이며, 나머지 INFO 항목은 문서 간 동기화 갱신 수준이다. 인증·그래프 RAG·MCP Client 등 다른 spec 영역과의 직접 모순은 없다.

---

## 위험도

LOW

STATUS: OK
