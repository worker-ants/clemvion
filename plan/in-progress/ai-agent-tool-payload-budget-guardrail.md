---
worktree: ai-agent-message-issue-89863c
started: 2026-07-14
owner: developer
---

# AI Agent 도구 정의 payload 예산 가드레일

> 작성일: 2026-07-14
> 트리거: 운영 장애 조사 (2026-07-13) — AI Agent 노드가 Gemini·Ollama 모두 응답 실패
> 관련 spec: `spec/4-nodes/3-ai/1-ai-agent.md` (§4·§10·§12), `spec/5-system/11-mcp-client.md` (§5)

## 배경 (근본 원인)

2026-07-13 장애: AI Agent 노드에 메시지 입력 시 Gemini(`400 "terminated"` ~2.5분)·Ollama/LM Studio(`Request timed out.` ~6분) 모두 정상 응답 실패. provider 무관 동일 지점(`ai-turn-executor` resume 턴 → `llmService.chat` → `finalizeAiNode`).

**근본 원인**: 이 에이전트에 Cafe24 MCP 서버가 도구 allowlist 없이 연결돼, scope 허용 오퍼레이션 **383개 전량**이 매 LLM 요청에 도구 정의로 실림 → 프롬프트 ~118k 토큰(대부분 도구 스키마). 로컬 gemma-4-26b 는 120초 안에 프롬프트 처리조차 못 끝냄(LM Studio 로그: 112초에 15.6%). openai SDK 120초 timeout × 3회 재시도(=6분) = 사용자가 본 "계속 반복".

