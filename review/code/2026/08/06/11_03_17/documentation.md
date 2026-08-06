# 문서화(Documentation) Review — CI 백스톱 라운드 5

## 발견사항

- **[WARNING]** `harness-checks.yml` 의 `.github/workflows/**` 등재 사유 주석이 "두 가드"라고 단정하지만 실제로는 세 번째 가드가 이 glob 폭에 의존한다
  - 위치: `.github/workflows/harness-checks.yml:41-52`
  - 상세: 주석은 "워크플로 디렉토리 전체 — **두** 가드가 여기에 걸린다" 라고 명시하며 (a) `test_e2e_exemption_paths_sync.py`, (b) `test_workflow_yaml_structure.py` 만 나열한다. 그러나 `test_review_gate_ci.py::WorkflowWiringTest`(`test_the_whole_workflow_matches_the_expected_wiring`)도 `.github/workflows/review-gate.yml` 을 구조적으로 파싱해 파싱된 문서 전체를 리터럴과 비교한다 — `review-gate.yml` 단독 수정 시 이 테스트가 트리거되려면 `harness-checks.yml` 이 돌아야 하고, 그건 지금 `.github/workflows/**` 라는 넓은 glob 덕분이다. 이 파일의 다른 모든 주석은 "왜 이 경로가 필요한가"를 정확히 카운트해 적어 두는 것을 원칙으로 삼고 있는데(예: ".claude/config/** ... 6번째" 처럼 숫자를 정확히 추적), 이 항목만 실제보다 적게 세고 있다. 미래에 누군가 이 주석의 "두 가드"만 믿고 `.github/workflows/**` 를 `{e2e.yml, harness-checks.yml}` 처럼 좁히면, `review-gate.yml` 단독 수정이 `WorkflowWiringTest` 를 트리거하지 못하는 사각을 만든다 — 정확히 `test_harness_checks_paths_coverage.py` 가 막으려는 실패 클래스(present-but-silent guard)를 이 주석 자신이 재생산할 수 있는 상태다.
  - 제안: 주석에 (c) `test_review_gate_ci.py::WorkflowWiringTest` 를 세 번째 항목으로 추가하고 "두 가드"를 "세 가드"로 정정한다.

