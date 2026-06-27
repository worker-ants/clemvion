# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] CORS 설정이 글로벌 인프라 영역에 걸침 — 의도적·최소 범위 수정
- 위치: `codebase/backend/src/common/cors/web-chat-cors.ts` (CorsOptionsLike 인터페이스), `codebase/backend/src/main.ts` (defaultOptions)
- 상세: `exposedHeaders?: string[]` 필드는 CORS 전역 설정(`CorsOptionsLike` 인터페이스 + `main.ts` defaultOptions)에 추가됐다. 변경이 agent-memory 모듈 외부(공통 CORS 레이어)에 미치지만, 이는 W1(cross-origin 브라우저가 X-Deleted-Count 헤더를 읽지 못해 clearScope 가 항상 0 폴백) 버그를 수정하기 위한 최소 필요 변경이다. 변경은 additive(기존 CORS 동작 무변경, 헤더 노출만 추가)이며 다른 엔드포인트에 부작용이 없다. JSDoc 도 변경 이유를 명확히 설명한다.
- 제안: 범위 일탈이 아님. INFO 수준 기록.

### [INFO] 리뷰 아티팩트 일괄 커밋 — 이전 배치(23_02_30) 산출물 포함
- 위치: `review/code/2026/06/27/23_02_30/` 하위 RESOLUTION.md, SUMMARY.md, scope.md, side_effect.md, architecture.md, documentation.md, maintainability.md, requirement.md, testing.md, api_contract.md, meta.json, _retry_state.json; `review/consistency/2026/06/27/23_02_31/SUMMARY.md`
- 상세: 이전 ai-review 배치(23_02_30)의 모든 리뷰 아티팩트가 이 커밋에 포함된다. 이는 워크플로 규약("리뷰 산출물도 커밋에 포함")을 올바르게 따른 것이므로 범위 이탈이 아니다. 다만 review/ 파일이 본 커밋의 상당 비중을 차지한다는 점에서 기록한다.
- 제안: 범위 이탈이 아님. 워크플로 정합.

## 요약

이 커밋은 이전 ai-review(23_02_30, MEDIUM·Critical 0)의 WARNING 해소를 목적으로 한 후속 커밋이다. 각 변경은 특정 리뷰 항목(W1 CORS 버그 수정, W6 미사용 logger 제거, W8/W9 패널 단위 테스트 신설, W10 flat-array 방어 분기 테스트, W11 API 테스트)에 일대일로 대응되며, 요청되지 않은 추가 기능 확장·불필요한 리팩토링·무관한 파일 수정이 발견되지 않는다. CORS 변경이 글로벌 레이어를 건드리지만 필요 최소한의 additive 수정이다. 이전 배치 리뷰 아티팩트 일괄 커밋은 워크플로 의무 이행이다. 전체 변경셋이 선언된 의도 범위 안에 있다.

## 위험도

NONE