**"같은 설정인데 예전엔 됐다"의 차이**: 커밋 `8a23a8cff` (#828, 2026-07-06) "field-set docs 전량 미러"가 오퍼레이션 개수는 그대로 둔 채 **도구당 파라미터 스키마를 필드 단위로 팽창**(order.ts 1,353→5,742줄, metadata 전체 +18,879줄). 도구 payload 크기를 감시하는 가드가 없어 이 증가가 조용히 프롬프트를 임계점 너머로 밀었다.

**즉시 완화(검증됨)**: 노드 MCP Servers → Cafe24 → `enabledTools` allowlist 로 도구 축소 시 정상화.

## 목표

도구 정의 payload 팽창이 **조용한 provider 무관 타임아웃**으로 번지지 않도록 두 지점에서 가드:
1. **런타임**: 예산 초과 시 LLM 호출 **전에** 빠르고 명확하게 실패 (6분 hang 제거).
2. **노드 설정 변경 API**: 저장 시점에 초과를 **눈에 보이게** (경고), strict 모드에서만 차단.

## 확정 정책

> **2026-07-14 revised (consistency-check BLOCK 반영)**: (C1) config 저장 지점을 `PATCH :id` → `POST :id/save`(saveCanvas) 단일 경로로 정정. (C2) 저장 경고는 신규 `warnings[]` 필드 신설이 아니라 기존 `spec/conventions/cross-node-warning-rules.md` 의 `GraphWarningRuleResult` result surface + `GRAPH_VALIDATION_FAILED` 를 재사용. (C3) 런타임 에러코드를 `AI_TOOL_BUDGET_EXCEEDED` → `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 로 개명(호출 횟수 축 `MAX_TOOL_CALLS_EXCEEDED`/`tool_call_budget_exceeded` 와 구분 + `TOOL_*` 접두 정합). (W1) 에러에 구조화 `details` 추가.

- **지표**: 직렬화 bytes(1차) + 도구 개수(2차 sanity). *개수만으로는 #828을 못 잡으므로 bytes 가 주 지표.*
- **예산** (모두 env override, soft/hard 대칭 명명 — INFO#4):
  - `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES` = **98304 (96 KB, ~24k tok)** — 경고·로깅
  - `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` = **262144 (256 KB, ~64k tok)** — 강제
  - `AI_AGENT_TOOL_COUNT_MAX` = **128** (2차 sanity cap)
  - `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` = **false** (저장 시점 hard 초과를 severity `warning`→`error` 로 승격해 `GRAPH_VALIDATION_FAILED` 로 차단하는 env-only opt-in 플래그. *워크스페이스 설정 트리거는 백로그 — INFO#3*)
- **단일 estimator (SoT)**: `estimateAgentToolPayload(tools: ToolDef[]) → { bytes, approxTokens, toolCount, perProvider?: [{ key, bytes, toolCount }] }`. 런타임·config·로깅 3곳이 공유. bytes = `Buffer.byteLength(JSON.stringify(tools))`, approxTokens = language-aware 휴리스틱(기존 `shared/agent-memory-injection.ts` 재사용, 대략 bytes/4). *perProvider 는 "범인 서버 지목"용 — buildTools 결과를 provider key 별로 집계.*
- **런타임 (안전망)**: `AiTurnExecutor.buildTools` 직후 (single-turn·resume 공통 헬퍼) 산정. hard(또는 count) 초과 시 LLM 호출 **전에** 신규 에러코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(non-retryable) throw — `output.error.details = { totalBytes, budgetBytes, toolCount, culpritProvider? }` 구조화(§7.9 `LLM_RATE_LIMIT` details 선례 정합) + message 에 해결법(enabledTools allowlist / 서버 off). soft 초과는 실패 안 시키고 `logger.warn` 로깅.
- **노드 설정 변경 API**: `POST /workflows/:id/save`(`saveCanvas`) 의 `evaluateGraphWarnings` 직후 **backend-only** `evaluateAiAgentToolPayloadWarnings(nodes, workspaceId)` 를 호출해 ai_agent 노드의 `mcpServers`·`presentationTools` 로부터 payload 추정 → `GraphWarningRuleResult`(severity `warning`) 를 기존 결과 배열에 append(별도 응답 필드 신설 없음, 저장 통과+response 포함). `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 면 hard 초과를 severity `error` 로 승격 → 기존 `GRAPH_VALIDATION_FAILED` 로 400 차단(§cross-node-warning-rules §4·§5 가드 ① 재사용). *config 추정은 통합 granted scope 로 실제 노출 집합 재현 — 런타임 buildTools 와 동일 estimator, 단 실제 MCP connect 없이 정적 카탈로그 기반. **async 통합 scope 조회가 필요해 pure/shared `@workflow/graph-warning-rules` 규칙으로는 표현 불가 → backend-only 평가**(frontend canvas 가드 ② 는 pre-evaluate 하지 않고, 런타임 fail-fast ③ + saveCanvas ① 가 가드).* rule id: `ai_agent:tool-payload-budget`.
- **동반**: resume 턴 chat 호출(`ai-turn-executor.ts:2624`/`:2765`)에 `{ timeoutMs, signal }` opts 배선 (single-turn `:1533` 과 대칭). 매 턴 payload 크기(bytes/count) 로깅.
- **백로그(비포함)**: 대형 카탈로그용 compact-schema 모드(도구엔 name+짧은 설명만, 필드 상세 on-demand 조회) — 별도 plan. / (INFO#2) `evaluateAiAgentToolPayloadWarnings` 의 도구 소스는 현재 `mcpServers`·`presentationTools` — [`ai-agent-tool-connection-rewrite.md`](ai-agent-tool-connection-rewrite.md) 확정 시 `toolNodeIds` 등 신규 도구 소스가 추가되면 estimator 도 동기 갱신 필요(상호의존 추적).

## Phase

### Phase 1 — Spec 갱신 (project-planner, 본 PR 포함)

1. `spec/4-nodes/3-ai/1-ai-agent.md`:
   - §4 아래 신규 §4.2 "도구 정의 payload 예산 (tool-definition payload budget)" — estimator·예산·soft/hard 동작·env 표. "(호출 횟수 `maxToolCalls` 아님, working-memory `memoryTokenBudget` 아님 — 도구 **정의** 크기)" disambiguation 명시.
   - §10 에러 코드 표에 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` (runtime pre-LLM, non-retryable) 행 추가 + retryable 분류 규칙 정합 + 구조화 `details` (§7.9 형식).
   - §10 Pre-flight 표 아래 note: 저장 시점 경고는 `cross-node-warning-rules.md` 의 `GraphWarningRuleResult`(severity warning, strict 시 error→`GRAPH_VALIDATION_FAILED`) 재사용 — backend-only rule `ai_agent:tool-payload-budget` (async scope 조회로 pure 규칙 불가) 명문화.
   - §12 Rationale 신규 절 (bytes 우선 지표 근거·warn-vs-block 근거·backend-only rule 근거·에러코드 명명 근거·#828 배경).
2. `spec/5-system/11-mcp-client.md`:
   - §5.7 뒤 신규 §5.8 "도구 정의 payload 예산" — MCP 도구가 payload 예산에 합산됨, AI Agent §4.2/§10 cross-link.
3. `spec/conventions/cross-node-warning-rules.md`:
   - §5(평가 시점 3중 가드)에 **예외 조항** 신설(W2): "async 외부 조회(예: 통합 granted scope)가 필요해 pure/shared `@workflow/graph-warning-rules` 규칙으로 표현 불가한 **backend-only rule** 은 frontend canvas 가드 ②(로컬 pre-evaluate)를 구조적으로 생략할 수 있다. 이 경우 가드 ①(saveCanvas)+런타임 가드 ③ 가 안전망이며, rule 은 backend `WorkflowsService` 가 `evaluateGraphWarnings` 결과에 append 한다."
   - §8 등재 rule 표에 "backend-only" / "승격 조건" 표기를 수용하도록 note 추가(W4) + backend-only rule `ai_agent:tool-payload-budget` (기본 severity `warning`, `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 시 error 승격, backend-only 사유 = async 통합 scope 조회) 1행 추가.

### Phase 2 — 구현 (developer, TDD)

1. estimator SoT 함수 (`estimateAgentToolPayload`) + unit test.
2. 런타임 fail-fast (buildTools 공통 헬퍼) + `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 분류(`AiTurnOrchestrator.classifyLlmError` passthrough 정합) + 구조화 details(`retryable:false`) + unit test. **(W1) single-turn 경로**: `executeSingleTurn` 은 현재 buildTools/chat 을 try/catch 없이 호출하므로(멀티턴 `handleAiMessageTurn` 과 비대칭), pre-flight throw 가 `output.error`+`error` 포트로 귀결되도록 single-turn 전용 로컬 try/catch(또는 handler 경계 catch) 를 신설한다. `node-output-redesign/ai-agent.md` 의 single-turn error 라우팅 미해결 CRITICAL 과 선행 의존 — 본 에러코드만이라도 명시 라우팅 보장.
3. resume 턴 timeoutMs+signal 배선 + 회귀 test.
4. saveCanvas backend-only `evaluateAiAgentToolPayloadWarnings` → `GraphWarningRuleResult` append + strict 승격 + integration test. saveCanvas 응답이 이미 graph warnings 를 포함하므로 **신규 DTO 없음**(있으면 swagger.md §5-4 체크리스트에 따라 응답 DTO/데코레이터 갱신). **(W3) i18n 가드**: `ai_agent:tool-payload-budget` 는 shared-package 밖(backend-only)이라 `backend-labels.test.ts` P3-C-1 자동 parity 스캔 사각지대 → `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` KO 매핑 추가 + `backend-labels.test.ts` 의 backend-only ruleId 명시 목록에 등록(빌드 시 KO 누락 방지).
5. env 기본값 wiring(ConfigService namespace) + 문서.
6. build / lint / test.

### Phase 3 — 리뷰 (강제)

`/ai-review` → Critical/Warning resolution-applier fix.

### Phase 4 — PR

단계별 커밋(spec/plan → 구현 → 리뷰). PR 생성.

## Spec 변경 draft (consistency-check 입력)

### D1. ai-agent.md §4.2 (신규)

> ### 4.2 도구 정의 payload 예산 (tool-definition payload budget)
>
> LLM 요청에 실리는 **도구 정의 전체의 직렬화 크기**를 예산으로 관리한다. 이는 §6.1.g 의 도구 **호출 횟수** 한도(`maxToolCalls`) · §1 의 working-memory 토큰 예산(`memoryTokenBudget`) 과 **다른 축** — 도구 **정의(스키마) 자체의 크기**다. 도구 **개수**가 아니라 **직렬화 bytes** 가 1차 지표다 — 대형 카탈로그(예: Cafe24 Admin API) 는 오퍼레이션 개수가 그대로여도 필드 단위 스키마 상세로 payload 가 수배 팽창할 수 있고, 그 팽창이 프롬프트를 provider transport timeout 너머로 밀면 provider 무관하게 "응답 없음/반복" 으로 나타난다.
>
> **estimator (단일 진실)**: `estimateAgentToolPayload(tools) → { bytes, approxTokens, toolCount, perProvider[] }`. bytes = `Buffer.byteLength(JSON.stringify(tools))`. 런타임·config 저장 검증·관측 로깅이 모두 이 함수를 공유한다.
>
> **예산** (env override):
>
> | 변수 | 기본값 | 동작 |
> |------|--------|------|
> | `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES` | 98304 (96 KB) | 초과 시 `logger.warn` 로깅만 — 실행 계속 |
> | `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` | 262144 (256 KB) | 초과 시 런타임 fail-fast (§10 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`) |
> | `AI_AGENT_TOOL_COUNT_MAX` | 128 | 2차 sanity — 초과 시 hard 와 동일 취급 |
> | `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` | false | 저장 시점 hard 초과를 severity error 로 승격 → `GRAPH_VALIDATION_FAILED` 400 (§10 config 경고) |
>
> **런타임 판정 위치**: `AiTurnExecutor.buildTools` 직후 (single-turn·multi-turn resume 공통). hard(또는 count) 초과 시 **LLM 호출 전에** `TOOL_DEFINITION_PAYLOAD_EXCEEDED` throw → §7.3/§7.9 `error` 포트(`details` 구조화). 6분 hang 대신 즉각·명확한 실패. soft 초과는 로깅만.

