---
title: retry-turn 종결 2경로의 무가드 terminal 쓰기 차단 (#1022 동일 클래스)
worktree: retry-turn-cancel-guard-ba75a2
started: 2026-07-27
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

## Overview

`#1022` 가 `execution-engine.service.ts` 에서 닫은 **무가드 terminal 쓰기** 결함 클래스가
`retry-turn.service.ts` 에 그대로 남아 있다. 출처: `#1022` 최종 라운드 리뷰 INFO 8
(`review/code/2026/07/27/01_09_42`) — diff 밖이라 그 PR 범위에서 제외하고 후속으로 등재했다.

## 프로브로 확정한 사실 (2026-07-27)

**티켓이 지목한 것은 1곳(`failRetryExecution`)이었으나 실측 결과 2곳이다.**
`#1022` 에서 "blast radius 를 호출부 개수로 정의해 우회 경로를 못 봤다" 는 실수를 반복하지
않으려고 파일 전체의 terminal 쓰기를 전수 확인했다.

| # | 지점 | 현재 | 위험 |
|---|---|---|---|
| 1 | `failRetryExecution` (`:636`) | `execution.status = CANCELLED\|FAILED` → 무가드 `save()` | 동시 Stop 이 이미 `CANCELLED` 로 마감한 실행을 **FAILED 로 덮어씀** (retryable 재실패 분기) |
| 2 | `completeRetryExecution` (`:435`) | `execution.status = COMPLETED` → 무가드 `save()` | **더 나쁨** — 취소된 실행을 `COMPLETED` 로 덮고 `EXECUTION_COMPLETED` 까지 발행 |

`completeRetryExecution` 은 티켓에 없었다. `@internal` 로 "defensive fallback 에서만 호출" 이라
표기돼 있으나 도달 가능한 경로이고, 결과는 "취소한 실행이 성공으로 보고됨" 이라 오히려 심각하다.

**같은 파일에 이미 guarded 선례가 있다** (`:614`, `resumeGraphAfterRetry` 종결):

```ts
const completed = await this.driver.updateExecutionStatus(savedExecution, ExecutionStatus.COMPLETED);
if (completed) { await this.eventEmitter.emitExecution(...); }
```

즉 신규 패턴 도입이 아니라 **같은 파일 안의 기존 패턴을 두 곳에 마저 적용**하는 작업이다.

## 작업 항목

- [x] 두 지점을 `driver.updateExecutionStatus` 경유 guarded 전이로 교체.
      `false`(동시 cancel 선점) 반환 시 **저장·이벤트 emit 을 모두 skip**.
- [x] 회귀 테스트 — 각 지점에서 DB 가 이미 terminal 이면 (a) 상태를 덮어쓰지 않고
      (b) `EXECUTION_COMPLETED`/`EXECUTION_FAILED` 를 발행하지 않는지. 가드 제거 시 RED.
- [x] TEST WORKFLOW (lint / unit / build / e2e) — 전부 PASS (unit: execution-engine 41 suite / 1,097, e2e 260)
- [ ] `/ai-review` — **파일 명시 + `--route=all`** 로 전수 검토할 것
      (증분 changeset 은 직전 라운드 결함을 구조적으로 못 본다 — `#1022` 에서 실측)
- [ ] `/consistency-check --impl-done`

## 주의

- `failRetryExecution` 의 `isCancelled` 분기는 유지한다 — 취소 시 `execution.error` 를 DB 에
  저장하지 않는 것은 W16(2026-07-26)의 의도된 결정이다.
- `#1022` 가 `finalizeFailedExecution` 에서 겪은 함정: `ALLOWED_TRANSITIONS[PENDING]` 이
  의도적으로 `FAILED` 를 제외한다(`state-machine.spec.ts` 에 명시 테스트). 여기서도 전이
  전 상태가 `PENDING` 일 수 있는지 확인하고, 그렇다면 상태머신을 넓히지 말고 흡수할 것.

## 체크리스트

- [x] 두 지점 guarded 전환
- [x] 회귀 테스트 (mutation 5/5 RED)
- [x] TEST WORKFLOW
- [ ] `/ai-review` (전수)
- [ ] `/consistency-check --impl-done`
