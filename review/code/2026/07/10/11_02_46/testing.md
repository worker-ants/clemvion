# 테스트(Testing) 리뷰 — e2e flaky surfacing (playwright flaky reporter)

## 발견사항

- **[WARNING]** harness-checks CI 트리거 경로가 `scripts/**` 를 포함하지 않아, 스크립트만 단독 수정되면 회귀 게이트가 안 돈다
  - 위치: `.github/workflows/harness-checks.yml` `on.pull_request.paths` (`.claude/agents/**`, `.claude/hooks/**`, `.claude/skills/**`, `.claude/tests/**`, `.claude/tools/**`, `.claude.project.json`, `PROJECT.md`, 워크플로 파일 자신만 나열)
  - 상세: `.claude/tests/test_report_playwright_flaky.py` 의 docstring 은 "그 파싱 로직이 조용히 회귀하면 flaky 관측 자체가 무력화된다... harness-checks 에서 게이트한다"고 명시한다. 그러나 실제 대상 모듈 `scripts/report_playwright_flaky.py` 의 경로(`scripts/**`)는 `harness-checks.yml` 의 `paths:` 필터에 없다. 따라서 이후 누군가가 `scripts/report_playwright_flaky.py` 만 단독 수정하는 PR 을 올리면 — 테스트 파일 자체를 같이 건드리지 않는 한 — `harness-checks` 워크플로가 트리거되지 않고, 새로 작성된 8-case 테스트는 실행되지 않는다. 다른 워크플로(`e2e.yml`, `frontend-checks.yml`, `migration-check.yml` 등) 도 `scripts/**` 를 감시하지 않음을 확인했다(grep 결과 없음). 회귀 방지라는 테스트의 존재 목적 자체가 CI 배선 누락으로 무력화될 수 있다.
  - 제안: `harness-checks.yml` 의 `paths:` 에 `'scripts/report_playwright_flaky.py'`(또는 `'scripts/**'`) 를 추가한다. `.claude/tests/README.md` 의 스코프 서술("harness's own Python... not the product code under `codebase/`")과 다소 어긋나므로, `scripts/` 를 이 README 스코프에 포함시킬지 별도 워크플로로 뺄지 명시적으로 정리해두면 향후 drift 를 막을 수 있다.

- **[WARNING]** 스크립트의 핵심 side-effect(`_write_step_summary`)가 테스트 전무
  - 위치: `scripts/report_playwright_flaky.py:1007-1016` (`_write_step_summary`), `.claude/tests/test_report_playwright_flaky.py` 전체
  - 상세: 이 기능의 존재 목적은 "GitHub step summary + `::warning::` 어노테이션으로 flaky 를 능동 노출"하는 것인데, 실제로 step summary 를 쓰는 `_write_step_summary` 함수는 어떤 테스트에서도 호출되지 않는다. `MainSmokeTest` 는 리포트 파일이 없는 경로만 다뤄 `_write_step_summary` 호출 전에 조기 반환한다. 다음 3개 분기가 전부 미검증이다: (1) `GITHUB_STEP_SUMMARY` 미설정 시 no-op, (2) 설정 시 실제 append 동작(개행 포함, 기존 내용 보존), (3) `open()` 이 `OSError` 를 던지는 경로(디렉터리를 경로로 주는 등)의 `except OSError: pass` 침묵 처리. README(`.claude/tests/README.md`) 는 이 스위트가 `unittest.mock` 사용을 명시적으로 허용하므로, `unittest.mock.patch.dict(os.environ, {...})` + `tempfile` 로 검증 가능함에도 빠져 있다.
  - 제안: `RenderMarkdownTest` 옆에 `WriteStepSummaryTest` 를 추가해 (a) env 미설정 시 파일 미생성/미변경, (b) env 설정 시 `open(path, "a")` 로 내용이 append 되는지, (c) `open()` 이 실패해도 예외가 전파되지 않는지 3케이스를 검증한다.

