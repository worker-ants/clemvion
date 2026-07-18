# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 3건 (spec 자기모순 1건 + pending_plans/status 부정확 2건)으로 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — Multi-turn `out` 포트 유무를 둘러싼 spec 자기모순이 4회 연속 발견에도 미해소이며, AI Agent 단일턴 `error` 포트와 Information Extractor `resumed` 스냅샷 두 미구현 surface 가 `pending_plans` 추적 없이 (후자는 `status: implemented` 로) 서술돼 있음

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity + plan_coherence (공통 발견) | Multi Turn 모드 `out` 포트 유무가 정면 모순 — 번복 사유 Rationale 없음 | `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 ("out 포트가 존재하지 않는다 … 조건 0개인 경우에도 동일" + 마이그레이션 절) | `spec/4-nodes/3-ai/_product-overview.md:84` 및 `spec/4-nodes/_product-overview.md:215` ND-AG-24 ("조건 0개 시 out+error 제공, 하위 호환") | `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 을 project-planner 가 처분 — 코드 SoT(현재 out 없음, `ai-turn-executor.ts` 의 `multiTurnPortForEndReason` 과 일치)를 확정하면 `_product-overview.md` 양쪽 문구 삭제 + §12 Rationale 에 번복 사유 명문화, 반대라면 `1-ai-agent.md §3.2`/마이그레이션 절 정정. 4회 연속(10:41→12_22_49→13_55_11→14_46_28) 재발견된 미해소 durable 이슈 |
| 2 | plan_coherence | AI Agent §7.3 (single-turn `error` 포트) 미구현 상태가 캐비엇 없이 "모든 오류 상황"으로 서술, `pending_plans` 미등재 | `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 + frontmatter `pending_plans`(현재 2건만) | `plan/in-progress/node-output-redesign/ai-agent.md` — "executeSingleTurn 의 llmService.chat 미try/catch, 근거: ai-turn-executor.ts:1209/:1439" | `pending_plans` 에 `node-output-redesign/ai-agent.md`(또는 README) 추가 + §7.3 에 single-turn 경로 한계 캐비엇 명시, 또는 developer 착수 범위에 포함해 즉시 해소 |
| 3 | plan_coherence | Information Extractor §5.5 (`resumed` 구조화 스냅샷) — `status: implemented` 인데 실제 미구현, `pending_plans` 부재 | `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter(`status: implemented`) + §5.5 | `plan/in-progress/node-output-redesign/information-extractor.md`(6차 갱신, "status:'resumed' snapshot 미emit" 잔여) + `ai-agent.md`("구조화 emit 추가 여부 미결정") | `status: partial` 로 하향 + `pending_plans` 등재, §5.5 에 ai-agent §7.5 수준의 observability-only 캐비엇 반영. 근본 해소는 node-output-redesign plan 의 "미결정" 항목 project-planner 선확정 필요 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `0-common.md §5` 가 LLM 3노드 출력 wrapper 계약(실제 Principle 1.1/3.2/4.4/8.2 분담)을 문서 서식 규칙인 Principle 11 로 잘못 귀속 — 같은 영역 형제 문서(`2-text-classifier.md:130`, `3-information-extractor.md:181`)는 Principle 11 을 올바른 의미(문서 서식)로 사용해 동일 번호가 두 가지 뜻으로 충돌 | `spec/4-nodes/3-ai/0-common.md` §5 제목/본문(라인 81/83/89), §9(라인 144) | `spec/conventions/node-output.md` Principle 1.1/3.2/4.4/8.2 (실제 wrapper 계약) vs Principle 11(문서 서식) | "(Principle 11)" 삭제 또는 "(Principle 1.1/3.2/4.4/8.2)"로 정정. §9 인용부도 동일 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `1-ai-agent.md §7.1~§7.9` 출력 케이스 헤더가 Principle 11 의 `### Case:` 서식(형제 문서·타 노드 문서 관행)을 따르지 않음 | `spec/4-nodes/3-ai/1-ai-agent.md` §7.x | 후속 편집 시 `### 7.1 Case: Single Turn 정상 완료 (out 포트)` 형태로 통일 (우선순위 낮음) |
| 2 | rationale_continuity | §12.9~12.13 다단계 설계 번복 기록(이전 결정 인용+사유+불변식 검증)이 모범 사례이며 `conversation-thread.md §7` 과도 정합 | `spec/4-nodes/3-ai/1-ai-agent.md` §12 | 조치 불필요 (참고용 긍정 기록) |
| 3 | rationale_continuity | `AI_AGENT_TOOL_COUNT_MAX=128` vs Cafe24/MakeShop 카탈로그 규모 불일치는 이미 사용자 결정으로 해소(2026-07-17) | `1-ai-agent.md` §4.2/§12.15 | 조치 불필요 (처분 완료 확인용) |
| 4 | plan_coherence | Text Classifier 잔여 legacy 항목(코드 청소 수준)이 `pending_plans` 미등재, 런타임 동작 차이 없음 | `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter | 여유 있을 때 `pending_plans` 등재해 추적 일관성 확보 |
| 5 | plan_coherence | `ie-endmultiturn-errorpayload-contract.md`(이번 리뷰 트리거 plan)는 target §5.3 과 이미 정합 확인 | `3-information-extractor.md` §5.3 | 조치 불필요 |
| 6 | cross_spec | `ai_agent:too-many-conditions` warningRule 이 `cross-node-warning-rules.md` 레지스트리에 없음 — 조사 결과 스코프 차이(mini-DSL vs graphWarningRules)에 따른 정상 상태로 오탐 판정 | `spec/4-nodes/3-ai/1-ai-agent.md` §5.1 | 조치 불필요 (오탐) |
| 7 | naming_collision | `interactionType` 이 `execution_step.interaction_data` 축과 `WaitingInteractionType` 축에서 동명이의로 재사용되나 이미 spec 이 명시적으로 disambiguate | §0-common/§1-ai-agent §7.4·§6.1 vs `spec/1-data-model.md:2017` | 조치 불필요, 유지만 할 것 |
| 8 | naming_collision | "budget" 용어가 payload bytes/호출 횟수/토큰 3축에 재사용되나 §4.2 자체가 이미 경고 문구 보유 | `1-ai-agent.md` §4.2 | 신규 budget 필드 추가 시 `AI_AGENT_TOOL_*` 접두어 재사용 금지 원칙 유지 |
| 9 | naming_collision | 검토 payload 에 `2-text-classifier.md`/`3-information-extractor.md` 전문이 포함되지 않아 grep 기반 간접 검증에 그침 | (커버리지 메타) | 필요 시 두 파일 전문 포함한 별도 payload 로 재검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 교차 영역 충돌 없음. 유일한 의심 항목(warningRule 레지스트리 미등재)은 스코프 차이로 오탐 판정 |
| Rationale Continuity | HIGH | Multi-turn `out` 포트 모순이 §12 Rationale 에 번복 사유 없이 미해소(durable plan 에 4회 연속 발견 기록) |
| Convention Compliance | LOW | `0-common.md §5` Principle 11 오귀속(WARNING), `1-ai-agent.md` Case 헤더 서식 편차(INFO). 기능적 계약(wrapper/에러/포트 명명)은 전부 준수 |
| Plan Coherence | CRITICAL | Multi-turn out 포트 모순(공통) + AI Agent 단일턴 error 포트·IE resumed 스냅샷 두 미구현 surface 가 `pending_plans`/`status` 부정확 |
| Naming Collision | NONE | 신규로 보이던 식별자 전부 기존 codebase/spec 과 1:1 정합. 동명이의 2곳은 이미 disambiguate 상태 |

## 권장 조치사항

1. (BLOCK 해소 우선) project-planner 가 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 을 처분 — Multi-turn `out` 포트 유무의 코드 SoT 를 확정하고 `_product-overview.md`(ND-AG-24, 2곳) 또는 `1-ai-agent.md §3.2`/마이그레이션 절 중 한쪽을 정정 + §12 Rationale 에 번복 사유 명문화.
2. `1-ai-agent.md` frontmatter `pending_plans` 에 `node-output-redesign/ai-agent.md`(또는 README) 추가하고 §7.3 에 single-turn `error` 포트 미구현 캐비엇 반영. 대안으로 developer 가 이번 착수 범위에 이 CRITICAL 항목(try/catch 누락, `ai-turn-executor.ts:1209/:1439`)을 포함해 즉시 해소.
3. `3-information-extractor.md` frontmatter `status` 를 `partial` 로 하향하고 `pending_plans` 에 `node-output-redesign/information-extractor.md` 등재, §5.5 에 observability-only 캐비엇 반영. 근본 해소는 node-output-redesign plan 의 "구조화 emit 추가 여부 미결정" 항목을 project-planner 가 먼저 확정.
4. `0-common.md §5`/§9 의 "(Principle 11)" 인용을 "(Principle 1.1/3.2/4.4/8.2)"로 정정 (WARNING).
5. (선택, 낮은 우선순위) `1-ai-agent.md §7.x` 출력 케이스 헤더를 형제 문서 관행에 맞춰 `### N.M Case: <이름>` 형태로 통일하고, `2-text-classifier.md` 의 legacy 코드청소 항목도 `pending_plans` 에 등재.
