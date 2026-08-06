# 테스트(Testing) Review — round 10

## 방법

라운드 프롬프트 지침대로 워킹트리는 건드리지 않았다. `mktemp -d` 사본에 `.claude/` 전체를 복사해
넣고, 대상 함수를 조작(mutation)한 뒤 관련 `.claude/tests/*.py` 를 직접 실행해 RED/GREEN 을
관측했다. 사본 경로: `/private/tmp/.../scratchpad/repo_copy_mutant1`, `repo_copy_mutant2`,
`git_probe_probe(2|3)` (전부 `/private/tmp/claude-501/.../scratchpad/` 아래, 워킹트리 밖).

## 발견사항

- **[WARNING]** `_shared/git_probe.py::_origin_default_branch`(브랜치 가드로 위임하는 지연 로더)가
  성공 경로에서 한 번도 실행되지 않는다 — mutation 으로 검증
  - 위치: `.claude/_shared/git_probe.py:35` (`def _origin_default_branch(cwd: str):`), 소비자
    `.claude/_shared/git_probe.py:113-121` (`_default_branch`)
  - 상세: `git_probe._default_branch()`는 먼저 `_origin_default_branch(cwd)`로 `branch_guard.py`를
    동적 로드해 그 모듈의 `_origin_default_branch` 함수를 얻고(`resolver`), `resolver(cwd)`를 호출해
    origin 의 실제 기본 브랜치를 물어본 뒤, 실패하면 로컬 `refs/heads/{main,master}` 존재 여부로
    폴백한다. 이 "성공 경로"(원격 조회가 실제로 값을 돌려주는 경우)를 exercise 하는 테스트가
    저장소 전체에 없다 — `grep -rn "remote add\|origin/HEAD" .claude/tests/*.py` 0건. 실제 repo 를
    쓰는 테스트들(`PorcelainPathSurvivesOnARealRepoTest`, `RebaseAuthorDateTest` 등)은 전부 origin
    remote 없이 로컬 브랜치명이 `main`이라 **폴백 경로**만 타고, decision-table 테스트들은
    `_default_branch` 자체를 통째로 mock 한다.
  - 검증(mutant 유효성): `.claude/_shared/git_probe.py`의 `_origin_default_branch` 본문을
    `return None`으로 치환한 사본에서:
    1. `python3 .claude/tests/test_plan_guard.py` → 33 tests OK
    2. `python3 .claude/tests/test_review_guard_hardening.py` → 56 tests OK
    3. `python3 .claude/tests/test_branch_guard.py` → 11 tests OK
    (총 100개, 전부 GREEN — 이 뮤턴트를 잡는 테스트가 하나도 없다.)
    이 뮤턴트가 실제로 행위를 바꾼다는 것도 별도로 실측했다: origin 기본 브랜치가 `main`/`master`
    가 아닌 `trunk`인 실제 bare repo(`git init --bare -b trunk` + `git symbolic-ref
    refs/remotes/origin/HEAD refs/remotes/origin/trunk`)에서 실물 `_default_branch()`는 `"trunk"`를
    정확히 반환하고, 뮤턴트는 `None`을 반환한다 — 폴백은 `main`/`master`만 확인하므로 이 저장소
    구성에서는 절대 복구되지 않는 차이다.
  - 왜 중요한가: `_default_branch`는 `_merge_base`(따라서 "이 브랜치가 무엇을 바꿨나")의 입력이고,
    `plan_guard`/`review_guard` 양쪽의 판정 기반이다. 오늘은 이 저장소의 실제 기본 브랜치가
    글자 그대로 `main`이라 폴백이 우연히 같은 값을 내 놓아 눈에 띄지 않지만(라이브 결함 아님),
    위임 메커니즘이 조용히 깨져도(예: `_HOOKS_LIB` 경로 계산이 바뀌거나, `branch_guard.py`의
    함수 시그니처가 바뀌거나) 이 저장소의 harness 스위트는 감지하지 못한다. 이는 이 라운드가
    이미 세 번(리뷰 7R·8R·9R) 잡아낸 "아무도 실행하지 않는 판정 헬퍼" 결함 클래스와 정확히 같은
    모양이며, `--enforce`를 켤 때 CI 러너의 실제 checkout 구성(로컬 `main`/`master` ref 부재
    가능성)과 맞물리면 실사용 경로일 수 있다.
  - 제안: origin remote 를 실제로 구성한 real-repo 테스트를 하나 추가한다 — 로컬 브랜치명과
    origin 기본 브랜치명을 **다르게**(예: `feature` 위에서 origin 기본은 `trunk`) 둬서 폴백과
    구분 가능하게 만들고, `git_probe._default_branch()`가 원격 값을 반환하는지 assert 한다.

