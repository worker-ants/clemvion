# Consistency Check (impl-done, scope=spec/4-nodes/3-ai/)
**BLOCK: NO** — Critical 없음. LOW. 런타임 무영향(type-only).
## 경고 (WARNING) — 전부 SPEC-DRIFT(planner) 또는 frontend(pre-existing), 회귀 아님
| # | Checker | 위배 | 처분 |
|---|---|---|---|
| 1 | Cross-Spec | `LlmCallRecord.startedAt`/`finishedAt` 가 `0-common.md §6`·`1-ai-agent.md §8` 미반영 | **planner**: AI 노드 spec turnDebug 설명에 optional 필드 반영 |
| 2 | Cross-Spec | canonical `TurnDebugEntry` 가 spec 의 turn-level 진단필드(toolCalls?·ragSources?·ragDiagnostics?·mcpDiagnostics?) 미포함 | **이연**: plan 범위는 EE+IE 로컬 타입 통일(turnIndex·llmCalls·totalDurationMs subset). spec full turnDebug superset 확장은 `ai-context-memory-followup-v2.md` backlog. |
| 3 | Convention | shared/llm-tracing/llm-call-record.ts 가 `0-common.md`·`3-information-extractor.md` frontmatter `code:` 미등록 | **planner**: frontmatter code: 추가 |
| 4 | Convention | spec 역참조 누락(shared 가 canonical SoT 임을 spec 본문 미인식) | **planner**: §6/§8 에 SoT 한 줄 |
| 5 | Naming | frontend `TurnDebugEntry`(output-shape.ts·conversation-utils.ts) 다른 shape 독립 정의 | **이연(frontend·pre-existing)**: TS 경계 분리로 런타임 충돌 없음. backend canonical 과 별개. frontend 용도별 rename 은 중기 grooming. |
## INFO
SoT 주석 AI spec 병기·ai-agent inline 근거주석·_product-overview Rationale·frontend LlmCallTrace 명칭 — 전부 선택/pre-existing/planner.
> impl-done BLOCK:NO. Warning 전부 spec enrichment(planner) 또는 frontend pre-existing → 수렴. plan SPEC-DRIFT 후속 등재.
