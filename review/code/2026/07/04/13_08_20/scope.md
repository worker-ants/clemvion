# 변경 범위(Scope) Review — exec-intake-pr4-stalled (PR4: BullMQ stalled 자동 재배달)

## 검토 방법
- payload(`_prompts/scope.md`) 전체(38개 파일 항목) 정독 + 일부 truncated diff(e2e spec, spec-update plan)는 워킹트리 원본 파일 직접 확인.
- `git diff origin/main...HEAD --stat` 로 전체 changeset(38 files, code 12 + spec 5 + plan 3 + review artifacts 17 + module 1)을 재확인.
- 사전 계획 문서 `plan/in-progress/exec-intake-queue-impl.md` "PR4 스코핑 확정(2-agent 조사 + 사용자 결정 2026-07-04)" 절과 `plan/in-progress/spec-update-execution-engine-pr4.md` (spec 편집 목록 E1-E13)을 changeset 과 대조해 "의도된 범위" 기준선으로 사용.

## 발견사항

- **[INFO]** review artifacts(consistency-check SUMMARY/checker 산출물 17개) 가 changeset 에 포함됨
  - 위치: `review/consistency/2026/07/04/12_40_41/**`, `review/consistency/2026/07/04/12_57_25/**`
  - 상세: 코드 변경 자체는 아니지만 PR diff 에 포함된 파일 수를 크게 늘린다(38개 중 17개). 다만 이는 CLAUDE.md 규약("일관성 검토 산출물 → `review/consistency/**`" 저장 위치 + `developer` 는 spec 변경 전 `consistency-check --impl-prep`/`--spec` 의무)에 따른 정규 산출물이며, 로그로도 `--spec` 게이트(12:40)와 `--impl-done`(12:57) 두 차례 모두 정상 절차로 실행된 흔적이 확인된다. 스코프 이탈이 아니라 프로세스 준수의 부산물.
  - 제안: 조치 불필요.

- **[INFO]** 동일 PR 안에 코드 구현 + spec 문서 상태 flip(Planned→구현 완료) + plan 문서 갱신이 함께 번들
  - 위치: `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`, `plan/in-progress/exec-intake-queue-impl.md`, `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-c3-context-drift.md`
  - 상세: CLAUDE.md 는 "`spec/` 변경 → project-planner, 구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 을 원칙으로 하지만, 이번 spec 편집은 새로운 요구사항/설계를 추가하는 것이 아니라 **이미 착지한 구현(`dbc541602`)의 "Planned/target" 마커를 "구현 완료" 로 뒤집는 상태 정합화**다. `plan/in-progress/spec-update-execution-engine-pr4.md` 가 이 편집을 사전에 draft 로 작성해 `/consistency-check --spec` 게이트(BLOCK: NO)를 통과시킨 뒤 반영했고, `--impl-done` 재검증도 BLOCK: NO 로 완료됐다. `spec_impact` frontmatter(5파일)와 실제 `git diff --stat` 대상 5파일이 정확히 일치해 범위 이탈이 없다.
  - 제안: 조치 불필요 — 절차(스펙 draft → consistency-check --spec → 구현 → --impl-done)가 규약대로 수행됨.

- **[INFO]** `exec-park-durable-resume.md`, `spec-draft-c3-context-drift.md` 의 PR4 forward-reference 미갱신 (plan_coherence checker 가 WARNING 으로 이미 포착)
  - 위치: `plan/in-progress/exec-park-durable-resume.md` (diff 내 1줄만 수정됨, PR4 완료 반영), `plan/in-progress/spec-draft-c3-context-drift.md` (동일)
  - 상세: 두 파일 모두 이번 changeset 에 포함돼 있고 실제로 PR4 완료 사실을 반영하도록 1줄씩 수정됐다(diff 확인: exec-park-durable-resume.md 1줄, spec-draft-c3-context-drift.md 1줄). 즉 스코프 이탈이 아니라 오히려 정합화 조치이며, consistency-check 재검증 라운드(12:57)에서 지적된 WARNING(다른 인접 plan 문서의 잔여 forward-ref)에 대한 최소 수정. 이 두 건 외 추가로 건드린 무관 plan 파일은 없음.
  - 제안: 조치 불필요.

- **[INFO]** `executions.controller.ts` 에 e2e 전용 test-hook endpoint 추가
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:224-244` (`simulateExecutionRunRedeliveryForTest`)
  - 상세: 신규 프로덕션 API 표면 확장처럼 보일 수 있으나, 기존 `_test/recover-stuck-executions` 와 동일한 이중 게이팅(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` + `@Roles('owner')` + `@ApiExcludeEndpoint()`)을 그대로 재사용한 e2e 전용 backdoor다. `plan/in-progress/exec-intake-queue-impl.md` "PR4 스코핑 확정" §e2e 항목이 "PR3 의 `_test/` 훅 패턴으로 stalled 재배달 시뮬" 을 명시적으로 계획했고, consistency-check convention_compliance checker 도 이 패턴을 "sibling 과 완전 동일 재사용" 으로 확인(위반 0). 기능 확장(over-engineering)이 아니라 계획된 테스트 인프라.
  - 제안: 조치 불필요.

