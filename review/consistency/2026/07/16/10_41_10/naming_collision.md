### 발견사항

- **[WARNING]** app-level chat timeout 이 `LLM_CALL_FAILED` 로 귀결 — 동일 registry 의 기존 `LLM_TIMEOUT` 과 세맨틱 중첩, 신규 §12.16 에 disambiguation 없음
  - target 신규 식별자: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 "LLM chat 호출 app-level 타임아웃 (defense-in-depth)" — 신규 env `AI_AGENT_LLM_CALL_TIMEOUT_MS`(기본 600000ms) 초과 시 `withTimeout` throw 를 "§10 `LLM_CALL_FAILED`(retryable, network timeout 계열)로 귀결 — 신규 에러 코드 없음" 이라고 명시(item B, 현재 작업 중인 uncommitted 변경: `ai-turn-executor.ts` 4곳 `chat()` 호출에 `timeoutMs` 배선 + `.env.example` 등재).
  - 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts:42` 에 `LLM_TIMEOUT: 'LLM_TIMEOUT'` 이 `LLM_CALL_FAILED`(39행)와 나란히 등록돼 있고, `spec/5-system/3-error-handling.md:115,324` 의 글로벌 LLM 에러 카탈로그가 `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` · `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT` 을 **형제 코드로 나란히** 등재한다. `spec/3-workflow-editor/4-ai-assistant.md:624` 는 Workflow AI Assistant(별도 챗 기능)의 "120초 타임아웃" 을 `LLM_TIMEOUT` 으로 명시하고, `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:37` 도 `LLM_TIMEOUT` → `executionFailedTimeout` 매핑을 등록해둔다. `spec/5-system/7-llm-client.md:345` 는 이미 이 정확한 모호성을 한 번 다뤘다 — "타임아웃은 `withTimeout` 이 …던지며, 전용 `LLM_TIMEOUT` 코드로 매핑되지 않는다(노드 실행 계층 `nodes/core/error-codes.ts` 의 `LLM_TIMEOUT` 은 별개의 노드 taxonomy)".
  - 상세: `LLM_TIMEOUT` 과 `LLM_CALL_FAILED` 는 동일 registry 에 공존하는 **이름만으로 구분이 안 되는 형제 코드**다. `ai-agent.md` §10 은 이미 예전부터 "network timeout → `LLM_CALL_FAILED`" 로 분류해 왔으므로(§12.16 은 이 기존 분류를 새 타임아웃 소스에 확장 적용한 것뿐, 코드 자체는 새로 만들지 않음) 엄밀한 "신규 식별자 충돌"은 아니지만, ai_agent 자신의 유닛 테스트(`ai-turn-executor.spec.ts:679,712`)가 정확히 "timeout" 시나리오의 예시 에러 코드로 `LLM_TIMEOUT` 을 사용하고 있어 — 같은 파일·같은 노드 내에서도 "타임아웃 = `LLM_TIMEOUT`" 이라는 직관과 실제 구현("타임아웃 = `LLM_CALL_FAILED`")이 어긋난다. `TOOL_DEFINITION_PAYLOAD_EXCEEDED` vs `MAX_TOOL_CALLS_EXCEEDED` 는 §10/§12.15 에서 명시적으로 구분 근거를 남겼지만(선례), §12.16 은 `LLM_TIMEOUT` 과의 구분 근거를 남기지 않아 동일 house-style 이 빠져 있다.
  - 제안: §12.16 (또는 §10 표 근처)에 "본 app-level timeout 은 §5-system/7-llm-client.md 의 기존 분류(network timeout → `LLM_CALL_FAILED`)를 따르며, `nodes/core/error-codes.ts` 의 `LLM_TIMEOUT` 은 Workflow AI Assistant 전용 별개 taxonomy — ai_agent 노드는 사용하지 않는다" 한 줄을 추가해 기존 `7-llm-client.md §345` 의 disambiguation 을 §12.16 에서도 상호 참조. `ai-turn-executor.spec.ts` 의 예시 코드도 `LLM_CALL_FAILED` 로 바꾸면 테스트 자체가 오해의 소지를 없앤다(behavior 검증에는 영향 없음 — 임의 mock 코드이므로).

- **[INFO]** 신규 파일 `llm-call-timeout.ts` 가 기존 `llm-call-record.ts` 와 `llm-call-*` 접두 공유
  - target 신규 식별자: `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts` (uncommitted 신규 파일, `1-ai-agent.md` frontmatter `code:` 에 이미 등재됨)
  - 기존 사용처: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (`LlmCallRecord`/`TurnDebugEntry` canonical 타입 SoT, `0-common.md` §6 인용)
  - 상세: 두 파일은 디렉터리(`ai-agent/` vs `shared/llm-tracing/`)와 책임(호출당 타임아웃 설정 함수 vs 호출 트레이스 레코드 타입)이 명확히 달라 실질 충돌은 아니다. 다만 `llm-call-` 접두를 공유해 자동완성·grep 시 혼동 가능성이 있고, 이 스킬 라인은 바로 앞 PR(`tool-payload-budget.ts` vs `tool-payload-save-warning.ts`)에서 동일한 패턴의 INFO 를 이미 한 번 지적·반영한 이력이 있다(`ai-agent-tool-payload-budget-followups.md` 메모 참고).
  - 제안: 이름 변경을 강제할 정도는 아님 — 필요 시 JSDoc 헤더에 "llm-call-record.ts(트레이스 레코드 타입)와 무관, 호출당 app-level timeout 설정 전용" 한 줄만 명시하면 충분.

- **[INFO]** `AI_AGENT_LLM_CALL_TIMEOUT_MS` 는 3 AI 노드 공통(`0-common.md`) 영역이 아닌 `ai_agent` 전용으로 스코프됨
  - target 신규 식별자: `AI_AGENT_LLM_CALL_TIMEOUT_MS` — §12.16 은 "AI Agent 의 모든 LLM `chat` 호출"에만 적용한다고 명시.
  - 기존 사용처: 없음(신규, 충돌 없음) — 다만 `0-common.md` §6/§7 은 세 AI 노드(`ai_agent`/`text_classifier`/`information_extractor`)가 LLM 호출·에러 포맷을 공유한다고 규정하므로, text_classifier/information_extractor 의 LLM 호출에는 이 defense-in-depth 타임아웃이 적용되지 않는 비대칭이 남는다.
  - 상세: 이름 자체는 `AI_AGENT_TOOL_PAYLOAD_*` 패밀리와 접두 정합이 맞아 충돌 소지는 없다. 다만 향후 text_classifier/information_extractor 에도 유사 defense-in-depth 를 추가할 때 `AI_AGENT_LLM_CALL_TIMEOUT_MS` 이름을 그대로 재사용하면(노드명이 안 맞음) 혼란이 생길 수 있어 미리 남겨둔다.
  - 제안: 실제 충돌은 아니므로 조치 불필요. 후속으로 text_classifier/information_extractor 에 동일 defense-in-depth 를 도입할 때는 노드별 접두(`TEXT_CLASSIFIER_LLM_CALL_TIMEOUT_MS` 등) 또는 `0-common.md` 로 승격한 공통 env 이름 결정이 필요하다는 점만 인지.

- **[없음]** 그 외 target 신규 식별자(요구사항/엔티티/endpoint/이벤트/설정키/파일경로) — CRITICAL 충돌 없음
  - `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(에러코드) — §10/§12.15 가 이미 `MAX_TOOL_CALLS_EXCEEDED`/`tool_call_budget_exceeded` 와 명시적으로 구분해 두었고, repo 전체에 다른 의미의 재사용 없음(`tool-payload-budget.ts`/`tool-payload-save-warning.ts`/`ai-turn-executor.ts` 3곳 정합).
  - `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES` / `_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` / `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` — 다른 env 와 이름 겹침 없음, `.env.example` 1곳에만 정의.
  - `estimateAgentToolPayload` — `tool-payload-budget.ts` 단일 정의, 호출부(`tool-payload-save-warning.ts`, plan draft) 모두 동일 시그니처 참조. 다른 의미의 동명 함수 없음.
  - `ai_agent:tool-payload-budget` (graph warning rule id) — `cross-node-warning-rules.md` §8 rule 표에 단일 행으로만 존재(`parallel:nested-depth-exceeded`/`parallel:nested-concurrency-cap`/`graph:unescapable-cycle` 과 네임스페이스 겹침 없음).
  - `includeSystemContext` / `systemContextSections` (§11 config 필드) — `system-context-prefix.ts`/`system-context-schema.ts` 외 다른 파일에서 다른 의미로 쓰이지 않음. `System Context` 출력 헤더 텍스트도 `execution-context.md` 의 `__workspaceName`/`__workspaceTimezone` 주석과 정합적으로 상호 참조됨(신규 충돌 없음).
  - `ResumableMessageOptions.signal?: AbortSignal` (신규 필드, `node-handler.interface.ts`) — 같은 인터페이스 내 기존 필드(`source`)와 이름 겹침 없음.
  - §12.16 섹션 번호 — 방금 §12.15 뒤에 신규 삽입됐고 리포지토리 전체에 다른 §12.16 참조/선점 없음(문서 성장과 코드/`.env.example`/`node-cancellation.md` cross-link 이 동시에 갱신되어 일관).

