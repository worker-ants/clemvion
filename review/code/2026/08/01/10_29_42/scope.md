# 변경 범위(Scope) Review

## 검증 방법 (요약 앞에 먼저 기록)

리뷰 대상 6개 파일이 실제로 이 브랜치의 diff **전체**와 일치하는지부터 확인했다.

- `git merge-base HEAD origin/main` → `06c2651c9`, `git log origin/main..HEAD` → 이 브랜치는
  `origin/main` 대비 **정확히 커밋 1개**(`f2896147b`)만 앞서 있다. `git show --stat f2896147b`
  로 그 커밋이 건드린 파일이 정확히 이 6개(신규 3 + 수정 3)와 1:1 일치함을 확인 — 프롬프트가
  준 "전체 파일 컨텍스트"에는 diff 가 없었으므로, 이 대조가 없으면 사전 존재하던 내용(예:
  README 의 PyYAML 예외 문단, `test_override_floors.py`/`test_workflow_yaml_structure.py` 행)을
  "이번 변경" 으로 오판할 뻔했다. 실제로는 그 문단들은 **직전 커밋 `06c2651c9`** 소속이고, 이번
  커밋은 README 에 **1줄**(카탈로그 행)만 더한다 — `git show f2896147b -- .claude/tests/README.md`
  로 확인.
- `.github/workflows/harness-checks.yml`, `.claude/tests/README.md`, `plan/in-progress/...md` 3개
  기존 파일은 `git diff --ignore-all-space` 와 일반 `git diff` 의 변경 줄 수가 각각 동일(3/3,
  40/40)함을 확인 — 포맷팅 전용 잡음이 실질 변경에 섞여 있지 않다.
- 새 테스트 13개를 `python3 -m unittest test_review_gate_ci`로 직접 실행 — 전부 OK.
- 이번 변경이 요구하는 "판정자 단일성" 불변식을 지키는 `OneJudgeTest`(AST 기반 금지 호출/임포트
  검사)와 "관측 모드 고정" `test_it_is_still_observation_only`(주석 제거 후 `--enforce` 부재 단언)
  가 **실제로 실패할 수 있는지**를 스크래치패드에서 뮤테이션으로 검증했다(아래 발견사항 참고).
- 신규 워크플로의 `timeout-minutes`/`cancel-in-progress`/액션 버전이 기존 11개 워크플로와
  동일한지 grep 으로 대조, `--root` CLI 플래그가 `check-doc-links.py`/
  `check-e2e-playwright-config.py` 에 이미 있는 기존 관례인지 확인.
- 두 신규 Python 파일의 import 전부(argparse/os/sys, os/shutil/subprocess/sys/tempfile/unittest/
  `_harness`) 실사용 확인, TODO/FIXME/디버그 프린트 잔존 여부 grep — 없음.
- `test_harness_checks_paths_coverage.py` / `test_tests_readme_catalog.py` / `test_workflow_yaml_structure.py`
  를 재실행해 이번 커밋이 등재한 신규 파일들이 기존 하네스 가드를 실제로 충족하는지 확인(전부 OK) —
  즉 README·harness-checks.yml 의 동반 수정이 "곁다리 추가" 가 아니라 기존 가드가 **강제하는
  최소 필요 조치**임을 코드로 확인했다.

## 발견사항

