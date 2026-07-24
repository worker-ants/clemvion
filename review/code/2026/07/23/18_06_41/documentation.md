# 문서화(Documentation) 리뷰 — push-guard-worktree-scope (3차, 18_06_41)

이번 라운드는 1차(17_28_02)·2차(17_51_28) 리뷰에서 각각 발견된 WARNING(1차 7건, 2차 2건)이
전부 코드에 반영된 이후의 누적 diff를 대상으로 한다. 소스(`guard_review_before_push.py`,
`test_push_guard_worktree_scope.py`)를 직접 열어 diff 생략분을 보충 확인했고, harness 전체
스위트를 재실행해 plan 체크리스트의 "486 passed" 주장도 실측 일치를 확인했다(`486 tests, OK`).

## 발견사항

- **[WARNING]** plan 문서에 "2차 리뷰 반영" 서술 섹션이 없음 — 체크리스트만 "전량 반영"을 주장
  - 위치: `plan/in-progress/push-guard-worktree-scope.md` — `## 1차 리뷰(17_28_02) 반영`(64-77행) 다음에 바로 `## 체크리스트`(79행)로 넘어감. 88행의 `- [x] /ai-review — 1차 MEDIUM(C0/W7) · 2차 MEDIUM(C0/W2) 전량 반영. 3차 게이트 리뷰 예정` 이 유일한 2차 언급.
  - 상세: 1차 리뷰의 WARNING 7건은 표 형식으로 각 항목·조치가 plan 본문에 상세히 기록되어 있다(문제→설계→조치 순으로 추적 가능). 반면 2차 리뷰(`review/code/2026/07/23/17_51_28/RESOLUTION.md`)가 발견한 WARNING 2건 — (1) `_run_gate` 의 per-target fail-open 불변식이 테스트로 고정되지 않아 `continue`→`return False` mutation 이 38/38 green 이었던 것(이 PR 이 닫으려는 것과 같은 클래스의 false-ALLOW), (2) `_run_gate` 의 죽은 파라미터 `base_cwd` 제거 + 나머지 인자 keyword-only 화 — 는 plan 본문 어디에도 서술되지 않는다. mutation 표의 M6 행(101행)이 "2차 리뷰 전에는 38/38 생존"이라는 한 조각만 남길 뿐, `base_cwd` 관련 조치는 plan 문서 전체에서 전혀 언급되지 않는다(`grep base_cwd plan/in-progress/push-guard-worktree-scope.md` → 0건). 코드 자체는 두 항목 모두 정확히 반영되어 있음을 직접 확인했다(`_run_gate` 시그니처가 `*, is_blocked, render` 로 keyword-only이고 `base_cwd` 파라미터가 없음; `test_per_target_fail_open_still_checks_remaining_targets` 존재). 즉 코드는 옳지만, 이 plan 이 스스로 확립한 "라운드별 반영 내역을 본문에 남긴다"는 관례가 2차에서만 깨져 감사 추적성이 비대칭적이다.
  - 제안: 1차 섹션과 대칭되는 `## 2차 리뷰(17_51_28) 반영` 절을 추가해 WARNING 1(per-target fail-open 미검증)·WARNING 2(`base_cwd` dead parameter)와 그 조치를 표로 남길 것. 이번(3차) 라운드가 clean 으로 수렴하면 그다음 plan 종결 시점에 한 번에 정리해도 무방.

- **[INFO]** 테스트 카탈로그 항목이 PLAN-게이트 스코핑·시그니처 계약 핀을 이름으로 언급하지 않음 (1·2차 문서화 리뷰가 이미 "1:1 대응"으로 판정, 새 차단 사유 아님)
  - 위치: `.claude/tests/README.md:45` (`test_push_guard_worktree_scope.py` 행) vs `.claude/tests/test_push_guard_worktree_scope.py` 의 `test_plan_gate_is_scoped_too`/`test_plan_gate_unrelated_worktree_does_not_block`(PLAN 게이트 스코핑), `AcceptsCwdContractTest`(시그니처 계약 핀)
  - 상세: 카탈로그 문장은 `_mentions_branch` 경계 매칭·cwd 상시평가·blanket-block 아님·`BYPASS_*` 전파 4가지만 이름으로 짚고, "the gates evaluate"(복수)라는 표현으로 REVIEW/PLAN 둘 다를 암묵적으로 포괄한다. 그러나 PLAN 게이트가 REVIEW 와 독립적으로 스코핑되는지를 검증하는 테스트(1차 리뷰 WARNING 1 로 추가된, 스코핑 결함의 "테스트되지 않은 절반")와, plan 문서가 "핵심 핀"이라 명시한 `AcceptsCwdContractTest`(시그니처가 keyword-only 로 바뀌면 조용히 false-ALLOW 로 회귀하는 것을 막는 유일한 핀)는 카탈로그 어디에도 이름이 없다. 1차·2차 문서화 리뷰(`review/code/2026/07/23/17_28_02/documentation.md`, `17_51_28/documentation.md`)가 모두 "카탈로그가 18개 테스트와 1:1 대응"이라고 판정했지만, 실제로는 테마 요약(스코핑 자체를 다룬다)일 뿐 이 두 안전핀은 문장에 등장하지 않는다.
  - 제안: 급하지 않음(이미 두 라운드가 수용 가능으로 판정). 다음에 이 카탈로그 행을 만질 일이 있으면 "PLAN 게이트도 동일하게 스코핑됨" 및 "`evaluate_review`/`evaluate_plan` 실제 시그니처가 positional cwd 를 받는지 고정하는 계약 테스트 포함" 한 구절씩 추가하는 정도로 충분.

