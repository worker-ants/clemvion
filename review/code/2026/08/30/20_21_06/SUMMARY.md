# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능 결함(Critical)은 없다. 위험도를 MEDIUM으로 끌어올리는 근거는 두 가지: (1) `scope` 리뷰어가 지적한 "서로 무관한 두 결함 수정이 한 커밋에 섞임"(이미 머지됨, 되돌릴 필요는 없으나 판단을 기록해야 함), (2) 4명의 독립 리뷰어(testing/documentation/side_effect/maintainability)가 동일하게 확인한 3개 워크플로 파일의 "가드 테스트 파일명 리네임 절반 반영" 드리프트 — 자동 가드의 검사 범위 밖이라 조용히 남는다. 이번 세션에서 forced whitelist(7명) 전원이 결과를 확보했으므로 "강제인데 결과 없음" 으로 인한 거짓 낮은 위험도는 없다. 단, 아래 Critical 발견사항 표 대신 **리뷰어 간 상충하는 실측치**(requirement vs documentation, `.transaction(` 개수)가 하나 있어 이 부분은 성급히 "정정"으로 확정하지 말고 3차 재검증 후 처리할 것을 권고한다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation/testing/maintainability (side_effect는 INFO로 동일 지적, 4개 리뷰어 공통) | 가드 테스트 파일명 리네임(`test_workflow_shared_block.py` → `test_workflow_scripts.py`)이 3개 워크플로 파일에서 `>>> SHARED-BLOCK` 마커 줄만 반영되고, 그 위(4~5줄) "MIRROR of..." 로컬 헤더 주석은 여전히 존재하지 않는 옛 파일명을 가리킨다. 이 위치는 `test_workflow_scripts.py`의 `_extract_block()`이 마커 사이만 비교하므로 자동 드리프트 가드가 구조적으로 볼 수 없는 사각지대다 — "verbatim 미러링을 보장한다"는 전제를 세우는 이 PR이 그 바로 옆줄에서 미러링을 깨뜨린 아이러니. | `.claude/workflows/ai-review.js:109`(스테일, `:113`은 수정됨), `.claude/workflows/consistency-check.js:48`(스테일, `:52`는 수정됨), `.claude/workflows/merge-coordinate.js:58`(스테일, `:62`는 수정됨) | 3개 파일의 로컬 헤더 주석도 `test_workflow_scripts.py`로 정정. 재발 방지 원하면 `_extract_block`의 비교 범위를 로컬 헤더까지 넓히거나, 파일명을 SHARED-BLOCK 마커 쪽 한 곳에서만 언급하도록 SoT를 좁힐 것 |
| 2 | requirement (documentation 리뷰어와 실측 상충 — 조정 필요) | `execution-engine.service.ts` self-deadlock JSDoc의 `.transaction(` 전수 감사 수치(총 **36개**, 모듈 밖 **27개**)에 대해 requirement 리뷰어는 `grep -rn "\.transaction(" src --include="*.ts" \| grep -v spec` 재측정으로 총 **35개**(모듈 밖 26개)를 얻어 "자기참조 그렙 오염(JSDoc 프로즈 자체가 `` `.transaction(` `` 문자열을 포함)으로 1 부풀려졌다"고 주장한다. 그러나 documentation 리뷰어는 독립적으로 `grep -rn '\.transaction\s*<\|\.transaction\s*('`(제네릭 타입 인자 포함, 주석 인용 제외)로 재측정해 정확히 **36개**를 얻었고, 그 차이의 원인이 `webauthn.service.ts:338`의 `this.dataSource.transaction<Outcome>(`(제네릭 타입 인자가 낀 형태)를 requirement의 단순 패턴이 놓친 것이라고 반박한다 — 즉 JSDoc의 36/27이 오히려 정확할 가능성이 있다. 모듈 안 9개(execution-engine.service.ts 8 + retry-turn.service.ts 1)는 두 리뷰어 모두 일치. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8577`(총계 "36개"), `:8583`(모듈 밖 "27개"). 동일 수치가 `plan/in-progress/backend-lint-gate-broken-on-main.md:292,294`에도 반복 | 성급히 35/26으로 "정정"하지 말 것 — 제네릭 타입 인자(`.transaction<T>(`)까지 포괄하는 세 번째 독립 grep(예: `\.transaction\s*(<[^>]*>)?\s*\(`, 주석·이 JSDoc 자체 프로즈 라인 제외)으로 확정한 뒤 필요 시에만 JSDoc과 plan 문서를 함께 정정 |
| 3 | testing | self-deadlock 불변식 확인 JSDoc 갱신 시 "새 호출부를 추가할 때는 호출 스택 축도 함께 볼 것" 이라는 forward-looking 지시문이 삭제됐고 대체 문구가 없다. 이 불변식을 지키는 유일한 방어는 사람이 JSDoc을 읽고 수동으로 grep하는 것이며, 이번 PR이 그 작업을 두 번째로 반복했다는 사실 자체가 "한 번 하면 끝"이 아님을 보여준다. backend 쪽에는 `.transaction(` 블록 전수 스캔 + `updateExecutionStatus` 콜백 포함 여부를 검사하는 자동 정적 가드가 없다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8577-8588` | (a) 삭제된 것과 동등한 forward-looking 지시문을 최소한 복원하거나 (b) `test_workflow_scripts.py`류 패턴으로 이 불변식을 자동 검사하는 정적 가드 테스트를 backend에 추가 |
| 4 | scope | 서로 무관한 두 결함 수정이 단일 커밋(`7d6854cb9`)에 섞였다: (1) 파일 1~5의 `REPORT_RETURN_CONTRACT` 파일/반환메시지 sink 분리 수정, (2) 파일 6의 `updateExecutionStatus` self-deadlock 호출 스택 축 JSDoc 감사(순수 주석, 로직 무변경). 커밋 메시지 자체가 "+"로 두 작업을 이어붙였고, plan 문서도 서로 다른 체크리스트 항목 두 개를 같은 커밋에서 동시에 닫아 계획 단계에서도 별개 트래킹 항목이었음을 보여준다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8577-8591`, `plan/in-progress/backend-lint-gate-broken-on-main.md:289-301` | 기능적 위험은 낮음(파일 6은 주석뿐). 향후엔 주제별 커밋 분리를 권고. 이미 머지된 커밋이므로 되돌릴 필요는 없다고 판단되면 그 판단을 plan/PR 설명에 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 이 리뷰 세션 자체가 이 PR이 **제거하는** 구버전 `REPORT_RETURN_CONTRACT` 문구(파일/반환 sink 미분리)로 기동됐다 — 저장소 안에 놓친 5번째 사본은 없어(전수 grep 확인) 회귀가 아니라 리뷰 파이프라인 자체를 고치는 PR의 자기참조적 부트스트랩 아티팩트로 판단됨. | 리뷰 세션 호출 프롬프트 (diff 파일 아님) | 코드 fix 불요. PR 머지 후 동일 계열 세션을 한 번 더 돌려 새 프롬프트가 신 문구로 attach되는지 caller 측에서 사후 확인 권장 |
| 2 | maintainability | `updateExecutionStatus` JSDoc이 개정 이력을 누적하며 계속 길어진다(현재 약 40줄, 3세대째 서사). 같은 수치(36/9/27)가 `plan/in-progress/backend-lint-gate-broken-on-main.md`에도 거의 동일하게 중복 기재돼 SoT가 둘로 나뉜다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`updateExecutionStatus` 상단 JSDoc, 8553~8592행) | "현재 유효한 제약 + 남는 한계"만 코드 주석에 남기고, 세대별 개정 서사는 plan 문서 쪽에만 두는 것을 고려 |
| 3 | maintainability | 같은 JSDoc 블록 안에서 "9"라는 숫자가 서로 무관한 두 모집단(EngineDriver 경유 호출부 9곳 vs 모듈 안 `.transaction(` 블록 9개)을 가리켜 빠르게 훑는 독자가 혼동할 여지가 있다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8571`, `:8579` | 두 번째 "9개" 언급 시 "(위 9곳과는 별개의 집합)" 등 짧은 명시 추가 |
| 4 | scope | 가드 테스트 파일명 정정(`test_workflow_shared_block.py` → `test_workflow_scripts.py`, SHARED-BLOCK 마커 줄)은 정본 + 3개 미러 4곳 모두 필요한 동반 수정으로 판단됨 — scope 위반 아님. | `.claude/workflows/_lib/agent-return.mjs:15,48`, `ai-review.js:113`, `consistency-check.js:52`, `merge-coordinate.js:62` | 조치 불요, 참고용 기록 |
| 5 | scope | 파일 1~5(`_lib/agent-return.mjs` + 3개 워크플로 미러 + 신규 테스트)는 워크플로 샌드박스가 `import`를 지원하지 않아 verbatim 미러링이 관례 — 100% 동일한 diff 반복은 리팩토링이 아니라 필수 동반 수정. | `.claude/workflows/_lib/agent-return.mjs`, `ai-review.js`, `consistency-check.js`, `merge-coordinate.js`, `.claude/tests/test_agent_return.mjs` | 조치 불요 |
| 6 | testing | 신규 회귀 테스트 2건은 뮤테이션 검증(계약 문구를 구버전으로 되돌린 재현)에서 정확히 해당 2건만 RED, 기존 11건은 GREEN — vacuous 아님, 실제로 방어 기능을 함. `indexOf('1)')/indexOf('2)')` 기반 슬라이스는 다소 취약하지만 현재는 정확히 의도한 범위만 잘라내고 있어 당장 조치 불요. | `.claude/tests/test_agent_return.mjs:109-125`, `:127-138` | 조치 불요(참고) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | JSDoc 감사 수치 36/27 vs 재측정 35/26 불일치(WARNING #2, documentation과 상충) + 리뷰 세션 자체의 부트스트랩 아티팩트(INFO) |
| testing | LOW | forward-looking 지시문 삭제 후 미대체(WARNING #3) + 가드 파일명 절반 리네임(WARNING #1) |
| documentation | LOW | 가드 파일명 절반 리네임(WARNING #1) — 단 JSDoc 수치(36/27)는 독립 재검증으로 정확하다고 확인 |
| scope | MEDIUM | 무관한 두 결함 수정이 한 커밋에 혼재(WARNING #4) |
| security | NONE | 발견사항 없음 — 인젝션/시크릿/인증/입력검증/에러처리/의존성 전 관점 이상 없음(프롬프트 텍스트·주석·plan 문서만 변경) |
| side_effect | LOW | 가드 파일명 절반 리네임을 INFO로 지적, 그 외 전역 행동 변경(계약 문구)은 의도적이고 미러 무결성 확인됨, 회귀 없음 |
| maintainability | LOW | 가드 파일명 절반 리네임(WARNING #1) + JSDoc 개정 이력 누적/숫자 중의성(INFO) |

## 발견 없는 에이전트

security — 이번 diff는 프롬프트 계약 텍스트·주석·plan 문서만 변경하며 사용자 입력 처리, 인증/인가, DB 접근, 암호화, 시크릿 관리 등 보안 표면을 건드리지 않아 지적 사항 없음.

## 권장 조치사항

1. `.claude/workflows/ai-review.js`, `consistency-check.js`, `merge-coordinate.js` 3개 파일의 로컬 헤더 주석(SHARED-BLOCK 마커 밖)에서 `test_workflow_shared_block.py` → `test_workflow_scripts.py`로 정정한다 — 4개 리뷰어가 독립적으로 공통 지적했고 즉시 가능한 저위험 fix다.
2. `execution-engine.service.ts` JSDoc의 `.transaction(` 전수 카운트(36/27)를 제네릭 타입 인자(`.transaction<T>(`)까지 포괄하는 세 번째 독립 grep으로 재검증한다 — requirement(35/26)와 documentation(36/27, 정확하다고 주장)이 상충하므로, 확정 전 requirement의 제안대로 성급히 "35/26"으로 고치지 말 것.
3. self-deadlock 불변식에 대한 forward-looking 지시문("새 호출부 추가 시 재확인")을 JSDoc에 복원하거나, `.transaction(` 블록 전수 스캔 + `updateExecutionStatus` 콜백 포함 여부를 검사하는 자동 정적 가드 테스트를 backend에 추가한다.
4. (선택, 낮은 우선순위) 향후에는 report-return 계약 수정과 self-deadlock 감사처럼 무관한 주제를 별도 커밋으로 분리한다. 이번 커밋은 이미 머지됐으므로 되돌릴 필요는 없되, 그 판단을 plan에 기록해 둔다.
5. `updateExecutionStatus` JSDoc의 세대별 개정 서사를 plan 문서로 이관하고 코드 주석은 "현재 유효한 제약"만 남기는 정리를 고려한다(부수적, 저우선순위).

## 라우터 결정

- `routing_status=done` (router가 선별, 이번엔 전원 강제 포함):
  - **실행**: `requirement, testing, documentation, scope, security, side_effect, maintainability` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 즉 전원) — forced whitelist 전원의 결과가 확보되어 "강제인데 결과 없음"으로 인한 거짓 낮은 위험도 우려는 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |