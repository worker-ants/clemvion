# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** Stop hook의 advisory-note 스로틀링이 "note 텍스트로 키를 건다"는 주석과 실제 구현이 어긋난다 (index 기반 dedup)
  - 위치: `.claude/hooks/guard_review_before_stop.py:369`(주석) / `:371-373`(구현)
  - 상세: 주석은 "The marker keys on the note text, so a DIFFERENT contradiction still gets through." 라고 단언하지만, 실제 코드는 `marker = _marker_path(session_id, token, f"note{idx}")` — `enumerate()`가 준 **위치(index)** 를 키로 쓴다. `decision.notes`는 오직 `_newest_resolved_impl_done_mtime()`이 채택하는 "가장 최신 --impl-done 세션" 1건에서만 만들어지므로(`review_guard.py:756-759`), 같은 대화 세션·같은 브랜치 안에서 `/consistency-check --impl-done`을 다시 돌려 **채택되는 세션이 바뀌면** `notes[0]`의 텍스트는 완전히 달라지는데도 마커 경로는 항상 `sid__branch__note0`로 동일하다. 그 결과 이전에 한 번 발화한 마커가 그대로 남아있어(만료 로직 없음) **전혀 다른 하향(downgrade) 경고가 영구히 침묵**하는 시나리오가 실제로 가능하다 — 정확히 이 백스톱이 막으려던 "조용히 통과되는 하향"과 같은 성격의 결함이 자기 자신의 관측 계층에서 재발한다. 현재 `test_block_integrity.py`의 `NotesReachBothHooksTest`/`NotesSurviveBlockingTest`는 단발성 발화·스트림 분기만 검증하고 이 "동일 index, 다른 텍스트" 케이스는 다루지 않는다. 주석을 신뢰한 다음 유지보수자가 "다른 문구는 통과된다"는 잘못된 불변식을 전제로 후속 코드를 얹을 위험이 있다.
  - 제안: `kind`를 index 대신 note 내용 기반(예: `hashlib.sha1(note.encode()).hexdigest()[:8]`)으로 바꾸거나, 주석을 실제 동작(위치 기반, 세션이 바뀌면 재발화하지 않을 수 있음)에 맞게 정정한다. 겸사겸사 "동일 index, 다른 텍스트가 재발화하는지" 회귀 테스트를 추가.

- **[WARNING]** `merge_coordinator_orchestrator.py`에서 `_emit_summary_state`가 자신이 호출하는 `_load_state`보다 먼저 정의됨 — 자매 orchestrator 두 곳과의 정의 순서 일관성이 이번 diff로 깨짐
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85`(정의, 86행에서 `_load_state` 호출) vs `:113`(`_load_state` 실제 정의)
  - 상세: diff 이전에는 `_load_state`/`_save_state`가 `_emit_summary_state`보다 **앞에** 있었다. 이번 diff는 그 둘을 `_retry_state_lib` 위임 스텁으로 바꾸면서 위치를 `_emit_summary_state` **뒤**(`_apply_status_update` 바로 앞)로 옮겼다. 반면 같은 diff가 건드리는 `code_review_orchestrator.py`·`consistency_orchestrator.py`는 둘 다 `_load_state → _save_state → (_reconcile_state_with_disk) → _apply_status_update → _emit_summary_state` 순서를 유지한다(의존 대상이 항상 먼저 정의됨). Python 특성상 런타임 동작에는 문제가 없지만, "세 orchestrator가 구조를 거울처럼 맞춘다"고 diff 자체의 주석들이 반복해서 강조하는 바로 그 지점에서 유일하게 어긋난 forward-reference가 생겼다 — 위에서 아래로 읽는 독자는 113행에 가서야 86행 호출의 실체를 확인하게 된다. (참고: 이 파일에 `reconcile_state_with_disk` 자기치유가 없다는 더 큰 구조적 차이는 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9에 이미 후속 과제로 추적되고 있어 별도로 지적하지 않음 — 정의 순서 문제만 이번 diff가 새로 만든 부분이다.)
  - 제안: `_load_state`/`_save_state`/`_apply_status_update`를 `_emit_summary_state` 앞으로 옮겨 다른 두 orchestrator와 동일한 순서로 맞춘다.

- **[INFO]** `_shared/retry_state.py`의 5개 함수 전부 타입힌트 없음 — 같은 커밋에서 만든 `_shared/block_integrity.py`, 그리고 이 리팩터가 선례로 삼는 `_shared/report_paths.py`와 스타일이 다르다
  - 위치: `.claude/_shared/retry_state.py:41,50,86,127,166` (`load_state`/`save_state`/`reconcile_state_with_disk`/`emit_summary_state`/`apply_status_update` 모두 파라미터·반환 타입 어노테이션 없음)
  - 상세: `_shared/`에는 이제 파일이 3개뿐이다. `report_paths.py`(`def report_path(session_dir: str, name: str, state: dict) -> str:` 등)와 이번 diff가 함께 만든 `block_integrity.py`(`def summary_block_verdict(summary_text: str) -> str | None:` 등)는 모든 함수가 타입힌트를 갖춘다. `retry_state.py`만 하나도 없다. 모듈 docstring이 "AST comparison, docstrings excluded"로 원본 함수와의 동일성을 강조하는 것을 보면, 오리지널 orchestrator 코드(마찬가지로 타입힌트 없음)를 **의도적으로 verbatim 이동**시킨 결과로 보이며(추출 자체에 스타일 변경을 섞지 않는 것은 그 자체로 타당한 관행), 그 점에서 결함이라기보다는 후속 타이핑 작업의 여지로 보는 것이 맞다.
  - 제안: 별도 후속 커밋으로 `_shared/retry_state.py`에 타입힌트를 추가해 `_shared/` 세 파일의 스타일을 통일한다(동작 변경 없는 순수 어노테이션 추가라 리스크가 낮다).

- **[INFO]** `_evaluate_over_targets` 문서화된 "두 가지 불변식"에 신규 책임(advisory notes 병합)이 추가됐지만 docstring은 갱신되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:809-827`(docstring, "Bridges two invariants…") / `:847-859`(이번 diff가 추가한 notes 병합 로직, 함수 코드 전체의 상당 부분을 차지)
  - 상세: 함수 docstring은 자신이 "arrived from different directions" 두 불변식(fail-open observability / per-target fail-open)을 의도적으로 한 함수에 묶어둔 것이라고 명시한다. 이번 diff는 여기에 `outcome.notes` 누적 + 내용 기반 중복 제거(847-859행)라는 세 번째 관심사를 추가했는데, docstring의 "Bridges **two** invariants" 서술은 그대로 남아 세 번째 책임을 언급하지 않는다. 향후 이 함수를 축소·분리할 때 docstring만 보고 notes 병합을 부수효과로 오인해 제거할 위험이 있다.
  - 제안: docstring에 세 번째 불변식(advisory notes는 대상마다 수집되어 중복 제거된 채 `outcome.notes`로 올라가야 한다)을 한 줄 추가하거나, notes 병합을 `_merge_notes(outcome, result)` 같은 이름 있는 헬퍼로 분리해 함수 하나의 책임을 좁힌다.

