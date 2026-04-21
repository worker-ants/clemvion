### 발견사항

- **[INFO]** `AssistantToolCallKind`에 `'finish'` 리터럴 추가
  - 위치: `workflow-assistant-message.entity.ts` 13번 줄
  - 상세: 해당 필드는 `tool_calls` JSONB 컬럼 내부의 `kind` 속성에 저장된다. JSONB는 스키마 레벨에서 값을 제약하지 않으므로 **마이그레이션 불필요**하며, 기존 레코드에도 영향을 주지 않는다.
  - 제안: 현행 유지. 필요 시 향후 `kind IN (...)` 형태의 PostgreSQL CHECK CONSTRAINT 추가를 고려할 수 있으나 MVP에서는 과도함.

- **[INFO]** 차단된 `finish` 호출이 `tool_calls` JSONB에 영구 저장됨
  - 위치: `workflow-assistant-stream.service.ts` — `evaluateFinishGuard` 분기 내 `pendingToolCalls.push(...)` 및 `persistAssistantTurn`
  - 상세: `PLAN_NOT_COMPLETE`로 block된 `finish` tool call(에러 페이로드 포함)이 `pendingToolCalls`에 누적되어 어시스턴트 메시지의 `tool_calls` JSONB에 저장된다. 블록이 빈번하게 발생하는 플로우에서는 JSONB 크기가 증가하나, 한 턴 당 최대 1회 블록으로 제한되므로 실질적 영향은 미미하다.
  - 제안: 현행 유지. 만약 과거 데이터 분석이 필요하다면 `finishBlockCount` 카운터를 별도 컬럼으로 집계하는 방안을 장기적으로 고려.

- **[INFO]** `toChatMessages` 함수에서 rehydrate 시 `finish` kind 포함 전체 tool_call 처리
  - 위치: `workflow-assistant-stream.service.ts` 하단 `toChatMessages` 함수
  - 상세: 저장된 `tool_calls` 배열(finish 포함)이 다음 턴 LLM 호출 시 모두 history로 복원된다. 의도된 동작이며 DB 관점에서 추가 쿼리 없이 단일 `loadMessages` 호출로 처리되므로 N+1 문제 없음.
  - 제안: 현행 유지.

---

### 요약

데이터베이스 관련 변경은 `workflow-assistant-message.entity.ts`의 TypeScript 유니온 타입 확장 하나뿐이다. 실제 컬럼 타입은 `jsonb`(스키마리스)이므로 마이그레이션이 필요 없고, 기존 데이터와 완전히 하위 호환된다. 신규로 저장되는 blocked `finish` 레코드는 JSONB 크기를 소폭 증가시키지만 한 턴 최대 1회라는 제약 덕분에 실질적 위험은 없다. 인덱스(`sessionId + createdAt`)·트랜잭션·N+1·커넥션 관리 등 다른 DB 관심사는 이번 변경에서 영향을 받지 않는다.

### 위험도

**LOW**