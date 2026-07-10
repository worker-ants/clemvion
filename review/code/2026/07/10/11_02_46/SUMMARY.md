# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없음. CI 게이트 배선 갭(harness-checks `paths` 필터에 `scripts/**` 부재)으로 신규 회귀 테스트가 향후 스크립트 단독 수정 시 실행되지 않을 수 있고, 스크립트의 핵심 side-effect(`_write_step_summary`)와 `main()` happy-path 가 테스트로 검증되지 않아 testing 에이전트가 MEDIUM 을 부여. 그 외는 전부 LOW/NONE 수준의 견고성·문서·유지보수성 갭.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/requirement/documentation | `harness-checks.yml` 의 `on.pull_request.paths` 필터가 `scripts/**` 를 포함하지 않아, `scripts/report_playwright_flaky.py` 를 테스트 파일 없이 단독 수정하면 신규 8-케이스 회귀 테스트가 실제로 트리거되지 않음 — 테스트 docstring 이 명시한 "harness-checks 게이트" 보장이 구조적으로 성립하지 않음 (동일 저장소 `migration-check.yml` 은 `scripts/check-migration-versions.py` 를 자신의 paths 에 명시한 선례가 있음) | `.github/workflows/harness-checks.yml` (`on.pull_request.paths`), `.claude/tests/test_report_playwright_flaky.py:1-4,33-38` (docstring) | `harness-checks.yml` paths 에 `scripts/report_playwright_flaky.py`(또는 `scripts/**`) 추가. 아니면 docstring 문구를 실제 트리거 범위에 맞게 완화 |
| 2 | testing | 스크립트의 실질 산출물인 `_write_step_summary`(GitHub step summary append) 가 어떤 테스트에서도 호출되지 않음 — env 미설정 no-op, append 동작, `open()` OSError 침묵 처리 3분기 전부 미검증 | `scripts/report_playwright_flaky.py:1007-1016` (`_write_step_summary`), `.claude/tests/test_report_playwright_flaky.py` 전체 | `unittest.mock.patch.dict(os.environ, ...)` + `tempfile` 로 env 미설정/설정/`open()` 실패 3케이스 추가 |
| 3 | testing | `MainSmokeTest` 가 이름과 달리 `main()` 의 happy-path(flaky 발견) 와 `json.JSONDecodeError` 분기를 커버하지 않음 — "파일 없음" 1케이스만 검증되어 파일읽기→`find_flaky`→`render_markdown`→`_write_step_summary` 배선 전체를 검증하는 통합 테스트가 없음 | `.claude/tests/test_report_playwright_flaky.py:163-167` (`test_missing_report_returns_zero`), `scripts/report_playwright_flaky.py:1019-1044` (`main`) | `tempfile` 로 (1) flaky 항목 있는 유효 JSON, (2) 깨진 JSON 파일을 만들어 `main()` 호출 후 반환값 0 및 `::warning::`/`[flaky-report]` 출력을 검증하는 케이스 추가 |
| 4 | requirement/testing | `main()` 이 "리포트 부재·파싱 실패에도 항상 exit 0" 이라는 설계 불변식을 완전히 구조적으로 보장하지 않음 — 파일 부재/`JSONDecodeError`만 방어하고, 파싱은 되지만 스키마가 예상과 다른 경우(`suites`가 리스트가 아니거나 `spec["line"]` 이 캐스팅 불가 등) `find_flaky`/`render_markdown` 내부 예외가 전파됨. 워크플로 step 에 `continue-on-error` 도 없어, 예외 시 오히려 `e2e-frontend` job 전체를 실패로 뒤집는 정반대 결과가 됨(현재 Playwright 표준 스키마 하에서는 발생 가능성 낮음) | `scripts/report_playwright_flaky.py:1019-1044`(`main`), `find_flaky` 호출부(1031행)가 try/except 밖, `.github/workflows/e2e.yml:79-82`(step 에 `continue-on-error` 부재) | `main()` 에서 `find_flaky`/`render_markdown`/`_write_step_summary` 호출부를 감싸는 블랑켓 `try/except Exception` 추가하거나 최소 `continue-on-error: true` 방어 추가 + malformed-schema 회귀 테스트 추가 |
| 5 | requirement/side_effect | 같은 커밋에서 plan 을 `plan/in-progress/` → `plan/complete/` 로 이동시켰는데, 신규/수정 코드 주석의 plan 경로 레퍼런스 2곳이 여전히 옛 경로를 가리켜 커밋 완료 시점에 이미 dangling 상태 | `scripts/report_playwright_flaky.py:15` (`배경/SoT: plan/in-progress/...`), `codebase/frontend/playwright.config.ts:23` (동일 옛 경로 주석) | 두 곳 모두 `plan/complete/e2e-retry-visibility-followup.md` 로 갱신 |
| 6 | maintainability | Playwright JSON 리포트 상대경로(`playwright-report/results.json`)가 스크립트 `DEFAULT_REPORT`·`e2e.yml` step 인자·`playwright.config.ts` `outputFile` 3곳에 독립적으로 하드코딩되고 이를 동기화하는 테스트/참조가 없음 — 셋 중 하나만 바뀌면 스크립트가 "리포트 없음 → skip, exit 0" 경로를 조용히 타서 flaky surfacing 기능 자체가 무력화되는데 CI 는 계속 green(이 변경의 목적 자체가 "묻히는 신호를 드러내기"라는 점에서 아이러니한 리스크) | `scripts/report_playwright_flaky.py:25`(`DEFAULT_REPORT`), `.github/workflows/e2e.yml`(step `run:` 인자), `codebase/frontend/playwright.config.ts`(`reporter` `json.outputFile`) | 셋 중 하나를 SoT 로 두고 나머지가 참조하게 하거나, 최소한 "e2e.yml 경로 == 스크립트 DEFAULT_REPORT == config outputFile" 를 대조하는 cross-file 가드 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | GitHub Actions `::warning::` 워크플로 커맨드에 리포트의 `file`/`title` 값을 무검증 삽입 — 개행+`::` 시퀀스로 워크플로 커맨드 injection class 에 해당하나, 값 출처가 저장소 내부(리뷰를 거친 e2e 스펙)이고 fork PR 의 기본 `GITHUB_TOKEN` 도 read-only 라 실질 익스플로잇 경로 없음 | `scripts/report_playwright_flaky.py:889-894` (`main`) | 방어적 하드닝으로 개행·`%`·`::` percent-encoding 이스케이프 (필수 아님) |
| 2 | security | `_iter_specs` 의 재귀 `suites` 순회에 깊이 제한 없음 — 병적으로 깊은 중첩 시 `RecursionError` 가능하나 입력은 Playwright 자신이 생성(외부 공격 표면 아님), `always()` 배선으로 상위 job 영향 없음 | `scripts/report_playwright_flaky.py:791-800` | 필요시 반복(iterative) 방식 또는 깊이 상한 (필수 아님) |
| 3 | requirement/maintainability/documentation | `find_flaky` 의 재시도 횟수 계산이 flaky 판정된 test 가 아닌 spec 내 **모든** test 의 `results[].retry` 최댓값을 취함 — 독스트링도 이 범위를 정확히 서술하지 않음. 현재 단일 chromium project 라 도달 불가능하지만 향후 다중 project(webkit 등) 확장 시 드러날 latent 갭 | `scripts/report_playwright_flaky.py:816-822`(`find_flaky` 루프), `948-953`(독스트링) | retries 집계를 `status == "flaky"` 인 test 로 한정하거나, 독스트링에 "모든 test 대상" 임을 명시. 다중-project 확장 시 재검토 주석 |
| 4 | requirement/testing | `render_markdown` 의 마크다운 이스케이프가 `|` 만 처리하고 백틱·개행은 그대로 둠 — title/file 에 그런 문자가 섞이면 표/코드스팬 렌더가 깨질 수 있음(실무 발생 가능성 낮음, 미검증) | `scripts/report_playwright_flaky.py:851-853, 978-979, 990-997` | 낮은 우선순위 — 필요시 백틱/개행 escape 추가 또는 "Playwright title 은 이런 문자 미포함" 가정을 주석으로 명시 |
| 5 | testing/documentation | `.claude/tests/README.md` "What's covered" 표에 신규 `test_report_playwright_flaky.py` 미등재(다만 기존에도 `test_plan_guard.py` 등 여러 파일이 이미 누락된 기존 패턴) | `.claude/tests/README.md:21-29` | 여유 있으면 표에 한 행 추가 (강제 아님) |
| 6 | maintainability | 신규 스크립트가 `from __future__ import annotations` 를 import 했음에도 어떤 함수에도 타입 힌트를 붙이지 않아, 같은 폴더 `scripts/check-doc-links.py` 의 타입힌트 컨벤션과 불일치 + import 가 사실상 죽은 코드 | `scripts/report_playwright_flaky.py:19` 및 전체 함수 시그니처 | 최소 타입힌트 추가 또는 미사용 import 제거 |
| 7 | maintainability | `find_flaky()` 내부 "test들 중 최대 retry 값 찾기" 로직이 4단 중첩(`for suite→spec→t→r`)으로 인라인 되어 있어 단위 테스트도 `find_flaky` 를 통해서만 간접 검증됨 | `scripts/report_playwright_flaky.py:52-58` | `_max_retry(tests)` 헬퍼로 추출해 얕게 만들고 독립 단위 테스트 추가 |
| 8 | maintainability | retry 정수 파싱이 `dict.get(default)` + `or 0` + `try/except` 3중 방어를 한 표현식에 뭉쳐놔 각 방어의 의도(키없음/None/비정수) 구분이 어려움. 비정수 `retry` 테스트 케이스도 없음 | `scripts/report_playwright_flaky.py:56` | `_safe_int(value, default=0)` 헬퍼로 추출 + 단위 테스트 |
| 9 | documentation | `PROJECT.md` "§보조 스크립트" 섹션(설치불요·stdlib 전용 검증 스크립트 카탈로그)에 신규 스크립트가 등재되지 않아 발견성이 낮음 | `PROJECT.md:317-330` | `check-doc-links.py` 항목과 같은 톤으로 짧은 서브섹션 추가 (필수 아님) |
| 10 | documentation | `main()` 함수 자체엔 독스트링이 없고, markdown 표는 `line==0` 일 때 `:line` 표기를 생략하는데 `::warning::` 어노테이션은 동일 처리 없이 `line=0` 을 그대로 출력 — 두 출력 경로의 비대칭을 설명하는 주석 부재 | `scripts/report_playwright_flaky.py:1019-1044` | 짧은 독스트링/주석으로 의도 명문화 (사소) |
| 11 | side_effect | `playwright.config.ts` 의 `json` reporter 추가는 `process.env.CI` 분기 없는 전역 설정이라 로컬 `playwright test` 실행에도 항상 `playwright-report/results.json` 생성(덮어쓰기) — `.gitignore` 에 이미 등록돼 실수 커밋 위험은 없음 | `codebase/frontend/playwright.config.ts` (`reporter` 배열) | 조치 불필요(의도된 additive). 필요시 `process.env.CI ? [...] : [...]` 분기 가능 |
| 12 | side_effect | 신규 CI step 이 `if: always()` 라 `actions/checkout@v7` 자체가 실패하는 극단 케이스에서도 실행 시도되어 `python3: can't open file` 로 이 step 도 실패하나, job 은 이미 checkout 실패로 실패 처리되는 경로라 최종 결론엔 영향 없음(부가적 혼란 로그 정도) | `.github/workflows/e2e.yml` (`Surface flaky (retry-passed) tests` step) | 조치 불필요, 원한다면 조건 방어 가능(실익 낮음) |
| 13 | side_effect | 현재 테스트는 `main()` 을 flaky-발견(성공) 경로로 호출하지 않아 harness-checks job 자신의 `$GITHUB_STEP_SUMMARY` 를 오염시키지 않음(안전한 설계) — 그러나 향후 이 테스트를 확장해 `main()` 풀 경로를 태울 경우 `GITHUB_STEP_SUMMARY`/`os.environ` 을 모킹·격리하지 않으면 이 안전성이 깨질 수 있음 | `.claude/tests/test_report_playwright_flaky.py` (`MainSmokeTest.test_missing_report_returns_zero`) | 현재 조치 불필요. 후속 테스트 추가 시 env patch/tempfile 격리를 컨벤션으로 남길 것 |
| 14 | scope | `.claude/tests/_harness.py` 모듈 독스트링은 "harness 자체 Python(hooks·skill libs·config)" 검증을 범위로 서술하는데, 신규 테스트는 `.claude/` 바깥의 `scripts/report_playwright_flaky.py`(CI 인프라 스크립트) 를 대상으로 함 — 실질적으로 "product code 아닌 CI 스크립트 게이트"라는 취지에는 부합하고 스코프 위반은 아님 | `.claude/tests/test_report_playwright_flaky.py:1-4` vs `.claude/tests/_harness.py:1-5` | 조치 불필요(참고용). 필요시 `_harness.py` docstring 범위 표현만 별도로 넓힐 수 있음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | harness-checks 게이트 미작동(paths 필터 갭), `_write_step_summary`/`main()` happy-path 완전 미검증 |
| requirement | LOW | harness-checks paths 갭, dangling plan 경로 참조, "always exit 0" 불변식 부분 보장, retries 계산 범위 latent 갭 |
| maintainability | LOW | report 경로 3중 하드코딩(SoT 부재, 조용한 무력화 위험), 중첩 깊이·타입힌트·retry 파싱 응집도 |
| documentation | LOW | harness-checks 게이트 서술과 실제 CI 트리거 불일치, README/PROJECT.md 카탈로그 미등재 |
| side_effect | LOW | 전역 json reporter 로컬 영향, `always()` 극단 edge case, 향후 테스트 확장 시 STEP_SUMMARY 격리 필요성 — 모두 낮은 리스크의 additive 부작용 |
| security | LOW | GH 워크플로 커맨드 injection class(실익 없음), 재귀 깊이 무제한(공격 표면 아님) — 전형적 취약점 클래스 해당 없음 |
| scope | NONE | 6개 변경 파일 전부 단일 목표(flaky surfacing)로 수렴, 무관 변경/과잉 리팩터링 없음 |

