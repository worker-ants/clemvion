# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 한다.

## 전체 위험도
**CRITICAL** — 보조 모델 선택 필드 3종(`embeddingModel`/`summaryModel`/`extractionModel` → `embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId`)의 설계 전환이 draft target 에만 반영되고 관련 spec 5개 파일에는 구 명칭이 그대로 잔존하여, 동일 개념이 두 이름·두 저장 타입으로 동시에 존재하는 상태다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 보조 모델 선택 필드 전면 교체 — draft(`*ModelConfigId`, ModelConfig UUID, cross-provider) vs live spec(`*Model`, 모델명 문자열, same-provider) 직접 모순. 저장 형태·Provider 독립성·widget·fallback 체인 모두 변경되나 연관 spec 파일 미동기화 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표, §6.1 단계 1.3·1.5·2.7, §7 Config echo | `spec/5-system/17-agent-memory.md` §1·§3·§4; `spec/4-nodes/3-ai/3-information-extractor.md` §설정·§7; `spec/4-nodes/3-ai/1-ai-agent.md` §12.12; `spec/4-nodes/3-ai/1-ai-agent.md` live lines 59-61·442 | draft 채택 확정 시 `spec/5-system/17-agent-memory.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/4-nodes/3-ai/1-ai-agent.md §12.12`, `spec/conventions/conversation-thread.md`, `spec/data-flow/13-agent-memory.md` 를 동시 갱신. 미확정이면 project-planner 선행 결정 필요 |
| 2 | Naming Collision | 동일 개념이 `embeddingModel`/`summaryModel`/`extractionModel`(문자열) 과 `embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId`(UUID) 두 이름·두 타입으로 spec 전역 공존 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 (신 이름), §7 config echo · §12.12 (구 이름 혼재) | `spec/5-system/17-agent-memory.md` lines 46·75-76·86·96; `spec/conventions/conversation-thread.md` line 298; `spec/data-flow/13-agent-memory.md` lines 63·71·73·115·135·178·188·189·267; `spec/4-nodes/3-ai/3-information-extractor.md` lines 37-38·150·674·682 | 확정 방향으로 5개 파일 전역 일괄 교체. `1-ai-agent.md` §7 config echo 즉시 교체 (`embeddingModel?` → `embeddingModelConfigId?` 등) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `embeddingModelConfigId` 폴백 체인 — `ModelConfigService.resolveEmbedding` 의 하드코딩 3단계 fallback 포함 여부 불명확 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 `embeddingModelConfigId` 행 | `spec/5-system/17-agent-memory.md` §3 "임베딩 모델 출처" 3단계 체인 | `17-agent-memory.md` §3 을 draft 기반 폴백 체인(2단계 또는 3단계)으로 동기화. `resolveEmbedding` 거동 명시 |
| 2 | Cross-Spec | `summaryModelConfigId` 폴백 종착점 불명확 — draft "노드 main llmConfig defaultModel"과 live "노드 `model` 필드 → llmConfig.defaultModel" 의 중간 경유 여부 차이 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 `summaryModelConfigId` 행, §6.1 단계 1.5 | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 1.5 (live); `spec/5-system/17-agent-memory.md` §3 AGM-04 | Draft §6.1 1.5의 폴백 체인을 `summaryModelConfigId → 노드 llmConfigId(ModelConfig 전체)`로 명확 기술 후 `17-agent-memory.md §3` 동기화 |
| 3 | Cross-Spec | `extractionModelConfigId` 폴백 — live AGM-04(`extractionModel ?? 노드 model ?? llmConfig 기본`) vs draft(ModelConfig UUID, 노드 `llmConfigId` 폴백) 명명·체인 불일치 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 `extractionModelConfigId` 행, §6.1 단계 2.7 | `spec/5-system/17-agent-memory.md` §3 AGM-04; `spec/4-nodes/3-ai/3-information-extractor.md` §7 lines 674·682 | `17-agent-memory.md §3 AGM-04` 및 `3-information-extractor.md §7` 을 draft 기반 폴백 체인으로 함께 갱신 |
| 4 | Naming Collision | target `1-ai-agent.md` §7 config echo 목록이 §1 신 이름(`*ModelConfigId`)과 다른 구 이름(`*Model`)을 사용 — 파일 자체 self-inconsistency | `spec/4-nodes/3-ai/1-ai-agent.md` §7 config echo (line 442) | 동일 파일 §1 config 표 | config echo 목록을 `embeddingModelConfigId?`, `summaryModelConfigId?`, `extractionModelConfigId?` 로 즉시 교체 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | §12.12 폐기 단락들의 "폐기됨" 표기 미흡 — ⚠️ 주석으로 이력 성격 명시됐으나 빠른 읽기 시 오독 가능 | `spec/4-nodes/3-ai/1-ai-agent.md` §12.12 | 각 폐기 단락 제목에 `(폐기됨 — 이력 보존)` 추가 (선택) |
| 2 | Rationale Continuity | `0-common.md §10` 에 IE에 `summaryModelConfigId` 가 없는 이유 cross-reference 부재 | `spec/4-nodes/3-ai/0-common.md` §10 | IE spec §9.1 참조 링크 추가 |
| 3 | Convention Compliance | §12.12 번복 이력 단락이 Rationale 대신 본문(§12)에 인라인 거주 — 3섹션 구조 규약과 거리 있음 | `spec/4-nodes/3-ai/1-ai-agent.md` §12 | 번복 이력을 `## Rationale §12.12` 하위로 이동, 본문에는 현행 확정 설계만 유지 (비차단) |
| 4 | Convention Compliance | `1-ai-agent.md` frontmatter `pending_plans: ai-context-memory-followup-v2.md` — 이번 구현 완료 여부 확인 필요 | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter | `plan/in-progress/ai-context-memory-followup-v2.md` 잔여 항목 확인; 완료 시 `plan/complete/` 이동 + frontmatter 제거 |
| 5 | Convention Compliance | `3-information-extractor.md` `status: implemented` 이지만 신규 `embeddingModelConfigId`/`extractionModelConfigId` 구현 여부 검증 필요 | `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter | `information-extractor.schema.ts`, `agent-memory-injection.ts` 에 신규 필드 존재 확인; 미구현 시 `status: partial` + `pending_plans` 추가 |
| 6 | Convention Compliance | `0-common.md` 에 구 필드명(`embeddingModel`/`summaryModel`/`extractionModel`) 잔존 가능 — diff 미포함으로 확인 불가 | `spec/4-nodes/3-ai/0-common.md` | `0-common.md` 전체 검색 후 신 이름으로 갱신 |
| 7 | Convention Compliance | `3-information-extractor.md §9.3` config echo `config.schema` 키명 — 기존 알려진 결함 W-1, 이번 변경과 무관 | `spec/4-nodes/3-ai/3-information-extractor.md` §9.3 | 기존 이연 항목. §9.3 명시로 추적 중 |
| 8 | Naming Collision | `includeSystemContext`/`systemContextSections` 신규 도입 — 기존 충돌 없음 | `spec/4-nodes/3-ai/0-common.md` §11 | 없음 |
| 9 | Naming Collision | `embeddingModelConfigId` vs `KnowledgeBase.embedding_model_config_id` — 다른 컨텍스트, 의미 정합, 충돌 아님 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 | CRITICAL 해소 시 자연 정합 |
| 10 | Plan Coherence | 검토 파일 없음(plan_coherence.md 미생성) — 재시도 필요 | — | plan_coherence checker 재실행 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | CRITICAL | 보조 모델 필드 3종 설계 전환 — draft만 반영, 연관 spec 5개 파일 미동기화. 폴백 체인 3건 WARNING |
| Naming Collision | CRITICAL | 동일 개념 두 이름·두 저장 타입 spec 전역 공존 (5개 파일, 15개 이상 참조). target 파일 self-inconsistency(§1 vs §7) WARNING |
| Convention Compliance | LOW | INFO 5건(이력 위치, frontmatter 상태 확인, 필드명 갱신 누락 가능성). CRITICAL/WARNING 없음 |
| Rationale Continuity | NONE | INFO 2건(가독성 개선 제안). 핵심 결정 이력 3단계 기록 우수 |
| Plan Coherence | 재시도 필요 | 출력 파일 미생성 — checker 실행 실패 또는 결과 없음 |

## 권장 조치사항

1. **(BLOCK 해소 우선) project-planner 결정 선행**: `*ModelConfigId` 전환이 확정인지 확인. 확정이라면 아래 2번 진행; 미확정이면 spec draft 를 rollback 하거나 결정 전까지 BLOCK 유지.
2. **(BLOCK 해소) 연관 spec 5개 파일 일괄 동기화**: `spec/4-nodes/3-ai/1-ai-agent.md` §7(config echo) · §12.12(Rationale 구 이름); `spec/4-nodes/3-ai/3-information-extractor.md` §설정·§7; `spec/5-system/17-agent-memory.md` §1·§3·§4 AGM-04; `spec/conventions/conversation-thread.md` line 298; `spec/data-flow/13-agent-memory.md` lines 63·71·73·115·135·178·188·189·267 — 전체 `embeddingModel`/`summaryModel`/`extractionModel` → `embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId` 교체.
3. **(BLOCK 해소) 구현 코드 확인**: `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts`, `agent-memory-injection.ts`, `ai-agent.schema.ts`, `information-extractor.schema.ts` 에서 신구 필드명 현황 점검. 코드가 여전히 구 필드명 기반이라면 코드도 전환 대상.
4. **(WARNING 해소) 폴백 체인 3건 명확화**: `embeddingModelConfigId` → `resolveEmbedding` 3단계 fallback 포함 여부 `17-agent-memory.md §3` 에 명시; `summaryModelConfigId` 폴백 종착점(`노드 model` 경유 여부) `§6.1 1.5` 에 명확 기술; `extractionModelConfigId` 폴백 체인 `AGM-04` 동기화.
5. **(WARNING 해소) target 파일 self-inconsistency 즉시 수정**: `1-ai-agent.md §7` config echo 목록을 `embeddingModelConfigId?`, `summaryModelConfigId?`, `extractionModelConfigId?` 로 교체.
6. **(INFO) Plan coherence checker 재실행**: `plan_coherence.md` 출력 파일이 생성되지 않았으므로 checker 단독 재실행 후 결과 확인.
7. **(INFO) frontmatter 정리**: `plan/in-progress/ai-context-memory-followup-v2.md` 잔여 항목 확인 후 완료 시 `plan/complete/` 이동.