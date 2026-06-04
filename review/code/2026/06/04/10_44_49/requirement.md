# 요구사항(Requirement) 리뷰 결과

**대상**: RAG 리랭킹 P1 구현 (rag-rerank-impl worktree)
**검토 범위**: consistency review 산출물(review/consistency/…) + spec 변경(spec/0-overview.md, spec/1-data-model.md, spec/5-system/3-error-handling.md, spec/5-system/7-llm-client.md, spec/5-system/9-rag-search.md) + 백엔드 구현 코드

---

## 발견사항

### 1. [WARNING] `ragDiagnostics.rerank` 필드가 kb-tool-provider 경로에서 전달되지 않음
- **위치**: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts:237` — `ragSearchService.search()` 호출
- **상세**: spec `9-rag-search.md §4.2` 는 `ragDiagnostics.rerank` 서브객체를 "Planned" 로 정의하면서 `rerank_mode ≠ off` 호출 시 채워지도록 스키마를 명시한다. 실제 리랭크 진단 데이터는 `RagSearchService.searchWithMeta()` 의 반환 `rerank` 필드에 있으나, `kb-tool-provider` 는 `ragSearchService.search()` 만 호출하여 반환값이 `SearchResult[]` 뿐이다. 결과적으로 `cross_encoder` 모드가 실행되어도 `ragDiagnosticsDelta` 에는 `rerank` 서브객체가 없다. spec §4.2 의 `rerank?` 가 "Planned" 마커이긴 하나, 구현 plan (`rag-rerank-impl.md`) 이 "ragDiagnostics.rerank 출력"을 이번 PR 범위의 체크항목으로 명시하고 있으므로 의도적 누락이 아닌 미구현이다.
- **제안**: `kb-tool-provider` 에서 `ragSearchService.searchWithMeta()` 를 호출하고, 반환된 `rerank` 진단을 `ragDiagnosticsDelta` 에 포함시킨다. 또는 plan 의 해당 체크항목을 `rag-rerank-followup.md` 로 이동해 의도적 지연임을 명시한다.

---

### 2. [WARNING] `fallback()` 에서 `origin: 'reranked'` 를 강제 설정 — spec 의 graceful degradation 동작과 불일치
- **위치**: `/codebase/backend/src/modules/knowledge-base/search/rerank.service.ts:141` — `fallback()` 내 `origin: 'reranked' as const`
- **상세**: spec `9-rag-search.md §4.1` 은 `origin = 'reranked'` 를 "리랭크 후처리 적용" 청크에 붙이는 값으로 정의한다. `rerank.service.ts` 의 `fallback()` 은 리랭커 endpoint 실패 또는 설정 오류 시 cosine 순 원본 후보를 반환하는데, 이때 `origin: 'reranked'` 를 설정한다. 안전 강등된 결과물임에도 front-end References UI 에 "리랭크 적용" 표시가 붙는 셈이다. spec §6 에러 처리 표는 강등 시 `ragDiagnostics.rerank.error` 로 표시하되, 청크 자체의 `origin` 을 "리랭크 적용"으로 오표시하는 것은 spec 에 기술되지 않았다. 강등 결과는 cosine score 유지 + `origin` 미설정이 더 정확하다.
- **제안**: `fallback()` 의 `map` 블록에서 `origin: 'reranked'` 를 제거하거나 `origin` 을 원본 후보의 `origin` 값(있으면 유지, 없으면 `cosine` 계열)으로 유지한다.

---

### 3. [WARNING] `rerank_candidate_k` DB CHECK 제약: 최댓값 200 — spec 기본값 50 과의 범위 확인 필요
- **위치**: `/codebase/backend/migrations/V074__knowledge_base_rerank.sql:17` — `CHECK (rerank_candidate_k BETWEEN 1 AND 200)`
- **상세**: spec `9-rag-search.md §3.3.2` 는 `rerank_candidate_k` 기본값을 50 으로 명시하고, 1-data-model.md §2.11 도 동일하다. 마이그레이션은 `BETWEEN 1 AND 200` 제약을 걸었는데, 이 상한 200 의 근거가 spec 에 명시되지 않았다. spec 에는 최댓값 정의가 없으므로 설계자 결정이 spec 에서 빠진 것이다. 200 이 비즈니스 맥락에서 적절한지 검토 필요하다.
- **제안**: spec `1-data-model.md §2.11` 의 `rerank_candidate_k` 필드 설명에 허용 범위(예: "1~200")를 명시해 코드와 spec 을 일치시킨다. 또는 상한을 변경할 경우 마이그레이션과 spec 을 동시에 수정한다. 단독으로는 WARNING 수준이나 spec 누락 사항이다.

---

### 4. [WARNING] [SPEC-DRIFT] `spec/5-system/9-rag-search.md §4.2` `ragDiagnostics.rerank` 가 "Planned" 마커로 남아있으나 이번 PR 구현 범위임
- **위치**: `spec/5-system/9-rag-search.md:242` — `rerank?` 필드 설명에 "(Planned)" 주석
- **상세**: spec `9-rag-search.md §4.2` 의 `rerank?` 필드 및 `§4.1` 의 `origin?: 'reranked'` 에 "(Planned)" 마커가 붙어 있다. 그러나 `rag-rerank-impl.md` plan 은 `ragDiagnostics.rerank 출력` 을 이번 PR 체크항목으로 포함하며 RerankService 가 `RerankDiagnostics` 를 실제로 반환한다. 구현이 Planned 단계를 넘어 진행 중임에도 spec 의 "(Planned)" 마커가 갱신되지 않은 것은 spec-drift 다.
  - 단, 위 발견사항 1 (kb-tool-provider 가 rerank 진단을 전달 미완) 에 따라 end-to-end 구현이 아직 완전하지 않으므로, spec 마커 제거는 end-to-end 완성 후가 더 적절할 수 있다.
- **제안**: 코드 유지 + `9-rag-search.md §4.1` 의 `origin?: 'reranked'` 와 `§4.2` 의 `rerank?` 필드에서 "(Planned)" 를 "(v1 cross_encoder 구현됨; cross_encoder_llm 은 후속)" 으로 갱신. 해당 spec 파일이 갱신 대상.

---

### 5. [WARNING] `RerankService.fallback()` 에서 `candidateCount` 가 원본 `candidates.length` 를 반영하지 않는 경우
- **위치**: `/codebase/backend/src/modules/knowledge-base/search/rerank.service.ts:147` — `candidateCount: params.candidates.length`
- **상세**: `fallback()` 의 diagnostics 반환에서 `candidateCount: params.candidates.length` 로 정확히 설정하고 있으며, 이는 사실 올바르다. 다만 `rerankCandidates()` 내 정상 경로의 `scores.filter(...)` (line 93–99) 에서 `s.index < 0` 또는 `s.index >= candidates.length` 인 항목을 필터링하는데, 이 경우 `reranked` 배열 길이가 `topK` 보다 적어도 slice 로 잘려 `returnedCount` 가 실제 반환 수를 정확히 반영한다. 문제는 scores 에 유효하지 않은 index 가 다수 포함되면 유효한 결과가 없어도 `candidateCount > 0` 이면서 `returnedCount = 0` 이 되어 호출자 입장에서 혼동될 수 있다. 이 경우 fallback 이 발동되지 않고 빈 배열이 반환된다. spec §6 에러 처리 표에 이 케이스(유효 index 없음)가 정의되지 않았다.
- **제안**: 정상 경로에서 `reranked.length === 0` 이고 `candidates.length > 0` 이면 fallback 으로 전환하거나 `diagnostics.error = 'RERANK_ENDPOINT_FAILED'` 설정을 고려한다. 현재는 빈 결과가 조용히 반환된다.

---

### 6. [INFO] `RerankConfigService.resolveConfig()` 에서 `rerankConfigId` 가 null 인 경우 워크스페이스 default 를 사용하나, KB 에 `rerankConfigId = null` 인 경우 명시적 선택인지 default 위임인지 spec 에 기술 없음
- **위치**: `/codebase/backend/src/modules/knowledge-base/search/rerank.service.ts:63-71`
- **상세**: spec `1-data-model.md §2.11` 은 `rerank_config_id UUID? FK` 로 nullable 정의하고 있으나, null 시 워크스페이스 default 로 fallback 한다는 동작을 명시하지 않는다. 현재 구현은 null 이면 default 탐색 → 없으면 `RERANK_CONFIG_NOT_FOUND` BadRequest. 이 동작은 합리적이나 spec 에 기술되지 않았다.
- **제안**: spec `9-rag-search.md §3.3.2` 흐름 2단계 또는 `1-data-model.md §2.16.1` 에 "rerank_config_id 가 null 이면 워크스페이스 default RerankConfig 를 사용; 없으면 graceful degradation" 을 명시한다.

---

### 7. [INFO] `RerankConfigService.update()` 에서 `dto.isDefault === false` 설정 후 default 청구 트랜잭션 없음 — 의도적 설계
- **위치**: `/codebase/backend/src/modules/rerank-config/rerank-config.service.ts:162-165`
- **상세**: `dto.isDefault === false` 일 때 단순히 `config.isDefault = false` 로 설정해 저장한다. 이는 LLMConfig 미러 패턴을 따른 것으로 의도적이다. 단, 이 시점에 워크스페이스에 다른 default 가 없어도 보완적으로 다른 설정을 default 로 승격하는 로직이 없다. spec 에 "default 해제 시 다른 설정 자동 승격" 요건이 없으므로 INFO 수준.
- **제안**: spec `1-data-model.md §2.16.1` 에 "is_default 해제 시 다른 설정이 자동 승격되지 않음" 주석을 추가해 명시적 설계 결정으로 문서화.

---

### 8. [INFO] `TeiRerankClient.rerank()` 에서 `_model` 파라미터 무시 — spec 인터페이스 시그니처와 일치하나 TEI 특성 주석 부족
- **위치**: `/codebase/backend/src/modules/llm/rerank/clients/tei-rerank.client.ts:25-26` — `_model?: string` 무시
- **상세**: spec `7-llm-client.md §3.6` 의 `RerankClient.rerank()` 시그니처는 `model?: string` 를 선택적으로 정의한다. TEI 는 서버에 모델이 고정 로드돼 body 에 model 을 보내지 않으므로 무시하는 것이 올바르다. 주석으로 이 이유가 설명되어 있어 충분하다.
- **제안**: 해당 없음.

---

### 9. [INFO] `spec/5-system/9-rag-search.md §4.1` `ragSources[].origin` 필드가 구현의 `SearchResult` 에 실제로 있는지 확인 필요
- **위치**: `rerank.service.ts:96-99` — `origin: 'reranked' as const` 설정
- **상세**: `SearchResult` 인터페이스에 `origin?: string` 이 정의되어 있고 (`search-result.interface`), `RerankResult` 에도 `origin: 'reranked'` 가 설정된다. spec §4.1 의 `origin` 허용값 정의(`cosine`/`reranked`/`seed`/`expanded`)와 실제 코드의 `'reranked'` 값이 일치한다. 단 `cosine` 는 코드에서 명시적으로 설정되지 않고 생략 시 기본값으로 처리되는 패턴인데, spec 에 "생략 시 cosine" 이라 기술되어 있어 일치한다.
- **제안**: 해당 없음.

---

### 10. [INFO] consistency review 산출물 파일들 — 내용은 올바르나 일부 `_retry_state.json` 의 `agents_pending` 이 완료됐음에도 배열 유지
- **위치**: `review/consistency/2026/06/04/09_05_06/_retry_state.json`, `review/consistency/2026/06/04/09_30_18/_retry_state.json`, `review/consistency/2026/06/04/09_48_46/_retry_state.json`
- **상세**: 세 `_retry_state.json` 파일 모두 `agents_pending` 에 모든 checker 가 있고 `agents_success` 는 비어 있다. 이는 상태 파일이 초기 상태 그대로 저장된 것으로, 실제 sub-agent 완료 후 갱신되지 않았음을 의미한다. orchestrator 내부 상태 파일이므로 기능에는 영향이 없으나, 재시도 추적 목적의 파일이 완료 상태를 반영하지 않는다.
- **제안**: orchestrator 가 sub-agent 완료 시 `agents_success` 를 업데이트하도록 개선 (현재 툴 동작 방식 상 초기 상태 저장 후 갱신이 없는 구조적 특성일 수 있음 — INFO 수준).

---

## 요약

RAG 리랭킹 P1 구현(cross_encoder + 동적 컷)은 spec `9-rag-search.md §3.3` 의 핵심 흐름(wide 회수 → cross-encoder 재점수화 → 동적 컷 → top-k)을 `RerankService`·`RagSearchService.searchWithRerank()` 를 통해 올바르게 구현했다. `RerankClientFactory`(tei/cohere 2종), `RerankConfig` 엔티티·CRUD·마이그레이션(V073/V074), graceful degradation 등 spec 이 규정한 구성 요소가 구현되어 있다. 주요 미충족은 두 가지다: (1) `kb-tool-provider` 가 `search()` 만 호출하여 `ragDiagnostics.rerank` 진단 데이터가 노드 메타에 전달되지 않는다 — plan 이 이번 PR 범위로 명시했으나 미구현이다. (2) `rerank.service.ts` 의 `fallback()` 이 강등 결과물에도 `origin: 'reranked'` 를 붙여 spec 의 "cosine 순 안전 강등" 동작과 의미적으로 불일치한다. 추가로 `rerank_candidate_k` 상한 200 의 spec 미기술, null `rerankConfigId` 시 default fallback 동작의 spec 미기술이 INFO 수준 gap 으로 존재한다.

## 위험도

MEDIUM
