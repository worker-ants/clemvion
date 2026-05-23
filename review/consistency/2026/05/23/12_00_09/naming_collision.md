# Naming Collision — `userMessage` 식별자

## 결론
**위험도: INFO 1건 (낮음, 차단 없음)** — `userMessage` 가 기존 코드에서 함수 인자 (LLM-facing user 메시지 본문) 로 광범위 사용 중. 본 작업의 `ButtonDef.userMessage` 는 **schema 필드** 라 의미·scope 가 다르며 lexical 충돌 없음. 단, 사람 가독성·grep 가독성 측면에서 약간의 인지 부하 — plan 의사결정 단계에서 식별 가능한 명명을 사용했는지 INFO 로만 기록.

## 점검 매트릭스

| 식별자 사용처 | 의미 | 본 작업과 충돌? |
|---|---|---|
| `codebase/backend/src/nodes/core/node-handler.interface.ts:249` `userMessage: string` | NodeHandler interface 의 multi-turn 사용자 메시지 인자 | **NO** — 함수 인자, ButtonDef 필드와 lexical scope 다름. |
| `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:475` | multi-turn LLM 호출의 user role content | **NO** — 동일. |
| `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:1554, 1568, 1607, ...` `processMultiTurnMessage(userMessage, ...)` | multi-turn 사용자 메시지 처리 함수 인자 | **NO** — ButtonDef schema 필드 (`config.buttons[i].userMessage`) 와 다른 scope. AI Agent 가 chat input 에서 받는 user 메시지 본문이라 본 작업의 합성된 user message 가 이 함수에 흘러들어가는 흐름 — **의미상 한 흐름의 두 단면이라 오히려 일관됨** (frontend 가 합성한 `userMessage` 텍스트가 ai-agent.handler 의 `userMessage` 인자로 전달됨). |
| `codebase/backend/src/modules/llm/clients/openai.client.ts:396` `const userMessage = …` | OpenAI 클라이언트의 에러 메시지 변수 | **NO** — local 변수, 의미 다름. 다만 동명 사용은 INFO. |
| `codebase/frontend/src/lib/stores/assistant-store.ts:321` `const userMessage: AssistantDisplayMessage` | 채팅 store 의 사용자 메시지 객체 | **NO** — 동일 의미 (chat 의 user 메시지). 본 작업의 `ButtonDef.userMessage` 와 의미 일관. |
| `spec/4-nodes/3-ai/3-information-extractor.md:145` `processMultiTurnMessage(userMessage, ...)` | 함수 시그너처 spec | **NO** — 함수 인자, schema 필드 아님. |

## INFO 사항

- **INFO-1 (의미 일관성)**: `userMessage` 라는 이름이 backend·frontend 의 다른 위치에서 모두 "LLM 에게 전달될 user role 메시지 본문" 의미로 일관되게 쓰임. 본 작업의 `ButtonDef.userMessage` 는 "버튼 클릭 시 그 user 메시지로 발화될 텍스트" 라 의미가 **자연 확장**. → naming 측면에서 오히려 _권장_ 명명. 대안 후보 (`onClickUserText`, `dispatchText`, `messageOnClick` 등) 보다 mental model 일치. 채택.

## 신규 식별자 없음

- `findButtonContext` (frontend) / `backfillButtonUuids` 와 구분되는 `userMessage` 외 신규 식별자 도입 없음 — `findButtonLabel → findButtonContext` 는 본 plan 의 (A) 구현 단계 식별자라 spec 의 책임 밖.

## STATUS
ISSUES=1 (INFO 1, CRITICAL/WARNING 0)
