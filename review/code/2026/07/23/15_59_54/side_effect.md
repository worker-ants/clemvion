# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 라우팅 신뢰 실패 시 "전체 reviewer 실행"으로 자동 확장되는 새 부작용 경로
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:439` (`_apply_routing`, 특히 468-477행의 `distrust` 분기), `.claude/workflows/ai-review.js:62` (`routingDistrustReason`) 및 173-184행의 `if (distrust) { selected = new Set(invocations.map(i => i.name)) ... }`
  - 상세: 이번 변경으로 router 가 forced reviewer 를 `selected=false` 로 반환하거나 decisions 배열에서 아예 누락시키면, 그 결정 전체가 폐기되고 **후보 전원**이 실행된다(이전에는 forced reviewer 만 조용히 복구하고 나머지 판단은 그대로 신뢰). 이는 실행 비용(에이전트 호출 수) 을 늘리는 실질적 부작용이지만, 커밋 메시지·docstring·`test_router_decision_trust.py` 에 근거(2026-07-23 세션 14_47_40 사고, `_apply_routing`이 forced 를 조용히 되살려 "건강한 7-reviewer 리뷰"처럼 보였던 결함)가 명확히 남아 있고, "0/1개 선택 시 전체 fallback" 구식 규칙의 부활이 아님을 별도로 pin (`test_workflow_has_no_zero_reviewer_fallback`)하는 등 의도가 뚜렷하다. 사이드이펙트 관점에서는 문제라기보다 **비용 영향이 있는 의도된 안전장치**로 분류.
  - 제안: 이미 잘 문서화·테스트되어 있어 추가 조치 불요. 다만 실제 운영 중 이 fallback 이 얼마나 자주 발동하는지(라우터가 forced 계약을 얼마나 자주 어기는지) 모니터링 지표가 있으면 비용 급증을 조기에 감지할 수 있음.

- **[INFO]** `router_safety.py` 에 신규 공개 함수 `source_files()` 추가 — 인터페이스 확장(비파괴적)
  - 위치: `.claude/skills/code-review-agents/lib/router_safety.py:313` (`def source_files(file_paths: Iterable[str]) -> list[str]:`)
  - 상세: 기존 비공개 `_is_source_file`을 감싸는 새 공개 함수. 기존 호출자(`compute_forced_agents`)의 시그니처·반환값은 그대로 유지되며(로컬 변수만 `source_files` → `changed_source` 로 이름 변경해 신규 모듈 함수와의 섀도잉을 피함), 동일 predicate 를 사용하므로 강제 리뷰어 판정 결과는 변경 전과 동일함을 확인(`sorted(set(source_files(paths)))` == 기존 `sorted({p for p in paths if _is_source_file(p)})`). 순수 함수 추가이며 부작용 없음.
  - 제안: 없음. 기존 동작 보존 확인됨.

- **[INFO]** 신규 테스트 헬퍼 `_prepare_files` 가 git blob 이 아닌 워킹트리 디스크 내용을 직접 읽음
  - 위치: `.claude/tests/test_line_anchors.py` 의 `_prepare_files` (332행대, "No cleanliness gate on purpose" 주석 블록)와 `FILES` 상수(`.claude/skills/code-review-agents/lib/line_anchors.py`, `.../router_safety.py`)
  - 상세: 의도적으로 dirty 상태에서도 동작하도록 설계되어 있고(이전 버전이 dirty 시 skip 하여 편집 도중 조용히 비활성화되던 문제의 재발 방지) 근거가 docstring 에 명시됨. 부작용이라기보다 테스트가 리포지토리의 특정 두 파일(고정 경로)의 **현재 크기·내용**에 항상 의존하게 된다는 결합(coupling)이 생긴다는 점만 유의할 가치가 있음 — 두 파일이 향후 커져서 프롬프트 예산(`DEFAULT_MAX_PROMPT_SIZE`)을 넘기면 이 테스트가 무관한 변경으로 실패할 수 있음.
  - 제안: 별도 조치 불요(설계상 트레이드오프로 문서화됨). 향후 두 파일이 유의미하게 커지는 PR 에서 이 테스트의 실패 원인이 "파일 크기"임을 빠르게 식별할 수 있도록 실패 메시지에 파일 크기 안내를 추가하는 것을 고려할 수 있음(선택 사항).

- **[INFO]** 이중 구현(Python/JS) 로직의 드리프트 위험은 differential test 로 완화됨
  - 위치: `.claude/tests/test_router_decision_trust.py:222` (`test_both_paths_agree_on_a_matrix_of_decisions`), `.claude/workflows/ai-review.js:62` (`routingDistrustReason`), `code_review_orchestrator.py:403` (`_routing_distrust_reason`)
  - 상세: 샌드박스 제약으로 import 를 공유할 수 없어 동일 로직을 Python 과 JS 양쪽에 수기로 복제. 두 구현이 어긋나면 "같은 라우팅 결정이 한쪽에서는 신뢰되고 다른 쪽에서는 거부"되는 부작용이 발생할 수 있으나, 6개 케이스 매트릭스로 두 구현을 실제 subprocess/node 실행을 통해 대조하는 테스트가 신설되어 향후 드리프트를 차단함. 부작용 관점에서 우려되는 지점이지만 완화책이 이미 구현·테스트에 포함됨.
  - 제안: 없음.

## 요약

이번 변경은 `codebase/` 가 아닌 하네스(코드 리뷰 오케스트레이터/워크플로/테스트) 영역에 한정된다. 핵심 부작용은 라우터가 forced-reviewer 계약(항상 `selected=true` 로 반환)을 위반할 경우 그 결정 전체를 버리고 **모든 후보 reviewer 를 실행**하도록 동작이 바뀐 것인데, 이는 실행 비용을 늘리는 실질적 부작용이지만 실제 인시던트(2026-07-23 14_47_40 세션)에 근거해 의도적으로 설계되었고, Python CLI(`_apply_routing`)와 JS 워크플로(`ai-review.js`) 양쪽에 동일 로직을 넣고 differential 테스트로 드리프트를 차단했으며, 기존 "0/1개 선택 시 전체 fallback" 폐기 규칙의 부활이 아님을 별도 테스트로 명시했다. `router_safety.py`의 신규 `source_files()` 는 기존 predicate 를 그대로 재사용하는 순수 함수 추가로 기존 호출자 동작을 바꾸지 않는다. 전역 상태·파일시스템 부작용(모두 세션 디렉터리 내 `_retry_state.json` 한정)·환경 변수·네트워크 호출 측면에서 새로운 위험은 발견되지 않았다. 유일한 실질적 "부작용"은 비용 증가로 이어질 수 있는 fallback 확장 동작이며, 이는 문서화·테스트가 충분하다고 판단된다.

## 위험도

LOW
