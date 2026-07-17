# 부작용(Side Effect) 리뷰 — report-paths-shared

## 발견사항

- **[WARNING]** `review_guard.py`의 무보호 신규 import가 "Fail loudly" 의도와 달리 리뷰 게이트 전체를 조용히 무력화할 수 있음
  - 위치: `.claude/hooks/_lib/review_guard.py:108-118` (`if _CLAUDE_DIR not in sys.path: sys.path.insert(...)` + `from _shared import report_paths as _report_paths_lib`), 대비 `.claude/hooks/guard_review_before_push.py:34-38`, `.claude/hooks/guard_review_before_stop.py:56-71`
  - 상세: 코드 주석은 "NOT wrapped in a try/except fallback ... Fail loudly"라고 명시하지만, 이 모듈의 유일한 두 production 호출자(`guard_review_before_push.py`, `guard_review_before_stop.py`)는 `from review_guard import evaluate_review` (및 stop 훅의 두 번째 `from review_guard import (_resolution_in_flight, _repo_root, _iter_summaries)`) 전체를 `try/except Exception: ... = None`으로 감싸고 있다. 따라서 `_shared.report_paths` import가 실패하면 `import review_guard` 자체가 실패하고, 두 호출자 모두 "review gate 전체 비활성화"로 **조용히**(exit 0, stderr 트레이스백만 — 정상 allow 경로에서는 사용자에게 노출되지 않음) fallback한다. 이번 diff 이전에는 review_guard.py가 stdlib 외 유일한 의존성(`branch_guard`)조차 자체 try/except로 감싸 "기본 브랜치 판별만 저하, 나머지 게이트 기능은 정상"이었다 — 즉 review_guard.py는 하드(무보호) 외부 의존성이 전혀 없었다. 이번 변경으로 review_guard.py 전체가 `_shared` 패키지 하나에 대한 하드 의존성을 갖게 되어, 장애 반경이 "forced-coverage 서브체크 하나"에서 "push 게이트 + stop nudge + resolution-in-flight 억제 전체"로 확대된다. 주석이 막으려 한 "커버리지 게이트가 조용히 다 통과"는 막히는 게 아니라, 더 넓은 범위(게이트 자체가 아예 실행되지 않음)로 재발한다 — 관찰 가능한 최종 결과(허용됨, 조용히)는 두 시나리오에서 동일하다.
  - 제안: (a) review_guard.py 내부에서 `_shared` import 실패를 캐치해 `_report_paths_lib = None` 폴백 후, 실제로 그 경로를 쓰는 `_forced_coverage_missing` 안에서만 명시적으로 실패를 표면화(예: 항상 예외 재발생 또는 별도 로그)하거나, (b) 현재 설계를 유지한다면 주석의 "Fail loudly" 표현을 "호출자가 fail-open으로 흡수하므로 실질적으로는 게이트 전체가 조용히 disable된다"로 정정해 향후 오해를 방지.

