# 요구사항(Requirement) 리뷰 — deps-guard-hardening (4차)

## 전제 및 검증 방법

이 diff 는 1차(`01_12_24`)·2차(`01_56_46`)·3차(`02_38_45`) 리뷰의 누적 조치 결과물이며, 최신 커밋
`99f6110c0`("3차 리뷰 조치 — 스키마 드리프트 fail-closed + Warning 6건")은 어느 라운드에서도 아직
리뷰되지 않은 새 코드다. diff 판독이 아니라 실제로 코드를 `Read`하고, 하네스 전체 스위트
(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)를 직접 실행하고, 실제
`pnpm audit --audit-level=moderate --json`/`python3 scripts/check-override-floors.py`를 이
저장소에서 실행하고, `classify_vulnerable()`을 직접 임포트해 합성 입력으로 호출해 재검증했다.

결과: 하네스 **744/744 PASS**, `test_override_floors.py` **25/25 PASS**, 실제 `pnpm audit` +
`check-override-floors.py` 실행 결과 `OK: override 대상 26개 패키지 중 취약 재유입 0건`(exit 0),
`harness-checks.yml`의 YAML 구조(1·2차가 지적한 `Install PyYAML`/`Run harness unit tests` 중복 키)는
두 독립 스텝으로 정상 분리돼 있음을 `yaml.safe_load()` 직접 파싱으로 확인, `deps-security-checks.yml`
헤더는 "세 가지를 강제한다"로 정정, plan 체크리스트의 테스트 건수(3차가 지적한 "18건/731건" stale)도
`grep -c "def test_"` 실측과 정확히 일치하는 "25건"/"744건"으로 갱신돼 있다. 1~3차가 지적한 CRITICAL
5건·WARNING 다수는 전부 코드 레벨에서 실제로 해소됨을 재확인했다. 다만 **3차 리뷰(architecture
WARNING)에 대한 이번 조치 자체(`classify_vulnerable`의 스키마 드리프트 fail-closed 신설)에서 새로운
논리 결함 1건을 직접 실행으로 발견**했다 — 아래 참조.

## 발견사항

- **[WARNING]** `classify_vulnerable()`의 `actions[]` 스키마 드리프트 fail-closed 검사가, `advisories`
  에 (override 대상과 무관한) 다른 advisory 가 하나라도 정상 파싱되면 조용히 무력화된다 — 이 검사가
  막으려는 시나리오(`ignoreCves`로 억제된 override 대상 패키지의 재침식, 이 스크립트 전체의 발단
  시나리오)가 정확히 그 상태에서 감지되지 않는다.
  - 위치: `scripts/check-override-floors.py:222`(`if actions and not suppressed and not reported:`),
    상호작용하는 `:206-210`(`suppressed` 축적 루프)과 `:216`(`if advisories and not reported:`, 자매
    검사).
  - 상세: 직접 재현해 확인했다 — `classify_vulnerable()`을 임포트해 다음 입력으로 호출:
    ```python
    audit = {
        "advisories": {"111": {"module_name": "unrelated-pkg", "id": 111,
                                "github_advisory_id": "GHSA-xxxx"}},
        "actions": [{"pkg": "brace-expansion",  # 'module' → 'pkg' 로 개명된 상황을 시뮬레이션
                     "resolves": [{"path": "a>b>brace-expansion"}]}],
    }
    reported, suppressed = classify_vulnerable(audit)
    # reported = {'unrelated-pkg': 'GHSA-xxxx'},  suppressed = {}  — sys.exit(2) 없이 정상 반환
    ```
    `actions[].module` 필드명이 pnpm 상향으로 바뀌어도(위 예의 `pkg`), `action.get("module")`은
    `None`을 반환해 `suppressed`가 비게 된다. 이 자체는 217-227행의 두 번째 `_undecidable` 검사가
    잡으려는 바로 그 상황이다 — 그런데 그 검사 조건은 `actions and not suppressed and **not
    reported**`로, `reported`가 (완전히 무관한 다른 advisory 때문에) 비어있지 않으면 검사가
    통과해버린다. `main()`은 이어서 `suppressed`가 비어 있으므로 `widened = []`가 되고, "OK: 취약
    재유입 0건"을 그대로 출력한다(exit 0) — 즉 override 관리 대상이면서 `ignoreCves`로 억제된
    패키지(현재 저장소의 `brace-expansion`이 정확히 이 조건)가 실제로 재침식돼도 이 조합에서는
    잡히지 않는다. 이 경로는 이 스크립트 전체의 **발단 시나리오**(`ignoreCves`가 `advisories`를
    CVE 단위로 전역 삭제하므로 `actions[]`만이 유일한 관측 창구)를 정확히 겨냥한다. "advisories
    비정상 + actions 정상"과 "advisories 정상 + actions 비정상"을 대칭으로 처리하려던 의도(216행과
    222행의 병렬 구조)가, `and not reported`라는 교차 조건 때문에 후자에서만 비대칭적으로
    무력화된다 — `reported`(advisories 유래)와 `suppressed`(actions 유래)는 서로 독립적인 추출
    경로인데, 한쪽의 성공이 다른 쪽의 실패를 가리는 구조다. 현재 `.claude/tests/test_override_floors.py`
    의 `SchemaDriftTest.test_actions_without_module_is_undecidable`(323-329행)은 `advisories={}`로만
    호출해 이 조합(advisories 비어있지 않음 + actions 드리프트)을 검증하지 않는다 — 즉 회귀 테스트로도
    막히지 않는 상태다. 다만 이 저장소의 현재 실측 상태(`pnpm audit` 응답이 `advisories: {}`,
    `actions: [brace-expansion 1건]`)에서는 이 조건이 성립하지 않아 **지금 당장 터지는 결함은
    아니다** — 이 코드는 아직 일어나지 않은 미래의 pnpm 스키마 변경에 대비한 하드닝이고, 그 방어
    자체에 난 구멍이다. 3차 아키텍처 리뷰가 "하위 필드명 미검증"을 WARNING(LOW risk)으로 지적했고
    이번 조치가 그 WARNING에 대한 응답이라, 그 응답 자체에 남은 잔여 결함도 동일 등급(WARNING)으로
    본다.
  - 제안: `actions` 축의 드리프트 판정을 `reported`의 상태에서 분리한다 — 예:
    `if actions and not any(a.get("module") for a in actions): _undecidable(...)`처럼 "이 배열의
    어떤 항목도 `module`을 추출하지 못했다"를 독립적으로 검사할 것(정상적으로 `reported`와 겹쳐
    `suppressed`에서 제외된 항목과, 애초에 필드를 못 읽어 제외된 항목을 구분). `SchemaDriftTest`에
    "`advisories`는 정상(무관한 패키지) + `actions[].module` 드리프트" 조합 케이스를 추가해 고정할 것.

