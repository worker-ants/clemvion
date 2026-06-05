# 요구사항(Requirement) Review — PR2a active-running 누적 타임아웃

## 발견사항

### **[WARNING] [SPEC-DRIFT] 엔진 레벨 실행 시간 초과 에러 코드가 spec §8 과 다름**
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` (신규 항목), `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
- 상세: spec §8 line 937 은 최대 실행 시간 초과 에러를 `EXECUTION_TIMEOUT` 으로 기재한다. 코드는 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 신설한다. 이 불일치는 코드가 틀린 것이 아니라 **spec 이 낡은** SPEC-DRIFT 케이스다. 이유:
  1. `EXECUTION_TIMEOUT` 은 이미 Code 노드 스크립트 타임아웃으로 `code.handler.ts` 에서 사용 중이며 `ErrorCode` enum 에 등재도 되어 있지 않다(레거시 문자열 리터럴로만 존재). 재사용 시 `execution-failure-classifier.ts` 에서 분류 충돌 발생.
  2. spec §3-error-handling §1.4 의 `EXECUTION_TIMEOUT` 설명("워크플로우 또는 노드 실행 타임아웃")은 두 가지를 혼동하고 있고, `spec/4-nodes/5-data/2-code.md` 에서도 `EXECUTION_TIMEOUT` 은 Code 노드 전용으로 사용된다.
  3. 구현이 별도 코드를 사용함으로써 사용자 대면 분류기(`execution-failure-classifier.ts`)에서 명시적 분기가 가능해졌다.
  4. consistency-check W5 가 이미 "명시적 분기 처리 필수" 권고로 인지·등재했으며, PR2a 코드가 이를 이미 구현.
- 제안: 코드 유지. spec 갱신 필요 — `spec/5-system/4-execution-engine.md §8` line 937 의 `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 로 교체; `spec/5-system/3-error-handling.md §1.4` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가 및 `EXECUTION_TIMEOUT` 이 엔진 레벨이 아닌 Code 노드 스크립트 타임아웃임을 명시. `spec/conventions/chat-channel-adapter.md §3.1` 분류 표에 `EXECUTION_TIME_LIMIT_EXCEEDED | executionFailedTimeout` 행 추가.

---

### **[WARNING] [SPEC-DRIFT] spec §8 의 "최대 실행 시간" 측정 기준이 wall-clock 이지만 구현은 active-running 누적(waiting_for_input 제외)**
- 위치: `spec/5-system/4-execution-engine.md §8`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/migrations/V073__execution_active_running_ms.sql`
- 상세: spec §8 의 `단일 Execution 최대 실행 시간 | 30분` 은 측정 기준을 명시하지 않는다(암묵적 wall-clock). 구현은 `waiting_for_input` park 시간을 제외한 active-running 누적 시간으로 측정한다. 이는 합리적이고 의도적인 설계 개선이다 — `waiting_for_input` 으로 며칠을 기다리는 정상 워크플로를 timeout 으로 종결시키는 것은 올바르지 않다. plan `exec-intake-queue-impl.md` 의 PR2a 설명에도 이 불변식이 명시되어 있다.
- 제안: 코드 유지. spec 갱신 필요 — `spec/5-system/4-execution-engine.md §8` 의 "단일 Execution 최대 실행 시간" 행에 "(active-running 누적 시간 기준; waiting_for_input park 시간 제외)" 보충 설명 추가.

---

### **[WARNING] [SPEC-DRIFT] spec §8 의 한도 출처가 `Workflow.settings` 이지만 구현은 env 전역 상수**
- 위치: `spec/5-system/4-execution-engine.md §8`, `codebase/backend/src/modules/execution-engine/execution-limits.ts`
- 상세: spec §8 의 표에서 "단일 Execution 최대 실행 시간" 의 설정 위치가 `Workflow.settings` 이다. 코드는 `execution-limits.ts` 의 JSDoc 에 "spec §8 은 한도 출처를 `Workflow.settings` 로 두지만, 그 설정 필드는 아직 미존재 — PR2a 는 시스템 기본 상수(env override) 로 enforce 하고 per-workflow 설정은 후속(Q1=A, 2026-06-04 사용자 승인)" 이라고 명시하며, plan PR2a 설명에도 동일하게 기술되어 있다. 의도적 단계적 구현이다.
- 제안: 코드 유지. spec 갱신 필요 — `spec/5-system/4-execution-engine.md §8` 표의 해당 행을 "(1단계) env `EXECUTION_MAX_ACTIVE_RUNNING_MS`(기본 30분); per-workflow 설정(Workflow.settings)은 후속" 으로 갱신.

---

### **[INFO] e2e 테스트 설명 문자열이 큐 수 변경을 반영하지 않음**
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` line 81
- 상세: `it('인증 시 12개 큐의 집계 상태를 반환한다', ...)` 라고 기술되어 있으나 `execution-run` 큐 추가로 실제 큐는 13개가 되었다. 테스트 로직 자체(`EXPECTED_QUEUE_NAMES` 배열과 `names.toEqual` 비교)는 정확히 13개를 기대하므로 기능 오류가 아닌 설명 문자열만의 stale.
- 제안: 설명 문자열을 "13개 큐" 로 수정.

---

### **[INFO] 단일 세그먼트가 한도를 초과하는 케이스의 보장 수준**
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `assertActiveTimeWithinLimit`
- 상세: plan 에 "단일 세그먼트 초과는 job 타임아웃 보강"이 언급되어 있으나, 해당 BullMQ job 타임아웃 설정이 이 PR 에 포함되어 있지 않다. `assertActiveTimeWithinLimit` 는 노드 사이마다(dispatch loop) 호출되므로 노드 실행 중(executor 내부) 지속되는 단일 장수 작업은 loop 체크가 도달하지 않아 초과를 즉각 잡지 못한다. 기능 누락이 아니라 "노드 내부 작업 시간" 은 이 PR의 범위 밖이며 plan 에 명시적으로 후속으로 남겨져 있다. INFO 수준.
- 제안: 현재 구현 범위 내 동작으로 수용. BullMQ job timeout 보강은 후속 PR에서 처리.

---

## 요약

PR2a 의 핵심 요구사항(엔진 레벨 active-running 누적 타임아웃, `waiting_for_input` park 제외, `EXECUTION_TIME_LIMIT_EXCEEDED` 로 종결, DB 컬럼 영속, env 기본값 30분/0=무제한/비정수 fallback, 세그먼트 추적의 in-memory Map, execution-run 큐의 MONITORED_QUEUES 등록, EIA classifier 에 신규 코드 추가)은 모두 완전히 구현되었다. spec §8 과의 불일치 3건(에러 코드명, wall-clock vs active-running, Workflow.settings vs env 상수)은 모두 코드가 spec 의 aspirational 명세보다 합리적으로 개선된 SPEC-DRIFT 이며 코드 버그가 아니다 — spec 갱신이 필요한 항목들이다. 기능 완전성·엣지 케이스·에러 시나리오 처리 모두 적절히 구현되었고, 단위·e2e 테스트도 핵심 동작을 커버하고 있다. e2e 테스트 설명 문자열의 "12개 큐" stale 과 단일 장수 노드 내부 timeout 미보강은 각각 INFO 수준으로 기능 결함이 아니다.

## 위험도

LOW
