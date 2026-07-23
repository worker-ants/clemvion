# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `SKILL.md` 의 Route 동작 서술이 새 "신뢰 검증(distrust) → 결정 폐기 → 전수 실행" 분기를 반영하지 못함
  - 위치: `.claude/skills/code-review-agents/SKILL.md:64`
  - 상세: 본 PR 은 `code_review_orchestrator.py._routing_distrust_reason` / `ai-review.js routingDistrustReason` 를 새로 도입해, router 결정이 `agents_forced` 화이트리스트를 어기면(강제 reviewer 를 `selected:false` 로 반환하거나 아예 누락) **결정 전체를 폐기하고 모든 reviewer 를 실행**하는 4번째 분기를 만들었다. 그런데 이 skill 의 절차 문서인 `SKILL.md` §2 "Workflow 동작" 은 여전히 3가지 경우만 서술한다 — `"selected = agents_forced ∪ {selected:true}. skipped 이면 전수. router 실패 시 fail-open(전수)."` 새 분기(결정은 존재하지만 계약 위반이라 폐기되는 경우)는 언급이 없다. 코드/테스트(`test_router_decision_trust.py`, 18건 전부 통과 확인)는 의도된 개선으로 보이므로 코드를 되돌릴 사안이 아니라 문서 반영 누락이다.
  - 제안: 코드 유지. `SKILL.md` §2 Route 불릿에 4번째 케이스("forced 위반 시 결정 폐기 → 전수 실행, routingNote='fallback-distrusted-decision'")를 추가.

- **[WARNING]** `_apply_routing()` 의 docstring 이 새로 추가된 "distrust 시 결정 폐기" 분기를 서술하지 않음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` — `_apply_routing()` 함수 docstring (직접 Read/Grep 확인, 실제 파일 440번째 줄. 이 블록은 diff 로 변경되지 않아 프롬프트 게이트 번호가 없음)
  - 상세: 함수 docstring 은 "Without --fallback: read decisions[], move selected=false agents from pending to skipped. ... With --fallback: mark routing_status='skipped' ... keep all reviewers in pending."로 단 두 경로만 설명한다. 이번 diff 로 추가된 세 번째 경로(`--fallback` 없이 호출됐지만 decisions 가 forced 계약을 위반해 통째로 폐기되고 `routing_status='skipped'`+`routing_skip_reason`으로 전수 실행 처리)는 문서화되지 않아, 이 함수만 읽는 개발자는 이 분기 존재를 놓치기 쉽다.
  - 제안: docstring 에 세 번째 문단 추가 — "decisions 가 forced 화이트리스트를 위반하면(선택 실패 또는 누락) 결정 전체를 버리고 모든 reviewer 를 pending 에 남긴다(`_routing_distrust_reason` 참고)."

- **[INFO]** 소스 코드 확장자 개수 서술("24 확장자")이 실제 집합 크기(44개)와 불일치 — 본 PR 이전부터 있던 이슈, 이번 diff 로 유발되지 않음
  - 위치: `.claude/skills/code-review-agents/lib/router_safety.py:36` (docstring 정책 표) / `.claude/skills/code-review-agents/README.md:62` 부근 미러 표
  - 상세: `git blame` 확인 결과 2026-05-16 커밋(3446d0d57e)부터 "24 extensions" 로 적혀 있었고, `_SOURCE_CODE_EXTENSIONS` 실제 원소 수는 44개다. 이번 PR 이 그 classifier 를 `source_files()` 로 공개 API화하면서 재사용을 확장했으므로, 표 갱신 시점에 함께 고치면 좋다.
  - 제안: 별도 후속 커밋에서 "24" → 실제 개수로 정정 (본 PR 스코프 밖이라 차단 사유는 아님).

- **[INFO]** `decision.get("decisions", [])` 가 `None` 을 반환할 수 있는 입력(`{"decisions": null}`)에 대한 방어가 없음 — 신규 코드가 유발한 회귀는 아니고 기존 동작과 동일한 취약점을 공유
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` — `_apply_routing()` 내 `decisions = decision.get("decisions", [])` 및 이를 소비하는 `_routing_distrust_reason(decisions, forced)` 호출부 (diff 컨텍스트 라인 466-468 부근)
  - 상세: `_routing_decision.json` 에 `"decisions"` 키가 명시적으로 `null` 이면 `.get(key, default)` 은 default 를 적용하지 않고 `None` 을 그대로 반환한다. `_routing_distrust_reason` 내부의 제너레이터(`for d in decisions ...`)가 `TypeError: 'NoneType' object is not iterable` 로 죽는다. 다만 이전 코드의 `for d in decision.get("decisions", []):` 도 동일한 입력에 동일하게 죽었으므로 본 PR 이 새로 만든 회귀는 아니다. `ai-review.js` 쪽은 `Array.isArray(decision.decisions)` 체크가 있어 이 입력에 안전하게 fail-open 되는 것과 대비된다(두 경로 간 견고성 비대칭).
  - 제안: CLI 경로에도 `if not isinstance(decisions, list): decisions = []` 류 방어를 추가해 두 경로의 견고성을 맞추면 좋음 (본 PR 필수 아님).

