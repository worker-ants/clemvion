# 문서화(Documentation) 리뷰 — report-paths-shared

## 발견사항

- **[WARNING]** `_report_paths()` 위임 wrapper 의 docstring 이 "call sites 가 낫다" 고 주장하지만 실제 call site 가 0개
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:244-251` (`_report_paths`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:101-107` (`_report_paths`)
  - 상세: 이번 diff 가 두 orchestrator 의 `_reconcile_state_with_disk`(각 파일) 와 `_verify_coverage`(code_review_orchestrator.py) 안에서 `_report_paths(sd, state)` 호출을 모두 `_report_paths_lib.has_report(...)` / `_report_paths_lib.missing_reports(...)` 직접 호출로 교체했다. 그 결과 두 파일의 `_report_paths()` 함수는 리포지토리 전체에서 **자기 자신의 `def` 줄 말고는 호출부가 하나도 없다**(`grep -rn "_report_paths(" --include="*.py" .` 로 확인 — 정의 2건만 매칭). 그런데 두 함수의 docstring 은 각각 "Kept as a named function because call sites read better and the module boundary stays swappable"(code_review_orchestrator.py) / "Thin delegate — ..."(consistency_orchestrator.py, 동일 취지) 라고 적어 **call site 존재를 전제로 존치 근거를 댄다.** 지금은 그 근거가 사실과 다르다 — 두 함수 모두 도달 불가능한 dead code 다.
  - 제안: (a) 정말 앞으로도 필요 없다면 두 함수를 삭제하거나, (b) 외부에서 (예: 다른 스크립트나 향후 CLI 플래그) import 해 쓸 목적으로 의도적으로 남긴 public helper 라면 docstring 을 "현재 내부 call site 없음 — `<이유>` 로 API 형태만 유지" 식으로 정정할 것. 최소한 "call sites read better" 문구는 지금 상태와 불일치하므로 제거·수정 필요.

- **[WARNING]** `.claude/tests/README.md` "What's covered" 표에 신규 테스트 파일 2개 미등재
  - 위치: `.claude/tests/README.md` (이번 diff 에 포함되지 않음) — 신규 파일 `.claude/tests/test_forced_coverage_selection.py`, `.claude/tests/test_report_paths_shared.py`
  - 상세: `.claude/tests/README.md` 의 "What's covered" 표는 `.claude/tests/*.py` 전수 색인이 아니라(예: `test_plan_guard.py`, `test_reap_merged_worktrees.py` 등 기존 파일도 여러 개 빠져 있음) 핵심 불변식을 지키는 테스트를 골라 "왜 이 테스트가 존재하는가" 를 서술하는 큐레이션 문서다. 이번 PR 이 추가한 두 파일은 정확히 그 성격에 부합한다 — `test_report_paths_shared.py` 는 "게이트와 CLI 가 절대 다른 판정을 내려선 안 된다" 는, 바로 이 PR 의 핵심 주장을 `AgreementTest` 로 실측 증명하는 테스트고, `test_forced_coverage_selection.py` 는 forced-coverage 게이트의 "grandfather 없이 전면 적용해도 안전하다" 는 안전 논거를 최초로 mock 이 아닌 실 세션 디렉토리로 검증한다(두 파일 모두 자체 docstring 에 이 배경을 상세히 적어뒀다). `test_orchestrator_state.py`·`test_consistency_orchestrator_state.py`·`test_review_guard_hardening.py` 처럼 "이 테스트가 왜 필요했는지" 를 설명하는 기존 행들과 정확히 같은 결의 항목인데 표에서는 빠졌다.
  - 제안: 두 파일에 대한 행을 표에 추가. 각 파일 docstring 의 핵심 논지(공유 규칙 unit test + 게이트/CLI 합의 검증, forced-coverage 실 세션 통합 테스트)를 요약하면 기존 행들과 톤이 맞는다.

- **[INFO]** `.claude/docs/subagent-call-contract.md` §7 이 새 SoT 모듈을 링크하지 않고 "non-empty" 규칙도 언급하지 않음
  - 위치: `.claude/docs/subagent-call-contract.md:120-124` (§7 마지막 문단) vs `.claude/_shared/report_paths.py` 모듈 docstring
  - 상세: 이 문서(§7)는 "판정은 세션 디렉토리의 리포트 파일 기준이지 `agents_success` 나 `output_file` 의 절대경로가 아니다(후자는 이미 삭제된 워크트리를 가리킨다)" 라고 정확히 같은 취지를 서술하지만, 이번에 신설된 canonical 모듈(`.claude/_shared/report_paths.py`)을 가리키지 않고, 그 모듈의 "두 번째 규칙"인 **비어있지 않아야 함(non-empty)** 요구사항도 언급하지 않는다. 이 PR 의 plan 문서(`plan/complete/harness-report-contract-followups.md` §3)가 이미 "손복사된 설명이 하나가 바뀌면 나머지가 조용히 낡는 패턴" 을 정확히 이 유형의 문제로 지목하고 있어, 같은 논리를 이 문단에도 적용할 여지가 있다. 이 문서는 본 리뷰어 시스템 프롬프트가 "호출 규약·STATUS 라인·재시도 정책" SoT 로 직접 인용하는 hub 문서이기도 하다.
  - 제안: §7 마지막 문단에 `.claude/_shared/report_paths.py` 링크와 non-empty 조건 한 줄을 보태면 향후 drift 여지가 준다. 급하지 않음 — 코드 쪽 강제 로직(게이트·CLI)은 이미 동일 모듈을 공유하도록 고쳐졌고 `AgreementTest` 로 검증되므로, 이 문서 갱신은 순수 가독성/발견성 개선이다.