- **[WARNING]** 오케스트레이터 CLI의 existence→non-empty 전환이 과거 커밋된 세션에 소급 적용되며, 읽기 목적 커맨드의 write 부작용 트리거 범위를 넓힘
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `_reconcile_state_with_disk`(구 `os.path.isfile` → `_report_paths_lib.has_report`), `_verify_coverage`; `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `_reconcile_state_with_disk` 동일 패턴
  - 상세: 이번 diff의 핵심 의도이자 `AgreementTest`로 잘 검증된 변경이지만, 부작용 관점에서 명시할 가치가 있다. `_reconcile_state_with_disk`는 `--summary-state`/`--resume`가 호출하며, 계산 결과(`agents_success`/`agents_pending`/`agents_fatal`)가 기존 `_retry_state.json`과 다르면 **즉시 디스크에 덮어쓴다**(`_save_state`) — 이는 기존에도 "conditional writer... auditing an old committed session can dirty the worktree"로 문서화된 동작이다. 이번 변경으로 "존재하지만 0바이트인 리포트"를 가진, **이미 커밋된 과거 세션**들이 새로 "missing"으로 재분류되므로, 그런 세션 디렉토리를 대상으로 순수 조회 목적의 `--summary-state`/`--resume`를 실행하기만 해도 워크트리가 dirty해질 트리거 범위가 넓어진다. `--verify-coverage`도 동일 이유로 과거엔 통과(existence-only)하던 세션이 이제 실패 판정을 낼 수 있다. 실측(그레핑)으로는 이 CLI들을 히스토리 전체에 자동으로 돌리는 CI/스케줄 작업은 없고 세션 진행 중(`--resume`) 또는 수동 감사(`--sync-from-disk`) 시에만 호출되므로 실질 폭발 반경은 제한적이다.
  - 제안: 코드 자체는 의도된 수정으로 문제 없음. 다만 `code-review-agents/SKILL.md`·`consistency-checker/SKILL.md`에 "이 변경 이후 과거 세션에 `--summary-state`/`--sync-from-disk`를 실행하면 0바이트 placeholder 리포트가 있던 세션은 판정이 바뀌고 `_retry_state.json`이 갱신될 수 있다"는 한 줄 안내를 남기면 향후 감사 작업자가 예상 못한 git diff에 놀라지 않는다.

- **[INFO]** `sys.path` 전역 상태 확장 — `_CLAUDE_DIR`를 3개 스크립트에서 공통 삽입
  - 위치: `review_guard.py:116-118`, `code_review_orchestrator.py:31-34`, `consistency_orchestrator.py:33-35` (각 `sys.path.insert(0, _CLAUDE_DIR)`)
  - 상세: 세 파일 모두 모듈 로드 시점에 `.claude/` 루트를 `sys.path` 맨 앞(index 0)에 삽입하는 프로세스 전역 부작용을 갖는다. `.claude/__init__.py`의 신설 취지(3번째 `_lib` 대신 3번째 최상위 패키지)와 정합되는 의도된 설계다. 실측 확인: `.claude/` 바로 아래에 `lib`/`_lib` 이름의 충돌 패키지 없음(`ls .claude/`), `import tests|tools|hooks|config|docs|agents|commands|workflows` 형태의 bare import 코드베이스 전체에 없음(grep), harness 전체 테스트 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 265건 전부 통과(회귀 없음, 아래 "요약" 참조). 다만 `.claude/` 하위 최상위 디렉토리(`agents`, `commands`, `docs`, `hooks`, `skills`, `tests`, `tools`, `workflows`)는 `__init__.py`가 없어 PEP420 네임스페이스 패키지 후보이므로, 향후 어떤 스크립트가 `import tests`/`import tools` 같은 bare import를 추가하면 `.claude/`가 sys.path 맨 앞에 있어 조용히 그 디렉토리로 resolve될 여지가 이론적으로 생긴다 — 기존 패턴(스킬별 하위 디렉토리만 삽입)보다 삽입 범위가 넓어진 것.
  - 제안: 현재는 실질 위험 없음(실측 확인 완료). 조치 불필요. 참고로만 남김.

- **[INFO]** `report_paths()` 공유화로 malformed manifest 처리 방식이 "예외" → "조용한 스킵"으로 완화됨
  - 위치: `.claude/_shared/report_paths.py` `report_paths()` (`isinstance` 가드), 대비 구 `code_review_orchestrator.py`/`consistency_orchestrator.py` 인라인 구현
  - 상세: 기존 개별 구현은 `for inv in state.get("subagent_invocations", []): out[inv["name"]] = ...` 형태로, `subagent_invocations`가 list가 아니거나 원소에 `name` 키가 없으면 `KeyError`/`TypeError`를 던졌다. 신규 공유 모듈은 `isinstance` 가드로 이런 경우 조용히 스킵하거나 빈 dict를 반환한다. 정상 케이스에는 영향 없고 방어성이 개선된 방향이며, 신규 테스트 `test_malformed_manifest_shapes_do_not_crash`가 이 완화를 명시적으로 pin하고 있어 향후 회귀는 잡힌다.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 프로세스에서 `report_paths.py`가 두 개의 서로 다른 모듈 식별자로 이중 로드됨
  - 위치: `.claude/tests/test_report_paths_shared.py:23-25` (`load_module_by_path("_shared_report_paths", ...)`) vs `review_guard.py`의 일반 `from _shared import report_paths` (`sys.modules["_shared.report_paths"]`)
  - 상세: 동일 파일이 `sys.modules`에 `_shared.report_paths`와 `_shared_report_paths` 두 키로 각각 다른 모듈 객체로 로드된다. 모듈에 mutable 전역 상태가 없어(순수 함수만 존재) 현재는 무해하며, `AgreementTest`는 실제로 서브프로세스(CLI)와 review_guard 양쪽을 각각 실행해 비교하므로 이 이중 로드 자체가 테스트 신뢰성에 영향을 주지 않는다.
  - 제안: 조치 불필요. 향후 이 모듈에 캐시 등 mutable 모듈급 상태가 추가되면 그때 재검토.

- **[INFO]** 프런트엔드 sidebar 테스트 헬퍼 추출 — 부작용 타이밍 동일, 신규 위험 없음
  - 위치: `codebase/frontend/src/components/layout/__tests__/sidebar-test-utils.tsx`(신규), `sidebar.test.tsx`/`sidebar-nav-href.test.tsx`(호출부 교체)
  - 상세: `stubMatchMedia()`가 각 테스트 파일의 모듈 최상위(import 직후)에서 호출되어 jsdom의 `window.matchMedia`를 전역 mock으로 교체한다. 이는 리팩터 이전에도 각 파일에 인라인으로 동일 시점에 존재하던 부작용이며, 공유 헬퍼로 추출됐을 뿐 호출 타이밍·전역 대상은 변경되지 않았다. Vitest 기본 설정은 테스트 파일별로 모듈 레지스트리를 격리하므로 두 파일 간 교차 오염도 없다.
  - 제안: 조치 불필요.

## 요약

핵심 변경은 세 곳(push/stop 게이트, code-review 오케스트레이터, consistency 오케스트레이터)에 독립적으로 존재하던 "리포트가 어디 있고 무엇을 리포트로 칠 것인가" 로직을 `.claude/_shared/report_paths.py` 단일 모듈로 통합한 것으로, 실제로 발생했던 게이트↔CLI 판정 드리프트(빈 리포트에 대해 CLI는 통과·게이트는 차단)를 근본적으로 제거한다. `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`로 harness 전체 265건을 재실행해 회귀 없음을 실측했고, 신규 `AgreementTest`는 실제 서브프로세스 CLI 호출과 실제 게이트 함수를 나란히 비교해 "둘이 다시는 갈라지지 않는다"를 직접 검증한다. 다만 부작용 관점에서 두 가지는 유의미하다: (1) `review_guard.py`가 처음으로 무보호(try/except 없는) 외부 의존성을 갖게 되어, `_shared` 패키지에 문제가 생기면 forced-coverage 서브체크만이 아니라 review 게이트 전체(push 차단 + stop nudge + resolution-in-flight 억제)가 두 호출자의 기존 broad-except로 인해 조용히 통째로 disable되는 방향으로 장애 반경이 넓어졌다("Fail loudly" 주석의 실제 관측 효과는 반대에 가깝다). (2) 오케스트레이터 CLI의 "존재만"→"존재+비어있지 않음" 전환은 의도된 수정이지만 이미 커밋된 과거 세션 데이터의 판정을 소급 변경하며, 조회성 커맨드(`--summary-state`/`--resume`)의 기존 self-heal 쓰기 메커니즘이 발동하는 세션 범위를 넓힌다 — CI 자동화 대상은 아니라 실질 폭발 반경은 낮다. 시그니처·공개 인터페이스는 대부분 하위호환(`_report_paths(session_dir, state)` 등 thin delegate 유지)이며, 환경변수·네트워크 호출·이벤트/콜백 관련 신규 부작용은 발견되지 않았다.

## 위험도

LOW
