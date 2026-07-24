# 요구사항(Requirement) 리뷰 — push 가드 worktree 스코프 (4차/확인 라운드)

## 검증 방법

핵심 구현 파일(`.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_worktree_scope.py`,
`plan/in-progress/push-guard-worktree-scope.md`)의 diff 가 프롬프트에서 크기 제한으로 생략돼 있어,
`git diff origin/main...HEAD` 로 직접 재추출하고 `Read` 로 전체 파일을 열어 line-level 로 대조했다.
추가로 `.claude/hooks/_lib/review_guard.py::evaluate_review` / `_lib/plan_guard.py::evaluate_plan` 의
실제 시그니처·필드명(`ReviewDecision.blocked/reason`, `PlanDecision.untouched/reason/plan_path`)을
직접 열어 `_run_gate` 의 `is_blocked`/`render` 람다가 참조하는 필드와 대조했다. 정적 분석에 그치지
않고 실제로 재실행했다:

- `python3 -m unittest discover -s .claude/tests -p 'test_push_guard_worktree_scope.py' -v` → **20 passed**
- `python3 -m unittest discover -s .claude/tests -p 'test_guard_review_before_push_main.py' -v` → **20 passed**
  (레거시 무인자 스텁 스위트 — `_accepts_cwd` degrade 경로와 `payload.get("cwd") or os.getcwd()`
  폴백을 매 케이스 암묵적으로 통과시킨다)
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **487 passed** (plan/RESOLUTION 의
  주장과 일치)

이 브랜치는 이미 `/ai-review` 3라운드(17_28_02 → C0/W7, 17_51_28 → C0/W2, 18_06_41 → C0/W2)를
거쳤고 RESOLUTION.md 3건이 각 WARNING 을 mutation 재현으로 검증한 뒤 반영했다고 기록한다. 본 라운드
(18_22_56)는 plan 체크리스트가 예고한 "4차 게이트 리뷰"이므로, 과거 라운드가 이미 고친 항목을
재제기하지 않고 **최종 코드 상태**를 독립적으로 재검증하는 데 집중했다.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 — 정상 (harness 전용 변경)
  - 위치: `.claude/hooks/guard_review_before_push.py` 전체
  - 상세: `spec/` 를 `grep -rl "guard_review_before_push"` 로 재확인해도 0건. CLAUDE.md 의 폴더
    구조상 `spec/` 는 제품(`codebase/`) 정의이고 `.claude/hooks/` 하네스 자동화는 그 범위 밖이라
    기대된 결과다. `plan/in-progress/push-guard-worktree-scope.md` 가 설계 문서 역할을 하며,
    실제 구현(`_push_targets`/`_mentions_branch`/`_accepts_cwd`/`_run_gate`/메시지 `worktree:`
    라인)을 그 문서의 문제·설계·Rationale·mutation 표와 대조한 결과 서술과 코드가 정확히 일치한다
    (아래 "검증한 항목" 참조).
  - 제안: 조치 불요.

- **[INFO]** `_run_gate` 로 REVIEW/PLAN 게이트를 통합한 뒤에도 필드명·불변식이 실제 게이트 모듈과
  1:1로 맞음을 직접 대조 확인
  - 위치: `.claude/hooks/guard_review_before_push.py:494-520`(`_run_gate`), `:542-561`(호출부),
    `.claude/hooks/_lib/review_guard.py:155-157`(`ReviewDecision`), `_lib/plan_guard.py:78-84`
    (`PlanDecision`)
  - 상세: `is_blocked=lambda d: d is not None and d.blocked` / `render=lambda d, wt:
    _REVIEW_MSG.format(reason=d.reason, worktree=wt)` 가 참조하는 `.blocked`/`.reason` 은
    `ReviewDecision` 실제 필드와 정확히 일치하고, PLAN 쪽 `.untouched`/`.reason`/`.plan_path` 도
    `PlanDecision` 과 일치한다(필드명 오타·타입 불일치 없음). `main()` 의 모든 경로(`not
    _is_git_push` → 0, REVIEW block → 2, PLAN block → 2, 정상 종료 → 0)가 빠짐없이 `int` 를
    반환함을 함수 전체를 읽어 확인 — 반환값 누락 경로 없음.
  - 제안: 조치 불요.

