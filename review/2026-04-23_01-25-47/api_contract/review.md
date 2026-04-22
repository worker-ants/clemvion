### 발견사항

- **[INFO]** `finishReason` 의 의미론적 변경 (프로바이더 보고값 → 서버 정규화)
  - 위치: `workflow-assistant-stream.service.ts` — `planProposedPendingApproval` 블록
  - 상세: 프로바이더가 `'tool_calls'` 로 종료해도 `planProposedPendingApproval` 조건이면 `done` 이벤트의 `finishReason` 을 `'stop'` 으로 덮어씀. 기존에도 `finishResolved=true` 경로에서 동일한 덮어쓰기가 발생하므로 클라이언트가 `finishReason` 을 "프로바이더 원문" 으로 신뢰하는 계약은 이미 성립하지 않음. 일관된 정규화 패턴 확장.
  - 제안: 현재 수준으로 충분. 다만 `AssistantStreamEvent` 타입 주석에 `finishReason: 'stop' | 'tool_calls' | 'error'` 명시 값을 문서화해 두면 프런트엔드 개발자가 프로바이더 raw 값이 아님을 명확히 인지할 수 있음.

- **[INFO]** plan 거부(`PLAN_AWAITING_APPROVAL`) `tool_call` SSE 이벤트가 여전히 클라이언트에 전달됨
  - 위치: 서비스 `kind === 'edit'` 분기 — SSE `tool_call` yield
  - 상세: 가드가 round-trip 을 차단해 "수십 개의 빨간 배지" 를 대폭 줄이지만, 동일 라운드 내 LLM 이 발사한 edit tool 들은 `ok:false, error:'PLAN_AWAITING_APPROVAL'` 결과와 함께 SSE 로 노출됨. 이는 기존 계약 유지이나, 프런트엔드가 `error:'PLAN_AWAITING_APPROVAL'` 를 "조용히 숨김" 처리하지 않는다면 소수의 빨간 배지는 여전히 노출될 수 있음.
  - 제안: 프런트엔드에서 `error === 'PLAN_AWAITING_APPROVAL'` 인 `tool_call` 이벤트를 배지 카운트에서 제외하거나 별도 스타일로 처리하는 계약을 추가하는 것을 고려.

---

### 요약

변경 범위는 SSE 스트림 서비스 내부 루프 제어 로직이며, 외부 API 엔드포인트·HTTP 상태 코드·요청/응답 스키마에 대한 변경이 없다. `done` 이벤트의 `finishReason` 정규화는 기존 코드베이스의 패턴과 일관되며, 새로운 SSE 이벤트 타입·필드 추가·제거 없이 동작 흐름만 조기 종료되는 방향으로 수정되었다. 클라이언트가 `finishReason='stop'` 을 기준으로 "승인 대기" UI 로 전환하도록 설계된 기존 계약과 완전히 호환된다.

### 위험도
**LOW**