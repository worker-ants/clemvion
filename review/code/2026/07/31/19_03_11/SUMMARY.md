# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 확보된 13개 reviewer 기준 CRITICAL 0건, WARNING 10건. 핵심은 이번 PR 의 표제 기능(Critical 하향 판정을 조용히 넘기지 않고 advisory 로 드러내는 backstop)이 **완결되지 않은 롤아웃**이라는 점이다: 그 advisory 가 push 가드에만 배선되고 Stop 가드는 계산만 하고 버리며(3개 reviewer 독립 confirm), 그 배선 자체를 보호하는 테스트도 없다(뮤테이션으로 실측: 배선을 통째로 지워도 735/735 GREEN). 여기에 `summary_block_verdict` 의 순서-의존 오탐이 코드로 직접 재현됐고, `str.removesuffix()` 로 인한 암묵적 최소 Python 버전 상향, `_retry_state.json` non-atomic write 등이 더해진다. 어느 것도 하드 게이트(push BLOCK/ALLOW)의 최종 판정 자체를 그르치지는 않는다.

> **결과 미확보 경고 (위험도 판정에 미반영)**: `architecture` reviewer 는 상태가 `no_status`이며, 인라인 전문·디스크 파일(`architecture.md`) 이 **모두 존재하지 않는다** (`_prompts/architecture.md` 는 입력 프롬프트일 뿐 결과가 아님 — 직접 확인). router_safety 강제 화이트리스트 대상(`documentation, maintainability, requirement, scope, security, side_effect, testing`)은 아니어서 강제 목록 위반은 아니지만, 레이어링·모듈 경계·의존 방향 등 architecture 관점은 이 SUMMARY 에 전혀 반영되지 못했다. 위 MEDIUM 판정은 이 공백을 반영하지 못한 **잠정치**이며, architecture 리뷰가 CRITICAL 을 낼 가능성을 배제할 수 없다. **재시도 필요.**

## Critical 발견사항

