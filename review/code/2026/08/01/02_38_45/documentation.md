# 문서화(Documentation) 리뷰 — deps-guard-hardening (3차 라운드)

## 전제: 1차(`01_12_24`)·2차(`01_56_46`) 리뷰 조치 검증

이번 라운드가 리뷰하는 diff는 1차·2차 리뷰의 문서화 관련 발견사항을 조치한 결과물이다. 코드를 직접
`Read`하고 하네스 스위트를 직접 실행해 재검증했다.

- `harness-checks.yml`의 YAML 중복 키(2차 CRITICAL, reviewer 8명 전원 확인) — `Install PyYAML`과
  `Run harness unit tests`가 완전히 분리된 독립 스텝으로 재작성됐다. `python3 -c "import yaml; ..."`로
  직접 파싱해 두 스텝 모두 `run:` 정확히 1개씩만 가짐을 확인했고, `test_workflow_yaml_structure.py`
  전체(6건)를 실행해 PASS를 확인했다. **유효한 조치로 검증됨.**
- "세 축"/"Three axes" 자기모순(2차 WARNING) — `test_override_floors.py:7`과 `README.md:39`가 모두
  "네 축"/"Four axes"로 정정되어 있고, `MultipleMatchTest`까지 포함해 실제 클래스 구성과 일치한다.
  **유효.**
- `PROJECT.md`의 3번째 잡(override-floors) 누락(2차 WARNING) — `PROJECT.md:48`에 "(3)
  `scripts/check-override-floors.py`로..." 절이 추가됐다. **유효.**
- `README.md`의 "stdlib 전용·설치 스텝 없음" 불변식 미갱신(2차 WARNING) — `README.md:19-27`에 PyYAML
  예외가 명시적으로 추가됐다("**One exception, added 2026-08-01: PyYAML.**"). **유효.**
- `README.md`의 dependabot 카탈로그 행이 워크스페이스-루트 예외를 반영 못함(2차 WARNING) —
  `README.md:38` 행에 "Since 2026-08-01 the table also admits ONE directory..." 단락이 추가됐다.
  **유효.**
