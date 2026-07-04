# Rationale 연속성 검토 — exec-intake-pr4-stalled (--impl-done, scope=spec/5-system/)

## 메타

- diff-base: `origin/main`
- target 워킹트리: `/Volumes/project/private/clemvion/.claude/worktrees/exec-intake-pr4-stalled`
- 실제 diff 대상: `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/1-data-model.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md` + 코드(`execution-engine.service.ts`, `queues/execution-run*.ts`, `executions.controller.ts`) + `plan/in-progress/exec-intake-queue-impl.md`, `plan/in-progress/spec-update-execution-engine-pr4.md`
- 주제: PR4 — `execution-run` BullMQ 큐에 stalled-job 자동 재배달(`maxStalledCount:1`, `stalledInterval:30s`) 도입 + `WORKER_HEARTBEAT_TIMEOUT` 발동 + DLQ 모니터

**입력 payload 관련 주의**: `_prompts/rationale_continuity.md` 는 `spec/5-system/` 전체(1-auth.md, 10-graph-rag.md 등)와 다수 spec 문서의 Rationale 발췌를 통째로 번들했으나, 정작 "## 구현 변경 사항" diff 섹션이 비어 있어 실제 코드/스펙 변경분을 담고 있지 않았다. 이에 따라 `git -C <worktree> diff origin/main` 을 직접 실행해 실제 변경 파일 집합을 확보하고, 그 변경이 걸리는 spec 문서(`4-execution-engine.md` 등)의 `## Rationale` 섹션을 직접 대조했다 (payload 의 auth/graph-rag 등 무관 섹션은 본 PR 과 관련이 없어 분석 대상에서 제외).

## 발견사항

이번 diff 는 이례적으로 **자체 정합성이 매우 높다**. 검토 결과 CRITICAL/WARNING 급 발견 없음. 근거는 아래와 같다.

- **PR3 Rationale 이 예고한 후속을 PR4 가 정확히 이행**: PR3 Rationale("크래시/재시작 RUNNING 세그먼트 제어된 re-drive")의 "기각 대안" 항목이 "(a) 신규 owner/heartbeat 컬럼 — PR4 stalled 로 흡수" 를 명시했고, PR4 는 실제로 신규 컬럼 없이 BullMQ 네이티브 stalled 만 사용한다. 코드(`execution-run.queue.ts` `EXECUTION_RUN_MAX_STALLED_COUNT=1`, `EXECUTION_RUN_STALLED_INTERVAL_MS=30_000`)가 spec 서술과 정확히 일치.
- **"heartbeat 채널 신설 안 함" 원칙 유지**: `## Rationale` "Phase 2 cont 후속 정리 §3"(2026-06-04 결정, "heartbeat → BullMQ stalled-job 일원화")이 못박은 "별도 heartbeat 채널을 신설하지 않는다" 원칙을 PR4 도 그대로 따른다 — `WORKER_HEARTBEAT_TIMEOUT` 코드명은 유지하되 의미만 "stalled 재배달 소진"으로 재정의(§7.1/§2.13 동기화), 신규 heartbeat 인프라 없음. `error-codes.md §3` historical-artifact 레지스트리에도 코드명 유지·rename 아님이 명시돼 있어 `error-codes.md §2` "이름 안정성" 정책과 상충하지 않는다.
- **`recoverStuckExecutions` 은퇴 여부 — 코드로 재검증**: PR4 rationale 이 "은퇴하지 않고 backstop 으로 병존" 이라 주장하는 부분을 코드에서 직접 확인 — `execution-engine.service.ts` 의 `onApplicationBootstrap`(735)·`onModuleInit`(747) 양쪽에서 `recoverStuckExecutions()` 호출이 그대로 남아있어 주장과 일치. §Rationale 이 "은퇴"를 언급했다가 스스로 정정한 이력(§9.2 `exec:run:seq` 스케치 정정 포함)도 diff 안에서 함께 갱신되어 정합.
- **"per-node task queue 재도입 아님" 불변식 준수**: PR2b/PR3/PR4 모두 "한 세그먼트=한 프로세스" 전제를 재확인하며, `runExecutionFromQueue` 의 RUNNING 분기(§7.5 case B 재사용)는 세그먼트 단위 재구동이지 per-node 분산이 아니다 — `## Rationale` "per-node task queue → execution-level intake 큐"(2026-06-04, 기각된 대안)를 다시 끌어오지 않는다.
- **§4.2 active-running 직렬화 불변식 재검증 의무 이행**: §4.1 PR2a 메모가 걸어둔 "재진입 경로 추가 시 재검증" 의무를 PR3/PR4 Rationale 모두 명시적으로 재확인하고, 잔여 zombie race 를 회귀 아님으로 정당화(fail-path 기존 노출과 동일)하는 논증을 유지 — 새 invariant 파괴 없이 완화 조치(bounded `maxStalledCount:1`, per-node COMPLETED skip)만 추가.
- **DLQ 알람 패턴 — Phase 3.1 Rationale 그대로 재사용**: "DLQ 모니터링 — 로그 기반 알람 선택(Phase 3.1)" 이 정한 "gauge=관측/log 알람=능동 통지" 역할 분리를 `ExecutionRunDlqMonitorService` 코드가 그대로 구현(주석에 명시적으로 `ContinuationDlqMonitorService` 동일 패턴이라고 self-reference). 신규 메커니즘을 만들지 않고 기존 결정을 복제.
- **Q2(세그먼트-start 영속) defer — 과거 정정 이력과 정합**: `## Rationale` "Durable Continuation & Graceful Shutdown"(under-count) 항목은 이전에 "PR3 가 자연 해소" 로 예고했다가 "PR3 정정(2026-07-04)"으로 스스로 뒤집은 바 있다. 이번 PR4 diff 는 그 위에 "PR4 도 Q2 defer 로 migration-free 라 여전히 미해소" 를 추가해 동일한 자기 정정 계보를 유지 — 새 결정 번복이지만 항상 같은 자리에 근거와 함께 기록되고 있어 "무근거 번복"에 해당하지 않는다.
- **G2(`errorPolicy='continue'`) defer 유지**: `execution-engine-residual-gaps.md` 의 G2 BLOCKED 상태가 이번 PR로 조용히 해소된 것처럼 서술되지 않고, "크래시 re-drive 인프라 토대는 제공하되 G2 자체는 별건" 이라는 기존 경계가 diff 전체에서 일관되게 유지된다.

## 요약

이번 PR4 diff 는 PR3 Rationale 이 미리 걸어둔 "기각 대안"·"재검증 의무"·"defer 항목"을 정확히 이행하는 후속작이며, 검토 관점 4가지(기각 대안 재도입, 원칙 위반, 무근거 번복, 암묵적 invariant 충돌) 중 어느 것도 위반 사례가 발견되지 않았다. 특히 `recoverStuckExecutions` 병존 주장·`maxStalledCount:1` 값·DLQ 알람 패턴 등 spec 이 서술한 핵심 주장들을 코드(`execution-run.queue.ts`, `execution-run.processor.ts`, `execution-engine.service.ts`, `execution-run-dlq-monitor.service.ts`)에서 직접 재검증했고 모두 spec 서술과 일치했다. 유일한 특이사항은 orchestrator 가 생성한 입력 payload(`_prompts/rationale_continuity.md`)에 실제 diff 섹션이 누락돼 있었다는 점으로, 이는 본 checker 가 `git diff origin/main` 직접 실행으로 우회했으며 target PR 자체의 문제는 아니다.

## 위험도

NONE
