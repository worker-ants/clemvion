---
title: push 가드 detection — env 값이 따옴표+비따옴표 연쇄일 때 미탐지 (§L)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P1
---

## Overview

`harness-guard-followups.md` §L 에서 이관. **차단성 계열** — 리뷰-before-push 게이트가
조용히 우회되는 클래스의 마지막 알려진 갭이다. 다만 §J 와 달리 **선재 갭**이고(pre-§J
패턴도 못 잡았다) 트리거가 더 좁아, 즉시성은 §J 보다 낮다.

> 출처: §J PR 리뷰 `review/code/2026/07/24/00_46_34` WARNING #2.

## 문제

`A="a b"c git push` 는 정상 셸 할당이다(값 = `a bc`). 그런데 어떤 대안도 맞지 않는다:

- 따옴표 분기는 닫는 따옴표에서 멈춘 뒤 **공백을 요구**하는데 뒤에 `c` 가 붙어 있다.
- `\S+` 폴백은 따옴표 **안** 공백을 못 넘는다.

접두 그룹이 무너지면 뒤따르는 `git\b` 앵커도 안 맞아 **push 자체가 미탐지**된다.
`_is_git_push` 가 False 면 `main()` 이 즉시 `return 0` — REVIEW/PLAN 게이트 둘 다 미실행,
fail-open 배너조차 없다. §J 와 같은 형태의 조용한 게이트 우회다.

실측 (2026-07-24, main `ddd3633d4`):

| 명령 | 탐지 |
| --- | --- |
| `A="a b"c git push` | **False** |
| `A=x"a b" git push` | **False** |
| `A="a b" git push` | True (§J 로 해소된 형태) |

넛지 훅 `guard_default_branch_bash._MUTATING` 도 같은 갭을 공유한다(넛지라 영향은 작다 —
미탐지 = 리마인더 1회 손실이지 차단 실패가 아니다).

## 선행 조건 — 자연스러운 수정이 곧 ReDoS 다

값을 "따옴표/비따옴표 조각의 **연속**" 으로 확장하는 게 정답 방향이다. 그런데 가장
자연스러운 형태가 위험하다:

```
(?:'[^']*'|"[^"]*"|[^\s'"])+
```

세 대안이 **각각 1글자를 맞출 수 있는 반복 그룹**이라, 엔진이 같은 텍스트를 여러 방식으로
분할해볼 수 있다 — `BacktrackingTest` 가 존재하는 이유인 파국적 형태 그 자체다.
실측: 유사 형태가 14회에서 5.2초, 18회에서 >8초.

이 훅은 **모든 Bash 호출을 동기로 게이트**하므로 hang 은 세션 정지 또는 하네스 타임아웃 →
fail-open 이다. 즉 ReDoS 를 들이면 고치려던 우회를 다른 경로로 재현하게 된다.

## 체크리스트

- [x] 값을 따옴표/비따옴표 **조각의 연속**으로 확장. **측정이 선행** — 후보 패턴마다
      `BacktrackingTest` 관행(subprocess + 하드 타임아웃)으로 선형성 확인 후에만 채택.
      대안이 첫 글자로 서로소가 되도록 짜는 것이 지금까지 통한 방법이다.
- [x] 넛지 훅 `_MUTATING` 도 동반 수정 (두 훅의 env-value 서브패턴은
      `EnvValueSubpatternSharedTest` 가 byte-identical 로 묶고 있으므로 한쪽만 고치면 실패).
- [x] 캐너리 `KnownFalseNegativeTest` 를 `assertTrue` 로 뒤집기 (§J 에서 검증된 handoff 장치).
      → `GluedQuotedEnvValueTest` / 넛지 쪽 `test_shares_the_push_guard_s_l_fix`.
- [x] 현재 버그 동작을 캐너리로 고정 + `GeneratedFloorTest._VALUES` 에 해당 형태 추가 —
      오늘 커버리지를 늘리진 않지만 §L 수정이 같은 축에서 측정되게 한다. ✅ §J PR 에서 완료.

