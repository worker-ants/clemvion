# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 3건 (naming_collision): 신규 spec 필드명이 기존 구현 및 타 도메인 식별자와 직접 충돌

---

## 전체 위험도

**CRITICAL** — `embeddingModelConfigId` / `summaryModelConfigId` / `extractionModelConfigId` 세 필드명이 기존 구현(`agent-memory-schema.ts`, `ai-agent.handler.ts`)·관련 spec(`17-agent-memory.md`, `13-agent-memory.md`)에서 이미 확정된 `embeddingModel` / `summaryModel` / `extractionModel` 과 직접 충돌하며, `embeddingModelConfigId` 는 KnowledgeBase 도메인의 기존 DB 컬럼과 이중 충돌.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `embeddingModelConfigId` 가 (a) 기존 구현의 `embeddingModel`(모델명 문자열 저장) 과 충돌, (b) KnowledgeBase 엔티티의 기존 DB 컬럼 `embeddingModelConfigId`(KB 임베딩 ModelConfig FK)와 동일 이름·다른 의미로 이중 충돌 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표 | `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts:186`, `ai-agent.handler.ts:810`, `spec/5-system/17-agent-memory.md:46,76`, `spec/data-flow/13-agent-memory.md:63,73`, `knowledge-base.entity.d.ts`, `spec/data-flow/6-knowledge-base.md:231` | AI Agent memory config 필드를 `embeddingModel`(기존 이름)로 유지하거나, ModelConfig ID 방식으로 변경 시 `memoryEmbeddingModelConfigId`(또는 `agentMemoryEmbeddingConfigId`) 등 KB 도메인과 구별되는 이름으로 신설. 전체 구현·spec 동시 갱신 필수. |
| 2 | Naming Collision | `summaryModelConfigId` 가 기존 구현·spec 의 `summaryModel`(모델명 문자열, zod 필드) 과 충돌. 저장 타입도 불일치(문자열 모델명 vs UUID). | `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표 | `agent-memory-schema.ts:215`, `ai-agent.handler.ts:728,833,1463,2010,2360`, `spec/4-nodes/3-ai/1-ai-agent.md:60,364`(커밋된 파일), `spec/conventions/conversation-thread.md:294` | `summaryModel` 필드명을 유지하거나, UUID 방식으로 전환 시 구현·spec 전체를 함께 갱신. |
| 3 | Naming Collision | `extractionModelConfigId` 가 기존 구현·spec 의 `extractionModel`(모델명 문자열) 과 충돌. 저장 타입도 불일치. | `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표, `spec/4-nodes/3-ai/3-information-extractor.md` §1 | `agent-memory-schema.ts:234`, `ai-agent.handler.ts:2011`, `agent-memory-injection.ts:541,651`, `spec/5-system/17-agent-memory.md:75,86`, `spec/data-flow/13-agent-memory.md:63,71,178,188` | `extractionModel` 유지 또는 전체 동시 갱신. target 문서만 단독 변경 시 구현과 직접 충돌. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | target 문서 내부 불일치 — §1 config 표는 `embeddingModelConfigId` / `summaryModelConfigId` / `extractionModelConfigId`를 쓰고 §7 Config echo 정책 문단은 `embeddingModel?` / `summaryModel?` / `extractionModel?`(구 필드명)을 그대로 나열 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 vs §7 | 동일 문서 내 §7 Config echo | 필드명을 한 방향으로 통일. Critical 해소 방향에 맞춰 §7 도 정렬. |
| 2 | Rationale Continuity | `spec/5-system/17-agent-memory.md` §1·§3·§4 및 요구사항 주석 `AGM-04` 가 구 설계(`embeddingModel` / `extractionModel`, 모델명 문자열, `llmConfigId` provider 재사용, `embedding-model-selector` 위젯)를 그대로 기술 — target 의 "재번복 결정"(ModelConfig config.id 선택, provider 디커플) 미반영 | `spec/4-nodes/3-ai/1-ai-agent.md` §12.12 "재번복 결정" | `spec/5-system/17-agent-memory.md` §1·§3·§4, `AGM-04` 주석 | Critical 해소와 함께: 필드명 확정 방향에 맞춰 `17-agent-memory.md`·`AGM-04` 를 동시 갱신. `1-ai-agent.md §12.12 "재번복 결정"` 역참조 추가. |
| 3 | Plan Coherence | 직전 plan `agent-memory-model-select.md`(worktree: `agent-memory-model-select-83e703`)의 `[ ] /consistency-check --impl-done` gate 가 미완료인 채로 현재 plan 이 동일 spec 영역(`spec/4-nodes/3-ai/1-ai-agent.md` §1 3필드)을 재개정·완료 선언하는 구조 — 잔여 체크박스 처리·plan 이동 절차 미명시 | `plan/in-progress/agent-memory-model-config.md` | `plan/in-progress/agent-memory-model-select.md` | 현재 plan 완료 시 `agent-memory-model-select.md` 의 미완료 항목을 "(후속 plan으로 대체)" 표기 후 `plan/complete/` 로 이동. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `summaryModelConfigId` 가 `17-agent-memory.md §3 추출 파이프라인` 에 언급 없음 — 단일 진실 위치 불명확 | `spec/4-nodes/3-ai/1-ai-agent.md` §1, §6.1, §12.12 | `17-agent-memory.md §3` 상단에 요약 모델 SoT 는 AI Agent §6.1·§12.12 임을 한 줄 cross-ref 추가 (필수 아님). |
| 2 | Cross-Spec | `chat-config-selector` / `embedding-config-selector` 위젯이 AI Agent 보조 LLM 필드에서 `/models` 목록을 참조한다는 사실이 `spec/2-navigation/6-config.md` 에 미기술 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 | `6-config.md Part B.2·B.5` 에 AI Agent 위젯 후보 공급원 주석 추가 고려 (필수 아님). |
| 3 | Cross-Spec | `0-common.md §10` 에 `summaryModelConfigId` 가 `ai_agent` 전용(IE 에 없음) 임이 명시적 비고로 없음 | `spec/4-nodes/3-ai/0-common.md §10` | "summaryModelConfigId 는 ai_agent 전용" 비고 추가 (필수 아님). |
| 4 | Cross-Spec | `17-agent-memory.md §3` 은 폴백 체인을 4단계로 명시하나 `3-information-extractor.md §1` 은 간략 표현 — 실질 의미 동일, SoT 는 `17-agent-memory.md §3` | `spec/4-nodes/3-ai/3-information-extractor.md §1` | `3-information-extractor.md §1` 에 `17-agent-memory.md §3` 과 동일한 폴백 체인 표현 또는 cross-ref 추가 (필수 아님). |
| 5 | Rationale Continuity | `17-agent-memory.md` Rationale 에 "재번복 결정" 역참조 부재 | `spec/5-system/17-agent-memory.md` Rationale | WARNING 2번 수정 시 §1·§3 에 `1-ai-agent.md §12.12` 역참조 명시. |
| 6 | Rationale Continuity | `spec/4-nodes/3-ai/2-text-classifier.md` 에 Rationale 섹션 없음 — `memoryStrategy` 미채택 근거가 자체 문서에 없음 | `spec/4-nodes/3-ai/2-text-classifier.md` | 최소한의 Rationale 섹션 추가 ("단일 턴·무상태, memoryStrategy 제외, contextScope(manual)만 적용"). |
| 7 | Convention Compliance | `3-information-extractor.md` frontmatter `status: implemented` 인데 frontend 위젯 경로(`embedding-config-selector`, `chat-config-selector`) 가 `code:` 에 누락 | `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter | 위젯 구현 여부 확인 후: (a) 완료 → `code:` 에 frontend 경로 추가, (b) 미구현 → `status: partial` + `pending_plans` 등재. |
| 8 | Convention Compliance | `1-ai-agent.md §12.12` 에 폐기 경과 이력(v1·후속 결정 단락)이 본문에 병존 — 권장 구조(`## Rationale`)와 거리감 | `spec/4-nodes/3-ai/1-ai-agent.md §12.12` | 향후 정리 시 폐기 경과는 `## Rationale` 로 이동, §12.12 본문은 최종 설계만 기술. |
| 9 | Convention Compliance | `3-information-extractor.md §2` 아스키 다이어그램에 신규 Memory 섹션 미반영 | `spec/4-nodes/3-ai/3-information-extractor.md §2` | Memory 섹션(`Strategy: [Manual ▼]`, embedding/extraction config 선택기) 추가해 AI Agent §2 와 대칭 유지. |
| 10 | Plan Coherence | `ai-context-memory-followup-v2.md` 의 `[x] §12.12 별도 필드 없음` 완료 항목 서술이 현재 spec 과 불일치(구버전 기술) | `plan/in-progress/ai-context-memory-followup-v2.md` | 해당 완료 항목 뒤에 "(agent-memory-model-config plan 에서 재번복 — config.id 방식으로 대체)" 추적 메모 추가. |
| 11 | Naming Collision | `includeSystemContext` / `systemContextSections` — 신규 도입, 기존 구현과 이름·의미 일치. 충돌 없음. | `spec/4-nodes/3-ai/1-ai-agent.md §11, §1` | 조치 불필요. |
| 12 | Naming Collision | `memoryTtlDays` / `memoryTokenBudget` / `memoryTopK` / `memoryThreshold` / `memoryKey` / `memoryStrategy` — 기존 구현·spec 과 일치. 충돌 없음. | `spec/4-nodes/3-ai/1-ai-agent.md §1` | 조치 불필요. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 신규 메모리 config 필드가 타 영역 spec 과 직접 모순 없음. INFO 4건 (표현 완전성 보강 권장). |
| Rationale Continuity | MEDIUM | `17-agent-memory.md` 가 "재번복 결정"(ModelConfig config.id, provider 디커플)을 반영하지 않고 구 설계(`embeddingModel`/`extractionModel`, 모델명 문자열) 유지. WARNING 1건 + INFO 2건. |
| Convention Compliance | NONE | 핵심 규약 준수. INFO 3건 (frontmatter status, 이력 위치, UI 다이어그램). |
| Plan Coherence | LOW | 직전 plan `agent-memory-model-select.md` 의 `--impl-done` gate 미완료 채로 현재 plan 이 동일 영역 재개정. WARNING 1건 + INFO 2건. |
| Naming Collision | CRITICAL | 세 신규 필드명(`embeddingModelConfigId` / `summaryModelConfigId` / `extractionModelConfigId`)이 기존 구현·spec 의 확정 이름과 직접 충돌. `embeddingModelConfigId` 는 KB 도메인과 이중 충돌. CRITICAL 3건 + WARNING 1건. |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** 세 필드명 방향을 결정하고 일관 적용:
   - **Option A (충돌 최소화)**: `embeddingModel` / `summaryModel` / `extractionModel` 유지 — `spec/4-nodes/3-ai/1-ai-agent.md §1` 표와 §7 Config echo 를 기존 이름으로 복원. spec 변경 없이 구현이 현행 유지.
   - **Option B (ModelConfig ID 방식 채택)**: 필드명을 `memoryEmbeddingModelConfigId` / `memorySummaryModelConfigId` / `memoryExtractionModelConfigId` 등 KB 도메인과 구별되는 이름으로 신설 후 — `spec/4-nodes/3-ai/1-ai-agent.md`, `3-information-extractor.md`, `spec/5-system/17-agent-memory.md`, `spec/data-flow/13-agent-memory.md`, `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts`, `ai-agent.handler.ts`, `agent-memory-injection.ts` 전체 동시 갱신. KnowledgeBase 도메인의 `embeddingModelConfigId` 는 그대로 유지.

2. **(WARNING 해소)** Critical 해소 방향과 맞춰 `spec/5-system/17-agent-memory.md §1·§3·§4` 및 `AGM-04` 요구사항 주석의 필드명을 확정된 이름으로 갱신하고, `1-ai-agent.md §12.12 "재번복 결정"` 역참조 추가.

3. **(WARNING 해소)** `plan/in-progress/agent-memory-model-select.md` 의 `[ ] --impl-done` 항목을 "(후속 plan `agent-memory-model-config.md` 의 --impl-done 으로 대체됨)" 으로 표기하고 `plan/complete/` 로 이동 (완료 커밋에 포함).

4. **(INFO 권장)** `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter `status` 확인 후 위젯 미구현 시 `partial` 로 갱신.

5. **(INFO 권장)** `spec/4-nodes/3-ai/2-text-classifier.md` 에 Rationale 섹션 추가 (단일 턴·무상태·memoryStrategy 미채택 근거).