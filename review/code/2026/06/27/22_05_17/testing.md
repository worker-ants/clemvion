# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `saveMemories` W-1 가드 — `null` 분기 미검증
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` — 신규 `I3/W-1` 테스트
- 상세: 추가된 가드 코드는 `typeof args !== 'object' || args === null` 두 분기를 포함한다. 테스트는 문자열(`'ws-1'`) 인자로 `typeof !== 'object'` 분기만 검증한다. `null`을 넘기는 `args === null` 분기는 독립적으로 검증되지 않는다. 현실적으로 `null`을 전달하는 호출부는 드물고, `typeof null === 'object'`이므로 `null` 체크는 방어적 추가 조건이다. 기능 정확성 영향 없음.
- 제안: `await expect(service.saveMemories(null as any)).rejects.toThrow('args must be an options object')` 케이스를 추가하면 두 분기를 완전히 커버한다. INFO 수준 — 실제 버그 위험 없음.

### [INFO] `saveMemories` W-1 가드 — 에러 메시지 매칭 방식
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` — `I3/W-1` 테스트 `.toThrow('args must be an options object')`
- 상세: `toThrow` 는 substring 매칭을 수행한다. 실제 에러 메시지는 `'saveMemories: args must be an options object'` 이므로 현재 패턴 `'args must be an options object'` 는 정확히 매칭된다. 그러나 메시지가 장래에 변경되더라도 substring 이 겹치면 테스트가 거짓 통과할 수 있다. 현재는 위험 없음.
- 제안: `.toThrow(/^saveMemories: args must be an options object$/)` 처럼 정규식으로 정확한 메시지를 고정하면 메시지 변경 시 즉시 탐지 가능. 선택적 개선.

### [INFO] `readExtractionWatermark` I-10 테스트 — 이전 리뷰 갭 해소 확인
- 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` — 신규 `memoryState가 원시값이면 폴백 후 undefined` 테스트
- 상세: 이전 리뷰 세션(21_40_18)에서 INFO로 지적된 `memoryState` 비객체 케이스 미테스트 갭이 정확히 해소됐다. 문자열(`'invalid'`)·숫자(`42`) 두 원시값 타입과, 원시값+구 평면 키 동시 존재 시 폴백 경로까지 세 케이스를 커버한다. 구현의 `typeof resumeState?.memoryState === 'object'` 체크와 테스트가 일치한다.
- 제안: 없음. 커버리지 갭이 완전히 해소됐다.

### [INFO] 이전 리뷰(21_40_18) 잔여 갭 — 이번 커밋 범위 외
- 위치: 복수 파일
- 상세: 이전 리뷰 세션(21_40_18)에서 발견된 잔여 INFO 갭은 다음과 같으며, 이번 커밋 범위 밖이다:
  1. `buildCosineMatch` dim 변이 미검증 — 1536 차원만 테스트, `getEmbeddingCastType` 회귀 보호 없음
  2. `updateSummaryState` — conversationThread 미초기화 컨텍스트(thread 없음) 케이스 미테스트
  3. `information-extractor.memory.spec.ts` I12 폴백 테스트 — `scheduleExtraction` 미호출 간접 어설션, `hydrateState` 반환값 직접 검증 부재
- 제안: 세 갭 모두 기능 정확성 영향 없는 INFO 수준으로 이번 커밋에서 대응 불필요. 향후 테스트 강화 시 참고.

### [POSITIVE] W-1 테스트 설계 — `@ts-expect-error` 활용 적절
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` — `I3/W-1` 테스트
- 상세: `// @ts-expect-error 구 포지셔널 호출 시뮬레이션 — 런타임 계약 가드 검증.` 주석과 함께 `@ts-expect-error`를 사용해 TypeScript 오류를 의도적으로 억제하면서 런타임 계약 가드를 검증한다. 컴파일 타임 타입 안전성을 우회하는 테스트 의도가 명확하게 표현되어 있고, 억제 이유가 주석으로 문서화되어 있다.

### [POSITIVE] I-10 테스트 — 케이스 조합 구성 충실
- 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` — I-10 신규 테스트
- 상세: 단순 문자열, 숫자, 그리고 원시값+구 평면 키 혼합의 세 조합을 단일 테스트 블록에서 효율적으로 검증한다. 세 번째 케이스(`{ memoryState: 'x', lastExtractionTurnSeq: 5 }` → `5`)는 `memoryState` 오염과 동시에 구 평면 키 폴백이 올바르게 동작함을 확인하는 회귀 방어 케이스로 설계 의도가 명확하다.

## 요약

이번 커밋은 이전 리뷰(21_40_18)에서 도출된 두 가지 테스트 갭을 직접 해소하는 최소 단위 변경이다. `saveMemories` W-1 런타임 가드 테스트(`I3/W-1`)는 구 포지셔널 호출 오용이 무음 no-op로 삼켜지는 것을 방지하는 계약을 `@ts-expect-error`를 활용해 명시적으로 검증한다. `readExtractionWatermark` I-10 테스트는 `memoryState`가 비객체(문자열/숫자) 원시값일 때 안전하게 `undefined`로 폴백하고, 동시에 구 평면 키 폴백도 올바르게 동작함을 세 케이스로 커버한다. 두 테스트 모두 격리성이 양호하고 의도가 명확하게 표현되어 있다. `null` 분기 단독 테스트 미비와 에러 메시지 substring 매칭 방식이 미세한 개선 여지로 존재하나, 기능 정확성에 영향 없는 INFO 수준이다. 이전 리뷰(21_40_18)의 잔여 INFO 갭 3건(dim 변이·updateSummaryState 비초기화·IE 간접 어설션)은 이번 커밋 범위 밖이며 기존 판정을 변경하지 않는다.

## 위험도

NONE

STATUS: SUCCESS