- **[WARNING]** `MainSmokeTest` 가 이름과 달리 `main()` 의 대부분 분기를 통과하지 않음(happy path·JSON 파싱 실패 미검증)
  - 위치: `.claude/tests/test_report_playwright_flaky.py:163-167` (`MainSmokeTest.test_missing_report_returns_zero`), `scripts/report_playwright_flaky.py:1019-1044` (`main`)
  - 상세: `main()` 은 3개 분기(파일 없음 / JSON 파싱 실패 / 정상 파싱)를 갖는데 테스트는 "파일 없음" 하나만 커버한다. `find_flaky`/`render_markdown` 은 각각 단위 테스트가 있지만, `main()` 내부에서 파일 읽기 → `find_flaky` → `render_markdown` → `_write_step_summary` → `::warning::` 출력 루프로 이어지는 **배선(wiring)** 자체를 검증하는 통합형 테스트가 없다. 예를 들어 `main()` 이 `find_flaky` 호출을 빠뜨리거나 잘못된 인자를 넘기는 회귀는 현재 테스트로 잡히지 않는다. `json.JSONDecodeError` 분기(`scripts/report_playwright_flaky.py:1027-1029`)도 실제로 깨진 JSON 파일을 만들어 넣는 테스트가 없다.
  - 제안: `tempfile` 로 (1) flaky 항목이 있는 유효한 리포트 JSON, (2) 문법이 깨진 JSON 파일을 각각 만들어 `main([...])` 을 호출하고 반환값이 항상 `0` 인지, `capsys`/`redirect_stdout` 으로 `::warning::` 라인과 `[flaky-report] flaky N건` 라인이 기대대로 나오는지 확인하는 케이스를 추가한다.

- **[INFO]** `main()` 은 `json.load` 실패만 방어하고, `find_flaky`/`render_markdown` 은 구조적으로 예상과 다른(파싱은 되지만 스키마가 다른) 리포트에 대해 무방비 — "항상 exit 0" 약속이 부분적으로만 지켜짐
  - 위치: `scripts/report_playwright_flaky.py:1019-1044` (`main`), 특히 `find_flaky(report)` 호출부(1031)가 try/except 밖
  - 상세: 예컨대 최상위 JSON 이 객체가 아니라 배열이거나(`report.get` 이 `AttributeError`), `suites`/`specs` 항목이 dict 가 아닌 경우 `_iter_specs`/`find_flaky` 내부의 `.get(...)` 호출이 `AttributeError` 로 예외를 던진다. 이 예외는 `main()` 안에서 잡히지 않으므로 스크립트가 non-zero 로 종료하며, docstring 이 명시한 "리포트 부재·파싱 실패에도 CI 를 안 깬다" 는 설계 의도(그리고 `e2e.yml` step 에 `continue-on-error` 가 없다는 점)와 충돌해 실제로 CI job 을 실패시킬 수 있다. 현재는 Playwright 자체가 항상 스키마를 지키므로 실무 위험은 낮지만, 이 방어를 스크립트가 명시적으로 약속하고 있는 만큼 테스트로 그 약속을 고정하거나(구조 이상 리포트를 넣어 exit 0 을 검증), 코드 쪽에서 `find_flaky`/`render_markdown` 호출 전체를 try/except 로 감싸는 편이 일치한다.
  - 제안: 최소 하나의 회귀 테스트로 `flaky.main` 에 스키마가 깨진(예: `{"suites": ["not-a-dict"]}`) 파일을 넣어 예외 없이 `0` 을 반환하는지 확인한다. 아니면 스크립트에 try/except 를 추가해 실제로 그 약속을 지키게 한다.