- **[INFO]** `execution-run.processor.ts` 주석 대량 재작성 (docblock 확장)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:20-27`, `:56-68` (class docblock, `onFailed` docblock)
  - 상세: PR1/PR3 시절 서술("PR1 미구현 … PR3/PR4 가 도입")을 PR4 구현 완료 시점 사실로 갱신한 것으로, 실질 코드 변경(`stalledInterval` 추가, `onFailed` 에 `finalizeStalledExhausted` 호출 추가)에 직접 대응하는 필수 주석 갱신이다. 무관한 주석 추가/삭제가 아니라 변경된 동작을 정확히 반영하는 갱신.
  - 제안: 조치 불필요.

- **[INFO]** `execution-run.queue.ts` 상수 주석 전면 재작성
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:80-93`, `:99-114`
  - 상세: `EXECUTION_RUN_MAX_STALLED_COUNT` 값 자체가 `0→1` 로 바뀌는 핵심 변경이라, 그 근거를 설명하던 기존 주석("PR1 은 crash-retry 미도입")이 통째로 stale 해진다. 갱신된 주석은 새 값의 근거(blast radius bound, KB 패턴 참조)를 설명하는 것으로 실질 변경에 종속된 주석 수정이며 무관한 정리가 아니다.
  - 제안: 조치 불필요.

## 위 항목들과 별개로 확인한 사항 (문제 없음)
- 신규 파일(`execution-run-dlq-monitor.config.ts`, `execution-run-dlq-monitor.service.ts`, `execution-run-dlq-monitor.service.spec.ts`, `execution-stalled-redelivery.e2e-spec.ts`)은 모두 plan 의 "설계 §7. execution-run DLQ 모니터"·"e2e" 항목에 1:1 대응하며, 무관한 신규 기능이 아니다.
- `execution-engine.module.ts` 변경은 신규 서비스 2개(`ExecutionRunDlqMonitorService` + config provider) DI 등록뿐이며 다른 provider 재배치·정리는 없다.
- import 변경은 모두 신규 코드가 실제로 사용하는 심볼(`ExecutionRunDlqMonitorService`, `EXECUTION_RUN_DLQ_MONITOR_CONFIG`, `loadExecutionRunDlqMonitorConfig`, `EXECUTION_RUN_STALLED_INTERVAL_MS`)만 추가됐고, 미사용 import 정리나 무관한 재배열은 없음.
- 포맷팅만 바뀐 라인(공백/줄바꿈만 변경)은 발견되지 않음 — 모든 diff hunk 가 의미 있는 코드/문서 변경을 동반.
- `execution-engine.service.ts` 의 기존 `recoverStuckExecutions` JSDoc 갱신(2628-2637 부근)은 PR4 도입으로 그 함수의 역할이 "유일한 복구 경로"에서 "backstop" 으로 바뀐 사실을 정확히 반영하는 필수 갱신 — 무관한 리팩토링이 아님.
- `runExecutionFromQueue` 의 RUNNING 분기 추가(3-way switch)는 plan 설계 §4 "핵심 통합점" 그대로 구현됨.

## 요약
검토한 38개 파일 변경은 사전에 사용자 결정(Q1/Q2)과 함께 `plan/in-progress/exec-intake-queue-impl.md` "PR4 스코핑 확정" 절에 8개 설계 항목으로 명시적으로 계획됐고, 그 계획과 실제 changeset(코드 12·spec 5·plan 3·review 산출물 17·plan 신규 1)이 1:1 대응한다. spec 5개 파일 편집은 새 설계 도입이 아니라 이미 착지한 구현의 "Planned→구현 완료" 상태 정합화이며 `spec_impact` frontmatter 와 실제 diff 대상이 정확히 일치한다. 신규 test-hook endpoint·DLQ 모니터·주석 재작성은 모두 기존 sibling 패턴(`_test/recover-stuck-executions`, `ContinuationDlqMonitorService`)을 그대로 재사용한 계획된 항목이며, 무관한 리팩토링·기능 확장·포맷팅 노이즈·불필요한 임포트/설정 변경은 발견되지 않았다. 인접 plan 문서(`exec-park-durable-resume.md`, `spec-draft-c3-context-drift.md`) 1줄씩의 forward-ref 정정도 이번 PR 산출물(consistency-check 재검증)에서 직접 요구된 최소 동기화였다.

## 위험도
NONE
