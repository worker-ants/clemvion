# 요구사항(Requirement) 리뷰 — deps-guard-hardening (2차)

## 전제: 1차 리뷰(`review/code/2026/08/01/01_12_24/`) 조치 검증

이번 diff 는 1차 리뷰의 Critical 4건 + Warning 4건을 조치한 결과물이다. 각 항목을 코드
Read + 직접 실행(로컬 `pnpm audit` 실행 포함, 네트워크 접근 가능한 환경에서 검증)으로
재검증했다.

- `ignoreCves` 전역 억제 사각(Critical) — `classify_vulnerable()` 신설로 `advisories`(자동 fail)와
  `actions[]`-only(=ignoreCves 로 억제됨, `suppressed`)를 분리하고 `EXPECTED_SUPPRESSED_PATHS`
  baseline 대비 "경로 확대" 만 fail 시키는 방식으로 재설계됐다. 실제로 `python3
  scripts/check-override-floors.py` 를 이 저장소에서 실행해 `OK: override 대상 26개 패키지 중
  취약 재유입 0건` 을 확인했고, `pnpm audit --json` 의 `actions[]` 에서 brace-expansion 경로가
  정확히 `EXPECTED_SUPPRESSED_PATHS["brace-expansion"]` 과 일치함을 직접 대조했다. **유효한 조치로
  검증됨.**
- `run_audit()` fail-open(Warning) — 빈 stdout · JSON 파싱 실패 · `actions` 키 부재 세 분기 모두
  `sys.exit(2)`. `FailClosedTest` 3건 통과 확인. **유효.**
- `harness-checks.yml` paths 미등재(Critical) / README 카탈로그 미등재(Critical/Warning) /
  dependabot 루트 등록 충돌(Critical) — 셋 다 코드 변경 확인 + `python3 -m unittest discover -s
  .claude/tests -p 'test_*.py'` 를 직접 실행해 731건 전부 OK 임을 확인(`test_dependabot_npm_coverage.py`
  14건, `test_harness_checks_paths_coverage.py` 26건, `test_tests_readme_catalog.py` 5건 개별
  재실행도 전부 OK). **유효.**
- `override_target()` 다단 체인(Warning) — `head.rfind(">")` 로 교체돼 docstring("마지막 `>` 뒤부터")과
  구현이 일치. `override_target("a>b>c") == "c"`, `override_target("@nestjs/cli>webpack>@types/node")
  == "@types/node"` 등 12개 케이스를 스크립트를 직접 import 해 재확인. **유효.**
- 다건 동시 매칭 테스트 부재(Warning) — `MultipleMatchTest` 신설로 해소. **유효.**
- `harness-checks.yml` unittest 잡 PyYAML 설치 누락(Warning) — **아래 CRITICAL 발견사항 참조. 조치가
  시도됐으나 실제로는 반대 결과를 냈다.**

## 발견사항