## 기능/에지케이스 검증 결과 (문제 없음, 참고용)

- `_routing_distrust_reason` (Python) ↔ `routingDistrustReason` (JS) 는 "forced 인데 selected=false" 와 "forced 인데 decisions 에 아예 없음" 두 계약 위반만 검사하고, 0-reviewer 케이스는 의도적으로 건드리지 않는다 — README/`review-router.md` 의 "전체 fallback 안 함"(#244, 6cd7376fc) 원칙과 일치. `agents_pending` 은 distrust 분기에서 손대지 않아 `--prepare` 시점의 전체 후보 목록이 그대로 유지되므로 "전수 실행"이 실제로 보장된다(`_apply_routing`:1030행 초기화 확인).
- `router_safety.compute_forced_agents` 내부 로컬 변수를 `changed_source` 로 개명해 신규 공개 함수 `source_files` 와의 shadowing 을 제거 — 동작(정렬된 unique 소스 파일 목록 + 3개 초과 시 "외 N건" 문구)은 이전과 동일함을 확인.
- 신규 테스트 18건(`test_router_decision_trust.py`) 및 `test_orchestrator_state.py`/`test_line_anchors.py` 포함 하네스 전체 스위트(394 테스트) 로컬 실행 결과 all green — 회귀 없음.
- `test_line_anchors.py` 의 `_prepare_commit`/`_prepare_files` 분리는 "whole-file 블록 테스트가 HEAD 커밋 크기에 좌우되던" 결함을 고치는 자기완결적 하드닝으로, 이번 변경과 직접 결합되지 않지만 부작용도 없음을 테스트 통과로 확인.

## 요약

라우터가 강제 화이트리스트(`agents_forced`)를 어긴 결정(신뢰 불가)을 캐치해 결정 전체를 폐기하고 전수 리뷰로 fail-safe 하는 로직이 Python CLI(`_apply_routing`)와 Workflow(`ai-review.js`) 양쪽에 대칭적으로 구현되었고, 두 구현이 같은 입력에서 항상 일치하도록 차등 테스트(`test_both_paths_agree_on_a_matrix_of_decisions`)로 고정되어 있다. 새로 도입된 판단 로직 자체는 엣지 케이스(narrow-but-compliant 결정, forced 없는 경우, 0-reviewer 폴백 미부활)까지 꼼꼼히 테스트되어 기능적으로 완전하다. 다만 이 변경으로 실제로 달라진 Route 동작을 서술하는 두 문서(`SKILL.md` §2, `_apply_routing()` docstring)가 갱신되지 않아 "코드가 하는 일"과 "문서가 말하는 일" 사이에 괴리가 생겼다 — 코드를 되돌릴 사안은 아니고 문서 보완이 필요하다. 그 외 발견된 사항(확장자 카운트 오기, `decisions: null` 방어 부재)은 본 PR 이전부터 존재하던 저위험 이슈로 차단 사유가 아니다.

## 위험도

LOW
