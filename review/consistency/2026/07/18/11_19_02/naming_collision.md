# 신규 식별자 충돌 검토 — spec/4-nodes/3-ai (--impl-prep)

## 조사 방법 / 전제

- prompt payload 의 "Target 문서" 섹션에는 `spec/4-nodes/3-ai/0-common.md` 전문과
  `spec/4-nodes/3-ai/1-ai-agent.md` 일부(§7.4 부근까지, 크기 제한으로 truncate)만
  포함되어 있고, 선언된 scope 전체(`2-text-classifier.md` / `3-information-extractor.md`)
  는 payload 에 없었다. 다만 `git status` / `git diff HEAD -- spec/4-nodes/3-ai/`
  결과 해당 디렉토리에 **working-tree 변경분이 없음**을 확인했다 — 즉 이 payload 는
  "새로 작성 중인 diff" 가 아니라 **현재 HEAD 상태의 스냅샷**이다. 최근 커밋 이력
  (#955/#956/#961/#968 등)을 보면 이 영역은 이미 다회 구현·리뷰를 거쳐 실제
  코드베이스와 정합된 상태다.
- 이에 따라 payload 안에서 "새로 보이는" 식별자 후보(§11 System Context Prefix 필드,
  `presentationTools`/`render_*` 도구 패밀리, `memoryStrategy` 계열 필드, 도구
  payload 예산 ENV 4종, `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 등)를 추출한 뒤,
  `spec/4-nodes/3-ai/` **바깥**의 spec·codebase 전체를 대상으로 동일 식별자가 다른
  의미로 이미 쓰이고 있는지 grep 기반으로 교차 검증했다.

## 발견사항

특기할 CRITICAL/WARNING 없음. 점검한 모든 후보 식별자가 이미 codebase(backend
구현·spec 교차문서)와 정합된 상태였고, 이름이 겹칠 수 있는 지점은 spec 자체가
이미 명시적으로 구분 주석을 달아두고 있었다.

- **[INFO]** `interactionType` 이름 재사용 지점의 기존 disambiguation 확인
  - target 신규 식별자: `meta.interactionType: 'ai_form_render'` (§0-common, §1-ai-agent §7.4/§6.1 d.ii)
  - 기존 사용처: `spec/1-data-model.md:2017` (`execution_step.interaction_data.interactionType`)
  - 상세: `interaction_data` 컬럼 안의 `interactionType` (수행된 user action 기록 enum: `form_submitted`/`button_click`/`button_continue`) 과 `WaitingInteractionType`(`form`/`buttons`/`ai_conversation`/`ai_form_render`, `interaction-type-registry.md`)은 이름만 같고 다른 enum이다. 이는 새 충돌이 아니라 **이미 문서에서 명시적으로 "이름만 같고 별개 enum" 주석으로 disambiguate 된 상태**임을 확인했다.
  - 제안: 조치 불요 — 향후 이 영역을 수정하는 개발자를 위해 계속 유지할 것.

- **[INFO]** "budget" 용어가 한 노드 안에서 3개 축(도구 정의 payload bytes / 도구 호출 횟수 / working-memory 토큰)에 재사용
  - target 신규 식별자: `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES` / `_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` (§4.2) vs `maxToolCalls` (호출 횟수 축) vs `memoryTokenBudget` (토큰 축)
  - 기존 사용처: 동일 문서(§4.2 서두), 이미 "같은 문서에서 'budget' 이 세 자원에 쓰이므로 주의" 라는 자체 경고 문구를 포함
  - 상세: 세 ENV/필드 모두 codebase(`tool-payload-budget.ts`, `.env.example`, `cross-node-warning-rules.md`)와 1:1 매핑되어 실제 충돌은 없다. 다만 이름 접두어(`AI_AGENT_TOOL_*`)가 세 축 중 하나(정의 payload)만 가리키므로 신규 축 추가 시 접두어 오인 여지가 구조적으로 남아있다.
  - 제안: 현행 유지. 향후 새 "budget" 성격의 필드를 이 노드에 추가할 경우 `AI_AGENT_TOOL_*` 접두어를 재사용하지 말고 축 이름을 접두어에 명시할 것(이미 §4.2 rationale 에 이 원칙이 기록돼 있음 — 신규 위반만 감시하면 됨).

- **[INFO]** payload 미포함 파일(`2-text-classifier.md`, `3-information-extractor.md`)에 대한 커버리지 공백
  - 상세: 이번 검토는 payload 에 포함된 `0-common.md` + `1-ai-agent.md`(일부) 범위만 직접 대조했다. 나머지 두 파일은 디스크에서 grep 교차검증(예: `LLM_CALL_FAILED`, `memoryStrategy` 계열)으로 간접 확인했으나, 전문 라인 단위 대조는 하지 않았다.
  - 제안: 이 두 파일에서 이번에 점검한 것과 다른 성격의 신규 식별자가 있다면 별도 payload 로 재검토 필요. (grep 결과상 두 파일도 기존 corpus 와 이름이 정합적으로 보였음.)

## 점검한 구체 후보 (충돌 없음 확인)

| 식별자 | 검증 결과 |
|---|---|
| `includeSystemContext` / `systemContextSections` | `system-context-schema.ts`/`system-context-prefix.ts` 구현과 1:1, 타 영역 재사용 없음 |
| `presentationTools` / `PresentationToolDef` / `render_table`\|`render_chart`\|`render_carousel`\|`render_template`\|`render_form` | `render-tool-provider.ts`, `ai-agent.schema.ts`(`presentationToolDefSchema`)와 일치. `4-form.md`/`0-common.md`(presentation) 교차문서와 의미 정합 |
| `memoryStrategy` / `memoryTokenBudget` / `memoryKey` / `memoryTopK` / `memoryThreshold` / `memoryTtlDays` / `embeddingModelConfigId` / `summaryModelConfigId` / `extractionModelConfigId` | `ai-memory-manager.ts`, `agent-memory-schema.ts`, `5-system/17-agent-memory.md` 와 전부 정합, 타 의미 재사용 없음 |
| `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES` / `_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` / `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` | `.env.example`, `tool-payload-budget.ts`, `cross-node-warning-rules.md` 와 정합. 다른 ENV 네임스페이스와 충돌 없음 |
| `TOOL_DEFINITION_PAYLOAD_EXCEEDED` (에러 코드) | `error-codes.ts`/`tool-payload-budget.ts` throw 지점과 1:1. `MAX_TOOL_CALLS_EXCEEDED`/`tool_call_budget_exceeded` 와 의도적으로 이름 축 구분(§12.15 rationale 명시) |
| `McpServerRef` / `ConditionDef` | `ai-agent.schema.ts` 타입과 일치. `ConditionDef.id` 의 UUID v4 slug 모델은 `4-nodes/0-overview.md §1.3/§Rationale` 와 명시적으로 단일 모델로 통합돼 있음(자기모순 정정 이력 존재, 신규 충돌 아님) |
| `ND-AG-06` / `ND-AG-10` / `ND-AG-21` | `spec/4-nodes/_product-overview.md` 와 `spec/4-nodes/3-ai/_product-overview.md` 양쪽에서 동일 상태(`제거됨 — 재작성 예정`)로 미러링, drift 없음 |
| `ai_form_render` (interactionType) | `interaction-type-registry.md` 의 `WaitingInteractionType` 4값에 이미 등재, 위 INFO 항목 참고 |

## 요약

Target(`spec/4-nodes/3-ai`)이 payload 상 "새로 도입"하는 것처럼 보이는 식별자들 —
System Context Prefix 필드, Presentation Tool Family(`render_*`), 자동 메모리
전략 필드군, 도구 payload 예산 ENV 4종, 관련 에러 코드 — 는 실제로는 이미
codebase 와 1:1 구현·연동돼 있고 spec 교차 문서와도 정합된, **이미 안착된
기존 식별자**들이었다(git 상 해당 영역에 uncommitted diff 없음). 이름이 겹칠 수
있는 두 지점(`interactionType` 이중 enum, "budget" 다축 재사용)은 이미 spec
스스로 명시적 disambiguation 주석을 갖추고 있어 추가 조치가 불필요하다. 다만
payload 자체가 `2-text-classifier.md`/`3-information-extractor.md` 전문을
포함하지 않아 해당 두 파일은 grep 기반 간접 검증에 그쳤다는 커버리지 한계는
INFO 로 기록한다.

## 위험도

NONE
