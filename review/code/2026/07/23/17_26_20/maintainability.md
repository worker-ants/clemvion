# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 임계값 `5` 가 의미 설명 없는 하드코딩 매직 넘버
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py:251`
  - 상세: `self.assertGreaterEqual(len(self.whitelist), 5, "suspiciously few whitelist patterns parsed")` — 비-vacuity(빈 파싱 결과로 인한 항진명제 방지) 목적의 휴리스틱 임계값인데 왜 5인지 근거가 코드에 없다. 오탐/누락 여부는 테스트 실패 메시지로 설명되지만 숫자 자체의 유래는 불명확.
  - 제안: 모듈 상단에 `_MIN_EXPECTED_WHITELIST_PATTERNS = 5  # PROJECT.md 화이트리스트 현재 항목 수 하한, 임의 조정 가능` 같은 이름 붙은 상수로 추출하면 다음에 화이트리스트가 줄어들 때 의도적 변경인지 회귀인지 구분하기 쉬움.

- **[INFO]** `set(self.blocks[0])` 계산이 3개 테스트 메서드에 중복
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py:270`, `:285`, `:299` (`test_no_paths_ignore_entry_escapes_the_whitelist`, `test_every_whitelist_entry_is_mirrored_or_explained`, `test_unmirrored_list_has_no_stale_entries`)
  - 상세: 동일한 `set(self.blocks[0])` 변환이 세 메서드에서 각각 재계산된다. 로직 자체는 사소하지만(집합 변환 1줄) 세 곳에 흩어져 있어 `blocks[0]` 의 의미("mirrored" = e2e.yml 의 첫 paths-ignore 블록)를 매번 그 자리에서 다시 파악해야 한다.
  - 제안: `setUpClass` 에서 `cls.mirrored = set(cls.blocks[0])` 로 한 번 계산해 공유하면 의도(첫 블록이 "미러링된 집합"이라는 것)가 한 곳에 고정되고 세 테스트가 그 이름을 재사용해 가독성이 약간 개선된다. 각 테스트가 독립적으로 재계산하는 현재 방식도 테스트 격리 관점에서는 무해하므로 우선순위는 낮음.

## 요약

이번 변경의 핵심은 새 하네스 가드 테스트 `test_e2e_exemption_paths_sync.py`(321줄, 순수 표준 라이브러리)와 그에 대응하는 `README.md` 카탈로그 행 추가, plan 문서(`harness-guard-followups.md`) 갱신이다. 코드 품질은 전반적으로 높다: 각 함수(`_yaml_scalar`, `parse_paths_ignore_blocks`, `parse_exemption_whitelist`)는 단일 책임을 가지며 길이도 적절(최대 33줄)하고, 중첩 깊이도 최대 3단(파서의 이중 while + 조건문)으로 과도하지 않다. 네이밍은 목적을 정확히 드러내고(`UNMIRRORED_WHITELIST_ENTRIES`, `WorkflowMirrorsWhitelistTest`), docstring이 "왜"를 상세히 기록해 향후 유지보수자가 판단 근거를 재구성할 필요가 없다. 파서를 텍스트 주입 가능하게 짜고 `ParserBoundaryTest`로 경계(따옴표 스타일, 인라인 주석, 빈 줄, 들여쓰기 종료 등)를 먼저 고정한 뒤 실제 파일을 검증하는 구조는 README에 기록된 저장소 컨벤션(`test_dependabot_npm_coverage.py` 등)과 일관되며, 비-vacuity 가드(`test_parsers_found_something`)도 동일한 확립된 패턴을 재사용한다. 발견된 두 건은 모두 INFO 수준의 사소한 개선 여지(매직 넘버 상수화, 경미한 중복 통합)이며 기능이나 가독성에 실질적 위협이 되지 않는다. `README.md`·plan 문서 변경은 문서 갱신으로 기존 서술 스타일(장문 테이블 셀, 체크박스+Rationale 구조)을 그대로 따른다.

## 위험도
LOW
