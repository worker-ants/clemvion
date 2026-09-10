# 테스트(Testing) 리뷰 — deps-audit-floor-refresh-2026-09

## 범위 요약

이번 변경은 애플리케이션 로직 수정이 아니라 **의존성 버전 상향 + 거버넌스 스크립트
baseline(`EXPECTED_OVERRIDES`) 데이터 갱신**이다 (`pnpm-workspace.yaml` overrides 8건 값
상향·1건 신설, `codebase/{backend,frontend,channel-web-chat}/package.json` 직접 의존 4건
상향, `pnpm-lock.yaml` 재해소, `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES`
동반 갱신, `CHANGELOG.md`/신규 plan 문서). 새로 추가된 함수·분기·조건문은 없다 — 따라서
"이 diff 에 대한 신규 단위 테스트가 필요한가" 라는 질문의 답은 원칙적으로 "아니오" 에
가깝다. 그러나 몇 가지 검증·커버리지 관점 관찰이 있다.

## 발견사항

- **[INFO]** 런타임 의존성 버전 상향(next 16.2.12→16.3.3, nodemailer 9.0.5→9.1.1,
  csv-parse 7.0.1→7.0.2 등)에 대한 회귀 검증이 실제로 수행되고 로그로 남아 있음을 확인했다.
  - 위치: `plan/in-progress/deps-audit-floor-refresh-2026-09.md` 체크리스트 (TEST WORKFLOW 4항목)
  - 상세: `_test_logs/unit-20260910-200659.log` 를 직접 열어 대조한 결과, plan 이 주장하는
    "backend 454 suites / 9,521 tests" 는 로그의 `Test Suites: 454 passed, 454 total` /
    `Tests: 1 skipped, 9521 passed, 9522 total` 과 정확히 일치했다. `_test_logs/e2e-20260910-201258.log`
    도 `Test Suites: 52 passed, 52 total` / `Tests: 305 passed, 305 total` / `51 passed (1.0m)`
    (playwright) 로 plan 의 주장과 일치했다. `python3 scripts/check-pnpm-security-config.py` 를
    직접 재실행해도 `OK: overrides 33건(값 포함) · ... baseline 일치` (exit 0) 로 plan 의 검증
    로그와 일치했다. 그리고 `.claude/tests/test_override_floors.py` (39 tests / 5 subtests)를
    직접 재실행해 이번 `pnpm-workspace.yaml` override 변경(특히 `js-yaml` 스코프 키 범위가
    `<4.3.1`→`<4.3.2`, `<3.15.1`→`<3.15.2` 로 넓어진 부분) 이 기존 회귀 테스트를 깨지 않음을
    확인했다. 프록시 숫자가 아니라 실제 로그·재실행으로 대조한 결과이며, 결함은 아니고
    **테스트 증거가 실측을 통해 뒷받침됨**을 확인한 긍정적 발견이다.
  - 제안: 없음 (확인 목적의 기록).

- **[INFO]** `scripts/check-pnpm-security-config.py` — 이 PR 이 직접 편집하는 `EXPECTED_OVERRIDES`
  baseline 딕셔너리를 가진 스크립트 — 는 전용 단위 테스트가 전혀 없다.
  - 위치: `scripts/check-pnpm-security-config.py` (파일 전체, 특히 `main()` 함수의 `_check_set`/
    override 대조 로직); 대조군: `.claude/tests/test_override_floors.py` (형제 스크립트
    `scripts/check-override-floors.py` 를 위해 669줄, "값 약화·키 부재·비-dict 타입·YAML
    파싱 실패·PyYAML 1.1 불리언 강제 리졸버" 등 정확히 같은 실패 클래스를 엣지 케이스로
    고정한 테스트 스위트가 존재).
  - 상세: 이 PR 의 rationale 은 "설정 + baseline 2-place 편집 자체가 리뷰 게이트" 라고 명시한다
    (스크립트 docstring). 즉 이 스크립트가 drift 를 정확히 검출하는지가 이번 변경 전체의
    안전망이다. 그런데 `main()` 은 `actual_overrides = ws.get("overrides") or {}` 처럼 타입을
    검증하지 않고 바로 `name not in actual_overrides` / `for name in actual_overrides` 를 쓴다
    — `overrides` 가 dict 가 아니라 list·string 등으로 잘못 파싱되는 극단 케이스(형제 스크립트
    `check-override-floors.py` 가 실제로 세 번 겪은 클래스, 예: PyYAML 이 bare `on`/`no` 키를
    불리언으로 강제 변환하는 리졸버 이슈)에서 크래시하거나 조용히 다른 결과를 낼 수 있는지
    검증된 바 없다. 이번 diff 는 해당 스크립트의 **로직**을 바꾸지 않고 데이터(`EXPECTED_OVERRIDES`
    값)만 갱신했으므로 이 갭은 이 PR 이 만든 회귀는 아니다 — 다만 이 PR 이 그 계약을
    실측으로 의존하고 있는 자리이므로 기록해 둔다.
  - 제안: (이 PR 범위 밖) `check-override-floors.py` 의 `WorkspaceReadFailureTest`/
    `MissingOverridesKeyTest` 패턴을 참고해 `check-pnpm-security-config.py` 에도 최소한
    "overrides 가 dict 아닐 때", "onlyBuiltDependencies/ignoreCves 가 리스트 아닐 때" 같은
    fail-closed 스모크 테스트를 별도 plan 항목으로 등재할 만하다.