- **[INFO]** 핵심 요구사항("push 대상 worktree 를 cwd 대신/추가로 평가")이 실제로 동작함을 e2e 로
  독립 재확인
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py::test_false_allow_hole_is_closed`
    (cwd 는 clean, push 대상 branch 의 worktree 는 dirty → 반드시 차단),
    `::test_unrelated_dirty_worktree_does_not_block`(무관 worktree 가 dirty 해도 통과 — "모든
    worktree 검사" 로 과잉 확장되지 않음), `::test_bypass_still_applies_to_scoped_targets`
    (BYPASS_* 가 스코프 확장 후에도 여전히 적용)
  - 상세: 세 테스트 모두 직접 재실행해 통과를 확인했고, 코드(`_push_targets`)와 정확히 대응하는
    동작임을 확인했다. "더 엄격해질 뿐 약해지지 않는다"는 plan Rationale 의 핵심 주장이 실제
    테스트 매트릭스로 뒷받침된다.
  - 제안: 조치 불요.

- **[INFO]** 3라운드에 걸친 자기 정정(self-correction) 이력이 감사 가능한 형태로 코드·plan 에
  남아 있고, 최신 상태에서 그 정정이 실제로 유효함을 확인
  - 위치: `plan/in-progress/push-guard-worktree-scope.md:79-96`(2차·3차 리뷰 반영 절),
    `.claude/tests/test_push_guard_worktree_scope.py:246-261`(`test_per_target_fail_open_...`),
    `:280-320`(`test_push_targets_crash_falls_back_to_cwd`)
  - 상세: 1차 RESOLUTION 이 "PLAN 게이트 스코핑도 커버된다"고 오기재했다가 2차 리뷰가 반증했고,
    2차 RESOLUTION 이 다시 "`main()` 폴백도 커버된다"고 오기재했다가 3차 리뷰가 반증한 이력이
    plan 에 그대로 남아 있다. 이번 라운드에서 `test_per_target_fail_open_still_checks_remaining_targets`
    와 `test_push_targets_crash_falls_back_to_cwd` 를 직접 실행해 실제로 pass 함을 확인했고,
    각 테스트가 pin 하는 불변식(target 단위 fail-open, `main()` 의 `_push_targets` 예외 폴백)이
    코드(`_run_gate` 의 `except Exception: ... continue`, `main()` 의 `try/except Exception:
    targets = [base_cwd]`)와 정확히 대응함을 라인 단위로 확인했다. 동일 실수를 세 번 반복한 뒤
    "커버 주장 전에 뮤턴트로 실측" 이라는 규칙을 plan 에 명문화한 점도 확인.
  - 제안: 조치 불요. (참고: 이 패턴은 사용자 메모리의 "커버된다는 추론이 아니라 실측이어야 한다"
    교훈과 정확히 일치하며, 이번 세션에서도 재확인됐다.)

## 검증한 항목 (문제 없음)

- `_push_targets`/`_mentions_branch`/`_accepts_cwd`/`_run_gate` 4개 함수 모두 docstring 이 서술하는
  계약과 실제 구현이 일치. 특히 `_accepts_cwd` 는 `AcceptsCwdContractTest` 로 실제
  `review_guard.evaluate_review`/`plan_guard.evaluate_plan` 시그니처에 대해 `True` 를 반환함을
  직접 재확인(테스트 통과).
- `_run_gate` 추출이 기존 20건짜리 `test_guard_review_before_push_main.py`(무인자 레거시 스텁,
  게이트 순서/BYPASS/fail-open 검증)를 회귀 없이 전량 통과시킴 — 리팩터가 기존 계약을 깨지
  않았음을 직접 재실행으로 확인.
- TODO/FIXME/HACK/XXX 주석: `grep` 결과 diff 대상 3개 파일 전체에서 0건.
- `.claude/tests/README.md` 카탈로그 1행 추가가 실제 테스트 파일의 범위 서술과 부합 (다만 세부
  테스트 개수는 명시하지 않아 이후 테스트가 늘어나도(9→20건) 깨지지 않는 서술 방식).
- 데이터 유효성: `payload.get("cwd") or os.getcwd()` 폴백은 `test_guard_review_before_push_main.py`
  의 기본 `_run()` 헬퍼가 `cwd` 키 없는 payload 를 보내므로 20개 기존 테스트 전부가 이 경로를
  암묵적으로 통과시키며 통과 확인 — 별도 전용 테스트는 없지만 실질적으로 미검증 경로가 아니다.

## 요약

핵심 기능(교차-worktree false-ALLOW 차단: cwd 뿐 아니라 push 명령이 언급한 다른 checked-out
branch 의 worktree 도 평가)은 코드·테스트·plan 문서 사이에 line-level 로 정확히 일치하며, 관련
spec 문서가 없는 것은 하네스(`​.claude/`) 범위이므로 기대된 결과다(spec drift 아님). 이 브랜치는
이미 3라운드의 `/ai-review` → mutation 실측 기반 RESOLUTION 을 거쳤고, 그 과정에서 실제로 발견된
두 개의 진짜 false-ALLOW 급 커버리지 구멍(PLAN 게이트 스코핑 미검증, `main()` 의 `_push_targets`
예외 폴백 미검증)을 스텁을 경로-키 방식으로 바꾸고 실제로 raise 시키는 테스트로 닫았음을 이번
라운드에서 코드 읽기 + 전체 스위트 재실행(20건 신규 + 20건 레거시 + 487건 전체)으로 독립
재확인했다. 반환값 누락 경로, 미완성 TODO, 함수명-구현 불일치, 검증되지 않은 에러 시나리오는
발견되지 않았다. 이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다 — 이전 라운드가 이미 식별해
반영한 항목들(REVIEW/PLAN 루프 DRY, `_accepts_cwd` 계약 고정, 길이 상한, per-target fail-open,
`main()` 폴백)은 모두 코드에 반영되어 있고 재발 여부를 재확인했을 뿐 재제기하지 않았다.

## 위험도

LOW
