# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — WARNING 5건(Cross-Spec 4건 + Plan Coherence 1건), INFO 9건. Critical 0건.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `KnowledgeBase` 신규 컬럼 5개 — `spec/1-data-model.md §2.11` 미반영, §10 반영 목록 누락 | §2.1 knowledge_base 컬럼 표 | `spec/1-data-model.md §2.11 KnowledgeBase` | §10 반영 목록에 `spec/1-data-model.md §2.11` 추가 후 5개 컬럼 동기화 |
| W2 | Cross-Spec | `RerankConfig` 신규 엔티티 — 데이터 모델 ER 다이어그램·핵심 엔티티 목록 미등재 | §2.2 RerankConfig 정의 | `spec/1-data-model.md §1(ER 다이어그램) + §2` | §10 반영 목록에 `spec/1-data-model.md §1 + 신규 §2.N RerankConfig` 추가 |
| W3 | Cross-Spec | `ragThreshold` 의미 이중화(`rerank_mode≠off` 시 cosine→rerank 점수 임계로 변경) — `9-rag-search.md §3.1` 동시 갱신 없이 모순 잔존 | §5 config 설정, §3 검색 후처리 흐름 | `spec/5-system/9-rag-search.md §3.1`, `spec/4-nodes/3-ai/1-ai-agent.md §1` | `9-rag-search.md §3.1` `$3 threshold` 설명에 `rerank_mode` 분기 명시, 두 spec 을 §10 반영 목록에 모두 포함 |
| W4 | Cross-Spec | Graph RAG 내부 "rerank"(centrality 재가중)와 cross-encoder reranking 용어 중의성 — `spec/5-system/10-graph-rag.md` disambiguation 미완성 | §2 데이터 모델 주석, §10 §5 | `spec/5-system/10-graph-rag.md §4 기술 결정, KB-GR-SR-05` | graph-rag.md 의 graph 내부 score 재정렬 단계를 "centrality-weighted score blending" 등으로 명확히 구분; KB-GR-SR-05 설명도 갱신 |
| W5 | Plan Coherence | `spec/4-nodes/3-ai/1-ai-agent.md` 동시 수정 — `claude/ai-context-memory-9c7e6e` branch(PR 없음, active) 와 잠재적 merge conflict | §5, §10 항목 4 | `claude/ai-context-memory-9c7e6e` — 같은 파일 §1 표에 `memoryTopK`/`memoryThreshold` 추가 | §10-4 spec 반영 시점에 `ai-context-memory-9c7e6e` main merge 여부 확인; 필요 시 한쪽이 다른 쪽 위에서 rebase/resolve 직렬화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `LLMClient.rerank?()` 신규 provider — `LLMClientFactory` 별도 경로 미명시 | §6 LLM Client rerank capability | `spec/5-system/7-llm-client.md §4` 에 `RerankClientFactory` 또는 `RerankClient` 별도 인터페이스 경로 명시; §2 프로바이더 표에 Rerank 열 추가 |
| I2 | Cross-Spec | `ragDiagnostics.rerank` 서브객체 추가 — `9-rag-search.md §4.2` 스키마 동기화 필요 (§10 §1 에 이미 포함) | §8 출력 메타데이터 | `spec/5-system/9-rag-search.md §4.2` 에 `rerank?` 선택적 서브객체 스키마와 존재 조건 기술 |
| I3 | Cross-Spec | `ragSources[].score` 의미 변경 + `origin` 신규 필드 — `9-rag-search.md §4.1` 미반영 | §8 ragSources | `spec/5-system/9-rag-search.md §4.1` 에 `origin?: 'cosine' \| 'reranked'` 필드 및 score 이중 의미 명시 |
| I4 | Rationale Continuity | `ragThreshold` 의미 재해석의 동반 Rationale 부재 — 영향 spec 갱신 시 Rationale 항목 없이 남을 위험 | §5 "AI Agent 노드 단위" | 영향 spec 반영 시 Rationale 항목 추가; `ai-agent.md §1` `ragThreshold` 행에 "rerank_mode≠off KB 에서는 rerank 점수 임계로 해석됨" 주석 추가 |
| I5 | Rationale Continuity | `rag_mode` 불변 vs `rerank_mode` 가변 비대칭에 대한 명시 근거 부재 | §2.1 데이터 모델 첫 번째 비고 | target Rationale "왜 KB 단위인가" 항에 "rerank_mode 는 검색 시점 적용이라 재임베딩·마이그레이션 없음" 한 줄 추가 |
| I6 | Rationale Continuity | `LLMClient.rerank?()` 에러 코드 `LLM_CONFIG_INVALID` 재사용 의도 불명 (`LLM_STREAMING_UNSUPPORTED` 전용 코드 패턴과 대비) | §6 | target Rationale 에 "rerank 미지원은 실행 중 아닌 구성 시점 실패이므로 전용 enum 불필요" 명시 권장 |
| I7 | Convention Compliance | `ragDiagnostics.rerank.error` 에러 코드 값 미정의 — 신규 코드 vs 기존 재사용 불명확 | §7 에러 처리 표, §8 출력 메타데이터 JSON | spec 반영 시 각 케이스에 `UPPER_SNAKE_CASE` 코드 명시; 신규라면 `spec/conventions/error-codes.md §3` 레지스트리 등재 여부 결정 |
| I8 | Convention Compliance | `RerankConfig` DTO swagger 패턴 체크리스트 §10 미포함 | §10 반영 대상 spec 목록 | plan 또는 §10 에 "RerankConfig DTO 및 KB 컬럼 확장 마이그레이션 DTO 에 `swagger.md §1` 패턴(JSDoc 한국어 주석 + class-validator 데코레이터) 적용" 항목 추가 |
| I9 | Plan Coherence | parent plan `rag-quality-improvement.md §6` 의 "정책 판단 KB 표시 방법" 결정 추적 누락 | §Rationale "남은 결정(착수 전)" 항목 ③ | `rag-quality-improvement.md §6` 에 "KB 정책 판단 KB 표시 방법(플래그 vs 휴리스틱)" 결정 항목 추가 |

