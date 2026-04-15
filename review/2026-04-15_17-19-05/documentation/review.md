### 발견사항

- **[INFO]** `execution.snapshot` 이벤트 타입이 `ExecutionEventType` enum에 추가되었으나 실제로 `WebsocketService.emitExecutionEvent()`를 통해 발행되지 않음
  - 위치: `websocket.service.ts` — `ExecutionEventType.EXECUTION_SNAPSHOT`
  - 상세: `EXECUTION_SNAPSHOT` 은 gateway에서 직접 `client.emit()`으로 발행되므로 enum에 포함되는 것은 문서화 목적이지만, 이 사실이 명시되지 않아 다른 이벤트와 동일한 방식으로 사용 가능하다고 오해할 수 있음
  - 제안: enum 항목 주석에 "gateway에서 직접 발행되며 `emitExecutionEvent()`를 통하지 않음" 명시

- **[INFO]** `handleSnapshot` 함수가 `useEffect` 내부 클로저로 정의되어 있어 JSDoc 없음
  - 위치: `use-execution-events.ts:504`
  - 상세: 기존의 `pollExecutionStatus` 함수를 대체하는 핵심 로직이나, 교체 배경(REST 폴링 → WS 스냅샷)이 함수 레벨 주석이 아닌 인라인 주석으로만 설명됨. 변경 이유가 향후 유지보수자에게 충분히 전달됨
  - 제안: 현재 인라인 블록 주석 수준으로 충분, 추가 개선 불필요

- **[INFO]** `emitExecutionSnapshot` private 메서드에 JSDoc 없음
  - 위치: `websocket.gateway.ts:148`
  - 상세: 메서드의 목적(구독 직후 클라이언트에게 one-shot 스냅샷 전송), 에러 무시 정책(missing/forbidden), 반환 없음 등이 내부 주석으로만 설명됨
  - 제안: `private` 메서드이므로 현재 인라인 주석 수준으로 허용 가능

- **[INFO]** `createNodeExecution` 시그니처 변경 — `inputData?: unknown` 파라미터 추가 — 에 대한 문서화 없음
  - 위치: `execution-engine.service.ts:2719`
  - 상세: 내부 private 메서드이므로 공식 문서화 필요성은 낮으나, 파라미터 의미(`nodeInput` = resolved predecessor input)에 대한 JSDoc이 전혀 없음
  - 제안: INFO 수준으로 `@param inputData Resolved predecessor input stored on the NodeExecution row` 한 줄 추가 권장

- **[INFO]** WebSocket 이벤트 페이로드 스키마 문서화 없음
  - 위치: `websocket.gateway.ts` — `execution.snapshot` 이벤트 / `websocket.service.ts`
  - 상세: `execution.snapshot` 이벤트의 페이로드 구조(`{ executionId, execution, timestamp }`)가 코드에서만 유추 가능하며, 프론트엔드-백엔드 계약이 문서화되지 않음. 기존 이벤트들도 동일한 상황이므로 이번 변경에서만 특별히 문제가 되지는 않음
  - 제안: 추후 `spec/` 디렉토리의 WebSocket 이벤트 스펙 문서에 신규 이벤트 추가 권장

- **[INFO]** `getHandler` / `emitSnapshot` 헬퍼 함수에 JSDoc 추가됨 — 긍정적 변경
  - 위치: `use-execution-events.test.ts:57-67`
  - 상세: 두 테스트 유틸 함수 모두 JSDoc 블록 주석이 있어 테스트 코드 가독성 향상

---

### 요약

이번 변경은 REST 폴링을 WebSocket 스냅샷 방식으로 교체하는 아키텍처 전환으로, 핵심 변경 의도(`// This replaces the old REST GET /executions/:id polling loop`)가 전략적 위치에 명확하게 인라인 주석으로 기록되어 있어 문서화 품질이 전반적으로 양호합니다. 테스트 헬퍼 함수에 JSDoc이 추가된 점도 긍정적입니다. 다만 `ExecutionEventType.EXECUTION_SNAPSHOT`이 다른 enum 값과 달리 `emitExecutionEvent()`를 통하지 않는다는 사실, 그리고 새 WebSocket 이벤트 페이로드 구조가 `spec/` 문서에 반영되지 않은 점은 향후 유지보수 시 혼선을 줄 수 있으나 즉각적인 위험은 없습니다.

### 위험도

**LOW**