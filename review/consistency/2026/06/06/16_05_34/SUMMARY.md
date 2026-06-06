# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다 (Convention Compliance 3건)

## 전체 위험도
**CRITICAL** — spec 단일 진실 원칙의 다중 위반: 존재하지 않는 §3.4 코드 참조, gradingNoGrounding API surface 미정의, conditional escalate vs spec "항상 수행" 직접 모순

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 코드 전체가 존재하지 않는 `spec/5-system/9-rag-search.md §3.4` 를 10+ 곳에서 SoT 로 인용 | `dynamic-cut.util.ts`, `rerank.service.ts`, `rag-search.service.ts`, `kb-tool-provider.ts` 주석 | `spec/5-system/9-rag-search.md` — §3.4 절 부재 | spec 에 §3.4(동적 점수 컷) 신설 또는 §3.3.2 에 편입 후 코드 주석 참조를 실제 절 번호로 일치. project-planner 위임 필요 |
| 2 | Convention Compliance | `gradingNoGrounding: boolean` 및 `grounding: 'none'` / `note` 필드가 spec §4.2·§2.2 에 미정의 상태로 런타임 payload 에 등장 | `rerank.service.ts` (`RerankDiagnostics`), `kb-tool-provider.ts` | `spec/5-system/9-rag-search.md §4.2` rerank 서브객체 스키마, §2.2 KB tool 결과 포맷 | spec §4.2 에 `gradingNoGrounding: boolean` 추가, §2.2 에 `grounding/note` 포맷 명문화. project-planner 위임 필요 |
| 3 | Convention Compliance | `cross_encoder_llm` 경로의 LLM grading 이 spec §3.3.1·§3.3.2 "항상 수행" 명시와 직접 모순 — 구현은 conditional escalate 로 동작 | `rerank.service.ts` — `shouldEscalateGrading()` 신설, escalate 미진입 시 LLM 미호출 | `spec/5-system/9-rag-search.md §3.3.1` 모드 표·§3.3.2 step 3 "항상 수행"·v1 결정 주석 | spec §3.3.1 모드 표·§3.3.2 step 3·v1 결정 주석을 conditional escalate 포함으로 갱신, 임계(ESCALATE_TOP_SCORE_FLOOR, ESCALATE_FLAT_REL_GAP) provisional 상수로 명기. project-planner 위임 필요 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `RerankParams` 의 `topK` → `injectCap` + `tokenBudget` rename 이 spec 에 미반영 | `rerank.service.ts` `RerankParams` 인터페이스 | `spec/5-system/9-rag-search.md §3.3.2` step 5 — 여전히 "top_k 로 slice" 기술, `injectCap`/`tokenBudget` 개념 없음 | spec §3.3.2 step 5 를 `injectCap` + `tokenBudget` 기반 동적 컷으로 갱신, `RerankParams` 파라미터 스키마 명시 |
| 2 | Convention Compliance | `spec §3.1` 파라미터 표의 `$4` 기본값이 여전히 `5` (구현은 `RAG_RECALL_K=50` 으로 변경) | `spec/5-system/9-rag-search.md §3.1` 파라미터 표 | `rag-search.service.ts` — `searchVectorGroup` 호출 LIMIT = `RAG_RECALL_K(50)` | spec §3.1 `$4` 기본값을 `RAG_RECALL_K(50, 내부 상수)` 로 갱신 |
| 3 | Convention Compliance | spec §2.1 의 `top_k` description template 이 `ragTopK optional` 화와 불일치 | `spec/5-system/9-rag-search.md §2.1` ToolDef JSON | `ai-agent.schema.ts` — `ragTopK` optional() 로 변경, `kb-tool-provider.ts` — "If omitted, dynamic cut decides" 로 tool description 변경 | spec §2.1 `top_k` description 을 optional cap 으로 갱신, 미설정 시 동적 컷이 결정함을 추가 |
| 4 | Rationale Continuity | spec §6 에러 처리 테이블의 fallback 행 텍스트가 "top-k 컷" 구 표현 유지 — §3.4 + Rationale "동적 컷 모든 경로 공통 적용" 원칙과 서술 불일치 | `spec/5-system/9-rag-search.md §6` fallback 두 행 | Rationale "v1 breaking note — cutoffApplied 의미 확장 (D1)" | §6 fallback 행의 "top-k 컷" → "§3.4 동적 점수 컷(token-budget + inject-cap)" 으로 변경 (§3.4 신설 후) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/6-knowledge-base.md §1.3` 시퀀스 다이어그램이 D1 이전 고정 topK LIMIT 흐름 표시 | `spec/data-flow/6-knowledge-base.md §1.3` (line 116–121) | 다이어그램을 `searchWithMeta` / `LIMIT RAG_RECALL_K(50)` / `applyDynamicCut` 흐름으로 갱신해 `9-rag-search.md §3.1` 과 동기화 |
| 2 | Cross-Spec | `spec/5-system/7-llm-client.md §3.6` `RerankClient.rerank()` 계약에 전 후보 재점수화 사용 설명 없음 | `spec/5-system/7-llm-client.md §3.6` (line 192) | §3.6 에 "D1 이후 `opts.topK = candidates.length` 전 후보 재점수화, 최종 COUNT 는 `applyDynamicCut` 결정" 노트 추가 |
| 3 | Cross-Spec | `spec/4-nodes/3-ai/1-ai-agent.md §7` 출력 메타 JSON 예제가 신규 `gradingNoGrounding` 필드 누락 | `1-ai-agent.md §7` (line 471–496, 868, 1048–1063) `ragDiagnostics.rerank` 서브객체 | `rerank` 서브객체 예제에 `"gradingNoGrounding": false` 추가 (Critical 2 해소 후 연동) |
| 4 | Convention Compliance | `spec §2.2` 의 `"error": "search_failed"` 가 `lower_snake_case` — error-codes 규약(UPPER_SNAKE_CASE) 위반이나 이번 diff 신규 도입 아님 | `spec/5-system/9-rag-search.md §2.2` | `SEARCH_FAILED` 로 갱신하거나 `error-codes.md §3` historical-artifact 레지스트리에 등재 |
| 5 | Naming Collision | `RAG_INJECT_TOKEN_BUDGET`(8000) 과 `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) — 값 동일, 의미 상이 (의도적 분리, 주석 명시됨) | `dynamic-cut.util.ts`, `agent-memory-schema.ts` | 현 상태 유지 가능. 값 변경 시 spec 주석 기준 확인 |
| 6 | Naming Collision | `tokenBudget` 필드명이 `RerankParams`(KB 주입 컷)와 `agent-memory-injection`(working-memory 압축) 두 도메인에서 독립 사용 | `rerank.service.ts:60`, `agent-memory-injection.ts:272` | 장기적으로 `RerankParams.tokenBudget` → `injectTokenBudget` 으로 명명 검토 (단기 비차단) |
| 7 | Plan Coherence | `rag-dynamic-cut.md` 체크리스트 §9(ai-review + consistency-check)·§10(plan 정리) 미완료 | `plan/in-progress/rag-dynamic-cut.md` line 34–35 | 본 검토 완료 후 §9 체크 + §10 plan 정리 진행 |
| 8 | Plan Coherence | pgvector `ef_search`/`ivfflat.probes` 후속 follow-up 을 추적하는 in-progress plan 없음 | `spec/5-system/9-rag-search.md` Rationale "pgvector 인덱스 파라미터 (follow-up)" | `rag-quality-improvement.md §7.E` 또는 `rag-rerank-followup.md` 에 1행 추가 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 직접 모순 없음. spec SoT(`9-rag-search.md`)와 정합. 3개 downstream spec 문서 미동기화(INFO) |
| Rationale Continuity | LOW | 주요 번복(항상 LLM grading, byte-identical 하위호환) 모두 Rationale 에 명시 갱신. §6 fallback 텍스트 서술 불일치(WARNING 1건) |
| Convention Compliance | CRITICAL | 존재하지 않는 §3.4 참조(C1), gradingNoGrounding 미정의 API surface(C2), conditional escalate vs "항상 수행" 직접 모순(C3). Warning 3건, INFO 1건 추가 |
| Plan Coherence | LOW | 미해결 결정 충돌 없음. provisional default 합의 기준 부합. INFO 2건(체크리스트 미완, follow-up plan 누락) |
| Naming Collision | LOW | 실질적 충돌 없음. 동일 값 별개 상수·tokenBudget 동명 사용은 spec/주석으로 의도 명시됨 |