- **[INFO]** `.claude/tests/test_override_floors.py::OverrideTargetExtractionTest.
  test_real_workspace_yaml_covers_scoped_range_keys` 는 fixture 대신 저장소의 실제
  `pnpm-workspace.yaml` 을 직접 읽어 단언한다 — 완전히 격리된 단위 테스트는 아니고 운영
  설정 파일 내용에 결합돼 있다. 이번 PR 이 `js-yaml` 스코프 키의 상한을 바꿨는데도 해당
  테스트는 "최소 2개 키 존재"만 보므로(`assertGreaterEqual(len(targets.get("js-yaml", [])), 2)`)
  값 자체의 변경은 감지하지 못한다 — 다만 이는 이 테스트의 설계 의도(추출 로직 검증)와
  일치하므로 결함으로 보지 않는다. 참고로만 남긴다.
  - 위치: `.claude/tests/test_override_floors.py` (`OverrideTargetExtractionTest` 클래스,
    `test_real_workspace_yaml_covers_scoped_range_keys` 메서드)

## 회귀 테스트 검증 (직접 재실행)

- `python3 -m pytest .claude/tests/test_override_floors.py -q` → `39 passed, 5 subtests passed` (변경 없음, 회귀 없음)
- `python3 -m pytest .claude/tests/test_dependabot_npm_coverage.py -q` → `14 passed, 5 subtests passed` (무관, 회귀 없음)
- `python3 scripts/check-pnpm-security-config.py` → `OK: overrides 33건(값 포함) · onlyBuiltDependencies 5건 · ignoreCves 0건 baseline 일치` (exit 0, plan 주장과 일치)
- 저장소 파일은 전혀 수정하지 않았다(읽기·재실행만). `git status --short` 확인 결과 이 리뷰 세션의 산출 디렉터리(`review/code/2026/09/10/20_17_59/`) 외 변경 없음 — 뮤테이션 없음.

## 요약

이 PR 은 애플리케이션 로직 변경이 없는 의존성 버전 상향 + 거버넌스 baseline 데이터
갱신이라, 전통적 의미의 "신규 테스트 필요성"은 낮다. 대신 검증 대상은 (1) 기존 회귀
스위트가 깨지지 않았는가, (2) plan 체크리스트가 주장하는 테스트 실행 결과가 실제 증거로
뒷받침되는가 였다. 두 축 모두 직접 재실행·로그 대조로 확인했고 **정확히 일치**했다 —
plan 의 수치가 실측과 다르다는 이 저장소의 반복된 실패 패턴("실측했다"가 틀렸던 사례들)이
이번에는 재발하지 않았다. 유일하게 기록할 만한 갭은 이 PR 이 직접 의존하는
`check-pnpm-security-config.py` 가 형제 스크립트 `check-override-floors.py` 와 달리 전용
단위 테스트가 전혀 없다는 비대칭이지만, 이는 이 diff 가 만든 회귀가 아니라 사전에 존재하던
구조적 갭이다.

## 위험도
NONE
