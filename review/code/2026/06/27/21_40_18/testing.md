# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `buildCosineMatch` I5 테스트 — dim 변이 미검증
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts`, I5 테스트 (lines 35–54)
- 상세: 새로 추가된 I5 테스트는 1536 차원만 사용한다. `buildCosineMatch` 내부의 `getEmbeddingCastType(dim)` 호출이 차원에 따라 다른 cast 타입을 생성하는데, 이 경로는 검증되지 않는다. `expect(sql).toContain('$1::')` 는 cast 타입 문자열 자체(`halfvec`, `vector` 등)가 올바른지 보장하지 않는다. `getEmbeddingCastType`이 회귀하더라도 이 테스트는 통과한다.
- 제안: 지원 차원 중 하나 추가(예: 3072) 케이스를 추가해 `castExpr` 문자열을 직접 assertions하거나, `getEmbeddingCastType`의 단위 테스트가 별도 존재함을 확인하면 충분하다. INFO 수준 — 기능 정확성에 영향 없음.

### [INFO] `readExtractionWatermark` — `memoryState`가 비객체인 경우 미테스트
- 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts`, `readExtractionWatermark` describe 블록
- 상세: 추가된 5개 테스트는 신 namespace, 구 평면 키 폴백, 우선순위, seq=0 경계, 부재/null 케이스를 잘 커버한다. 그러나 `state.memoryState`가 객체가 아닌 원시값(`"string"`, `42`)인 경우가 테스트되지 않는다. 현재 구현(`const ns = resumeState.memoryState as {...} | undefined; if (ns && ...)`)은 falsy 체크로 이를 안전하게 처리하지만, 명시적 테스트가 없다.
- 제안: `readExtractionWatermark({ memoryState: 'invalid' })` → `undefined` 케이스를 `숫자가 아니거나 부재면 undefined` 그룹에 추가한다. INFO 수준.

### [INFO] `updateSummaryState` — `conversationThread` 미초기화 컨텍스트 케이스 미테스트
- 위치: `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.spec.ts`, `updateSummaryState` describe 블록
- 상세: 구현이 `context.conversationThread as MutableConversationThread`를 직접 캐스트해 필드를 대입한다. 컨텍스트에 `conversationThread`가 없는 경우 런타임 오류가 발생할 수 있으나 이 경로가 테스트되지 않는다. 호출부(`ai-memory-manager.ts`)의 `summarized=true` 가드가 실질적 보호를 제공하지만, 테스트가 없으면 향후 호출부 추가 시 오용 위험이 잠재된다.
- 제안: "빈 컨텍스트(thread 없음)에서 호출 시 throw하지 않거나 graceful 처리" 케이스 혹은 JSDoc에 "항상 초기화된 컨텍스트에서만 호출할 것" 명시. INFO 수준 — 현재 유일 호출부가 안전하게 가드됨.

### [INFO] `information-extractor.memory.spec.ts` I12 폴백 테스트 — 간접 어설션
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.memory.spec.ts`, `I12: 구 평면 키 _resumeState.lastExtractionTurnSeq 로 resume 시 watermark 폴백` 테스트
- 상세: 폴백 동작을 `scheduleExtraction`이 호출되지 않는다는 간접 어설션으로 검증한다 (watermark=1_000_000이므로 전체 turns 필터). 폴백이 올바르게 동작하면 enqueue skip, 폴백 실패시 enqueue 발생 — 논리는 맞다. 그러나 `readExtractionWatermark`가 실제로 반환한 값을 직접 검증하지 않으므로, 폴백이 다른 이유로 우회되었을 때 오판 소지가 있다.
- 제안: `hydrateState` 직접 호출 테스트를 별도로 추가해 `state.lastExtractionTurnSeq = X`일 때 반환된 `memoryState?.lastExtractionTurnSeq`가 X임을 직접 어설션하는 방식을 고려한다. 또는 현재 통합 테스트 수준으로 충분하다고 판단해도 무방. INFO 수준.

### [INFO] `ai-agent.memory.spec.ts` `getWatermark` 헬퍼 — 구 평면 키 폴백 없음 명시
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts`, `getWatermark` helper (lines 752–757)
- 상세: `getWatermark` 헬퍼 JSDoc에 "신 namespace 만 읽는다 (구 평면 키 폴백 없음)"고 명확히 기술되어 있어 I12 회귀 보장 의도가 잘 표현되었다. 이로써 향후 watermark가 구 평면 키로 다시 떨어지면 테스트가 실패한다 — 의도적이고 올바른 설계다. 긍정적 패턴으로 기록.
- 제안: 없음.

### [INFO] `saveMemories` 옵션 객체 전환 — 테스트 누락 호출부 없음 확인
- 위치: `agent-memory.service.spec.ts`, `agent-memory-extraction.processor.spec.ts`
- 상세: diff에서 확인된 14곳의 `saveMemories` 호출이 모두 옵션 객체 형식으로 갱신됐다. 프로세서 테스트의 `mock.calls[0][0]` 구조분해 패턴 변경도 신규 시그니처와 일치한다. 포지셔널 인자 혼용 케이스가 남은 테스트에서 컴파일 오류 없이 통과됨(RESOLUTION.md에서 빌드 통과 확인)으로 검증 완료.
- 제안: 없음. 갱신 범위 적절.

## 요약

이번 변경(Batch 2)은 테스트 관점에서 매우 긍정적이다. 신규 유틸(`readExtractionWatermark`)에 우선순위·폴백·경계(seq=0)·부재 케이스를 망라한 5개 단위 테스트가 추가됐고, `updateSummaryState`에는 기본 동작·덮어쓰기·비간섭·클리어 4개 시나리오가 체계적으로 검증된다. `buildCosineMatch` 파라미터 순서 계약을 파라미터 배열 직접 어설션으로 핀고정한 I5 테스트, in-flight 하위호환 폴백을 검증하는 I12 통합 테스트, `memoryState` 병합 시 타 키 보존 테스트까지 모두 이전 리뷰(21_13_52)의 WARNING/INFO 채택 항목을 충실히 구현했다. `saveMemories` 포지셔널→옵션 마이그레이션도 14곳 전부 갱신되어 누락 없음. 테스트 격리, 가독성(헬퍼 개명 포함), 의도 표현 모두 수준 이상이다. 잔여 갭은 dim 변이·비객체 memoryState·비초기화 컨텍스트 케이스로 기능 정확성에는 영향 없는 INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
