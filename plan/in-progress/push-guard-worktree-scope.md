---
worktree: push-guard-worktree-scope-20044c
started: 2026-07-23
owner: developer
---

# push 가드 worktree 스코프 — 교차-worktree false ALLOW 차단

> 작성일: 2026-07-23
> 트리거: 2026-07-23 세션에서 `claude/presentation-previousoutput-spec-drift-e74b2f`(PR #997) push 가
> **정상 상태인데도 차단**된 사건. 진단 결과 반대 방향의 **false ALLOW** 가 함께 있었다.
> 선행: [#992](https://github.com/worker-ants/clemvion/pull/992) (push 탐지 blind 1차 + allowlist)

## 문제 — 게이트가 "push 되는 worktree" 가 아니라 "훅의 cwd" 를 평가한다

두 게이트(`review_guard` / `plan_guard`)는 **worktree**(HEAD + working tree)를 평가한다. 그런데
`guard_review_before_push.py` 는 `evaluate_review()` 를 **인자 없이** 호출해 훅 프로세스의 cwd 를
본다. 이 저장소는 모든 작업이 `.claude/worktrees/<task>-<slug>/` 에 있고(현재 15개), 에이전트가
`cd <다른-worktree> && git push origin <그 branch>` 를 일상적으로 한다 — 그때 훅의 cwd 는 **push
대상과 다른 worktree** 다.

| 방향 | 결과 |
|---|---|
| cwd 는 리뷰 중, push 대상은 clean | **false BLOCK** — 성가시지만 안전 |
| cwd 는 clean, push 대상은 미리뷰 | **false ALLOW** — **리뷰 게이트가 실제로 우회된다** |

**실측 (2026-07-23)**:

```
evaluate_review(<갓 만든 clean worktree>)          → blocked=False
evaluate_review(<게이트 미해소 branch 의 worktree>) → blocked=True
```

즉 clean worktree 에서 push 를 실행하면 게이트가 통째로 건너뛰어진다. 이게 이번 수정이
편의가 아니라 **정합성 수정**인 이유다.

## 설계 — blind 텍스트 매칭, 파서 아님

`_is_git_push` 는 의도적으로 blind 다(그 docstring: 2026-07-17 shlex 재작성은 라운드마다 새
false-negative 클래스가 나와 **철회**됐다). 같은 철학을 지킨다 — **refspec 을 파싱하지 않는다.**
대신 체크아웃된 각 branch 에 대해 *"이 branch 이름이 명령 텍스트에 등장하는가"* 만 묻는다.

- 평가 대상 = **cwd(항상)** + **명령이 이름을 언급한 worktree**.
- 경계 매칭(`[A-Za-z0-9._/-]` 이웃 금지)이라 짧은 이름이 긴 토큰 안에서 오탐되지 않는다
  (`claude/foo` ≠ `claude/foo-abc`).
- 커밋 메시지에 branch 이름이 있으면 그 worktree 도 평가된다 → **더 엄격해질 뿐 약해지지 않는다**.
  blind push 정규식이 이미 하는 것과 같은 거래다.
- 체크아웃 안 된 branch 를 push 하면 추가 커버리지는 없다(평가할 working state 가 없다) —
  동작은 정확히 기존과 동일, **회귀 없음**.

### 시그니처 probe 가 load-bearing 이다

초안은 `evaluate_review(target)` 를 그냥 호출하고 예외를 `except Exception: continue` 로 삼켰다.
그 결과 **stub 게이트(무인자)가 TypeError 를 내며 게이트가 조용히 사라져** 기존 blocking 테스트
9건이 전부 exit 0 이 됐다. 시그니처 불일치를 fail-open 으로 만들면 안 된다 →
`_accepts_cwd()` 로 명시 probe 하고, 미지원이면 **legacy 단일-worktree 호출로 degrade**
(수정보다 약하지만 기존 동작보다 약하지 않다).

## 부수 개선

차단 메시지에 `worktree:` 줄 추가. 기존 메시지는 **어느 worktree 가 막았는지 안 밝혀** 이번 사건의
진단을 어렵게 만든 직접 원인이었다.

## 체크리스트

- [x] 구멍 실증 (두 worktree 대조 실측)
- [x] `_worktree_branches` / `_mentions_branch` / `_push_targets` 구현
- [x] `_accepts_cwd` 시그니처 probe (silent fail-open 차단)
- [x] 차단 메시지에 worktree 표기
- [x] 테스트 9건 신설 + 카탈로그 등재
- [x] mutation 실측 4건
- [x] harness 전체 476 passed
- [ ] `/ai-review`

## mutation 실측

원복은 백업 `cp` + 절대경로. base 는 **편집 후 재캡처**(stale base 로 미커밋 작업이 사라진 전례).

| # | mutation | red 가 된 테스트 |
|---|---|---|
| M1 | `_push_targets` 를 `[cwd]` 로 고정 (= 수정 전 동작) | `test_false_allow_hole_is_closed` **단독** |
| M2 | `_mentions_branch` 경계 검사 제거 (평문 substring) | `test_substring_of_longer_branch_does_not_match` **단독** |
| M3 | `_accepts_cwd` probe 제거 (`scoped = True` 고정) | legacy 스위트 **5건** — probe 가 load-bearing 임을 증명 |
| M4 | `targets` 에서 cwd 제외 | `test_cwd_worktree_is_still_evaluated` **단독** |

원복 후 mutation 마커 grep **0건**.

## Rationale

**왜 "모든 worktree 평가" 가 아닌가**: 15개 worktree 중 하나라도 dirty 하면 모든 push 가 막힌다 —
사용 불가. cwd + 언급된 branch 로 한정하면 false ALLOW 는 닫으면서 실용성을 유지한다.

**왜 refspec 을 파싱하지 않는가**: `git push origin a:b`, `HEAD:refs/heads/x`, `--force-with-lease=…`
등 git 인자 문법 + 그 위의 셸 문법은 #970/#992 가 이미 무한 표면으로 판정한 영역이다. blind
substring 은 무지해서 안전하고, 틀리는 방향이 **항상 엄격한 쪽**이다.

**남은 갭(의도)**: 체크아웃되지 않은 branch 를 push 하는 경우는 커버하지 않는다. 평가할 worktree 가
없어 원리적으로 불가하며, 기존 동작 대비 회귀는 아니다.
