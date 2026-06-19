# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] AI agent handler의 로컬 인라인 타입 미통합

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (L1488–1494)
- 상세: `ai-agent.handler.ts` 는 여전히 `llmCalls` 를 `Array<{ requestPayload: unknown; responsePayload: unknown; durationMs: number; startedAt?: string; finishedAt?: string; }>` 로 인라인 정의한다. 이 PR 의 의도("AI Agent · Information Extractor 와 단일 진실 공유")가 AI agent 쪽은 미완이라는 뜻이다. 코드 주석 및 `llm-call-record.ts` 모듈 JSDoc 에 "AI Agent · Information Extractor · 기타 LLM 노드가 공유" 라고 명시되어 있으나 AI agent 핸들러는 변경되지 않았다.
- 판단: 이것 자체가 scope 초과는 아니다 — PR 작성자가 AI agent 통합을 이번 PR 범위 밖으로 의도적으로 남겨둔 것으로 볼 수 있다. 단, 주석·JSDoc 이 "공유 완료" 처럼 읽혀 현재 상태를 과장한다. 버그나 런타임 문제는 아니므로 INFO 로 분류한다.
- 제안: `llm-call-record.ts` 모듈 JSDoc 또는 AI agent handler 주석에 "AI Agent 쪽 마이그레이션은 별도 PR" 임을 명시하거나, 이번 PR 에 AI agent handler 통합을 포함시킨다.

### [INFO] `TurnDebugEntry` 필드 optionality 완화 — 타입 변환 방향 확인

- 위치: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (L33–36)
- 상세: 기존 IE handler 의 `TurnDebugEntry` 는 `llmCalls: LlmCallTrace[]` (필수)·`totalDurationMs: number` (필수)였다. 신규 shared `TurnDebugEntry` 는 두 필드 모두 optional(`?`). 이는 기존 대비 타입이 더 넓어진(관대해진) 변경이다. IE handler 의 `buildSingleTurnDebug` 는 `{ turnIndex, llmCalls, totalDurationMs }` 를 모두 채워 반환하므로 실제 런타임 값에는 차이가 없고, `buildAiMessageDebugFromResumeState` 는 이미 optional 가드(`?.`)로 처리한다. 타입 호환 방향은 안전하다(하위 생성자 → 상위 수신자). 단, "반드시 채워진다"는 계약을 런타임으로 내려보낸 점은 INFO 수준의 관찰이다.
- 제안: 필요 시 생성 시점(`buildSingleTurnDebug` 등)을 `Required<TurnDebugEntry>` 로 좁혀 static 계약을 유지하거나, 현 설계(all-optional superset)를 JSDoc 에 명확히 설명한다 (이미 `llm-call-record.ts` JSDoc 에 어느 정도 설명되어 있음).

---

## 요약

이번 PR 은 IE handler 와 `ai-conversation-helpers` 에 각각 중복 정의되어 있던 LLM trace 도메인 타입(`LlmCallRecord`/`TurnDebugEntry` 계열)을 `shared/llm-tracing/llm-call-record.ts` 단일 canonical 정의로 통합하는 순수 타입 정리 작업이다. 변경된 파일은 정확히 3개(shared 신규 파일 1개 + 기존 2개 수정)이며, 행위 변경(로직·직렬화 shape)은 없다. 기능 추가·불필요한 리팩토링·무관한 파일 수정·포맷팅 잡음은 없다. 유일한 관찰 사항은 AI agent handler 쪽이 아직 같은 shared 타입으로 전환되지 않아 JSDoc 의 "공유" 선언과 실제 상태가 약간 불일치한다는 점이나, 이는 의도된 단계적 마이그레이션으로 판단되며 scope 초과가 아니다.

## 위험도

NONE