- **[INFO]** 모듈 최상단 docstring 이 cross-worktree 평가 동작을 여전히 요약하지 않음 (1·2차에서 이미 발견·의도적 보류, 재확인만)
  - 위치: `.claude/hooks/guard_review_before_push.py:1-24`(module docstring) vs `:316-349`("Which worktree(s) does this push publish?" 설계 블록)
  - 상세: 소스를 직접 열어 재확인한 결과 최상단 docstring 은 여전히 "REVIEW gate / PLAN gate, 각각 하나의 override" 수준으로만 계약을 서술한다. 이번 PR 의 핵심(과거엔 cwd 만 봤고 그게 false-ALLOW 버그였다는 것)은 316행부터의 상세 블록에만 있다. `review/code/2026/07/23/17_28_02/RESOLUTION.md`(38행)가 이 항목을 "미조치 — 비차단, 선택"으로 명시적으로 보류했고 2차에서도 재확인 후 재차 보류됐다 — 새 차단 사유 아님.
  - 제안: (선택) 상단 docstring 에 "각 게이트는 cwd 뿐 아니라 push 명령이 이름을 언급한 다른 checked-out worktree 도 평가한다" 한 줄.

- **[INFO]** `guard_review_before_stop.py` 가 이 fix 범위에서 제외된 이유가 여전히 문장으로 없음 (1·2차 이월, 재확인만)
  - 위치: `.claude/hooks/guard_review_before_stop.py`(245·262행, 여전히 `evaluate_review()`/`evaluate_plan()` 무인자 호출 — 직접 확인) / `plan/in-progress/push-guard-worktree-scope.md`(Stop 훅 관련 서술 없음)
  - 상세: Stop 훅은 "지금 이 턴이 끝나는 worktree 자체"를 판정하므로 다른 branch 를 지목할 대상 개념이 없어 구조적으로 스코프 밖이라는 설명은 합리적이나, 그 판단이 코드·plan·리뷰 산출물 서술 어디에도 문장으로 남아있지 않다. 1·2차 모두 "선택, 비차단"으로 명시적 보류.
  - 제안: (선택) 316행 블록 또는 plan 에 한 줄 근거.

## 검증한 항목 (문제 없음)

- `_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`/`_run_gate` 전부 실패 모드·설계 근거·실제 사고 사례(날짜 포함)를 갖춘 docstring 을 유지하고 있으며, 소스와 대조해 서술이 정확함을 확인. 특히 `_run_gate` docstring 의 "두 불변식"(게이트 격리·per-target fail-open) 서술은 2차에서 새로 추출된 헬퍼임에도 여전히 정확하고 `base_cwd` 를 참조하지 않는다(2차 WARNING 2 조치가 docstring 에도 온전히 반영됨).
- `plan/in-progress/push-guard-worktree-scope.md` 의 "harness 전체 486 passed" 를 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 직접 재실행해 **486 tests, OK** 로 실측 일치 확인.
- `.claude/docs/orchestrator-workflow-migration.md`·`.claude/docs/plan-lifecycle.md`·`.claude/skills/developer/SKILL.md` 등 이 훅을 참조하는 상위 문서들은 모두 "unreviewed 코드/plan 이면 push 차단"이라는 외부 계약 수준만 서술하며, 이번 fix 는 그 계약을 바꾸지 않고 정확히 만드는 내부 수정이라 갱신 불요.
- README API 문서·신규 환경변수 문서화 대상 없음(`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 는 기존 변수). CHANGELOG.md 는 제품(codebase) 사용자 기능 변경만 기록하는 문서로, 이번 harness 전용 변경은 관례상 대상 밖(1·2차 판정 재확인).
- `review/code/2026/07/23/{17_28_02,17_51_28}/*` 산출물은 각자 "대상: 커밋 <SHA>" 를 명시한 시점 스냅샷 감사 기록이며, 이후 `_run_gate` 추출로 라인 번호가 달라졌어도 문제 아님(프로젝트 관례 — `review/` 는 커밋 대상인 히스토리).

## 요약

핵심 문서화 자산(신규 헬퍼 5종의 docstring, plan 설계 문서, mutation/pass-count 실측 주장)은 소스와 대조해 정확함을 재확인했고 전반적으로 높은 수준을 유지한다. 이번 라운드에서 새로 발견한 것은 plan 문서가 스스로 확립한 "라운드별 반영 내역을 본문에 표로 남긴다"는 관례가 2차 리뷰(WARNING 2건: per-target fail-open 미검증 픽스, `base_cwd` dead parameter 제거)에서만 깨져 체크리스트의 "2차 전량 반영" 주장이 본문 근거 없이 남아 있다는 점(WARNING)이다. 코드 자체는 두 조치 모두 정확히 반영되어 있어 기능적 결함은 아니다. 나머지 세 항목(테스트 카탈로그의 PLAN/계약-핀 미언급, 모듈 상단 docstring 미요약, Stop 훅 제외 근거 부재)은 1·2차에서 이미 발견되어 의도적으로 보류된 INFO 로, 재확인 결과 여전히 사실이지만 새로운 차단 사유는 아니다.

## 위험도

LOW
