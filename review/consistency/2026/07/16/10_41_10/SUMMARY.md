# Consistency Check 통합 보고서 (--impl-prep, item B) — 처리 결과

**최종 처분 (5/5 checker 확보 후)**: item B(timeout 배선) 관련 findings 는 조치 완료, item B 무관 pre-existing spec 본문 Critical 2건은 project-planner task(`task_3ac39ebd`)로 위임(사용자 결정 "B 진행 + planner 위임"). item B 구현 진행.

- **Critical (rationale_continuity) — §12.16 error-routing overclaim [FIXED]**: §12.16 이 timeout throw → `LLM_CALL_FAILED` 로 단정했으나 single-turn(`executeSingleTurn`)은 일반 chat try/catch 부재로 엔진 FAILED(기존 gap). §12.16 을 turn 종류별 비대칭으로 정정 + node-output-redesign gap 명시.
- **WARNING (naming) — `LLM_CALL_FAILED` vs `LLM_TIMEOUT` [FIXED]**: §12.16 에 disambiguation(LLM_TIMEOUT 은 Workflow AI Assistant 전용) 추가.
- **WARNING (rationale) — ai_agent-only scope 근거 [FIXED]**: §12.16 에 스코프 근거 추가.
- **Critical #1 (cross_spec) — out 포트 하위호환 서술 정반대 [PRE-EXISTING, 위임]**: 요구사항 ND-AG-24 vs 기술 §3.2. 내 diff 무관(git 검증). → task_3ac39ebd.
- **Critical #2 (cross_spec) — count_max=128 vs Cafe24/MakeShop 기본 연결 상시 실패 + op수 문서 불일치 [PRE-EXISTING, 위임]**: #948 established 동작, item A 저장 경고가 완화. 내 diff 무관. → task_3ac39ebd.

item B 코드(4개 chat timeoutMs + ResumableMessageOptions.signal plumbing)는 위 어느 Critical 위치도 건드리지 않으며, 내 spec 오기(§12.16)는 정정됐다.

---

## (원본 workflow 판정)

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 하는지

