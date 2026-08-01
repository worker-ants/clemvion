# Code Review 통합 보고서

## 전체 위험도
**LOW** — 1·2차 라운드에서 지적된 CRITICAL 5건(1차 4건 + 2차 1건)과 WARNING 다수가 9개 reviewer 전원의 **직접 실행 재검증**(하네스 스위트 739건 실행, 실제 `pnpm audit` 호출, 과거 손상 커밋 원문 재생 등)으로 예외 없이 해소 확인됨. 이번 라운드는 CRITICAL 신규 발견 0건이며, 남은 6건의 WARNING은 전부 문서 수치 stale·테스트 커버리지 갭·코드 관례 이탈 등 **비차단성** 항목이다. forced(router_safety) 지정 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음 — 1·2차 라운드 CRITICAL 5건 전건이 이번 라운드 재검증으로 해소 확인되었고, 신규 CRITICAL은 발견되지 않았다.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `check-override-floors.py`의 fail-closed 검증이 pnpm audit JSON 최상위 `actions` 키 존재만 확인하고, `classify_vulnerable()`이 실제 의존하는 하위 필드(`advisories{}.module_name`, `actions[].module`, `actions[].resolves[].path`)의 스키마 드리프트는 방어하지 못한다. pnpm 메이저 상향으로 필드명이 바뀌면 `.get(...)`이 조용히 `None`을 반환해 "취약 재유입 0건"으로 오판할 수 있다. 유닛테스트는 전부 손으로 만든 스텁 JSON이라 실물 pnpm 필드명 자체는 검증되지 않는다 | `scripts/check-override-floors.py:153`, `:188-189`, `:195-196` | advisories/actions 엔트리가 있는데 전부 기대 키(`module_name`/`module`)를 못 가진 경우를 스키마 드리프트 신호로 fail-closed 처리하거나, CI의 `override-floors` 잡(실물 바이너리 호출 지점)에 최소 스모크 검증 추가 |
| 2 | Requirement / Testing / Documentation | plan 체크리스트의 회귀 테스트 건수·하네스 스위트 전체 건수 서술이 stale — "18건 / 731건"으로 적혀 있으나, 그 서술을 적은 바로 그 커밋(`c019a3e1b`)이 테스트 2건을 추가해 실제로는 **20건**이고, 신설 `test_workflow_yaml_structure.py`(+6)까지 더해 전체 스위트는 **739건**이다(3개 reviewer가 각각 직접 실행해 확인). 같은 문서의 132행은 이미 "739 OK"로 정확히 기록해, 한 문서 안에 731과 739가 상충 공존한다 | `plan/in-progress/deps-guard-hardening.md:110-111` (대비 `:132`) | 110-111행을 "20건" / "739건"으로 정정 |
| 3 | Testing | 2차 리뷰가 실제로 실패를 재현했던 정확한 입력 조합(체인 **중간** scope `a>@scope/b>` + **leaf**의 scope+range `@scope/c@>=1.0.0`)이 신규 회귀 테스트에 리터럴로 pin되지 않았다. 수정 자체는 올바름(직접 import로 재현 확인)이나, 이 스위트의 다른 모든 축이 따르는 "실측 실패를 그대로 pin" 관례에서 이 조합만 벗어나 있어 향후 회귀 시 현재 스위트로는 검출되지 않는다 | `.claude/tests/test_override_floors.py:170-181` (대비 `scripts/check-override-floors.py:95-111`) | `test_scope_package_in_the_middle_of_a_chain`에 `override_target("a>@scope/b>@scope/c@>=1.0.0") == "@scope/c"` 단언 1줄 추가 |
| 4 | Maintainability | 테스트 헬퍼 `run_with_stub_audit`가 가짜 `pnpm` 실행파일 소스를 중첩 f-string + `json.dumps()` 임베딩으로 동적 조립 — 이 스위트의 기존 관례(정적 스텁 + 환경변수 파라미터화, 예: `test_mermaid_lint_ready.py`의 `_NODE_STUB`)에서 벗어난다. (관련: security reviewer도 같은 코드가 `repr()` 없이 JSON을 직접 삽입해 향후 advisory에 `true`/`false`/`null` 값이 섞이면 생성된 스텁이 `NameError`로 깨질 수 있음을 별도 지적) | `.claude/tests/test_override_floors.py:48`, `:74-99` | payload(`advisories`/`actions`)를 tmp 파일에 `json.dump()`로 쓰고 `pnpm` 스텁은 고정 문자열로 둔 뒤 파일 경로만 환경변수로 전달 — 문자열 조립·이스케이프 제거 |
| 5 | Documentation | `.github/workflows/deps-security-checks.yml` 헤더 주석이 "두 가지를 강제한다"고 서술하지만, 이 diff가 3번째 잡(`override-floors`)을 신설해 실제로는 세 가지를 강제한다 — `PROJECT.md`에서 이미 정정된 것과 동일한 누락이 이 워크플로 파일 자신의 헤더에는 미러링되지 않았다 | `.github/workflows/deps-security-checks.yml:3-9` (대비 신규 `:74` `override-floors` 잡) | 헤더를 "세 가지를 강제한다"로 바꾸고 `PROJECT.md:48`과 동일한 문구로 "3. override-floors — ..." 절 추가 |
| 6 | Documentation | plan "개발 중 실측으로 드러난 것" 절이 "패키지명 추출을 **두 번** 틀렸다"며 사례 2건만 서술하나, 같은 diff의 `test_override_floors.py` 모듈 docstring은 "**세 번**" 틀렸다며 3번째 사례(`@` 이전 구간에서만 `>`를 찾아 `a>@scope/b>c`의 마지막 `>`를 놓치는 버그, 2차 WARNING 대응으로 추가)까지 명시한다 — plan의 회고 서사에 3번째 사례가 반영되지 않았다 | `plan/in-progress/deps-guard-hardening.md:138`, `:141-144` (대비 `.claude/tests/test_override_floors.py:10`) | 138행 "두 번"→"세 번" 정정, 141-144행에 3번째 사례 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `check-override-floors.py`의 `EXPECTED_SUPPRESSED_PATHS` baseline 대조가 일방향(`actual - allowed`)만 검사해, baseline에는 남아 있지만 더 이상 어떤 audit 결과에도 대응하지 않는 낡은 항목이 조용히 영구 누적될 수 있다. 자매 스크립트 `check-pnpm-security-config.py`는 양방향(missing/extra) 대조라 비대칭. 탐지 무력화 방향은 아님(안전한 쪽으로 fail-closed 유지) | `scripts/check-override-floors.py:61-67` vs `scripts/check-pnpm-security-config.py:82-88` | 여유 있을 때 `EXPECTED_SUPPRESSED_PATHS` 키가 현재 `ignoreCves`/override 대상과 여전히 대응하는지 확인하는 보조 체크 추가 |
| 2 | Architecture | 2차 라운드에서 3명(security·dependency·requirement)이 명시 제안한 `actionlint` 대안을 채택하지 않고 손수 작성한 2-불변식 검사기를 신설했다 — 선택 자체는 스코프에 정확히 맞아 방어 가능하나, plan의 `## Rationale`이 다른 두 기각 대안은 문단으로 근거를 남기면서 이 건은 기록하지 않았다 | `.claude/tests/test_workflow_yaml_structure.py:1-28` vs `plan/in-progress/deps-guard-hardening.md:182-193` | `## Rationale`에 "왜 `actionlint`를 채택하지 않았는가" 한 문단 추가(기각 이력 기록) |
| 3 | Requirement / Dependency | `dependabot.yml`의 `rebase-strategy: auto` 루트 등록이 원 사고(#1029/#1030, security update PR이 오래된 base에서 생성돼 보안 bump를 되돌리는 시나리오)를 실제로 방지하는지는 이 오프라인 환경에서 검증 불가능하다. 근본 조치(`--frozen-lockfile` 검증의 branch protection required check 승격)는 아직 repo Settings 소관으로 이 PR 스코프 밖이다. plan이 이미 P2 잔여 리스크로 투명하게 추적 중이라 은폐된 갭은 아니다 | `.github/dependabot.yml:35-41` vs `plan/in-progress/deps-guard-hardening.md:202-208` | 조치 불요 — 후속 추적 항목으로만 유지 |
| 4 | Maintainability | `OVERRIDES` YAML 리터럴이 두 테스트 클래스에 완전히 동일한 문자열로 중복(2차 리뷰 지적 이월, 미반영) — 하나만 고치는 편집이 나머지를 조용히 낡게 만들 수 있음 | `.claude/tests/test_override_floors.py:196`, `:337` | 모듈 레벨 상수로 추출해 두 클래스가 공유 |
| 5 | Maintainability | `run_audit()`의 fail-closed 분기 3곳(빈 stdout·JSON 파싱 실패·`actions` 키 부재)이 "사유 출력 + 진단 출력 + `sys.exit(2)`" 구조를 반복 — 4번째 사유 추가 시 `exit(2)`를 빠뜨리면 이 스크립트 자신이 막으려는 "판단 불가를 취약점 0건으로 오인" 클래스를 재현할 수 있음 | `scripts/check-override-floors.py:124`, `:139-161` | `_undecidable(reason, detail) -> NoReturn` 헬퍼로 통합해 세 지점이 같은 함수를 거치게 함 |
| 6 | Maintainability | `eroded`가 필드 이름 없는 4-tuple(`module, advisory, patched, keys`)로 생성·소비되어 위치 기반 언패킹에 의존 — 필드가 하나만 늘어도 순서 실수에 취약 | `scripts/check-override-floors.py:229-232`(생성), `:272-282`(소비) | `typing.NamedTuple`로 전환해 필드 의미 자체 문서화 |
| 7 | Maintainability | tempdir 생성 + `scripts/` 생성 + 스크립트 사본 배치의 3단계 셋업 코드가 `run_with_stub_audit`과 `test_missing_workspace_file_is_undecidable`에 중복 | `.claude/tests/test_override_floors.py:64-70` vs `:320-329` | 공통 부분을 `_stage_script(tmp)` 헬퍼로 추출해 공유, 또는 `run_with_stub_audit`에 워크스페이스 파일 생성 skip 옵션 추가 |
| 8 | Maintainability | `audit["advisories"]`를 `classify_vulnerable()`과 `main()`이 각각 한 번씩 순회(2차 리뷰 "우선순위 낮음" 이월, 미반영) — 기능·성능 문제는 없음 | `scripts/check-override-floors.py:188` vs `:211-215` | 우선순위 낮음 — `reported`의 값 타입을 `(advisory_id, patched_versions)`로 확장하면 두 번째 순회 제거 가능 |
| 9 | Testing | `main()`의 widened+eroded 동시 보고 로직(이번 라운드가 "조기 return 제거"로 명시한 수정)이 회귀 테스트로 고정되지 않음 — 조기 return을 mutation으로 재삽입해도 기존 20개 테스트 전부 GREEN 유지됨을 직접 확인(2차부터 이월) | `scripts/check-override-floors.py:219-248` | `advisories`(eroded 유발)와 baseline 밖 `actions[]`(widened 유발)를 동시에 주입해 stderr에 두 블록이 모두 나타나는지 확인하는 테스트 1건 추가 |
| 10 | Testing | `classify_vulnerable()`의 신규 `str(...)` 캐스팅 방어 코드(`github_advisory_id` 없이 `id`만 있을 때 `TypeError` 방지)가 테스트되지 않음 — 모든 advisory fixture가 `github_advisory_id`를 포함해 폴백 경로 미실행 | `scripts/check-override-floors.py:192` | `github_advisory_id` 없이 `id`(int)만 있는 advisory fixture 1건 추가 |
| 11 | Dependency | pip 의존성(`pyyaml>=6,<7`)이 정확 버전/해시 고정이 아닌 range로만 고정 — 3개 지점 모두 동일 range라 drift 위험은 없으나 `pnpm-lock.yaml` 수준의 재현성 보장은 없음. 기존 2개 지점 패턴을 3번째로 확장한 것일 뿐 신규 패턴 아니며, `yaml.safe_load`/`SafeLoader`만 사용해 실질 위험 낮음 | `.github/workflows/harness-checks.yml:82`, `deps-security-checks.yml:54,88` | 이번 PR 스코프 밖 — 여유 있으면 `pip install --require-hashes` 류 강화를 저장소 전체 정책으로 별도 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 1·2차 CRITICAL 2건(YAML 중복 키·`ignoreCves` 전역 억제)과 WARNING 1건(fail-open) 해소를 코드 직접 열람 + 커스텀 파서 재파싱으로 확인. 신규 코드(`check-override-floors.py`)에 인젝션/시크릿/인가 취약점 없음. 잔여는 INFO뿐(테스트 헬퍼 JSON 삽입 관례 — WARNING #4에 통합, 기존 액션 태그 컨벤션은 스코프 밖) |
| architecture | LOW | 함수 분리·SRP·CI 잡 분리 등 구조는 견고. WARNING 1건(fail-closed 검증이 pnpm audit 하위 필드 스키마 드리프트 미방어) + INFO 2건(baseline 드리프트 검출 비대칭, actionlint 미채택 근거 미기록) |
| requirement | LOW | 1·2차 CRITICAL 5건(1차 4 + 2차 1) 전부 diff 재독이 아닌 **코드 직접 실행**(`pnpm audit` 실호출 포함)으로 재검증해 해소 확인. WARNING 1건(plan 테스트 건수 stale) + INFO 2건 |
| scope | NONE | 애플리케이션 코드 변경 없음, 무관한 리팩터·기능 확장·포맷팅 혼입 없음. `.github/workflows/**` 트리거 확장은 이 PR 자신이 만든 2차 CRITICAL의 정당한 자기 교정(기존 가드가 최소성 검증), 리뷰 산출물 커밋도 규약상 정상 |
| side_effect | LOW | 2차 CRITICAL(YAML 손상) 해소를 파일 직접 확인 + 하네스 739건 실행으로 재현. 신규 side effect(pnpm audit 네트워크 호출·CI 트리거 확장·dependabot 등록)는 전부 의도·테스트로 고정되고 전역 상태(`os.environ`, PyYAML 로더) 오염 없음을 직접 재현 확인 |
| maintainability | LOW | 2차 CRITICAL + WARNING 3건(조기 return 제거·헬퍼 모듈화·축 개수 서술) 전부 반영 확인. WARNING 1건(테스트 헬퍼 동적 소스 생성이 관례 이탈) + INFO 5건(대부분 2차부터 이월된 저우선순위 리팩터 여지) |
| testing | LOW | 2차 CRITICAL 해소를 실제 손상됐던 과거 커밋(`3ff26348c`) 원문 재생으로 non-vacuous 검증. WARNING 2건(plan 테스트 건수 stale, 실패 재현 조합 미pin) + INFO 2건(리포트 로직·방어 코드 테스트 커버리지 갭). 테스트 설계 품질 자체는 높음(mock 미남용, 완전 격리) |
| documentation | LOW | 1·2차 문서화 지적(YAML 손상·축 개수 자기모순·`PROJECT.md` 누락·README 불변식 등) 전건 실행/대조로 해소 확인. 다만 그 해소 작업 자체가 새 drift 2건(WARNING)을 남김 — 워크플로 헤더 "두 가지"→실제 세 가지, plan 회고 서사 "두 번"→실제 "세 번" |
| dependency | LOW | 1·2차 CRITICAL 4건을 라이브 실행(`check-override-floors.py`·`check-pnpm-security-config.py` 둘 다 exit 0, 하네스 739/739)으로 독립 재확인. 신규 런타임 의존성 없음(PyYAML 기존 재사용). INFO 2건(pip range-pin, dependabot 근본 조치는 repo Settings 소관) |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원이 최소 INFO 이상을 기록했다. 다만 security·scope는 위험도 NONE으로 판정했으며, 두 에이전트의 기록은 전부 "조치 불요" 확인성 관찰(1·2차 CRITICAL 해소 확인, 스코프 정당성 확인)이고 신규 실행 가능한 조치 항목은 없다.

## 권장 조치사항

1. **(Architecture, WARNING)** `check-override-floors.py`의 fail-closed 방어를 pnpm audit JSON 하위 필드(`module_name`/`module`) 스키마 드리프트까지 확장하거나, CI `override-floors` 잡에 실물 바이너리 대상 최소 스모크 검증을 추가한다.
2. **(Documentation × 2 + Requirement/Testing, WARNING)** `plan/in-progress/deps-guard-hardening.md`를 한 번에 정정한다 — 110-111행 "18건/731건"→"20건/739건", 138행 "두 번"→"세 번"+141-144행에 3번째 사례 추가. 동시에 `.github/workflows/deps-security-checks.yml` 헤더 주석을 "세 가지를 강제한다"로 갱신하고 `override-floors` 잡 설명을 추가한다.
3. **(Testing, WARNING)** `test_scope_package_in_the_middle_of_a_chain`에 2차 리뷰가 실제 재현했던 조합(`override_target("a>@scope/b>@scope/c@>=1.0.0") == "@scope/c"`) 단언을 추가해 회귀 pin을 완성한다.
4. **(Maintainability, WARNING)** `run_with_stub_audit`을 tmp-file + 고정 `pnpm` 스텁 + 환경변수 파라미터화 방식으로 재작성해 이 스위트의 기존 관례와 통일하고, 부수적으로 security reviewer가 지적한 raw JSON 삽입 취약 관례도 함께 해소한다.
5. **(선택, INFO 다수)** 여유가 있을 때 maintainability 5건(OVERRIDES 중복 제거, fail-closed 헬퍼 추출, `eroded` NamedTuple화, 테스트 셋업 공통화, advisories 이중 순회 정리)과 testing 2건(widened+eroded 동시 보고 테스트, `str()` 캐스팅 폴백 테스트)을 반영한다 — 전부 비차단, 우선순위 낮음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(개별 사유 텍스트는 prompt 라우팅 정보에 미기재) |
  | database | 라우터 판단(개별 사유 텍스트는 prompt 라우팅 정보에 미기재) |
  | concurrency | 라우터 판단(개별 사유 텍스트는 prompt 라우팅 정보에 미기재) |
  | api_contract | 라우터 판단(개별 사유 텍스트는 prompt 라우팅 정보에 미기재) |
  | user_guide_sync | 라우터 판단(개별 사유 텍스트는 prompt 라우팅 정보에 미기재) |