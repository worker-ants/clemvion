# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] ToolCallStartedPayload.startedAt 필드가 optional 로 추가됨
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` L113
- 상세: `startedAt?: string` 으로 선언되어 기존 클라이언트가 해당 필드 없이도 동작 가능. 하위 호환성 유지됨.
- 제안: 향후 해당 필드가 항상 존재함이 보장되면 `required` 로 승격하여 클라이언트가 null-guard 없이 소비할 수 있도록 검토.

### [INFO] ToolCallCompletedPayload 에 startedAt/finishedAt 쌍이 optional 로 추가됨
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` L122-124
- 상세: 두 필드 모두 optional. 기존 `durationMs` 필드는 required 를 유지하므로 기존 클라이언트 계약 미변경.
- 제안: `startedAt`/`finishedAt` 을 동시에 absent 또는 동시에 present 로 강제해야 하는 불변식이 있다면, TypeScript 수준의 discriminated union 또는 문서화로 명시하는 것을 권장. 현재는 한쪽만 누락될 수 있어 클라이언트에서 방어 분기가 두 배로 필요할 수 있음.

### [INFO] 내부 LlmCallRecord 인터페이스에 타이밍 필드 추가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L87-88
- 상세: 내부 상태 인터페이스 변경으로 외부 API 계약에 직접 노출되지 않음. WS wire envelope 에는 `execution.ai_message` 의 `llmCalls[]` 를 통해 간접 전파됨. 해당 배열이 외부 fanout 에서 `EXTERNAL_STRIPPED_FIELDS` 에 의해 strip 되므로 외부 API 계약 영향 없음.
- 제안: 해당 없음.

### [INFO] 프론트엔드 ConversationItem 소비 코드가 timestamp 결측을 방어적으로 처리
- 위치: `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx` L107, `conversation-inspector.tsx` 여러 곳
- 상세: `item.timestamp && ...` 패턴으로 결측 시 렌더링 생략. optional 필드로 추가한 서버 계약과 일치.
- 제안: 해당 없음.

## 요약

이번 변경은 WebSocket 이벤트 페이로드(`ToolCallStartedPayload`, `ToolCallCompletedPayload`) 에 ISO8601 타이밍 필드(`startedAt`, `finishedAt`)를 모두 optional 로 추가한 backward-compatible 확장이다. 신규 필드는 기존 클라이언트가 무시하면 되므로 breaking change 가 없으며, 내부 debug 전용 `llmCalls[]` 경로는 외부 fanout 에서 strip 되어 외부 API 계약에 노출되지 않는다. 프론트엔드 소비 코드도 결측을 방어적으로 처리하고 있어 API 계약 관점의 위험 사항은 발견되지 않았다.

## 위험도

LOW
