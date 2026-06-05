# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md` (PR2a — §8 active-running 누적 타임아웃 + `execution-run` 큐 모니터링 등록)
검토 모드: 구현 완료 후 검토 (--impl-done)
검토 일시: 2026-06-04

---

## 발견사항

### [CRITICAL] `spec/5-system/4-execution-engine.md §8` 는 미구현 표기를 유지하나 구현은 완료 상태

- target 위치: `spec/5-system/4-execution-engine.md §8` (924–938 행)
- 충돌 대상: 구현 diff (PR2a — `execution-limits.ts`, `workflow-errors.ts`, `execution-engine.service.ts`, `V073__execution_active_running_ms.sql`)
- 상세: spec §8 첫 블록쿼트가 "본 절의 동시 실행/노드 수/실행 시간/큐 대기 제한은 **목표 정책(aspirational)** 이며 현재 엔진에 enforcement 코드가 없다"고 선언하고, §8 표 `단일 Execution 최대 실행 시간 → Workflow.settings` / 실패 동작 `→ EXECUTION_TIMEOUT 에러` 로 기술한다. 그러나 구현은 이미 완료돼 있다 — `EXECUTION_TIME_LIMIT_EXCEEDED` 코드로 enforce, `Execution.activeRunningMs` 컬럼(V073) 추가, 한도 출처는 `Workflow.settings`가 아닌 env `EXECUTION_MAX_ACTIVE_RUNNING_MS`(시스템 상수). spec 이 "미구현" + "EXECUTION_TIMEOUT 에러" + "Workflow.settings" 로 기술하는 동안 코드가 "구현됨" + "EXECUTION_TIME_LIMIT_EXCEEDED" + "env 상수" 로 동작하면 두 영역이 직접 모순된다.
- 제안: `spec/5-system/4-execution-engine.md §8` 을 갱신한다. (1) 블록쿼트의 "미구현" 표시를 "구현 완료(PR2a)" 로 교체, (2) 에러 코드 `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 로 교정, (3) 한도 출처 `Workflow.settings` → `EXECUTION_MAX_ACTIVE_RUNNING_MS` env (기본 30분, per-workflow 설정은 후속) 으로 교정.

---

### [CRITICAL] `spec/5-system/3-error-handling.md §1.4` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 미등재

- target 위치: `codebase/backend/src/nodes/core/error-codes.ts` (PR2a 추가 코드)
- 충돌 대상: `spec/5-system/3-error-handling.md §1.4 워크플로우 실행 에러` 표
- 상세: §1.4 는 엔진 수준 에러를 열거하는 공식 카탈로그다. `EXECUTION_TIMEOUT` / `RECURSION_DEPTH_EXCEEDED` / `MAX_ITERATIONS_EXCEEDED` 등이 등재되어 있으나 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 없다. 신규 에러 코드가 코드에 추가됐는데 카탈로그에 없으면, chat-channel-adapter spec(`spec/conventions/chat-channel-adapter.md §3.1`) 의 분류 표가 코드에 있는 새 에러를 fallback(`executionFailedInternal`) 으로 처리해야 할지 `executionFailedTimeout` 으로 처리해야 할지 spec 독자가 알 수 없다(구현은 timeout 으로 처리하지만 spec 표는 그것을 기술하지 않는다).
- 제안: `spec/5-system/3-error-handling.md §1.4` 표에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행을 추가한다. 동시에 `spec/conventions/chat-channel-adapter.md §3.1` 분류 표에 `EXECUTION_TIME_LIMIT_EXCEEDED → executionFailedTimeout` 행을 추가한다(구현은 이미 이 분류를 따르고 있음).

---

### [CRITICAL] `spec/1-data-model.md §2.13` Execution 엔티티에 `active_running_ms` 필드 미등재

- target 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` + `migrations/V073__execution_active_running_ms.sql`
- 충돌 대상: `spec/1-data-model.md §2.13 Execution` 필드 표 (duration_ms 등 필드 열거)
- 상세: spec §2.13 Execution 표에는 `duration_ms`(`Integer?`)까지만 정의되어 있고 `active_running_ms`(`INTEGER NOT NULL DEFAULT 0`)가 없다. V073 마이그레이션이 컬럼을 추가했으므로 spec 과 DB 스키마가 직접 모순된다. 데이터 모델 spec 은 다른 검토자(개발자, spec-planner)가 "Execution 엔티티에 어떤 필드가 있는가"를 파악하는 단일 진실이므로 누락 상태는 CRITICAL 이다.
- 제안: `spec/1-data-model.md §2.13` Execution 표에 `active_running_ms | Integer | 누적 active-running 시간(ms). waiting_for_input park 제외. 기본 0. §8 active-running 타임아웃 기준` 행을 추가한다.

