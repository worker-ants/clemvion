---
title: cron 재계산 happy-path 를 결정적 단위 테스트로 — e2e 가 구조적으로 못 닫는 연말 창을 닫는다
status: in-progress
owner: developer
worktree: sched-recalc-unit-9c4e17
started: 2026-09-20
spec_impact: none
---

# `SchedulesService.update()` 의 재계산 happy-path

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «cron 재계산 happy-path 의 결정적 단위 테스트가 없다»
(`/ai-review` `review/code/2026/09/20/11_54_10` INFO 2 · `12_45_31` WARNING 1 — 후자가 이 항목이 닫는 잔여를 실측했다).

## 무엇이 비었나

`update()` 는 cron 또는 timezone 이 바뀌면 `computeNextRuns` 로 다음 실행을 다시 계산해 `nextRunAt` 에 넣는다. 지금 이 경로를
고정하는 것은 **e2e 한 케이스**(`schedule-trigger.e2e-spec.ts` 「D. PATCH cron」)뿐이고, 단위 테스트는 «계산이 비면 `null`» 이라는
**방어 분기**만 본다(`schedules.service.spec.ts`).

그 e2e 는 서버 실시각을 쓰기 때문에 **연말 ~2분**(12/31 23:58:30 ~ 01/01 00:00:30 KST) 동안은 재계산이 없어도 통과한다 —
생성 cron(`0 0 1 1 *`)의 값 자체가 판정창 안으로 들어오기 때문이다(`plan/complete/schedule-cron-flake.md` 가 실측·등재).
시각에 의존하지 않는 단위 테스트가 그 구멍을 닫는다.

## 할 것

`schedules.service.spec.ts` 의 `update` describe 에 happy-path 둘. `computeNextRuns` 를 spy 로 두고 **무엇으로 불렸는지**와
**그 결과가 대입됐는지**를 함께 본다 — 값만 보면 «옛 cron 으로 계산했다» 를 못 가른다.

1. **cron 변경** — `computeNextRuns` 가 **새 cron** · 기존 timezone 으로 호출되고, 돌려준 시각이 `nextRunAt` 에 들어간다.
2. **timezone 만 변경** — 같은 확인. 분기 조건이 `dto.cronExpression || dto.timezone` 이라 **두 항이 각각 표면**이다 — 한쪽만
   테스트하면 `||` 를 `&&` 로 바꿔도 반쪽이 살아남는다.
3. **(1라운드 리뷰가 드러낸 정정)** 위 둘로는 부족하다. 항은 둘이지만 **분기는 셋**이다 — «둘 다 거짓» 쪽을 아무도 보지 않아
   조건을 통째로 무력화한 뮤턴트(`if (true)`)가 살아남았다(리뷰어 실측: 29건 전부 GREEN,
   `review/code/2026/09/20/14_22_46` W1). cron·timezone 을 건드리지 않는 PATCH 는 `computeNextRuns` 를 **호출하지 않고**
   `nextRunAt` 이 그대로임을 보는 대조군이 있어야 그 방향이 닫힌다.

## 비대상

- 서비스 로직 변경 — 없다. 테스트만 는다.
- e2e 「D. PATCH cron」 — 그대로 둔다. 이 단위 테스트가 들어와도 e2e 는 **실 서버가 정말 재계산해 응답에 싣는지**를 보는
  다른 표면이다.
- BullMQ 재등록 · 감사 로그 — 같은 `update()` 안이지만 이 항목의 대상이 아니고 이미 각자 테스트가 있다.

## 테스트

이 항목 자체가 테스트다. 판별력은 뮤턴트로:

- 재계산 블록 삭제 → 둘 다 RED
- `dto.cronExpression || dto.timezone` → `dto.cronExpression` (timezone 항 제거) → timezone 테스트만 RED
- `computeNextRuns(schedule.cronExpression, …)` → 갱신 전 값으로 호출 → cron 테스트가 «무엇으로 불렸나» 로 RED
- **(1라운드 조치 뒤 추가)** 게이트를 통째로 무력화(`|| true`) → 대조군 테스트가 RED. 이 뮤턴트는 위 셋만으로는 **살아남았다**

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/20/14_01_01` BLOCK: NO (Critical · Warning 0).
  INFO 둘은 이 작업 밖 — `1-workflow-list.md` frontmatter `pending_plans` 에 완료된 항목 잔존(이미 planner 트래커 항목) ·
  번들 예산으로 `spec/2-navigation/` 19개 중 3개만 본문 확인
- [x] 테스트 선작성 · 뮤턴트로 판별력 — `75d6b5db3`(happy-path 둘) + `ae060b266`(대조군 하나, 1라운드 W1 조치).
  뮤턴트 **넷** 전부 RED: 재계산 블록 삭제(3건) · 조건에서 timezone 항 제거(timezone 테스트 1건만) · 갱신 **전** cron 으로
  계산(인자 단언 2건) · 게이트 무력화(`|| true` — 대조군만 RED). 마지막 하나는 happy-path 둘만으로는 살아남았다
- [x] TEST WORKFLOW (lint · unit · build · e2e 366)
- [ ] `/ai-review` 수렴
- [ ] `--impl-done`
- [ ] 트래커 해소 · 이 plan `plan/complete/` 로
