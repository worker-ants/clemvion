### 발견사항

- **[INFO]** `finish` 툴의 block 횟수 계약 변경
  - 위치: `workflow-assistant-stream.service.ts` — `evaluateFinishGuard`, `finishBlockCount` / `editsSinceLastFinishBlock` 로직
  - 상세: 기존 계약은 "같은 턴 안에서 최대 1회 `PLAN_NOT_COMPLETE` block — 두 번째 finish 는 무조건 통과"였다. 변경 후에는 block 이후 진척(edit/plan 성공)이 있으면 몇 번이든 재차 block 할 수 있다. LLM 입장에서 `finish` 호출에 대한 tool_result 계약(`{ok: false, error: 'PLAN_NOT_COMPLETE', ...}`)의 발생 빈도가 변하며, 이 암묵적 계약에 의존하던 프롬프트·LLM 클라이언트가 영향받는다.
  - 제안: spec §10 및 `system-prompt.ts`에 이미 변경 내용이 반영되어 있어 내부 계약은 정합하다. 다만 `evaluateFinishGuard`의 JSDoc도 새 로직(progress-aware)으로 갱신하는 것이 좋다 (현재 함수 시그니처 주석의 `@param` 에 `editsSinceLastFinishBlock` 설명이 누락).

- **[INFO]** `handleSseEvent` / `summarizePlanState` export 추가
  - 위치: `assistant-store.ts:384`, `assistant-store.ts:569`
  - 상세: 두 함수가 `export`로 승격되었다. 모듈 공개 API가 확장되었으나 기존 소비자에게 breaking change는 없다. 테스트 목적 export이며 코드 주석에 명시(`Exported for unit testing`).
  - 제안: 테스트 전용 export라면 `@internal` JSDoc 태그를 추가하거나, 파일 내 `/* @internal */` 컨벤션을 따르는 것이 장기적으로 외부 소비를 막는 데 도움이 된다.

- **[INFO]** `systemHint` 우선순위 체인에 `planApprove` 분기 추가
  - 위치: `assistant-store.ts:511–547`
  - 상세: `done` 이벤트 처리 시 hint 우선순위가 `error > stalled > completed`에서 `error > stalled > planApprove > completed`로 바뀌었다. SSE 프로토콜(`event: done`)의 페이로드 형식 자체는 변경되지 않았다. 이 로직은 순수 클라이언트 상태이므로 외부 API 계약에 영향 없음.
  - 제안: spec §3.2 UI 테이블과 §13 i18n 키에 이미 반영되어 있어 문서 정합성은 양호.

- **[INFO]** `finish` 툴 SSE 응답 계약 자체는 불변
  - 위치: `workflow-assistant-stream.service.ts` 전체
  - 상세: `event: done`, `event: tool_call`, `event: plan`, `event: error` 이벤트의 payload shape는 변경되지 않았다. HTTP 엔드포인트(`POST /sessions/{id}/messages`)의 요청/응답 구조도 그대로다.

---

### 요약

이번 변경에서 외부 HTTP API 계약(엔드포인트 경로, 요청/응답 페이로드, SSE 이벤트 구조, HTTP 상태 코드)은 일절 수정되지 않았다. 핵심 변경은 서버↔LLM 사이의 내부 툴 계약인 `finish` block 정책(1회 상한 → 진척 기반 무제한 block)이며, 이는 spec §10과 `system-prompt.ts` 모두에 동기화되어 있어 내부 정합성은 유지된다. 유일한 잠재적 주의점은 `evaluateFinishGuard`의 JSDoc 미갱신으로, 향후 유지보수 시 혼란을 줄 수 있으나 런타임 동작에는 영향이 없다.

### 위험도

**LOW**