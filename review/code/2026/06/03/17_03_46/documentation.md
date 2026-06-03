### 발견사항

- **[INFO]** `LlmCallRecord` 인터페이스 신규 필드에 JSDoc 작성됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `LlmCallRecord` 인터페이스 (diff 내 `+startedAt?`/`+finishedAt?` 블록)
  - 상세: `/** ISO8601 — LLM 호출 시작/종료 절대 시각 ... spec/5-system/6-websocket-protocol.md §4.4 */` 주석이 두 필드를 묶어 설명. Spec 참조 포함.
  - 제안: 현 상태 양호. `finishedAt` 에도 별도 줄 주석을 달면 IDE 툴팁에서 개별 확인 가능하나 필수는 아님.

- **[INFO]** `ToolCallStartedPayload.startedAt`, `ToolCallCompletedPayload.startedAt`/`finishedAt` JSDoc 완비
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — 각 interface 내 신규 필드
  - 상세: ISO8601 명시, Spec SoT 링크(`spec/5-system/6-websocket-protocol.md §4.4`) 포함. wire-shape 변경에 대한 frontend 동기화 경고(`keep the two in sync`)가 `ToolCallStartedPayload` JSDoc 상단에 이미 존재하며, 신규 선택적 필드 추가이므로 breaking-change 아님.
  - 제안: 현 상태 양호.

- **[INFO]** `ToolCallTrace.startedAt`/`finishedAt` JSDoc
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `ToolCallTrace` 인터페이스
  - 상세: `startedAt` 에 Spec 참조 JSDoc 있음. `finishedAt` 에도 단독 JSDoc 추가됨. 양호.

- **[INFO]** 프론트엔드 내부 인터페이스(`LlmCallEntry`, `TurnToolCallEntry`, `ToolStatusInfo`) JSDoc
  - 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts`
  - 상세: 세 인터페이스 모두 신규 필드에 한국어+ISO8601+Spec §4.4 참조 주석 포함. 내부 private 인터페이스 수준으로 적절.

- **[INFO]** 인라인 구현 주석 일관성
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 초기 LLM 호출(diff `+startedAt: new Date(callStartedAt).toISOString()` 4곳) / `codebase/frontend/src/lib/conversation/conversation-utils.ts` — `messagesToConversationItems` 내 `timestamp: callDebug?.startedAt` 할당부
  - 상세: 각 할당 위치에 `// spec/conventions/conversation-thread.md §9.12` 또는 `// §9.12` 참조 주석이 인라인으로 달려 있어 이유가 명확히 추적 가능. 좋은 패턴.

- **[WARNING]** 프론트엔드 컴포넌트 4곳에서 반복되는 timestamp/duration 렌더 패턴에 추출 없이 인라인 확산
  - 위치:
    - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` (diff 내 4개 독립 블록)
    - `codebase/frontend/src/components/editor/run-results/result-timeline.tsx` (diff 내 2개 블록)
    - `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx`
    - `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`
  - 상세: 동일한 `{item.timestamp ? formatDate(...) : ""}{item.timestamp && item.durationMs != null ? " · " : ""}{item.durationMs != null ? ... : ""}` 패턴이 최소 6~7곳에 복제됨. 각 블록에 `{/* §9.12 ... */}` 주석이 붙어 있어 의도는 이해 가능하나, 공유 유틸 함수/컴포넌트(`TimestampDuration` 등)로 추출했다면 주석 위치도 단일화할 수 있었음.
  - 제안: 현재 리뷰 범위에서 문서화 결함은 아니나, 추후 `formatTimestampAndDuration(timestamp, durationMs)` 헬퍼 함수를 추출하고 JSDoc 한 곳에 집중시킬 것을 권장.

- **[INFO]** 테스트 파일 인라인 주석
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts`, `codebase/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts`
  - 상세: 각 신규 테스트 케이스 상단에 spec 참조 주석이 달려 있어 테스트 의도가 명확. `// spec/5-system/6-websocket-protocol.md §4.4 — llmCalls[].startedAt/finishedAt` 형식은 일관적.

- **[INFO]** README/CHANGELOG 미업데이트
  - 위치: 프로젝트 루트 또는 `codebase/` 내 CHANGELOG
  - 상세: 이 변경은 내부 wire payload 타임스탬프 추가 + UI 표시 확장으로 사용자/통합자에게 가시적인 동작 변경이 발생함. 그러나 이 프로젝트는 spec 기반 개발로 `spec/5-system/6-websocket-protocol.md §4.4`에 이미 문서화되어 있고, README나 CHANGELOG 관리 규약이 별도 존재하는지 확인 불가. Spec이 단일진실(SoT) 역할을 하므로 심각한 결함은 아님.
  - 제안: 외부 API/SDK 소비자가 있다면 `ToolCallStartedPayload.startedAt`, `ToolCallCompletedPayload.startedAt`/`finishedAt` 필드 추가를 CHANGELOG에 기록할 것을 권장.

- **[INFO]** `spec/conventions/conversation-thread.md §9.12` 참조가 다수 프론트엔드 파일에 사용되나 해당 spec 내용을 이 리뷰에서 직접 확인 불가
  - 상세: Spec 참조가 일관되게 사용되고 있어 문서화 추적성은 충분함.

### 요약

이번 변경은 LLM 호출 및 툴 실행의 절대 발생 시각(`startedAt`/`finishedAt`)을 백엔드 인터페이스부터 프론트엔드 렌더링까지 전방위로 추가한 기능이다. 공개 인터페이스(`ToolCallStartedPayload`, `ToolCallCompletedPayload`, `ToolCallTrace`, `LlmCallRecord`)에는 ISO8601 명시와 spec 참조가 포함된 JSDoc이 작성되어 있고, 구현부 인라인 주석도 §9.12/§4.4 참조로 일관적으로 달려 있어 문서화 품질은 전반적으로 양호하다. 단, 프론트엔드 컴포넌트 6~7곳에 동일한 timestamp+duration 렌더 패턴이 복제되어 있어 공유 헬퍼 추출이 권고되며, 외부 API 소비자가 있다면 CHANGELOG 업데이트를 고려할 필요가 있다.

### 위험도

LOW