- **[WARNING]** resolution-in-flight 마커 디렉터리 경로가 3~4곳에 손으로 중복돼 있고 그 사이 정합성을
  보는 테스트가 없다 — mutation 으로 검증
  - 위치: `.claude/hooks/_lib/review_guard.py:811` (`RESOLUTION_MARKER_SUBDIR = os.path.join(".claude",
    "state", "resolution_in_flight")`) 및 `:817-824` (`_resolution_marker_dir`); 중복 사본 —
    `.claude/hooks/mark_resolution_in_flight.py`의 `_state_dir()`, `.claude/hooks/clear_resolution_in_flight.py`의
    `_state_dir()` — 둘 다 같은 문자열 `".claude", "state", "resolution_in_flight"`을 하드코딩한다.
    테스트 쪽도 네 번째 사본: `.claude/tests/test_review_guard_hardening.py`의
    `ResolutionMarkerHookTest._marker()`(주변 라인 456-470 부근)가 같은 경로를 다시 손으로 짠다.
  - 상세: 이 값 셋은 오늘은 일치한다(드리프트한 라이브 결함 아님). 하지만 정합성을 지키는 테스트가
    없다 — `grep -rn "_state_dir\|_resolution_marker_dir\|RESOLUTION_MARKER_SUBDIR"
    .claude/tests/*.py`로 확인: `ResolutionInFlightTest`(review_guard 쪽 실제 로직을 테스트하는
    유일한 클래스)는 항상 `marker_dir=self.mdir`을 명시로 넘겨 실제 `_resolution_marker_dir()`
    계산을 **우회**하고, `ResolutionMarkerHookTest`는 mark/clear 훅만 그 자신의 손-중복 경로로
    독립적으로 검증한다. `mark_resolution_in_flight.main()`이 실제로 쓴 마커를,
    `review_guard._resolution_in_flight()`가 **기본값(`marker_dir=None`, 즉 실제
    `_resolution_marker_dir()`)** 으로 찾아내는지를 보는 end-to-end 테스트가 없다.
  - 검증(mutant 유효성): `review_guard.py`의 `RESOLUTION_MARKER_SUBDIR`만
    `"resolution_in_flight_v2"`로 바꾼(= 훅 두 파일과 드리프트시킨) 사본에서:
    1. `python3 .claude/tests/test_review_guard_hardening.py` → 56 tests OK
    2. `python3 .claude/tests/test_stop_guard_failopen.py` → 17 tests OK
    3. `python3 .claude/tests/test_guard_review_before_push_main.py` → 38 tests OK
    (총 111개, 전부 GREEN.) 이 드리프트는 실제로는 `mark_resolution_in_flight.py`가 쓰는 디렉터리와
    `review_guard._resolution_in_flight()`가 찾는 디렉터리가 달라져 Signal 1(디스패치 마커)이
    영구히 못 찾는 상태가 된다는 뜻이다 — 이 저장소가 9R에서 세 벌짜리 git 프로브 손-중복으로
    이미 겪은 것과 정확히 같은 실패 모양이, 아직 정리되지 않은 다른 값(마커 디렉터리)에 남아 있다.
  - 왜 중요한가(영향 범위는 제한적임을 함께 적는다): `_resolution_in_flight`는 Stop 훅 전용이고
    push 게이트는 안 쓴다(문서화된 설계). 따라서 드리프트의 실질 피해는 보안/우회가 아니라
    "resolution-applier가 고치는 중인데 Stop nudge 가 다시 울려 불필요한 재리뷰를 유발"하는
    회귀다 — `mark_resolution_in_flight.py` 자신의 docstring 이 이 메커니즘의 존재 이유로 정확히
    적어 둔 그 문제다. Signal 2(파일시스템 상태)가 백업으로 있어 완전한 fail-open은 아니지만,
    Signal 1이 조용히 죽는 것은 감지되지 않는다.
  - 제안: `RESOLUTION_MARKER_SUBDIR`(또는 `_resolution_marker_dir()` 자체)를 세 파일이 import 해
    공유하거나(이 라운드가 git 프로브에 이미 적용한 패턴), 최소한 세 값이 같은 문자열을 낸다는
    정합성 테스트 하나(`GitProbesAreNotReDuplicatedTest`류)를 추가한다. 그리고
    `mark_resolution_in_flight.main()` → (기본 `marker_dir`로) `review_guard._resolution_in_flight()`
    를 잇는 end-to-end 테스트를 하나 추가해 `ResolutionInFlightTest`의 `marker_dir` 주입이
    가리고 있는 이 이음매를 직접 본다.