- **[WARNING]** 의도와 구현 간 괴리 — `test_override_floors.py` 모듈 docstring(및 이를 그대로
  미러링한 `README.md` 카탈로그 행)의 "축 4: fail-closed" 서술이 "세 형태를 exit 2 로 고정한다"고
  단정하지만, 실제로 exit 2 로 이어지는 형태는 `FailClosedTest`의 4건(+워크스페이스 파일 부재)과
  `SchemaDriftTest`의 2건(advisories/actions 각각의 하위 필드 누락)까지 최소 6가지다 — 이 PR
  자신이 이미 한 번("세 축"→"네 축", 2차 리뷰 WARNING) 잡았던 것과 같은 클래스의 재발이다.
  - 위치: `.claude/tests/test_override_floors.py:27-30`(모듈 docstring, "빈 출력 / 파싱 불가 /
    `actions` 키 없는 JSON 세 형태를 exit 2 로 고정한다") 및 `.claude/tests/README.md:39`
    (카탈로그 행, "empty stdout, unparseable output, and a valid-JSON error payload with no
    `actions` key" 로 동일하게 세 형태만 나열).
  - 상세: `FailClosedTest`는 4건(빈 stdout·파싱 불가·`actions` 키 없는 오류 페이로드·워크스페이스
    파일 부재)이고, 이번 커밋(`99f6110c0`)이 신설한 `SchemaDriftTest`는 별도로 2건
    (`advisories` 항목에 `module_name` 없음, `actions` 항목에 `module` 없음)을 더 exit 2 로
    고정한다 — 도합 6가지 형태가 "판단 불가"로 처리되는데 문서는 여전히 "세 형태"라고 서술한다.
    `SchemaDriftTest`는 축 4의 하위 항목으로 취급되는지 별도 축인지 모듈 docstring 어디에도
    명시되지 않아, "네 축" 요약만 읽는 사람은 스키마 드리프트 방어의 존재 자체를 놓친다. 기능에는
    영향 없는 순수 서술 문제이지만, 정확히 이 PR 안에서 같은 성격의 결함이 이미 WARNING 으로
    다뤄진 전례가 있다.
  - 제안: 축 4 문구를 실제 형태 수에 맞게 갱신하거나(예: "실행-레벨 네 형태 + 스키마-드리프트 두
    형태를 exit 2 로 고정한다"), `SchemaDriftTest`를 5번째 축으로 승격해 모듈 상단 "네 축"도 함께
    "다섯 축"으로 정정할 것. `README.md:39`도 동일하게 갱신.

- **[INFO]** spec fidelity — `spec/` 전체에 override 침식 검출·dependabot·`ignoreCves`·pnpm audit
  거버넌스 관련 문서가 없음을 `grep -rli`로 재확인했다(3차 리뷰와 동일 결론, 재검증 완료).
  `plan/in-progress/deps-guard-hardening.md` frontmatter 의 `spec_impact: none`과 일치 — CI·
  스크립트·설정 전용 변경으로 제품 명세와 무관하다. 조치 불요.

- **[INFO]** (긍정 관측, 실행 검증 완료) 1~3차 리뷰의 CRITICAL 5건 전부가 최신 HEAD 에서 실제로
  해소돼 있음을 이번 라운드에서도 독립적으로 재확인했다.
  - 상세: `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **Ran 744 tests ... OK**
    (실패 0). `python3 -m unittest discover -s .claude/tests -p 'test_override_floors.py'` →
    **25/25 PASS**(plan 체크리스트가 주장하는 정확한 수치와 일치, `grep -c "def test_"`로 재확인).
    `python3 scripts/check-override-floors.py`를 이 저장소에서 직접 실행 → `OK: override 대상
    26개 패키지 중 취약 재유입 0건`(exit 0, 실제 `pnpm audit` 호출). `python3 -c "import yaml;
    ..."`로 `.github/workflows/harness-checks.yml`을 직접 파싱해 `Install PyYAML`/
    `Run harness unit tests`가 완전히 분리된 두 스텝(각각 `run:` 정확히 1개)임을 확인 — 2차
    리뷰가 지적한 YAML 중복 키 CRITICAL 은 재발하지 않았다. `deps-security-checks.yml` 헤더가
    "세 가지를 강제한다"로 정정돼 있고 `override-floors` 잡 서술도 일치한다.
    `.claude/tests/test_dependabot_npm_coverage.py`(14/14)·`test_harness_checks_paths_coverage.py`
    (26/26)도 개별 실행으로 PASS 확인 — dependabot 루트 등록과 `harness-checks.yml`의
    `scripts/check-override-floors.py` 등재 모두 관련 가드와 충돌 없다. TODO/FIXME/HACK/XXX
    주석은 이번 diff 의 신규/변경 파일 어디에도 없음을 확인.

## 요약

이 PR의 핵심 요구사항(override 바닥 침식 검출·`ignoreCves` 수용 근거 규약·dependabot 되돌림 방지,
plan §1~§3)은 4차에 걸친 반복 검증 끝에 실제로 구현·해소돼 있다 — 이번 라운드에서 diff 판독이
아니라 실제 `pnpm audit` 실행, 744건 하네스 스위트 실행, YAML 직접 파싱으로 재검증했다. 1~3차가
지적한 CRITICAL 5건(YAML 구조 파손, `ignoreCves` 전역 억제 사각, CI 등재 3건)은 전부 코드 레벨에서
해소됨을 확인했고, plan 체크리스트의 수치 서술(25건/744건)도 실측과 정확히 일치한다. 다만 3차
리뷰의 WARNING("스키마 하위 필드 미검증")에 대한 이번 조치(`classify_vulnerable`의 신규 fail-closed
분기)를 직접 호출해 검증한 결과, `actions[]` 축의 드리프트 감지가 `reported`(advisories 유래, 무관한
패키지라도 상관없음)가 비어있지 않으면 무력화되는 논리적 결합 결함을 발견했다 — 이 스크립트 전체의
발단 시나리오(ignoreCves 로 억제된 override 대상의 재침식)를 정확히 겨냥한 유일한 관측 창구가
`actions[]`이므로, 이 경로가 무력화되면 그 발단 시나리오 자체가 다시 조용히 통과한다. 다만 현재
저장소의 실측 audit 응답 형태에서는 이 조건이 성립하지 않아 즉시 발현하는 결함은 아니고, 이미
존재하지 않던 방어(3차 WARNING, LOW risk)에 대한 응답의 잔여 갭이라 동일 등급(WARNING)으로 분류했다.
그 외 발견은 같은 파일의 "네 축" 서술이 신설된 스키마-드리프트 축을 반영하지 못한 문서 정확성
WARNING 1건(이 PR 안에서 이미 한 번 다뤄진 것과 동일 클래스의 재발)과, spec 문서 부재 확인 INFO
뿐이다. 관련 spec 문서는 존재하지 않으며(`spec_impact: none`과 일치) spec fidelity 위반도 없다.

## 위험도

LOW
