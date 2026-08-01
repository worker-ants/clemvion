# Maintainability Review — harness review-gate backstop (block_integrity / retry_state 공유화)

## 발견사항

- **[WARNING]** `merge_coordinator_orchestrator.py`의 `_apply_status_update`가 `_shared/retry_state.apply_status_update`와 완전히 동일한 로직인데도 위임되지 않고 세 번째 사본으로 남아 있고, 그 이유를 설명하는 주석이 사실과 다르다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-109`(주석), `:118`(`_apply_status_update` 정의)
  - 상세: 주석은 "`_apply_status_update` 와 `_emit_summary_state` 는 branch/base 를 다뤄 다르다"고 주장하지만, 실제로 `_apply_status_update`는 `agents_pending/success/fatal` 버킷·`rate_limit_episodes`·`agent_history`만 다루며 branch/base를 전혀 참조하지 않는다. 헬퍼 이름(`load_state`/`save_state` vs `_load_state`/`_save_state`)만 바꿔서 `_shared/retry_state.py`의 `apply_status_update`와 텍스트 비교하면 완전히 동일하다(직접 정규화 diff로 확인, 차이 0). branch/base를 실제로 다루는 함수는 `_emit_summary_state` 뿐이다. 이 refactor 자체가 "두 orchestrator가 'Change both' 주석으로 사본을 유지하다 실제로 갈라진" 문제를 없애려는 것인데, 바로 그 패턴(잘못된 근거로 정당화된 미위임 사본)이 세 번째 파일에 새로 만들어졌다. 이 잘못된 근거는 `plan/in-progress/harness-review-gate-ci-backstop.md`의 후속 항목 9에도 그대로 옮겨 적혀 있어, 향후 이 파일을 만지는 사람이 "이미 다르다고 확인됐다"고 오인해 손대지 않을 위험이 있다.
  - 제안: `_apply_status_update`도 다른 두 orchestrator처럼 `return _retry_state_lib.apply_status_update(session_dir, agent, status, reset_hint)`로 위임하고, 주석에서 "branch/base 로 다르다"는 서술을 `_emit_summary_state`에만 한정해 정정한다. plan 문서의 항목 9도 함께 정정.

- **[WARNING]** `_shared/retry_state.py`의 `emit_summary_state` 안에서 `extra_fields`의 허용 타입에 대한 두 설명이 서로 모순된다.
  - 위치: `.claude/_shared/retry_state.py:99`(함수 docstring), `:124-129`(같은 함수 내부 인라인 주석)
  - 상세: 함수 상단 docstring(99행)은 "`extra_fields` 는 `state -> mapping` (or a plain mapping)"이라고 해서 콜러블뿐 아니라 **일반 dict도 유효한 입력**이라고 명시한다. 그런데 같은 함수 내부, 그 값을 실제로 소비하는 코드 바로 위 주석(124-129행)은 "A callable, not a dict: ... Passing a pre-built dict [caused] this function's own reconcile [to find] nothing left to do — which silently swallowed the '(reconciled …)' notice"라고 해서, dict를 넘기는 것 자체가 이 파일이 막 고친 회귀(조율 알림 소실)를 재현하는 잘못된 사용법인 것처럼 서술한다. 같은 함수, 같은 커밋에서 작성된 두 문장이 "dict 도 된다"와 "dict 는 안 된다"로 정반대를 말하고 있다. 실제 구현(`extra_fields(state) if callable(extra_fields) else extra_fields`)은 dict 분기를 여전히 허용하며, 이 분기는 현재 어떤 테스트에도 커버되지 않는다(두 호출부 모두 콜러블만 사용). 향후 누군가 상단 docstring만 보고 정적 dict를 넘기면, 그 dict가 reconcile 이전 상태에 의존해 만들어졌을 경우 이 파일이 방금 고친 것과 같은 클래스의 회귀(알림 소실)를 조용히 재현할 수 있다.
  - 제안: 두 서술 중 하나로 통일한다 — (a) dict 지원을 의도적으로 유지한다면 "언제 dict가 안전한지"(state에 의존하지 않는 정적 값일 때만)를 상단 docstring에 명시하고 테스트로 그 경로도 고정, 또는 (b) 콜러블만 지원하는 게 진짜 의도라면 상단 docstring에서 "or a plain mapping" 문구를 제거하고 dict 분기 자체를 제거(또는 타입 체크로 명시적 거부).

- **[INFO]** `merge_coordinator_orchestrator.py`에서 함수 정의 순서가 "정의 후 사용" 관례를 깨고 있다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85`(`_emit_summary_state` 정의, `_load_state` 호출) vs `:110`(`_load_state` 정의)
  - 상세: 리팩터로 `_load_state`/`_save_state`가 파일 뒤쪽으로 옮겨지면서, 이미 존재하던 `_emit_summary_state`(85행, `_load_state`를 호출)가 이제 `_load_state`의 정의(110행)보다 **먼저** 나온다. Python은 호출 시점에 이름을 resolve하므로 런타임 오류는 없지만, 위에서 아래로 읽는 독자는 아직 정의되지 않은 이름의 호출을 먼저 마주치게 된다. `_shared/retry_state.py`(load→save→reconcile→emit→apply 순) 및 다른 두 orchestrator의 기존 순서와도 어긋난다.
  - 제안: `_load_state`/`_save_state` 정의를 `_emit_summary_state` 위로 옮겨 파일 내 다른 두 orchestrator와 동일한 "정의 후 사용" 순서를 회복.