## 전체 위험도
**CRITICAL** — Multi Turn `out` 포트 서술이 요구사항 문서와 기술 spec에서 정반대이고, `AI_AGENT_TOOL_COUNT_MAX=128` 기본값이 Cafe24(383)/MakeShop(161) 기본 연결 경로를 상시 실패시키는데 "구현 완료"로 서술돼 있음 — 두 건 모두 impl-prep 착수 전 SoT 확정 필요.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | Multi Turn `out` 포트 "조건 0개 시 하위 호환 유지" 여부가 요구사항 문서와 기술 spec에서 정반대로 서술됨 | `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 (본문: "`out` 포트 존재하지 않음" + 마이그레이션: "dangling, 수동 재연결 필요") | `spec/4-nodes/_product-overview.md` ND-AG-24 및 `spec/4-nodes/3-ai/_product-overview.md` ND-AG-24 ("조건 0개 시 `out` + `error` 제공 (하위 호환)") — 두 `_product-overview.md`가 자기모순도 포함 | 실제 코드(`ai-agent.handler.ts`/`ai-turn-executor.ts` 포트 계산 로직)를 SoT로 확정 후, (a) 기술 spec이 맞으면 두 `_product-overview.md`의 ND-AG-24 "하위 호환" 문구 삭제, (b) 반대면 `1-ai-agent.md` §3.2 본문·마이그레이션 절 정정. 이후 한쪽을 SoT로 링크해 재발 방지 |
| 2 | Cross-Spec | `AI_AGENT_TOOL_COUNT_MAX` 기본값 128이 Cafe24/MakeShop 기본(미설정=전체노출) 연결 경로에서 상시 초과 → 항상 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 런타임 실패, 그런데 spec은 "구현 완료"로 서술 | `spec/4-nodes/3-ai/1-ai-agent.md` §1(`enabledTools` 기본=전체노출) + §4.2(`AI_AGENT_TOOL_COUNT_MAX=128`, 초과 시 hard fail 취급) + §12.15(Cafe24 실측 383개) | `spec/0-overview.md` §6.1 "Cafe24/MakeShop AI Agent Internal MCP Bridge … 모두 구현 완료" · `spec/4-nodes/4-integration/4-cafe24.md`("~180" endpoint, §12.15의 "383"과 2배 이상 불일치) · `5-makeshop.md`("161") | (1) `4-cafe24.md`의 "~180"을 재확인해 "383"으로 정정하거나 두 숫자가 다른 집합임을 명시. (2) `1-ai-agent.md` §1/§2에 "Cafe24(383)/MakeShop(161)은 기본 128 한도 초과 → `enabledTools` allowlist 설정 사실상 필수" 경고 명문화, 또는 §10 저장 경고 severity를 이 두 통합 한정 기본 승격. (3) `spec/0-overview.md` §6.1 "구현 완료" 서술에 이 제약 각주 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | app-level chat timeout(§12.16, 신규 `AI_AGENT_LLM_CALL_TIMEOUT_MS`)이 `LLM_CALL_FAILED`로 귀결되는데, 동일 registry에 세맨틱이 겹치는 형제 코드 `LLM_TIMEOUT`이 이미 존재하며 같은 노드의 유닛 테스트(`ai-turn-executor.spec.ts:679,712`)가 오히려 `LLM_TIMEOUT`을 timeout 예시로 사용 중 — §12.16에 disambiguation 없음 | `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 | `codebase/backend/src/nodes/core/error-codes.ts:42`(`LLM_TIMEOUT`) · `spec/5-system/3-error-handling.md:115,324`(형제 코드 나란히 등재) · `spec/5-system/7-llm-client.md:345`(이미 이 모호성을 한 번 다룸) · `spec/3-workflow-editor/4-ai-assistant.md:624`(별도 기능이 `LLM_TIMEOUT` 사용) | §12.16(또는 §10 표 근처)에 "본 app-level timeout은 §5-system/7-llm-client.md의 기존 분류(network timeout → `LLM_CALL_FAILED`)를 따르며, `nodes/core/error-codes.ts`의 `LLM_TIMEOUT`은 Workflow AI Assistant 전용 별개 taxonomy — ai_agent 노드는 사용하지 않는다" 한 줄 추가. `ai-turn-executor.spec.ts`의 예시 코드도 `LLM_CALL_FAILED`로 교체 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Naming Collision | 신규 `llm-call-timeout.ts`가 기존 `llm-call-record.ts`와 `llm-call-*` 접두 공유 (디렉터리·책임 상이해 실질 충돌 아님) | `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts` vs `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` | 조치 불요(선택) — JSDoc 헤더에 "llm-call-record.ts와 무관, 호출당 app-level timeout 설정 전용" 한 줄 |
| 2 | Naming Collision | `AI_AGENT_LLM_CALL_TIMEOUT_MS`가 `ai_agent` 전용 스코프 — `0-common.md` 공통 영역이 아니라 text_classifier/information_extractor에는 이 defense-in-depth 미적용 비대칭 | `AI_AGENT_LLM_CALL_TIMEOUT_MS` | 현재 조치 불요. 후속으로 다른 AI 노드에 동일 defense-in-depth 도입 시 노드별 접두 또는 `0-common.md` 공통 env 승격 검토 |
| 3 | Naming Collision | 그 외 신규 식별자(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`, `AI_AGENT_TOOL_PAYLOAD_SOFT/HARD_BYTES`, `AI_AGENT_TOOL_COUNT_MAX`, `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`, `estimateAgentToolPayload`, rule id `ai_agent:tool-payload-budget`, `includeSystemContext`/`systemContextSections`, `ResumableMessageOptions.signal`, §12.16 섹션 번호) 전수 grep 결과 CRITICAL 재정의 충돌 없음 | `spec/4-nodes/3-ai/1-ai-agent.md` 및 관련 코드 전반 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | CRITICAL | Multi Turn `out` 포트 하위 호환 서술 정반대(요구사항 vs 기술 spec) + `AI_AGENT_TOOL_COUNT_MAX=128`가 Cafe24/MakeShop 기본 경로를 상시 실패시키는데 "구현 완료"로 서술, Cafe24 오퍼레이션 수치도 문서 간 불일치(~180 vs 383) |
| Rationale Continuity | 재시도 필요 | status=success로 보고됐으나 `rationale_continuity.md` output_file이 디스크에 생성되지 않음(FS-write flakiness) — 내용 확보 실패 |
| Convention Compliance | NONE | `node-output.md`/`cross-node-warning-rules.md`/`error-codes.md`/`interaction-type-registry.md` 등 정식 규약 전수 대조, CRITICAL/WARNING 위반 없음. §4.2/§10 Planned→구현완료 상태 전환도 두 spec 문서가 drift 없이 동기화됨 |
| Plan Coherence | 재시도 필요 | status=success로 보고됐으나 `plan_coherence.md` output_file이 디스크에 생성되지 않음(FS-write flakiness) — 내용 확보 실패 |
| Naming Collision | LOW | `LLM_CALL_FAILED` vs `LLM_TIMEOUT` 세맨틱 중첩(WARNING, disambiguation 누락), 나머지는 실질 충돌 없는 INFO 수준 근접 명명 |

## 권장 조치사항
1. (BLOCK 해소 우선) Multi Turn `out` 포트 하위 호환 여부를 코드(`ai-agent.handler.ts`/`ai-turn-executor.ts`)로 SoT 확정 → `1-ai-agent.md` §3.2 또는 두 `_product-overview.md`의 ND-AG-24 중 틀린 쪽 정정.
2. (BLOCK 해소 우선) `AI_AGENT_TOOL_COUNT_MAX=128` 기본값이 Cafe24(383)/MakeShop(161) 기본 연결 경로를 상시 실패시키는 제약을 `spec/0-overview.md` §6.1과 `1-ai-agent.md` §1/§2에 명문화하고, `4-cafe24.md`의 "~180" vs §12.15 "383" 수치 불일치를 정정.
3. `rationale_continuity` / `plan_coherence` checker를 재실행하여 output_file을 재확보(현재 status=success인데 파일 미생성 — 알려진 FS-write flakiness). 재확보 후 Critical 여부 재확인 전까지 이번 BLOCK 판정을 최종으로 간주하지 말 것.
4. (WARNING) §12.16에 `LLM_CALL_FAILED` vs `LLM_TIMEOUT` disambiguation 한 줄 추가, `ai-turn-executor.spec.ts` 예시 코드 정합화.