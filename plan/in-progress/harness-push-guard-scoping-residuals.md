---
title: push 가드 worktree 스코핑 잔여 — 게이트 계약 타입화·테스트 위생 (#1005 후속)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P4
---

## Overview

PR [#1005](https://github.com/worker-ants/clemvion/pull/1005)(교차-worktree false ALLOW 차단)의
리뷰 6라운드에서 **비차단으로 분류돼 미조치된 항목**들. 전부 독립적이라 부분 처리해도 되고,
개별로는 티켓 가치가 없어 하나로 묶는다.

> `_run_gates` 의 REVIEW/PLAN 블록 중복은 **여기 포함하지 않는다** — 이미
> [`harness-gate-control-flow-extract.md`](./harness-gate-control-flow-extract.md) (§K) 가 다룬다.
> #1005 리뷰에서 4라운드 연속 지적됐으나 매번 "#999 소유 구조라 여기서 되돌리면 안 됨" 으로
> 일관 미조치했다.

## 체크리스트

### 게이트 계약 — 런타임 추론 → 정적 명시

- [ ] **게이트 인터페이스를 `Protocol` 로 선언** (리뷰 `01_25_15` WARNING 4).
      현재 `_accepts_cwd()` 가 `inspect.signature` 로 "cwd 를 첫 positional 로 받는가" 를 **런타임
      추론**한다. 시그니처가 keyword-only 로 바뀌면 조용히 legacy 경로로 degrade 해
      **false-ALLOW 구멍이 재발**한다 — 코드 docstring 이 그 위험을 스스로 적어 두었다.
      현재 방어선은 `AcceptsCwdContractTest` 하나뿐(단, mutation M8 이 legacy 스위트 17건을
      kill 해 load-bearing 임은 실증됨). `_lib` 에 `GateEvaluator` Protocol 을 두면 계약이
      정적으로 드러난다.
- [ ] **게이트 결과 dataclass 에 공통 `blocked` 도입** (리뷰 `01_25_15` WARNING 5).
      `ReviewDecision.blocked` vs `PlanDecision.untouched` 로 필드명이 달라, 공용 러너
      `_evaluate_over_targets` 호출부마다 `is_blocked` 람다로 흡수한다. 세 번째 게이트가 생기면
      같은 패턴이 또 반복된다. **주의**: 두 dataclass 는 `_lib` 소유라 계약 변경이다.

### 테스트 위생

- [ ] **`_run` 헬퍼에 `extra_env` / `script` 인자 추가** (리뷰 `10_47_09` WARNING 3).
      `test_push_guard_worktree_scope.py` 의 5개 테스트가 `subprocess.run(...)` 호출 · env dict
      구성 · payload JSON 구성을 통째로 복붙한다. 커스텀 env(`BYPASS_*`, `CLAUDE_PROJECT_DIR`)나
      대체 스크립트 경로가 필요해서다.
- [ ] **detached-HEAD worktree 배제를 pin** (리뷰 `10_47_09` INFO 7).
      `_worktree_branches` 파서가 detached worktree 를 조용히 건너뛰는 것은 **의도된 잔여 갭**
      (코드 주석에 문서화)인데 회귀 테스트가 없다. `git worktree add --detach` 로 세 번째
      worktree 를 만들어 배제 동작을 직접 고정.
- [ ] **`_push_targets` 순수 함수 단위 테스트** (리뷰 `10_47_09` INFO 9).
      현재 전량 subprocess e2e 로만 검증돼 "order-stable · de-duplicated · cwd first" 계약이
      **우연히** 통과 중이다. `_worktree_branches` 반환값을 몽키패치하면 저렴하게 고정된다.
- [ ] **`result is None` 분기** (리뷰 `10_47_09` INFO 8).
      `_evaluate_over_targets` 의 방어 분기로, 두 게이트 모두 None 을 반환하지 않아 현재
      unreachable(주석이 스스로 "defensive" 라 인정). 스텁에 None 반환 케이스를 추가해 향후 대비.

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