- **[INFO]** SPEC-CONSISTENCY 게이트(Gate 2)의 조합 함수가 항상 mock 뒤에 있다 — mutation 미검증,
  근거만 제시
  - 위치: `.claude/hooks/_lib/review_guard.py`의 `_spec_code_patterns`(644행 부근),
    `_spec_linked_changes`(666행 부근)
  - 상세: `_parse_frontmatter_code`(spec 파일 하나에서 `code:` glob 추출)와 `_glob_to_regex`는 각각
    직접 단위 테스트가 있다(`test_review_guard.py`). 그러나 이 둘을 **저장소 전체 spec/에 대해
    실제로 조합**하는 `_spec_code_patterns`/`_spec_linked_changes`는 `grep -rn
    "_spec_linked_changes" .claude/tests/*.py`로 보면 `test_review_guard.py`에서 **항상**
    `mock.patch.object(rg, "_spec_linked_changes", return_value=spec_linked)`로 대체된다 — 실물이
    실행되는 통합 테스트가 없다. mutation 으로 검증하지는 않았으므로(시간 예산상 생략) WARNING 이
    아니라 정보성으로만 남긴다.
  - 제안: 실제 `spec/` 서브트리를 흉내 낸 임시 디렉터리에서 `_spec_linked_changes`를 직접(모킹
    없이) 호출하는 real-repo 테스트를 하나 추가할 가치가 있다 — 이번 라운드 범위 밖이면 다음
    라운드 후보로 등재.

## 확인한 것 (round 10 신규 파일들의 테스트 품질은 전반적으로 양호)

- `test_plan_guard.py`의 `GitProbesAreNotReDuplicatedTest`는 객체 동일성(`assertIs`)과 로컬
  재정의 부재(AST 스캔)를 **함께** 걸어, "`_x = _git_probe._x` 뒤에 재정의가 온다" 형태의
  회귀를 정확히 겨냥한다 — 검증 방식이 튼튼하다.
- `test_review_gate_ci.py`의 `VerdictComesFromTheGateTest`/`TheRealGateIgnoresTheEnvironmentTest`는
  정적 스캔이 4연속 뚫린 뒤 행위 기반(4-조합 진리표, bare vs 14-변수 CI 환경 비교)으로 반전한
  설계이고, "최소 환경만 명시, 부모 환경 미상속"이라는 각주까지 정확하다 — 실제로
  `_HOSTILE_ENV`/`_CI_ENV`에 `GITHUB_JOB`/`GITHUB_WORKFLOW`가 들어 있어 9R 리뷰어가 실증한 우회를
  재발 방지 형태로 고정했다.
