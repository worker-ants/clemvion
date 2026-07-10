# 부작용(Side Effect) Review

대상 커밋: `c89f0ffb9` — 직전 fresh 리뷰(`11_30_32`) Warning 2 + INFO 다수 조치 커밋. 실질 코드 변경은
`.claude/tests/test_report_playwright_flaky.py`(테스트)와 `scripts/report_playwright_flaky.py`(스크립트
본체) 두 파일뿐이고, 나머지 11개 파일(`review/code/2026/07/10/11_30_32/**`)은 직전 리뷰 세션의 산출물을
그대로 커밋한 것(본 저장소의 표준 관행 — `review/`는 gitignored 아님)이라 부작용 관점에서 별도 로직이
없다.

## 발견사항

- **[INFO]** import 재배치는 런타임 부작용 없음 (검증 완료)
  - 위치: `scripts/report_playwright_flaky.py:22-25` (`from typing import Any, Iterator` →
    `from collections.abc import Iterator` + `from typing import Any`)
  - 상세: 모듈에 `from __future__ import annotations`가 있어 `Iterator[dict]` 어노테이션은 지연
    평가(문자열)되며, `Iterator`는 함수 반환 타입 어노테이션(`_iter_specs`)에만 쓰인다. 즉 이
    import 는 런타임 동작에 관여하지 않는 순수 정적분석용 심볼 교체 — 전역 상태·부작용 변화 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신규 `redirect_stdout` 사용 테스트는 격리 올바름
  - 위치: `.claude/tests/test_report_playwright_flaky.py` `test_emit_annotations_escapes_title`
    (`GhaEscapeTest`)
  - 상세: `_emit_annotations`가 실제로 `stdout`에 `print`하는 부작용을 `contextlib.redirect_stdout`
    `with` 블록으로 캡처한다. 컨텍스트 매니저이므로 예외 발생 시에도 `sys.stdout`이 복원되어, 다른
    테스트로 stdout 오염이 전파되지 않는다. 부작용 격리가 올바르게 스코프됨 — 문제 아님.
  - 제안: 조치 불필요.

- **[INFO]** `except Exception as exc: # noqa: BLE001` → 일반 주석 교체는 행동 변화 없음
  - 위치: `scripts/report_playwright_flaky.py:172-173`(구) / 신 코드 동일 라인
  - 상세: `noqa` 태그 제거·주석 문구 변경뿐이며 `except Exception`의 흡수 범위·`main()`의 "항상
    exit 0" 계약은 diff 전후 동일하다. 이 blanket except 자체는 이번 커밋에서 새로 도입된 것이 아니라
    선행 커밋(`926bb1ecf`)에서 이미 존재했고, 본 diff 는 표시(주석)만 바꿨다. 부작용 표면 변화 없음.
  - 제안: 조치 불필요.

- **[INFO]** `main()`의 `$GITHUB_STEP_SUMMARY` append·`::warning::` stdout 출력 계약은 diff 로 인한
  변경 없음
  - 위치: `scripts/report_playwright_flaky.py` `_write_step_summary`/`_emit_annotations`/`main`
  - 상세: 환경변수 읽기(`os.environ.get("GITHUB_STEP_SUMMARY")`)·파일 append(`open(path, "a")`)·
    stdout 에 `::warning::` 어노테이션 출력은 이번 diff 이전부터 존재하던 부작용이며, 이번 커밋은
    `_emit_annotations`에 docstring 한 줄만 추가했을 뿐 호출 순서·인자·부작용 자체는 변경하지 않았다.
    새로운 환경변수 읽기/쓰기, 새로운 파일시스템 부작용, 새로운 네트워크 호출은 diff 에 없다.
  - 제안: 조치 불필요.

- **[INFO]** 함수 시그니처·공개 인터페이스 변경 없음
  - 위치: `scripts/report_playwright_flaky.py` 전체
  - 상세: `_emit_annotations(flaky: list[dict]) -> None`, `main(argv: list[str]) -> int` 등 모든 함수
    시그니처가 diff 전후 동일하다. 이 스크립트는 CLI 진입점(`__main__`)만 노출하는 내부 CI 도구라
    호출자(= `e2e.yml` step)에 영향을 줄 인터페이스 변경 자체가 없다.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 산출물(`review/code/2026/07/10/11_30_32/**`) 커밋에 워크트리 종속 절대경로가
  그대로 기록됨
  - 위치: `review/code/2026/07/10/11_30_32/_retry_state.json`, `meta.json` 등
  - 상세: `_retry_state.json`의 `session_dir`/`prompt_file`/`output_file` 필드가 이번 세션의
    워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/e2e-flaky-surfacing-0eed0c/...`)를
    그대로 담고 있다. 다른 머신/워크트리에서는 무의미한 값이 되지만, 이는 본 리뷰 파이프라인의
    기존 표준 산출물 포맷(모든 과거 리뷰 세션이 동일 패턴)이라 이번 커밋이 새로 도입한 문제가 아님.
  - 제안: 조치 불필요(기존 관행).

## 요약

이번 커밋의 실질 코드 변경(`scripts/report_playwright_flaky.py`, `.claude/tests/test_report_playwright_flaky.py`)은
import 재배치·docstring/주석 추가·테스트 보강뿐으로, 새로운 전역 상태·환경변수 읽기/쓰기·파일시스템
부작용·네트워크 호출·함수 시그니처/공개 인터페이스 변경·이벤트/콜백 동작 변화가 전혀 없다. 기존에
존재하던 부작용(stdout `::warning::` 출력, `$GITHUB_STEP_SUMMARY` append, 항상 exit 0)의 범위·순서도
그대로 유지된다. 나머지 커밋 파일들은 직전 리뷰 세션 산출물을 그대로 저장소에 반영한 것으로, 부작용
관점에서 별도 로직이 없다.

## 위험도
NONE
