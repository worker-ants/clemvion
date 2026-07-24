# 문서화(Documentation) 리뷰 — push-guard-worktree-scope (4차, 18_22_56)

이 라운드는 1차(17_28_02)·2차(17_51_28)·3차(18_06_41) 리뷰가 각각 발견한 문서화 WARNING/INFO가
전부 처리된 이후의 누적 diff(코드 1파일 + 테스트 1파일 + plan 1파일 + README 1행 + 3라운드분
리뷰 산출물 34개)를 대상으로 한다. 소스(`guard_review_before_push.py`,
`test_push_guard_worktree_scope.py`, `plan/in-progress/push-guard-worktree-scope.md`)를 직접
열어 diff 생략분을 보충 확인했고, harness 전체 스위트를 재실행해 plan 체크리스트의 정량 주장을
실측 대조했다(`487 tests, OK`, `grep -c "def test_"` = 20, mutation 표 M1~M7(M3 분리로 8건) 일치).

## 발견사항

- **[WARNING]** 감사기록 라운드 오귀속 — "2차 RESOLUTION 이 틀렸다"는 서술이 실제로는 1차(17_28_02) RESOLUTION 을 가리켜야 함
  - 위치: `review/code/2026/07/23/18_06_41/RESOLUTION.md` 9행(`### 1. ... — **내 2차 RESOLUTION 이 틀렸다**`)·11행(`2차에서 나는 이 경로를 "위 2건이 커버" 라고 적었다.`)·24행(`**2차 RESOLUTION 의 과대 표기도 정정**했다.`), `plan/in-progress/push-guard-worktree-scope.md` 90행(`| 1 \`main()\` 의 \`_push_targets\` 폴백 무검증 | **내 2차 RESOLUTION 이 이 경로를 "커버됨" 이라 주장했으나 틀렸다.** ... |`)
  - 상세: "`_push_targets` 실패 폴백을 '위 2건이 커버' 라고 (잘못) 주장한" 문장의 실제 출처를 `git show 89c3870b4 -- review/code/2026/07/23/17_28_02/RESOLUTION.md` 로 직접 대조했다. 정정 전 원문(1차 RESOLUTION, `17_28_02/RESOLUTION.md` 옛 버전)은 "**반영** — 위 2건이 같은 경로를 커버. 폴백 시에도 cwd 검사는 살아있음을 단언" 이었고, 이번 커밋(`89c3870b4`)이 바로 그 줄을 "**반영이 불완전했다 (3차 리뷰가 재지적)** — 당시 '위 2번이 같은 경로를 커버' 라고 적었으나 **틀렸다**"로 정정했다(같은 파일, 같은 커밋 diff hunk로 직접 확인). 즉 잘못된 "커버됨" 주장의 실제 저자는 **1차(17_28_02) RESOLUTION**이고, 1차 RESOLUTION 자신도 "당시"(자기 자신을 지칭)라고 정확히 자기 귀속했다. 반면 `18_06_41/RESOLUTION.md`(3차 RESOLUTION, 같은 커밋에서 신설)와 그로부터 파생된 `plan.md` 90행은 동일한 사건을 "**2차** RESOLUTION 이 틀렸다"로 서술한다. `17_51_28/RESOLUTION.md`(2차, 전문을 재확인)에는 `_push_targets` 폴백이나 "위 2건이 커버" 류 문구가 전혀 등장하지 않는다(WARNING 1은 `_run_gate` per-target fail-open, WARNING 2는 `base_cwd` 죽은 파라미터로 완전히 다른 항목). 흥미롭게도 같은 라운드(18_06_41)의 `SUMMARY.md`(리뷰어가 작성, 개발자 RESOLUTION 보다 먼저 존재)는 정확히 `` `review/code/2026/07/23/17_28_02/RESOLUTION.md`가 이 경로를 "커버됨"이라 기재했으나 `` 로 **1차**를 올바르게 지목한다 — 즉 같은 라운드 안에서 리뷰어 산출물(SUMMARY.md, 정확)과 개발자 산출물(RESOLUTION.md, 오귀속) + plan.md(오귀속을 그대로 이어받음)가 서로 모순된다.
  - 제안: `review/code/2026/07/23/18_06_41/RESOLUTION.md`의 "2차" 3곳과 `plan/in-progress/push-guard-worktree-scope.md` 90행의 "2차"를 "1차"로 정정. `RESOLUTION.md`의 "## 교훈 — 같은 실수를 세 번 했다" 절(59-60행) 중 "2차: '위 2건이 커버' 주장 → 3차가 `main()` 폴백 미검증 발견." 줄도 같은 오귀속을 반복하므로 함께 정정 대상. 이번 커밋이 `17_28_02/RESOLUTION.md`를 정정하며 스스로 세운 "감사기록은 실측대로" 원칙(같은 파일 "## 교훈" 절 참고)을 이 신설 문서 자신은 지키지 못한 사례라, 다음 라운드(또는 plan 종결 시점)에 한 줄 정정을 남기는 편이 이 세션 전체의 감사 추적 신뢰도에 부합한다. 기능 코드에는 영향 없음.

