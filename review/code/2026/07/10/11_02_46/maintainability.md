# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** Playwright JSON 리포트 경로가 3개 파일에 하드코딩 중복 — 단일 SoT 부재
  - 위치: `scripts/report_playwright_flaky.py:25` (`DEFAULT_REPORT`), `.github/workflows/e2e.yml`
    (`Surface flaky (retry-passed) tests` step의 `run:` 인자), `codebase/frontend/playwright.config.ts`
    (`reporter` 의 `json.outputFile`)
  - 상세: `"playwright-report/results.json"` 이라는 동일한 상대경로 문자열(디렉터리 기준만 다름:
    frontend-relative vs repo-root-relative)이 세 파일에 독립적으로 하드코딩되어 있다. 세 값을
    동기화해주는 테스트나 참조 관계가 없다. 셋 중 하나만(예: `outputFile` 경로) 바뀌면, 스크립트는
    `main()`(`report_playwright_flaky.py:112-115`)의 "리포트 없음 → skip, exit 0" 경로를 조용히
    타서 flaky surfacing 기능 자체가 무력화되지만 CI 는 계속 green 이라 드리프트가 드러나지 않는다.
    이 변경의 전체 목적이 "묻히는 신호를 드러내기"인데, 그 배선 자체가 같은 실패 모드(조용한 무력화)에
    노출돼 있다는 점에서 특히 아쉽다.
  - 제안: 세 위치 중 하나를 SoT 로 두고 나머지는 참조하게 하거나(예: 스크립트가 기대하는 상대경로를
    주석/문서로 명시), 최소한 harness 테스트에 "e2e.yml 이 넘기는 경로 == 스크립트 DEFAULT_REPORT"
    또는 "playwright.config.ts 의 outputFile 경로를 문자열 기준으로 e2e.yml/스크립트와 대조" 하는
    cross-file 가드를 추가해 드리프트 시 최소한 CI 에서 검출되게 한다.

- **[INFO]** `find_flaky()` 내부 재시도 횟수 계산 루프의 중첩 깊이
  - 위치: `scripts/report_playwright_flaky.py:52-58`
  - 상세: `for suite → for spec(_iter_specs 로 이미 1단 재귀 평탄화) → for t → for r → try/except`
    로 실질 4단 중첩이다. suite/spec 순회는 `_iter_specs` 로 이미 분리해 놓은 좋은 패턴인데, 그
    안쪽의 "test들 중 최대 retry 값 찾기" 로직만 인라인으로 남아 있어 함수 하나의 중첩 깊이가
    깊어졌다.
  - 제안: `_max_retry(tests)` 같은 소형 헬퍼로 추출하면 `find_flaky()` 본문이 얕아지고, 그 자체로
    단위 테스트하기도 쉬워진다(현재는 `find_flaky` 를 통해서만 간접 검증됨).

- **[INFO]** 기존 `scripts/*.py` 컨벤션(타입 힌트) 과의 일관성 차이
  - 위치: `scripts/report_playwright_flaky.py:19` (`from __future__ import annotations`) 및
    전체 함수 시그니처(`28`, `40`, `70`, `74`, `99`, `111`행)
  - 상세: 같은 폴더의 `scripts/check-doc-links.py` 는 모든 함수에 타입 힌트를 붙이는 컨벤션을
    쓴다(`def slugify(text: str) -> str:` 등). 신규 스크립트는 `from __future__ import
    annotations` 를 import 했음에도 어떤 함수에도 타입 힌트를 추가하지 않아, import 가 사실상
    죽은 코드이자 기존 스타일과의 불일치로 남는다.
  - 제안: 함수 시그니처에 최소한의 타입 힌트(`report: dict`, `-> list[dict]` 등)를 붙이거나,
    힌트를 쓰지 않을 거면 미사용 import 를 제거한다.

- **[INFO]** `find_flaky()` 독스트링과 구현의 정밀도 불일치
  - 위치: `scripts/report_playwright_flaky.py:40-58`
  - 상세: 독스트링(43-44행)은 "spec 의 어떤 test 든 flaky 면 그 spec 을 flaky 로 집계하고,
    `results[].retry` 의 최댓값을 재시도 횟수로 쓴다" 라고 서술하지만, 실제 구현은 flaky 여부와
    무관하게 그 spec 의 **모든** test(다중 project 실행 시 여러 개일 수 있음)의 `results` 를
    순회해 최댓값을 구한다(52-58행, `for t in tests` 가 필터링 없이 전체를 돈다). 여러
    project(브라우저)로 동시 실행되는 spec 에서 flaky 가 아닌 다른 test 의 retry 값이 더 크면,
    보고되는 `retries` 가 "실제 flaky 로 판정된 test" 의 재시도 횟수와 다를 수 있다. 현재 단일
    chromium project(`playwright.config.ts` 참고) 라 실질 영향은 없지만, 문서와 구현의 암묵적
    범위가 다르면 나중에 project 를 늘릴 때(설계 문서에 이미 "webkit 추가는 별도 follow-up" 으로
    언급됨) 오해의 소지가 된다.
  - 제안: 독스트링에 "spec 내 **모든** test 대상" 임을 명시하거나, 의도가 "flaky 로 판정된
    test 만" 이라면 `t.get("status") == "flaky"` 로 필터링 후 순회하도록 좁힌다.

- **[INFO]** retry 정수 파싱의 3중 방어가 한 줄에 겹쳐 있음
  - 위치: `scripts/report_playwright_flaky.py:56` (`retries = max(retries, int(r.get("retry", 0)
    or 0))` 를 `try/except (TypeError, ValueError)` 로 감쌈)
  - 상세: `dict.get(key, default)` 의 default 인자와 `or 0` fallback, 그리고 `int()` 변환 실패에
    대한 `try/except` 까지 세 겹의 방어가 한 표현식에 뭉쳐 있어, 각 방어가 어떤 입력 케이스를
    막는지(키 없음 / `None` 값 / 비정수 문자열) 한눈에 구분되지 않는다.
  - 제안: `_safe_int(value, default=0)` 같은 헬�퍼로 추출하면 각 방어의 의도가 이름으로 드러나고,
    이 부분만 독립적으로 단위 테스트하기도 쉬워진다. (현재 테스트 스위트에는 비정수 `retry` 값에
    대한 케이스가 없다.)

## 요약

전반적으로 함수 길이·네이밍·문서화·기존 프로젝트의 "Korean 설명 주석 + plan 상호참조" 관행과의
일치도는 양호하다. `_iter_specs` 로 재귀 순회를 분리하고, `render_markdown`/`_write_step_summary`/
`main` 을 단일 책임으로 쪼갠 구조는 읽기 쉽고 테스트 스위트(8 케이스, 중첩·pipe escape·빈 리포트
등 경계값 포함)도 로직을 잘 커버한다. 다만 (1) 세 파일에 걸쳐 동일한 리포트 경로 문자열이
동기화 보장 없이 중복돼 있어 "관측 기능이 조용히 무력화" 될 수 있는 구조적 리스크가 있고, (2)
`find_flaky()` 내부의 재시도 계산 루프가 다소 깊게 중첩돼 있으며 독스트링이 실제 범위(모든
test vs flaky test)를 정확히 반영하지 않는 점, (3) 신규 스크립트가 인접 `scripts/*.py` 의
타입 힌트 컨벤션을 따르지 않는 점은 모두 사소하지만 누적되면 후속 수정자의 혼동 비용을 늘린다.

## 위험도

LOW
