# RESOLUTION — Playwright flaky surfacing 리뷰 (session 11_02_46)

대상: `SUMMARY.md` (커밋 `f8638d5e7` feat + plan 이동). 위험도 MEDIUM · **Critical 0 · Warning 6 · INFO 14**.

## 조치 항목 (Warning 6 전량)

| # | 카테고리 | 조치 |
|---|---|---|
| **W1** | testing/ci | **fix** — `harness-checks.yml` `on.pull_request.paths` 에 `scripts/report_playwright_flaky.py` 추가(migration-check 선례). 스크립트 단독 수정 시에도 8→19 케이스 회귀 테스트가 트리거되도록 → docstring 의 "harness-checks 게이트" 보장 성립 |
| **W2** | testing | **fix** — `_write_step_summary` 3분기(env 미설정 no-op·append·`open()` OSError 침묵) `WriteStepSummaryTest` 로 검증(`patch.dict`+`tempfile`) |
| **W3** | testing | **fix** — `MainIntegrationTest` 신설: happy-path(flaky 발견→summary 기록)·clean·`JSONDecodeError`·파일부재 통합 검증(tempfile) |
| **W4** | requirement/testing | **fix** — `main()` 이 `find_flaky`/`render`/`write` 를 **blanket try/except** 로 감싸 예상 밖 스키마에도 exit 0 보장(예: `suites` 비-리스트). `test_unexpected_schema_does_not_crash` 로 고정. + e2e.yml step 에 `continue-on-error: true` 이중 방어 |
| **W5** | requirement/side_effect | **fix** — plan 이동(in-progress→complete)으로 dangling 된 주석 경로 2곳(`report_playwright_flaky.py` docstring, `playwright.config.ts`)을 `plan/complete/...` 로 갱신 |
| **W6** | maintainability | **fix** — 리포트 경로 3곳(스크립트 `DEFAULT_REPORT`·e2e.yml 인자·config `outputFile`) 비동기화 시 조용히 무력화되는 리스크를, `CrossFilePathGuardTest` 로 세 곳 정합을 CI 강제(하나만 어긋나면 harness-checks fail) |

### INFO 처리 (14건)

- **fix**: INFO 1(`::warning::` 값 `_gha_escape`—개행/% 이스케이프)·INFO 3(재시도 집계를 flaky test 로 한정+docstring 정확화)·INFO 6(타입 힌트 추가, `__future__` 사용)·INFO 7(`_max_flaky_retry` 추출)·INFO 8(`_safe_int` 추출+단위테스트)·INFO 9(`PROJECT.md §보조 스크립트` 등재)·INFO 10(`main()` docstring).
- **미조치(정당)**: INFO 2(재귀 깊이—입력이 Playwright 자체 생성, 공격표면 아님)·INFO 4(백틱/개행 markdown—발생가능성 낮음, `|` 는 이스케이프)·INFO 5(README 표—기존 다수 파일도 미등재 패턴)·INFO 11~14(no-action 확인성).

## TEST 결과

- **lint**: 통과. **unit**: 통과(frontend/backend/web-chat). **harness python**: 통과 — 파서 19/19, 전체 182/182(cross-file 가드 포함).
- **e2e**: 통과 — backend Jest e2e `249 passed`(`make e2e-test`, log `_test_logs/e2e-20260710-112658.log`). 본 fix 는 python 스크립트·테스트·yaml·문서·`playwright.config.ts` **주석 전용** 변경이라 Playwright 동작 무변경 → 본 PR 초기 `make e2e-test-full`(Playwright 46 passed + json reporter 61KB 산출→파서 정상)로 이미 실증됨.

## 보류·후속 항목

없음. 향후(선택) 확장(PR 코멘트·quarantine)은 `plan/complete/e2e-retry-visibility-followup.md §향후(선택)` 에 데이터 나오면 착수로 기록.
