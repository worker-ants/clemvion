# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. WARNING 2건(중복 제거 후) 중 1건은 `deps-guard` 스크립트의
fail-closed 방어 자체에 남은 실제 로직 결함(requirement·testing 두 reviewer 가 각각 독립적으로
발견·재현)이라 MEDIUM 으로 판정한다. 1~3차 리뷰가 지적한 CRITICAL 5건(override-floors 게이트의
`ignoreCves` 전역 억제 사각·`harness-checks.yml` YAML 중복 키로 인한 CI 무효화 위험·CI 등재
3건 등)은 7개 reviewer 전원이 코드를 직접 실행·재파싱해 독립적으로 해소를 재확인했다. forced
화이트리스트(7명) 전원 정상 실행·결과 확보 — 강제 목록 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

없음 — 7개 reviewer 전원 CRITICAL 0건 보고(1~3차 리뷰가 발견한 CRITICAL 5건은 전부 코드
실행·재검증으로 해소 확인됨).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 로직 결함 (Fail-Closed) | `classify_vulnerable()`의 `actions[]` 스키마 드리프트 fail-closed 검사(`if actions and not suppressed and not reported:`)가 `and not reported` 절 때문에, `advisories`에 (override 대상과 무관한) 다른 advisory 가 하나라도 정상 파싱되면 무력화된다. `reported`는 오직 `advisories` 유래인데 `actions[]` 축의 판정이 여기 종속돼, "`advisories`는 정상 + `actions[].module`만 드리프트" 조합에서 `suppressed`가 항상 빈 dict 가 되고 exit 2 없이 "OK: 재유입 0건"이 출력된다. testing reviewer 가 `run_with_stub_audit()`으로 직접 재현해 `returncode==0`을 확인했고, requirement reviewer 도 독립적으로 동일 코드 경로를 지목했다. 이 스크립트 전체의 발단 시나리오(`ignoreCves`로 억제된 override 대상 패키지의 재침식 감지)를 정확히 겨냥한 유일한 관측 창구(`actions[]`)가 조용히 무력화될 수 있다는 뜻이다. 현재 저장소의 실측 `pnpm audit` 응답 형태(advisories 비어있음)에서는 즉시 발현하지 않으나, 미래의 pnpm 스키마 변경 시 소리 없이 뚫릴 수 있다. `SchemaDriftTest`의 두 테스트는 모두 `advisories={}`로 고정돼 있어 이 조합(advisories 비어있지 않음 + actions 드리프트)을 커버하지 않는다. | `scripts/check-override-floors.py:222`(상호작용: `:206-210`, `:216`); 테스트 갭 `.claude/tests/test_override_floors.py:305-334`(`SchemaDriftTest`, 특히 `:323-329`) | `actions[]` 축의 드리프트 판정을 `reported` 상태에서 분리 — `actions[]` 원소 자체가 `module` 키를 가졌는지로 직접 판단(예: `actions_with_module = [a for a in actions if "module" in a]`; `if actions and not actions_with_module: _undecidable(...)`). `SchemaDriftTest`에 "advisories 는 무관 패키지로 정상 + actions 만 드리프트" 조합의 회귀 케이스 추가 |
| 2 | 문서화 | `.claude/tests/test_override_floors.py:27-30` 모듈 docstring 이 fail-closed exit(2) 트리거를 "세 형태"(빈 출력/파싱 불가/`actions` 키 없음)로만 서술하지만, 3차 조치(`99f6110c0`)가 신설한 `SchemaDriftTest`의 2개 분기(`advisories.module_name` 누락, `actions.module` 누락)를 포함하면 실제로는 최소 6가지다(4 FailClosedTest 형태 + 2 SchemaDriftTest 형태). `.claude/tests/README.md:39` 카탈로그 행도 동일하게 "세 형태"만 나열할 뿐 아니라, 별도로 "개발 중 두 번 틀렸다"는 서술(실제로는 세 번 — `test_override_floors.py` 모듈 docstring과 plan 문서는 이미 정정됨)과 "Four axes" 표기가 이번 라운드 신설된 `CombinedReportTest`/`SchemaDriftTest` 두 클래스를 반영하지 못하는 채로 남아 있다. 이 PR 은 정확히 같은 클래스의 "축 개수/횟수 자기모순"을 이미 2·3차 라운드에서 WARNING 으로 두 번 다뤘던 전례가 있다(3회째 재발). `test_tests_readme_catalog.py`는 카탈로그 행의 **존재**만 검사해 **내용** 정확성은 어떤 자동 가드로도 못 잡는다 — scope/requirement/documentation 세 reviewer 가 공통으로 이 drift 를 지목했다. | `.claude/tests/test_override_floors.py:27-30`, `.claude/tests/README.md:39` | 두 문서 모두 "세 형태" → "여섯 형태"(실행-레벨 네 형태 + 스키마드리프트 두 형태)로 정정. `README.md:39`는 "twice"→"three times"로 정정하고 3번째 사례(체인 중간 scope, `a>@scope/b>c`)를 목록에 추가, `CombinedReportTest`/`SchemaDriftTest` 두 클래스에 대한 설명 보강 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `.claude/tests/test_override_floors.py`의 한 클래스(`ClassificationTest`) 내부 메서드 사이에만 빈 줄이 2개(파일 나머지는 1개) 남아 컨벤션과 어긋난다 — 3차 조치 커밋(`99f6110c0`)이 새 메서드/클래스를 원래 클래스-경계 지점 앞에 끼워 넣으며 남긴 편집 흔적으로 추정. 기능 영향 없음 | `.claude/tests/test_override_floors.py:257-258` | 빈 줄 1개 제거해 파일 전체 컨벤션(단일 빈 줄)과 통일(순수 스타일 정정) |
| 2 | 테스트 | `dependabot.yml`의 워크스페이스-루트 예외(`directory: "/"` → `""`) 정규화가, 같은 파일의 다른 파서 엣지케이스(따옴표/주석·비-npm ecosystem 등)처럼 합성 텍스트로 고립 pin 되지 않고 실제 리포 파일에 의존하는 라이브 테스트로만 검증된다. 실질 위험은 낮음(다른 두 라이브 테스트가 매 실행마다 이 경로를 태움) | `.claude/tests/test_dependabot_npm_coverage.py:43`(`_WORKSPACE_ROOT_DIRECTORY`) 대비 `:209-250`(`ParserEdgeCaseTest`), `:309-321` | 우선순위 낮음 — 여유 있으면 `ParserEdgeCaseTest`에 `directory: "/"` 합성 텍스트를 `_parse_dependabot_npm_directories()`에 직접 넣어 `{""}`를 기대하는 고립 케이스 1건 추가 |
| 3 | 보안 | 신규 `override-floors` 잡을 포함해 이 저장소 워크플로 대부분이 서드파티 액션을 가변 메이저 태그(`@v7` 등)로 고정하고 명시적 `permissions:` 블록도 두지 않는다 — 이번 diff 가 만든 신규 회귀가 아니라 저장소 전역 기존 컨벤션(`migration-recheck-on-main.yml` 한 곳만 예외) | `.github/workflows/deps-security-checks.yml:78-98` | 이 PR 스코프 밖. 여유가 있으면 별도 트랙에서 (a) 액션을 불변 commit SHA 로 고정, (b) 시크릿 미사용 read-only 잡부터 `permissions: {contents: read}` 명시를 저장소 전역 정책으로 검토 |
| 4 | 보안 (위생, 조치 불요) | `EXPECTED_SUPPRESSED_PATHS`가 baseline→실제 방향의 단방향 대조만 수행해, baseline 에만 남고 실제 관측엔 없는 낡은 예외 항목이 조용히 누적될 수 있다. 다만 판정 방향 자체는 fail-closed 로 안전(baseline 에 없는 새 모듈/경로는 항상 "확대"로 걸림) — 이미 plan 문서에 "항목이 늘면 그때 넣는다"로 근거와 함께 의도적 보류 기록됨 | `scripts/check-override-floors.py:245-255`(`main()`의 `widened` 계산) | 조치 불요 — 후속 추적 항목으로만 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 Critical/Warning 없음. 1차 WARNING(fail-open 가능성)·2차 CRITICAL(YAML 중복 키)·1차 테스트 스텁 지적 모두 해소 재검증 완료(직접 실행). 서드파티 액션 가변 태그/`permissions` 부재는 기존 컨벤션(INFO) |
| requirement | LOW | `actions[]` 스키마 드리프트 fail-closed 가 `reported`(advisories)가 비지 않으면 무력화되는 로직 결함을 직접 호출로 발견(WARNING #1) + docstring/README "세 형태" 서술 stale(WARNING #2). CRITICAL 5건 해소는 744/744 테스트 + 실제 `pnpm audit` 실행으로 재확인 |
| scope | NONE | 3차 리뷰 이후 유일한 코드 커밋(`99f6110c0`)이 3차 Warning 6건에만 정확히 대응, 무관 파일/기능 확장·`codebase/**` 누출 없음. "네 축" docstring lag 을 우선순위 낮음으로 별도 기록(WARNING #2 에 반영) |
| side_effect | LOW | 신규 부작용(pnpm audit 네트워크 호출, dependabot 루트 등록, harness-checks CI 트리거 확장) 전부 plan 설계 의도와 일치, 각각 회귀 테스트로 범위 고정됨. `os.environ`/전역 라이브러리 상태 오염 없음 |
| maintainability | LOW | 2·3차 CRITICAL(YAML 중복 키)·WARNING(축 자기모순, 스텁 동적 조립, OVERRIDES 리터럴 중복) 전부 해소 재확인(744건 실행). 신규 발견은 빈 줄 2개 스타일 불일치(INFO #1) 1건뿐 |
| testing | MEDIUM | `actions[]`/`reported` 상호결합으로 인한 fail-closed 무력화를 `run_with_stub_audit()`으로 직접 재현(WARNING #1, 이번 라운드 최고 위험도). mutation 4종("전부 RED") 주장을 cp 백업+뮤테이션+원복으로 재현 검증(과대·과소 없음, 긍정) |
| documentation | LOW | `.claude/tests/README.md:39` 카탈로그 행이 "두 번"/"Four axes"로 stale — 이 PR 안에서 이미 2·3차 라운드에 지적된 것과 동일 클래스의 3회째 재발(WARNING #2). 그 외 신규 스크립트/테스트/YAML 주석 문서화 수준은 높고 구현과 일치 확인 |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 1건 이상의 관찰(1~3차 리뷰 사항의 실행 기반 재검증 확인 포함)을
보고했다.

## 권장 조치사항

1. **(최우선)** `scripts/check-override-floors.py:222`의 `actions[]` 스키마 드리프트 판정을
   `reported`(advisories 유래) 상태에서 분리 — `actions[]` 원소 자체의 `module` 키 존재 여부로
   직접 판단하도록 수정. `SchemaDriftTest`에 "advisories 는 무관 패키지로 정상 파싱 + actions
   만 드리프트" 조합의 회귀 테스트를 추가해 이 라운드가 발견한 무력화 경로를 고정할 것
   (requirement·testing 두 reviewer 가 각각 독립 재현).
2. `.claude/tests/test_override_floors.py:27-30`와 `.claude/tests/README.md:39`를 실제 코드
   상태에 맞춰 갱신 — fail-closed 트리거 형태 수(세 형태→여섯 형태), 개발 중 실패 사례 횟수
   (두 번→세 번, 3번째 사례 추가), `CombinedReportTest`/`SchemaDriftTest` 두 클래스에 대한 설명을
   반영할 것. 이 클래스의 문서 drift 는 자동 가드로 잡히지 않으므로(카탈로그 존재만 검사) 수동
   갱신이 유일한 방어선이다.
3. **(선택, 낮은 우선순위)** `test_override_floors.py:257-258`의 중복 빈 줄 정리(스타일),
   `test_dependabot_npm_coverage.py`에 workspace-root(`"/"`→`""`) 정규화 고립 단위 테스트 1건
   추가.
4. **(선택, PR 스코프 밖 백로그)** 서드파티 GitHub Actions 를 불변 commit SHA 로 고정하고,
   시크릿을 쓰지 않는 read-only 잡부터 `permissions: {contents: read}` 명시를 저장소 전역
   정책으로 별도 트랙에서 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, forced 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(이번 prompt 에 세부 사유 미포함) |
  | architecture | 라우터 판단(이번 prompt 에 세부 사유 미포함) |
  | dependency | 라우터 판단(이번 prompt 에 세부 사유 미포함) |
  | database | 라우터 판단(이번 prompt 에 세부 사유 미포함) |
  | concurrency | 라우터 판단(이번 prompt 에 세부 사유 미포함) |
  | api_contract | 라우터 판단(이번 prompt 에 세부 사유 미포함) |
  | user_guide_sync | 라우터 판단(이번 prompt 에 세부 사유 미포함) |