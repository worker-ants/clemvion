# 변경 범위(Scope) 리뷰 — deps-guard-hardening (4차 라운드)

## 검토 방법

`git diff origin/main...HEAD --stat`(41개 파일)로 전체 diff를 확보하고, prompt가 크기 제한으로
생략한 파일(`.claude/tests/README.md`·`test_override_floors.py`·`scripts/check-override-floors.py`
등)은 `Read`/`git show`로 원본을 직접 대조했다. 대조 기준은
`plan/in-progress/deps-guard-hardening.md`(§1 오버라이드 바닥 침식 검출 · §2 `ignoreCves` 근거
규약 · §3 dependabot 되돌림 방지)와, 이미 3회 수행된 `/ai-review`(`01_12_24`·`01_56_46`·
`02_38_45`)의 scope 판정 이력이다. 3차 scope 리뷰(`02_38_45/scope.md`)는 위험도 NONE으로
종결했으므로, 이번 라운드는 (a) 3차 리뷰 이후의 유일한 코드 델타인 커밋 `99f6110c0`을
`git show`로 전량 재검토하고 (b) 앞선 라운드들의 핵심 판단(워크플로 경로 확장의 정당성,
`pnpm-workspace.yaml` 값 불변, `harness-checks.yml`의 PyYAML 스텝 분리 유지)을 소스 파일을
직접 열어 독립적으로 재확인하는 데 집중했다.

## 발견사항

- **[INFO]** (검증 완료, 조치 불요) 3차 리뷰 이후 유일한 코드 커밋(`99f6110c0`)은 3차 리뷰
  자신이 지적한 Warning 6건에만 정확히 대응하며, 무관한 파일·기능은 포함하지 않는다.
  - 위치: `scripts/check-override-floors.py:125-135`(`_undecidable` 헬퍼 신설), `:212-227`
    (`classify_vulnerable()`의 스키마 드리프트 fail-closed 분기) / `.claude/tests/test_override_floors.py:47`
    (`MANAGED_OVERRIDES` 상수화), `:54-60`(`_PNPM_STUB` 고정 스텁), `:63-68`(`_stage_script()`
    추출), `:278-303`(`CombinedReportTest` 신설), `:305-334`(`SchemaDriftTest` 신설) /
    `.github/workflows/deps-security-checks.yml:3`("두 가지"→"세 가지") /
    `plan/in-progress/deps-guard-hardening.md`(체크리스트·Rationale 갱신).
  - 상세: `git show 99f6110c0`으로 커밋 전체를 직접 대조했다. 코드 변경은
    `scripts/check-override-floors.py`·`.claude/tests/test_override_floors.py` 두 파일과 이를
    설명하는 `deps-security-checks.yml` 헤더 주석 1단어, `plan/` 문서 갱신뿐이며, 각각
    3차 리뷰 라운드(`02_38_45`)의 특정 Warning(스키마 드리프트 미방어·`override_target` 다단
    조합 미고정·테스트 스텁의 `json.dumps` f-string 삽입 시 `true`/`false`/`null`이
    파이썬 소스에서 이름으로 해석되는 잠재 `NameError`·plan 수치 stale·헤더 문구)과 1:1로
    대응한다. `harness-checks.yml`·`.github/dependabot.yml`·`PROJECT.md`·`README.md`는 이
    커밋에서 전혀 건드리지 않았다(3차 리뷰가 이미 검증을 마친 상태 그대로 유지).
  - 제안: 조치 불요.

- **[INFO]** (재확인 완료) `.github/workflows/harness-checks.yml`의 "Install PyYAML" 스텝이
  2차 라운드에서 발견된 YAML 중복 키 결함 없이 독립 스텝으로 유지되고 있다.
  - 위치: `.github/workflows/harness-checks.yml:81-82`("Install PyYAML" 스텝, 독립) 및
    `:84-85`("Run harness unit tests" 스텝, 독립) — 두 스텝 사이에 빈 줄로 명확히 분리.
  - 상세: 2차 라운드가 지적한 CRITICAL("Install PyYAML"이 기존 스텝의 `name:`/`run:` 사이에
    삽입되어 `run:` 키 중복 → 설치 명령 소실)이 `c019a3e1b`에서 고쳐진 뒤 이번 라운드까지
    이 파일을 건드린 커밋이 없음을 `git log`로 확인했고, 현재 on-disk 파일을 직접 `Read`로
    열어 두 스텝이 각각 정상적으로 `run:` 하나씩만 가짐을 재확인했다. 회귀 없음.
  - 제안: 조치 불요.