### 요약

`spec/4-nodes/3-ai/` 영역에서 이번 검토 시점에 실제로 "새로 도입되는" 식별자는 대부분 이미 머지된 항목 A(도구 정의 payload 예산 가드레일)의 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`/`AI_AGENT_TOOL_*` 계열과, 현재 uncommitted 로 진행 중인 항목 B(resume 턴 timeoutMs+signal 배선)의 `AI_AGENT_LLM_CALL_TIMEOUT_MS`/`aiAgentLlmCallTimeoutMs`/`llm-call-timeout.ts`/§12.16 이다. 전자는 이전 naming-collision 라운드에서 이미 한 번 걸러졌고(`tool-payload-save-warning.ts` 개명 이력), 이번 라운드에서 코드베이스 전수 grep 결과 두 그룹 모두 CRITICAL 급 재정의 충돌은 없다. 유일하게 실질적으로 짚을 만한 사항은 §12.16 이 타임아웃을 기존 `LLM_CALL_FAILED` 로 귀결시키면서, 같은 error-codes.ts registry 에 이미 존재하고 심지어 같은 파일의 유닛 테스트 예시로도 쓰이는 형제 코드 `LLM_TIMEOUT` 과의 구분 근거를 명문화하지 않은 점(WARNING) — 새 코드를 만든 것은 아니라 엄밀한 "충돌"은 아니지만, 다음 리더가 오인하기 쉬운 지점이라 문서화 보강을 권한다. 나머지는 명명 근접성에 대한 INFO 수준 참고 사항이다.

### 위험도
LOW