- **[WARNING]** `.claude/tests/README.md` 의 `test_review_gate_ci.py` 행이 라운드 4에서 실제로 배선된 "워크플로 문서 전체 정확 일치" 방어를 설명하지 않고, 그보다 앞선(그리고 이미 뚫린) "구조적 파싱" 수준의 서술에 머물러 있다
  - 위치: `.claude/tests/README.md:48`
  - 상세: 해당 행 말미는 "The workflow half is parsed with PyYAML **structurally**, not grepped: a reviewer showed that deleting the `if:` and leaving the same string in `env:`, or replacing `run:` with `true`, kept the substring version green." 로 끝난다. 이건 2R("구조 파싱 + 부분 정규식")조차 이미 넘어선 현재 상태를 설명하지 못한다. 실제 코드(`test_review_gate_ci.py` 의 `WorkflowWiringTest`, `EXPECTED` 리터럴, `test_the_whole_workflow_matches_the_expected_wiring`)와 `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "4R 에서 결론: 부분집합에 대한 정확 일치는 여전히 부분 일치다... 파싱된 워크플로 문서 전체를 하나의 기대값과 비교하도록 바꿨다" 는 모두 "전체 문서 vs 하나의 기대 리터럴" 이 지금의 정본 방어라고 말한다. README 전체에서 `WorkflowWiringTest` 라는 클래스명도, "whole document"/"전체 고정" 이라는 표현도 단 한 번도 등장하지 않는다(grep 0건, 직접 확인). 이 파일의 다른 모든 행은 뚫린 이력·완화 방식을 매우 정밀하게(뮤테이션 개수까지) 기록하는 관례를 갖고 있어서, 이 행만 구버전 설명에 머문 것이 특히 눈에 띈다.
  - 제안: `WorkflowWiringTest` 를 명시하고 "파싱된 워크플로 **문서 전체**를 하나의 기대 리터럴과 비교 — 부분/필드별 일치가 네 라운드에 걸쳐 뚫린 뒤의 최종 형태" 로 갱신한다. `VerdictComesFromTheGateTest`(행위 기반 단일 판정자 검증)도 이미 서술돼 있으니 두 클래스가 서로 다른 성질(배선 vs 판정자 단일성)을 고정한다는 점을 구분해 적으면 더 명확하다.

- **[INFO]** `review-gate.yml` 의 `Fetch base ref` 스텝 주석이 그 필요성을 기정사실처럼 서술하는데, 같은 정책을 다루는 plan 문서는 그 필요성을 "미확인"으로 명시적으로 남겨 뒀다 — 두 문서의 확신 수준이 안 맞는다
  - 위치: `.github/workflows/review-gate.yml:63-66` (주석: "base ref 가 origin/<base> 로 해석돼야 `_default_branch()` 가 merge-base 를 찾는다.") vs `plan/in-progress/harness-review-gate-ci-backstop.md:38-40` ("열린 질문: `Fetch base ref` step 이 `fetch-depth: 0` 위에서 실제로 필요한지는 GH Actions 러너 없이 실측할 수 없어 판정하지 못했다.")
  - 상세: 이 스텝이 실제로 필요한지 자체를 재판정하라는 지적이 아니다(러너 없이 실측 불가하다는 건 이번 라운드의 명시된 known limit). 다만 워크플로 파일만 읽는 독자는 이 스텝을 "검증된 요구사항"으로 받아들이게 되고, plan 문서를 함께 읽어야만 그게 실은 미실측 가정이라는 걸 안다. 두 문서가 같은 스텝을 다루면서 확신 수준을 다르게 서술하는 것 자체가 문서 정합성 이슈다.
  - 제안: 워크플로 주석 끝에 "(필요성은 GH Actions 러너 없이 미실측 — `plan/.../harness-review-gate-ci-backstop.md` 열린 질문 참조)" 정도의 한 줄만 더해 두 문서의 확신 수준을 맞춘다. `WorkflowWiringTest.EXPECTED` 가 이 스텝의 **존재**는 고정하지만 **필요성**은 증명하지 않는다는 점도 동일한 이유로 표기해 둘 만하다.

- **[INFO]** `scripts/check-review-gate.py` 의 `_ROOT_DEFAULT` 계산 자체에는 설명 주석이 없고, 바로 위 주석 블록은 다른 결정(`_load_gate` 의 `_lib` 전용 경로 선택)을 설명한다
  - 위치: `scripts/check-review-gate.py:55-60` (주석 블록) / `:60` (`_ROOT_DEFAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))`)
  - 상세: `_ROOT_DEFAULT` 는 "스크립트가 저장소 루트에서 정확히 두 단계 아래(`scripts/`)에 있다"는 가정을 코드로 굳힌 것이다. 이 가정이 깨지면(`_load_gate` 가 실패해) fail-open 되고, 그 출력은 정상 관측 모드의 출력과 구분되지 않는다 — 바로 이 위험을 `test_review_gate_ci.py::test_the_default_root_resolves_to_this_repository` 의 독스트링이 명시적으로 설명한다("게이트를 못 불러와 fail-open 하고, 그건 관측 모드의 정상 출력과 구분이 안 된다 — CI 는 계속 초록인데 백스톱만 영구히 죽는다"). 그런데 정작 그 가정이 코드로 표현되는 지점(`_ROOT_DEFAULT` 줄)에는 그 위험을 알리는 주석이 없고, 그 자리를 차지한 주석은 `_load_gate` 내부의 `sys.path` 선택 이유를 설명한다 — 독자가 자연스럽게 이 주석이 `_ROOT_DEFAULT` 를 설명한다고 오해하기 쉬운 배치다.
  - 제안: `_ROOT_DEFAULT` 줄 위에 "두 단계 상위 = 저장소 루트라는 가정, 깨지면 fail-open (`test_the_default_root_resolves_to_this_repository` 가 가드)" 한 줄을 추가하고, 기존 `_load_gate` 관련 주석은 `_load_gate` 함수 정의부 쪽으로 옮긴다.

- **[INFO]** plan 문서 상단 상태표의 "배선 가드 경화" 셀이 "1R~4R 진행 중"으로 남아 있지만, 실제로는 4R 의 결론(문서 전체 정확 일치 + 행위 기반 판정자 단일성 검증)이 이미 커밋돼 코드에 반영돼 있다
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:18` (상태표) 와 `:32-36` (4R 결론 서술)
  - 상세: 실제 `.claude/tests/test_review_gate_ci.py` 를 직접 열어 확인한 결과 `WorkflowWiringTest.EXPECTED` 전체 비교와 `VerdictComesFromTheGateTest` 의 4-조합 행위 검증이 이미 구현·커밋된 상태다(현재 HEAD). 그런데 상단 요약표는 여전히 "진행 중"이라 적고 있어, 이 표만 보는 독자는 4R 의 방어가 아직 미완인지 완료됐는지 판단하기 어렵다. 이 라운드(문서 리뷰어가 호출된 지금 시점)가 바로 "4R 의 결과물이 더 뚫리는가"를 검증하는 5번째 라운드이므로, 표가 아직 갱신 전 상태인 것 자체는 이 문서의 갱신 관례(라운드 종료 후 일괄 갱신)와 부합할 수 있다 — 다만 이 라운드가 끝나면 표에 결과(뚫렸는지/막았는지)를 반영하는 행을 추가해야 지금까지의 관례(모든 라운드가 표에 남아 있음)가 깨지지 않는다.
  - 제안: 이번 리뷰(라운드 5)가 종결되면 상태표에 5R 행(또는 "4R 완료" 로 라벨 갱신) 을 추가해 "1R~4R" 서술이 최신 상태를 반영하도록 한다. 지금 당장 코드를 바꾸라는 지적은 아니며, 문서 갱신 타이밍을 놓치지 않기 위한 표식이다.

## 요약

핵심 배선 3파일(`review-gate.yml`, `check-review-gate.py`, `test_review_gate_ci.py`)과 `plan/` 문서는 자체적으로는 매우 상세하고(왜-필요한가, 실측 근거, 라운드별 뚫린 이력을 코드 독스트링·주석·plan 문서 세 군데에 걸쳐 서로 일치하게 기록) 전반적으로 이 저장소의 "문서가 곧 근거"라는 관례를 잘 지키고 있다. 다만 라운드를 거듭하며 방어 수준이 빠르게 올라가는 동안(구조적 파싱 → 필드별 일치 → 문서 전체 일치) `.claude/tests/README.md` 의 해당 행이 그 속도를 못 따라가 구버전 설명(구조적 파싱)에 머물렀고, `harness-checks.yml` 의 경로 등재 사유 주석은 새로 생긴 `WorkflowWiringTest` 의존성을 세지 못해 "두 가드"라는 부정확한 카운트를 남겼다 — 둘 다 이 프로젝트가 반복적으로 자기 실패로 기록해 온 "손-동기 문서 쌍의 drift" 클래스에 정확히 속한다. `Fetch base ref` 스텝과 `_ROOT_DEFAULT` 관련 주석 배치는 경미하지만 확신 수준·설명 대상이 어긋나 있다. Critical 급 결함은 없다.

## 위험도

LOW