### D2. ai-agent.md §10 에러 코드 표 신규 행

> | `TOOL_DEFINITION_PAYLOAD_EXCEEDED` | buildTools 결과 도구 **정의**(스키마) 직렬화 크기가 hard 예산(`AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`, 기본 256 KB) 또는 개수(`AI_AGENT_TOOL_COUNT_MAX`, 기본 128) 초과 — LLM 호출 전 pre-flight. `MAX_TOOL_CALLS_EXCEEDED`(도구 **호출 횟수** 축)와 다른 실패 지점. | false | runtime (pre-LLM) |

`output.error` shape: `{ code: 'TOOL_DEFINITION_PAYLOAD_EXCEEDED', message, retryable: false, details: { totalBytes, budgetBytes, toolCount, culpritProvider? } }`. retryable 분류: `false` (설정을 바꾸지 않으면 동일 실패 — non-retryable, `_retryState` 미동봉; LLM 계열 노드 필수 필드 `retryable` 은 node-output §3.2.1 준수 — W5). `details` 구조화는 §7.9 `LLM_RATE_LIMIT` 의 `details` 선례와 동형(node-output §3.2.2 노드별 details 스키마 규약).

### D3. ai-agent.md §10 config 경고 계약 (Pre-flight 표 아래 note 신규 — cross-node-warning-rules 재사용)