- **[INFO]** 모듈 최상단 docstring 이 cross-worktree 평가 계약을 여전히 요약하지 않음 (1~3차에서 이미 발견·의도적 보류, 4라운드째 재확인만)
  - 위치: `.claude/hooks/guard_review_before_push.py` 1-24행 (module docstring) vs 315-349행("Which worktree(s) does this push publish?" 설계 블록)
  - 상세: 소스를 직접 열어 재확인한 결과 최상단 docstring 은 여전히 "REVIEW gate / PLAN gate, 각각 하나의 override" 수준으로만 계약을 서술한다. `plan/in-progress/push-guard-worktree-scope.md` 93행("INFO 미조치: 모듈 상단 docstring 요약 ...")이 스스로 미조치임을 명시하고 있어 은폐된 갭은 아니다 — 3라운드 연속 "선택/급하지 않음"으로 명시적 보류된 항목의 재확인.
  - 제안: (선택, 이월) 상단 docstring 에 "각 게이트는 cwd 뿐 아니라 push 명령이 이름을 언급한 다른 checked-out worktree 도 평가한다" 한 줄.

- **[INFO]** 테스트 카탈로그 1행이 4라운드에 걸쳐 늘어난 안전핀 테스트들을 여전히 이름으로 언급하지 않음 — 최초 커밋 이후 갱신 0회
  - 위치: `.claude/tests/README.md:45` (`test_push_guard_worktree_scope.py` 행)
  - 상세: `git diff origin/main...HEAD --stat` 기준 이 파일은 전체 diff 에서 정확히 **+1행**만 발생했다 — 즉 1차(17_28_02) 커밋에서 처음 추가된 이후 지금까지 단 한 번도 수정되지 않았다. 그 사이 테스트는 9→18→19→20건으로 늘었고, PLAN 게이트 스코핑 테스트(1차 WARNING 1), `AcceptsCwdContractTest`(1차 WARNING 5, plan 문서가 "핵심 핀"이라 명시), per-target fail-open 회귀 테스트(2차 WARNING 1), `test_push_targets_crash_falls_back_to_cwd`(3차 WARNING 1) 가 순서대로 추가됐지만, 카탈로그 문장은 여전히 1차 시점의 4가지(경계 매칭·cwd 상시평가·blanket-block 아님·BYPASS 전파)만 서술한다. 3차 문서화 리뷰(`18_06_41/documentation.md`)가 이미 이 갭을 INFO로 지적하며 "PLAN 게이트도 동일하게 스코핑됨" · "시그니처 계약 테스트 포함" 두 구절 추가를 제안했으나 이번 라운드에도 반영되지 않았다 — 급하지 않음으로 재차 이월되는 항목이지만, 카탈로그가 "이 테스트 파일이 막는 회귀 클래스가 무엇인가"를 알려주는 유일한 진입점이라는 점에서 라운드가 늘수록 실제 커버리지와의 괴리가 누적되고 있다.
  - 제안: (선택, 이월) 카탈로그 문장에 "PLAN 게이트도 동일하게 스코핑됨" 및 "`evaluate_review`/`evaluate_plan` 실제 시그니처가 positional cwd 를 받는지 고정하는 계약 테스트 포함" 두 구절 추가.

## 검증한 항목 (문제 없음)

