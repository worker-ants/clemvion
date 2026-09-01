---
title: "`error-codes.md` §Overview 가 대표 surface 를 `ErrorCode` 단수로 서술한다 — `EngineErrorCode` 병기"
worktree: (unstarted)
started: 2026-08-31
owner: project-planner
status: in-progress
priority: P3
---

## Overview

`codebase/backend/src/nodes/core/error-codes.ts` 에 자매 const `EngineErrorCode` 가 신설됐는데
(`plan/complete/exec-intake-followups.md` ARCH#5, 2026-08-31), 규약 문서
[`spec/conventions/error-codes.md`](../../spec/conventions/error-codes.md) §Overview 의
"적용 범위" 문단은 여전히 **`ErrorCode` 하나**를 "명명이 중앙화된 대표 surface" 로 서술한다.

`spec/` 쓰기라 **planner 트랙**이다 — developer 턴에서 처리하지 않고 분리 등재한다.

## 왜 이 항목이 developer 턴에서 안 닫혔나

그 PR 은 **코드 전용**(`spec_impact: none`)이었다. 값 문자열이 하나도 바뀌지 않았으므로
그 판정은 맞고, consistency `--impl-done`(`review/consistency/2026/08/31/21_34_02`)도
**BLOCK: NO** 를 냈다. 이 항목은 그 라운드가 **INFO** 로 낸 것이고, checker 스스로
*"코드 전용 PR 범위 밖이라 이번 PR 필수 조치 아님"* 이라 적었다.

developer 가 `spec/` 을 고칠 수 있는 좁은 예외(자기-반증형 소정정)에도 해당하지 않는다 —
그 문장은 예고·트리거가 아니라 **규약 서술**이고, developer 가 쓴 문장도 아니다.

## 할 일

- [ ] `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 두 surface 병기 —
      `ErrorCode`(노드 핸들러 `output.error.code`) / `EngineErrorCode`(엔진이 싣는
      `Execution.error`·`NodeExecution.error`). **같은 파일**에 있다는 점도 함께 적을 것 —
      "파일은 하나, const 는 둘" 이 그 설계의 핵심이고, 문서가 두 파일로 읽히면 오해가 된다.
- [ ] 착수 시 `/consistency-check --spec` (planner 의무 게이트)

## 함께 볼 것 (착수 전 읽기)

이 병기를 쓸 때 **왜 자매 const 인가**를 함께 판단해야 한다. 그 근거와 **선례와의 이탈**이
[`exec-intake-followups.md` ARCH#5 ⑤](../complete/exec-intake-followups.md) 에 정리돼 있다 —
요지는 2026-06-14 사용자 결정이 기각한 것은 **값 레벨 prefix**(`EXEC_*`, 이중 표기)이고 이
변경은 값을 바꾸지 않았으나, `RETRY_*` 선례("레이어가 달라도 한 enum")와는 **형태가 의식적으로
어긋난다**는 것이다.

규약 문서에 한 줄을 쓰면 그 형태가 **규약으로 굳는다.** 그래서 병기만 하지 말고,
*"언제 central enum 을 확장하고 언제 자매 const 를 만드는가"* 의 판단 기준을 함께 적을지를
planner 가 결정해야 한다 — 그게 이 항목의 실제 무게다.

## 관련

- 발생 맥락: [`plan/complete/exec-intake-followups.md`](../complete/exec-intake-followups.md) ARCH#5
- 검출: `review/consistency/2026/08/31/21_34_02` INFO 1 (cross_spec · rationale_continuity ·
  convention_compliance · naming_collision **4명 중복 지적**)
- 같은 라운드의 별건 INFO 2 — repo-guard 3파일 패턴(`*-guard.ts`/`*-fixture.ts`/`*.spec.ts`)이
  5쌍 이상 누적됐는데 소유 규약 문서가 없다. `spec/conventions/repo-guards.md` 신설 검토는
  이 항목과 **독립**이며 더 큰 결정이라 여기 묶지 않는다(포인터만 남긴다).