- `harness-checks.yml`의 파일명 오기(2차 INFO #17, "같은 파일 deps-security-checks.yml") —
  `harness-checks.yml:79`가 "`deps-security-checks.yml` 의 config-guard 잡과 동일한 pin 을
  재사용한다"로 정정되어 더 이상 "같은 파일"이라고 주장하지 않는다. **유효.**
- `_run_with_stub_audit`의 self 미사용 인스턴스 메서드 관례 이탈(2차 WARNING) — 모듈 레벨
  `run_with_stub_audit()`로 승격되어 4개 클래스가 `self` 없이 직접 호출한다. **유효.**

1차·2차가 지적한 문서화 관련 항목은 모두 실제로 해소됐다. 다만 그 해소 과정 자체가 diff 내부에
새로운 소규모 불일치 2건을 남겼다 — 아래 발견사항 참조.

## 발견사항

- **[WARNING]** `.github/workflows/deps-security-checks.yml`의 파일 헤더 주석이 "두 가지를
  강제한다"고 서술하지만, 이 diff가 세 번째 잡(`override-floors`)을 추가해 실제로는 세 가지를
  강제한다 — `PROJECT.md`에서 이미 정정된 것과 정확히 같은 종류의 누락이 이 워크플로 파일 자신의
  헤더에는 남아 있다.
  - 위치: `.github/workflows/deps-security-checks.yml:3`("두 가지를 강제한다:"), `:4`("1.
    config-guard — ..."), `:9`("2. audit — ...") — 대조 대상은 같은 파일의 신규 `:74`
    (`override-floors:` 잡 정의).
  - 상세: 헤더 주석(1-13행)은 "두 가지를 강제한다: 1. config-guard ... 2. audit ..."라고 선언하고
    끝난다. 이 diff는 같은 파일 하단에 `override-floors` 잡(74-94행, `scripts/check-override-floors.py`
    실행)을 세 번째 잡으로 신설했지만, 헤더 주석은 갱신되지 않아 파일을 처음 읽는 사람은 이 잡의
    존재를 헤더만으로는 알 수 없다. 이번 라운드가 리뷰하는 diff는 정확히 같은 성격의 문제
    (`PROJECT.md:48`이 신규 3번째 잡을 서술하지 않던 것, 2차 리뷰 WARNING)를 이미 조치했는데 —
    `PROJECT.md`는 지금 "(1) ... (2) ... (3) `scripts/check-override-floors.py` 로..."로 세 항목을
    정확히 나열한다 — 같은 잡 3개를 다루는 이 워크플로 파일 자신의 헤더는 그 정정이 미러링되지
    않았다.
  - 제안: 헤더를 "세 가지를 강제한다"로 바꾸고, "3. override-floors — 이미 override 로 관리 중인
    패키지가 다시 취약해졌는지(바닥 침식) 를 좁혀 검출한다" 절을 (1)/(2) 뒤에 추가 — `PROJECT.md:48`과
    같은 문구를 재사용하면 두 문서가 어긋날 위험도 줄어든다.

- **[WARNING]** `plan/in-progress/deps-guard-hardening.md`의 두 서술이 같은 diff에 포함된 최신
  코드/문서 상태와 어긋난다 — 회귀 테스트 개수, 그리고 "몇 번 틀렸는가"라는 개발 서사 둘 다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:110-111`(테스트 개수·하네스 스위트 전체 건수),
    `:132`(같은 파일 내 상충하는 최신 수치), `:138`("두 번" 서술) — 대조 대상은
    `.claude/tests/test_override_floors.py:10`(같은 diff의 "세 번" 서술).
  - 상세: (a) 체크리스트 110-111행은 "`.claude/tests/test_override_floors.py` **18건**... 하네스
    전체 스위트 731건 통과"라고 주장한다. 그러나 같은 diff가 반영하는 최종 코드(2차 리뷰 조치로
    `test_scope_package_in_the_middle_of_a_chain` 등 2건이 추가됨)를 `python3 -m unittest discover -s
    .claude/tests -p 'test_override_floors.py'`로 직접 실행하면 **20건**이고, 전체
    `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`는 **739건**이다(둘 다 이 리뷰에서
    직접 실행해 확인). 같은 파일의 바로 아래 132행("TEST WORKFLOW (3차) ... 하네스 739 OK")이 이미
    정확한 최신 수치를 기록하고 있어, 110-111행과 132행이 같은 문서 안에서 서로 다른 총량(731 vs
    739)을 주장하는 상태다. (b) "개발 중 실측으로 드러난 것" 절 138행은 "**패키지명 추출을 두 번
    틀렸다**"며 사례 2건만 나열한다(141-144행). 그러나 같은 diff의
    `.claude/tests/test_override_floors.py:10` 모듈 docstring은 "개발 중 **세 번** 틀렸고 셋 다
    증상이 같았다"며 3번째 사례("`@` 이전 구간에서만 `>` 를 찾으면 `a>@scope/b>c` 의 마지막 `>` 를
    못 본다")까지 명시한다 — 이 3번째 사례는 2차 리뷰 WARNING("`override_target()`이 체인 중간
    scope 패키지를 놓친다")에 대응해 추가된 것인데, plan의 회고 서사에는 반영되지 않았다. 두 문서가
    diff 발생지가 동일한(코드는 20건/세 번, plan은 18건/두 번) 하나의 사실을 다른 숫자로 서술한다.
  - 제안: 110-111행을 "20건"/"739건"으로, 138행을 "세 번"으로 정정하고 141-144행 목록에 "`@` 이전
    구간에서만 `>` 를 찾으면 `a>@scope/b>c` 의 마지막 `>` 를 못 본다"는 3번째 사례를 추가해
    `test_override_floors.py`의 모듈 docstring과 맞춘다.

## 참고 (INFO)

- **[INFO]** `review/code/2026/08/01/01_12_24/**`·`review/code/2026/08/01/01_56_46/**`(1·2차 리뷰
  산출물, 이번 diff에 신규 파일로 포함됨)는 CLAUDE.md 정보 저장 규약상 "코드 리뷰 산출물"이며
  타임스탬프 디렉터리 단위의 불변 스냅샷이다. 그 안의 발견사항 다수가 이후 커밋(3ff26348c,
  969f7ac0d, c019a3e1b)으로 이미 해소됐지만, 이는 스냅샷을 "갱신"할 대상이 아니라 그 시점의 정확한
  기록으로 남아야 하므로 본 리뷰의 문서-정확성 점검 대상에서 의도적으로 제외했다. 두 SUMMARY.md의
  집계(예: `01_56_46/SUMMARY.md`의 "reviewer 8명 전원") 자체는 각 라운드의 meta.json/개별 리포트와
  대조해 정확함을 확인했다.
- **[INFO]** (긍정 관측) `scripts/check-override-floors.py`·`.claude/tests/test_override_floors.py`·
  `.claude/tests/test_workflow_yaml_structure.py` 세 신규 파일의 모듈/함수 독스트링은 이례적으로
  상세하고 실측 근거(회귀 사례, 실패 경위, 재현 절차)를 정확히 담고 있다. `pnpm-workspace.yaml`의
  `auditConfig` 주석(수용 근거 3종 요구)과 `.github/workflows/harness-checks.yml`의 `paths:` 등재
  주석(왜 각 필터가 필요한지)도 마찬가지다. 위 두 WARNING을 제외하면 이번 diff의 문서화 수준은
  전반적으로 높다.

## 요약

1차·2차 리뷰가 지적한 문서화 관련 항목(YAML 구조 손상, "세 축/네 축" 자기모순, `PROJECT.md` 3번째
잡 누락, README의 "설치 스텝 없음"·dependabot 카탈로그 불변식 미갱신, 테스트 헬퍼 self 관례 이탈,
파일명 오기)은 모두 실행/직접 대조로 재검증한 결과 이번 diff에서 정확히 해소됐다. 다만 그 해소
작업 자체가 새로운 소규모 drift 2건을 남겼다 — `PROJECT.md`에서는 고친 "신규 3번째 잡 미서술"이
`deps-security-checks.yml` 자신의 헤더 주석에는 미러링되지 않았고, `test_override_floors.py`에
추가된 3번째 회귀 사례("두 번"→"세 번")와 2건의 추가 테스트("18건"→"20건", 하네스 전체
"731건"→"739건")가 `plan/in-progress/deps-guard-hardening.md`의 회고 서사·체크리스트 수치에는
반영되지 않았다(같은 plan 파일 안에서 731건과 739건이 상충하는 상태로 공존한다). 둘 다 CI를
차단하거나 기능에 영향을 주지 않는 문서 전용 drift이며, 지금까지 이 저장소가 같은 클래스의
문제(예: "세 축/네 축")를 WARNING으로 다뤄온 것과 동일한 성격이다. 그 외 신규 스크립트·테스트·
YAML 주석의 문서화 수준은 독스트링·인라인 주석 모두 높은 완성도를 유지하고 있다.

## 위험도

LOW — 병합을 차단하거나 기능에 영향을 주는 문제는 없다. 두 WARNING 모두 내부 추적 문서(워크플로
헤더 주석, plan 체크리스트)의 수치·항목 나열이 diff 내 최신 코드 상태를 완전히 반영하지 못한
비차단성 drift다.