- **[CRITICAL]** `harness-checks.yml` 의 "PyYAML 설치 추가" 조치가 YAML 구조 오류로 무효화됐고,
  그 결과 pip install 명령이 통째로 사라진다 — 1차 리뷰가 지적한 "PyYAML 미설치" Warning 을
  고치려던 hunk 자체가 새 CRITICAL 을 만들었다.
  - 위치: `.github/workflows/harness-checks.yml:69-76`
  - 상세: 실제 파일을 직접 읽고 `yaml.safe_load()` 로 파싱해 확인했다. 현재 구조는:
    ```yaml
        - name: Run harness unit tests
        # (주석 4줄)
        - name: Install PyYAML
          run: pip install "pyyaml>=6,<7"
          run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    `yaml.safe_load()` 로 파싱한 실제 결과(`jobs.unittest.steps`):
    ```json
    {"name": "Run harness unit tests"},
    {"name": "Install PyYAML",
     "run": "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"}
    ```
    즉 (1) `Run harness unit tests` 스텝은 `run`/`uses` 가 전혀 없는 빈 스텝이 됐고, (2)
    `Install PyYAML` 스텝은 같은 매핑에 `run:` 키가 두 번 나타나 **뒤에 오는 값이 앞의 값을
    조용히 덮어써**, 실제 `run` 필드는 `pip install "pyyaml>=6,<7"` 이 아니라
    `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 가 된다 — **PyYAML 설치
    명령은 파싱 단계에서 완전히 사라진다.** 커밋 `3ff26348c` 의 메시지는 "harness-checks
    unittest 잡에 PyYAML 설치" 를 조치 항목으로 명시하지만 실제 효과는 정반대다.

    영향을 로컬에서 직접 재현했다 — PyYAML 이 없는 venv 를 만들어 동일 커맨드
    (`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)를 실행하면
    `FAILED (failures=8, errors=8)` 로 `test_override_floors.py` 의 테스트 대부분이 깨진다
    (`_load_module()` 이 `exec_module` 로 스크립트를 직접 실행하며 그 스크립트의
    `except ImportError: ...; sys.exit(2)` 를 그대로 맞는다). 이 "PyYAML 미설치" 상태는 CI 에서만
    발생한다 — 로컬은 이미 PyYAML 이 있어(1차 리뷰의 testing WARNING 이 정확히 이 은폐를
    지적했다) `plan/in-progress/deps-guard-hardening.md` 의 "TEST WORKFLOW (2차)... 하네스
    스위트 731 OK" 도 이 결함을 못 잡는다 — 로컬 실행은 `harness-checks.yml` 자체를 파싱/실행하지
    않기 때문이다. 또한 `run`/`uses` 가 모두 없는 스텝은 GitHub Actions 워크플로 스키마상
    허용되지 않을 가능성이 매우 높아(문서화된 필수 필드), push 시 워크플로 자체가 "invalid
    workflow file" 로 거부되어 `harness-checks` 체크가 전혀 게시되지 않을 위험도 있다 — 이 경우
    `scripts/check-override-floors.py` 를 지키는 이 하네스 스위트 전체가 조용히 무력화된다.
    이 파일의 `paths:` 리스트나 `.claude/tests` 안 어떤 unittest 도 `.github/workflows/*.yml` 의
    `jobs:` 구조 자체를 검증하지 않으므로(`test_harness_checks_paths_coverage.py` 는
    `on:.paths:` 목록만 본다), 이 결함은 현재 완전히 무가드 상태다(리포에 actionlint/yamllint
    도 없음, 직접 확인).
  - 제안: `Install PyYAML` 을 별도 스텝으로 완전히 분리하고 `Run harness unit tests` 가 원래
    커맨드를 그대로 갖도록 되돌린다:
    ```yaml
        - name: Install PyYAML
          run: pip install "pyyaml>=6,<7"

        - name: Run harness unit tests
          run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    수정 후 반드시 `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/harness-checks.yml')); print(d['jobs']['unittest']['steps'])"` 로 각 스텝이 정확히 하나의
    `run`/`uses` 를 갖는지 재확인할 것(가능하면 이번 기회에 저장소 전체 `.github/workflows/*.yml`
    에 대해 이런 파싱 왕복 검증을 하네스 스위트에 추가하는 것을 권고 — 이 클래스의 결함은
    `.claude/tests/README.md` 가 이미 "6번 반복" 이라 이름 붙인 "가드가 있는데 발동 안 하는" 실패와
    본질적으로 같다).

- **[WARNING]** 회귀 테스트 문서 2곳이 "세 축(Three axes)" 이라고 서술하지만 실제로는 4개 항목을
  나열한다 — 나중에 추가된 `fail-closed` 축(그리고 `ignoreCves` baseline 축)이 서두 개수에
  반영되지 않았다.
  - 위치: `.claude/tests/test_override_floors.py:7`("여기서 고정하는 것은 세 축이다.") 대비
    4개 번호 항목(`:9` 키 추출, `:17` 분류 동작, `:20` baseline, `:25` fail-closed);
    `.claude/tests/README.md:29`("Three axes." 대비 **Key extraction** / **Classification** /
    **Suppressed-path baseline** / **Fail-closed** 4개 볼드 항목, 그리고 `:29` 문장 끝의
    "축 1~3 을 다 통과한 채로" 도 3이 아니라 실제로는 그 앞의 세 항목을 가리키는 값이라 4번째와
    합쳐 이미 "4축" 구조를 전제하고 있다).
  - 상세: 같은 PR 이 작업 중인 `plan/in-progress/deps-guard-hardening.md` 는 이미 이 구조를
    "18건(4축: 키 추출 · 분류 · `ignoreCves` 억제 경로 baseline · fail-closed)" 로 정확히
    4축으로 서술한다(같은 파일 체크리스트, worktree 의 현재 상태) — 즉 개수 정정 자체는 이미
    한쪽에서 이뤄졌는데, 정작 사용자가 읽는 테스트 파일 자체의 모듈 docstring 과
    `.claude/tests/README.md` 카탈로그 행에는 아직 반영되지 않았다. 기능에는 영향 없음(순수
    서술 오차)이지만, 이 저장소가 반복적으로 지적해 온 "나중에 늘어난 항목을 서두 요약 숫자에
    반영 안 함" 부류와 같은 결이다.
  - 제안: 두 파일의 "세 축"/"Three axes" 를 "네 축"/"Four axes" 로 정정.

- **[INFO]** spec fidelity — `spec/` 전체에 override 침식 검출·dependabot·pnpm audit 관련 문서가
  없음을 `grep -rli`로 확인. `plan/in-progress/deps-guard-hardening.md` frontmatter 의
  `spec_impact: none`(CI/스크립트/설정 전용 변경, 제품 명세 무관) 과 일치한다. 조치 불요.

- **[INFO]** `check-override-floors.py::main()` 의 "widened"(억제 경로 확대) 체크가 "eroded"(override
  대상 재침식) 체크보다 먼저 `return 1` 로 빠져나간다 — 두 실패가 같은 실행에 동시에 존재하면
  한쪽 원인만 stderr 에 보고되고 나머지는 다음 재실행 전까지 보이지 않는다. exit code(1) 자체는
  두 경우 모두 정확해 안전 방향으로 fail 하지만, 진단 완결성은 부분적이다.
  - 위치: `scripts/check-override-floors.py` `main()` — widened 판정 블록(`if widened: ... return 1`)이
    eroded 판정 블록(`if not eroded: ... return 0` / 이어지는 `return 1`)보다 먼저 실행됨.
  - 제안: 우선순위 낮음. 필요하면 두 리스트를 모두 계산한 뒤 하나의 리포트에서 함께 보고하도록
    재구성.

- **[INFO]** `classify_vulnerable()` 의 `reported[module] = adv.get("github_advisory_id") or
  adv.get("id") or name` 폴백은 선언된 타입(`dict[str, str]`)과 달리, `github_advisory_id` 가
  없고 `id` 만 있는 advisory(정수)가 오면 값이 `int` 가 될 수 있다 — 이 경로는 테스트되지 않았고
  (모든 픽스처가 `github_advisory_id` 를 포함), 이런 advisory 가 문자열 키를 가진 다른 advisory와
  함께 `sorted(eroded)` 로 정렬될 경우 `TypeError`(str vs int 비교 불가) 가능성이 이론상 있다.
  `pnpm audit`/GHSA 기반 advisory 는 통상 `github_advisory_id` 를 갖고 있어 발생 가능성은
  낮다.
  - 위치: `scripts/check-override-floors.py` `classify_vulnerable()` (reported 딕셔너리 구성부).
  - 제안: 우선순위 낮음. `str(adv.get("github_advisory_id") or adv.get("id") or name)` 로 명시
    캐스팅하거나 해당 폴백 경로에 대한 회귀 테스트 추가.

## 요약

1차 리뷰의 Critical 4건·Warning 4건 중 7건은 코드를 직접 실행/재현해 검증한 결과 정확하고
유효하게 조치됐다 — 특히 `ignoreCves` 전역 억제 사각(가장 심각했던 CRITICAL)은
`classify_vulnerable()` + 경로 baseline 재설계로 올바르게 닫혔고, 실제 `pnpm audit` 실행으로
현재 상태가 OK 임을 직접 확인했다. 그러나 나머지 1건 — "harness-checks.yml unittest 잡에 PyYAML
설치 추가" — 은 시도는 됐으나 YAML 매핑에 `run:` 키가 중복되는 구조 오류로 정반대 결과를 낸다:
의도한 `pip install "pyyaml>=6,<7"` 명령이 파싱 단계에서 조용히 사라지고, `Run harness unit
tests` 스텝은 빈 스텝이 된다. PyYAML 없는 인터프리터로 직접 재현한 결과 `test_override_floors.py`
관련 16개 테스트가 실패/에러로 깨졌고, 이 CI-only 결함은 로컬 검증(PyYAML 이 이미 설치돼 있음)
으로는 절대 드러나지 않는다 — 정확히 1차 리뷰의 testing reviewer 가 예견했던 은폐 시나리오가
현실화된 것이며, 이 워크플로 파일의 `jobs:` 구조를 검증하는 가드가 저장소 어디에도 없어 완전히
무가드 상태다. 이 하나의 CRITICAL 을 제외하면 나머지는 "세 축"/"Three axes" 서술이 실제 4개
항목과 어긋나는 경미한 문서 정확성 문제, 그리고 낮은 우선순위의 방어적 코드 개선 여지 정도이며,
spec 관련 영역은 없음(spec_impact: none과 일치, 관련 spec 문서 부재도 정합).

## 위험도

CRITICAL