> **도구 정의 payload 예산 경고 (저장 시점)**: `mcpServers`/`presentationTools` 로부터 추정한 도구 정의 payload 가 예산을 초과하면 워크플로우 저장 API `POST /workflows/:id/save`(`saveCanvas`) 가 [cross-node-warning-rules §4·§5](../../conventions/cross-node-warning-rules.md) 의 `GraphWarningRuleResult`(rule id `ai_agent:tool-payload-budget`, severity `warning`)를 결과 배열에 실어 반환한다(저장 통과+response 포함, 별도 응답 필드 신설 없음). `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true`(env-only) 인 경우 hard 초과를 severity `error` 로 승격 → 기존 `GRAPH_VALIDATION_FAILED` 로 400 저장 차단. 이 rule 은 통합 granted scope 의 **async 조회**가 필요해 pure/shared `@workflow/graph-warning-rules` 규칙(frontend/backend SSOT, 동기)으로 표현 불가 → **backend-only** 평가(`WorkflowsService` 가 `evaluateGraphWarnings` 직후 append). 따라서 frontend canvas 가드 ②(로컬 pre-evaluate)는 이 rule 을 계산하지 않으며, 실제 안전망은 런타임 fail-fast(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`, 위 §10 행) + saveCanvas 가드 ① 이 맡는다. 기본이 warn 인 이유: 저장 시 추정은 근사(런타임 granted scope·live MCP tool list 미확정)라 정상 설정 오차단 방지.

### D4. mcp-client.md §5.8 (신규, §5.7 뒤)

> ### 5.8 도구 정의 payload 예산
>
> MCP 서버가 노출하는 도구 정의는 AI Agent 의 **도구 정의 payload 예산**(bytes 기준)에 합산된다 — [AI Agent §4.2](../4-nodes/3-ai/1-ai-agent.md). 대형 카탈로그(Cafe24 등)를 allowlist 없이 전량 노출하면 payload 가 프롬프트를 provider transport timeout 너머로 밀 수 있으므로, `mcpServers[].enabledTools`(§5.6) 로 노출 도구를 좁히는 것이 권장된다. 예산 초과 판정·에러코드(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)·저장 경고(`ai_agent:tool-payload-budget`)는 AI Agent §4.2/§10 단일 진실. 이 예산은 §5.7 의 도구 **호출 횟수** 한도(`maxToolCalls`)와 별개 축이다.

### D5. cross-node-warning-rules.md §8 등재 rule 표 신규 행

> | AI Agent | `ai_agent:tool-payload-budget` | warning | 도구 정의 payload 가 예산 초과 (backend-only — async 통합 scope 조회로 pure 규칙 불가; `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 시 error 승격). SoT: [AI Agent §4.2/§10](../4-nodes/3-ai/1-ai-agent.md) |

