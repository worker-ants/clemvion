---
title: 게이트 실행 제어 흐름 4중 복제 → _run_gate() 추출 (§K)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P3
---

## Overview

`harness-guard-followups.md` §K 에서 이관.

> 출처: `review/code/2026/07/23/17_57_42` WARNING #5. 한 번 §J 로 등재됐다가 브랜치
> 리셋(#1000 재구성) 때 유실됐고, 그 사이 §J 번호가 다른 항목에 재사용돼 §K 로 재등재됐다.

## 문제

`if bypass / elif <gate> is None / try-except-else` 약 10~12줄이 네 번 반복된다:

| 파일 | 게이트 |
| --- | --- |
| `guard_review_before_push.py` | REVIEW · PLAN |
| `guard_review_before_stop.py` | REVIEW nudge · PLAN nudge |

**보고** 로직은 §E 후속에서 `_lib/failopen_state.py` 로 이미 공유했다. 남은 건 **제어 흐름**이다.

```python
_run_gate(name, evaluate_fn, import_failed, import_error, import_tb, bypass_env)
```

## 선행 조건 — 행동 고정이 먼저

push 훅은 **리뷰 없는 push 를 막는 hard gate** 다. 그리고 §E 라운드에 바로 이 배선이
**실제로 두 번** 결함을 냈다:

1. `evaluate_* is None` 을 "import 실패" 로 오독 → 하네스 스위트가 실제 워크트리 상태를
   오염시켰다(몇 회 더 돌았으면 정상 게이트에 "사실상 꺼져 있습니다" 오경보).
2. telemetry 예외가 전파돼 훅이 exit 0 → exit 1 이 됐다(관측성이 관측 대상을 깨뜨림).

두 결함 모두 **테스트가 잡았다**. 리팩터 전에 4개 블록의 현재 동작을 실행 기반으로
고정해두지 않으면, 추출 과정의 미묘한 차이가 같은 등급의 결함을 다시 낳는다.

## 체크리스트

- [ ] 4개 블록의 현재 동작을 실행 기반(subprocess)으로 고정 — bypass / import 실패 /
      evaluate 예외 / 정상 판정 × 4블록 조합
- [ ] `_run_gate()` 추출, 행동 보존 확인 (위 테스트가 그대로 green)
- [ ] mutation: 추출 후에도 각 분기 무력화가 잡히는지 (기존 §E 뮤턴트 세트 재사용)

## 관련

- `.claude/hooks/guard_review_before_push.py`
- `.claude/hooks/guard_review_before_stop.py`
- `.claude/hooks/_lib/failopen_state.py` (보고 로직 — 이미 공유됨)
- `.claude/tests/test_failopen_telemetry.py`, `.claude/tests/test_stop_guard_failopen.py`,
  `.claude/tests/test_guard_review_before_push_main.py`
- 부모: [`harness-guard-followups.md`](harness-guard-followups.md) §K

## Rationale

**왜 §E PR 에 넣지 않았나.** 관측성 추가 PR 에 제어 흐름 리팩터를 얹는 건, 그 라운드에
실제로 두 번 결함을 낸 영역에 회귀 위험을 더하는 선택이다. 리뷰어도 maintainability 등급으로
분류했다 — 지금 구조가 틀린 게 아니라 중복일 뿐이다.

**우선순위가 낮은 이유.** 순수 위생이다. 네 블록이 갈라져 잘못 동작한 사례는 아직 없고,
`failopen_state` 공유로 가장 위험한 부분(보고·계수 규칙)은 이미 한 곳에 모였다.
