---
title: spec 갱신 제안 — retry_last_turn 2차 claim 은 recoverStuckExecutions 백스톱이 닿지 않는다
worktree: retry-atomic-claim-4d9e77
started: 2026-07-30
owner: project-planner
priority: P2
status: complete
spec_impact:
  - spec/5-system/4-execution-engine.md
---

## Overview

`developer`/`resolution-applier` 는 `spec/` 쓰기 권한이 없어 **제안만** 남긴다 (CLAUDE.md
§Skill 체계). 출처: `review/code/2026/07/30/11_41_20` SUMMARY WARNING #1
([SPEC-DRIFT], requirement·documentation 독립 수렴), resolution-applier 처리 세션.

## 분류

**SPEC-DRIFT** — 코드(JSDoc)와 plan(`retry-turn-terminal-guard.md` #15)은 이미 이 PR
자신의 실측으로 정정됐고, spec 문구만 낡았다. 코드를 되돌릴 사안이 아니라 spec 본문이
코드의 실측 결과를 따라와야 한다.

## 원본 발견사항 (SUMMARY#1 그대로 인용)

> [SPEC-DRIFT] spec Rationale 이 "복구는 `recoverStuckExecutions`(stale RUNNING Execution
> 재claim) 백스톱이 담당한다"고 무조건 서술하나, 이번 PR 자신의 실측(코드 JSDoc + plan 등재)이
> "discard 후 Execution 이 이미 terminal(`failed`) 이면 그 백스톱은 이 케이스에 닿지 않는다"를
> 반증했다 — 코드/plan 은 이미 정정됐는데 spec 문구만 낡았다 (requirement·documentation
> 독립 수렴)
>
> 위치: `spec/5-system/4-execution-engine.md:1387-1389/1391` vs
> `retry-turn.service.ts:502-513`(6R 시점 라인, 현재는 `claimSpawnedRetryRow` JSDoc
> "알려진 백스톱 갭" 문단)

이미 코드/plan 에 반영된 동일 실측 근거는 다음 두 곳에 있다(둘 다 이번 라운드 이전부터
존재하거나 이번 라운드에서 재확인됨):

- `retry-turn.service.ts` `claimSpawnedRetryRow` JSDoc "**알려진 백스톱 갭(리뷰어 제안과
  다름 — 실측으로 확정)**" 문단 — `failOrphanRunningNodeExecutions` 는
  `recoverStuckExecutions` 의 stale RUNNING **Execution** 재구동 경로에서만 호출되는데,
  discard 후 Execution 은 이미 `failed`(terminal) 라 재구동 대상이 아니라고 명시.
- `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #15 — "백스톱 갭 — claim 실패
  discard 후 spawn row 가 RUNNING orphan 으로 영구 잔류 가능" (6R 신규 등재, P2, 아직 미착수).

## 제안 변경

`spec/5-system/4-execution-engine.md` §7.5 대칭 Rationale(`applyRetryLastTurn` 2차 원자
claim 절) 중 아래 문단만 정정한다. 문단 앞뒤 문장(claim 채택 근거·"중복 실행 0" 재단언 자기모순
서사)은 여전히 유효하므로 무수정.

### Before (줄 1387-1391)

```text
**대가(의도된 트레이드오프)**: 크래시로 중단된 턴의 BullMQ 재배달도 함께 막힌다. 형제
continuation 4종이 `claimResumeEntry` 로 이미 같은 성질을 수용하고 있으며, 복구는
`recoverStuckExecutions`(stale RUNNING Execution 재claim, §7.5 case B) 백스톱이 담당한다.
`retry_last_turn` 만 예외로 두면 "중복 실행 0" 재단언(§7.4 Worker 동시성)이 그 타입에 대해서만
거짓이 되는데, 그 자기모순이 실제로 2026-07-28 까지 남아 있었다.
```

### After (제안)

```text
**대가(의도된 트레이드오프)**: 크래시로 중단된 턴의 BullMQ 재배달도 함께 막힌다. 형제
continuation 4종은 `claimResumeEntry` 로 이미 같은 성질을 수용하며, 그 복구는
`recoverStuckExecutions`(stale RUNNING Execution 재claim, §7.5 case B) 백스톱이 담당한다.
**단 `retry_last_turn` 의 이 2차 claim(`claimSpawnedRetryRow`) 경로는 그 백스톱이 닿지
않는다** — claim 실패로 discard 되는 시점에 대상 Execution 은 이미 `failed`(terminal) 로
남아 `recoverStuckExecutions` 의 재구동 대상(stale RUNNING **Execution**)이 아니기
때문이다(실측 확인, 2026-07-28/30). 그 결과 discard 된 spawn row 자체는 RUNNING orphan 으로
영구 잔류할 수 있다(타임라인/진행률 집계 오염) — 후속은
`plan/in-progress/retry-turn-terminal-guard.md` #15. 그래도 discard 가 옳다: 살아있는
작업을 죽이는 것(claim 도입 전 결함)이 이 이론적 orphan row 보다 항상 더 나쁘다.
`retry_last_turn` 만 claim 자체를 예외로 두면(= claim 을 아예 안 만들면) "중복 실행 0"
재단언(§7.4 Worker 동시성)이 그 타입에 대해서만 거짓이 되는데, 그 자기모순이 실제로
2026-07-28 까지 남아 있었다(이는 claim 유무의 문제이지, 위 orphan row 백스톱 갭과는 별개의
잔여 사안이다).
```

### 근거 요약 (왜 코드가 맞고 spec 이 낡았는가)

- 코드(`claimSpawnedRetryRow` JSDoc)와 plan(#15)은 6라운드 ai-review 시점(2026-07-28)에
  이미 "그 백스톱은 이 케이스에 닿지 않는다"로 정정됐다.
- spec 문구("복구는 ... 백스톱이 담당한다")는 그 정정 이전 서술 그대로 남아, 코드/plan 과
  spec 이 정반대를 말하는 상태다.
- 이 드리프트를 반증한 실측 근거(= `failOrphanRunningNodeExecutions` 호출 조건 분석)는
  이 PR 자신이 만든 것이므로, spec 도 같은 PR 계열에서 따라가는 것이 `#10` 이 세운 "spec 은
  코드와 동반" 패턴과 일치한다.
- **코드를 spec 에 맞춰 되돌리는 것이 아니다** — 코드/plan 의 실측 결론이 유지되고, spec 문구만
  그 결론에 맞춰 수정한다.

## 함께 반영할 것 (선택, 저비용)

- 이 정정과 함께 `spec/5-system/4-execution-engine.md` 근방에 "orphan RUNNING spawn row 잔류"
  가능성 자체를 명시한 문장이 없다면 위 After 문단이 그 역할을 겸한다 — 별도 신규 절 불요.
- `plan/in-progress/retry-turn-terminal-guard.md` 의 frontmatter `spec_impact` 는 이미
  `spec/5-system/4-execution-engine.md` 를 포함하고 있어(이 draft 반영 후에도) 그대로 유효.
