# 변경 범위(Scope) 리뷰

## 검증 방법
`git diff origin/main...HEAD` 로 16개 대상 파일 전체(프롬프트에 실리지 않은 `.claude/hooks/_lib/review_guard.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
포함)를 직접 diff·Read 로 대조했고, 두 개의 관련 plan 티켓(`plan/in-progress/harness-consistency-summary-downgrade-rule.md`,
`plan/in-progress/harness-review-gate-ci-backstop.md`)의 체크리스트 서술과 실제 코드 변경을 1:1로 맞춰봤다.

## 발견사항

- **[INFO]** plan 문서의 테스트 건수 서술이 최종 커밋 상태보다 낮게 남아 있다(하향이 아니라 과소— 실제로는 더 늘었다).
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:148`, `plan/in-progress/harness-review-gate-ci-backstop.md:146`
  - 상세: "`test_consistency_bundle_priority.py` 13건" 이라고 적혀 있으나 실측(`grep -c "    def test_"`) 결과 현재 파일은 **18건**이다
    (`CollectContextUsesPriorityTest` 의 `test_related_specs_uses_the_ranked_order` / `test_conventions_uses_the_ranked_order` 등 호출부-단정 테스트가
    이후 리뷰 라운드(1R~4R)에서 추가된 것으로 보인다). 같은 이유로 "`test_review_changeset_warning.py` 11건" 도 실측 **12건**이다.
    두 경우 모두 코드/테스트가 문서보다 더 엄격해진 방향이라 위험하지는 않지만, 이 서술을 "구현 규모의 근거"로 다시 인용할 경우 실제보다 작게 보고하게 된다.
  - 제안: 두 plan 문서의 해당 줄을 최종 실측 건수(18건/12건)로 갱신.

- **[INFO]** `_default_branch_ref()` 신설이 기존에 이미 3곳에 흩어져 있던 "origin 기본 브랜치 해석" 로직의 4번째 독립 구현이다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190` (`def _default_branch_ref():`)
  - 상세: `branch_guard._origin_default_branch()` / `review_guard._default_branch()` / `consistency_orchestrator` 의
    `args.diff_base or "origin/main"` 리터럴과 같은 일을 한다. 다만 이 중복은 저자가 스스로 발견해 즉시 통합하지 않고
    `plan/in-progress/harness-review-gate-ci-backstop.md:67` 의 "신규 후속 (defer)" 항목에 근거(hooks/skills `_lib` 네임스페이스
    충돌 해소가 선행돼야 함)와 함께 명시적으로 defer 했다 — 은폐된 스코프 확장이 아니라 투명하게 추적되는 기술부채다.
  - 제안: 조치 불요(이미 후속 티켓에 등재됨). 그대로 인지만 해두면 된다.

- **[INFO]** `test_guard_review_before_push_main.py` 의 공용 `_run()` 헬퍼에 `cwd=self.tmp` 가 추가돼, 이번 PR 의 좁은 목적
  (`in_flight_ok` opt-in 검증)과 무관한 기존 테스트 전체의 실행 방식이 함께 바뀐다.
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:152` (`def _run(...)`), 실제 인자 추가는 `:191` (`cwd=self.tmp,`)
  - 상세: 새로 추가된 `test_push_never_opts_into_the_in_flight_concession` 하나만을 위한 변경이 아니라 클래스 내 모든 서브프로세스
    호출의 `cwd` 를 바꾸는 변경이다. 다만 diff 안의 주석이 "호출자 체크아웃을 상속하면 머신에 존재하는 다른 worktree 를 보게 돼
    14회 중 1회 재현 안 되는 실패가 나왔다"는 구체적 근거를 남겼고, 이미 `test_stop_guard_failopen.py` 가 쓰는 것과 같은 격리
    패턴이라 새로운 관행도 아니다 — 테스트 전용 코드에 국한된 낮은 리스크의 신뢰성 수정이다.
  - 제안: 조치 불요. 별도 커밋으로 분리했다면 더 깔끔했겠지만 리뷰를 막을 사안은 아니다.

## 스코프 내로 확인된 항목 (참고)
아래는 스코프 이탈처럼 보일 수 있으나 실제로는 plan 티켓 체크리스트에 명시적으로 근거가 있어 정상 범위로 판정한 것들이다.
- `review_guard.py`/`guard_review_before_stop.py` 의 `evaluate_review(in_flight_ok=...)` opt-in화 — `harness-review-gate-ci-backstop.md`
  §관측(2) 의 직접 수정 대상이고, `guard_review_before_push.py` 호출부(`:846`, `_evaluate_over_targets` 를 통해 `evaluate(target)` 로만 호출)는
  실측상 변경되지 않았다 — "push 호출부 무변경" 서술과 일치.
  \n
- `code_review_orchestrator.build_files_section` 의 생략-안내 로직(`_omitted_content_note`/`_aggregate_omission_note`/`_render`) —
  같은 PR 의 리뷰 세션(`review/code/2026/07/31/11_07_48`)에서 실제로 발현한 신규 결함의 즉시 수정으로, `harness-review-gate-ci-backstop.md`
  상단 요약에 그 경위가 그대로 기록돼 있다. 파일 수가 매우 많을 때(n=3000)의 헤더 초과 케이스는 손대지 않고 별도 defer 항목(#4)으로
  남겨, 필요 이상으로 문제를 확장하지 않았다.
  \n
- `consistency_orchestrator.py` 의 `prioritize_bundle_files` 4계층 재배열 + 카탈로그 강등 — `harness-consistency-summary-downgrade-rule.md`
  의 "8회 재발" 체크리스트 항목을 정확히 구현하며, 적용 지점(`--impl-prep`/`--impl-done` scope, `related_specs`, `conventions`,
  `plan_in_progress`)도 plan 문서가 지목한 범위와 일치한다.
  \n
- `.claude/agents/consistency-summary.md` / `.claude/skills/consistency-checker/SKILL.md` 의 "하향 금지 + planner 인계" 조항 —
  같은 plan 문서의 "사용자 결정" 섹션을 그대로 규약 문서에 반영한 것.
  \n
- `codebase/**`, CI 워크플로(`.github/**`), 프로젝트 설정 파일(`.claude/settings.json`, `.claude.project.json` 등)에는 어떤 변경도
  없다 — 이 브랜치는 하네스/리뷰-게이트 도구 자체에만 국한돼 있고, `harness-review-gate-ci-backstop.md` 가 스스로 "CI 백스톱
  본체는 미착수(설계 결정 선행)"라고 명시한 것과 일치한다. 새로 추가된 import 는 모두 신규 테스트 파일에 국한되고 실제로 쓰인다
  (미사용 import 없음).

## 요약
16개 대상 파일 전체를 `origin/main` 대비 diff 로 대조한 결과, 모든 실질 변경이 두 개의 연결된 plan 티켓
(`harness-consistency-summary-downgrade-rule.md`, `harness-review-gate-ci-backstop.md`)의 체크리스트 항목과 1:1로 대응하며,
`codebase/**`·CI 설정·프로젝트 설정 등 무관 영역은 전혀 건드리지 않았다. 발견된 사항은 모두 INFO 수준이다 — plan 문서의 테스트
건수 서술이 이후 리뷰 라운드에서 더 엄격해진 실제 상태보다 낮게 남아 있는 문서 드리프트, 이미 스스로 인지하고 defer 티켓에
등재한 `_default_branch_ref` 중복, 그리고 새 seam 테스트를 위해 기존 테스트 헬퍼의 `cwd` 를 함께 격리시킨 근거 있는 테스트-인프라
수정이다. 세 항목 모두 근거가 diff/plan 문서 안에 이미 남아 있고 은폐된 확장이 아니므로 액션이 필수는 아니다.

## 위험도
LOW