> **NOTE**: workflow 중간 단계에서 `naming_collision` checker output_file 누락 경고가 있었으나, 최종 checker status 는 5개 모두 `success`·`unfinished[]` 비어 있음 — 재시도 불필요.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | WARNING 4건: `spec/1-data-model.md` §10 누락(KnowledgeBase 컬럼+RerankConfig 엔티티), `ragThreshold` 의미 이중화 동시 갱신 미완성, Graph RAG 용어 중의성 미해소 |
| Rationale Continuity | LOW | INFO 3건: 의미 재해석 동반 Rationale 부재, rag_mode/rerank_mode 비대칭 근거 미명시, 에러 코드 재사용 의도 불명 |
| Convention Compliance | LOW | INFO 3건: 에러 코드 값 미정의, swagger DTO 체크리스트 미포함, Overview 헤더 부제 비표준(spec 반영 시 해소) |
| Plan Coherence | LOW | WARNING 1건: `ai-context-memory-9c7e6e` branch 와 `ai-agent.md §1` 동시 수정 잠재 conflict. INFO 2건 |
| Naming Collision | LOW | 충돌 없음 |

## 권장 조치사항

1. **(WARNING W1+W2 해소)** `spec-draft-rag-reranking.md §10` 반영 목록에 `spec/1-data-model.md §2.11 KnowledgeBase(5개 컬럼)` 및 `spec/1-data-model.md §1(ER 다이어그램) + 신규 §2.N RerankConfig` 를 추가한 뒤, consistency-check 통과 후 해당 절 동기화.
2. **(WARNING W3 해소)** §10 반영 목록에 `spec/5-system/9-rag-search.md §3.1` 추가. `ragThreshold` 의미 변경을 `9-rag-search.md §3.1` 과 `ai-agent.md §1` 에 동시 반영.
3. **(WARNING W4 해소)** consistency-check 통과 직후 `spec/5-system/10-graph-rag.md` 의 graph 내부 score 재정렬 명칭을 "centrality-weighted score blending" 등으로 변경; KB-GR-SR-05 설명 동기화.
4. **(WARNING W5 — merge conflict 예방)** `spec/4-nodes/3-ai/1-ai-agent.md §1` 수정 착수 전 `claude/ai-context-memory-9c7e6e` branch 의 main merge 여부 확인; 미merge 시 직렬화 또는 수동 resolve 계획 수립.
5. **(INFO I1)** `spec/5-system/7-llm-client.md §4` 에 `RerankClientFactory` 또는 `RerankClient` 별도 인터페이스 경로 명시 — 구현 단계에서 팩토리 오염 방지.
6. **(INFO I7)** spec 반영 시 §7 에러 케이스별 `UPPER_SNAKE_CASE` 코드 명시; `spec/conventions/error-codes.md §3` 레지스트리 등재 결정.
7. **(Naming Collision)** 충돌 없음 — 조치 불필요.
