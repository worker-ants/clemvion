# 요구사항(Requirement) 리뷰 결과

**대상**: AI Agent Presentation Tool Family (`render_*`) — 28개 파일
**검토 일시**: 2026-05-22
**관련 spec**:
- `spec/4-nodes/3-ai/1-ai-agent.md` §1·§4.1·§6.1·§6.2·§7.10·§10
- `spec/4-nodes/6-presentation/0-common.md` §10
- `spec/conventions/conversation-thread.md` §1.2
- `spec/5-system/6-websocket-protocol.md` §4.4

---

## 발견사항

### 1. `render_form` blocking 흐름 미구현 (multi-turn)

- **[CRITICAL]** `render_form` interactive blocking 흐름이 multi-turn 핸들러에 구현되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 1723–1735
  - 상세: spec §4.1·§6.1.d.ii·§6.2·§7.4는 `render_form` 호출 시 `status: 'waiting_for_input'` + `interactionType: 'ai_form_render'` + `_resumeState.pendingFormToolCall` set + 사용자 제출 시 tool_result 채워 LLM 재호출하는 완전한 blocking 흐름을 정의한다. 그러나 실제 구현은 `blockingFormRender` 신호를 받았을 때 `logger.warn`을 남기고 `presentationSchemaViolations`에 `'render_form blocking flow pending phase 2b implementation'` 메시지를 push하는 것에 그친다. 즉, multi-turn에서 사용자가 `presentationTools: [{ type: 'form' }]`로 설정하고 LLM이 `render_form`을 호출해도 form이 표시되지 않고 schema violation으로 silent drop된다.
  - 제안: spec §6.1.d.ii·§6.2·§7.4에 정의된 blocking 흐름을 구현하거나, 해당 기능이 scope 밖임을 plan 및 문서에 명확히 기재하고 `presentationTools` UI에서 `form` type을 비활성화 처리.

### 2. `execution.ai_message` WebSocket 이벤트에 `presentations` 필드 미포함

- **[CRITICAL]** spec §4.1·§7.10 및 WS spec §4.4에서 `execution.ai_message` 이벤트 페이로드에 `presentations?: PresentationPayload[]`를 포함하도록 정의했으나, 실제 emit 코드에 해당 필드가 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 2258–2276 (waiting emit), 라인 2346–2366 (terminal emit)
  - 상세: `buildAiMessageDebugFromResumeState`는 `llmCalls`·`durationMs`만 반환하며 `presentations`를 포함하지 않는다. 두 emit 경로 모두 `presentations` 필드를 조립하는 코드가 없다. WS 스펙 §4.4에는 `presentations` 필드가 추가됐지만 실제 서버는 전송하지 않으므로, 클라이언트는 multi-turn에서 inline render를 볼 수 없다.
  - 제안: multi-turn handler가 return하는 resumeState 또는 output에서 `presentations` 배열을 읽어 `AI_MESSAGE` emit payload에 포함시켜야 한다.

### 3. spec §6.1.d.i 및 Rationale §12.4에 `data.presentations[]` 오기재 — spec 결함

- **[CRITICAL]** spec 내부 자기 모순: `§6.1.d.i`에서 `ConversationTurn (현재 turn 의 ai_assistant) 의 data.presentations[] 에 push`라고 기술하고, Rationale §12.4 v1 bullet에도 `ConversationTurn data.presentations[] 단일 진실`로 표기. 그러나 spec §1·§4.1·§7.10·§10.6·§10.7, conversation-thread.md §1.2 모두 **top-level 독립 필드 `presentations[]`** (`data?` 내부가 아님)로 일관 정의.
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 333 (§6.1.d.i), 라인 1071 (§12.4 v1 bullet)
  - 상세: 코드 구현(`conversation-thread.types.ts`, `conversation-thread.service.ts`, `ai-agent.handler.ts`, `conversation-utils.ts`)은 모두 `top-level presentations[]`로 정확히 구현됐다. spec의 두 곳 오기재가 spec 결함으로 독자/미래 구현자에게 혼란을 줄 수 있다.
  - 제안: `project-planner`에게 spec §6.1.d.i의 `data.presentations[]` → `top-level presentations[]` 수정 및 §12.4 v1 bullet 동일 수정 위임.

### 4. `meta.presentationSchemaViolations[]` 형상 spec-코드 불일치