- **[INFO]** `render_markdown` 의 이스케이프는 `|` 만 처리 — backtick·개행이 포함된 title/file 은 markdown 렌더가 깨질 수 있음(미검증)
  - 위치: `scripts/report_playwright_flaky.py:990-997` (`render_markdown`), `_location`(978-979)
  - 상세: `_location` 이 `file:line` 을 backtick 코드스팬으로 감싸는데, `file` 값 자체에 backtick 이 들어가면 코드스팬이 깨진다. `title` 은 `|` 만 escape 하고 backtick·개행 문자는 그대로 테이블 셀에 삽입되어 markdown 표가 무너질 수 있다. Playwright 테스트 제목에 이런 문자가 들어갈 실무 확률은 낮지만, 현재 아무 테스트도 이 경계를 다루지 않는다.
  - 제안: 우선순위는 낮음. 후속으로 title/file 에 backtick·개행이 있는 케이스를 `test_pipe_in_title_is_escaped` 옆에 추가하거나, 리스크가 낮다고 판단되면 코드 주석으로 "Playwright title 은 이런 문자를 포함하지 않는다고 가정" 을 명시해 의도를 남긴다.

- **[INFO]** 신규 harness 테스트가 `.claude/tests/README.md` "What's covered" 표에 반영되지 않음
  - 위치: `.claude/tests/README.md` (표 미갱신), 신규 파일 `.claude/tests/test_report_playwright_flaky.py`
  - 상세: 기존 컨벤션상 이 표는 harness 테스트 각각이 무엇을 가드하는지 나열한다. 이번 PR 이 새 테스트 파일을 추가했지만 표에는 항목이 없다. 강제되는 장치(예: `test_doc_sync_matrix.py`)는 아니라 빌드를 막지 않지만, 다음 검토자가 "이 스위트가 무엇을 커버하는지" 파악하는 진입점이 하나 누락된다.
  - 제안: README 표에 한 줄 추가(`test_report_playwright_flaky.py` | Playwright JSON 리포트 flaky 추출/렌더 로직 파싱 회귀 가드).

## 잘 된 점 (참고)

- `find_flaky`/`render_markdown` 순수 함수에 대한 단위 테스트는 중첩 suite 순회, 빈/누락 키, multi-project spec 에서 "하나라도 flaky 면 집계", pipe 이스케이프, `line=0` 일 때 위치 표기 생략 등 실질적인 경계 케이스를 촘촘히 다룬다 — 가독성도 좋고(헬퍼 `_spec` 의 docstring, 한글 주석으로 의도 명시) 테스트 간 상태 공유가 없어 격리도 양호하다.
- `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` 는 `playwright.config.ts` 의 `expect.timeout` 만 정규식으로 파싱하므로, 이번 PR 의 `reporter` 배열 확장(json reporter 추가)에 영향받지 않는다 — 회귀 없음을 확인.
- 스크립트 자체가 `_iter_specs`/`find_flaky`/`_location`/`render_markdown`/`_write_step_summary`/`main` 으로 잘게 분리돼 있어 테스트 용이성이 좋다(의존성도 얕고 각 함수가 순수하거나 side-effect 가 한곳에 국한).

## 요약

핵심 파싱/렌더 로직(`find_flaky`, `render_markdown`)은 다양한 실제 시나리오(중첩 suite, 빈 데이터, multi-project, 이스케이프)를 촘촘하고 가독성 좋게 커버한다. 그러나 이 기능의 실질적 산출물인 GitHub step summary 기록(`_write_step_summary`)은 테스트가 전혀 없고, `main()` 의 happy-path·JSON 파싱 실패 분기도 미검증이라 "배선" 회귀(파일 읽기→분석→기록 연결이 깨지는 버그)를 잡을 안전망이 비어 있다. 더 중요하게는, 이 테스트가 스스로 명시한 "회귀 게이트" 목적이 `harness-checks.yml` 의 `paths:` 필터에 `scripts/**` 가 빠져 있어 실제로는 스크립트 단독 수정 시 CI 에서 실행되지 않을 수 있다 — 테스트 품질과 무관하게 CI 배선이 그 보호를 무력화하는 구조적 갭이다. 스크립트의 "항상 exit 0" 방어도 최상위 JSON 파싱 실패만 다루고 구조적 스키마 이상은 무방비인데, 이 역시 테스트로 고정돼 있지 않다.

## 위험도

MEDIUM
