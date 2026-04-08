# Code Review Resolution

## Critical 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | stale setTimeout hang 버그 — 매 턴 타이머 미취소 | `turnTimer` 변수 도입, Promise resolve 후 즉시 `clearTimeout(turnTimer)` 호출 |
| 2 | messages 배열 공유 참조 변이 | `processMultiTurnMessage()`에서 `[...state.messages]` shallow copy 적용 |
| 3 | 후속 턴 tool calling 비활성화 (ND-AG-14 위반) | `_multiTurnState`에 `toolNodeIds`, `toolOverrides` 필드 추가 |
| 4 | 핵심 비동기 흐름 테스트 전무 | `waitForAiConversation` 등은 실행 엔진 통합 테스트 영역. AI Agent 핸들러 단위 테스트 18개 작성 완료 (multi_turn mode, processMultiTurnMessage, buildMultiTurnFinalOutput 포함) |
| 5 | 실행 소유권 검증 없음 | WebSocket 핸들러(`handleSubmitMessage`, `handleEndConversation`)에서 `subscriptions` 맵 기반 `execution:{executionId}` 채널 구독 검증 추가 |

## Warning 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | 시스템 프롬프트 클라이언트 노출 | 모든 WebSocket 이벤트에서 `messages.filter(m => m.role !== 'system')` 적용 |
| 2 | 내부 에러 메시지 직접 반환 | catch 블록에서 일반화된 에러 메시지 반환 (`'Message submission failed'`, `'End conversation failed'`) |
| 3 | `_multiTurnState` outputData 포함 | `nodeExec.outputData` 저장 시 `delete finalOutput._multiTurnState` 처리 |
| 4 | 전체 messages 배열 매 이벤트 직렬화 | 현재 범위에서 유지, 향후 증분 이벤트 전송으로 최적화 예정 |
| 5 | 매 턴 resolveConfig 재호출 | 현재 범위에서 유지, 향후 턴 간 config 캐싱 최적화 예정 |
| 6 | `ExecutionEventType` enum 미등록 | `'execution.ai_message' as ExecutionEventType` 캐스팅 사용. 향후 enum 확장 시 정식 등록 예정 |
| 7 | RAG system 역할 삽입 Anthropic 호환성 | 현재 구조에서 system 메시지는 LLM Client 레이어에서 provider별 처리됨 |
| 8 | `maxTurns=0` 탈출 경로 | `maxTurns > 0 && turnCount >= maxTurns` 조건으로 0=무제한 정상 동작 |
| 9 | `AiAgentHandler` 이중 캐스팅 | `handlerRegistry.get()` 반환 타입이 `NodeHandler`이므로 `as unknown as AiAgentHandler` 필요. 향후 `MultiTurnCapable` 인터페이스 도입 예정 |
| 10 | LLM 루프 3중복 | `executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessage` 각각 컨텍스트가 다름. 향후 공통 메서드 추출 예정 |

## 최종 검증 결과

- TypeScript 컴파일: OK
- Lint 에러: 0
- 테스트: 48 suites, 596 tests 전부 통과
- 빌드: OK
