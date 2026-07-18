# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실행 로직 diff 는 0줄(테스트 7건 추가 + JSDoc/주석 정정)이며 Critical 은 없음. 유일한 WARNING 은 신규 AND-guard 테스트 2곳이 같은 커밋 자신이 세운 "주석은 필드명으로 서술" 원칙을 스스로 어기고 내부 변수명을 노출한 문서 drift 위험(기능 영향 없음). Forced 7개 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음, 결과 누락으로 인한 거짓 음성 위험 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 신규 AND-guard mutation 고립 테스트 4개 중 2개(`rejects a whitelisted endReason without result.messages`, `rejects waiting_for_input status alone without output.messages`)가, 같은 커밋의 그룹 헤더 주석이 명시한 "주석은 내부 변수명이 아니라 페이로드 필드의 존재/부재로 서술한다" 원칙을 스스로 어기고 `looksLikeConversationEnd`/`isCanonicalWaiting` 이라는 내부 지역 변수명을 주석 첫 줄에 그대로 노출. 테스트 동작(fixture 기반)은 변수명 리네이밍에 안전하지만, 이 두 주석만 향후 함수명 개명 시 조용히 stale 해질 수 있음 — 이번 diff 가 스스로 방지하겠다고 선언한 바로 그 위험을 부분 재도입 | `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` (신규 AND-guard 4개 중 3·4번째 테스트 주석) | 두 주석 첫 줄을 필드 존재/부재 서술로 교정(예: "`output.result.endReason` 화이트리스트 매치 + `result.messages` 부재", "`status === 'waiting_for_input'` + `output.messages` 부재"). 변수명은 필요하면 괄호 각주로만 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `looksLikeConversationEnd` 의 `typeof endReason === "string"` conjunct(엔드리즌 키 자체 부재 케이스)를 단독 격리하는 음성 테스트가 없음. 현재는 `CONVERSATION_END_REASONS.has(undefined) === false` 라는 구현 세부 덕에 우연히 안전(직접 훼손 재현으로 확인)하나, 이 conjunct 가 `??` 등으로 리팩터되면 조용히 무방비가 될 잠재 갭 | `output-shape.test.ts` (기존 `rejects result.messages when endReason is outside the CONVERSATION_END_REASONS whitelist` 테스트 인근) | 차단 사유 아님. `endReason` 키 자체가 없는 fixture 로 음성 테스트 추가 고려(선택) |
| 2 | 테스트/문서 | 신규 4개 AND-guard 테스트 상단 그룹 주석이 "AND-guard 4곳"으로 통칭하지만, 첫 번째(`bare top-level conversationConfig`)는 실제로는 최상위 게이트의 OR-disjunct 제거를 격리하는 것으로 분류상 다름. 개별 테스트 본문 주석은 정확해 실질 오해 소지는 낮음 | `output-shape.test.ts` 신규 4개 블록 상단 그룹 주석 | 차단 사유 아님(스타일 지적, 선택) |
| 3 | 문서/요구사항 | 테스트 4("bare top-level conversationConfig")의 주석이 "`unwrapNodeOutput` 은 `output=null` → 아래 canonical 블록은 도달 불가"라는 실제로 도달하지 않는 가상 다운스트림 경로를 단정 서술. 실제로는 top-level 게이트에서 이미 조기 반환(158-163행)되어 `unwrapNodeOutput` 자체가 호출되지 않음. 반환값에는 영향 없음 | `output-shape.test.ts` (해당 테스트 바로 위 주석) | 차단 사유 아님. "top-level 게이트에서 조기 반환되므로 이하 canonical 블록은 애초에 평가되지 않는다"로 표현 정정 고려(선택) |
| 4 | 유지보수성 | 테스트 파일이 3회 연속(#968 본작업 → 20_06_14 이월 3건 → 이번 AND-guard 4건) 같은 패턴으로 계속 증가(현재 744줄, it/describe 44개). 당장 가독성 문제는 아니나 분기가 더 늘면 `describe.each`/`it.each` 테이블 구동 전환 고려 가치 있음 | `output-shape.test.ts` | 당장 조치 불필요. 다음 이월 작업에서 테이블 구동 리팩터링 고려 |
| 5 | 문서 | JSDoc 내 언어 혼용(영어 산문 + "No known producer" 한국어 단락) — 이미 두 차례 리뷰(20_06_14 maintainability, 10_40_03 documentation)에서 지적·보류된 이월 항목, 신규 아님 | `output-shape.ts` `isConversationOutput` JSDoc | 조치 불필요(기존 defer 유지) |
| 6 | 문서 | JSDoc ↔ 테스트 주석 이중 SoT("왜 이 분기가 방어적으로 남아있는가" 설명이 양쪽에 독립 존재, 툴링 강제 없음) — 이월 항목, 이미 후속 트래킹됨 | `output-shape.ts` JSDoc / `output-shape.test.ts` describe 상단 주석 | 조치 불필요(이미 후속 트래킹됨) |
| 7 | 문서(감사기록) | 과거 리뷰 산출물(`review/code/2026/07/17/20_06_14/maintainability.md:6,16`, `side_effect.md:6`)에 "결합 프롬프트 문서 오프셋을 실제 소스 라인으로 오기재"한 라인 번호 3건 잔존. `10_40_03/requirement.md` 가 WARNING 제기 후 동일 세션 `RESOLUTION.md` 가 감사 무결성(과거 스냅샷 사후 수정 금지)·실질 위험≈0·doc-루프 방지 근거로 명시적 미조치 결정. 본 세션도 동일 결론 재확인 | `review/code/2026/07/17/20_06_14/maintainability.md`, `side_effect.md` | 조치 불필요(기존 결정 존중, 재조치 시 doc-루프 재발 위험) |
| 8 | 리뷰산출물(harness) | `_retry_state.json` 두 건(20_06_14, 10_40_03) 모두 `routing_status: "pending"` 중간 스냅샷이 최종 갱신 없이 영구 커밋됨 — harness 상태 파일, PR 범위 밖, 이전 라운드에서도 동일 확인 | `review/code/2026/07/17/20_06_14/_retry_state.json`, `review/code/2026/07/18/10_40_03/_retry_state.json` | 조치 불필요 |
| 9 | 스코프 | 회차가 거듭될수록 리뷰 산출물 파일 수가 실제 코드 변경량보다 빠르게 증가하는 추세(1차 3파일/83줄 코드 vs 9파일 문서 → 2차 1파일/54줄 코드 vs 12파일 문서) — 강제된 워크플로의 구조적 결과, 이번 변경이 새로 만든 스코프 이탈 아님 | 커밋 `730a87cf0` 등 | 조치 불필요(참고). 패턴 지속 시 코드 커밋/리뷰 반영 커밋 분리 컨벤션 재고려 |
| 10 | 문서(긍정 확인) | JSDoc "no known producer" 근거가 백엔드 소스 실측(WS emit `nodeOutput`, `ai-conversation-helpers.ts` 등)으로 뒷받침되고, 삭제 시 대응 회귀 테스트가 즉시 실패하도록 고정됨 — 모범 사례 | `output-shape.ts` JSDoc | 없음(긍정 확인) |
| 11 | 테스트(긍정 확인) | 신규 AND-guard 4개 테스트는 이전 3개(OR-체인)가 받은 "내부 변수명 결합" 피드백을 스스로 반영해 필드 존재/부재로 주석을 서술함(단, 상기 WARNING #1 두 곳은 예외) | `output-shape.test.ts` | 없음(참고용) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 공격 표면 없음 — 순수 함수 테스트, 시크릿/자격증명 패턴 grep 매치 0, 네트워크·DB·쉘 접근 없음 |
| requirement | NONE | `isConversationOutput` 로직 무변경을 라인 단위 수동 트레이스로 실증, JSDoc "no known producer" 주장을 백엔드 WS emit 소스와 대조해 사실 확인 |
| scope | NONE | 프로덕션 로직 diff 0, 신규 테스트 7건은 선언 목적과 1:1 대응, 리뷰 산출물 20파일도 프로젝트 저장 관례에 부합(스코프 이탈 아님) |
| side_effect | NONE | 전역 상태·모듈 mutable 변수·파일시스템·네트워크·환경변수·이벤트 콜백 접근 전혀 없음, 대상 함수는 인자 비-mutate 순수 함수 |
| maintainability | LOW | AND-guard 테스트 2곳이 같은 커밋 자신의 "필드명 서술" 원칙을 어기고 내부 변수명(`looksLikeConversationEnd`/`isCanonicalWaiting`) 노출(WARNING) |
| testing | NONE | mutation 격리 주장 7건 전부(46/46 통과 + 4가지 소스 훼손 재현으로 각 1개 테스트만 fail) 직접 재현 성공, 잠재 커버리지 갭 1건은 INFO 수준 |
| documentation | NONE | JSDoc/주석 정확화 확인(hydration-coverage 함수명 참조 정확), README/CHANGELOG/API 문서 갱신 불요 판단 타당, 이월 INFO 항목 재확인만 |

## 발견 없는 에이전트

- security — 모든 점검 관점("해당 없음")에서 실질 발견 없음
- side_effect — 모든 발견이 "부작용 없음"을 확인하는 성격의 INFO 뿐, 실질적 우려 없음

## 권장 조치사항

1. (선택, 낮은 우선순위) `output-shape.test.ts` 신규 AND-guard 테스트 2곳의 주석 첫 줄을 필드 존재/부재 서술로 교정하여 내부 변수명(`looksLikeConversationEnd`, `isCanonicalWaiting`) 노출 제거 — 같은 커밋이 세운 원칙과의 정합성 회복, 향후 리팩터링 시 조용한 문서 drift 방지.
2. (선택) `endReason` 키 자체가 없는 케이스를 단독 격리하는 음성 테스트 1건 추가 검토 — 현재는 구현 세부(`Set.has(undefined)===false`)에 우연히 의존하는 잠재 커버리지 갭.
3. 그 외 항목(테스트 파일 크기 증가 추세, JSDoc 언어 혼용, JSDoc↔테스트 이중 SoT, 과거 리뷰 산출물 라인 번호 오귀속, `_retry_state.json` pending 스냅샷, 리뷰 산출물 볼륨 증가 추세)은 전부 이미 이전 세션에서 확인·보류되었거나 차단 사유가 아닌 참고용 — 별도 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별, router_safety 가 아래 7명 전원을 강제 포함):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, 전원 `router_safety` 에 의한 forced 포함이자 실제 실행·결과 확보 완료)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(누락·거짓 음성 위험 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff 범위(순수 테스트 추가 + JSDoc/주석 정정 + 리뷰 산출물 커밋)와 무관하다고 판단 |
  | architecture | 상동 |
  | dependency | 상동 — 신규 의존성 변경 없음 |
  | database | 상동 — DB 접근 코드 변경 없음 |
  | concurrency | 상동 — 동시성 관련 코드 변경 없음 |
  | api_contract | 상동 — 공개 API/시그니처 변경 없음 |
  | user_guide_sync | 상동 — 사용자 가시 동작 변경 없음 |
