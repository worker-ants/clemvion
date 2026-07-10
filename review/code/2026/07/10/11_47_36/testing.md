# 테스트(Testing) 리뷰 — flaky surfacing fresh 리뷰(11_30_32) Warning 2 조치

대상 실질 코드: `.claude/tests/test_report_playwright_flaky.py`, `scripts/report_playwright_flaky.py`.
나머지 11개 파일(`review/code/2026/07/10/11_30_32/**`)은 이전 리뷰 세션의 정적 산출물(RESOLUTION/SUMMARY/meta/retry_state/개별 reviewer md)이라 테스트 대상 코드가 아님 — 테스트 관점 해당 없음.

## 발견사항

- **[INFO]** `test_emit_annotations_escapes_title` 내부 로컬 import
  - 위치: `.claude/tests/test_report_playwright_flaky.py` `GhaEscapeTest.test_emit_annotations_escapes_title` (295-297줄)
  - 상세: `import contextlib` / `import io` 를 테스트 메서드 내부에서 수행. 같은 파일의 다른 테스트들(`mock`, `tempfile`, `os`, `Path`)은 모두 모듈 상단에서 import 하는데 이 테스트만 로컬 import라 컨벤션이 일관되지 않음. 동작에는 영향 없음.
  - 제안: `contextlib`/`io` 를 파일 상단 import 블록으로 이동.

- **[INFO]** `_emit_annotations` 신규 테스트가 어노테이션 포맷을 부분 문자열로만 단언
  - 위치: `.claude/tests/test_report_playwright_flaky.py` `test_emit_annotations_escapes_title`
  - 상세: `::warning file=e2e/a.spec.ts,line=7::` 접두부와 `줄1%0A줄2`(escape 결과) 두 부분 문자열만 확인하고, 그 사이의 `"flaky (재시도 {retries}회 후 통과): "` 문구나 `retries` 값 자체는 단언하지 않음. 향후 이 중간 문구가 실수로 삭제/오손돼도 이 테스트는 통과한다.
  - 제안: (저비용) `self.assertIn("재시도 1회", out)` 한 줄 추가로 보강 가능. 필수는 아님 — `_gha_escape` 단위테스트가 escaping 로직 자체는 이미 별도로 커버.

- **[INFO]** `line == 0` 시 `_emit_annotations` 출력에 대한 테스트 부재 (기존 SUMMARY INFO 11 잔존)
  - 위치: `scripts/report_playwright_flaky.py` `_emit_annotations` vs `_location`(라인 0 이면 `:line` 생략)
  - 상세: `render_markdown`/`_location` 은 `line == 0` 일 때 위치 표기에서 `:line` 을 생략하도록 테스트되어 있으나(`test_flaky_table_lists_each` 의 `e2e/b.spec.ts` 케이스), `_emit_annotations` 는 그런 분기 없이 `line={f['line']}` 을 그대로 출력해 `line=0` 상태로 나가는 비대칭이 여전히 테스트로 고정되어 있지 않음. 이번 커밋의 RESOLUTION.md 도 이 항목을 "미조치(정당)"로 명시 defer 했으므로 의도된 보류이나, 재차 기록.
  - 제안: 필요 시 `test_emit_annotations_escapes_title` 옆에 `line=0` 케이스를 추가해 현재 동작(비대칭 유지)을 명시적으로 고정.

## 항목별 평가 (점검 관점 8개)