- **[INFO]** 무관한 refactor 커밋이 `_routing_distrust_reason`의 사고이력 rationale 주석을 부수적으로 삭제했다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:277`(`_routing_distrust_reason` 정의부 — 삭제 전에는 이 위 약 16줄에 "Why (measured 2026-07-23, session 14_47_40)…" 사고 기록이 있었음)
  - 상세: 커밋 `7b54b088a`("상태 bookkeeping 5종을 `_shared/retry_state.py` 로")의 diff에서, 커밋 메시지가 언급하지 않는 별도 변경으로 이 rationale 블록 전체가 삭제됐다(`git log -S "Why (measured 2026-07-23, session 14_47_40)"` 로 확인 — origin/main 에는 있고 이 브랜치 HEAD 에는 없음). 내용은 완전히 유실되지 않았다 — `.claude/tests/README.md`(`test_router_decision_trust.py` 행)와 `test_router_decision_trust.py` 자신의 모듈 docstring에 요약이 남아 있다. 다만 정작 그 판단을 코드로 구현한 함수 바로 위에서는 이제 짧은 docstring("Shared shape with ai-review.js…")만 남아, 코드를 직접 읽는 사람은 "왜 이 규칙이 이렇게 엄격한가"의 근거(2026-07-23 라우터가 14명 전원을 selected=false 로 낸 실측 사고)를 그 자리에서 알 수 없다. 이 프로젝트가 rationale 주석의 정확성·존속에 두는 비중(전용 `rationale_continuity` 체커, 모든 새 파일의 "measured X" 스타일 docstring)에 비추어 볼 때, 목적이 명시된 리팩터 커밋 안에 이런 무관한 삭제가 설명 없이 섞여 들어간 것은 리뷰 시 놓치기 쉬운 형태의 스코프 누출이다.
  - 제안: 향후 유사 refactor에서는 "Change both" 블록 이동/삭제와 무관한 rationale 주석은 별도로 유지하거나, 불가피하게 옮길 경우 커밋 메시지에 명시. 지금 당장은 최소한 `_routing_distrust_reason` docstring에 "왜"의 한 줄 요약(사고 세션 ID 참조)을 되살리는 것을 권장.

- **[INFO]** `evaluate_review()`의 Gate 2 세 반환 지점 중 `notes` 전달이 비대칭이며, 그 이유가 주석으로 남아 있지 않다.
  - 위치: `.claude/hooks/_lib/review_guard.py:969-978`(impl-done 세션 없음 → block, notes 미전달), `:979-986`(impl-done 세션이 stale → block, notes 미전달), `:988-998`(허용 → `tuple(notes)` 전달)
  - 상세: `_newest_resolved_impl_done_mtime(repo_root, dirty, notes)`(968행)는 채택된 세션이 있으면 `notes`를 채울 수 있다. 세션이 아예 없는 경우(969행 분기)는 `best_dir`가 항상 비어 있어 `notes`가 채워질 수 없으므로 무해하지만, **stale 분기(979행)는 채택된 세션이 실제로 존재하는 경우**이며 그 세션이 자기 checker와 모순되더라도(`[CRITICAL]` 하향) 그 사실이 담긴 `notes`가 이 반환문에는 실려 있지 않다 — `ReviewDecision(True, f"...")`로 2-인자만 구성되어 `notes` 기본값 `()`로 떨어진다. 이 파일의 다른 모든 분기·주석이 "왜"를 촘촘히 설명하는 스타일과 비교하면, 정확히 이 두 곳만 "notes를 의도적으로 버린다"는 설명이 없다. `_report_notes`/`_newest_resolved_impl_done_mtime`의 주석들이 이 메커니즘을 "allow path" 전용이라고 일관되게 서술하고 있어 의도된 설계일 가능성이 높지만(그렇다면 실제로 문제는 아님), 그 판단이 코드에 적혀 있지 않아 다음 라운드 리뷰나 유지보수자가 "이거 버그 아닌가"로 다시 질문하게 만든다.
  - 제안: 두 block 반환문 중 하나에 "notes는 allow path 전용이라 block 시에는 실지 않는다(재실행이 어차피 필요하므로)" 같은 한 줄 코멘트를 추가해 의도를 고정.

- **[INFO]** `test_block_integrity.py`가 "hooks/skills `_lib` 네임스페이스 충돌을 피하는 fresh-subprocess-interpreter" 패턴의 또 다른(5번째) 변형을 새로 추가한다.
  - 위치: `.claude/tests/test_block_integrity.py:66`(`test_orchestrator_derives_its_list_from_here`)
  - 상세: 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 항목 10이 `test_consistency_context_budget`·`test_consistency_bundle_priority`·`test_prompt_omission_notice`·`test_review_changeset_warning` 4개 파일에 복제된 `run_in_orchestrator`+`_PREAMBLE`(~35줄) 보일러플레이트를 `_harness.py`로 추출할 것을 제안하고 있다. 이번 PR이 추가한 `test_orchestrator_derives_its_list_from_here`는 그 4개와 정확히 같은 헬퍼를 재사용하진 않지만(더 작고 단발성인 `importlib.util.spec_from_file_location` 인라인 스니펫), 목적(같은 `_lib` 충돌 회피)과 형태(subprocess + 문자열 코드)는 동일 계열이다. 새 파일이 이 계열의 변형을 하나 더 늘렸다는 점에서, 이미 등록된 추출 작업의 근거가 됨.
  - 제안: 새 결함은 아니며 즉시 조치 불요 — 향후 item 10 착수 시 이 파일도 같은 헬퍼로 통합 대상에 포함.

## 요약

이번 diff는 `block_integrity.py`(Critical 하향 감지 backstop)와 `retry_state.py`(다섯 함수 공유화)라는 두 개의 신규 공유 모듈을 잘 설계된 형태로 도입했다 — 함수는 짧고 단일 책임이며, 네이밍이 목적을 정확히 드러내고, 매직 넘버가 없고, "measured X" 스타일의 근거 docstring이 이 프로젝트의 기존 관례를 그대로 따른다. 두 신규 테스트 파일도 관례(클래스별 관심사 분리, `_harness` 헬퍼 재사용, 명확한 테스트명)를 잘 지키며, 하네스 전체 테스트(735건)가 통과해 회귀는 없다. 다만 3개 orchestrator에 흩어져 있던 로직을 한 곳으로 모으는 이번 refactor 자체가, 정확히 같은 종류의 문제(설명 없는/부정확한 근거로 남겨진 중복, 자기모순적 docstring, 정의-후-사용 순서 붕괴, 무관 삭제)를 세 번째 파일과 신규 함수 안에서 소규모로 재생산했다. 특히 `merge_coordinator_orchestrator.py`의 `_apply_status_update`가 실제로는 완전히 동일한데 "다르다"는 잘못된 근거로 위임을 피하고, 그 잘못된 근거가 plan 문서에도 옮겨진 점은 이 프로젝트가 반복적으로 대가를 치른 "확신에 찬 그러나 반증되는 주석" 패턴과 같은 형태라 우선 정정할 가치가 있다. 나머지는 즉시 위험이 없는 문서 정확성·가독성 수준의 폴리시 항목이다.

## 위험도

LOW