## Rationale

- **왜 bytes 우선인가**: #828 은 도구 개수(383) 불변, 도구당 크기만 팽창 → 개수 cap 만이면 이번 사고를 못 잡는다. 실패의 물리량은 프롬프트 토큰이고 그 근사가 직렬화 bytes.
- **왜 런타임 fail-fast 인가**: 현재는 앱 레벨 타임아웃 없이 provider SDK(120초×재시도)에만 의존해 최대 6분 hang + 정체불명 종료. pre-flight throw 로 즉시·명확한 실패로 전환.
- **왜 config 는 warn 기본인가**: 저장 시 payload 는 근사(런타임 granted scope·MCP live tool list 미확정)라 hard block 은 정상 설정 오차단 위험. 안전망은 런타임이 맡고 config 는 "저장 순간 가시화" 역할. strict 는 opt-in.
- **왜 estimator 단일 함수인가**: 런타임·config 판정이 어긋나면 "저장은 통과했는데 실행은 실패" 혼란 → 동일 SoT 강제.
- **왜 backend-only graph warning 인가 (consistency C2 반영)**: 저장 경고는 기존 `cross-node-warning-rules.md` 의 `GraphWarningRuleResult` surface·severity(`warning`/`error`)·`GRAPH_VALIDATION_FAILED` 를 재사용해 별도 `warnings[]` 필드·별도 400 코드 신설을 피한다. 다만 이 rule 은 통합 granted scope 의 async 조회가 필요해 pure/동기·frontend/backend 공유 `@workflow/graph-warning-rules` 규칙으로 표현 불가 → shared package 에 넣지 않고 backend `WorkflowsService` 가 `evaluateGraphWarnings` 결과에 append 하는 backend-only 평가로 둔다. frontend 로컬 pre-evaluate(가드 ②)는 이 rule 만 예외적으로 계산하지 않으며, 런타임 fail-fast(③)가 실질 안전망이라 사용자 경험 저하 없음.
- **왜 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 명명인가 (consistency C3 반영)**: 같은 노드·실행 파일에 이미 "tool budget" 이 도구 **호출 횟수** 축으로 존재(`MAX_TOOL_CALLS_EXCEEDED`, `tool_call_budget_exceeded`). 이번 사고 자체가 "도구 개수는 그대로, 정의 payload 만 팽창" 이라는 축 혼동에서 늦게 밝혀졌으므로, 신규 코드는 "정의(스키마) payload 크기" 축임이 이름에서 바로 드러나야 한다. `AI_` 대신 기존 §10 `TOOL_*`/`LLM_*` 접두 계열과 정합.
- **왜 `details` 구조화인가 (consistency W1 반영)**: §7.9 `LLM_RATE_LIMIT` 이 `details.provider`/`details.retryAfterSec` 를 구조화한 선례, node-output §3.2.2 노드별 details 스키마 규약 정합 — 자유 텍스트 message 만으로는 후속 노드/관측이 `culpritProvider`·`totalBytes` 를 프로그램적으로 못 읽는다.