- **[WARNING]** spec §7.10에 `meta.presentationSchemaViolations[]` 항목 shape을 `[{ toolName, toolCallId, issues, attempts }]`로 정의했으나, 코드의 TypeScript 타입에는 `toolCallId` 필드가 없음
  - 위치:
    - `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` 라인 136–140 (`presentationSchemaViolation` 인터페이스)
    - `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 910–914, 1530–1534, 2118–2122 (accumulator 타입)
  - 상세: spec §7.10 표는 `| meta.presentationSchemaViolations[] | Array? | ... | §4.1 의 silent drop 케이스만 echo. [{ toolName, toolCallId, issues, attempts }] |`로 정의한다. 그러나 `AgentToolResult.presentationSchemaViolation` 타입 및 handler accumulator 타입에는 `toolCallId`가 없어 meta 필드 출력에도 미포함된다. 클라이언트/외부 시스템이 `toolCallId`로 `meta.presentationCalls[]`와 join하려면 해당 필드가 필요하다.
  - 제안: `agent-tool-provider.interface.ts`의 `presentationSchemaViolation` 타입과 handler accumulator 타입에 `toolCallId: string` 추가, render-tool-provider.ts의 반환 코드에서도 `call.id`로 채울 것.

### 5. schema 위반 "재시도 1회 후 silent drop" 강제 로직 미구현

- **[WARNING]** spec §4.1·§10.5는 "1차: INVALID_PAYLOAD 회신. 재시도 1회 후에도 실패: silent drop"을 규정하지만, 핸들러에 동일 toolName에 대한 per-call 재시도 카운터 게이트가 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (classifyToolCalls, executeProviderToolBatch 전체)
  - 상세: 핸들러는 `INVALID_PAYLOAD`를 tool_result로 LLM에 반환하고 LLM이 동일 tool을 재시도할 경우 maxToolCalls 예산이 허용하는 한 계속 `INVALID_PAYLOAD`를 받으며 무제한 반복할 수 있다. spec이 규정한 "재시도 1회 후 강제 drop" 게이트(per toolName 또는 per toolCallId 카운터 + `status: 'dropped'` emit)가 없다. 현재는 `attempts: 1`이 하드코딩되어 있어 항상 1로 기록되며 실제 재시도 횟수를 반영하지 않는다.
  - 제안: 핸들러의 tool-call loop에 `presentationSchemaViolationsByTool: Map<string, number>` 같은 per-toolName 재시도 추적 구조를 추가하고, 이미 1회 위반이 기록된 tool에 대한 재호출은 `INVALID_PAYLOAD` 대신 즉시 silent drop으로 처리할 것.

### 6. spec §10.1의 schema 이름 `chartNodeConfigSchema` vs 코드의 `chartConfigSchema`

- **[WARNING]** spec `0-common.md §10.1` 테이블에서 chart 도구의 schema 출처를 `chartNodeConfigSchema (zod) → JSON Schema`로 표기하나, 실제 export 이름은 `chartConfigSchema`임
  - 위치:
    - `spec/4-nodes/6-presentation/0-common.md` §10.1 표
    - `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/nodes/presentation/chart/chart.schema.ts` 라인 66 (`export const chartConfigSchema`)
  - 상세: 다른 4개 schema는 spec과 코드의 이름이 일치한다(`tableNodeConfigSchema`, `carouselNodeConfigSchema`, `templateNodeConfigSchema`, `formNodeConfigSchema`). chart만 spec이 `chartNodeConfigSchema`로 표기하고 코드는 `chartConfigSchema`를 export한다. spec 문서 오기재이며 향후 수정 시 혼란을 줄 수 있다.
  - 제안: `project-planner`에게 spec §10.1 표의 `chartNodeConfigSchema` → `chartConfigSchema` 수정 위임.

### 7. spec §10.4 truncation 메타 경로 `data.presentations[i].truncation` 오기재 — spec 결함

- **[WARNING]** `spec/4-nodes/6-presentation/0-common.md §10.4`에서 truncation 메타를 `ConversationTurn data.presentations[i].truncation 에 surface 한다`고 기술
  - 위치: `spec/4-nodes/6-presentation/0-common.md` §10.4 (`data.presentations[i].truncation`)
  - 상세: §10.6·§10.7은 `ConversationTurn top-level presentations[]`를 사용한다. §10.4만 `data.presentations[i]`라고 표기해 §6.1.d.i와 같은 오기재가 반복된다. 실제 코드(`PresentationPayload` 타입, handler)는 top-level 방식으로 정확히 구현됐다.
  - 제안: `project-planner`에게 spec §10.4의 `data.presentations[i].truncation` → `presentations[i].truncation` 수정 위임.

### 8. `render_form` form blocking 미구현 시 `presentationTools.type = 'form'` 사용자 경험 — 의도와 구현 괴리

- **[WARNING]** 문서(ai.mdx KO·EN)는 multi-turn `render_form`이 사용자에게 form을 표시하고 제출을 대기한다고 설명하나, 실제 multi-turn 핸들러는 해당 흐름을 구현하지 않고 schema violation으로 drop
  - 위치:
    - `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/frontend/src/content/docs/02-nodes/ai.mdx` 및 `ai.en.mdx`
    - `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 1723–1735
  - 상세: 사용자 가이드는 `render_form`을 multi-turn에서 동작하는 기능으로 완전 문서화했으나, 실제로는 `"phase 2b"` 미구현 상태다. 사용자가 form을 등록하면 LLM이 form을 호출해도 아무것도 표시되지 않으며, 이는 문서와 완전히 다른 동작이다.
  - 제안: 문서에 현재 phase의 미구현 사실을 명시하거나 form type을 config UI에서 비활성화, 또는 해당 기능을 즉시 구현.