없음 (13개 reviewer 중 CRITICAL 0건).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 기능완결성 | 신설 하향-모순 advisory(`ReviewDecision.notes`)가 push 가드에만 배선되고, Stop 가드(`guard_review_before_stop.py`)는 동일한 `evaluate_review()` 를 호출해 같은 notes 를 계산하고도 전혀 읽지 않아 조용히 버려진다. Stop 훅 자신의 docstring 은 "push 게이트보다 먼저, 턴 종료 시점에 잡는다"고 명시하므로 가장 유용할 시점에 정확히 비어 있다. 채택된 세션이 다음 push 전 더 최신 세션으로 대체되면 지연이 아니라 **영구 유실**도 가능(requirement 분석). 신설 기능이라 회귀는 아니나 "불완전한 롤아웃"(side_effect, requirement, documentation 3건 독립 일치). | `.claude/hooks/guard_review_before_stop.py` (notes 전체 미참조, grep 0건) vs `.claude/hooks/guard_review_before_push.py:733-750`(`_report_notes`, 여기만 배선) | Stop 가드에도 `decision.notes` 출력 배선 추가 — **항상 stderr** 고정(Stop 훅 stdout 은 `{"decision":...}` JSON 프로토콜 전용이라 push 의 "exit code 로 스트림 선택" 로직을 그대로 복사하면 안 됨, `_report_fail_open` 선례 재사용). 의도된 축소라면 최소한 `evaluate_review`/`ReviewDecision.notes` docstring 과 plan 문서에 그 이유를 명시. |
| 2 | 테스트 커버리지 | 신설 notes 배선(`_evaluate_over_targets` 의 수집·dedup → `outcome.notes` → `_report_notes`) 의 중간 단계를 검증하는 테스트가 전무. **뮤테이션으로 직접 확인**: 847~859행(notes 수집 블록 전체)을 삭제한 뒤 전체 735개 테스트 실행 — 전원 GREEN(원복 완료). 이 PR 이 고치는 결함의 정의("한 단계 아래에서 조용히 통과하던 것을 잡는다")가 그 자신의 새 코드에서 한 단계 위로 재발할 수 있는 상태(testing, requirement 2건 일치). | `.claude/hooks/guard_review_before_push.py:846-859` (`_evaluate_over_targets`) | `_evaluate_over_targets`를 `notes` 필드를 가진 실물 `ReviewDecision`/비-스텁 `Outcome` 으로 호출해 채워짐/dedup 을 직접 단언하는 테스트 추가. `test_guard_review_before_push_main.py`의 `_Decision` stub 에도 `notes` 필드를 넣어 end-to-end(stdout 실제 출력) 케이스 보강. |
| 3 | 결함 재현 | `summary_block_verdict`의 좌측-최우선(leftmost) 매칭 앵커링이 override-배너가 stale 판정보다 **앞**에 오는 순서만 fixture 로 커버돼 있고, **반대 순서에서는 실제로 틀린 값**(최종 판정이 아니라 stale 값)을 반환함을 코드로 직접 재현: `"**BLOCK: YES**(초기)\n\n> 최종 판정: **BLOCK: NO**\n"` → 함수가 `'YES'` 반환. | `.claude/_shared/block_integrity.py:89-100`(`summary_block_verdict`)/`:54-58`(`_BLOCK_LINE`), 테스트 `test_block_integrity.py::VerdictIsAnchoredTest` | override 배너가 stale 판정 **뒤**에 오는 fixture(값도 반대로) 추가해 의도 확정. 의도(항상 override 가 위에 옴)라면 docstring 에 전제 명시+테스트로 고정, 아니면 마지막 매치 우선 등 순서-불변 규칙으로 수정. |
| 4 | 의존성/이식성 | `str.removesuffix()`(Python ≥3.9 전용)이 이 harness Python 트리에서 **처음** 사용되어, 명시된 바 없는 최소 런타임 버전을 암묵적으로 끌어올림(`.python-version`/`pyproject.toml`/lockfile 없음, CI 는 `3.x` 만 지정). 구버전 `python3`(≤3.8)에서는 `AttributeError` 발생 — `_evaluate_over_targets` 의 광범위 `try/except Exception` 으로 fail-open 되어 하드 크래시는 아니지만, 그 결과는 "이 PR 이 추가하는 경고 1건 누락"이 아니라 **REVIEW/PLAN 게이트 전체가 해당 push 에 대해 조용히 무력화**되는 것이라 이 파일이 막으려는 바로 그 "silent" 클래스의 축소판이 재발. | `.claude/_shared/block_integrity.py:126` (`contradiction_note()` 내 `f"{k.removesuffix('.md')}={v}"`) | `k[:-3] if k.endswith(".md") else k` 로 버전-무관 표현 교체. 또는 harness 최소 Python 버전을 3.9+ 로 공식 채택하고 README/CI 에 명시(이 경우 "any bare python3" 전제 전체 재검토 필요). |
| 5 | 동시성 | `_retry_state.json` 공유 상태 파일의 read-modify-write 가 원자적이지 않음(락도 atomic rename 도 없음). 동시 `--update` 프로세스 발생 시 (a) lost-update(나중에 쓴 쪽이 이겨 앞선 전이·history 소실), (b) `open(mode="w")` truncate 직후/스트리밍 도중을 읽어 `JSONDecodeError` 크래시(방어 없음) 가능. 이번 diff 의 신규 결함은 아님(byte-identical 추출, 3개 orchestrator 중복 로직을 그대로 이관) — 다만 세 소비자가 한 구현으로 모인 지금이 한 번에 고칠 수 있는 가장 싼 시점. 주경로(`Workflow` tool)는 이 CLI 를 거치지 않고, code-review/consistency 오케스트레이터는 `reconcile_state_with_disk` 로 완충됨. | `.claude/_shared/retry_state.py:41-52`(`load_state`/`save_state`), `:138-167`(`apply_status_update`) | `save_state()` 를 `tempfile.NamedTemporaryFile`+`os.replace()` atomic write 로 교체해 최소한 "쓰다 만 파일을 읽고 크래시"하는 창을 제거. lost-update 자체는 이 프로젝트의 기존 컨벤션(락 대신 `reconcile_state_with_disk` 류의 수렴)에 맡기는 것이 일관적. |
| 6 | 문서 정확성 | `merge_coordinator_orchestrator.py`의 `_apply_status_update`가 `_shared/retry_state.apply_status_update`와 **완전히 동일한 로직**(branch/base 미참조, 텍스트 정규화 diff 로 확인)인데도 "branch/base 를 다뤄 다르다"는 **사실과 다른** 주석 때문에 위임되지 않고 세 번째 사본으로 남음. 이 잘못된 근거가 plan 문서 항목 #9 에도 그대로 옮겨져, 향후 이 파일을 만지는 사람이 "이미 다르다고 확인됐다"고 오인할 위험. | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-109`(주석), `:118`(`_apply_status_update`) | `_apply_status_update`를 `_retry_state_lib.apply_status_update(...)` 로 위임하고, 주석의 "branch/base 로 다르다" 서술을 `_emit_summary_state` 에만 한정하도록 정정. plan 문서 항목 9 도 함께 정정. |
| 7 | 문서 정확성 | `retry_state.py`의 `emit_summary_state` 안에서 `extra_fields` 허용 타입에 대한 두 설명이 서로 모순 — 상단 docstring 은 "callable 또는 **일반 dict** 도 가능"이라 하고, 같은 함수 내부 인라인 주석은 "dict 를 넘기면 이 파일이 막 고친 것과 같은 클래스의 회귀(조율 알림 소실)를 재현한다"고 서술. 실제 구현(`extra_fields(state) if callable(...) else extra_fields`)은 dict 분기를 여전히 허용하지만 어떤 테스트도 그 경로를 커버하지 않음(양쪽 호출부 모두 콜러블만 사용). | `.claude/_shared/retry_state.py:99`(상단 docstring), `:124-129`(인라인 주석) | 둘 중 하나로 통일: (a) dict 지원을 유지한다면 "언제 안전한지"(state 비의존 정적 값일 때만)를 상단에 명시하고 테스트로 그 경로도 고정, 또는 (b) 콜러블 전용이 의도라면 상단 문구 제거+dict 분기 제거/명시적 거부. |
| 8 | 문서 정확성 | 공유 모듈로 추출하며 `apply_status_update` 가 원래 갖고 있던 한 줄 독스트링(`"""Move agent between pending/success/fatal buckets and record history."""`)을 유실. 같은 파일의 `reconcile_state_with_disk`/`emit_summary_state` 는 독스트링을 유지해 비대칭 — 이제 3개 orchestrator 중 2곳이 공유하는 SSOT 라 개별 사본보다 오히려 더 문서화가 필요한 위치. | `.claude/_shared/retry_state.py:138` | 원본 한 줄 독스트링 복원. |
| 9 | 문서 정확성 | 이 diff 로 `review_guard.py`(정확히는 `_shared/block_integrity.py`)가 SUMMARY 의 `BLOCK:` 값과 각 checker `[CRITICAL]` 개수를 실제로 대조하게 됐는데, 인접한 두 문서(`consistency-checker/SKILL.md`§4, `.claude/agents/consistency-summary.md`)는 여전히 "게이트는 `BLOCK:` 한 줄만 파싱하므로 하향이 게이트를 통과시킨다"고 서술 — 결론(하향이 여전히 차단으로 이어지지 않음)은 유효하지만 메커니즘 서술("한 줄만 파싱")은 더 이상 정확하지 않음(requirement, documentation 2건 일치, documentation 이 두 문서 모두 지목해 더 포괄적). | `.claude/skills/consistency-checker/SKILL.md:114`, `.claude/agents/consistency-summary.md:49-51` | "판정 자체는 BLOCK 한 줄로 내려지지만, 게이트가 이제 그 판정과 checker 리포트의 모순을 감지해 경고를 낸다(차단은 아님)"로 갱신, 또는 최소한 plan 후속 항목으로 등재. |
| 10 | 테스트 카탈로그 정확성 | `README.md` 신규 행과 `test_retry_state_shared.py` 모듈 독스트링이 "`--summary-state`/`--update` CLI 계약을 검증한다"고 서술하지만, 실제로 이 파일에는 `--update` 참조가 **0건**이다(`_run()` 헬퍼는 `--summary-state` 만 하드코딩). `--update` 는 전체 스위트에서 `test_orchestrator_state.py` 하나뿐. `test_tests_readme_catalog.py` 는 행의 존재만 확인하고 서술 정확성은 검증하지 않아 이 과장이 통과됨. | `.claude/tests/README.md:61`, `.claude/tests/test_retry_state_shared.py:10,56-58` | README/독스트링 서술을 `--summary-state` 로 좁히거나, `consistency_orchestrator.py --update` 를 구동하는 subTest 를 추가해 서술을 사실로 만든다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 가드 견고성 | `review_guard.py` 가 신규 모듈 `_shared/block_integrity` 를 로컬 `try/except` 없이 import — import 실패 시 REVIEW 하드 블로커 전체가 fail-open 되는 SPOF 표면이 소폭 확대(기존 §E fail-open 관측/배너 정책으로 이미 완화, 조치 불요). | `.claude/hooks/_lib/review_guard.py:131` | 현행 유지(기록 목적). `block_integrity.py` 는 순수 함수만 담아 실패 표면이 작고 자체 테스트로 보호됨. |
| 2 | 백로그/추적 | `merge_coordinator_orchestrator.py`는 여전히 `reconcile_state_with_disk` 자기치유가 없고 `_load_state`/`_save_state`만 부분 위임 — 다른 두 orchestrator는 이번 PR로 완전 위임. 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 #9에 별도 PR로 명시적 defer 등재(4개 reviewer 각기 확인, 새 발견 아님). `subagent-call-contract.md`의 "자가 reconcile" 일반 서술도 이 orchestrator에는 적용 안 됨(같은 갭의 문서 반영 누락). | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85-147`, `.claude/docs/subagent-call-contract.md:120` | 항목 #9 후속 PR에서 함께 처리. |
| 3 | 테스트 커버리지 | `merge_coordinator_orchestrator.py`에서 이번에 실제로 바뀐 `_load_state`/`_save_state` 위임 자체를 구동하는 테스트가 0건(수동 스모크로만 정상 확인). | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:110-115` | `test_retry_state_shared.py`에 세 번째 subject(merge-coordinator, branch/base 포함 간단 상태)로 subTest 추가. |
| 4 | 가독성/컨벤션 | `merge_coordinator_orchestrator.py`에서 함수 정의 순서가 "정의 후 사용" 관례를 깨 `_emit_summary_state`(85행, `_load_state` 호출)가 `_load_state` 정의(110행)보다 먼저 나옴. 런타임 오류는 없으나 다른 두 orchestrator·`retry_state.py` 자체의 순서와도 어긋남. | `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85` vs `:110` | `_load_state`/`_save_state` 정의를 `_emit_summary_state` 위로 이동. |
| 5 | Rationale 유실 | 목적이 명시된 리팩터 커밋(`7b54b088a`) 안에서, 커밋 메시지가 언급하지 않는 별도 변경으로 `_routing_distrust_reason` 의 2026-07-23 사고 이력 rationale 주석 블록이 삭제됨(`git log -S` 로 확인, origin/main 에는 있고 HEAD 에는 없음). 내용은 `test_router_decision_trust.py`/README 요약으로 일부 남아 있으나, 정작 판단을 구현한 함수 바로 위에는 근거가 사라짐. | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:277` | `_routing_distrust_reason` docstring 에 "왜"의 한 줄 요약(사고 세션 ID 참조) 복원. |
| 6 | 주석 비대칭 | `evaluate_review()`의 Gate 2 세 반환 지점 중 notes 전달이 비대칭(allow 경로만 채움)인데 그 의도가 주석으로 설명돼 있지 않음 — 이 파일의 다른 모든 분기가 "왜"를 촘촘히 남기는 스타일과 대비. | `.claude/hooks/_lib/review_guard.py:969-998` | block 반환문 중 하나에 "notes 는 allow 경로 전용" 한 줄 코멘트 추가. |
| 7 | 테스트 패턴 확산 | `test_block_integrity.py`가 "`_lib` 네임스페이스 충돌 회피 fresh-subprocess-interpreter" 패턴의 5번째 변형을 추가(더 작은 인라인 스니펫이나 동일 계열). 이미 plan 항목 #10 이 이 계열 4개 파일의 통합 추출을 제안 중이라 그 대상 후보에 포함됨. | `.claude/tests/test_block_integrity.py:66` | 항목 #10 착수 시 이 파일도 통합 대상에 포함. |
| 8 | 문서 완결성 | 두 훅(`guard_review_before_push.py`, `review_guard.py`)의 최상단 Contract/Policy docstring 이 관측 가능한 신호를 상세히 열거하는 관례를 갖고 있는데, 신설된 세 번째 채널(하향-모순 advisory)은 함수 수준 주석에만 있고 최상단에는 한 줄도 없음(정확성 문제 아닌 생략). | `.claude/hooks/guard_review_before_push.py:2-41`, `.claude/hooks/_lib/review_guard.py:1-89` | "Contract" 절 끝에 "ALLOW 시 stdout 으로 하향-모순 advisory 가 추가될 수 있다" 한 줄 추가. |
| 9 | 테스트 커버리지 | `_CRITICAL_TAG` 정규식(`re.compile(r"\[CRITICAL\]")`, IGNORECASE 없음)의 대소문자 민감성이 명시적으로 테스트되지 않음 — `[critical]` 소문자 변형은 조용히 미검출(실 위험은 낮음, 리뷰어 출력 형식이 강제되어 있어서). | `.claude/_shared/block_integrity.py:40` | `[critical]`(소문자) 이 의도적으로 0 카운트됨을 단언하는 1줄 테스트 추가. |
| 10 | 동시성 테스트 | `_retry_state.json`에 대한 **진짜 동시** 프로세스 호출을 재현하는 테스트가 없음(기존 테스트는 순차 2회 실행만). 이 프로젝트는 다른 곳(`test_bootstrap_mermaid_install.py::test_concurrent_cold_start_converges_and_then_stops_reinstalling`)에서 이미 이 패턴(락 없이도 수렴하는지 실제 동시 서브프로세스로 고정)을 쓴 전례가 있음. | `.claude/tests/test_retry_state_shared.py` | 서로 다른 agent 이름으로 두 프로세스가 동시에 `--update` 를 호출해도 두 업데이트가 모두 살아남는지 고정하는 회귀 테스트 1개 추가. |
| 11 | 스코프 판단 기준 | 브랜치가 표제 기능(하향 금지 backstop)과 인접 리팩토링(`retry_state.py` 추출)을 한 PR 에 묶었으나, 사전 실측 근거(AST 비교)·기존 추출 선례(`report_paths.py`)·전용 회귀 테스트·인접 확장(merge-coordinator 자기치유)의 의도적 defer 가 모두 갖춰져 있어 허용 가능한 스코프로 판단(조치 불요). | `.claude/_shared/retry_state.py:1-29`, `code_review_orchestrator.py`/`merge_coordinator_orchestrator.py` 전체 diff | 향후 유사 상황에서 같은 3가지 기준(사전 실측·명시적 defer·전용 테스트)을 절단선으로 계속 요구. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CRITICAL/WARNING 없음. `block_integrity` 비보호 import 로 SPOF 표면 소폭 확대(기완화, INFO). 신규 advisory 문자열은 프롬프트 인젝션 경로 없음(확인). |
| performance | NONE | 회귀 없음. N+1 형태 반복은 고정 5개 checker 목록에 유계, dedup 도 실무 규모에서 무해. backstop 자체가 "게이트가 채택하는 세션 1개만 검사"하도록 실측 근거(+0.39초 비교)로 설계됨. 실측 테스트 5종 전부 초 단위. |
| architecture | **결과 없음(no_status)** | 인라인 전문·디스크 파일(`architecture.md`) 모두 부재 — **재시도 필요**. router_safety 강제 목록 대상 아님. |
| requirement | MEDIUM | Stop 가드가 notes 를 전혀 안 읽어 영구 유실 가능(WARNING 1) + 배선 자체 무테스트(WARNING 2) + SKILL.md 서술 낡음(WARNING 9). 핵심 backstop 로직 자체는 의도대로 구현·735건 전체 스위트 통과 확인. |
| scope | LOW | 기능+리팩토링 혼합이나 사전 실측·명시적 defer·전용 테스트 모두 갖춰 허용 범위(INFO 11). 무관 영역·포맷팅 전용 변경·미사용 임포트 없음. |
| side_effect | LOW | notes advisory 가 push 전용, Stop 은 계산만 하고 버림(WARNING 1 에 병합, 신규 기능이라 비회귀). 그 외 부작용(전역 상태·env·네트워크) 신규 도입 없음, 735건 통과. |
| maintainability | LOW | `merge_coordinator._apply_status_update` 미위임 근거가 사실과 다름(WARNING 6) + `emit_summary_state` docstring 자기모순(WARNING 7). 나머지는 가독성·rationale 유실 수준 INFO 4건. |
| testing | MEDIUM | notes 배선을 뮤테이션으로 무방비 확인(WARNING 2) + `summary_block_verdict` 순서-의존 버그 코드로 재현(WARNING 3) + `--update` 커버리지 과장 서술(WARNING 10). 신규 파일 자체 테스트 품질은 높음(실제 회귀 픽스처, addCleanup 격리). |
| documentation | LOW | `apply_status_update` 독스트링 유실(WARNING 8) + Stop 배선 누락이 문서화 안 됨(WARNING 1 관련) + SKILL.md/consistency-summary.md 서술 낡음(WARNING 9). 신규 모듈 자체 docstring 품질(측정치 인용)은 높음. |
| dependency | LOW | `str.removesuffix()` 로 암묵적 Python ≥3.9 요구(WARNING 4, fail-open 으로 완충되나 게이트 전체 무력화 재발 클래스). 신규 외부 의존성 0건. |
| database | NONE | DB/SQL/ORM/마이그레이션 관련 코드 없음. |
| concurrency | LOW | `_retry_state.json` non-atomic write(WARNING 5, 비회귀·통합 시점이 최적 수정 기회) + 동시성 재현 테스트 부재(INFO 10). 스레드/락 자체는 코드베이스 어디에도 없어 데드락 가능성 없음. |
| api_contract | NONE | HTTP/REST API 표면 변경 없음(전부 harness 로컬 CLI/훅). |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 어디에도 매칭 없음(codebase/spec 미변경). |