- **[INFO]** (이월 판단 재확인) `harness-checks.yml`의 `paths:`가 개별 `e2e.yml` 항목에서
  `.github/workflows/**`로 넓어지고 신규 `test_workflow_yaml_structure.py`가 함께 추가된 것은
  원 plan(§1~§3, "의존성 보안 가드 3건")의 문면 범위를 표면적으로 넘어서지만, 2·3차 라운드가
  이미 "이 PR 자신이 만든 Critical 회귀에 대한 직접적 자기 교정"으로 판정한 사안이며 이번
  라운드에서 그 판단을 뒤집을 새 근거는 없다.
  - 위치: `.github/workflows/harness-checks.yml:41-52`(경로 확장과 근거 주석) /
    `.claude/tests/test_workflow_yaml_structure.py` 전체(161줄, 신규) /
    `.claude/tests/test_harness_checks_paths_coverage.py:106-113`(`KNOWN_COVERAGE_DEPENDENCIES`의
    `.github/workflows/**` 키).
  - 상세: `plan/in-progress/deps-guard-hardening.md`의 "개발 중 실측으로 드러난 것" 절이 경위를
    투명하게 기록하고 있고, `actionlint` 같은 더 넓은 대안을 채택하지 않은 이유도 `## Rationale`
    절에 명시돼 있다(3차 라운드의 architecture WARNING을 조치한 결과). 확장이 최소 필요분임은
    기존 가드(`test_each_historical_leak_is_load_bearing`)가 개별 `e2e.yml` 중복 등재를 실제로
    무효로 잡아 강제했다는 점에서도 뒷받침된다.
  - 제안: 조치 불요 — 다만 향후 라운드에서 다시 같은 질문이 나올 수 있으므로 이 근거를
    누적 유지할 것.

- **[INFO]** `pnpm-workspace.yaml` diff는 이번 라운드에서도 `auditConfig` 주석 추가뿐이며
  `overrides`/`ignoreCves`의 실제 값은 origin/main 대비 변경되지 않았다.
  - 위치: `pnpm-workspace.yaml:69-85`(신규 주석 블록, §2 수용 근거 규약).
  - 상세: 값 라인(`overrides:` 25-54행대, `ignoreCves:` 86행대 이후)이 diff에 전혀 등장하지
    않음을 직접 대조했다 — `check-pnpm-security-config.py`의 `EXPECTED_*` 2-place 동기화
    규약을 깨뜨릴 여지가 없다(plan이 명시적으로 경고한 함정을 그대로 회피).
  - 제안: 조치 불요.

- **[INFO]** `scripts/check-override-floors.py`(320줄) 전체를 직접 읽어 확인한 결과, §1(오버라이드
  바닥 침식 검출) 범위를 벗어나는 기능(CLI 인자·부가 서브커맨드·무관한 유틸리티)이 없다.
  - 위치: 파일 전체 — `EXPECTED_SUPPRESSED_PATHS`(62-68행)·`_undecidable`(125-135행)·
    `classify_vulnerable`(173-228행)·`main`(231-276행) 모두 §1의 "이미 override로 관리 중인
    패키지의 재침식만 좁혀 본다"는 단일 목적에 직접 종속된다.
  - 상세: `codebase/**`는 diff에 전혀 포함되지 않았고(`git diff origin/main...HEAD -- 'codebase/**'`
    로 확인, 결과 없음), `spec_impact: none`이라는 plan 선언과 일치한다. 애플리케이션 코드
    영역으로의 누출이 없다.
  - 제안: 조치 불요.