- **[INFO]** `OneJudgeTest`의 "두 번째 판정자 금지" AST 가드는 별칭(alias) import 에는 반응하지
  않는다 (뮤테이션으로 확인, 이번 diff 자체의 범위 이탈은 아님)
  - 위치: `.claude/tests/test_review_gate_ci.py:197-201` (호출명 추출부의 `base = f.value.id ...`)
    및 그 결과를 소비하는 금지 목록 `:209-210`, `:222`
  - 상세: 197-201행은 `obj.method(...)` 형태 호출을 `"{obj 변수명}.{method}"` 문자열로 기록하는데,
    `obj` 는 실제 import 된 모듈 이름이 아니라 **호출부에 쓰인 로컬 이름**이다. `check-review-gate.py`
    사본에 `import os as _x` 뒤 `_x.walk(...)` 를 추가해 이 테스트의 AST 로직을 그대로 재현해보면,
    `called` 집합에는 `"_x.walk"` 로만 잡혀 금지 목록의 리터럴 `"os.walk"` 와 매치되지 않아
    통과한다(`WOULD PASS` 로 실측). 반면 별칭 없이 실제 임포트된 이름 그대로
    `os.walk(...)`·`import re; re.compile(...)` 를 추가하는, 실제로 있을 법한 형태의 뮤테이션은
    정확히 잡힌다(`WOULD FAIL` 로 실측) — 즉 이 테스트는 **현실적인 스코프-크립 형태에는
    vacuous 하지 않다.** 이번 PR 이 실제로 배송하는 `scripts/check-review-gate.py` 에는 그런
    별칭이 전혀 없으므로 지금 이 변경 자체가 범위를 벗어난 것은 아니다. 다만 이 테스트가 지키는
    성질("판정자는 하나 — 스크립트가 트리 순회/정규식/서브프로세스로 두 번째 판정을 재구현하지
    않는다")이 향후 스코프 확장을 막는 **유일한 기계적 방어선**이라, 그 방어선의 좁은 사각지대를
    기록해 둔다.
  - 제안: 급하지 않음(현재 코드에 영향 없음). 나중에 강화한다면 `base` 를 호출부의 로컬 이름이
    아니라 해당 이름이 가리키는 **import 시작 모듈**로 정규화하거나(alias resolution), 금지
    검사를 "어떤 이름으로 들여왔든" 잡도록 import 문 자체(`ast.Import`/`ast.ImportFrom`)에서 걸린
    모듈이 `os`/`re`/`glob`/`subprocess` 인지를 먼저 판정한 뒤 그 별칭들의 호출을 추적하는 방식으로
    재작성.

## 요약

6개 파일 diff(신규 3: `scripts/check-review-gate.py`, `.github/workflows/review-gate.yml`,
`.claude/tests/test_review_gate_ci.py` / 수정 3: `.claude/tests/README.md` +1줄,
`.github/workflows/harness-checks.yml` +3줄, `plan/in-progress/harness-review-gate-ci-backstop.md`
상태 갱신)은 이 브랜치가 `origin/main` 대비 갖는 **유일한 커밋**의 전체 범위와 정확히 일치하며,
CONTEXT 가 서술한 의도("로컬 push 훅과 같은 `evaluate_review()` 를 CI 트리거로만 재사용, 관측
모드로 시작")를 벗어나는 파일·코드 영역이 없다. 3개 수정 파일 모두 실측(포맷팅-무관 diff 라인 수
동일)으로 공백/줄바꿈 전용 잡음이 없음을 확인했고, README·harness-checks.yml 동반 수정은 곁다리
정리가 아니라 이 저장소의 기존 커버리지 가드(`test_tests_readme_catalog.py`,
`test_harness_checks_paths_coverage.py`)가 신규 파일에 대해 **강제**하는 최소 조치임을 그 가드들을
직접 재실행해 확인했다. 신규 워크플로의 설정값(timeout-minutes, cancel-in-progress, 액션 버전)과
스크립트의 `--root` 플래그는 모두 저장소의 기존 관례를 그대로 따르며 새 패턴을 도입하지 않는다.
두 신규 Python 파일의 import 는 전부 실사용되고 불필요한 정리·주석 변경도 없다. 테스트 13개를
직접 실행해 통과를 확인했고, 그중 범위 이탈 방지 핵심 메커니즘인 `OneJudgeTest`(단일 판정자
불변식)와 `test_it_is_still_observation_only`(관측 모드 고정)를 뮤테이션으로 검증해 vacuous 하지
않음을 확인했다. 유일한 소견은 `OneJudgeTest` 의 별칭-import 사각지대(INFO)로, 이는 이번 diff의
실제 범위 위반이 아니라 향후 스코프를 지켜줄 가드 자체의 좁은 맹점에 대한 기록이다.

## 위험도

LOW
