# Architecture Review

## 발견사항

- **[WARNING]** 번들 예산-초과 + 생략 안내 패턴이 두 orchestrator 에 독립적으로 존재하며, 이번 diff 가 그 비대칭을 더 벌렸다
  - 위치:
    - `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561-578` (신설 `_charge_notice` 헬퍼)
    - `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:694`, `740-742`, `756-760` (`_charge_notice` 실사용 지점)
    - `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:724-765` (`truncate_file_bundle`, 특히 756-760 의 `while kept:` 루프)
  - 상세: `code_review_orchestrator.py` 는 "예산 - 안내문 길이" 산술이 4곳에서 손으로 반복되다 두 번 누락된 이력(주석에 명시: "That subtraction used to be written by hand at each of the four budget decisions, and it was missed twice")을 이번 diff 에서 `_charge_notice(budget, *notes)` 로 통합했다. 그런데 `consistency_orchestrator.py` 의 `truncate_file_bundle` 도 개념적으로 동일한 문제 — "파일을 하나씩 버리면서 안내문 길이를 예산에 재반영" — 를 `while kept: ... if len(head) + sum(len(c) for c in kept) + len(notice) <= budget` 형태로 여전히 손으로 계산한다. 두 orchestrator 는 이미 "Mirrors X — change both" 주석이 `_reconcile_state_with_disk`/`has_report`/sentinel 방어 등 최소 3곳에 반복 등장할 만큼 같은 개념을 나란히 재구현해 왔고, 그때마다 한쪽 수정이 다른 쪽에 수동으로 "포팅"되어야 했다(이번 PR 자체도 sentinel 방어가 "4개 진입점 중 2곳만" 적용된 CRITICAL 을 뒤늦게 잡아 고친 이력이 있다). `_charge_notice` 를 code-review 쪽에만 넣은 것은 이 패턴을 한 번 더 반복한 것이다. 두 스킬은 이미 `.claude/skills/code-review-agents/lib/__init__.py:1` 이 "Shared library for AI-agent orchestrators (code-review-agents, consistency-checker)" 라고 명시하고 `session.py`/`role_instructions.py` 를 공유하는 선례가 있어, 이런 공용 산술을 그 위치로 옮기지 못할 구조적 이유는 없다.
  - 제안: `_charge_notice` (혹은 "예산에서 안내문들을 뺀 값" 이라는 개념)를 `code-review-agents/lib/` 에 옮겨 두 orchestrator 가 함께 import 하게 한다. 두 파일의 절단 단위(한쪽은 line-boundary, 한쪽은 file-boundary)가 달라 전체 알고리즘을 하나로 합치기는 어렵더라도, "예산 차감 산술" 처럼 이미 동일한 조각은 공유해 "change both" 주석에 의존하는 수동 동기화를 줄인다.

- **[INFO]** `build_files_section` 이 연속된 패치로 책임이 계속 누적되는 중
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:607-807` (함수 전체), 이번 diff 로 늘어난 부분은 633-664 (파일별 dict 에 `source_lines`/`total_lines` 필드 추가)와 735-772 (2차 절단 시 예산 재계산)
  - 상세: 이 함수는 이미 (1) 파일별 번호매김·1차 절단, (2) 헤더+diff 만으로도 예산 초과인 경우의 전역 처리, (3) 콘텐츠 예산 배분 + 개별 생략 안내, (4) 개별 안내가 예산을 넘으면 집계 안내로 축소하는 fallback 까지 4개의 서로 다른 정책 분기를 한 함수 안에 담고 있다. 이번 diff 는 "2차 절단이 1차 절단의 주석까지 총 줄 수로 오인하던" 실측 CRITICAL 을 고치기 위해 `source_lines`/`total_lines` 필드와 관련 분기를 추가했는데, 이는 정확하고 잘 테스트되어 있지만 함수 하나가 떠안는 상태·분기 수는 계속 늘고 있다(현재 ~200줄, 상호 배타적 분기 3개 + 중첩 클로저 `_render`). 지금 당장 버그는 없으나 다음 유사 수정이 들어올 때 어느 분기를 건드려야 하는지 파악하는 비용이 계속 커진다.
  - 제안: 급하지 않음 — 지금 쪼개면 오히려 활발한 수정 중인 코드의 diff 노이즈만 커진다. 다만 이 결함 클래스(예산 재계산)가 안정화되면, 세 상호 배타적 분기((0) 무제한, (1) 헤더+diff 만도 초과, (2) 콘텐츠 포함 가능)를 이름 있는 하위 함수로 분리하는 리팩터를 후속 과제로 남겨 둘 만하다.

- **[INFO]** `_lib` 라는 동일 이름의 서로 다른 두 패키지가 존재해 in-process import 가 충돌한다 — 이번 diff 의 테스트 3개가 모두 이 우회를 반복 문서화
  - 위치:
    - `.claude/tests/test_consistency_context_budget.py:27-31`
    - `.claude/tests/test_consistency_bundle_priority.py:21-23`
    - `.claude/tests/test_prompt_omission_notice.py:22-24`
    - 실체: `.claude/skills/_lib/`(→ `project_config.py`) vs `.claude/hooks/_lib/`(→ `review_guard.py` 등) — 서로 무관한 두 패키지가 같은 최상위 이름 `_lib` 를 공유
  - 상세: orchestrator 를 같은 프로세스에 import 하면 먼저 로드된 `_lib` 가 `sys.modules` 에 캐시되어, 이후 `from _lib import project_config` 가 (hook 스위트가 먼저 실행됐을 경우) 엉뚱한 `.claude/hooks/_lib` 를 가리킬 수 있다. 이번 diff 가 만든 문제는 아니지만(기존 컨벤션), 수정된 3개 테스트 파일 모두가 "Fresh-interpreter" 서브프로세스 패턴으로 이를 우회한다고 각자 docstring 에 반복 명시하고 있어 — 모듈 경계가 이름 충돌로만 회피되고 있다는 구조적 비용이 diff 표면에도 계속 드러난다.
  - 제안: 즉시 조치 불요(서브프로세스 우회가 실제로 동작하고, 지금 고치면 무관한 범위까지 건드리게 된다). 다만 harness 전역 패키지 이름 정책 문서가 있다면 "`_lib` 는 트리마다 로컬 전용, 공용은 별도 이름" 같은 규칙을 명문화해 향후 세 번째 `_lib` 이 생기는 걸 막을 필요가 있다.

## 요약

이번 diff 는 두 orchestrator(code-review / consistency-checker)의 번들 절단·예산 계산 결함을 각각 잘 테스트된 형태로 고친 리팩터로, 함수 시그니처·모듈 인터페이스를 깨지 않고 동작을 보존한 채(주석에 대수적 동치까지 남겨 검증) 진행됐다. 순환 의존성은 없고(`code_review_orchestrator.py` 는 `consistency_orchestrator` 를 주석에서만 언급, 실제 import 는 단방향), 두 orchestrator 가 겪은 "같은 버그를 두 번 따로 고친다" 는 이미 코드 주석에 반복 기록된 구조적 패턴이 이번에도(신설 `_charge_notice` 를 한쪽에만 적용) 재발했다는 점이 유일한 실질 아키텍처 리스크다 — 이미 두 스킬이 공유하는 `lib/` 위치가 있어 해소 비용은 낮다. 나머지는 기존에 알려진 비용(함수 복잡도 누적, `_lib` 이름 충돌)의 연장선으로 당장 차단 사유는 아니다.

## 위험도

LOW
