# 요구사항(Requirement) Review — PR2b 동시성 cap enforcement 재검증 (ai-review 16_58_32 CRITICAL 재확인)

대상: codebase/backend/.env.example, migrations/V104__execution_queued_at.sql,
migrations/V105__execution_workflow_status_index.{sql,conf}, execution-engine.service.ts(+spec),
execution-limits.ts(+spec), execution.entity.ts, workspaces DTO/service,
execution-concurrency-cap.e2e-spec.ts, docker-compose.e2e.yml,
review/code/2026/07/04/16_58_32/{SUMMARY,RESOLUTION}.md

## 재검증 대상

1. admitted 분기가 이제 `recordRunningSegmentStart` 를 호출하는가 (직전 CRITICAL)?
2. spec §8 active-running 누적 타임아웃 enforcement 가 admission 경유 실행에서도 복구됐는가?

## 발견사항

- **[INFO]** (해결 확인) admitted 분기 `recordRunningSegmentStart` 호출 복구 — 직전 CRITICAL fix 됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer()` admitted 분기(`execution.status = ExecutionStatus.RUNNING` 직후, diff L521-526) / `recordRunningSegmentStart()` L7417-7419 / `assertActiveTimeWithinLimit()` L7317-7329
  - 상세: `admitExecutionOrDefer` 의 admitted 분기가 `execution.status = ExecutionStatus.RUNNING` 세팅 직후 `this.recordRunningSegmentStart(executionId)` 를 명시적으로 호출하도록 수정됐다. 코드에 딸린 주석("§8 active-running 누적 타임아웃(PR2a) — updateExecutionStatus choke point 를 우회했으므로 segmentStartMs baseline 을 여기서 보정한다")도 정확히 이 fix 의 의도를 기술한다. `recordRunningSegmentStart` 는 `segmentStartMs.set(executionId, Date.now())` 만 수행하는 단순 헬퍼이며(L7417-7419), `assertActiveTimeWithinLimit`(노드마다 dispatch loop 이 호출, L7317-7329)이 이 Map 에서 `segStart` 를 읽어 `inProgress = Date.now() - segStart` 를 계산한다. admitted 경로가 이제 이 baseline 을 심으므로, 큐 경유(=`execute()` 로 시작하는 top-level 실행)로 admitted 된 세그먼트도 진행 중 경과 시간이 정상 계산되고, `updateExecutionStatus` 의 RUNNING 이탈 분기(L7446-7456)도 `segmentStartMs.get` 이 값을 찾아 `activeRunningMs` 누적을 정상 수행한다. 직전 리뷰가 지적한 "단일 세그먼트로 끝나는 일반 실행에서 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 한도가 사실상 걸리지 않는" 회귀는 해소됐다.
  - 근거: 실제 코드 Read + `assertActiveTimeWithinLimit`/`updateExecutionStatus`/`recordRunningSegmentStart` 상호 호출 경로 추적으로 직접 확인(추정 아님).

- **[INFO]** §8 admission gate 원자성(advisory lock) 도 복구 확인 — 직전 CRITICAL(TOCTOU race) fix 됨
  - 위치: `admitExecutionOrDefer()` (c) 블록, `this.executionRepository.manager.transaction` 내부 `pg_advisory_xact_lock(hashtext($1))` (diff L495-520)
  - 상세: per-workspace(`lockKey = exec-cap:${workspaceId ?? execution.workflowId}`) advisory lock 트랜잭션으로 admission 을 직렬화한 뒤 조건부 UPDATE(`WHERE status='pending' AND ws COUNT<cap AND wf COUNT<cap RETURNING id`)를 수행한다. spec §8 Rationale("admission gate 원자성(TOCTOU)")의 서술(per-workspace `pg_advisory_xact_lock` 로 admission 직렬화, 서로 다른 workspace 는 병렬 진행)과 line-level 로 일치한다.

- **[INFO]** spec §8 문서 상태 flip 확인
  - 위치: `spec/5-system/4-execution-engine.md` L1071, L1085, L1087
  - 상세: "PR2b(정책 정의 완료, enforcement 구현 후속)" 이었던 문구가 "PR2b 구현 완료"로 갱신되어 실제 구현 상태와 정합한다(RESOLUTION #5 항목 반영 확인).

- **[WARNING]** admitted 케이스 유닛 테스트에 `segmentStartMs` 직접 assertion 부재 — 회귀 재발 방지 커버리지 약함
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `describe('admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)')` 의 `'cap 여유(affected=1) → admitted'` 테스트(diff L247-267, 파일 내 L3070-3090)
  - 상세: 직전 리뷰 제안("유닛 테스트에 admitted 케이스에서 `segmentStartMs.has(executionId)` 를 검증하는 assertion 추가 필요")이 이번 fix 에 반영되지 않았다. 현재 admitted 테스트는 `exec.status === 'running'` 과 STARTED emit 호출만 검증하고, `(service as unknown as {segmentStartMs: Map<...>}).segmentStartMs.has('e1')` 같은 직접 assertion 은 없다. 프로덕션 코드 fix 자체는 정확하므로 기능 결함은 아니나, 향후 누군가 `recordRunningSegmentStart` 호출을 실수로 제거해도 이 describe 블록의 유닛 테스트는 여전히 통과한다(회귀를 잡아내지 못함) — 다른 `updateExecutionStatus` 관련 테스트(L2196, L3586 등)가 별도로 `segmentStartMs` 를 검증하지만 admission 경로 자체를 향한 직접 assertion 은 아니다.
  - 제안: `admit(exec)` 호출 후 `expect((service as unknown as {segmentStartMs: Map<string, number>}).segmentStartMs.has('e1')).toBe(true)` 를 추가해 admission 경로의 baseline 보정을 유닛 레벨에서 직접 고정한다.

## 요약

직전 ai-review(16_58_32)가 지적한 두 CRITICAL — (1) admission 경유 실행에서 §8 active-running 누적 타임아웃 baseline(`recordRunningSegmentStart`) 누락, (2) admission 조건부 UPDATE 의 TOCTOU race — 모두 코드에서 확인 가능한 형태로 fix 됐다. `admitExecutionOrDefer` 의 admitted 분기는 `execution.status = RUNNING` 세팅 직후 `recordRunningSegmentStart(executionId)` 를 호출해 `assertActiveTimeWithinLimit`/`updateExecutionStatus` 가 기대하는 `segmentStartMs` baseline 을 정확히 심으며, per-workspace `pg_advisory_xact_lock` 트랜잭션이 admission 을 직렬화해 cap 초과 race 를 제거한다. spec §8 문서도 "구현 완료"로 갱신되어 코드와 정합한다. unit(353/353) 전수 통과, `execution-limits.spec.ts`(14/14) 통과 확인. 유일한 잔여 갭은 admitted 유닛 테스트에 `segmentStartMs` 직접 assertion 이 빠진 것으로, 이는 회귀 방지 커버리지의 사소한 약화이며 프로덕션 코드 정확성 자체에는 영향이 없다(WARNING, blocking 아님).

## 위험도

LOW
