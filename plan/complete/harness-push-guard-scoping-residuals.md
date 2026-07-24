---
title: push 가드 worktree 스코핑 잔여 — 게이트 계약 타입화·테스트 위생 (#1005 후속)
worktree: harness-checks-paths-guard-f6b2d9
started: 2026-07-24
owner: developer
status: complete
priority: P4
# `.claude/hooks/**` + `.claude/tests/**` 전용 — 어떤 spec 의 `code:` glob 에도 미매칭.
spec_impact: none
---

## Overview

PR [#1005](https://github.com/worker-ants/clemvion/pull/1005)(교차-worktree false ALLOW 차단)의
리뷰 6라운드에서 **비차단으로 분류돼 미조치된 항목**들. 전부 독립적이라 부분 처리해도 되고,
개별로는 티켓 가치가 없어 하나로 묶는다.

> `_run_gates` 의 REVIEW/PLAN 블록 중복은 **여기 포함하지 않는다** — 이미
> [`harness-gate-control-flow-extract.md`](../in-progress/harness-gate-control-flow-extract.md) (§K) 가 다룬다.
> #1005 리뷰에서 4라운드 연속 지적됐으나 매번 "#999 소유 구조라 여기서 되돌리면 안 됨" 으로
> 일관 미조치했다.

## 체크리스트

### 게이트 계약 — 런타임 추론 → 정적 명시

- [x] **게이트 결과 dataclass 에 공통 `push_blocks` 도입** (리뷰 `01_25_15` WARNING 5).
      `ReviewDecision`·`PlanDecision` 에 `push_blocks` **property** 추가(각각 `blocked`·
      `untouched` 반환). 러너 `_evaluate_over_targets` 는 `is_blocked` 람다 인자를 버리고
      `result.push_blocks` 를 직접 읽는다 — 두 호출부의 발산 람다 제거. **`push_blocks` 로
      명명**(단순 `blocked` 아님): `PlanDecision` 은 두 게이트를 겸하고 Stop 게이트는
      `complete_but_in_progress` 로 막으므로, 필드명이 "어느 게이트가 답하는가" 를 말해야 한다.
      스텁 3곳(scope 테스트 2 + main 테스트 2)도 동반 갱신 — 이 커플링은 "계약이 명시화된"
      증거다(스텁이 push_blocks 를 안 declare 하면 올바르게 거부됨). mutation:
      `PlanDecision.push_blocks → complete_but_in_progress` 로 바꾸면
      `test_plan_push_blocks_is_untouched_not_the_stop_signal` 이 정확히 잡는다.
- [~] **게이트 인터페이스 `Protocol` 선언** (리뷰 `01_25_15` WARNING 4) — **의도적 미채택**.
      §미채택 참고.

### 테스트 위생

- [x] **`_run` 헬퍼에 `extra_env` / `script` 인자 추가** (리뷰 `10_47_09` WARNING 3).
      복붙하던 5개 테스트(bypass_review/plan · degradation_counted · target_selection_failure ·
      push_targets_crash)를 전부 `_run(..., extra_env=..., script=...)` 로 이관. `extra_env` 는
      `BYPASS_*` pop 이후에 layer 되어 `BYPASS_*`·`CLAUDE_PROJECT_DIR` 를 다시 세팅 가능,
      `script` 는 patched-to-crash 사본을 동일 plumbing 으로 구동.
- [x] **detached-HEAD worktree 배제를 pin** (리뷰 `10_47_09` INFO 7).
      `test_detached_head_worktree_is_excluded_from_scoping` — `--detach` 로 3번째 worktree 생성
      후 (1) `_worktree_branches` 직접 호출로 배제 확인(정상 branch worktree 는 포함돼 non-vacuous)
      + (2) detached 경로를 명령이 언급해도 차단 안 됨을 e2e 로 확인.
- [x] **`_push_targets` 순수 함수 단위 테스트** (리뷰 `10_47_09` INFO 9).
      `PushTargetsUnitTest` 6건 — `_worktree_branches` 를 몽키패치해 cwd-first · order-stable ·
      de-dup · unmentioned/stale 배제를 각각 고정. mutation: `targets=[cwd]→[]` 이면 6+e2e 4건 RED.
- [x] **`result is None` 분기** (리뷰 `10_47_09` INFO 8).
      `EvaluateOverTargetsNoneBranchTest` — None 반환 스텁으로 (1) 차단 안 함 (2) `answered` 에
      게이트를 넣지 않음(스트릭 오리셋 방지) + None 뒤 실제 verdict 는 여전히 도달. mutation:
      None 분기에 `answered=True` 주입 시 정확히 잡힘.

## 미채택 — WARNING 4 Protocol (근거)

`_lib` 에 `GateEvaluator` Protocol 을 두자는 제안은 **채택하지 않는다**. 이 하네스는
**타입체커가 CI 에 없다**(mypy 미실행) — Protocol 은 아무것도 강제하지 못하는 문서일 뿐이다.
그리고 리뷰가 지목한 진짜 위험(`evaluate_*` 시그니처가 keyword-only 로 바뀌어 `_accepts_cwd`
가 조용히 legacy degrade → false-ALLOW 재발)은 **이미 행동으로 고정**돼 있다:
`AcceptsCwdContractTest.test_real_gates_accept_a_positional_cwd` +
`test_keyword_only_signature_is_rejected`. 시그니처가 바뀌면 그 테스트가 RED 다 —
Protocol 보다 강한 보장이다. 게다가 WARNING 5 의 `push_blocks` property 가 게이트 계약을
이미 코드로 명시화(각 decision 이 "push 를 막는가" 를 선언)하므로, WARNING 4 의 의도(계약
가시화) 상당 부분을 강제 없는 ceremony 없이 달성한다. 재요청 시 이 문단을 근거로 오탐 처리.

## 남은 갭 — 의도된 것 (착수 대상 아님, 재발견 시 오탐)

`#1005` 가 **설계 주석에 명시**한 잔여 갭 셋. 전부 cwd-only 로 degrade 하며 **수정 전보다
약해지지 않는다**:

1. **체크아웃되지 않은 branch** 를 push — 평가할 worktree 가 없어 원리적으로 불가.
2. **완전 bare push** — branch 이름도 경로도 명령 텍스트에 안 나타나는 경우(도구 cwd 가 이미 다른
   worktree 안이라 refspec 없이 push). 닫으려면 명령 텍스트 밖을 신뢰해야 하는데 payload `cwd` 는
   이미 쓰고 있고 훅이 볼 수 있는 다른 신호가 없다.
3. **심볼릭 링크 별칭 경로** — git 은 resolved 경로를 보고하므로 `/var/…` 로 typed 된 경로가 git 이
   `/private/var/…` 로 부르는 worktree 와 매칭되지 않는다.

## 참고 — 재현 불가로 판정된 CRITICAL

리뷰 `10_47_09` 이 `_is_git_push()` 의 O(n²) ReDoS(688KB 에서 ~58초)를 CRITICAL 로 보고했으나
**재현되지 않았다**: 리뷰어 서술 형태를 포함해 6가지 적대적 입력을 같은 규모로 측정해 전부
0.000s, 스케일링도 선형이었다. 결정적으로 그 함수는 `origin/main` 과 **byte-identical** 이라
#1005 의 diff 가 아니다. 근거는 `review/code/2026/07/24/10_47_09/RESOLUTION.md`.
**재현 가능한 입력이 제시되면** 그때 별건으로 등록할 것.
