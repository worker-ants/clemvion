# 정식 규약 준수 검토 — PR4 (BullMQ stalled 자동 재배달) — 재실행

> **재실행 사유**: 이전 세션의 orchestrator payload 가 `spec/5-system/1-auth.md` +
> `10-graph-rag.md` 를 "Target 문서"로 잘못 번들링했다 — 이 두 문서는 본 PR 과
> 무관하다. 이전 세션은 이를 CRITICAL 로 정확히 포착하고 재검토를 권고했다(위험도
> MEDIUM). 본 세션은 그 권고에 따라 실제 changeset 을 대상으로 재검토한다.

- 검토 모드: 구현 완료 후 검토 (`--impl-done`), payload mis-scope 교정 재실행
- diff-base: `origin/main`
- HEAD 워킹트리: `/Volumes/project/private/clemvion/.claude/worktrees/exec-intake-pr4-stalled`

## 대상 changeset (`git diff origin/main -- 'spec/**' 'codebase/**'`)

- spec: `spec/5-system/4-execution-engine.md`(§7.1/§7.2/§7.5/§9.2/§9.3/Rationale),
  `spec/1-data-model.md` §2.13, `spec/5-system/3-error-handling.md` §1.4,
  `spec/conventions/error-codes.md` §3, `spec/data-flow/3-execution.md` §1.1/§2.2/§3.1/§3.3
- code: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`,
  `execution-run.processor.ts`, `execution-run-dlq-monitor.{config,service,service.spec}.ts`,
  `execution-engine.service.ts`, `execution-engine.module.ts`,
  `codebase/backend/src/modules/executions/executions.controller.ts`,
  `codebase/backend/test/execution-stalled-redelivery.e2e-spec.ts`

## 발견사항

- **[INFO]** `ExecutionRunDlqMonitorService` 의 "continuation 미러" 주석이 gauge 등록 부분에서는 실제로 대칭이 아님
  - target 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts` 클래스 docblock ("`ContinuationDlqMonitorService`(continuation 큐) 와 동일 패턴")
  - 위반 규약: 직접적인 규약 위반은 아님. `spec/conventions/**` 에 이 미러링 방식을 강제하는 조항은 없다. sibling 서비스와의 관례적 기대에 대한 참고사항.
  - 상세: `ContinuationDlqMonitorService.onModuleInit` 은 자신이 직접 `businessMetrics.registerQueueDepthProvider(...)` 를 호출해 큐 depth gauge 를 등록한다. 반면 `ExecutionRunDlqMonitorService` 는 이 등록을 하지 않고, 주석으로 "`ExecutionEngineService.onModuleInit` 이 이미 `clemvion.queue.depth` gauge 로 노출"한다고 설명한다. 실제 `execution-engine.service.ts:687-715`(이번 PR diff 밖의 기존 코드)를 확인한 결과 이 gauge 등록은 사실이며, 두 곳에서 같은 큐를 중복 등록하지 않기 위한 합리적 설계다. 다만 "동일 패턴"이라는 문구가 gauge 책임 소재까지 대칭이라는 인상을 줘 향후 독자가 `ExecutionRunDlqMonitorService.onModuleInit` 안에서 gauge 등록 코드를 찾다가 혼동할 수 있다.
  - 제안: 주석을 "cooldown 알람 로직은 `ContinuationDlqMonitorService` 와 동일 패턴이나, gauge 등록은 `ExecutionEngineService.onModuleInit` 이 기존에 담당 — 중복 등록 방지"로 세분화하면 오독 위험이 줄어든다. 규약 갱신 불필요, target(코드 주석) 미세 조정 수준의 제안이다.

- **[INFO]** `spec/5-system/4-execution-engine.md` §9.2 `exec:run:seq` 키 서술의 반복 정정
  - target 위치: `spec/5-system/4-execution-engine.md` §9.2 Redis 키 표, `exec:run:seq:<executionId>` 행
  - 위반 규약: 없음
  - 상세: PR4 는 당초 §9.2 가 예고했던 "jobId 를 `<executionId>:run:<seq>` 로 확장" 스케치를 채택하지 않고, 네이티브 BullMQ stalled(같은 jobId 재처리)로 단순화했다. diff 는 이 정정을 명시적으로 기록("당초 ... 스케치를 정정")하는데, 이는 SoT 정합성 관점에서 결함이 아니라 모범적 처리다. 다만 이 키가 계속 "미래 예약"으로 미사용 상태로 남을 경우 이후 PR 에서 또 정정 기록이 누적될 수 있으므로, 확정 미사용 근거(네이티브 재처리)를 §7.1 본문에 SoT 로 두고 §9.2 표는 링크만 거는 구조로 리팩터하는 것도 고려할 만하다는 제안(강제 사항 아님).

