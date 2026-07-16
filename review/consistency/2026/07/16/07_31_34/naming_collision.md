# 신규 식별자 충돌 검토 — `spec/4-nodes/3-ai/` (--impl-prep)

> 검토 대상: `spec/4-nodes/3-ai/0-common.md` · `spec/4-nodes/3-ai/1-ai-agent.md` (payload 상 §7.5 이후~§12 는 크기 제한으로 절단됨 — 해당 구간은 실제 저장소 파일을 직접 열람해 보완)
> 검토 시점 맥락: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 의 실행 체크리스트 3번 단계(config-time 저장 경고 착수 직전 `--impl-prep`)로 호출된 것으로 판단. 따라서 이번에 실제로 "신규"인 식별자는 항목 A(config-time 저장 경고)가 도입하는 것들이며, 그 외 대부분(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`, `AI_AGENT_TOOL_*_BYTES`, `render_*`, `ai_form_render` 등)은 선행 PR(#948, #950)로 이미 구현·등록 완료된 상태다.
> 검증 방법: payload 텍스트 분석에 더해, 판단이 애매한 항목은 실제 워크트리 파일(`spec/conventions/cross-node-warning-rules.md`, `spec/conventions/interaction-type-registry.md`, `codebase/backend/src/nodes/ai/ai-agent/*`, `codebase/frontend/src/lib/i18n/backend-labels.ts`)을 직접 열어 대조했다.

## 발견사항

- **[WARNING]** 동일 `<node_type>:<slug>` id 포맷을 공유하는 두 개의 독립 rule 레지스트리 (AI Agent 노드)
  - target 신규 식별자: `ai_agent:tool-payload-budget` (item A 가 등록할 `graphWarningRules`/cross-node 규칙 id — backend-only async 평가, `spec/4-nodes/3-ai/1-ai-agent.md` §4.2/§10, `spec/conventions/cross-node-warning-rules.md` §8)
  - 기존 사용처: `ai_agent:too-many-conditions` — `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:723` (`warningRules` mini-DSL, 단일 노드 config 평가, `spec/4-nodes/3-ai/1-ai-agent.md` §5.1 "최대 20개 조건 허용")
  - 상세: `spec/conventions/cross-node-warning-rules.md` §2 는 `warningRules`(mini-DSL, per-node, frontend canvas + backend `handler.validate` 평가)와 `graphWarningRules`(cross-node, JS 함수, workflow save endpoint + frontend canvas + runtime 평가)를 **서로 다른 코드 위치·타입·평가 시점을 가진 별개 메커니즘**으로 명확히 구분해 두었지만, id 문자열 포맷은 둘 다 `<node_type>:<slug>` 로 **동일**하다. 두 카탈로그를 가로지르는 uniqueness 가드는 존재하지 않는다 — i18n P1-B 테스트(`backend-labels.test.ts`)는 `*.schema.ts` 의 정적 `warningRules[].message` 만, P3-C-1 은 `GRAPH_WARNING_RULES_BY_TYPE`(graphWarningRules)의 ruleId 만 검증하며 서로의 존재를 모른다. 현재는 slug 가 달라(`too-many-conditions` vs `tool-payload-budget`) 실제 충돌은 없음을 직접 확인했으나(`grep -rn "too-many-conditions" codebase/packages/graph-warning-rules` 무결과, `GRAPH_WARNING_KO` 에도 `ai_agent:tool-payload-budget` 키 아직 없음 — 예상대로 미구현), 두 시스템이 동일 node type(`ai_agent`)에 대해 문자열 포맷을 공유하는 구조 자체가 향후 slug 우연 충돌 시 "어느 레지스트리 소속인지 문자열만으로 구분 불가"라는 잠재 리스크를 안고 있다.
  - 제안: (a) 저비용 대안 — `spec/conventions/cross-node-warning-rules.md` §2 표에 "두 레지스트리의 `<node_type>:<slug>` id 공간은 서로 별개이며 우연히 문자열이 겹칠 수 있다. 신규 rule 추가 시 `ai-agent.schema.ts` 의 `warningRules[].id` 와 `graph-warning-rules` 패키지의 ruleId 양쪽을 모두 grep 해 중복이 없는지 확인" 같은 주의 문구를 추가. (b) 근본 대안 — 두 네임스페이스 중 하나에 얇은 prefix 구분자를 부여(예: cross-node 쪽만 `graph:` 추가). 이번 item A 자체는 slug 가 겹치지 않아 즉시 조치는 불필요하지만, 문서화만이라도 남겨 두는 것을 권장.

- **[INFO]** 신규 파일 `config-time-tool-budget.ts` 이 기존 `tool-payload-budget.ts` 와 명명이 매우 유사
  - target 신규 식별자: `codebase/backend/src/nodes/ai/ai-agent/config-time-tool-budget.ts` (item A 계획 신규 파일 — `evaluateAiAgentToolPayloadWarnings(nodes, workspaceId)`)
  - 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` (이미 구현·병합됨 — `estimateAgentToolPayload` / `enforceToolPayloadBudget` / `toolPayloadSoftBytes` / `toolPayloadHardBytes` / `toolCountMax`, PR #948)
  - 상세: 같은 디렉터리에 `tool-payload-budget` 어근을 공유하는 두 파일(런타임 가드 vs 저장 시점 가드)이 공존하게 된다. 두 파일이 동일 estimator(`estimateAgentToolPayload`)를 재사용하도록 spec 이 명시적으로 설계했으므로 기능 충돌은 아니지만, IDE 자동완성·import 경로 오선택 리스크가 실존한다(`tool-payload-budget.ts` 를 import 해야 할 자리에 `config-time-tool-budget.ts` 를 잘못 고르는 식). 신규 env 파서 `toolBudgetStrictSave()` 도 기존 sibling 함수군(`toolPayloadSoftBytes`/`toolPayloadHardBytes`/`toolCountMax` — 모두 "Payload"/"Count" 축, "Budget" 이라는 단어를 쓰지 않음)과 명명 축이 살짝 어긋난다("Budget" 이라는 단어가 처음 등장).
  - 제안: 우선순위 낮음. `config-time-tool-budget.ts` 상단에 "관련 파일: `./tool-payload-budget.ts` (runtime 가드), 본 파일은 저장(save-time) 가드" 같은 상호 참조 주석을 남기거나, 테스트 파일도 `config-time-tool-budget.spec.ts` 로 대칭 명명해 두 축이 파일 목록만 봐도 구분되게 할 것을 권장. env var 이름(`AI_AGENT_TOOL_BUDGET_STRICT_SAVE`)은 이미 선행 guardrail PR 에서 spec 에 확정돼 있어 지금 바꾸는 것은 실익 대비 churn 이 크므로 유지 권장.

- **[INFO]** `interactionType` 필드명의 동명이의(同名異義) 재사용 — 기존에 이미 문서화된 사항, 충돌 없음 확인
  - target 신규 식별자: `meta.interactionType: 'ai_form_render'` (`spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.ii — `WaitingInteractionType` 4값 중 신규 추가분)
  - 기존 사용처: `NodeExecution.interaction_data.interactionType` (`spec/1-data-model.md` §2.14) — 값 도메인이 `form_submitted`/`button_click`/`button_continue` 인 **수행된 user action 기록** enum. 필드명은 동일하지만 별개 enum.
  - 상세: `spec/1-data-model.md` 가 이미 "여기의 `interactionType` 은 수행된 user action 의 기록 enum 으로, 노드 대기 상태를 분류하는 `WaitingInteractionType`(...) 과 이름만 같고 별개 enum이다" 라고 명시적으로 경고해 두었다. 실제 `spec/conventions/interaction-type-registry.md` 를 직접 열람해 `WaitingInteractionType = 'form' | 'buttons' | 'ai_conversation' | 'ai_form_render'` (backend `execution-engine.service.ts`, frontend `execution-store.ts`) 로 `ai_form_render` 가 정확히 등록되어 있고, target 문서의 서술과 완전히 일치함을 확인했다. 충돌이 아니라 이미 SoT 가 구분을 명문화하고 실제 코드에도 반영된 상태다.
  - 제안: 조치 불필요(확인 완료, 정보 제공 목적). 선택 사항으로 `1-ai-agent.md` §6.1.d.ii 근처에도 "`meta.interactionType` 은 `NodeExecution.interaction_data.interactionType` 과 동명이의(별개 enum) — 근거: `1-data-model.md` §2.14" 짧은 교차링크를 추가하면 신규 독자의 탐색성이 좋아진다.

- **[INFO]** `ai_agent:tool-payload-budget` rule id 사전 등록 상태 — 중복/경합 등록 없음 확인
  - target 신규 식별자: `ai_agent:tool-payload-budget` (item A 가 실제 구현 시 사용할 cross-node rule id)
  - 기존 사용처: `spec/conventions/cross-node-warning-rules.md` §8 (line 135, 등재 rule 표) — 이미 "⚠ 구현 예정(Planned)" 행으로 선등록되어 있으며 `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` 의 D5 draft 문구와 정확히 일치.
  - 상세: 선행 guardrail PR(Phase 1, #948)이 spec 갱신 단계에서 이 rule id 를 미리 예약해 두었기 때문에, 지금 항목 A 를 구현해도 새 id 가 기존 등록과 충돌하거나 중복 등록될 위험이 없다. `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `GRAPH_WARNING_KO` 에는 아직 해당 키가 없음(예상대로 미구현 — item A 가 채울 자리)을 직접 확인했고, `backend-labels.test.ts` 에는 plan 이 언급하는 "backend-only ruleId 명시 목록" 메커니즘이 아직 코드에 존재하지 않는다(구현 시 신설 필요 — naming collision 은 아니고 구현 누락 항목이므로 본 리포트 범위 밖).
  - 제안: 없음(정상). item A 구현 시 이 id 를 그대로 사용하면 된다.

## 요약

target(`spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`)이 정의/참조하는 식별자 대부분은 이미 이전 consistency-check 라운드(C1~C3, W1~W7 반영 이력이 문서에 남아 있음)를 거쳐 확정·구현된 상태이며, 이번 검토에서 실제 저장소 파일(`cross-node-warning-rules.md`, `interaction-type-registry.md`, `ai-agent.schema.ts`, `backend-labels.ts`)을 직접 대조한 결과 CRITICAL 급 충돌(요구사항 ID/엔티티/endpoint/이벤트명/ENV/파일경로의 실질적 재사용)은 발견되지 않았다. 유일하게 실질적인 리스크로 판단한 것은 `ai_agent:too-many-conditions`(per-node `warningRules`)와 `ai_agent:tool-payload-budget`(cross-node `graphWarningRules`)이 서로 다른 두 레지스트리임에도 동일한 `<node_type>:<slug>` id 포맷을 공유하며 이를 가로지르는 자동 uniqueness 가드가 없다는 구조적 취약점(WARNING)이다. 지금 당장 슬러그가 겹치진 않으므로 item A(config-time 저장 경고) 착수를 막을 사유는 아니며, 문서 주의 문구 추가 정도의 저비용 보완을 권장한다. 나머지는 이미 해소됐거나(등록 확인) 명명 스타일 수준의 INFO다.

## 위험도

LOW
