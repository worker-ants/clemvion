# Architecture Review

## 발견사항

### [INFO] 도메인 타입 단일 진실 추출 — 올바른 방향
- 위치: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (신규)
- 상세: 기존에 `ai-conversation-helpers.ts`의 `LlmCallRecord`/`AiTurnDebugEntry`, `information-extractor.handler.ts`의 `LlmCallTrace`/`TurnDebugEntry`가 동일 JSONB 도메인을 이름만 달리해 중복 정의하던 것을 `shared/llm-tracing/` 모듈로 추출했다. `shared/conversation-thread/` 선례와 일치하며 DRY + 단일 진실 원칙 준수다.
- 제안: 변경 자체는 아키텍처적으로 올바르다. 추가 조치 없음.

---

### [WARNING] ai-agent.handler.ts 가 여전히 inline 익명 타입으로 동일 shape 중복 정의
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 1488, 2413
- 상세: 이번 PR 이 `information-extractor` 와 `ai-conversation-helpers` 의 중복 타입을 `LlmCallRecord` 로 통일했지만, `ai-agent.handler.ts` 내부에는 동일 shape(`requestPayload / responsePayload / durationMs / startedAt / finishedAt`)를 갖는 익명 `Array<{ ... }>` 가 두 군데(단일턴 경로 라인 1488, 멀티턴 경로 라인 2413)에 남아 있다. 이 PR 의 canonical SoT(`LlmCallRecord`)가 실질적으로 AI Agent 경로는 커버하지 않는 상태다. `LlmCallRecord` 를 도입했는데 가장 핵심 소비자인 AI Agent 가 anonymous struct 를 쓰면 향후 필드 추가·제거 시 AI Agent 경로만 drift 될 위험이 있다.
- 제안: `ai-agent.handler.ts` 의 두 `llmCalls` 선언을 `LlmCallRecord[]` 로 교체하고 `'../../../shared/llm-tracing/llm-call-record'` 를 import 한다. 객체 리터럴 push 사이트의 shape 은 이미 `LlmCallRecord` 와 호환되므로 타입 교체만으로 충분하다.

---

### [INFO] `TurnDebugEntry.llmCalls` / `totalDurationMs` optionality 확장 — 소비 사이트 폴백 미명시
- 위치: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts`
- 상세: 기존 IE 로컬 `TurnDebugEntry` 는 `llmCalls: LlmCallTrace[]`(필수), `totalDurationMs: number`(필수)였다. 신규 canonical 타입은 두 필드 모두 optional 로 통일했다. IE 생성 사이트는 모두 값을 채우므로 런타임 동작 무변이나, 소비 사이트가 이제 `totalDurationMs` 를 optional 로 읽어야 한다. 프론트엔드 WS 이벤트 payload 에서 `undefined` 가 노출될 가능성이 있다.
- 제안: 신규 canonical 타입 소비 사이트에서 `totalDurationMs ?? 0` 폴백을 명시하거나, JSDoc 에서 IE 생성 경로는 항상 값이 보장됨을 표기한다.

---

### [INFO] `shared/llm-tracing/` 모듈 — index.ts 없이 구현 경로 직접 노출
- 위치: `codebase/backend/src/shared/llm-tracing/`
- 상세: 두 소비자 모두 `../../shared/llm-tracing/llm-call-record` 경로로 직접 import 한다. 타입 파일이 하나뿐인 현재는 문제가 작지만, 모듈이 확장될 경우 import 경로 변경 비용이 발생한다.
- 제안: 선택 사항. `shared/llm-tracing/index.ts` 추가로 `export * from './llm-call-record'` 를 re-export 하면 소비자 경로를 `../../shared/llm-tracing` 으로 단축하고 캡슐화가 향상된다.

---

### [INFO] 의존성 방향 및 순환 참조 — 양호
- 위치: 전체 변경 범위
- 상세: `modules/execution-engine/ai-conversation-helpers.ts` → `shared/llm-tracing`, `nodes/ai/information-extractor/` → `shared/llm-tracing` 방향은 레이어 규약(nodes/modules → shared) 에 부합한다. 역방향(`shared` → `nodes` 또는 `modules`) 참조 없음. 순환 의존성 없음.
- 제안: 추가 조치 없음.

---

## 요약

이번 변경은 LLM 호출 trace 도메인 타입(`LlmCallRecord` / `TurnDebugEntry`)을 두 파일의 로컬 중복 정의에서 `shared/llm-tracing/llm-call-record.ts` 로 추출해 단일 진실을 확립한 올바른 리팩터링이다. 의존성 방향과 레이어 분리는 기존 규약을 준수한다. 핵심 미완 사항은 가장 큰 소비자인 `ai-agent.handler.ts` 가 동일 shape 의 익명 inline 타입을 두 군데에 여전히 유지한다는 점으로, 단일 진실의 실효 범위가 Information Extractor 와 execution-engine helper 에만 제한되어 있다. 이 gap 을 해소해야 PR 의 원래 목적이 완성된다. `TurnDebugEntry` optional 확장은 하위 호환이나 소비 사이트의 명시적 폴백 추가를 권장한다.

## 위험도

LOW