- `test_workflow_yaml_structure.py`의 `_MAY_SWALLOW`/`_JOB_CONDITIONS`/`_STEP_CONDITIONS`/
  `_PULL_REQUEST_KEYS`는 전부 "등재 후 죽은 항목은 실패"까지 대칭으로 걸려 있다(각 테스트 끝의
  `assertEqual(_X.keys() - seen, set(), ...)`) — 화이트리스트가 stale 해지는 실패 모드까지 닫았다.
- `test_stop_guard_failopen.py`의 `test_review_gate_degradation_is_reported_too`는 "다른 모든
  테스트가 PLAN 분기만 깨서 REVIEW 분기가 무검증이었다"를 스스로 지적하고 대칭 케이스를 추가한
  자기 인식형 테스트 — 이 라운드가 계속 찾아온 "손으로 짠 쌍둥이 분기 중 하나만 테스트됨" 결함
  클래스를 사전에 닫는다.
- `PorcelainPathSurvivesOnARealRepoTest`(plan_guard)와 `test_a_non_ascii_path_survives_git_quoting`
  (review_guard)는 각자 독립적으로 실제 git 저장소를 구동해 `core.quotePath=false` 처방을
  검증한다 — 자매 훅이 이번엔 갈리지 않았다.
- Mock 적절성: `_CLEAN_REVIEW`/`_CLEAN_PLAN`(test_stop_guard_failopen.py) 스텁이 실제
  `ReviewDecision`/`PlanDecision`의 `push_blocks` 프로퍼티까지 그대로 비추게 해 둔 것, 그리고
  그 이유를 "무엇을 빼도 되는지 매번 판단하는 것보다 싸다"고 명시한 주석은 이 라운드 히스토리가
  기록한 실패(`test_block_integrity.py`가 `push_blocks` 없는 스텁으로 크래시-then-fail-open을
  놓친 사고)를 정확히 겨냥한다.

## 요약

Round 10 대상 파일들(특히 `git_probe.py`/`plan_guard.py`/`branch_guard.py`/신규 테스트 4종/워크플로
2종)의 테스트는 9라운드 동안 반복적으로 발견된 "정적 판정 대신 행위 검증", "손-중복 판정자
정합성", "쌍둥이 분기 양쪽 모두 커버"라는 세 가지 교훈을 스스로 잘 지키고 있고, 실제로 그 규율이
새 코드(`_shared/git_probe.py` 통합, `test_workflow_yaml_structure.py`의 조건/트리거 레지스트리)에
일관되게 반영돼 있다. 다만 그 통합 자체가 만든 새 이음매 하나(`git_probe._origin_default_branch`의
성공 경로)와, 아직 통합되지 않은 옆 동네의 옛 중복 하나(resolution-in-flight 마커 디렉터리)가 같은
클래스의 미검증 지점으로 남아 있음을 실제 mutation 으로 확인했다. 둘 다 오늘은 라이브 결함이
아니며(값이 우연히/설계상 일치), 각각 100개·111개 테스트가 그 mutation 아래에서도 전부 GREEN 이라는
사실로 커버리지 부재를 증명했다. SPEC-CONSISTENCY 조합 함수의 통합 테스트 부재는 mutation 없이
정보성으로만 남긴다.

## 위험도

MEDIUM — 라이브 결함은 없다(두 발견 모두 오늘은 값이 일치해 조용히 정답을 낸다). 그러나 이
저장소가 이 정확한 실패 모양(판정 헬퍼가 아무 테스트에도 안 걸림 / 손-중복 값의 드리프트
무검출)을 9라운드에 걸쳐 반복해서 라이브 결함으로 승격시켜 왔다는 점에서, 방치하면 CRITICAL 로
성장할 알려진 궤적 위에 있다.

STATUS: SUCCESS
