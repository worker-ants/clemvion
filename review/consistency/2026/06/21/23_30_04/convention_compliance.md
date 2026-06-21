# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/3-ai` 전 문서 + 구현 diff (`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`, `ai-agent.handler.ts`)
검토 모드: `--impl-done`, `diff-base=origin/main`

---

## 발견사항

### 1. **[INFO]** `interaction-type-registry.md` 의 `code:` 목록에 `ai-turn-executor.ts` 미등재

- **target 위치**: `spec/conventions/interaction-type-registry.md` frontmatter `code:` 블록
- **위반 규약**: `spec/conventions/interaction-type-registry.md §1.1` — "Backend emit 위치" 매트릭스. 현재 `code:` 목록에 `ai-turn-orchestrator.service.ts` 가 등재되어 있고 `ai-turn-executor.ts` 는 없다.
- **상세**: M-1 3단계 리팩터로 `interactionType: 'ai_conversation'` / `'ai_form_render'` emit 로직이 `ai-agent.handler.ts` → `ai-turn-executor.ts` 로 이동했다 (`ai-turn-executor.ts` lines 1665, 2388-2390). 규약 SoT 의 `code:` 목록이 구 위치(`ai-turn-orchestrator.service.ts`)만 가리키고 신규 실제 emit 위치(`ai-turn-executor.ts`)가 등재되지 않았다.
- **제안**: `interaction-type-registry.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 를 추가한다. 이는 spec 변경(project-planner 역할)이지만 단순 코드 경로 갱신이므로 낮은 우선순위다.

---

### 2. **[INFO]** `ai-turn-executor.ts` 내 `ToolCallTrace` 인터페이스가 spec `meta.turnDebug[].toolCalls` 필드 구조를 구현하나 doc 참조 링크 부재

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` lines 59-70 (`ToolCallTrace` interface)
- **위반 규약**: `spec/conventions/node-output.md §2` Principle 2 (meta 필드 단일 진실), `spec/4-nodes/3-ai/0-common.md §6`, `spec/4-nodes/3-ai/1-ai-agent.md §7.1`
- **상세**: `ToolCallTrace` 는 spec `meta.turnDebug[].toolCalls` 의 shape 를 구현하고 있으나 JSDoc 에 `spec/4-nodes/3-ai/0-common.md §6` / `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 의 교차 참조가 없다. 스웨거(`spec/conventions/swagger.md §1-1`) 나 코드 JSDoc 요구사항은 아니지만 shape 의 drift 감지를 어렵게 만든다.
- **제안**: `ToolCallTrace` JSDoc 에 `spec/4-nodes/3-ai/1-ai-agent.md §7.1 meta.turnDebug[].toolCalls` 참조 한 줄 추가 (선택적 개선).

---

### 3. **[INFO]** `RawAiAgentMultiTurnConfig` 가 private 인터페이스이지만 spec 에 대응 참조가 없음

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` lines 143-178 (`RawAiAgentMultiTurnConfig`)
- **위반 규약**: 규약 직접 위반은 아니나 `spec/conventions/node-output.md §7 (config echo 원칙)` 의 raw config echo 대상 필드와 일치 여부가 비명시적이다.
- **상세**: 해당 인터페이스는 `context.rawConfig` / `state.rawConfig` 를 narrow 하기 위한 구현 내부 타입으로, Principle 7 의 "echo 항상 대상" 필드 목록(`mode`, `model`, `systemPrompt`, `userPrompt`, `responseFormat`, `conditions`, `knowledgeBases`, `maxTurns`, `maxToolCalls` 등)과 부합한다. JSDoc 에 Principle 7 참조가 없어 추후 유지보수 시 echo 대상 여부를 코드만으로 판단해야 한다.
- **제안**: 해당 인터페이스 JSDoc 에 `/* Principle 7 (config echo) raw config type — spec/conventions/node-output.md §7 */` 한 줄 추가 권장 (INFO 수준, 차단 아님).

---

### 4. **[INFO]** `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` 상수가 `ai-agent.handler.ts` 에서 re-export 되나 `spec/4-nodes/3-ai/1-ai-agent.md` 의 "가드 필드 SoT" 참조가 `ai-agent.handler.ts` 를 가리킴

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §4.1`, §6.1.d.ii 각주 "(가드 필드 SoT: §12.6)"
- **위반 규약**: `spec/conventions/node-output.md §7` — 코드 SoT 위치 명세 정확성 (규약 직접 위반은 아님)
- **상세**: 실제 상수 정의는 `ai-turn-executor.ts` lines 241, 258 로 이동했고 `ai-agent.handler.ts` 는 re-export 만 한다(`export { FORM_SUBMITTED_GUIDANCE_MESSAGE, FORM_SUBMITTED_MAX_BYTES } from './ai-turn-executor'`). spec 문서의 `code:` frontmatter 나 §12.6 이 참조 위치를 구 파일로 가리키더라도 re-export 덕분에 동작은 정확하다. 그러나 spec 문서가 신규 단일 진실 위치(`ai-turn-executor.ts`)를 아직 반영하지 않았다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 를 추가하거나 §12.6 의 SoT 참조를 갱신. 운영 영향 없으므로 INFO.

---

## 요약

`spec/4-nodes/3-ai` 문서군은 정식 규약(`spec/conventions/`) 의 핵심 항목 — Principle 0~11 (node-output), 에러 컨트랙트(Principle 3.2.1 `retryable` 필수), 인터랙션 타입 레지스트리, config echo(Principle 7), 출력 포맷(`output.result.*` / `output.error.*` / `output.interaction.*` wrapper) — 을 모두 올바르게 기술하고 있다. M-1 3단계 구현(`ai-turn-executor.ts`) 도 `interactionType` 값(`ai_conversation` / `ai_form_render`) 을 규약 SoT(`interaction-type-registry.md §1.1`) 와 일치하게 사용하고 있으며, `UPPER_SNAKE_CASE` 에러 코드, `output.error.details.retryable` 필수 필드, `_resumeState` top-level 위치 예외 등 모두 규약 준수 상태다. 발견된 사항 4건은 모두 INFO 등급 — 코드 이동 후 spec frontmatter/JSDoc 참조가 구 위치를 가리키는 문서 추적 갱신 권고이며 런타임 동작·다른 시스템의 invariant 에는 영향이 없다.

## 위험도

NONE