- **[INFO]** "커밋된 리포트" 통계가 같은 커밋 내 두 문서에서 다른 값으로 인용됨
  - 위치: `.claude/_shared/report_paths.py:28` ("all 4749 committed reports are ≥254 bytes") vs `plan/complete/harness-report-contract-followups.md:46` ("실측(커밋된 리포트 4763개)")
  - 상세: 두 수치 모두 "커밋된 리포트"(review/consistency 산출물)를 실측한 값으로 보이는데 14건 차이가 난다. 전자는 크기(≥254 bytes) 실측, 후자는 섹션 헤더 포함 비율 실측으로 목적은 다르지만, 같은 모집단을 가리키는 것처럼 읽혀서 향후 이 수치를 인용하는 사람이 "어느 쪽이 맞나" 혼동할 수 있다. 같은 날 작업 중 새 리뷰 세션이 커밋되며 자연 증가했을 가능성이 높지만 그 사실이 어디에도 적혀있지 않다.
  - 제안: 필수는 아니나, 두 수치가 서로 다른 시점의 별도 측정이라는 점을 한쪽에 각주로 남기면 향후 "SoT 수치 불일치" 로 오인되는 것을 막을 수 있다.

- **[INFO]** `report_paths.py` 의 `missing_reports` 파라미터 하나만 타입 힌트 누락
  - 위치: `.claude/_shared/report_paths.py:74` — `def missing_reports(session_dir: str, names, state: dict) -> list[str]:`
  - 상세: 같은 파일의 다른 모든 파라미터(`session_dir: str`, `name: str`, `state: dict`)와 반환 타입은 전부 annotated 인데 `names` 만 비어 있다. 함수 본문이 `if not isinstance(names, list): return []` 로 방어적 런타임 체크를 하고(`test_malformed_manifest_shapes_do_not_crash` 가 이 경로를 검증), 실제 기대 타입은 `list[str]` 로 보인다.
  - 제안: `names: list[str]` 로 채우거나(방어 체크는 유지), 의도적으로 loose 하게 둔 것이라면 그 이유를 한 줄 주석으로. 사소한 일관성 문제라 기능에 영향 없음.

## 요약

전반적으로 문서화 품질이 매우 높은 변경이다. 신설 모듈 `.claude/_shared/report_paths.py` 와 `__init__.py` 는 "무엇을" 뿐 아니라 "왜"(이전 두 곳이 실제로 판정을 달리했던 실측 사례, `_lib` 충돌이 프로덕션이 아닌 테스트 프로세스 한정이라는 정정, 254바이트 문턱을 구조적 검증 대신 택한 근거)를 촘촘히 남겼고, 4개 함수 모두 정확한 독스트링을 갖췄다. `review_guard.py`/`code_review_orchestrator.py`/`consistency_orchestrator.py` 세 소비 지점의 기존 장문 중복 설명은 새 모듈로의 짧은 위임 주석으로 정확히 교체됐고, "fail loud, no try/except" 같은 비직관적 결정에는 그 이유가 인라인으로 남았다. 신규 테스트 2개(`test_forced_coverage_selection.py`, `test_report_paths_shared.py`)도 "왜 이 테스트가 필요한가" 를 상세히 서술하는 이 코드베이스의 관행을 그대로 따른다. `plan/complete/harness-report-contract-followups.md` 로의 plan 이관도 라이프사이클 규약(`spec_impact: none`, frontmatter 완비)을 정확히 지켰다. 다만 이 리팩터 자체가 만들어낸 흠 하나(두 orchestrator 의 `_report_paths()` wrapper 가 이제 호출부 없는 dead code 인데 docstring 은 "call sites 때문에 유지" 라고 주장)와, 새 테스트 파일들이 그 성격에 정확히 맞는 기존 README 색인에 반영되지 않은 점이 실질적인 개선 포인트다. 나머지는 향후 drift 를 조금 더 줄일 수 있는 저위험 다듬기 항목이다.

## 위험도

LOW
