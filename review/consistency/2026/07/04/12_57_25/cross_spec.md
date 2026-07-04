# Cross-Spec 일관성 검토 (impl-done) — exec-intake-pr4-stalled

target: `spec/5-system/` (scope), diff-base `origin/main`, 실제 변경 파일 = `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/1-data-model.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md` + 코드(`execution-engine.service.ts`, `execution-run.queue.ts`, `execution-run.processor.ts`, `execution-run-dlq-monitor.*`, `executions.controller.ts`) + `plan/in-progress/exec-intake-queue-impl.md`.

## 검토 배경

이 커밋은 PR4(BullMQ stalled 자동 재배달)를 "Planned/target" 에서 "구현 완료(2026-07-04)" 로 flip 한다. 직전 `--spec` 단계 검토(`review/consistency/2026/07/04/12_40_41/cross_spec.md`)가 CRITICAL 1건("`WORKER_HEARTBEAT_TIMEOUT` PR4 상태 flip 이 4개 문서에 미반영")과 WARNING 1건(`data-flow/3-execution.md §3.3` 트리거 2종 모델 미반영), INFO 1건(`maxStalledCount` 값 동기화)을 지적했다. 이번 impl-done 검토는 (a) 그 지적사항들이 실제로 해소됐는지, (b) 코드가 spec 서술과 일치하는지, (c) 새로 도입된 표면(`WORKER_HEARTBEAT_TIMEOUT` 재정의, `finalizeStalledExhausted`, DLQ 모니터, `_test/simulate-execution-run-redelivery`)가 다른 영역과 충돌하지 않는지를 확인했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 은 발견되지 않았다. 직전 `--spec` 검토의 지적사항은 모두 실제 커밋에서 해소되어 있음을 확인했다:

- `spec/1-data-model.md §2.13` — "PR4 예약/PR3 기간 미발동" → "PR4 구현(2026-07-04)" 로 갱신 확인 (git diff 라인 대조).
- `spec/5-system/3-error-handling.md §1.4` — 동일 갱신 확인.
- `spec/conventions/error-codes.md WORKER_HEARTBEAT_TIMEOUT` 행 — "(PR4 target)" → "(PR4 구현, 2026-07-04)" + "부팅 re-drive 경로는 이 코드를 쓰지 않는다" 로 정정 확인.
- `spec/data-flow/3-execution.md` — §1.1 큐 옵션 서술, §1.4 payload 표, §3.1 상태 다이어그램·에러 표, §3.3 "비정상 종료 회수" 표(3번째 소스 행 "BullMQ stalled 재배달 (PR4 — 운영 중)" 신설, `recoverStuckExecutions` 행은 backstop 으로 재서술) 모두 갱신 확인 — WARNING 항목(3종 모델 미반영)이 정확히 요청된 형태로 해소됨.

코드-spec 정합성 확인 결과:

- `EXECUTION_RUN_MAX_STALLED_COUNT = 1`, `EXECUTION_RUN_STALLED_INTERVAL_MS = 30_000` (`execution-run.queue.ts`) — spec §7.1/§9.3 의 `maxStalledCount:1`/`stalledInterval:30초` 서술과 일치.
- `runExecutionFromQueue` 의 PENDING/RUNNING/terminal 3-way switch (`execution-engine.service.ts:3121-3191`) — spec §7.5 case B "부팅 backstop + 운영 중 stalled 재배달 두 트리거가 동일 재구동 로직으로 진입" 서술과 일치. `recordRunningSegmentStart` + `redriveStuckExecution` 호출 확인.
- `finalizeStalledExhausted` (`execution-engine.service.ts:2754`) — `status='running'` 조건부 UPDATE 로 `failed`+`WORKER_HEARTBEAT_TIMEOUT` 마킹, spec 서술("setup-throw 경로는 이미 terminal → affected=0 no-op")과 일치. `ExecutionRunProcessor.onFailed` 가 이를 호출하는 경로도 확인.
- `spec/*` 전체를 재검색해 `WORKER_HEARTBEAT_TIMEOUT`·`recoverStuckExecutions`·`maxStalledCount`·`stalled 재배달` 참조 파일을 모두 열거했고, 이번 diff 가 다루는 5개 파일 외에는 관련 서술이 없음을 확인(예: `0-overview.md` 는 시점 무관 일반 서술이라 stale 아님). 즉 spec 트리 전체에 "PR4 target/Planned" 잔존 문구가 없다.
- `_test/simulate-execution-run-redelivery` 신규 엔드포인트(`executions.controller.ts`)는 기존 `_test/recover-stuck-executions` 와 동일한 이중 게이팅(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` + `@Roles('owner')`) 패턴을 재사용 — RBAC 매트릭스(`1-auth.md §3.2`)에 등재된 정규 API 표면이 아니므로 매트릭스 갱신 불요, 기존 test-hook 컨벤션과도 충돌 없음.

## INFO (참고용 — 조치 불필요)

- **[INFO]** "PR4" 라벨이 두 개의 무관한 작업 트랙에서 재사용됨
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1/§9.3 의 "PR4 — BullMQ stalled 자동 재배달 (2026-07-04)"
  - 충돌 대상: `spec/2-navigation/6-config.md:286`, `spec/5-system/8-embedding-pipeline.md:162,173,415,417`, `spec/data-flow/6-knowledge-base.md:29,252`, `spec/data-flow/7-llm-usage.md:50` — 이들은 전혀 다른 기능(`unified-model-management` plan 의 `/api/llm-configs`→`/api/model-configs` 통합)의 "PR4"/"PR4b" 를 가리킨다.
  - 상세: 두 "PR4" 는 서로 다른 plan(`exec-intake-queue-impl.md` vs `unified-model-management.md`)에 속한 독립적 PR 넘버링이라 실질 모순은 아니다(각 문맥 내에서 의미가 자기완결적). 다만 spec 전체를 grep 하는 향후 검토자·검색 도구가 "PR4" 를 단일 사건으로 오인할 여지가 있다.
  - 제안: 조치 불필요(과거에도 반복된 넘버링 재사용 패턴). 필요 시 향후 execution-engine PR 넘버링에 접두어(예: "exec-intake PR4")를 붙이는 것을 고려할 수 있으나 이번 변경 범위에서 강제할 사안은 아니다.

## 요약

이번 impl-done 커밋(PR4: BullMQ stalled 자동 재배달)은 직전 `--spec` 단계에서 지적된 4개 문서(`1-data-model.md`, `3-error-handling.md`, `error-codes.md`, `data-flow/3-execution.md`) 동기화 요구사항을 모두 반영했고, `WORKER_HEARTBEAT_TIMEOUT` 에러 코드·`recoverStuckExecutions` backstop 병존·`maxStalledCount` 값·3-way switch 트리거 모델이 spec 전체에서 자기모순 없이 일관되게 서술된다. 코드(`execution-run.queue.ts`, `execution-run.processor.ts`, `execution-engine.service.ts`)를 직접 확인한 결과 spec 서술(값·경로·조건부 UPDATE 의미)과 정확히 일치하며, 신규 test-hook 엔드포인트도 기존 RBAC/게이팅 컨벤션을 그대로 따른다. Cross-Spec 관점에서 CRITICAL/WARNING 은 없다.

## 위험도
NONE
