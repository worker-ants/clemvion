# 정식 규약 준수 검토 — spec/4-nodes/3-ai/

검토 모드: `--impl-prep` (구현 착수 전), scope=`spec/4-nodes/3-ai/`

## 검토 방법

`spec/4-nodes/3-ai/{0-common,1-ai-agent,2-text-classifier,3-information-extractor}.md` 전체와, 현재 worktree 가 `main` 대비 갖고 있는 실제 diff(§4.2/§10 "도구 정의 payload 예산 저장 시점 경고" — Planned→구현완료 전환, `spec/conventions/cross-node-warning-rules.md` status `partial`→`implemented`)를 대조 대상으로 삼아 아래 정식 규약과 교차 검증했다.

- `spec/conventions/node-output.md` (Principle 0~11 — output/config/meta/에러/멀티턴 계약)
- `spec/conventions/cross-node-warning-rules.md` (graph warning rule 정의·severity·SSOT)
- `spec/conventions/error-codes.md` (에러 코드 명명 규율)
- `spec/conventions/interaction-type-registry.md` (WaitingInteractionType / ConversationTurnSource / PresentationType enum 매트릭스)
- `spec/conventions/conversation-thread.md` (자동 주입·source enum·§9 렌더 매핑 — cross-reference 정합만 확인)
- `spec/conventions/swagger.md` (Response DTO 명명 패턴 — 참조된 REST endpoint 서술의 정합성만 확인)
- CLAUDE.md 문서 구조 규약 (`_product-overview.md`, `0-` prefix, Overview/본문/Rationale)

코드 레벨(실제 env var 이름, rule id, DTO 등)도 spec 서술과 대조해 drift 여부를 확인했다 (`tool-payload-budget.ts`, `.env.example`, `tool-payload-save-warning.ts`, `workflows.controller.ts`).

## 발견사항

없음 — CRITICAL/WARNING 레벨 위반을 발견하지 못했다.

### 확인된 정합 사항 (참고, 조치 불요)

- **§4.2/§10 저장 시점 경고 서술 전환** (`1-ai-agent.md`) — "⚠ 구현 현황(Planned)" 문구가 제거되고 config-time graph warning 이 구현 완료로 서술되며, `cross-node-warning-rules.md` §8 도 동일하게 "**⚠ 구현 예정(Planned)**" 문구를 제거하고 실제 배선(`WorkflowsService` 가 `getGraphWarnings` append / `saveCanvas` 가 error 시 차단)을 명시했다. 두 문서가 동일 사실을 동시에 갱신해 drift 가 없다.
- **rule id / env var 명명** — `ai_agent:tool-payload-budget`(문서) ↔ `AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID`(코드) 일치. `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES` / `_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` / `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 4개 env var 모두 `.env.example`·`tool-payload-budget.ts`·spec 표기가 정확히 일치.
- **에러 코드 명명** — `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(신규) / `GRAPH_VALIDATION_FAILED`(기존 재사용) 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명으로 `error-codes.md §1` 준수. `error-codes.md §3` historical-artifact 예외 등록 대상 아님 (신규 코드가 처음부터 정확한 이름).
- **`output.error.details.retryable` 필수 필드** — `1-ai-agent.md §10` 의 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 행이 `retryable: false` 를 details 안에 명시해 `node-output.md §3.2.1` (LLM 계열 노드 필수) 을 준수. `2-text-classifier.md`/`3-information-extractor.md` 도 동일 패턴 준수 확인.
- **cross-node-warning-rules 컨벤션 자체 정합** — `§5` "예외 — backend-only async rule" 절의 서술(가드 ② 생략·가드 ①③ 안전망)과 `§8` 테이블 항목이 diff 이후에도 일관. severity 승격 로직(`AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 시 warning→error)도 `§5`/`§8`/`1-ai-agent.md §10` 세 곳에서 동일하게 서술.
- **interaction-type / conversation-thread 매트릭스 cross-ref** — `interactionType: 'ai_conversation'` / `'ai_form_render'`, presentation `render_*` 5종, `ConversationTurnSource` 값 사용이 `interaction-type-registry.md` 의 등록된 enum·매트릭스와 정확히 일치.
- **문서 구조** — 4개 파일 모두 frontmatter(`id`/`status`/`code:`) + 번호 매김 본문 + 말미 `## Rationale`(또는 `## N. Rationale`) 3섹션 구조를 유지. `_product-overview.md` 명명, `0-common.md` 의 `0-` prefix 관례도 준수. (숫자 있는 `## N. Rationale` vs 숫자 없는 `## Rationale` 혼용은 `spec/4-nodes/` 전역에 걸쳐 이미 광범위하게 공존하는 기존 스타일이며 본 영역에 국한된 신규 이슈가 아니라 별도 지적하지 않음.)
- **stale 참조 없음** — 완료된 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 항목 A 관련 문구("Planned", plan 경로 인용)가 두 spec 문서 어디에도 잔존하지 않음. `pending_plans:` frontmatter 도 두 문서 모두 정리됨.

## 요약

`spec/4-nodes/3-ai/` 전체와 이번 worktree 의 실제 변경분(§4.2/§10 저장 시점 경고 Planned→구현완료 전환 + `cross-node-warning-rules.md` status 승격)을 `node-output.md`, `cross-node-warning-rules.md`, `error-codes.md`, `interaction-type-registry.md` 등 정식 규약과 대조한 결과 CRITICAL/WARNING 위반은 발견되지 않았다. 명명(rule id·env var·에러 코드)·출력 포맷(`output.error.details.retryable` 등)·문서 구조 모두 규약과 정합하며, 두 spec 문서 간 상태 서술도 drift 없이 동기화되어 있다. 다음 작업(항목 B — resume turn timeoutMs/signal 배선) 착수를 이 관점에서 막을 사유가 없다.

## 위험도
NONE
