# 신규 식별자 충돌 검토 — impl-done (spec/5-system/, PR4 BullMQ stalled 자동 재배달)

## 대상
- 검토 모드: `--impl-done`
- target scope: `spec/5-system/` (payload 상 지정 스코프)
- diff-base: `origin/main`
- 실제 구현 코드 SoT (워킹트리): `/Volumes/project/private/clemvion/.claude/worktrees/exec-intake-pr4-stalled`
- 실제 spec 변경 파일 (git diff 로 확인): `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md` (payload 에 스코프로 포함된 `spec/5-system/` 전체 본문 dump 은 참고 컨텍스트, 실질 diff 는 이 2개 파일)
- 관련 커밋: `dbc541602`(feat PR4 구현) · `80e6ec371`(docs spec 반영)
- 관련 code 변경 파일: `execution-engine.module.ts`, `execution-engine.service.ts`, `queues/execution-run-dlq-monitor.{config,service}.ts`(신규), `queues/execution-run.processor.ts`, `queues/execution-run.queue.ts`, `executions.controller.ts`(신규 test-hook endpoint), `test/execution-stalled-redelivery.e2e-spec.ts`(신규)

## 검토 요약 (사전 판단)

본 target 은 이미 착지한 PR4 구현(`dbc541602`)을 spec 문서에 "Planned/PR4 target" → "구현 완료(2026-07-04)" 로 반영하는 **상태 정합화(status reconciliation)** 커밋이며, 부수적으로 신규 서비스(`ExecutionRunDlqMonitorService`)·신규 ENV(`EXECUTION_RUN_DLQ_*`)·신규 test-hook endpoint(`POST /executions/:id/_test/simulate-execution-run-redelivery`)가 **코드에는 이미 존재**한다. 이전 회차 검토(`review/consistency/2026/07/04/12_40_41/naming_collision.md`, `--spec` 모드)에서 "신규 식별자 없음, 위험도 NONE" 으로 판정된 동일 대상의 후속(--impl-done) 재검증이다.

코드베이스 절대경로 조회로 아래를 확인했다:
- `ExecutionRunDlqMonitorService` / `EXECUTION_RUN_DLQ_MONITOR_CONFIG` / `EXECUTION_RUN_DLQ_ALARM_THRESHOLD` 등 4개 ENV 는 `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.{service,config}.ts` 에 실재.
- `finalizeStalledExhausted`, `redriveStuckExecution`, `recordRunningSegmentStart` 는 `execution-engine.service.ts` 에 실재하며 spec 본문 서술과 시그니처·호출 관계 일치.
- 신규 endpoint `POST /executions/:id/_test/simulate-execution-run-redelivery` 는 기존 `_test/recover-stuck-executions` 와 동일 게이팅 패턴(NODE_ENV==='test' && E2E_TEST_HOOKS==='1' + `@Roles('owner')` + `@ApiExcludeEndpoint()`)의 test-only backdoor.

## 발견사항 (점검 관점별)

### 1. 요구사항 ID 충돌
해당 없음. target 은 신규 요구사항 ID 를 부여하지 않는다 (기존 §7.1/§7.2/§7.5/§9.2/§9.3/Rationale 섹션의 "Planned" 마커를 "구현 완료" 로 flip).

### 2. 엔티티/타입명 충돌
해당 없음. 신규 엔티티·DTO·인터페이스 없음.

### 3. API endpoint 충돌
- **[INFO]** 신규 test-hook endpoint `POST /executions/:id/_test/simulate-execution-run-redelivery` — 기존 `POST /executions/_test/recover-stuck-executions` 와 겹치지 않음(다른 path segment, `:id` prefix 유무로 구분). 두 endpoint 모두 동일 게이팅·`@ApiExcludeEndpoint()`·spec 미문서화(공개 API 표면이 아니라 e2e 전용 backdoor) 패턴을 공유해 명명 컨벤션 일관성 있음.
  - target 신규 식별자: `simulate-execution-run-redelivery` (path), `simulateExecutionRunRedeliveryForTest` (메서드명)
  - 기존 사용처: `codebase/backend/src/modules/executions/executions.controller.ts:212` `_test/recover-stuck-executions` (동일 컨트롤러 내 sibling)
  - 상세: 충돌 아님. 다만 두 test-hook 모두 `spec/` 에 문서화돼 있지 않은데 이는 기존 패턴과 일관되므로(첫 번째도 spec 미기재) 이번 신규 endpoint 만의 결함이 아니라 기존에도 있던 "test-hook 은 spec 밖" 관례.
  - 제안: 변경 불필요.

### 4. 이벤트/메시지명 충돌
해당 없음. BullMQ 큐 이름(`execution-run`, `execution-continuation`)은 기존 재사용, 신규 큐/이벤트명 없음.