- `plan/in-progress/push-guard-worktree-scope.md`에 `## 2차 리뷰(17_51_28) 반영`·`## 3차 리뷰(18_06_41) 반영` 두 절이 1차 절과 대칭 형식(표)으로 신설되어 있음을 직접 확인 — 3차 문서화 리뷰가 지적한 WARNING("plan에 2차 반영 섹션 부재")이 정확히 해소됨.
- `guard_review_before_stop.py`가 이 fix 범위에서 제외된 이유가 이제 `plan.md` 93-94행에 한 줄로 명시됨을 확인("Stop 훅엔 '지목할 다른 branch' 개념이 구조적으로 없다") — 1~3차에서 이월되던 INFO 항목이 이번 라운드에 실제로 해소됨(코드 316행 블록 자체는 여전히 언급 없으나, 과거 제안이 "코드 블록 또는 plan 문서" 둘 중 하나로 명시했으므로 충족).
- 신규 테스트 `test_push_targets_crash_falls_back_to_cwd`(`.claude/tests/test_push_guard_worktree_scope.py`)의 docstring 이 회귀 시나리오·근거(WARNING 인용)·재현 방법(mutation `targets = []` → 39/39 green)·수정 접근(훅 사본을 패치해 실제 `main()` 제어 흐름을 자극)을 구체적으로 서술 — 이 파일의 기존 컨벤션과 일관되게 매우 충실함.
- 기존 테스트 `test_worktree_listing_failure_degrades_to_cwd`의 docstring에 "NOTE this exercises `_worktree_branches`'s OWN fail-open ..., not `main()`'s `except`"가 추가되어, 이름과 모양이 비슷한 두 개의 서로 다른 fail-open 경로를 향후 독자가 다시 혼동하지 않도록 명시적으로 구분함.
- `plan/in-progress/push-guard-worktree-scope.md` 체크리스트의 정량 주장(테스트 **20건**, harness 전체 **487 passed**, mutation **8건**)을 각각 `grep -c "def test_"`(20), `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`(487 tests, OK), mutation 표 M1/M2/M3a/M3b/M4/M5/M6/M7(8행)로 직접 재검증해 실측 일치 확인.
- `review/code/2026/07/23/17_28_02/RESOLUTION.md`를 후속 커밋(`89c3870b4`)에서 사후 정정한 방식 자체는 투명함 — "**반영이 불완전했다 (3차 리뷰가 재지적)**"로 원래 주장이 틀렸음을 명시하고, git 이력에 정정 전 원문이 보존되며, 새 커밋 메시지에도 정정 사유가 남는다. 감사기록을 몰래 다시 쓰는 것이 아니라 출처를 밝히며 고친 사례라 문서화 관점에서 바람직한 관행으로 판단(위 WARNING의 "2차/1차" 오귀속과는 별개 사안).
- CHANGELOG.md·README(제품)·API 문서: 이번 diff 전체가 harness 전용 변경(`codebase/**` 무변경)이라 갱신 대상이 없다는 1~3차 판정을 재확인. 신규 환경변수도 없음(`STUB_RAISE_PATHS`는 테스트 픽스처 내부 전용, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`는 기존 변수).
- `review/code/2026/07/23/{17_28_02,17_51_28,18_06_41}/*` 34개 파일은 각자 "대상: 커밋 `<SHA>`"를 명시한 시점 스냅샷 감사 기록이며, 프로젝트 관례(`review/`는 커밋 대상, SUMMARY·RESOLUTION 포함)에 부합한다. `scope.md`(18_06_41)가 `git merge-base`로 fork-point를 명시적으로 고정해 "역방향 diff 오염"(origin/main이 1커밋 앞서 있어 무관 파일이 섞이는 문제, 이 프로젝트 메모리에도 기록된 이슈)을 피한 점도 검증 방법론으로서 정확함을 확인.

## 요약

핵심 코드(`guard_review_before_push.py`)에는 이번 라운드에서 변경이 없고(직전 라운드 이후 diff는 테스트 1건 + plan 문서 + 리뷰 산출물), 그 변경분의 문서화 품질은 대체로 높다 — 신규/수정 테스트 docstring이 회귀 근거·재현 방법을 구체적으로 남기고, 직전 라운드 WARNING("plan에 2차 반영 섹션 부재")과 이월 INFO("Stop 훅 제외 근거")가 모두 실제로 해소됨을 코드 레벨로 확인했다. 다만 그 해소 과정에서 새로 발견한 것은, 1차(17_28_02) RESOLUTION의 잘못된 "폴백 커버됨" 주장을 3차가 재지적하고 1차 문서 자체는 정확히 자기 귀속("당시" = 1차)했음에도, 그 사건을 서술하는 3차 자신의 RESOLUTION.md와 이를 요약한 plan.md 3차 절이 나란히 "2차 RESOLUTION이 틀렸다"로 라운드를 잘못 지목한 점(WARNING)이다. 같은 라운드의 SUMMARY.md는 정확히 1차를 지목하고 있어 산출물 간 내부 모순이 존재한다. 기능적 결함은 아니지만, 이 PR 전체가 "커버 주장은 추론이 아니라 실측이어야 한다"는 교훈을 세 번째로 명시적으로 남기는 세션이라는 점에서, 그 교훈을 적은 문서 자신에 남은 사실관계 오류는 감사 추적 신뢰도 차원에서 정정할 가치가 있다. 나머지 두 항목(모듈 상단 docstring 미요약, 테스트 카탈로그의 신규 안전핀 테스트 미언급)은 1~3차에서 이미 발견되어 의도적으로 보류된 INFO로, 재확인 결과 여전히 사실이지만 새로운 차단 사유는 아니다.

## 위험도

LOW