---

### [WARNING] `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` 에 `execution-run` 큐 미등재

- target 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (MONITORED_QUEUES 에 `execution-run` 추가), `codebase/backend/test/system-status.e2e-spec.ts` (13개 큐)
- 충돌 대상: `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` (13개 큐 열거, `execution-run` 없음), `spec/5-system/16-system-status-api.md §1 큐 레지스트리` (12개 큐 표, `execution-run` 없음), `spec/data-flow/9-observability.md` ("12개 큐" 리터럴)
- 상세: 코드에 `execution-run` 큐가 MONITORED_QUEUES에 추가돼 E2E 가 13개 큐를 기대하도록 갱신됐다. 그러나 세 개의 spec 파일이 이 큐를 인식하지 못한다. 특히 `9-observability.md` 가 "12개 큐" 를 다이어그램과 본문에 하드코딩한 것이 E2E 사실과 직접 불일치한다. `16-system-status-api.md §1` 표도 `execution-run` 행이 없어 "SoT 는 data-flow §4 카탈로그" 를 선언하면서도 그 SoT 자체가 틀린 상태다.
- 제안: (1) `spec/data-flow/0-overview.md §4` 표에 `execution-run` 행 추가(등록 모듈·Producer·Consumer·작업 단위). (2) `spec/5-system/16-system-status-api.md §1` 표에 `execution-run | execution | 1 (env EXECUTION_RUN_WORKER_CONCURRENCY)` 행 추가. (3) `spec/data-flow/9-observability.md` "12개 큐" 리터럴을 "13개 큐" 로 교정.

---

### [WARNING] `spec/5-system/4-execution-engine.md §9.3 BullMQ 큐 목록` 에 `execution-run` 큐 미등재

- target 위치: `spec/5-system/4-execution-engine.md §9.3`
- 충돌 대상: 구현(`execution-run.queue.ts`, `execution-run.processor.ts`)
- 상세: §9.3 BullMQ 큐 목록 표는 `execution-continuation`·`background-execution` 만 열거한다. `execution-run` intake 큐(PR1 도입으로 추정)는 현재 실제 코드 표에 존재하지만 spec §9.3 에 없다. §9.3 주석도 "일반 노드 실행은 별도 큐 없이 in-process while-loop 에서 직접 dispatch" 라고 적혀 있는데, 이는 `execution-run` 큐 도입 이전의 기술로 현재 구현과 어긋날 수 있다.
- 제안: `spec/5-system/4-execution-engine.md §9.3` 표에 `execution-run` 행을 추가하고 §9.3 주석("일반 노드 실행은 별도 큐 없이...")을 실제 intake 큐 모델을 반영해 갱신한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md §8` 에러 코드·설정 출처 불일치가 `spec/0-overview.md §2.4` Execution Engine 설명과도 충돌

- target 위치: `spec/0-overview.md §2.4` Execution Engine 설명 불릿
- 충돌 대상: PR2a 구현 (`EXECUTION_MAX_ACTIVE_RUNNING_MS` env)
- 상세: `spec/0-overview.md §2.4` 는 `execution-run` intake 큐를 "PR1" 레벨로 이미 기술하고 있으나(`Execution intake 큐` 불릿), `active-running` 누적 타임아웃(PR2a)에 대한 언급은 없다. 또한 §2.4 Rationale 의 Redis 큐 설명(`execution-run` 포함)과 §4 BullMQ 큐 카탈로그의 갭이 생긴다.
- 제안: `spec/0-overview.md §2.4` Execution Engine 항목을 갱신해 PR2a 의 active-running 누적 타임아웃 기능 요약을 추가한다(예: "단일 Execution 의 active-running 누적 타임아웃(기본 30분, waiting_for_input 제외)").

---

### [INFO] `spec/conventions/chat-channel-adapter.md §3.1` 분류 표에 `EXECUTION_TIME_LIMIT_EXCEEDED` 누락 (단독 INFO — CRITICAL #2 와 쌍)

- target 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` (TIMEOUT_CODES 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가)
- 충돌 대상: `spec/conventions/chat-channel-adapter.md §3.1` 카테고리 매핑 표
- 상세: 분류기 코드는 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 `executionFailedTimeout` 으로 분류하도록 갱신됐으나, spec 표의 해당 행(`EXECUTION_TIMEOUT · CODE_TIMEOUT` 행)에 새 코드가 명시되지 않았다. spec 표만 보면 새 코드가 fallback(`executionFailedInternal`) 으로 처리되는 것처럼 읽힌다.
- 제안: CRITICAL #2 의 `spec/conventions/chat-channel-adapter.md §3.1` 표 갱신 시 `EXECUTION_TIMEOUT` · `CODE_TIMEOUT` 행에 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 병기하거나 독립 행으로 추가한다.

