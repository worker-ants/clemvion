# 보안(Security) 리뷰

## 발견사항

### [INFO] saveMemories 런타임 가드 에러 메시지 — 내부 함수명 노출
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — 신규 추가 가드 `throw new Error('saveMemories: args must be an options object')`
- 상세: 에러 메시지에 내부 메서드명 `saveMemories`가 포함된다. 이 에러가 HTTP 응답 body에 그대로 직렬화되는 경우 경미한 정보 노출이 될 수 있으나, 이 메서드는 서버 내부 백엔드 서비스 계층(NestJS 서비스)으로 호출 경로가 공개 HTTP 엔드포인트와 직접 연결되지 않는다. 일반적으로 NestJS의 Exception Filter가 500 등으로 변환하여 메시지 원문이 클라이언트에 노출되지 않는다. 실질 위험도는 없다.
- 제안: 없음. 현재 아키텍처에서 이 에러가 사용자에게 직접 노출되지 않으므로 수용 가능하다.

### [INFO] 런타임 가드 — null 과 비객체 모두 차단, 프로그래밍 오류 조기 감지
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `if (typeof args !== 'object' || args === null) throw`
- 상세: 이번 변경으로 추가된 가드는 구 포지셔널 API 오용(첫 인자로 문자열 전달)을 무음 no-op 대신 즉시 에러로 전환한다. `typeof ... !== 'object'`와 `=== null` 이중 조건이 모두 올바르게 사용됐다(JavaScript에서 `typeof null === 'object'`이므로 null 별도 차단 필수). 보안 관점에서 이 가드는 방어적 프로그래밍 개선이며 취약점 유입이 없다.
- 제안: 없음.

### [INFO] readExtractionWatermark 원시값 폴백 테스트 — 타입 오염 방어
- 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` — 신규 추가 테스트 `'memoryState 가 원시값(오염된 state)이면 폴백 후 undefined (방어)'`
- 상세: `memoryState`가 문자열 `'invalid'` 또는 숫자 `42`로 오염된 경우 `readExtractionWatermark`가 `undefined`를 반환하고, 구 평면 키 폴백도 올바르게 동작함을 검증한다. 이는 Redis 역직렬화 오염이나 외부 입력에 의한 상태 오염 시나리오를 방어적으로 커버한다. 런타임 타입 체크(`typeof ns.lastExtractionTurnSeq === 'number'`)가 적절히 작동함을 확인하는 긍정적 테스트다.
- 제안: 없음.

### [INFO] 이전 리뷰(21_40_18) 인계 항목 — 본 diff 범위 외 기존 사항
- 위치: 이전 세션 security.md의 `dim SQL 보간`, `memoryState spread 키 오염`, `간접 프롬프트 인젝션`, `hydrateState as 캐스트` 4건
- 상세: 이전 세션(21_40_18)에서 전부 INFO로 분류된 항목들이며, 본 diff(커밋 20771c845c)에서 추가적으로 이 경로가 변경되지 않았다. 선행 리뷰 판정과 동일하게 현 위험도 유지.
- 제안: 없음. 기존 처리 현황 그대로 유지.

---

## 요약

본 커밋(20771c845c)의 프로덕션 코드 변경은 `agent-memory.service.ts`의 `saveMemories` 첫 줄에 추가된 런타임 타입 가드 1줄이 전부다. 이 변경은 구 포지셔널 API 오용 시 무음 no-op 대신 즉시 에러를 발생시켜 프로그래밍 오류 감지를 강화한다. 에러 메시지에 내부 메서드명이 포함되나, NestJS 서비스 계층의 구조상 사용자에게 직접 노출될 경로가 없다. `agent-memory-injection.spec.ts`에 추가된 원시값 오염 폴백 테스트는 Redis 역직렬화 오염 시나리오를 방어적으로 커버한다. 하드코딩된 시크릿, 인증/인가 변경, 암호화 문제, 인젝션 취약점, 신규 외부 입력 경로가 이번 diff에 전혀 존재하지 않으며, 보안 관점에서 기존 대비 위험도를 낮추는 방어적 리팩터링으로 평가된다.

## 위험도

NONE

STATUS: SUCCESS
