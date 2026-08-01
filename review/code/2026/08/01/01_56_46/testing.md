# 테스트(Testing) 리뷰 — deps-guard-hardening (2차, 리뷰 조치 후)

이 라운드는 1차 리뷰(`review/code/2026/08/01/01_12_24`)의 Critical 4건·Warning 4건에 대한 조치
결과물이다. 조치 커밋(`3ff26348c`, `969f7ac0d`)을 실제로 읽고, 스크립트를 직접 import·실행하고,
`.github/workflows/harness-checks.yml` 을 `yaml.safe_load()` 로 직접 파싱하고, 실제 `pnpm audit`
을 돌려 대조하는 방식으로 "고쳐졌다는 주장"을 재검증했다.

## 발견사항

- **[CRITICAL]** `harness-checks.yml` 에 추가된 "PyYAML 설치" 스텝이 YAML 구조 결함으로
  **실제로는 실행되지 않는다** — 1차 리뷰 WARNING("PyYAML 미설치 리스크")에 대한 수정이
  그 자체로 깨져 있다.
  - 위치: `.github/workflows/harness-checks.yml:69`(`- name: Run harness unit tests` — 뒤에
    `run:`/`uses:` 없이 고아 상태) / `:74-76`(`- name: Install PyYAML` 스텝 안에 `run:` 키가
    두 번 등장).
  - 상세: 실제 커밋된 파일을 `yaml.safe_load()` 로 직접 파싱해 `jobs.unittest.steps` 를
    확인했다 — 산출된 스텝 리스트는 `{"name": "Run harness unit tests"}`(run/uses 전혀 없음)와
    `{"name": "Install PyYAML", "run": "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"}`
    이다. 즉 75행의 `run: pip install "pyyaml>=6,<7"` 은 바로 다음 줄 76행의
    `run: python3 -m unittest discover ...` 에 완전히 덮어써져 **PyYAML 설치 명령이 통째로
    사라진다**(YAML 매핑에서 동일 키 `run:` 이 두 번 나오면 대부분의 파서는 마지막 값만
    채택한다 — PyYAML 로 직접 실측). 원래 있던 `- name: Run harness unit tests` 스텝은 새로
    삽입된 4줄 주석 + `- name: Install PyYAML` 블록에 의해 `run:` 을 잃고 이름만 남은 무효
    스텝이 됐다(GitHub Actions 스키마상 스텝은 `run`/`uses` 중 하나가 필수라 워크플로 파일
    자체가 invalid 로 거부될 가능성도 있다). 어느 쪽이든 — (a) GH Actions 가 워크플로 파싱
    단계에서 통째로 거부하거나, (b) PyYAML 파서처럼 관대하게 마지막 값만 채택해 실행되거나
    — CI 결과는 깨진다. 후자라면 유일하게 실행되는 명령은 `python3 -m unittest discover ...`
    뿐이라 PyYAML 이 설치되지 않은 채 `test_override_floors.py` 가 `check-override-floors.py`
    를 `exec_module` 하면서 `import yaml` 이 실패한다. 로컬(`git diff origin/main`으로 커밋
    `3ff26348c` 확인, 이후 커밋 `969f7ac0d` 까지 이 파일은 손대지 않음)에서는 PyYAML 이 이미
    설치돼 있어 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 731건이 전부
    통과하지만, 이는 1차 리뷰가 정확히 경고했던 "로컬은 이미 설치돼 있어 이 갭이 드러나지
    않는다" 그대로다 — 그 경고에 대한 "수정"이 겉보기엔 스텝을 추가했지만 실제로는 기능하지
    않는다. 이 문제는 로컬 `TEST WORKFLOW`(lint/unit/build/e2e) 어느 단계로도 잡히지 않고
    실제 GitHub Actions 실행에서만 드러나므로, plan 체크리스트의 "TEST WORKFLOW (2차) — 진행
    중" 이 완료되어도(로컬 실행 기준이라면) 이 결함은 노출되지 않는다.
  - 제안: 두 스텝을 의도대로 분리한다.
    ```yaml
    - name: Install PyYAML
      run: pip install "pyyaml>=6,<7"
    - name: Run harness unit tests
      run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    가능하면 `.github/workflows/*.yml` 전체에 대해 "각 스텝이 `run`/`uses` 를 정확히 하나
    가지는지, 매핑 키 중복이 없는지" 를 `yaml.safe_load()` 로 기계 검증하는 harness 테스트를
    추가할 것 — 현재 이 저장소에는 워크플로 YAML 구조 자체를 검증하는 가드가 전무하다
    (`test_harness_checks_paths_coverage.py` 등 기존 가드는 `paths:` 목록만 보고 step 구조는
    보지 않는다).

- **[WARNING]** `override_target()` 이 다단계 체인의 **중간(intermediate)** 세그먼트가 scope
  패키지인 경우 여전히 잘못된 값을 반환한다 — 이번 라운드가 고친 "첫 `>` vs 마지막 `>`" 버그의
  형제 케이스이며 신규 회귀 테스트가 커버하지 않는다.
  - 위치: `scripts/check-override-floors.py:96-98`(`override_target`, 특히 96행
    `key.find("@", 1) if key.startswith("@") else key.find("@")`) / 테스트 갭:
    `.claude/tests/test_override_floors.py:90-104`(`test_multi_level_chain_resolves_to_the_leaf`).
  - 상세: 실제 모듈을 직접 import 해 확인 — `override_target("a>@scope/b>c")` →
    `'@scope/b>c'`(기대값 `'c'`), `override_target("a>@scope/b>@scope/c@>=1.0.0")` →
    `'@scope/b>'`(기대값 `'@scope/c'`). 원인은 96행이 "선두가 아닌 첫 `@`" 를 항상 레인지
    시작점으로 가정하는 것 — 체인의 **루트**가 scope 이거나 **리프**만 scope 인 경우(현재
    테스트가 커버하는 두 케이스, 예 `@nestjs/cli>webpack>@types/node`)는 그 첫 `@` 가 우연히
    정확한 경계와 일치해 동작하지만, 체인 **중간**에 scope 패키지가 오면 그 지점에서 `head` 가
    잘려 이후의 진짜 부모/자식 구분자 `>` 를 `rfind` 가 아예 보지 못한다. 이 스크립트의
    docstring 이 "이 축이 틀리면 가드가 아무것도 안 잡는다" 고 명시한 바로 그 실패 클래스(개발
    중 2회, 이번 라운드에 3번째로 고친 것과 동일 계열)의 네 번째 변종이다. 현재
    `pnpm-workspace.yaml` 에는 이 형태(체인 중간 scope)의 키가 없어 오늘 당장 터지지는
    않지만, 이 저장소가 override 대상으로 `@babel/core`·`@grpc/grpc-js`·
    `@hono/node-server`·(테스트에 이미 등장하는) `@nestjs/cli` 등 scope 패키지를 흔히 다루는
    점을 고려하면 `next>@scope/plugin>subdep` 형태의 키가 추가되는 순간 조용히 재발할 수
    있다 — 정확히 이 스크립트가 막으려는 "추출이 틀려 가드가 아무것도 안 잡는" 실패 모드다.
  - 제안: `a>@scope/b>c`, `a>@scope/b>@scope/c@>=1.0.0` 같은 "중간 scope" 케이스를
    `test_multi_level_chain_resolves_to_the_leaf` 옆에 추가하고, 추출 로직을 "전체 문자열에서
    첫 `@`" 대신 "체인을 `>` 로 분리하되 각 세그먼트가 `@` 로 시작하면 그 세그먼트 내부의
    `/` 이후 첫 `@` 만 레인지 경계로 본다" 는 식으로 일반화할 것.

- **[WARNING]** `.claude/tests/README.md` 신규 카탈로그 항목이 "Three axes" 로 시작해 놓고
  바로 이어서 **4번째** 축("Fail-closed covers the fourth")을 설명해 같은 문장 안에서
  자기모순이다.
  - 위치: `.claude/tests/README.md:29`.
  - 상세: 항목은 "Three axes" 로 시작해 **Key extraction**·**Classification**·
    **Suppressed-path baseline** 세 개를 설명한 뒤 "**Fail-closed** covers the fourth" 라고
    명시적으로 네 번째를 도입한다. 반면 같은 diff 의 `plan/in-progress/deps-guard-hardening.md:110-113`
    은 정확히 "4축(키 추출 · 분류 · `ignoreCves` 억제 경로 baseline · fail-closed)" 이라
    서술해 서로 다르다. 실제 테스트 클래스 수도 4개(`OverrideTargetExtractionTest` /
    `ClassificationTest` / `SuppressedPathBaselineTest` / `FailClosedTest`)로 "4축" 쪽이
    맞다. 이 저장소는 최근 이력에서 "테스트 수치·근거 서술 오기" 가 반복적으로 재발해 별도
    리뷰 조치 커밋으로 정정된 바 있는 클래스라(무관하지 않은 선례), 카탈로그 자체의 신뢰도에
    영향을 준다.
  - 제안: "Three axes" → "Four axes" 로 정정.

- **[INFO]** `main()` 에서 `widened`(ignoreCves 억제 경로 baseline 위반)와 `eroded`(일반
  override 바닥 침식)가 동시에 발생하는 경우 `widened` 쪽만 보고되고 `eroded` 는 그 실행에서
  전혀 보고되지 않는다 — 두 실패가 겹치는 시나리오는 테스트되지 않는다.
  - 위치: `scripts/check-override-floors.py:222-247`(`main` — `widened` 분기가 `eroded` 계산
    이전에 `return 1` 로 먼저 빠져나감).
  - 상세: 어느 분기든 exit 1(fail)이라 fail-open 위험은 없다 — 순수 리포트 완결성 문제다.
    사용자는 `widened` 를 고쳐 재실행해야 `eroded` 목록을 비로소 볼 수 있다.
  - 제안: 여유 있을 때 두 목록을 함께 계산해 한 번에 보고하도록 통합할 것. 우선순위 낮음.

- **[INFO]** `main()` 의 "워크스페이스 파일 부재" 분기는 이번 라운드의 "fail-closed 분기 회귀
  테스트"(커밋 `969f7ac0d`) 이후에도 여전히 테스트되지 않는다.
  - 위치: `scripts/check-override-floors.py:196-199`.
  - 상세: 1차 리뷰의 INFO 항목("워크스페이스 파일 부재 분기가 테스트되지 않음")이 이번에
    `FailClosedTest`(빈 stdout·파싱 불가·`actions` 키 없음 3건)로 부분적으로만 해소됐고,
    `pnpm-workspace.yaml` 자체가 없는 디렉터리에서 실행하는 케이스는 여전히 빠졌다. exit 2
    fail-safe 라 위험은 낮음 — 우선순위 낮게 이월.
  - 제안: 여유 있을 때 tmp 디렉터리(워크스페이스 파일 없음)에서 스크립트를 직접 실행하는
    케이스 1건 추가.

- **[INFO]** 테스트 헬퍼 `_run_with_stub_audit` 이 `ClassificationTest` 의 메서드로 정의되어
  있는데, 형제 클래스 3곳이 unbound-method 스타일로 그것을 빌려 쓴다 — 기능은 정상이나 구조가
  이례적이다.
  - 위치: 정의 `.claude/tests/test_override_floors.py:119`(`ClassificationTest` 내부, 116행에서
    클래스 시작) / 호출부 `:245`(`SuppressedPathBaselineTest._run`), `:276`
    (`FailClosedTest._run_raw`), `:302`(`MultipleMatchTest.test_reports_only_managed_among_many`)
    — 셋 다 `ClassificationTest._run_with_stub_audit(self, ...)` 형태로 호출.
  - 상세: 실행 확인 결과 4개 클래스, 18개 테스트 전부 통과해 기능적 결함은 아니다. 다만
    `_run_with_stub_audit` 은 사실상 4개 TestCase 가 공유하는 유틸리티인데 `ClassificationTest`
    의 "private" 스러운 이름(언더스코어 접두)으로 그 안에 갇혀 있어, 이 파일을 처음 읽는
    사람은 `SuppressedPathBaselineTest`/`FailClosedTest`/`MultipleMatchTest` 가 왜
    `ClassificationTest` 를 참조하는지 바로 이해하기 어렵다. 향후 누군가 `ClassificationTest`
    를 리팩터링·삭제하면(예: "이 클래스는 다른 곳에서 안 쓰이는 것 같다"는 판단으로) 나머지
    3개 클래스가 조용히 깨질 수 있는 숨은 결합이다.
  - 제안: `_run_with_stub_audit` 을 모듈 레벨 함수 또는 공유 mixin/base `TestCase` 로 승격할
    것. 우선순위 낮음(가독성/유지보수성 문제, 정확성 문제 아님).

## 회귀 검증 메모 (1차 리뷰 조치 재확인)

1차 리뷰의 Critical 4건 중 3건(harness-checks.yml paths 등재, README 카탈로그 등재,
dependabot 루트 예외)과 Warning 4건 중 3건(`override_target` 다단 체인 첫 `>` 버그, 다건
동시 매칭 테스트 부재, ignoreCves 전역 억제 사각지대)은 diff 만 읽지 않고 직접
재검증했다 — 정상적으로 해소됨을 확인했다.

- `override_target()` 의 docstring 주장("마지막 `>` 뒤부터")과 구현이 이제 일치함을 12개
  케이스(기존 회귀 + `a>b>c`, `next>webpack>terser@>=5.0.0`, `@nestjs/cli>webpack>@types/node`
  포함)로 직접 실행해 확인.
- `_legitimate_dependabot_directories()` 를 되돌려(워크스페이스 루트 예외 제거) 시뮬레이션한
  결과 `test_no_stale_dependabot_npm_entry` 가 정확히 `''` 를 stale 로 잡아내 — 이 테스트가
  vacuous 하지 않음을 확인.
- `scripts/check-override-floors.py` 를 실제로 실행(`pnpm audit` 실호출)해 exit 0·
  "override 대상 26개 패키지 중 취약 재유입 0건" 을 확인 — `EXPECTED_SUPPRESSED_PATHS` 의
  `brace-expansion` 경로 baseline 이 실제 현재 상태와 정확히 일치함을 합성 테스트가 아닌
  실제 스크립트 실행으로 재확인.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 731건 전체 재실행, PASS.

이 검증들은 정상이었다. 발견된 CRITICAL 은 그 바깥, 즉 조치 커밋이 **새로** 만든 CI 배선
결함이다.

## 요약

1차 리뷰에서 지적된 실질적 결함(ignoreCves 전역 억제 사각지대, `override_target` 다단 체인
첫 `>` 버그, CI 등재 누락 3건, fail-open 위험)은 이번 라운드에서 전부 진짜로 해소됐다 —
diff 만이 아니라 스크립트를 직접 import·실행하고 `pnpm audit` 을 실제로 돌려 재검증했다.
`test_override_floors.py` 는 11건에서 18건으로 늘며 4개 축(키 추출·분류·억제 경로
baseline·fail-closed)을 블랙박스 서브프로세스 방식(실제 `pnpm` 을 PATH 상의 스텁으로 교체,
mock 남용 없음)으로 각자 격리된 tempdir 에서 검증해 견고하다. 그러나 그 수정 자체가 새로운
결함을 하나 만들었다: `harness-checks.yml` 에 추가한 "PyYAML 설치" 스텝이 YAML 매핑 키
중복으로 실제로는 실행되지 않는다 — 1차 리뷰가 경고했던 "PyYAML 미설치 리스크"가 형식적으로만
해소되고 실질적으로는 그대로 남았다(오히려 원래 있던 단위 테스트 실행 스텝까지 무효화됐다).
이 결함은 로컬 `TEST WORKFLOW` 로는 드러나지 않고 실제 GitHub Actions 실행에서만 노출되므로
반드시 push 전에 고쳐야 한다. 그 외에 `override_target()` 의 "체인 중간 scope 패키지" 라는
남은 미커버 변종(WARNING), README 카탈로그의 "Three axes" 대 실제 4축 자기모순(WARNING),
그리고 세 개의 경미한 INFO(리포트 완결성·잔여 미테스트 방어분기·테스트 헬퍼 구조)를 남긴다.

## 위험도

CRITICAL
