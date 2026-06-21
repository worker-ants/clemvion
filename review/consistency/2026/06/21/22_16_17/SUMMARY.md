# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 신규 파일 2개의 spec frontmatter 미등재(이미 plan 추적 중) 외 기능 충돌 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | 신규 파일 2개 spec frontmatter `code:` 미등재 (spec drift) | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` | `ai-memory-manager.ts`, `ai-condition-evaluator.ts` 미등재 | `1-ai-agent.md` frontmatter `code:` 에 두 파일 추가 (planner, M-1 전체 완료 시 일괄). 이미 plan 의 "planner 후속(비차단 SPEC-DRIFT)" 항목 및 이전 impl-done WARNING 으로 추적 중 |
| 2 | Convention Compliance | `_product-overview.md` — spec frontmatter 없음 (인지 사항) | `spec/4-nodes/3-ai/_product-overview.md` | `spec/conventions/spec-impl-evidence.md §1` 면제 대상(밑줄 prefix) | 기술적 위반 아님. PRD ✅ 표시를 대규모 리팩터링 후 수동 동기화 필요 인지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/1-data-model.md §2.16` ModelConfig 참조 관계 목록에 신규 3개 필드 미등재 (`embeddingModelConfigId`, `summaryModelConfigId`, `extractionModelConfigId`) | `spec/4-nodes/3-ai/1-ai-agent.md §1` | `spec/1-data-model.md §2.16` 에 JSONB 참조 항목 추가 (project-planner 위임) |
| 2 | Cross-Spec | `ND-AG-30` 요구사항 열거에 `compactedMessages?` 미등재 — 기존 백로그 항목 | `spec/4-nodes/_product-overview.md ND-AG-30` | `ND-AG-30` 설명에 `compactedMessages?` 추가 또는 `ai-context-memory-followup-v2.md` 체크박스 이행 (project-planner 위임) |
| 3 | Cross-Spec | `embeddingModelConfigId` 등 위젯의 AI Assistant candidate picker 비대상 여부를 노드 spec 에 미명시 | `spec/4-nodes/3-ai/1-ai-agent.md §1` | 경미한 패턴 불일치. 낮은 우선순위 정비 |
| 4 | Convention Compliance | `0-common.md` frontmatter `id: common` — 영역 prefix 없음 | `spec/4-nodes/3-ai/0-common.md` | 현재 충돌 없음. 예방 차원 `id: ai-node-common` 고려 가능 |
| 5 | Convention Compliance | `2-text-classifier.md` — `memoryStrategy` 의도적 제외 근거 본문 미명시 | `spec/4-nodes/3-ai/2-text-classifier.md §1` | 한 줄 주석 추가로 향후 drift 오탐 방지 |
| 6 | Convention Compliance | `1-ai-agent.md §4` 비활성 필드 정의 잔존 (pending_plans 커버) | `spec/4-nodes/3-ai/1-ai-agent.md §4` | plan 완료 시 spec 동기 갱신 필요. 현재 `ai-agent-tool-connection-rewrite.md` 추적 중 |
| 7 | Convention Compliance | `1-ai-agent.md §1` `contextScope` 필드 `✓` 필수 표시 의미 모호 | `spec/4-nodes/3-ai/1-ai-agent.md §1` | spec 표 범례에 "필수" 컬럼 의미 명시 |
| 8 | Plan Coherence | `1-ai-agent.md` frontmatter `code:` 및 §6.1 구현 참조 미갱신 | `spec/4-nodes/3-ai/1-ai-agent.md` | M-1 전체 완료 후 일괄 갱신 예정. plan 추적 중 |
| 9 | Plan Coherence | `ai-context-memory-followup-v2.md` 잔여 backlog spec 반영 대기 | `spec/4-nodes/3-ai/1-ai-agent.md §6.2`, `0-common.md §10` | M-1 2단계와 직교. 해당 plan 책임 |
| 10 | Plan Coherence | `node-output-redesign/ai-agent.md` gap 항목 M-1 2단계와 무관하게 잔존 | `spec/4-nodes/3-ai/1-ai-agent.md §7` | 충돌 없음. 해당 plan 책임 |
| 11 | Naming Collision | `AiMemoryManager` vs `AgentMemoryService` — 이름 근접, 레이어 다름 | `ai-memory-manager.ts`, `agent-memory.service.ts` | 현행 명명 유지. JSDoc 이미 층위 명확히 기술 |
| 12 | Naming Collision | `AiConditionEvaluator` vs `condition-evaluator.util.ts` — 단어 공유, 범위 다름 | `ai-condition-evaluator.ts`, `condition-evaluator.util.ts` | 현행 명명 유지. `Ai` 접두사로 명확히 구분 |
| 13 | Naming Collision | `system-context-schema.ts` — `spec/4-nodes/3-ai/0-common.md` frontmatter `code:` 미등재 | `spec/4-nodes/3-ai/0-common.md` frontmatter | `0-common.md` `code:` 에 `system-context-schema.ts` 추가 (planner 처리) |
| 14 | Rationale Continuity | §12.9~12.14 Rationale 불변식 전체 보존 확인 | `ai-memory-manager.ts` 전반 | 조치 불필요. 완전 보존 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | INFO 3건 — ModelConfig 참조 관계 목록 동기화 갭, ND-AG-30 열거 누락, 위젯 candidate picker 미명시. 기능 충돌 없음 |
| Rationale Continuity | NONE | §12.9~12.14 Rationale 불변식 완전 보존. 기각된 대안 재도입 없음 |
| Convention Compliance | LOW | WARNING 1건(인지 사항, 기술적 위반 아님), INFO 5건. CRITICAL 없음 |
| Plan Coherence | NONE | CRITICAL/WARNING 없음. 기존 plan 추적 항목과 충돌 없음 |
| Naming Collision | LOW | WARNING 1건(spec frontmatter code: 미등재 — 기존 plan 추적 중), INFO 3건. 실질 충돌 없음 |

## 권장 조치사항

1. (BLOCK 해소 우선) 해당 없음 — BLOCK: NO.
2. (WARNING — planner, 비차단) `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts`·`ai-condition-evaluator.ts` 추가. M-1 전체 완료(3단계) 후 일괄 처리 권장. 이미 `plan/in-progress/refactor/02-architecture.md` 추적 중.
3. (INFO — planner, 낮은 우선순위) `spec/1-data-model.md §2.16` 참조 관계 블록에 신규 3개 필드 (`embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId`) 추가 (JSONB, FK 없음 표기 포함).
4. (INFO — planner, 낮은 우선순위) `spec/4-nodes/_product-overview.md ND-AG-30` 에 `compactedMessages?` 추가 또는 `ai-context-memory-followup-v2.md` 백로그 체크박스 이행.
5. (INFO — planner, 낮은 우선순위) `spec/4-nodes/3-ai/0-common.md` frontmatter `code:` 에 `system-context-schema.ts` 추가.