## 발견 없는 에이전트

- scope — 스코프 위반 없음(참고용 INFO 1건만, 조치 불필요)

## 권장 조치사항

1. `harness-checks.yml` 의 `on.pull_request.paths` 에 `scripts/report_playwright_flaky.py`(또는 `scripts/**`) 추가 — 신규 회귀 테스트가 주장하는 CI 게이트를 실제로 성립시킨다 (3개 에이전트 중복 지적, 가장 우선).
2. `_write_step_summary` 3분기(env 미설정/설정 append/`open()` 실패)와 `main()` happy-path·JSON 파싱 실패 분기에 대한 테스트 추가.
3. `main()` 에서 `find_flaky`/`render_markdown`/`_write_step_summary` 호출을 블랑켓 `try/except Exception` 으로 감싸 "항상 exit 0" 불변식을 구조적으로 보장(또는 워크플로 step 에 `continue-on-error: true` 방어 추가).
4. `scripts/report_playwright_flaky.py:15`, `codebase/frontend/playwright.config.ts:23` 의 dangling `plan/in-progress/...` 경로 참조를 `plan/complete/...` 로 갱신.
5. Playwright 리포트 경로 문자열(`DEFAULT_REPORT`/`e2e.yml` step 인자/`outputFile`)의 3중 하드코딩을 단일 SoT 또는 cross-file 대조 테스트로 동기화해 향후 조용한 기능 무력화를 방지.
6. (낮은 우선순위, 선택) `find_flaky` retries 집계를 flaky 판정 test 로 한정, markdown escape 확장, 타입힌트 정리, README/PROJECT.md 카탈로그 등재.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원 — router 가 이번 changeset 을 안전상 전량 강제 포함으로 판단)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 개별 사유를 세부 기재하지 않음 — CI 관측 스크립트(비-런타임 hot path) 변경 특성상 저관련으로 판단된 것으로 추정 |
  | architecture | 라우터가 개별 사유를 세부 기재하지 않음 — 아키텍처 경계 변경 없는 additive CI 유틸리티로 판단된 것으로 추정 |
  | dependency | 라우터가 개별 사유를 세부 기재하지 않음 — 신규 서드파티 의존성 없음(stdlib 전용)으로 판단된 것으로 추정 |
  | database | 라우터가 개별 사유를 세부 기재하지 않음 — DB 관련 변경 없음으로 판단된 것으로 추정 |
  | concurrency | 라우터가 개별 사유를 세부 기재하지 않음 — 동시성/상태전이 변경 없음으로 판단된 것으로 추정 |
  | api_contract | 라우터가 개별 사유를 세부 기재하지 않음 — 공개 API 계약 변경 없음으로 판단된 것으로 추정 |
  | user_guide_sync | 라우터가 개별 사유를 세부 기재하지 않음 — 사용자 대면 문서/가이드 영향 없는 CI 인프라 변경으로 판단된 것으로 추정 |