- **[INFO]** `consistency-summary.md`에 추가된 괄호 삽입문이 한 문장 안에 4줄짜리 중첩 아이디어를 욱여넣어 가독성이 떨어짐
  - 위치: `.claude/agents/consistency-summary.md:50-55`
  - 상세: "게이트 결과가 에이전트의 그때그때 재량에 달리는 것이 가장 나쁜 성질이라…" 라는 원래 문장 중간에 `(이제 게이트가 checker 의 [CRITICAL] 과 모순되면 경고를 냅니다 — … 이 조항에만 의존합니다.)` 라는 4줄짜리 괄호 삽입구가 끼어들어, 독자가 바깥 문장의 주어-서술 구조를 4줄 건너 다시 이어 붙여야 한다. 이 파일은 sub-agent의 시스템 프롬프트 본문이라, 문장 구조가 복잡해지면 사람의 가독성뿐 아니라 모델이 "1차 방어는 여전히 하향 금지 조항"이라는 핵심 규약을 놓칠 위험도 함께 커진다(같은 내용이 SKILL.md 111-118행에도 유사하게 밀도 높게 반복됨).
  - 제안: 괄호 안 내용을 별도 문장 또는 하위 bullet으로 분리해 "1차 방어는 여전히 금지 조항이다 → (신규) 게이트가 보조로 경고를 낸다 → 단, 이 경고는 --impl-done 채택 시에만 발화한다"는 3단 구조를 순차 문장으로 풀어쓴다.

## 요약

이번 변경은 세 orchestrator에 흩어져 있던 `_retry_state.json` bookkeeping 5개 함수와 `BLOCK:` 판정 로직을 `_shared/retry_state.py` · `_shared/block_integrity.py`로 추출하는 DRY 리팩터로, 추출 전 AST 비교·실측 수치를 docstring/테스트에 남기는 등 이 프로젝트 고유의 "측정 후 서술" 관행을 잘 따르고 있고, 새 함수들은 대체로 짧고 단일 책임이며 네이밍도 기존 컨벤션(`_lib` 접두, `_shared` 공개 함수는 언더스코어 없음)과 일치한다. 다만 (1) Stop hook의 note 스로틀링이 주석과 다르게 index 기반이라 서로 다른 하향 경고가 마커에 가려 재발화하지 않을 수 있는 지점, (2) `merge_coordinator_orchestrator.py`의 함수 정의 순서가 이번 diff로 자매 파일들과 어긋난 지점은 실질적인 후속 조치가 필요하다. 나머지는 타입힌트 일관성·docstring 최신화·문서 문장 밀도 수준의 경미한 개선 여지다. 전체적으로 CRITICAL 수준 결함은 없다.

## 위험도
LOW
