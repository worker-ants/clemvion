# Dependency Review

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 이번 변경은 harness 내부 리팩터링뿐이다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 전체 diff
  - 상세: `git diff origin/main...HEAD --stat`(전체 브랜치, 6개 파일로 한정 확인)와 각 파일 diff 를 직접 대조했다. 이번 브랜치는 `package.json`/`requirements*.txt`/`pyproject.toml`/`poetry.lock`/`pnpm-lock.yaml` 등 의존성 매니페스트를 전혀 건드리지 않는다. 코드 변경분에 새로 추가된 import 는 `.claude/tests/test_consistency_context_budget.py`(`import re`, 5행 부근)와 `.claude/tests/test_prompt_omission_notice.py`(`import re`, 29행 부근) 두 곳뿐이며 둘 다 Python 표준 라이브러리다. `code_review_orchestrator.py`/`consistency_orchestrator.py` 의 신규 헬퍼(`_charge_notice`, `_neutralize_sentinel`, `_natural_key`)도 `os`/`re`/문자열 메서드만 사용하고 새 import 를 추가하지 않았다.
  - 제안: 없음 — 버전 고정·라이선스·취약점 검토 대상 자체가 발생하지 않았다.

- **[INFO]** 표준 라이브러리로 자체 해결 — 신규 third-party 패키지를 도입하지 않고 natural sort 를 직접 구현했다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:229` (`_natural_key`), 사용처 `:266`(`collect_markdown_files`)·`:359`(`prioritize_bundle_files`)
  - 상세: 자연 정렬(`"4-" < "10-"`)이 필요해졌을 때 `natsort` 류의 PyPI 패키지를 추가하는 대신 `re.split(r"(\d+)", path)` 기반의 15줄짜리 키 함수로 stdlib 안에서 해결했다. 점검 관점 5(불필요한 의존성)를 이미 만족하는 설계 — 새 패키지가 필요 없는 범위인데도 끌어오는 실수를 하지 않았다.
  - 제안: 없음. 다만 참고로, 같은 저장소의 `code_review_orchestrator.py` 는 아직 이 tie-break 이 필요한 디렉터리 나열 지점이 없다 — 향후 그쪽에서도 같은 요구가 생기면 `_natural_key` 가 `consistency_orchestrator.py` 안의 private 함수라 복붙될 가능성이 있다(두 orchestrator 가 이미 공유 `lib/` 패키지를 쓰고 있으므로, 재발 시 그쪽으로 옮기는 편이 저렴하다). 지금 시점에는 액션 불필요.

- **[INFO]** 내부 모듈 의존 관계 — 이번 diff 는 기존 cross-skill 커플링을 변경하지 않는다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:29-36` (sys.path 조작으로 `code-review-agents/lib` 를 import)
  - 상세: `consistency_orchestrator.py` 는 `sys.path.insert(0, CODE_REVIEW_SKILL)` 로 자매 스킬(`code-review-agents`)의 `lib` 패키지(`session`)를 그대로 재사용하는 기존 구조를 그대로 유지한다. `git diff` 상 이 블록(파일 상단 import 구간)은 변경분에 포함되지 않았다 — 새로 생긴 결합이 아니라 기존 결합이다. 두 orchestrator 모두 `_shared/report_paths.py`를 공유하는 구조(주석에 "One rule, three consumers"로 명시)도 이번 diff 로 인한 변화가 아니다.
  - 제안: 없음(정보 제공용). 기존 구조가 문서화돼 있고 이번 변경으로 새로운 순환·이중관리 지점이 생기지 않았음을 확인.

## 요약

이번 변경(`code_review_orchestrator.py`/`consistency_orchestrator.py`의 예산·경계 정합성 수정 3건, 관련 테스트 3개 파일, plan 문서 1건)은 의존성 관점에서 사실상 무해하다. 브랜치 전체를 통틀어 의존성 매니페스트 파일(package.json/requirements/lockfile 등)이 전혀 수정되지 않았고, 코드에 추가된 import 는 Python 표준 라이브러리 `re` 두 건이 전부다(둘 다 테스트 파일 내부 정규식 단언용). 버전 고정·라이선스 호환성·알려진 취약점·번들 크기·빌드 시간·기존 의존성과의 충돌 등 8개 점검 관점 중 실제로 리스크가 발생하는 항목은 없다. 오히려 자연 정렬(natural sort)이 필요한 지점에서 외부 패키지(`natsort` 등) 없이 표준 라이브러리 `re.split` 로 직접 구현한 점은 "불필요한 의존성 도입 회피" 관점에서 바람직한 설계다. 내부 모듈 의존 관계도 이번 diff 로 신설된 결합이 없으며, 기존 cross-skill `lib` 공유 구조는 그대로 유지된다. 유일하게 남기는 참고 사항은 신설된 `_natural_key`가 현재 `consistency_orchestrator.py`에만 private 으로 존재한다는 점인데, 지금 당장 재사용 필요가 없으므로 액션 아이템은 아니다.

## 위험도

NONE