### 5. 환경변수·설정키 충돌
- **[INFO]** `EXECUTION_RUN_DLQ_ALARM_THRESHOLD` / `EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS` / `EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS` / `EXECUTION_RUN_DLQ_MONITOR_ENABLED` — 기존 `CONTINUATION_DLQ_*` 4종과 완전히 병렬적인 네임스페이스(`EXECUTION_RUN_` vs `CONTINUATION_`)로, 접두사가 명확히 분리돼 실질 충돌 없음. 코드(`execution-run-dlq-monitor.config.ts:32,34,38,42`)와 대응 서비스가 이미 존재하고 명명도 `ContinuationDlqMonitorService`/`CONTINUATION_DLQ_MONITOR_CONFIG` 패턴을 그대로 미러.
  - target 신규 식별자: 위 4개 ENV 키 (target spec 편집은 이 중 `EXECUTION_RUN_DLQ_ALARM_THRESHOLD` 만 §9.3 큐 카탈로그 표에 inline 언급)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:1151-1154` 의 `CONTINUATION_DLQ_*` 4종 표 (동일 개념의 자매 모니터)
  - 상세: 이름 겹침은 없으나, target 편집은 `EXECUTION_RUN_DLQ_ALARM_THRESHOLD` 하나만 인라인 언급하고 나머지 3개 ENV(`_MONITOR_INTERVAL_MS`/`_ALARM_COOLDOWN_MS`/`_MONITOR_ENABLED`, 코드에 이미 구현됨)는 §9.3 표에 별도 행으로 등재되지 않았다. 이는 "충돌" 이 아니라 문서 완전성(coverage) 갭이며 본 checker 의 6개 관점(충돌) 범위를 벗어나므로 CRITICAL/WARNING 처리하지 않는다.
  - 제안: (참고, 비차단) 후속 spec 편집에서 `CONTINUATION_DLQ_*` 표 옆에 `EXECUTION_RUN_DLQ_*` 4종 표를 나란히 추가해 두 모니터의 대구를 명시하면 좋음 — 명명 충돌 사안 아니므로 이번 target 을 막을 사유는 아님.

### 6. 파일 경로 충돌
해당 없음. target 은 신규 spec 파일을 만들지 않으며, 기존 `spec/5-system/3-error-handling.md` · `spec/5-system/4-execution-engine.md` (및 스코프 밖이지만 동일 커밋에 포함된 `spec/1-data-model.md` · `spec/conventions/error-codes.md` · `spec/data-flow/3-execution.md`) 의 in-place 편집이다. 명명 컨벤션(`N-name.md`) 위반 없음.

## `WORKER_HEARTBEAT_TIMEOUT` 재정의 — 충돌 아님 재확인

동일 문자열이 PR1~PR2("30분 절대 stale 일괄 fail") → PR3("미발동 예약어") → PR4("stalled 재배달 attempts 소진 시 발동")로 의미가 시간에 따라 진화하지만, 이는 **동일 코드가 계획대로 예약 해제되는 것**이지 다른 두 의미가 동시에 활성 상태로 충돌하는 것이 아니다. spec 이 명시적으로 "코드명은 유지·재정의 발효 — rename 은 breaking"이라고 밝혀 의도적 계승임을 못박고 있고(`spec/conventions/error-codes.md:63`), 실제 코드(`execution-engine.service.ts:2754` `finalizeStalledExhausted`)가 이 코드를 정확히 그 의미로 발행함이 확인된다. CRITICAL 기준("동일 식별자가 다른 의미로 이미 사용 중")에 해당하지 않는다.

## 점검 관점별 결론

1. 요구사항 ID 충돌 — 없음
2. 엔티티/타입명 충돌 — 없음
3. API endpoint 충돌 — 없음 (신규 test-hook endpoint 는 기존 패턴과 일관, sibling 과 겹치지 않음)
4. 이벤트/메시지명 충돌 — 없음
5. 환경변수·설정키 충돌 — 없음 (네임스페이스 분리 확인). 문서 completeness 갭 1건은 INFO (비차단)
6. 파일 경로 충돌 — 없음

## 요약

target 은 이미 프로덕션 코드에 착지한 PR4(BullMQ stalled 자동 재배달) 구현을 spec 에 "Planned"→"구현 완료" 로 반영하는 순수 상태 정합화이며, 신규 도입 식별자(`ExecutionRunDlqMonitorService`, `EXECUTION_RUN_DLQ_*` ENV 4종, 신규 test-hook endpoint)는 모두 코드에 실재를 절대경로로 확인했고, 기존 자매 개념(`ContinuationDlqMonitorService`/`CONTINUATION_DLQ_*`, `_test/recover-stuck-executions`)과 네임스페이스·컨벤션이 명확히 분리돼 실질 충돌이 없다. `WORKER_HEARTBEAT_TIMEOUT` 의 의미 재정의도 계획된 예약어 발효이지 이종 의미 충돌이 아니다. CRITICAL/WARNING 없음. INFO 2건(§9.3 DLQ ENV 문서화 완전성 — 충돌 아닌 coverage 권고, test-hook endpoint 명명 일관성 확인)만 기록.

## 위험도
NONE
