# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 라우터 프롬프트 "변경 구성" 블록의 20개 초과 truncation 분기가 테스트되지 않음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:749-750`
    ```python
    shown = "\n".join(f"  - `{p}`" for p in src_paths[:20])
    more = f"\n  - … 외 {len(src_paths) - 20}개" if len(src_paths) > 20 else ""
    ```
  - 상세: `test_router_decision_trust.py`의 `RouterPromptStatesCompositionTest`(gate 267-327)는 "1개 소스 파일" 케이스(`test_mixed_changeset_is_declared_not_doc_only`)와 "0개" 케이스(`test_doc_only_changeset_is_declared_as_such`)만 검증한다. 소스 파일이 20개를 초과해 `… 외 N개` 요약 문구가 실제로 트리거되는 경계(21개 이상)를 재현하는 케이스가 없다. 이번 PR의 핵심 동기 자체가 "라우터가 파일 수 구성을 오판했다"(19개 changeset)는 사고이므로, 그 오판을 막기 위해 새로 추가한 요약 로직의 경계값(>20)이 검증되지 않은 채 남아있는 것은 아이러니하다 — 요약 문구가 깨지거나 개수가 하나 어긋나도 어떤 테스트도 잡지 못한다.
  - 제안: 21개 이상의 소스 파일을 가진 changeset(예: 임시 디렉터리에 21개 더미 `.py` 파일 생성 후 `--prepare` 실행)으로 `"… 외 1개"` 문구가 정확히 나타나는지 확인하는 테스트를 추가.