## 수정 (2026-07-24)

### 채택한 형태 — 접두 그룹을 **2개 분기**로

측정으로 후보 3개를 떨어뜨린 끝의 결론이다.

| 후보 | 결과 |
| --- | --- |
| 조각열에 `['"]` 를 그냥 추가 (티켓이 경고한 "자연스러운 수정") | 글루 조각 20회에서 **>8s** — 경고 실증 |
| 조각열 5-alternative **단독** (전부 서로소) | 선형이지만 **새 FN**: `A='x git push -o 'y'` 처럼 명령 뒷부분에 따옴표가 있으면 조각 분기가 `git` 을 넘어 먹는다 = #1003 이 고친 그 클래스 재도입 |
| 조각열 `|` `\S+` 를 **한 alternation 안**에 | 두 파스가 매 반복 공존 → `A="x y=z" ` ×28 에서 **>15s** |
| **조각열 분기 `|` `\S+` 분기 (채택)** | 선택이 반복마다가 아니라 **한 번** 일어남 → 전 형태 선형, 손실 0 |

### 부수 발견 — 현행 패턴에 **살아있는 ReDoS** 였다

`'…'|"…"|\S+` 는 서로소가 아니다. 따옴표가 공백을 넘는 값은 `\S+` 가 그 공백에서 멈추는
두 번째 파스를 갖고, 뒤가 다시 대입처럼 보이면 두 파스가 매 반복 살아남는다:

| 입력 | 길이 | 수정 전 | 수정 후 |
| --- | --- | --- | --- |
| `A="x y=z" ` ×24 + `q push` | 246 B | **6.4s** | 0.017s |
| `A="x y=z" ` ×28 + `q push` | 286 B | **>15s** | 0.017s |

이 훅은 **모든 Bash 호출을 동기 게이트**하므로 286바이트가 세션 정지 또는 하네스 타임아웃 →
fail-open 이다. 즉 §L 은 FN 하나가 아니라 **같은 게이트를 두 방향으로** 뚫고 있었다.
회귀 고정: `BacktrackingTest.test_rival_env_value_parses_do_not_multiply`.

### 동반 변경

- 넛지 훅 `_MUTATING` 동일 형태 (`EnvValueSubpatternSharedTest` 가 **두 분기 모두** 대조하도록 확장).
- `VAR= git commit` (빈 값) 이 부수적으로 탐지된다 — 조각열이 0개 조각을 허용하기 때문.
  종전 "의도된 갭" 핀을 **방향 근거와 함께** 뒤집었다(넛지 1회 추가 / push 는 fail-closed 쪽).

## 관련

- `.claude/hooks/guard_review_before_push.py` (`_GIT_PUSH`)
- `.claude/hooks/guard_default_branch_bash.py` (`_MUTATING`)
- `.claude/tests/test_push_guard_allowlist.py` (`BacktrackingTest`·`KnownFalseNegativeTest`·
  `GeneratedFloorTest`·`EnvValueSubpatternSharedTest`)
- 부모: [`harness-guard-followups.md`](harness-guard-followups.md) §L

## Rationale

**왜 §J 와 함께 안 고쳤나.** §J 는 `GIT_SSH_COMMAND="ssh -i ~/.key" git push` 라는 **일상
명령**이 우회되는 문제였고, §L 은 `A="a b"c` 라는 훨씬 드문 형태다. 그리고 §J 의 수정은
대안을 서로소로 유지해 선형성이 자명했지만, §L 의 수정은 반복 그룹을 도입해야 해서 **측정
없이는 손댈 수 없다**. 같은 PR 에 넣었다면 검증되지 않은 ReDoS 를 차단 게이트에 넣는 셈이다.

**왜 won't-do 가 아닌가.** 트리거가 좁아도 결과는 §J 와 동일한 등급(게이트 전면 우회)이다.
캐너리로 고정해 뒀으므로 방치해도 조용히 넓어지진 않지만, 갭 자체는 남아 있다.
