# 요구사항(Requirement) Review — PR4 BullMQ stalled 자동 재배달

- 대상: `exec-intake-pr4-stalled` worktree, PR4(BullMQ stalled-job 자동 재배달 + dead-letter 마감 + DLQ 모니터) 변경분
- 커밋: `dbc541602`(코드) → `80e6ec371`(spec 반영) → `c38ed1bf2`(spec 정합 마무리)
- SoT: `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.5/§9.2/§9.3, `spec/1-data-model.md` §2.13, `spec/5-system/3-error-handling.md` §1.4, `spec/conventions/error-codes.md` §3, `spec/data-flow/3-execution.md` §1.1/§2.2/§3.1/§3.3
- 참조: 이미 두 차례 `/consistency-check`(`--spec` 12:40:41, `--impl-done` 12:57:25) 수행되어 BLOCK:NO 확보. 본 리뷰는 그 결과를 재검증하고 요구사항 충족·엣지케이스·spec fidelity 관점에서 독립적으로 line-level 대조했다.

## 발견사항

없음 (No CRITICAL/WARNING). 아래는 참고용 INFO 두 건.

- **[INFO]** `onFailed`가 모든 job 실패에 대해 무조건 `finalizeStalledExhausted`를 호출 — 조건부 UPDATE(`status='running'`)로만 실제 발동을 분기하는 설계
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:85-95`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2754-2803`
  - 상세: `onFailed`는 job 실패 원인(setup-throw vs stalled 소진)을 구분하지 않고 `executionId`가 있으면 항상 `finalizeStalledExhausted`를 fire-and-forget 호출한다. 실제 분기는 `finalizeStalledExhausted` 내부의 `WHERE status='running'` 조건부 UPDATE(`affected=0`이면 no-op)에 위임된다. JSDoc 주석(`execution-run.processor.ts:60-67`, `execution-engine.service.ts:2748-2752`)이 이 설계를 명시적으로 설명하고 있어 의도와 구현이 일치한다 — 결함 아님, 설계 결정을 기록 차원에서 남긴다.
  - 제안: 조치 불요. 이미 유닛 테스트(`execution-run.processor.spec.ts` "onFailed(job 있음)…", `execution-engine.service.spec.ts` "이미 terminal (affected=0)이면 no-op")가 두 경로 모두 커버한다.

- **[INFO]** `EXECUTION_RUN_DLQ_MONITOR_ENABLED` 미설정 시 기본값이 `enabled: true`
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.config.ts:411-413`
  - 상세: `DISABLED_VALUES`에 매칭되지 않는 모든 문자열(빈 문자열 포함)은 `enabled: true`로 해석된다. `ContinuationDlqMonitorService`와 동일 패턴(대구 확인됨, convention_compliance 검토 항목 4)이라 신규 비일관성은 아니며, "opt-out" 방식(기본 활성)은 관측성 서비스로서 합리적 기본값이다. 결함 아님.
  - 제안: 조치 불요.

## 점검 관점별 확인 결과 (요약)