- **[WARNING]** `_apply_routing`의 distrust 분기가 재호출(2차 apply-routing) 시나리오에서 검증되지 않음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:465-477` (`_routing_distrust_reason` 호출 및 `state["routing_status"]="skipped"` 처리 블록)
  - 상세: distrust 분기는 `state["agents_pending"]`/`state["agents_skipped"]`를 전혀 건드리지 않고 그대로 저장한다 — "전체 실행"이라는 로그(`fallback=distrusted-decision`)와 실제 state 는, `_write_state`/`_write` 헬퍼가 애초에 `agents_pending`을 전체 후보로 채워둔 덕에 우연히 일치할 뿐이다. `--apply-routing`이 한 세션에서 두 번째로 호출되는 경로(예: 향후 재시도 루프가 라우팅 결정을 다시 적용하는 케이스)에서, 첫 호출이 일부를 `agents_skipped`에 이미 넣어둔 뒤 두 번째 호출이 distrust로 판정되면, 로그는 "전량 실행"이라 말하지만 실제 `agents_pending`/`agents_skipped`는 이전 호출의 부분 스킵 상태를 그대로 물려받아 불일치가 발생할 수 있다. `test_router_decision_trust.py`/`test_orchestrator_state.py` 어디에도 이 "단일 호출 불변식"을 명시하거나 재호출 시나리오를 다루는 테스트가 없다.
  - 제안: (a) distrust 분기에서 `agents_pending`을 `agents_forced ∪ decisions에 나열된 모든 이름`으로 명시적으로 재구성하고 `agents_skipped`를 비우도록 코드를 보강하거나, (b) 최소한 "이 함수는 세션당 한 번만 호출된다"는 불변식을 docstring에 명시하고 이를 어기면 실패하는(혹은 방어적으로 처리하는) 회귀 테스트를 추가.

- **[INFO]** `source_files()`/`_is_source_file()`의 대소문자 무시 확장자 매칭이 새 테스트에서 다뤄지지 않음
  - 위치: `.claude/tests/test_router_decision_trust.py:361` (`SourceFileClassifierTest.test_picks_code_and_rejects_docs`)
  - 상세: `_is_source_file`은 `ext.lower()`로 대소문자를 무시하지만(`router_safety.py:399`, 기존 로직 — 이번 diff는 리네이밍/추출만), 새로 추가된 `test_picks_code_and_rejects_docs`/`test_empty_input`은 모두 소문자 확장자만 사용한다(`Foo.PY` 같은 케이스 없음). 이번 PR이 도입한 신규 동작은 아니라 낮은 우선순위이지만, 공개 API로 승격된(`source_files` — docstring에 "Public because the router prompt states this list as a *fact*"라 명시) 함수인 만큼 계약의 일부로 최소 1건 추가해두면 향후 회귀를 조기에 잡을 수 있다.
  - 제안: `test_picks_code_and_rejects_docs`에 `'Weird.PY'` 같은 대문자 확장자 케이스를 한 줄 추가.

- **[INFO]** 워크플로 미러 테스트 일부가 JS 소스 텍스트의 브래킷 위치(`\n}`)에 의존하는 취약한 슬라이싱 기법 사용
  - 위치: `.claude/tests/test_router_decision_trust.py:239-249` (`test_both_paths_agree_on_a_matrix_of_decisions` 내 `js_src.index("\n}", start)` 추출), 그리고 `WorkflowMirrorsPythonRuleTest.test_workflow_has_no_zero_reviewer_fallback`(`js.index("\n}", start)`)
  - 상세: `routingDistrustReason` 함수 본문을 "다음 줄 첫 칸에 오는 `}`"까지로 슬라이스해 Node 로 재평가한다. 현재는 함수 내부 `if` 블록의 닫는 중괄호가 들여쓰기돼 있어(`\n}`가 아니라 `\n  }`) 정확히 함수 끝에서만 매칭되지만, 향후 `routingDistrustReason` 위/아래에 다른 top-level 함수가 추가되거나 포매팅이 바뀌면 이 인덱스 탐색이 조용히 잘못된 범위를 추출할 수 있다. 다만 이는 이 저장소에 이미 정착된 컨벤션(sandbox 가 import 를 금지하므로 다른 workflow 테스트들도 동일 기법 사용)이고, 같은 테스트가 실제 Python 규칙과 Node 평가 결과를 매트릭스로 비교하는 실행 기반 검증(구조 검사만이 아님)을 겸하고 있어 위험이 상당히 완화된다.
  - 제안: 조치 불필요(수용 가능한 기존 패턴). 다만 향후 `routingDistrustReason` 근처에 새 함수를 추가할 계획이 있다면 이 슬라이싱 전제를 docstring에 한 줄 더 명시해두면 좋음.

## 회귀/실행 검증

- `test_router_decision_trust.py`(신규, 18건), `test_orchestrator_state.py`(28건, 기존 테스트 1건이 새 계약에 맞게 갱신됨), `test_line_anchors.py`(34건, `_prepare()` → `_prepare_commit()`/`_prepare_files()` 리팩터)를 로컬에서 개별 실행 — 전부 통과.
- `.claude/tests/` 전체 스위트(394건) discover 실행 — 전부 통과. `router_safety.py`의 `source_files()` 추출 + `compute_forced_agents` 내부 변수 리네이밍(`source_files` → `changed_source`, 섀도잉 회피)이 기존 어떤 테스트도 깨뜨리지 않음을 확인.
- `test_orchestrator_state.py`의 `test_apply_routing_keeps_selected_and_forced`는 이전에 "forced 리뷰어가 `selected=False`여도 강제로 유지된다"는 옛 계약을 검증했는데, 이번 PR로 그 계약 자체가 폐기(distrust 시 전체 폴백)되었으므로 테스트 입력을 `selected=True`(준수 케이스)로 정확히 갱신했다 — stale 테스트가 남지 않도록 잘 처리됨.

## 강점

- 신규 `test_router_decision_trust.py`는 사고 재현(all-false), 단일 forced 드롭, forced 누락(omission, 과거엔 skip 기록조차 안 남던 케이스), narrow-but-compliant(회귀 방지: 좁은 결정을 폴백으로 오분류하지 않는지), Python/JS 두 구현의 differential 매트릭스 테스트(6가지 케이스, 실제 `node -e`로 JS 함수를 평가해 Python 결과와 비교)까지 폭넓게 커버한다. 특히 differential 테스트는 텍스트 패턴 매칭이 아니라 실제 두 언어 런타임을 나란히 실행해 비교하므로 "구현이 프롬프트 문구와만 일치하고 실제 규칙과는 다르다"는 종류의 오탐/누락을 차단한다.
- Mock을 지양하고 실제 subprocess(`--apply-routing`, `--prepare`) + 실제 파일시스템 + 실제 `node -e` 실행으로 검증하는 방식은 이 하네스의 기존 컨벤션과 일치하며, 라우팅 결정 신뢰 로직처럼 상태 전이가 중요한 코드에 적합하다.
- `test_line_anchors.py`의 `_prepare()` → `_prepare_commit()`/`_prepare_files()` 분리는 "HEAD 커밋에 따라 whole-file 블록 테스트가 우연히 실패/통과"하던 취약점을 근본적으로 제거한 테스트 용이성 개선이며, "더러운 워킹트리에서 skip하지 않는다"(no cleanliness gate) 결정도 근거가 명확히 문서화되어 있다.
- 각 테스트 클래스/메서드의 docstring이 "왜 이 테스트가 존재하는가"(실측 사고 경로, 회귀 시나리오)를 구체적으로 서술해 의도 파악이 쉽다.

## 요약

이번 diff는 실질적으로 "라우터가 강제 리뷰어 화이트리스트를 어기면 결정 전체를 불신하고 전원 실행한다"는 새 안전장치와, 그 안전장치를 Python(`_apply_routing`)·JS(`ai-review.js`) 양쪽에서 동일하게 보장하는 신규 테스트 스위트(`test_router_decision_trust.py`, 18건)로 구성되어 있다. 사고 재현·단일/누락 케이스·정상 케이스·differential JS-Python 매트릭스까지 폭넓게 커버되어 있고, 기존 테스트(`test_orchestrator_state.py`)도 새 계약에 맞게 정확히 갱신되었으며 로컬에서 신규/기존 테스트 및 전체 스위트(394건) 실행 결과 모두 통과했다. 다만 이 PR의 핵심 동기인 "라우터에게 파일 구성 사실을 알려주는" 프롬프트 블록 자체의 20개 초과 truncation 분기가 테스트되지 않았고, `_apply_routing`의 distrust 분기가 재호출 시 `agents_skipped`를 정리하지 않는 잠재적 불일치도 테스트로 방어되어 있지 않다 — 둘 다 현재 동작을 깨지는 않지만 이번 안전장치가 지키려는 바로 그 종류의 실수(카운트 오판, 상태 불일치)를 재도입할 수 있는 지점이라 보강을 권장한다.

## 위험도

LOW