1. **테스트 존재 여부**: 이번 diff 자체가 직전 테스트 리뷰의 WARNING 2건(다건 렌더 단언 삭제 복원, docstring 부정확 정정) + INFO 4건(`_emit_annotations` 테스트/docstring, `\r` 케이스, malformed-summary 미오염 단언)을 정확히 해당 위치에 반영. 신규 프로덕션 코드 변경(`typing.Iterator`→`collections.abc.Iterator`, docstring, noqa 문구)은 순수 리팩터/문서 변경으로 동작 변화 없어 별도 신규 테스트 불요 — 기존 테스트가 그대로 회귀 가드 역할.
2. **커버리지 갭**: 위 INFO 3건 외 중대한 커버리지 갭 없음. `find_flaky`/`render_markdown`/`_write_step_summary`/`_gha_escape`/`main` 각 함수의 정상/예외 경로가 모두 최소 1개 이상 테스트로 커버됨. `CrossFilePathGuardTest` 가 `e2e.yml`·`playwright.config.ts` 와의 경로 SoT 정합까지 가드.
3. **엣지 케이스**: `\r` 추가로 `_gha_escape` 의 3개 escape 대상(`%`,`\r`,`\n`)이 모두 개별 커버됨(단, 셋이 한 문자열에 동시에 섞인 조합 케이스는 없음 — 구현이 3개의 독립적 `.replace()` 체인이라 상호작용 리스크는 낮음). `line == 0`, retry 값이 `None`/비정수인 경우, `suites` 가 리스트가 아닌 경우 등 기존에 커버된 엣지 케이스는 그대로 유지·강화(`written == ""` 단언 추가).
4. **Mock 적절성**: `contextlib.redirect_stdout`/`io.StringIO` 로 stdout 캡처, `mock.patch.dict(os.environ, ...)` 로 환경변수 격리, 실제 파일 I/O 는 `tempfile.TemporaryDirectory` 로 진짜 파일시스템에 대해 수행 — 과도한 mocking 없이 실제 동작과의 괴리가 적은 구성. 신규 테스트도 이 패턴을 그대로 따름.
5. **테스트 격리**: `_run_main` 헬퍼가 매 호출마다 새 임시 디렉터리를 생성하고 `mock.patch.dict` 컨텍스트가 종료 시 환경변수를 복원 — 테스트 간 공유 상태 없음. 모듈 레벨 `flaky = load_module_by_path(...)` 은 읽기 전용으로만 쓰여 안전.
6. **테스트 가독성**: 각 신규 assertion 에 의도를 설명하는 한국어 주석(`# 다건 렌더 — 두 번째 이후 행 누락 회귀 가드`, `# 개행이 escape 되어 어노테이션이 깨지지 않음`, `# 예외가 render/write 전에 발생 → summary 오염 없음`)이 붙어 있어 "왜" 이 assertion 이 존재하는지 명확. 로컬 import(위 INFO) 정도만 미세하게 일관성 이탈.
7. **회귀 테스트**: `test_flaky_table_lists_each` 복원이 정확히 직전 회귀(다건 렌더 시 2번째 이후 행 누락을 잡지 못하던 것)를 되돌림. `test_unexpected_schema_does_not_crash` 강화(`written == ""`)는 "예외가 부분 상태를 남기지 않는다"는 불변식을 새로 고정 — `find_flaky(report)` 에서 `report["suites"]` 가 문자열(`"표준아님"`)일 때 `suite.get(...)` 호출 시 `AttributeError` 가 `_write_step_summary`/`_emit_annotations` 호출 **전**에 발생한다는 실제 제어 흐름과 정확히 일치하는 단언(구현을 다시 추적해 검증함).
8. **테스트 용이성**: 프로덕션 코드가 `_safe_int`/`_iter_specs`/`find_flaky`/`render_markdown`/`_write_step_summary`/`_gha_escape`/`_emit_annotations`/`_load_report`/`main` 으로 작게 분리되어 각각 독립적으로 단위테스트 가능. `main(argv)` 이 경로를 인자로 받고 `GITHUB_STEP_SUMMARY` 를 환경변수로만 소비해 DI 없이도 테스트 용이. 이번 diff 의 리팩터(`typing.Iterator`→`collections.abc.Iterator`, noqa 주석 문구)는 테스트 용이성에 영향 없음.

## 요약
이번 커밋은 직전 fresh 리뷰가 지적한 테스트 관련 WARNING(다건 렌더 회귀 가드 삭제, docstring 부정확 서술) 2건과 INFO 4건을 정확한 위치에 정밀하게 반영했다. 새 테스트들은 실제 제어 흐름(예외가 어디서 발생해 무엇을 오염시키지 않는지)을 정확히 추적한 단언으로 구성되어 있고, mock 사용이 최소한이며 테스트 간 격리도 견고하다. 남은 것은 전부 저위험 INFO(로컬 import 컨벤션 이탈, `_emit_annotations` 부분 문자열 단언, `line==0` 어노테이션 비대칭 미고정)로, 별도 조치 없이도 병합 가능한 수준이다.

## 위험도
NONE