---

### [INFO] `spec/1-data-model.md §2.13 Execution.error.code` 어휘 열거에 `EXECUTION_TIME_LIMIT_EXCEEDED` 미기재

- target 위치: `spec/1-data-model.md §2.13 Execution` `error` 필드 설명 괄호
- 충돌 대상: 구현(`EXECUTION_TIME_LIMIT_EXCEEDED` 가 `Execution.error.code` 로 기록됨)
- 상세: §2.13 `error` 필드 설명은 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 이미 괄호 안 열거 목록에 포함하고 있다(`엔진 레벨 누적 active-running 시간 초과 — waiting_for_input 대기 제외, [§8]`). 따라서 이 부분은 이미 기재되어 있어 실제 충돌은 없다. 다만 §8 본문 자체가 "미구현"으로 표시되어 있어 §2.13 설명과 §8 본문 사이에 일관성 부재가 여전히 남는다(CRITICAL #1 의 부산물).
- 제안: CRITICAL #1 의 §8 갱신 후 §2.13 `error` 필드 설명도 `§8` 링크 텍스트를 "(구현됨)" 수식으로 교정한다.

---

## 요약

Cross-Spec 일관성 관점에서 PR2a(active-running 누적 타임아웃) + execution-run 큐 모니터링 등록 구현은 세 가지 CRITICAL 충돌을 야기한다: (1) `spec/5-system/4-execution-engine.md §8` 이 "미구현 aspirational" 표기를 유지하면서 에러 코드명(`EXECUTION_TIMEOUT`)·설정 출처(`Workflow.settings`)도 구현과 다르게 기술, (2) 신규 에러 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 공식 카탈로그(`3-error-handling.md §1.4`)와 분류 표(`chat-channel-adapter.md §3.1`)에 미등재, (3) `Execution` 엔티티에 추가된 `active_running_ms` 컬럼이 데이터 모델 spec(`1-data-model.md §2.13`)에 반영되지 않음. 추가로 WARNING 2건은 `execution-run` 큐가 큐 카탈로그·시스템 상태 API spec·execution engine §9.3 에 모두 없어 "13개 큐" 를 기대하는 코드·E2E 와 불일치하는 점이다. 이 갱신들은 spec→코드 단방향 누락으로, 기존 구현된 다른 영역의 동작에는 영향을 주지 않지만, 이후 spec 을 기준으로 개발하는 작업자가 잘못된 에러 코드·설정 위치·큐 목록·DB 스키마를 참조할 수 있으므로 spec 갱신이 필요하다.

## 위험도

HIGH

---

STATUS: OK