- **[INFO]** (하네스 워크플로 밖의 관찰, 우선순위 낮음) `test_override_floors.py` 모듈
  docstring의 "네 축" 인벤토리가 3차 라운드 커밋(`99f6110c0`)에서 신설된 `SchemaDriftTest`
  클래스를 별도 항목으로 반영하지 않았다 — 같은 파일이 2차 라운드에서 정확히 이 클래스의
  "축 개수 서술과 실제 항목 수 불일치"(그때는 "세 축"↔실제 4개)를 지적받아 고친 전례가 있다.
  - 위치: `.claude/tests/test_override_floors.py:7`("여기서 고정하는 것은 네 축이다"),
    `:27-30`(축 4 "fail-closed" 설명 — "빈 출력 / 파싱 불가 / `actions` 키 없는 JSON 세 형태"만
    나열) vs `:305-334`(`SchemaDriftTest`, `run_audit()`이 아니라 `classify_vulnerable()`의
    하위 필드 스키마 드리프트를 검증하는 별도 클래스).
  - 상세: `SchemaDriftTest`가 검증하는 두 분기(`advisories`에 `module_name` 없음 /
    `actions`에 `module` 없음, `scripts/check-override-floors.py:216-227`)는 축 4의 "세 형태"
    (모두 `run_audit()` 소속)와는 다른 함수(`classify_vulnerable()`)에서 일어나는 별개의
    fail-closed 조건이라, "세 형태"라는 문구가 이제 실제 fail-closed 트리거 5종 중 3종만
    가리킨다. 기능 자체(스키마 드리프트 방어)는 3차 architecture WARNING에 대한 정당한
    조치이고 회귀 테스트도 붙어 있어 **기능 확장은 정당**하지만, 그 확장을 설명하는 상위
    inventory 서술이 뒤처졌다. 스코프 위반이라기보다 문서 동기화 성격이 강해 테스트/문서
    리뷰어의 판단이 더 적합할 수 있으나, 이 파일 자체가 같은 클래스의 드리프트를 스스로
    경계해 온 이력이 있어 기록해 둔다.
  - 제안: 우선순위 낮음 — 여유 있을 때 축 4 설명에 "및 `classify_vulnerable()`의 하위 필드
    스키마 드리프트(`SchemaDriftTest`)" 한 구절을 추가하거나, 5번째 축으로 명시 분리.

- **[INFO]** (범위 정합 — 문제 아님) `review/code/2026/08/01/{01_12_24,01_56_46,02_38_45}/**`
  (29개 파일)가 이번 diff의 대다수 파일 수를 차지하지만, 이는 무관한 파일 혼입이 아니라
  프로젝트 컨벤션상 예상된 상태다.
  - 위치: `review/code/2026/08/01/01_12_24/*`, `01_56_46/*`, `02_38_45/*`.
  - 상세: `CLAUDE.md`가 코드 리뷰 산출물의 정식 저장 위치로 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`를
    지정하고, 이 경로는 gitignore 대상이 아니다. "구현 완료 후 `/ai-review` + Critical/Warning
    fix"는 이 프로젝트가 상시 승인한 강제 워크플로다. 이 파일들은 정확히 그 1~3차 리뷰의
    산출물이며, 각 라운드의 fix 커밋이 해당 리뷰 결과를 조치한 근거로 함께 커밋됐다.
  - 제안: 조치 불요.

## 요약

3차 scope 리뷰(`02_38_45`)가 이미 위험도 NONE으로 판정했고, 그 이후의 유일한 코드 델타인 커밋
`99f6110c0`을 `git show`로 전량 재검토한 결과 3차 리뷰 자신의 Warning 6건에만 정확히 대응하며
무관한 파일·기능 확장은 없었다. `harness-checks.yml`의 PyYAML 스텝 분리(2차 CRITICAL 조치)는
회귀 없이 유지되고 있음을 on-disk 파일을 직접 읽어 재확인했고, `pnpm-workspace.yaml`은 이번
라운드에서도 주석만 추가돼 실제 override/ignoreCves 값은 origin/main과 동일하다.
`scripts/check-override-floors.py`(320줄) 전체를 다시 읽어도 §1 범위를 벗어나는 기능은 없고,
`codebase/**`는 diff에 전혀 포함되지 않아 `spec_impact: none` 선언과 일치한다. `.github/workflows/**`
경로 확장 + `test_workflow_yaml_structure.py` 신설은 표면적으로 원 plan 범위를 넘어서 보이지만
이 PR 자신이 만든 Critical 회귀에 대한 자기 교정이라는 2·3차 라운드의 판단을 뒤집을 근거는
찾지 못했다. 유일하게 새로 발견한 것은 사소한 문서 동기화 지연 하나뿐이다 — 3차 라운드가
추가한 `SchemaDriftTest`(스키마 드리프트 fail-closed, 정당한 기능 확장)가 모듈 docstring의
"네 축"/"세 형태" 인벤토리에 반영되지 않았다. 병합을 막을 사안은 아니며, 무관한 리팩토링·
포맷팅 혼입·불필요한 주석/임포트 변경·요청 밖 기능 추가는 발견되지 않았다.

## 위험도

NONE
