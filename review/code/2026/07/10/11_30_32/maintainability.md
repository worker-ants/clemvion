# 유지보수성(Maintainability) 리뷰

이번 커밋은 직전 리뷰 라운드(`review/code/2026/07/10/11_02_46`)의 Warning 6 + INFO 다수를 조치하는
후속 커밋이다. 그중 유지보수성 담당(당시 W6: 리포트 경로 3중 하드코딩 / INFO: 중첩 깊이·타입힌트·
독스트링 정밀도·retry 파싱 응집도)이 지적한 항목이 실제로 어떻게 반영됐는지를 중심으로 프레시하게
재검토했다.

## 발견사항

- **[INFO]** `noqa: BLE001` 이 이 저장소에 배선되지 않은 린터(Ruff)의 규칙 코드를 참조
  - 위치: `scripts/report_playwright_flaky.py:173` (`except Exception as exc:  # noqa: BLE001`)
  - 상세: 저장소 전역의 기존 `noqa` 주석은 전부 flake8/pyflakes 계열 코드(`F401`, `E402`, 예:
    `.claude/tests/test_*.py`·`.claude/hooks/*.py`·`code_review_orchestrator.py` 등 20여 곳)만
    쓴다. `BLE001`("blind-except")은 Ruff 전용 규칙 코드인데, 저장소 어디에도 `ruff`/`pyproject.toml`
    설정이나 CI 스텝이 없다(`grep -ri ruff` 전무). 즉 이 주석은 어떤 도구도 실제로 소비하지 않는
    죽은 지시자이면서, 기존 저장소의 "flake8 코드만 쓴다"는 암묵 컨벤션과도 다른 새 스타일을
    도입한다 — 다음 유지보수자가 "이 repo 가 ruff 를 쓰나?" 오해할 소지.
  - 제안: 코드 특정 없이 일반 주석(`# 관측 스크립트라 어떤 예외도 CI 를 깨면 안 됨`)으로 남기거나,
    실제로 ruff 를 도입할 계획이 없다면 `noqa` 태그 자체를 제거.

- **[INFO]** `typing.Iterator` 와 PEP 604 `X | None` 스타일이 한 파일에 혼재
  - 위치: `scripts/report_playwright_flaky.py:25`(`from typing import Any, Iterator`), `42`
    (`Iterator[dict]`) vs `141`(`dict | None`), `70`/`154`(`list[dict]`)
  - 상세: `from __future__ import annotations` 로 지연 평가되므로 기능상 문제는 없으나, 같은 파일이
    한쪽은 `typing` 모듈의 제네릭(`Iterator`)을 쓰고 다른 쪽은 빌트인 제네릭(`list[dict]`,
    `dict | None`)을 쓰는 두 스타일을 섞고 있다. `Iterator` 하나만 이례적으로 `typing` 에서 온다.
  - 제안: `Iterator` 를 `collections.abc.Iterator` 로 옮기거나(3.9+ 런타임 서브스크립트 지원),
    파일 전체를 빌트인 제네릭 스타일로 통일.

- **[INFO]** `CrossFilePathGuardTest` 의 정규식 기반 cross-file 대조는 두 파일의 서식(formatting)에
  암묵적으로 결합
  - 위치: `.claude/tests/test_report_playwright_flaky.py:228-241`
  - 상세: `e2e.yml` 의 `run:` 인자를 `report_playwright_flaky\.py\s+(\S+)` 로, `playwright.config.ts`
    의 `outputFile` 을 `"json",\s*\{\s*outputFile:\s*"([^"]+)"` 로 파싱한다. 실제 YAML/TS 파서가
    아니므로, 두 파일 중 하나를 실제 값 변경 없이 순수 포맷팅(예: `run:` 을 멀티라인 블록으로 바꾸거나
    reporter 배열의 줄바꿈/따옴표 스타일을 바꾸는 것)만 해도 이 테스트가 "경로를 못 찾음" 으로 fail
    할 수 있다. 이는 W6 조치의 의도된 트레이드오프(정합 가드 vs 파서 견고성)이고 클래스 독스트링도
    취지를 밝혀 뒀지만, 두 워크플로/설정 파일을 만지는 다음 작성자가 이 숨은 결합을 모르면 당황할
    소지가 있다.
  - 제안: 조치 불필요(현재 트레이드오프가 합리적). 필요시 `e2e.yml`/`playwright.config.ts` 쪽에도
    "이 줄의 서식이 harness 테스트 정규식과 결합돼 있다"는 짧은 역참조 주석을 남기면 대칭성이
    좋아진다.

- **[INFO]** `main()` 의 블랑켓 `except Exception` 이 traceback 없이 `repr()` 만 출력
  - 위치: `scripts/report_playwright_flaky.py:173-174`
  - 상세: 설계상 항상 exit 0 이어야 하므로 예외 흡수 자체는 올바르다. 다만 `print(f"... {exc!r}")`
    만으로는 CI 로그에서 스택 위치를 알기 어려워, 향후 실제로 이 경로가 발동하는 회귀가 생기면
    원인 추적이 `_load_report` 의 명시적 에러 메시지보다 덜 친절하다.
  - 제안: 선택사항 — `traceback.print_exc()` 를 함께 호출해도 exit code·비차단 계약은 그대로
    유지되면서 디버깅 편의만 올라간다.

## 요약

직전 라운드에서 유지보수성 관점 WARNING(리포트 경로 3중 하드코딩) 은 `DEFAULT_REPORT` 상단 주석에
SoT 선언 + `CrossFilePathGuardTest` cross-file 가드로 실질 해소됐고, INFO 로 지적된 4단 중첩(재시도
계산)은 `_max_flaky_retry`/`_safe_int` 헬퍼 추출로 2단으로 얕아졌으며, 타입힌트 부재·독스트링
정밀도(모든 test 대상 vs flaky test 한정) 도 모두 반영됐다. 신규 테스트도 `_run_main` 헬퍼로 4개
통합 케이스의 tempfile/env-patch 보일러플레이트를 DRY 하게 묶어 기존 테스트 파일의 관례(한글 설명
주석, `_spec` 같은 fixture 헬퍼)를 그대로 따른다. 이번 라운드에서 남은 것은 전부 사소한 스타일 관찰
(존재하지 않는 린터를 가리키는 `noqa` 코드, typing import 스타일 혼용, 정규식 가드의 서식 결합
성)뿐이며 코드 품질을 저해하는 실질적 문제는 없다.

## 위험도
LOW
