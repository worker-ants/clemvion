# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 수준 위배만 존재하며 호출자 차단 불필요.

## 전체 위험도
**MEDIUM** — 5개 checker 모두 CRITICAL 없음. Cross-Spec·Rationale Continuity 각 4건의 WARNING이 편집 누락 위험을 내포하며, Plan Coherence 3건의 WARNING이 pending_plans 등록 및 plan 갱신 미비를 지적한다. Convention Compliance·Naming Collision은 NONE/LOW로 경미.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `ragTopK` 기본값 제거 지시가 config 표(4번째 열)·예시 JSON 두 곳 명시 누락 — 편집 시 한 곳만 수정될 위험 | draft §B1/B2 | `spec/4-nodes/3-ai/1-ai-agent.md` 라인 40 (`ragTopK` 기본값 `5`) | draft §B1/B2 지시에 "config 표 4번째 컬럼 `5`→`—`" + "예시 JSON 행 인접 주석" 을 각각 명시적으로 지정 |
| W2 | Cross-Spec | `0-common.md §2` "graph 모드 KB 에서도 동일" 문구가 동적 컷 적용 경로를 불명확하게 남김 | draft §C | `spec/4-nodes/3-ai/0-common.md` 라인 45 | draft §C 교체 텍스트에 "graph 모드 KB — 최종 주입 단계에 동일 동적 컷 적용" 명시 |
| W3 | Cross-Spec | `17-agent-memory.md` §4 "기본값은 RAG 정합을 위해 동일(`5`/`0.7`)" 잔존 가능 — 라인 83 외 다른 부위 갱신 누락 위험 | draft §D (라인 83 교체) | `spec/5-system/17-agent-memory.md` 라인 83 및 §4 기타 부위 | draft §D에 §4 전체에서 '기본값은 RAG 정합을 위해 동일' 문구 완전 제거 여부 확인 지시 추가 |
| W4 | Cross-Spec | `10-graph-rag.md` SQL `$5` 바인딩이 현행 코드에서 여전히 `ragTopK` 를 바인딩하면 주석 교체만으로 spec-impl 불일치 발생 | draft §E (라인 471 SQL 주석 교체) | `spec/5-system/10-graph-rag.md` 라인 471; `rag-search.service.ts` graph 분기 | draft §E 에 "graph SQL `$5` 바인딩이 실제로 `vectorSeedTopK + expandedChunkLimit` 인지 코드 확인 후 주석 교체" 조건 추가 |
| W5 | Cross-Spec | off 행 "byte-identical" 폐기 Rationale 의 교체 경계(위치·범위)가 불명확 — 기존 Rationale 항목 전체 교체 여부 미지정 | draft §A3/§A8 | `spec/5-system/9-rag-search.md` 기존 Rationale "왜 완전 선택적(off 기본)인가" | draft §A8 에 "기존 '왜 완전 선택적인가' 항목 전체를 교체(위치·경계 명시)" 지시 추가 |
| W6 | Rationale Continuity | D2 conditional escalate 번복 시 기존 결정 출처 3곳(`spec-draft-rag-reranking.md §Rationale②`, `rag-search.md §3.3.2 v1`, `rag-quality-improvement.md §6 라인 172`) 인용이 draft 에 확정 텍스트가 아닌 편집 지시 형태로만 존재 | draft §A4/§A8 (W7/I5) | `plan/complete/spec-draft-rag-reranking.md §Rationale`, `spec/5-system/9-rag-search.md §3.3.2`, `plan/in-progress/rag-quality-improvement.md §6 라인 172` | §A8 내에 기존 결정 원문 출처를 draft 본문에 직접 인용 문구로 삽입해 편집 시 생략 불가하도록 확정 |
| W7 | Rationale Continuity | off 모드 `byte-identical` 폐기 선언이 W8/I6 편집 지시로만 존재 — spec 편집 시 §A8 Rationale 에 누락되면 기존 (a) 조항과 신규 동작 충돌 | draft §A8 (W8/I6) | `spec/5-system/9-rag-search.md §Rationale (a)`, `plan/complete/spec-draft-rag-reranking.md §Rationale` | §A8 "왜 완전 선택적(off 기본)인가" 에 '(a) byte-identical 근거 폐기' 확정 텍스트로 삽입 |
| W8 | Plan Coherence | `rag-quality-improvement.md §7.C` (D2 conditional escalate 임계 튜닝 backlog) 에 "메커니즘 구현 완료" 상태 표기 누락 | draft §F (W9) | `plan/in-progress/rag-quality-improvement.md §7.C` | draft §F 에 `rag-quality-improvement.md §7.C` 에 "메커니즘 구현 완료(rag-dynamic-cut), 정량 임계 후속" 상태 표기 1줄 추가 |
| W9 | Plan Coherence | `9-rag-search.md` pending_plans 추가 파일명이 실제 파일과 불일치 — §A1 은 `rag-dynamic-cut.md` 지시, 실제 파일명은 `spec-draft-rag-dynamic-cut.md` | draft §A1 | `spec/5-system/9-rag-search.md` frontmatter `pending_plans` | §A1 의 파일명을 실제 plan 파일(`spec-draft-rag-dynamic-cut.md` 또는 별도 impl plan)로 정정하거나 `rag-dynamic-cut.md` 별도 생성 계획 명시 |
| W10 | Plan Coherence | 수정 대상 4개 spec 파일(`1-ai-agent.md`·`0-common.md`·`17-agent-memory.md`·`10-graph-rag.md`) 에 본 plan `pending_plans` 미등록 — §A1 에서 `9-rag-search.md` 만 처리 | draft §B·§C·§D·§E | `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/10-graph-rag.md` frontmatter | draft §B~§E 각 섹션에 "frontmatter `pending_plans` 추가" 1행 병기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `9-rag-search.md §2.1` `top_k` description 갱신이 보조 섹션(W4/I2)에만 언급, §A 공식 편집 지시 미포함 | draft §A (보조 섹션 W4/I2) | draft §A 에 "§2.1 `top_k` description 교체" 를 정식 편집 지시로 승격 |
| I2 | Cross-Spec | `plan/complete/spec-draft-rag-reranking.md` v1 결정과의 교차 참조 혼란 방지 — "(rag-dynamic-cut PR 에서 conditional escalate 로 변경됨)" 추기 검토 | draft §A8 | §A8 Rationale 인용 지시에 plan/complete 문서 추기 항목을 별도 §F 로 추가 여부 검토 |
| I3 | Cross-Spec | `1-data-model.md §2.11` `rerank_candidate_k` 설명에 "off 경로는 내부 상수 RAG_RECALL_K(50) 사용, 본 필드와 독립" 주석 동기화 미지시 | draft 전체 | draft §F 또는 §A 에 동기화 주석 추가 고려 |
| I4 | Cross-Spec | `ragDiagnostics.cutoffApplied` 의미 확장 — off 경로 동적 컷 적용 시 진단 필드 부재가 의도적 v1 생략임을 명기 미완 | draft §A6 | draft §A6 에 "off 경로 cutoffApplied 미노출 — v1 의도적 생략(진단 schema 증식 회피)" 한 줄 추가 |
| I5 | Rationale Continuity | off 모드 cosine θ 유지와 기각 대안("cosine 임계 유지한 채 리랭크")의 구분 설명이 지시 수준에 머무름 | draft §A8 | §A8 Rationale 에 "off cosine θ 유지는 기각 대안과 별개 — off 에는 리랭커 없어 cosine θ 가 유일 관련성 게이트" 확정 텍스트로 포함 |
| I6 | Rationale Continuity | `ragTopK` 기본값 제거 및 내부 상수 정책 — 기존 합의 원칙의 연속 적용으로 정합 | draft §B1/§A8 | 추가 조치 불필요. spec 편집 시 §A8 해당 항목 누락 여부만 확인 |
| I7 | Convention Compliance | plan frontmatter `spec_impact` 필드 미기재 — Gate C cutoff 이후 plan이나 in-progress 단계에서는 의무 아님 | frontmatter | `complete/` 이동 직전 `spec_impact:` 필드 추가 |
| I8 | Plan Coherence | `10-graph-rag.md` `status: implemented` — 경미한 주석/흐름 수정이나 status 재검토 언급 부재 | draft §E | §E 에 "status: implemented 유지 의도, spec-status-lifecycle 가드 통과 예상" 1줄 명기 |
| I9 | Plan Coherence | `rag-rerank-followup.md` `worktree: rag-rerank-impl` stale 참조 (PR #465 MERGED) | `plan/in-progress/rag-rerank-followup.md` frontmatter | worktree 필드를 `(unstarted)` 로 별도 cleanup |
| I10 | Plan Coherence | `ai-context-memory-followup-v2.md` `17-agent-memory.md §3 AGM-04` SPEC-DRIFT 미해소 — §D 와 섹션 분리로 직접 충돌 없음 | `plan/in-progress/ai-context-memory-followup-v2.md` | target plan 진행 시 해당 SPEC-DRIFT 동시 처리 여부 확인 |
| I11 | Naming Collision | `RAG_RECALL_K`(50) vs `rerank_candidate_k` default(50) — 수치 동일, 의미·경로 독립. target §A5 (I3) 에서 이미 분리 명기 | draft §A5 | §A5 각주에 "RAG_RECALL_K 조정 시 rerank_candidate_k 기본값과 수치 정합 의도 여부 Rationale 에 명시" 권장 |
| I12 | Naming Collision | `RAG_INJECT_TOKEN_BUDGET`(8000) vs `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) — 값 우연 일치, §A8 Rationale 에 분리 근거 명문화됨 | draft §A8 | 추가 조치 불필요. 구현 시 두 상수 모듈 분리 주의 |
| I13 | Naming Collision | `cutoffApplied` 의미 broadening — rerank 점수 컷 단독→token-budget/inject-cap 포함 확장 | draft §A6 (I11) | spec 편집 시 §4.2 `ragDiagnostics` 표에 확장 의미 명시 갱신 |
| I14 | Naming Collision | `llmGradingApplied` 의미 세분화 — 상위 호환 확장으로 충돌 없음 | draft §A6 (I1) | spec 편집 시 §4.2 에 두 케이스 구분 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 5건 WARNING(편집 지시 불완전 — config 표 2곳 갱신 누락 위험, graph SQL `$5` 바인딩 미확인, off 행 Rationale 교체 경계 불명확), 4건 INFO |
| Rationale Continuity | MEDIUM | 2건 WARNING(D2 번복 및 byte-identical 폐기 선언이 편집 지시 형태에 머물러 spec 편집 시 누락 위험), 3건 INFO |
| Convention Compliance | NONE | 필수 3필드 frontmatter 완비, 위치·명명 규약 준수. spec_impact 미기재는 in-progress 단계 의무 아님 |
| Plan Coherence | LOW | 3건 WARNING(rag-quality-improvement §7.C 상태 표기 누락, pending_plans 파일명 불일치, 4개 spec 파일 pending_plans 미등록), 3건 INFO |
| Naming Collision | LOW | CRITICAL/WARNING 없음. 신규 식별자 3종 충돌 없음. cutoffApplied/llmGradingApplied 의미 확장은 target에서 명시 처리 |

## 권장 조치사항

1. **(W6·W7) Rationale 확정 텍스트 삽입** — draft §A8 에 D2 번복 출처 3곳 직접 인용 문구 및 byte-identical 폐기 선언을 편집 지시가 아닌 확정 문안으로 명기. 이 두 항목이 누락되면 `spec/5-system/9-rag-search.md` 기존 Rationale과 신규 동작이 충돌 상태가 된다.
2. **(W4) graph SQL `$5` 바인딩 코드 확인** — `rag-search.service.ts` graph 분기에서 `$5` 가 현재 `ragTopK` 를 바인딩하는지 `vectorSeedTopK + expandedChunkLimit` 를 바인딩하는지 확인. `ragTopK` 바인딩이라면 주석 교체 외 코드 변경도 developer 범위에 추가.
3. **(W1) config 표·예시 JSON 동시 갱신 지시** — draft §B1/B2 에 "config 표 4번째 컬럼 `5`→`—`" 와 "예시 JSON 행 인접 주석" 두 곳을 명시적으로 지정해 편집 누락 방지.
4. **(W9·W10) pending_plans 등록 정비** — §A1 의 파일명 정정 + §B~§E 각 섹션에 해당 spec 파일 frontmatter `pending_plans` 추가 1행 병기.
5. **(W8) rag-quality-improvement §7.C 상태 표기** — draft §F 에 `rag-quality-improvement.md §7.C` 메커니즘 완료 상태 표기 1줄 추가.
6. **(W2·W3·W5) 교체 텍스트·경계 명확화** — §C 교체 텍스트에 graph 경로 동작 명시, §D 에 §4 전체 문구 제거 확인 지시, §A8 에 Rationale 교체 경계 명시.
7. **(I7) spec_impact 필드** — `complete/` 이동 직전 frontmatter 에 영향 spec 5개 파일 경로 추가.