## 권장 조치사항

1. **(BLOCK 해소 우선 — project-planner 위임)** `spec/5-system/9-rag-search.md` 에 §3.4 절(동적 점수 컷: applyDynamicCut, injectCap, tokenBudget 파라미터 명세) 신설 또는 §3.3.2 편입 후 코드 주석의 §3.4 참조를 실제 절 번호로 교정
2. **(BLOCK 해소 우선 — project-planner 위임)** `spec/5-system/9-rag-search.md §4.2` 에 `gradingNoGrounding: boolean` 추가, §2.2 tool_result content 에 `grounding: 'none'` + `note` 포맷 명문화
3. **(BLOCK 해소 우선 — project-planner 위임)** `spec/5-system/9-rag-search.md §3.3.1` 모드 표·§3.3.2 step 3·v1 결정 주석을 conditional escalate 포함으로 갱신, ESCALATE 임계 provisional 상수로 명기
4. **(Warning — spec 정합)** spec §3.3.2 step 5 에 `injectCap` + `tokenBudget` 파라미터 기반 동적 컷 기술 추가; §3.1 `$4` 기본값을 `RAG_RECALL_K(50)` 으로 갱신; §2.1 `top_k` description 을 optional cap 으로 갱신
5. **(Warning — Rationale 서술 정합)** §6 fallback 행 "top-k 컷" → "§3.4 동적 점수 컷(token-budget + inject-cap)" 으로 갱신 (1번 완료 후)
6. **(INFO — downstream spec 동기화)** `spec/data-flow/6-knowledge-base.md §1.3` 다이어그램, `7-llm-client.md §3.6` 주석, `1-ai-agent.md §7` JSON 예제 순차 갱신
7. **(INFO — plan 정리)** `rag-dynamic-cut.md §9` 체크 완료 + §10 plan 이동 진행; `rag-rerank-followup.md` 에 pgvector follow-up 1행 추가