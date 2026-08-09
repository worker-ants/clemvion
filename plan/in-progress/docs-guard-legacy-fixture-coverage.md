---
title: plan-frontmatter 가드의 선재 3필드 검사에 negative-path fixture 부여
worktree: (unstarted)
started: 2026-08-10
owner: developer
status: in-progress
priority: P3
spec_impact: none
---

## Overview

`plan-frontmatter.test.ts` 의 `worktree`/`started`/`owner` 세 검사가 **positive-only** 다 —
실저장소 데이터가 마침 정상이라 통과할 뿐, **위반 분기가 CI 에서 한 번도 실행된 적이 없다.**

`plan-lifecycle-gates` PR 의 ai-review 가 지적했고, 그 PR 범위 밖이라 분리했다.

## 왜 그 PR 에서 안 했나

그 PR 이 **신설한** 두 검사(status 종료값 · 링크 무결성)에는 이미 같은 처방을 적용했다 —
판정 로직을 `plan-scan.ts` 순수 함수로 빼고 `plan-scan.test.ts` 가 합성 fixture 로
negative-path 를 증명한다(위반 3건을 심고 정확히 그 3건만 잡히는지까지).

세 필드 검사는 **`origin/main` 에 이미 있던 선재 코드**다(실측: `git show origin/main:<파일>`
에 세 `it()` 전부 존재). 같은 처방을 그쪽까지 넓히는 것은 그 PR 이 건드릴 이유가 없는
축이었고, 리뷰 라운드마다 인접 코드로 범위를 넓히면 PR 이 끝나지 않는다.

## 할 일

- [ ] 판정 로직을 순수 함수로 추출 — `isWorktreePlaceholder(value)` ·
      `isValidStartedDate(value)` · owner 존재 판정. `plan-scan.ts` 로 갈지 신규 모듈로 갈지는
      착수 시 판단(그 파일이 이미 세 관심사를 안고 있다는 지적이 별도로 있다)
- [ ] `plan-scan.test.ts`(또는 짝 파일)에 합성 fixture 로 **위반이 실제 검출되는지** 양성 단언:
      `TBD`·`미정`·`pending`·`assigned at impl-start` 같은 placeholder · 비-ISO `started` ·
      빈 `owner`
- [ ] **뮤테이션으로 확인** — 각 판정을 무력화했을 때 RED 가 나는지. 지금 상태에서는
      `WORKTREE_PLACEHOLDER` 정규식을 통째로 지워도 스위트가 초록일 가능성이 높다

## 함께 볼 것 (같은 파일, 다른 축)

- [ ] `ISO_DATE` 정규식(`/^\d{4}-\d{2}-\d{2}$/`)이 **형식만** 본다 — `2026-13-32` 도 통과.
      위 fixture 작업과 같은 자리라 함께 처리하는 편이 자연스럽다. 다만 사람이 직접 쓰는
      필드이고 오기 사례가 관측된 적 없어 **단독으로는 착수 가치가 낮다**

> 관련: [`docs-guard-walker-dedup.md`](docs-guard-walker-dedup.md) — 같은 디렉터리의 walker
> 중복 판정. 축이 달라 별 plan 이지만 착수 시점은 겹쳐도 좋다.

## Rationale

**왜 P3 인가.** 실동작 결함이 아니다 — 세 검사는 정상 동작하고 있고, 위험은 "판정 로직이
조용히 죽어도 아무도 모른다" 는 잠재적인 것이다. 다만 이 저장소는 그 잠재 위험이 실제로
발현한 전례를 여럿 갖고 있다(`plan-lifecycle-gates` 에서만 vacuous 캐너리 2건이 뮤테이션으로
드러났다 — 그중 하나는 vacuous 를 막으려고 만든 캐너리 자신이었다).

**왜 지금 하지 않았나.** 위 §"왜 그 PR 에서 안 했나" 참조. 요약하면 선재 코드이고, 리뷰
라운드마다 인접 코드를 흡수하면 PR 이 수렴하지 않는다.
