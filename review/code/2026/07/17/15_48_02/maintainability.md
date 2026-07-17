# Maintainability Review — report-paths-shared-0edbf0

## 발견사항

- **[INFO]** `review_guard.py`의 "fail loudly" 주석 근거가 실제 호출 체인·예외 처리 구조와 어긋남
  - 위치: `.claude/hooks/_lib/review_guard.py:113-118` (신규 주석 블록 + `from _shared import report_paths as _report_paths_lib`)
  - 상세: 주석은 "NOT wrapped in a try/except fallback: a silent import failure would make the
    coverage gate pass everything ... Fail loudly" 라고 설명한다. 즉 여기서 import 를 로컬로
    감싸 fallback 하면 "silent" 하게 게이트가 전부 통과되고, 감싸지 않아야 그걸 막는다는
    논리다. 그런데 실제 호출 체인을 추적하면:
    - `evaluate_review()`(:828) → `_newest_resolved_review_mtime()`(:489) →
      `_summary_is_resolved()`(:409) → `_forced_coverage_missing()`(:371) →
      `_report_paths_lib.missing_reports(...)`(:406) 사이 어디에도 로컬 `try/except` 가 없다.
    - 두 소비자 `guard_review_before_push.py`·`guard_review_before_stop.py` 모두 이미
      `from review_guard import evaluate_review` **import 문 자체**와 `evaluate_review()`
      **호출** 양쪽을 각각 `except Exception: traceback.print_exc(...); ... = None` 으로
      감싸고 있다(둘 다 fail-open, 둘 다 traceback 출력).
    - 따라서 만약 `_shared.report_paths` import 를 로컬에서 `except Exception:
      _report_paths_lib = None` 식으로 감쌌더라도, 이후 `_forced_coverage_missing` 이
      `_report_paths_lib.missing_reports(...)` 를 호출하는 순간 `AttributeError` 가 위 체인을
      타고 그대로 상위(hook 의 `main()`)까지 전파되어 **동일하게** traceback 출력 +
      fail-open(게이트 통과) 으로 귀결된다. 즉 "감싸면 silent, 안 감싸면 loud" 라는 대비가
      이 코드베이스의 실제 예외 전파 경로상으로는 성립하지 않는다 — 결과(게이트가 전부
      통과됨, traceback 은 어차피 찍힘)가 두 경우 모두 같다.
    - 동작 자체는 안전하다(어느 쪽이든 fail-open 이며 세션을 wedge 하지 않는다는 모듈 전체
      철학과 일치). 문제는 **주석이 서술하는 인과관계**이지 런타임 동작이 아니다.
  - 제안: 주석을 "왜 로컬 fallback 을 안 쓰는가" 대신 "굳이 로컬 fallback 이 필요 없다 —
    상위 두 호출부(push/stop 훅)가 이미 import 실패·호출 실패를 동일하게 loud+fail-open 으로
    처리하므로 여기서 추가로 감쌀 이유가 없다" 는 실제 근거로 정정 권장. (이 PR 의 핵심
    메시지인 "주석은 메커니즘이 아니다" 가 이 신규 주석에도 그대로 적용되는 사례라 특히
    짚을 가치가 있음.) 기능적 수정은 불필요.

- **[INFO]** `missing_reports()` 파라미터 타입힌트 누락 — 같은 파일 내 다른 함수와 비일관
  - 위치: `.claude/_shared/report_paths.py:74` — `def missing_reports(session_dir: str, names, state: dict) -> list[str]:`
  - 상세: 같은 모듈의 `report_path`(`session_dir: str, name: str, state: dict`), `report_paths`,
    `has_report` 는 전부 파라미터에 타입힌트가 있는데 `missing_reports` 의 `names` 만 없다.
    함수 내부에서 `isinstance(names, list)` 로 방어하는 것과 별개로, 선언 타입 자체가
    비어 있어 시그니처만 보고 기대 타입을 파악하기 어렵다.
  - 제안: `names: list[str]` 로 타입힌트 추가 (런타임 방어 로직은 그대로 유지).

- **[INFO]** `report_paths()` 의 위임 방식이 매 항목마다 `report_path()` 전체 탐색을 재실행 (영향 미미)
  - 위치: `.claude/_shared/report_paths.py:54-63`
  - 상세: `report_paths()` 는 각 `inv` 에 대해 `report_path(session_dir, inv["name"], state)`
    를 호출하는데, `report_path()` 내부는 다시 `invocations` 전체를 `next(...)` 로 선형 탐색한다
    → 세션당 O(n²). 에이전트 수(N)가 실질적으로 5~10개 수준이라 성능에는 전혀 영향이
    없고, `report_path` 재사용으로 basename 해석 로직 중복을 피한 DRY 트레이드오프로는
    합리적인 선택이다. 순수 참고 사항.
  - 제안: 현재 규모에서는 변경 불필요.

## 요약

이 변경은 세 곳(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)에
독립적으로 구현되어 있던 "report 가 어디 있고 무엇을 report 로 칠 것인가" 로직을
`.claude/_shared/report_paths.py` 로 단일화한 리팩터로, 실제로 측정된 drift 버그(동일한 빈
리포트를 CLI 는 OK, 가드는 차단으로 판정)를 근본적으로 제거한다. 함수는 짧고 단일 책임이며
(`report_path`/`report_paths`/`has_report`/`missing_reports` 가 서로를 조합해 재사용), 중첩
깊이·순환 복잡도 모두 낮고 매직 넘버도 없다. 세 소비자 모두 동일한 alias(`_report_paths_lib`)로
일관되게 참조하고, `_shared` 라는 제3의 패키지명을 택한 이유·`isfile`→`has_report`(비어있지
않음) 전환 이유·frontend 쪽 sidebar 테스트 헬퍼 추출이 안 되는 부분(vi.mock 호이스팅)까지
모두 근거와 함께 문서화되어 있어 가독성·추적성이 높다. 새 테스트(`test_report_paths_shared.py`
의 `AgreementTest`, `test_forced_coverage_selection.py`)는 mock 이 아닌 실제 서브프로세스·실제
디렉토리로 "가드와 CLI 가 같은 결론을 내는가" 라는 진짜 불변식을 직접 검증해 회귀 방지 효과가
크다. sys.path 삽입 패턴(가드형 vs 무조건형), 테스트 클래스/파일 네이밍, 라인 길이 등은 모두
기존 코드베이스 관례와 대조 확인했고 이탈이 없다. 유일하게 짚을 만한 점은 신규 주석 하나의
서술적 정확성(위 INFO#1)과 사소한 타입힌트 누락 하나뿐으로, 기능적 결함이나 구조적 우려는
발견되지 않았다.

## 위험도

LOW
