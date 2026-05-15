### 발견사항

---

- **[WARNING]** `execution.resumed` 이벤트 스펙 누락
  - 위치: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 목록
  - 상세: `waitForAiConversation()` 종료 시 `EXECUTION_RESUMED` 이벤트를 emit하지만, WebSocket 프로토콜 스펙의 서버→클라이언트 이벤트 목록에 `execution.resumed`가 없음. 신규 AI 대화 관련 이벤트는 상세한 JSON 예시와 함께 잘 문서화된 반면, `execution.resumed`는 form/button 인터랙션에서도 emit되는 이벤트임에도 스펙에 정의되지 않은 상태
  - 제안: §4.1에 `execution.resumed | { executionId, status } | 일시 정지된 실행 재개 (폼 제출, 버튼 클릭, AI 대화 종료 시)` 항목 추가

- **[WARNING]** `_multiTurnState` 내부 계약 구조 미정의
  - 위치: `spec/4-nodes/3-ai-nodes.md`
  - 상세: 스펙에 Multi Turn 실행 로직과 출력 구조는 명시되어 있으나, `_multiTurnState` 객체의 필드 구조(llmConfigId, model, messages, turnCount, maxTurns, toolNodeIds 등)가 정의되어 있지 않음. 이 상태는 `execution-engine.service.ts`에서 직접 필드 접근(`multiTurnState.messages`, `multiTurnState.turnCount` 등)하므로 암묵적 계약이 코드에만 존재함
  - 제안: 스펙에 "내부 상태 구조 (Multi Turn State)" 섹션 추가 또는 코드에 `MultiTurnState` TypeScript 인터페이스 정의

- **[INFO]** `processMultiTurnMessage` 공개 메서드 JSDoc의 `state` 파라미터 설명 불충분
  - 위치: `ai-agent.handler.ts` — `processMultiTurnMessage`
  - 상세: `@param state` 설명이 없고, `Record<string, unknown>` 타입만으로는 어떤 필드가 필수인지 알 수 없음 (llmConfigId, messages, turnCount, maxTurns, workspaceId 등이 모두 필수)
  - 제안: `@param state` 설명에 필수 필드 목록 명시 또는 `MultiTurnState` 인터페이스로 타입 교체

- **[INFO]** `buildMultiTurnFinalOutput` 공개 메서드 JSDoc 미작성
  - 위치: `ai-agent.handler.ts` — `buildMultiTurnFinalOutput`
  - 상세: 메서드가 `public`이고 `execution-engine.service.ts`에서 직접 호출되지만 JSDoc이 없음. 반환 타입이 `unknown`이라 출력 구조를 코드만으로는 파악하기 어려움
  - 제안: `@param`과 `@returns` 추가 — 반환 구조(`response`, `messages`, `turnCount`, `endReason`, `metadata`)를 문서화

- **[INFO]** `'execution.ai_message' as ExecutionEventType` 강제 캐스팅에 설명 주석 없음
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()` ai_message emit 부분
  - 상세: `ExecutionEventType` enum에 등록되지 않은 값을 캐스팅으로 우회하는 이유가 주석으로 설명되지 않음. 유지보수자가 버그로 오인하거나 enum 등록 필요성을 인지하지 못할 수 있음
  - 제안: `// TODO: ExecutionEventType enum에 EXECUTION_AI_MESSAGE 추가 필요` 주석 추가 또는 즉시 enum에 등록

- **[INFO]** `handleSubmitMessage` / `handleEndConversation` WebSocket 핸들러 JSDoc 없음
  - 위치: `websocket.gateway.ts`
  - 상세: 신규 추가된 두 핸들러 모두 JSDoc 없음. 특히 `handleEndConversation`에서 `data.nodeId`를 파라미터로 받지만 실제로 사용하지 않는데, 이 이유가 코드에 전혀 설명되어 있지 않음
  - 제안: 핸들러 목적, 파라미터 설명, ACK 이벤트명을 JSDoc으로 기술. `nodeId` 미사용 이유(향후 검증 용도 등) 주석 명시

- **[INFO]** `turnTimeout` 힌트 텍스트 정보 중복/불명확
  - 위치: `ai-configs.tsx` — `NumberField` hint 속성
  - 상세: 레이블이 `Turn Timeout (sec)`으로 단위를 이미 표시하고, 힌트는 `"Max wait time for user response"`로 단위 없이 목적만 기술. 기본값(1800초)도 힌트에서 확인 불가
  - 제안: `hint="Seconds to wait for user response (default: 1800)"` 형태로 단위와 기본값을 함께 명시

---

### 요약

PRD, 스펙, 구현 코드 간 전반적인 문서화 일관성은 양호하며, WebSocket 프로토콜 스펙에 신규 AI 대화 이벤트가 JSON 예시와 함께 상세히 문서화된 점은 긍정적이다. 그러나 `execution.resumed` 이벤트가 스펙에 누락되어 있고, `_multiTurnState` 내부 계약 구조가 코드에만 암묵적으로 존재하며, 공개 메서드(`processMultiTurnMessage`, `buildMultiTurnFinalOutput`)의 JSDoc이 미흡한 점이 개선이 필요한 부분이다. `execution.resumed` 스펙 누락은 클라이언트 구현자가 재개 신호를 처리하지 못하는 실질적 문제로 이어질 수 있어 우선 조치가 권장된다.

### 위험도
**LOW**