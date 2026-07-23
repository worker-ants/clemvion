# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 변경(`.claude/` 코드 리뷰 하네스: router가 forced reviewer 화이트리스트를 어긴 결정을 폐기하고 전량 실행하도록 하는 신뢰성 가드)은 Critical 발견 없음. Forced reviewer 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원이 결과를 확보(success + 전문 확보)했으므로 강제 화이트리스트 미이행 문제는 없음. 다만 이 안전장치를 소개하는 문서(SKILL.md, README.md, docstring)가 실제 동작을 반영하지 못해 stale 상태이고, 이번 안전장치가 막으려는 것과 같은 종류의 실수(파일 카운트 오판, 상태 불일치)를 검증하는 테스트 커버리지 갭이 있음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `SKILL.md` Route 단계 서술(§2, 64/93행)이 이번에 추가된 "forced reviewer 가 selected=false 이거나 누락되면 결정 전체를 폐기하고 전량 실행" 분기를 반영하지 못함 — 코드/테스트는 의도된 개선(18건 테스트 전부 통과)이나 절차 문서가 stale | `.claude/skills/code-review-agents/SKILL.md:64,93` | Route 불릿에 4번째 케이스(forced 위반 시 결정 폐기 → 전수 실행) 추가 |
| 2 | 문서화 | `_apply_routing()` 함수 docstring 이 새로 추가된 3번째 분기(신뢰 불가 결정 시 전원 pending 유지 + `fallback=distrusted-decision` 출력)를 설명하지 않음. 기존 docstring 은 `--fallback` 유/무 두 경로만 서술 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `_apply_routing()` (함수 정의부, ~440행) | docstring에 세 번째 분기 문단 추가 |
| 3 | 문서화 | 신규 독스트링 2곳이 근거로 인용한 "2026-07-23 사고" 파일 구성 수치가 실측과 불일치 — "15 docs / 4 code files(15:4)"로 적었으나 해당 세션 `meta.json` 실측 결과 실제로는 16 docs / 3 code(16:3). "라우터의 파일 카운트 오판을 막는다"는 취지의 코드가 자신의 근거 수치를 틀리게 인용한 것은 아이러니 | `.claude/skills/code-review-agents/lib/router_safety.py:319-320` (`source_files()` docstring), `.claude/tests/test_router_decision_trust.py:9` (모듈 docstring) | "16 docs and 3 code(16:3)"로 두 곳 모두 정정 |
| 4 | 범위(Scope) | 커밋 메시지가 선언하지 않은 별건 테스트 인프라 리팩토링이 같은 커밋에 번들됨 — `test_line_anchors.py`의 `_prepare()` → `_prepare_commit()`/`_prepare_files()` 3분할(HEAD 커밋 크기에 좌우돼 무관한 변경에서 스위트가 실패하던 선재 flakiness 결함 수정). 코드 자체는 합리적이나 라우팅-신뢰 수정과 별개 사안 | `.claude/tests/test_line_anchors.py:293-349,377,390,409,442` | 별도 커밋/PR로 분리하거나 커밋 메시지 "부수" 섹션에 명시 |
| 5 | 유지보수성 | `_routing_distrust_reason`를 설명하는 26줄 근거 주석(2026-07-23 인시던트 서술)이 실제 함수(~403행)와 무관한 `BINARY_EXTENSIONS` 상수 직전(77행)에 위치 — 맥락 단절, 향후 `BINARY_EXTENSIONS` 이동/삭제 시 고아 주석화 위험 | `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:77` (주석) vs `:403` (`_routing_distrust_reason`) | 주석을 해당 함수 바로 위로 이동하거나 docstring에 흡수 |
| 6 | 유지보수성 | "샘플 N개 + 나머지 개수 표기"(예: "외 N건/개") 패턴이 서로 다른 한도(`3` vs `20`)·단위(`건` vs `개`)로 세 번째 변형까지 중복 등장, 공유 헬퍼/named 상수 없이 매직 넘버 하드코딩 | `code_review_orchestrator.py:749-750` vs `router_safety.py:382-385,395-398` | `_sample_with_more_note(items, limit, unit)` 같은 공용 헬퍼로 통합 |
| 7 | 유지보수성 / 테스트 | JS 소스에서 함수 본문을 잘라내는 임시 파싱(`js.index("function ...")` → `js.index("\n}", start)`)이 같은 테스트 파일 안에서 서로 다른 두 가지 방식으로 중복 구현됨 — 2-space 들여쓰기 관례에 암묵적으로 의존하는 취약한 휴리스틱, 명시 주석 없음(differential 실행 테스트로 위험은 완화되나 잠재 취약점) | `.claude/tests/test_router_decision_trust.py:181-182,197-198,239-249,248-249` | 공용 헬퍼(`_extract_js_function`)로 통합하고 가정을 주석으로 명시 |
| 8 | 테스트 | 이번 PR의 핵심 동기(라우터가 파일 수 구성을 오판한 사고)와 직접 연관된 "변경 구성" 블록의 20개 초과 truncation 분기(`… 외 N개`)가 어떤 테스트에서도 트리거되지 않음(기존 테스트는 0개/1개 소스 파일 케이스만 커버) | `code_review_orchestrator.py:749-750`; 테스트는 `test_router_decision_trust.py` `RouterPromptStatesCompositionTest`(267-327행) | 21개 이상 소스 파일 changeset으로 "… 외 1개" 문구 정확성 검증 테스트 추가 |
| 9 | 테스트 | `_apply_routing`의 distrust 분기가 `agents_pending`/`agents_skipped`를 전혀 재구성하지 않아, `--apply-routing`이 한 세션에서 두 번째로 호출되며(첫 호출이 일부를 이미 `agents_skipped`로 옮긴 뒤) distrust 판정이 나는 경로에서 로그("전량 실행")와 실제 state(이전 부분 스킵 상태 잔존)가 불일치할 수 있음 — 이 시나리오를 다루는 테스트 부재 | `code_review_orchestrator.py:465-477` | distrust 분기에서 `agents_pending` 명시적 재구성/`agents_skipped` 초기화 보강 또는 최소 불변식을 docstring+회귀 테스트로 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 이번 변경은 라우터(LLM)가 forced reviewer(특히 security)를 부당 배제하는 것을 계약 위반으로 감지해 전량 실행으로 폴백시키는 방어적 하드닝 — 긍정적 발견 | `_routing_distrust_reason` / `routingDistrustReason` | 유지 권장, 조치 불요 |
| 2 | 보안 | 신규 differential 테스트의 subprocess 호출(`-c`/`-e` 스크립트에 `repr()`/`json.dumps()`로 데이터 보간)은 현재 고정 매트릭스라 안전하나, 향후 외부/모델 생성 데이터로 재사용 시 인젝션 벡터가 될 수 있음 | `.claude/tests/test_router_decision_trust.py` `_run`, `test_both_paths_agree_on_a_matrix_of_decisions` | 재사용 시 문자 집합 화이트리스트 또는 별도 파일 전달 방식으로 전환 |
| 3 | 요구사항 | 소스 확장자 개수 서술("24 extensions")이 실제 집합 크기(44개)와 불일치 — 2026-05-16부터 존재한 선재 이슈, 이번 PR로 유발되지 않음 | `router_safety.py:36`, `README.md:62` 부근 | 별도 후속 커밋에서 정정 |
| 4 | 요구사항 | `decisions: null` 입력에 대해 Python(`_apply_routing`)은 무방비(TypeError)이나 JS(`ai-review.js`)는 `Array.isArray` 체크로 안전 — 견고성 비대칭(기존 코드와 동일 취약점 공유, 신규 회귀 아님) | `code_review_orchestrator.py` `_apply_routing()` ~466-468행 | CLI 경로에도 `isinstance(decisions, list)` 방어 추가 고려 |
| 5 | 범위 | `router_safety.py` 내 지역변수 `source_files` → `changed_source` 개명은 신규 공개 함수와의 shadowing을 피하기 위한 필연적 부수 변경, 범위 내 정상 | `router_safety.py:391-393` | 조치 불요 |
| 6 | 부작용 | Distrust 발동 시 "전체 reviewer 실행"으로 비용이 늘어나나, 실제 인시던트에 근거한 의도된 안전장치이며 문서·테스트로 충분히 뒷받침됨 | `_apply_routing`, `ai-review.js` | 운영 중 발동 빈도 모니터링 지표 고려(선택) |
| 7 | 부작용 | `source_files()` 신규 공개 함수는 기존 predicate를 그대로 재사용하는 비파괴적 확장, 기존 호출자 동작 불변 확인 | `router_safety.py:313` | 조치 불요 |
| 8 | 부작용 | 신규 테스트 헬퍼 `_prepare_files`가 git blob이 아닌 워킹트리 디스크를 직접 읽어, 향후 대상 파일이 커지면 무관한 변경에서도 실패 가능(설계상 트레이드오프로 문서화됨) | `test_line_anchors.py` `_prepare_files` | 필요 시 실패 메시지에 파일 크기 안내 추가(선택) |
| 9 | 부작용 | Python/JS 이중 구현 드리프트 위험은 신규 differential 테스트(`test_both_paths_agree_on_a_matrix_of_decisions`)로 완화됨 | `test_router_decision_trust.py:222` | 조치 불요 |
| 10 | 유지보수성 | 동일 2026-07-23 인시던트 서술이 5개 파일(router_safety.py, code_review_orchestrator.py ×2, README.md, test_router_decision_trust.py, ai-review.js)에 거의 그대로 복붙되어, 수치 표현이 미묘하게 어긋남(위 WARNING #3과 연관) | 5개 파일 각 위치 | 정본 서술 한 곳만 상세히 두고 나머지는 참조로 대체 |
| 11 | 유지보수성 | 여러 테스트 메서드가 각각 독립적으로 `WORKFLOW.read_text()` 재호출 — 성능 문제는 없으나 중복 | `test_router_decision_trust.py` 여러 메서드 | 낮은 우선순위, 필요 시 `setUpClass` 캐싱 |
| 12 | 테스트 | `_is_source_file`의 대소문자 무시 확장자 매칭이 신규 테스트에서 검증되지 않음(선재 로직, 이번 PR은 추출/리네이밍만) | `test_router_decision_trust.py:361` | 공개 API 계약 보강 차원에서 테스트 추가 권장(낮은 우선순위) |
| 13 | 테스트 | JS 소스 텍스트 슬라이싱(`\n}` 매칭) 기법이 취약하나 현재는 안전하고 differential 실행 검증으로 위험 완화됨(WARNING #7과 연관) | `test_router_decision_trust.py:239-249` | 조치 불요(현 상태 유지 가능) |
| 14 | 문서화 | `README.md`의 `_retry_state.json` 스키마 예시(`routing_skip_reason` 값 나열)가 신규 distrust 사유 문자열 패턴을 반영하지 않음 | `README.md:139` | 예시 목록에 신뢰-불가 사유 패턴 한 줄 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 표면 없음. 오히려 리뷰 파이프라인 자체의 신뢰성을 높이는 방어적 하드닝(긍정적) |
| requirement | LOW | 코드/테스트는 완전하나 SKILL.md·docstring이 새 distrust 분기를 반영 못함(WARNING 2건), 선재 이슈 2건(INFO) |
| scope | LOW | 커밋 목적에 잘 수렴, 단 test_line_anchors.py 리팩토링이 커밋 메시지 미선언 별건(WARNING 1건) |
| side_effect | LOW | Fallback 확장은 비용 증가 실질 부작용이나 의도적·문서화·테스트 충분(전부 INFO) |
| maintainability | LOW | 주석 위치 부적절, 매직넘버 패턴 3중복, JS 파싱 중복(WARNING 3건) |
| testing | LOW | 신규 안전장치의 핵심 경계(20개 초과 truncation, distrust 재호출 상태 정합성)가 테스트 안 됨(WARNING 2건). 그 외 회귀 스위트(394건) 전부 통과 |
| documentation | LOW | SKILL.md stale, 근거 독스트링 수치 오류(15:4 vs 실제 16:3), README 예시 미반영(WARNING 2건 + INFO 1건) |

## 발견 없는 에이전트

없음 (7개 forced reviewer 전원이 최소 1건 이상의 WARNING/INFO 발견사항을 보고).

## 권장 조치사항

1. `SKILL.md` §2 Route 서술과 `_apply_routing()` docstring에 이번에 추가된 "forced 위반 시 결정 폐기 → 전수 실행" 3번째 분기를 반영한다 (WARNING #1, #2).
2. 신규 독스트링 2곳(`router_safety.py`, `test_router_decision_trust.py`)의 "2026-07-23 사고" 파일 구성 수치를 실측값(16 docs/3 code)으로 정정한다 (WARNING #3).
3. 프롬프트 "변경 구성" 블록의 20개 초과 truncation 분기(`… 외 N개`)에 대한 경계값 테스트를 추가한다 — 이번 PR의 동기 자체가 파일 카운트 오판 방지이므로 우선순위 높음 (WARNING #8).
4. `_apply_routing`의 distrust 분기가 `agents_pending`/`agents_skipped` 상태를 명시적으로 재구성하도록 보강하거나 최소한 불변식을 문서화+테스트로 고정한다 (WARNING #9).
5. `test_line_anchors.py`의 `_prepare()` 3분할 리팩토링을 별도 커밋/PR로 분리하거나 커밋 메시지에 명시한다 (WARNING #4).
6. 여유 시 유지보수성 개선(주석 위치 이동, 매직넘버 헬퍼 통합, JS 파싱 로직 통합)을 진행한다 (WARNING #5~#7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 forced 화이트리스트에 의해 강제 포함 — 결과 전문 모두 확보됨, 미이행 없음)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 실행된 전원과 동일, forced 결과 전원 확보 확인됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router가 변경 성격(테스트/하네스 로직, 성능 민감 경로 없음)상 비관련으로 판단하여 제외 |
  | architecture | router가 아키텍처 영향 없음으로 판단하여 제외 |
  | dependency | router가 신규 의존성 변경 없음으로 판단하여 제외 |
  | database | router가 DB 관련 변경 없음으로 판단하여 제외 |
  | concurrency | router가 동시성 관련 변경 없음으로 판단하여 제외 |
  | api_contract | router가 API 계약 변경 없음(내부 하네스 전용)으로 판단하여 제외 |
  | user_guide_sync | router가 사용자 가이드 동기화 대상 변경 없음으로 판단하여 제외 |