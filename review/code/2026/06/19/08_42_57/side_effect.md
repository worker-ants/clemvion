# 부작용(Side Effect) Review

## 발견사항

### [INFO] 타입 전용 변경 — 런타임 부작용 없음
- 위치: 3개 파일 전체
- 상세: 변경의 핵심은 `interface LlmCallTrace` / `interface AiTurnDebugEntry` (로컬 private 정의) 를 삭제하고 `shared/llm-tracing/llm-call-record.ts` 의 `LlmCallRecord` / `TurnDebugEntry` 로 교체한 것이다. 모두 `import type` 경로이므로 TypeScript 컴파일 후 JS 런타임에 흔적이 남지 않는다. 전역 변수·상태·파일시스템·네트워크·환경변수에 대한 부작용은 발생하지 않는다.
- 제안: 없음.

### [INFO] 타입 구조 완화 — 필수 필드가 선택 필드로 변경
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (구 `LlmCallTrace` 삭제), `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (신 `LlmCallRecord`)
- 상세: 구 `LlmCallTrace` 는 `requestPayload`, `responsePayload`, `durationMs` 가 모두 필수였다. 신 `LlmCallRecord` 는 세 필드 모두 선택(optional)이다. 구 `TurnDebugEntry` 는 `llmCalls`, `totalDurationMs` 가 필수였지만 신 `TurnDebugEntry` 는 선택이다. 이 완화는 TypeScript 타입 수준에서 "기존 생성 코드가 필드를 누락해도 컴파일 오류가 사라진다"는 뜻이나, 실제 생성 사이트(`traceChat` 반환 객체, `buildSingleTurnDebug` 리터럴)는 여전히 세 필드를 채우므로 런타임 데이터 shape 은 변하지 않는다. AI Agent handler 의 인라인 `llmCalls` 배열 타입과 새 `LlmCallRecord` 사이에도 구조적 호환성이 유지된다.
- 제안: 없음 (타입 완화는 의도된 superset 설계이며 문서화됨).

### [INFO] AI Agent handler 는 아직 인라인 익명 타입 사용 중
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:1488`
- 상세: AI Agent handler 의 `llmCalls` 배열이 신 공유 `LlmCallRecord` 로 마이그레이션되지 않고 인라인 익명 타입으로 남아있다. 이번 변경 범위 밖이므로 현재 부작용 위험은 없으나, PR 설명이 "AI Agent 와 단일 진실 공유"를 목표로 명시했다면 완전한 통일이 아직 이뤄지지 않은 상태다. 동작상 차이는 없다.
- 제안: 후속 PR 에서 AI Agent handler 도 `LlmCallRecord` 로 교체하면 선언 목표가 완성된다.

### [INFO] 프론트엔드 `LlmCallTrace` 는 별도 독립 타입으로 유지
- 위치: `codebase/frontend/src/components/editor/run-results/llm-call-trace.ts`
- 상세: 프론트엔드는 자체 `LlmCallTrace` 인터페이스(`turnIndex`, `callIndexInTurn`, `requestPayload`, `responsePayload`, `durationMs?`)를 유지한다. 이 타입은 이번 변경과 무관하게 독립적으로 존재한다. 백엔드 `LlmCallRecord` 와 명시적 공유 관계가 없으므로 프론트엔드가 기대하는 JSON shape(`requestPayload`, `responsePayload`, `durationMs`)는 백엔드 생성 코드가 계속 채우는 한 유지된다.
- 제안: 없음 (백엔드-프론트엔드 계약은 JSON wire 포맷으로 관리되며 이번 변경은 해당 포맷을 변경하지 않음).

## 요약

이번 변경은 순수 타입-레벨 리팩터링으로 런타임 부작용이 없다. 삭제된 `LlmCallTrace` / `AiTurnDebugEntry` 는 파일 스코프 인터페이스였고 외부에 export 되지 않았으므로 시그니처·인터페이스 변경에 따른 호출자 영향도 없다. 공개 함수 `buildAiMessageDebugFromResumeState` 의 반환 타입 `{ llmCalls?: LlmCallRecord[]; durationMs?: number }` 는 이전 `AiTurnDebugEntry` 를 직접 사용하지 않았으므로 시그니처 변경 없음. 신규 파일 `llm-call-record.ts` 는 타입 선언만 포함하고 런타임 실행 코드가 없다. 전역 변수, 파일시스템, 네트워크, 환경변수, 이벤트 발행에 대한 부작용은 전혀 없다.

## 위험도

NONE