### 9. `overlayDefaults` 에서 `defaults`가 `null`인 경우 처리

- **[INFO]** `overlayDefaults(llmPayload, null)`을 호출하면 null이 반환됨 — null defaults는 "set" 상태이므로 spec §10.3 규칙("defaults가 set되어 있으면 defaults가 우선")에 따라 null을 반환하는 것은 의도적이지만, `PresentationToolDef.defaults`의 타입이 `Record<string, unknown>` (null 미포함)이므로 실제로는 호출되지 않을 경로
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 라인 108–133
  - 상세: `PresentationToolDef.defaults`는 `Record<string, unknown> | undefined`이므로 null은 실제 도달 불가. 단, `overlayDefaults`가 `export` 함수이므로 외부에서 null을 전달하는 경우를 고려한 방어적 처리 여부를 확인할 것. 현재 동작(null → null)은 명시적 타입 계약 내에서는 안전.

### 10. `assistant-presentations-block.tsx` `render_form` preview — phase 2b 주석 명시

- **[INFO]** `render_form` blocking flow가 미구현인 상태에서 frontend는 `FormSubmittedContent`를 fallback으로 렌더하는 것을 `// 'render_form' blocking interactive flow is phase 2b; the display-only preview falls back...`로 주석 처리하여 의도를 명시함. 기능 완전성 관점에서는 INFO 수준이나, 발견사항 1(CRITICAL)과 연동되는 사항.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` 라인 40–43

### 11. `SummaryView`에서 `isAssistant` 체크 없는 presentations 렌더 가드

- **[INFO]** `SummaryView`에서 `presentations` 렌더 시 `isAssistant && item.presentations && item.presentations.length > 0` 조건으로 guard하는 반면, `SelectedItemDetail`에서는 `const presentations = item.presentations ?? []` 후 `presentations.length > 0` 만으로 guard하여 `isAssistant` 체크가 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-presentation-tools-9b7c5c/codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` 라인 972, 980–982
  - 상세: spec §7.10은 `presentations`가 `source: 'ai_assistant'` 일 때만 set된다고 명시한다. `SelectedItemDetail`은 assistant turn 진입 시에만 호출되는 경로이므로 실제 버그는 아니지만, SummaryView와 일관성이 없음.

---

## 요약

핵심 기능인 schema 검증·defaults overlay·1MB cap·display-only 4종 렌더링·단일턴 form drop은 spec 대비 정확하게 구현됐다. 그러나 두 가지 CRITICAL 미구현이 존재한다. 첫째, `render_form` blocking 흐름이 multi-turn 핸들러에서 phase 2b로 연기된 채 그대로 PR에 포함됐으며, 사용자 문서에는 완전 동작하는 것으로 설명되어 있어 의도–구현 괴리가 크다. 둘째, `execution.ai_message` WebSocket 이벤트에 `presentations` 필드가 실제로 포함되지 않아 multi-turn 에서 클라이언트는 inline render를 할 수 없다 (단일턴은 해당 이벤트를 사용하지 않으므로 단일턴은 영향 없음). spec 측에도 동일 파일 내에서 `data.presentations[]`와 `top-level presentations[]`가 혼용된 오기재가 3곳 있으며, `meta.presentationSchemaViolations[]`의 `toolCallId` 필드가 코드에서 누락되어 spec–코드 불일치가 있다. `render_*` schema violation 재시도 1회 강제 게이트 또한 구현되지 않아 spec의 retry 정책을 위반한다.

---

## 위험도

**HIGH**

(CRITICAL 2건: multi-turn render_form blocking 미구현으로 등록된 form 도구가 silent drop되며 사용자 문서와 동작이 불일치; execution.ai_message WS 이벤트에 presentations 미포함으로 multi-turn inline rendering이 클라이언트에 전달되지 않음)