1. **기능 완전성**: PR4가 스코핑한 3요소(a. `execution-run` 큐 `maxStalledCount:0→1`+`stalledInterval:30s`, b. `runExecutionFromQueue` 3-way switch(PENDING/RUNNING/terminal), c. `onFailed`→`finalizeStalledExhausted` dead-letter 마감, d. DLQ 모니터) 모두 구현·테스트됨. e2e(`execution-stalled-redelivery.e2e-spec.ts`)가 RUNNING 재구동 → frontier 무손실 완료 → 완료 노드 재실행 없음(exactly-once) → `WORKER_HEARTBEAT_TIMEOUT` 오탐 없음까지 종단 검증.
2. **엣지 케이스**: `finalizeStalledExhausted`의 `affected=0`(이미 terminal) no-op 분기, `onFailed(job=undefined)` 조기 return, DLQ config `parsePositiveInt`의 0/음수/비숫자/공학표기(`1e10`) fallback, `checkOnce`의 in-flight(`checking`) 가드·cooldown 창·`getJobCounts` 예외 삼킴(다음 tick 재시도) 모두 유닛 테스트로 커버.
3. **TODO/FIXME**: 신규/변경 파일(processor, queue, dlq-monitor config/service, controller, execution-engine.service.ts 관련 diff hunk) 전체에서 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 함수명(`finalizeStalledExhausted`, `redriveStuckExecution`, `recordRunningSegmentStart`)과 JSDoc, 실제 구현이 모두 일치. `runExecutionFromQueue`의 "(a)/(b)/(c) 세 갈래" 주석이 실제 분기 순서(RUNNING → PENDING 아님 → fall-through)와 정확히 대응.
5. **에러 시나리오**: setup-throw 경로(이미 terminal, `affected=0`)와 stalled 소진 경로(RUNNING 잔류, `affected=1`)가 동일 조건부 UPDATE로 자연 분기 — 이중 마킹·경합 없음. `redriveStuckExecution`은 내부 try/catch로 모든 실패를 `RESUME_*` terminal로 흡수하며 reject하지 않음(detached 호출부와 계약 일치).
6. **데이터 유효성**: DLQ config env 파싱이 비정상 입력(0/음수/비숫자/공학표기)에 대해 안전한 fallback을 가짐. `simulateExecutionRunRedeliveryForTest`는 `ParseUUIDPipe`로 executionId 검증.
7. **비즈니스 로직**: `maxStalledCount:1`의 poison-segment blast-radius bound, `recoverStuckExecutions`가 "은퇴"가 아니라 "backstop 병존"으로 유지되는 결정(코드 `onApplicationBootstrap`에서 여전히 호출됨, `execution-engine.service.ts:735`)이 spec Rationale과 정확히 일치.
8. **반환값**: `finalizeStalledExhausted`(Promise<void>, 모든 경로 명시적 return), `checkOnce`(모든 분기에서 `{failed, delayed, alarmed}` shape 반환, in-flight 시 `skipped:true` 추가 필드) 모두 일관.
9. **spec fidelity**: `spec/5-system/4-execution-engine.md` §7.1(두 트리거 배너)·§7.2(point 2 mid-operation stalled 추가)·§7.5(case B 두 트리거 통합 서술)·§9.2(`exec:run:seq` 계속 미사용 정정)·§9.3(`maxStalledCount:1`, DLQ 모니터 env 4종 명기)이 코드(`EXECUTION_RUN_MAX_STALLED_COUNT=1`, `EXECUTION_RUN_STALLED_INTERVAL_MS=30_000`, 3-way switch, `finalizeStalledExhausted`)와 line-level로 일치. 인접 4개 문서(`1-data-model.md §2.13`, `3-error-handling.md §1.4`, `conventions/error-codes.md §3`, `data-flow/3-execution.md` 여러 곳)도 이번 커밋에서 "PR4 예약/target" → "PR4 구현(2026-07-04)"로 전부 flip되어 spec 트리 자기모순 없음 — 직전 `--spec` 단계 CRITICAL(4개 문서 미전파)이 최종 커밋에서 완전히 해소된 것을 직접 라인 대조로 재확인했다.

## 교차검증 메모 (기존 consistency-check 산출물 대비)

- `review/consistency/2026/07/04/12_40_41/cross_spec.md`의 초기 CRITICAL(4개 문서 미전파)은 `review/consistency/2026/07/04/12_40_41/cross_spec_reverify.md`에서 부분 해소 확인 후, 최종 커밋(`c38ed1bf2`)에서 `data-flow/3-execution.md:204`(§2.2 큐 카탈로그 표) 잔여 WARNING까지 포함해 전부 반영됨을 실제 파일(`spec/data-flow/3-execution.md`)에서 직접 확인했다(§1.1 산문 `maxStalledCount:1`, 인접 §2.2 표까지 갱신 완료 상태로 대조 시점 기준 정합).
- `review/consistency/2026/07/04/12_57_25/SUMMARY.md`(impl-done, BLOCK:NO)의 결론과 본 리뷰의 독립 line-level 대조 결과가 일치한다.

## 요약

PR4 변경분(큐 옵션 상향, 3-way switch, dead-letter 마감, DLQ 모니터, e2e/유닛 테스트, spec 5개 파일 동기화)은 의도한 기능을 완전히 구현하고 있으며, 엣지 케이스(이미 terminal/affected=0, job 핸들 없음, env 비정상 입력, in-flight 겹침)를 빠짐없이 처리한다. `runExecutionFromQueue`의 RUNNING 분기·`finalizeStalledExhausted`의 조건부 terminal 마감·`recoverStuckExecutions` backstop 병존이라는 핵심 설계가 spec §7.1/§7.5 본문과 코드 사이에서 함수 시그니처·조건절·에러 코드까지 line-level로 정확히 일치한다. 두 차례 자동 consistency-check가 이미 CRITICAL을 전부 해소한 상태이며, 본 독립 리뷰에서도 추가 CRITICAL/WARNING을 발견하지 못했다. INFO 2건은 결함이 아니라 기존 설계 결정을 기록하는 참고사항이다.

## 위험도

NONE