## 발견 없는 에이전트

database, api_contract, user_guide_sync — 명시적으로 "해당 없음"/"발견사항 없음" 보고.

## 권장 조치사항

1. **(최우선) `architecture` reviewer 재실행** — 이 SUMMARY 에서 유일하게 결과가 완전히 부재한 관점이며, 재시도 전까지 전체 위험도 판정은 잠정치.
2. `guard_review_before_stop.py` 에 `decision.notes` 출력 배선 추가(항상 stderr 고정) — 이 PR 의 핵심 목적(하향 판정 침묵 제거)이 턴 종료 시점(가장 이른 시점)에는 여전히 미완성.
3. `_evaluate_over_targets` 의 notes 수집·dedup 배선에 실제(비-스텁) `ReviewDecision`/`Outcome` 기반 테스트 추가 — 현재 뮤테이션으로 무방비 확인됨.
4. `summary_block_verdict` 에 override-배너가 stale 판정 **뒤**에 오는 반대 순서 fixture 추가 — 현재 그 순서에서 틀린 값을 반환함을 코드로 재현.
5. `str.removesuffix()` 를 `k[:-3] if k.endswith(".md") else k` 등 버전-무관 표현으로 교체(또는 harness 최소 Python 버전을 3.9+ 로 공식 채택·README/CI 에 명시).
6. `merge_coordinator_orchestrator.py` 의 `_apply_status_update` 를 `_shared/retry_state.py` 로 위임하고, "branch/base 로 다르다" 는 사실과 다른 주석과 plan 문서 항목 #9 를 정정.
7. `_retry_state.json` 의 `save_state()` 를 `tempfile`+`os.replace()` atomic write 로 교체.
8. (낮은 우선순위, 일괄 처리 가능) 문서 정확성 3건 — `apply_status_update` 독스트링 복원, `consistency-checker/SKILL.md`·`consistency-summary.md` 의 "BLOCK 한 줄만 파싱" 서술 갱신, `README.md`/`test_retry_state_shared.py` 의 `--update` 커버리지 과장 서술 정정.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 사유: `--route=all`. 전체 reviewer(14명) 실행.
- 참고(보조 정보, routing 스킵과 무관하게 별도 계산됨): **강제 포함(router_safety)** = `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨. 제외(skipped) 없음(`agents_skipped=[]`).
- 위 강제 목록에 없는 `architecture` 가 유일하게 결과 미확보 상태로 남아 있으며, 이는 forced 화이트리스트 위반은 아니지만 §전체 위험도에 명시한 대로 재시도가 필요하다.