## 검증된 준수 사항 (문제 없음 확인)

1. **에러 코드 rename=breaking 원칙 (`error-codes.md` §2/§3)**: `WORKER_HEARTBEAT_TIMEOUT` 코드명은 유지되고, §3 예외 레지스트리 행은 "코드명 유지·PR4 재정의 발효"로 갱신되어 원칙을 정확히 준수한다. 이는 새 코드 신설이 아니라 기존 예약어의 의미 확정이므로 신규 rename 이 아니다.
2. **엔진 레벨 코드 미등록 관례**: `WORKER_HEARTBEAT_TIMEOUT` 은 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 에 없다 — 신규 이슈가 아니라 `EXECUTION_TIME_LIMIT_EXCEEDED`/`SERVER_INTERRUPTED` 등 기존 엔진 레벨 코드와 동일한 기존 패턴(§1 노드 레벨 vs 엔진 레벨 분리, `error-codes.md` Overview 명시)이다.
3. **test-hook 게이팅 패턴 (`:id/_test/simulate-execution-run-redelivery`)**: sibling `_test/recover-stuck-executions` 와 게이팅 조건(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'`), 데코레이터 순서(`@Roles('owner')` + `@ApiExcludeEndpoint()`), 미충족 시 404 폴백까지 완전히 동일하게 재사용됐다. 사용자 memory `feedback_e2e_boot_only_op_test_hook.md` 에 기록된 확립 패턴과 일치.
4. **env var 명명 (`EXECUTION_RUN_DLQ_*`)**: `CONTINUATION_DLQ_*` 4종(`_ALARM_THRESHOLD`/`_MONITOR_INTERVAL_MS`/`_ALARM_COOLDOWN_MS`/`_MONITOR_ENABLED`) 접두어 패턴을 `EXECUTION_RUN_DLQ_*` 로 완전히 미러링했고, `execution-run-dlq-monitor.config.ts` 의 구조(`useFactory` 주입, `DISABLED_VALUES`, `parsePositiveInt`)도 `continuation-dlq-monitor.config.ts` 와 동일하다. `spec/5-system/4-execution-engine.md` §9.3 표에도 4종 모두 등재됨.
5. **spec 문서 구조**: `4-execution-engine.md` 는 Overview(line 22)/본문/Rationale(line 1270) 3섹션 구조를 유지하고, frontmatter(`id`/`status`/`code`/`pending_plans`)도 규약대로 구성됨. `error-codes.md` diff 도 문서 구조·SoT 분리 원칙(카탈로그/envelope/HTTP status/표기 각 축 분리)을 훼손하지 않는다.
6. **`error.code` 발행 방식**: `finalizeStalledExhausted` 가 발행하는 `error: { code, message }` 형태는 기존 `Execution.error` JSONB 컬럼 계약(`1-data-model.md` §2.13) 및 `node-output.md` §3.2 표준 형태와 일치.
7. **DLQ 모니터 로그 포맷**: `[DLQ ALARM] execution-run dead-letter depth=...` 는 `ContinuationDlqMonitorService` 의 `[DLQ ALARM] execution-continuation dead-letter depth=...` 포맷을 그대로 계승 — 출력 포맷 일관성 양호.
8. **BullMQ 큐 옵션 상수명**: `EXECUTION_RUN_MAX_STALLED_COUNT`/`EXECUTION_RUN_STALLED_INTERVAL_MS` 는 `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` 와 동일 파일·동일 명명 스타일(`EXECUTION_RUN_*`)로 일관되게 추가됨.

## 요약

실제 PR4 changeset(BullMQ stalled 자동 재배달)은 `spec/conventions/error-codes.md` 의 rename=breaking 원칙, 엔진/노드 레벨 에러 코드 분리 관례, sibling test-hook 엔드포인트의 게이팅 패턴, `CONTINUATION_DLQ_*` env var 명명 패턴을 모두 정확히 계승·재사용했다. spec 본문(§7.1/§7.2/§7.5/§9.2/§9.3)도 PR3→PR4 전환을 정합적으로 재서술했고 Overview/Rationale 구조·frontmatter 도 규약을 준수한다. 발견된 사항은 모두 INFO 수준의 주석/서술 다듬기 제안이며 CRITICAL/WARNING 급 규약 위반은 없다.

## 위험도

NONE
