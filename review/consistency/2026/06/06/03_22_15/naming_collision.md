# 신규 식별자 충돌 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/5-system, diff-base=origin/main)  
검토 일시: 2026-06-06

---

## 발견사항

### 발견사항 없음 — 충돌 식별자 0건

검토 대상 신규 식별자 목록 및 충돌 여부:

**DB 컬럼 (Execution 테이블)**

| 신규 식별자 | 마이그레이션 | 충돌 여부 |
|---|---|---|
| `Execution.conversation_thread JSONB` | V084 | 없음 |
| `Execution.user_variables JSONB` | V085 | 없음 |
| `Execution.resume_call_stack JSONB` | V087 | 없음 |

- `conversation_thread`: `spec/1-data-model.md §2.13` 에 신규 추가, 기존 Execution 컬럼(`status`, `input_data`, `output_data`, `error`, `active_running_ms` 등)과 이름 겹침 없음. `conversation_thread`는 ConversationThread 컨벤션 SoT 에서도 예고한 컬럼명이다(`conversation-thread.md §8.4`).
- `user_variables`: 기존 컬럼명과 겹치는 것 없음. Execution 타임라인의 `variables` 개념과 동일 의미를 갖되 별도 컬럼으로 분리된 것으로, 혼선 소지 없음.
- `resume_call_stack`: 기존 어떤 테이블·컬럼에도 존재하지 않음. `spec/1-data-model.md §2.13` 에 명확히 정의됨.

**상수 (코드 내부)**

| 신규 식별자 | 정의 위치 | 충돌 여부 |
|---|---|---|
| `CHECKPOINT_SCHEMA_VERSION` | `execution-engine.service.ts:284` | 없음 |
| `CALL_STACK_SCHEMA_VERSION` | `shared/execution-resume/resume-call-stack.types.ts:48` | 없음 |
| `PARK_RELEASED` Symbol | `execution-engine.service.ts:270` | 없음 |

- `CHECKPOINT_SCHEMA_VERSION`과 `CALL_STACK_SCHEMA_VERSION`: 서로 다른 파일에 선언된 독립 상수이며 스펙도 명시적으로 "독립(별도 진화)"임을 명기. 이름 패턴은 같지만 각자의 JSONB 구조의 스키마 버전을 지칭하므로 혼동 없음.
- `PARK_RELEASED`: module-scope Symbol로 선언되어 외부 노출 없음. spec에서는 §Rationale 설명문에서만 참조되며 API 경계에 노출되지 않음.

**에러 코드**

| 신규 식별자 | 적용 위치 | 충돌 여부 |
|---|---|---|
| `RESUME_CHECKPOINT_MISSING` | `Execution.error.code` | 없음 |
| `RESUME_FAILED` | `Execution.error.code` | 없음 |
| `RESUME_INCOMPATIBLE_STATE` | `Execution.error.code` | 없음 |

- 세 코드 모두 `UPPER_SNAKE_CASE` 규약 준수. `spec/1-data-model.md §2.13` 및 `spec/5-system/4-execution-engine.md §7.5`에 정의. 기존 `SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`, `EXECUTION_TIME_LIMIT_EXCEEDED` 등 엔진 레벨 에러 코드와 이름 겹침 없음.
- `RESUME_INCOMPATIBLE_STATE`는 `_resumeCheckpoint`(checkpoint 스키마 버전 초과) 케이스와 `resume_call_stack`(call stack 스키마 버전 초과) 케이스 양쪽에서 재사용된다. 이는 의도적 공유(동일 의미 — "재구성 불가, graceful reset")이므로 충돌이 아님.

**내부 메서드명 (코드 내부, spec 서술 참조)**

| 신규 식별자 | 적용 위치 | 충돌 여부 |
|---|---|---|
| `stageDurableResumeSnapshot` | `execution-engine.service.ts:8819` | 없음 |
| `rehydrateUserVariables` | `execution-engine.service.ts:8834` | 없음 |
| `rehydrateConversationThread` | 외부 util 임포트 | 없음 |
| `cancelParkedExecution` | `execution-engine.service.ts:1072` | 없음 |

- spec에서 직접 노출되지 않는 내부 구현 메서드. `stageConversationThreadSnapshot`(구 명칭)은 `stageDurableResumeSnapshot`으로 rename 완료되었으며 구 명칭은 codebase 어디에도 잔존하지 않는다.

**함수 반환 타입 변경**

| 변경 | 이전 | 이후 | 충돌 여부 |
|---|---|---|---|
| `runNodeDispatchLoop` 반환 타입 | `Promise<void>` | `Promise<{ parked: boolean }>` | 없음 |

- 내부 엔진 함수 계약 변경. `parked` 필드명은 spec의 다른 엔티티·DTO·API에서 사용되지 않음.

**WebSocket 이벤트**

본 작업(`exec-park-durable-resume` PR-B1)이 신규 추가한 WebSocket 이벤트는 없음. 기존 `execution.node.cancelled` 이벤트는 `node-cancellation` 인프라에서 이미 정의된 것이며, 본 PR은 이를 활용할 뿐 신규 도입한 것이 아님.

**마이그레이션 버전 번호**

- V084, V085, V086, V087이 순차적으로 실제 파일로 존재하고 중복 없음. V086은 agent_memory 인덱스(별도 도메인)가 선점했고 V087이 `resume_call_stack` 에 배정됨 — 번호 충돌 없음.

---

## 요약

`spec/5-system` 영역이 `exec-park-durable-resume` 작업을 통해 도입한 신규 식별자(DB 컬럼 3종 `conversation_thread`/`user_variables`/`resume_call_stack`, 에러 코드 3종, 내부 상수 2종, 내부 함수 4종)는 기존 식별자와 충돌하지 않는다. 이름 패턴이 유사해 보이는 경우(`CHECKPOINT_SCHEMA_VERSION` vs `CALL_STACK_SCHEMA_VERSION`, `RESUME_INCOMPATIBLE_STATE`의 이중 사용)는 spec에서 의도적 설계로 명기되어 있어 혼선 소지가 없다. 마이그레이션 버전 번호도 순차 무결하다.

---

## 위험도

NONE

STATUS: SUCCESS
