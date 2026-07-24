---
title: 게이트 실행 제어 흐름 추출 (§K) — won't-do (전제 붕괴 실측)
worktree: harness-gate-runner-extract-fef022
started: 2026-07-24
owner: developer
status: complete
priority: P3
# `.claude/hooks/**` 계열 위생 항목 — 어떤 spec 의 `code:` glob 에도 미매칭.
spec_impact: none
---

## 결론 — won't-do (2026-07-24, 사용자 confirm)

착수 전 현행 구조를 실측한 결과 **티켓의 핵심 전제가 붕괴**했고, 남은 추출은 net-negative
임이 확인됐다. 백로그의 §C(공유 이득 0 실측 → won't-do)와 같은 처분이다.

> **판별 기준(재발 방지)**: 아래 세 사실 중 하나라도 바뀌면(예: push·stop 가 다시 동일
> 액션으로 수렴, 또는 `failopen_state` 의존이 사라짐) 재검토 가치가 생긴다. 그 전에는
> "4중 복제이니 추출하자" 재요청은 이 문서를 근거로 오탐 처리할 것.

## Overview (원 등록)

`harness-guard-followups.md` §K 에서 이관.

> 출처: `review/code/2026/07/23/17_57_42` WARNING #5 (maintainability 등급).

원 문제 서술: "`if bypass / elif <gate> is None / try-except-else` 약 10~12줄이 **네 번
동일하게** 반복 → `_run_gate()` 하나로 추출."

## 왜 won't-do — 실측 3가지

### 1. `1×4 동일 블록` 전제는 #1005 로 붕괴 — 실제는 `2×2`, 두 쌍이 다른 일을 한다

| 쌍 | 현행 액션 | 상태 |
| --- | --- | --- |
| **push** (REVIEW·PLAN) | `_evaluate_over_targets` (worktree 스코핑·차단·`return 2`) | 내부 평가 루프 **이미 추출됨** (#1005) |
| **stop** (REVIEW·PLAN) | 자체 `try/except/else` + **nudge** (single-cwd, `_suppress_for_resolution`, JSON 반환) | push 와 액션이 **근본적으로 다름** |

push 쌍은 이미 `_evaluate_over_targets` 로 무거운 부분을 뺐고, stop 쌍은 차단이 아니라
nudge 라 반환 타입·억제 로직·대상 범위가 전부 다르다. `_run_gate` 하나로 통합하려면
콜백을 4~5개 받아야 해 중복(~16줄)보다 추상화가 더 복잡해진다 — 유한한 문제를 무한한
표면과 바꾸는 전형이다.

### 2. 유일한 공통 잔여(bypass/None 프리픽스)는 깨끗이 추출 불가

남은 공통부는 4곳의 `bypass → bypassed` + `evaluate is None → degraded(import_reason)`
디스패치 프리픽스(~4줄)뿐이다. 그런데:

- 이 프리픽스는 `failopen_state`(`Outcome`·`import_failure_reason`)에 의존한다. **두 훅 모두
  `failopen_state` 부재를 의도적으로 방어**한다(`if failopen_state is None` 폴백 — §E 설계
  핵심: `guard_review_before_push.py:644`, `guard_review_before_stop.py:127`). 프리픽스를
  `failopen_state` 로 옮기면 그 복원력이 깨진다(모듈 부재 시 hard gate 크래시).
- 새 `_lib/gate_dispatch.py` 로 빼면 훅마다 방어적 import + 인라인 폴백이 필요 →
  **제거하는 ~24줄보다 더 많은 코드** + hard gate 에 **새 import-실패 표면** 추가. 실측 delta:
  호출 12줄 + 헬퍼 8줄 + 방어 import 8줄 + 폴백 ≈ 중립~증가.

가장 위험한 부분(보고·계수 규칙)은 §E 후속에서 이미 `failopen_state` 로 공유됐다 — 남은 건
저위험·저가치 프리픽스뿐이다.

### 3. 티켓의 선행조건("행동 고정")은 이미 충족

원 티켓 체크리스트 1번은 "4블록의 현재 동작을 subprocess 로 고정" 이었다. **이미 전수
고정돼 있다** — 별도 작업 불요:

- push: `test_bypass_review_skips_only_the_review_gate` · `test_bypass_plan_skips_only_the_plan_gate` ·
  `test_review_import_failure_disables_only_that_gate` · `test_plan_import_failure_disables_only_that_gate` ·
  `test_both_gate_imports_fail_allows_the_push` · **`test_present_but_none_is_not_called_an_import_failure`**(defect #1 정확한 클래스).
- stop: `test_import_failure_is_reported` · `test_review_gate_present_but_none_is_accurate_too` ·
  **`test_present_but_none_is_not_called_an_import_failure`** · `test_bypass_is_not_counted_as_degradation` ·
  `test_evaluate_exception_is_reported`.

즉 "네 블록이 갈라져 잘못 동작" 하는 순간 **기존 블록별 행동 테스트가 잡는다**. 추출이
제공할 divergence 방어를 이미 테스트가 하고 있으므로, 추가 드리프트 가드도 불요(프리픽스가
byte-identical 도 아니라 텍스트 가드는 오히려 취약).

## 부수 관찰 (착수 대상 아님)

`guard_review_before_stop.py` 의 PLAN 블록 bypass/None 분기에 `plan = None` 2줄이 **vestigial**
(뒤의 `if plan is not None` 이 else 안이라 읽히지 않음). stop-review 에는 대응 dead 라인이
없어 미세 비대칭이나, 두 번 깨진 hard gate 를 2줄 정리 위해 건드리는 것은 drive-by 리스크가
가치를 넘는다 — 남겨둔다.

## 관련

- `.claude/hooks/guard_review_before_push.py` (`_run_gates`·`_evaluate_over_targets`)
- `.claude/hooks/guard_review_before_stop.py` (`_run` 의 REVIEW/PLAN nudge)
- `.claude/hooks/_lib/failopen_state.py` (보고·계수 — 이미 공유)
- `.claude/tests/test_guard_review_before_push_main.py`, `.claude/tests/test_stop_guard_failopen.py`
  (4블록 dispatch 행동 — 이미 전수 고정)
- 부모: [`harness-guard-followups.md`](../in-progress/harness-guard-followups.md) §K

## Rationale

**왜 리팩터를 안 하나.** 순수 위생(P3)인데, 추출이 (1) 중복보다 많은 코드를 낳고 (2) 두 번
결함을 낸 hard gate 에 새 import-실패 표면을 더하며 (3) 방어 대상(행동·보고)은 이미 다른
수단으로 보호된다. 이득이 음수인 리팩터를 hard gate 에 얹는 것은 이 저장소가 반복 학습한
안티패턴이다.

**왜 doc-only 로 종결하나.** 코드 변경 0 이 옳은 결론이다. "무언가 해야 한다" 는 압력으로
net-negative 추출을 강행하는 것이 곧 이 저장소가 경계하는 실패다. 재도출·근거 기록·종결이
이 항목의 정당한 완료다.
