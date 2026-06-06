# Code Review 통합 보고서

**대상**: `spec/5-system/9-rag-search.md` + 구현 코드 (RAG 동적 점수 컷 D1 + conditional escalate D2)
**일시**: 2026-06-06

---

## 전체 위험도

**LOW** — Critical 이슈 없음. 구현 명세 대부분이 spec 과 정밀하게 일치하며, 주요 WARNING 은 런타임 결함이 아닌 진단 정확도 저하 1건과 타입 안전성·문서화 개선 포인트 다수이다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `rerank.service.ts` `fallback()` 에서 `applyDynamicCut` 의 `cutoffApplied` 반환값을 무시하고 `false` 로 하드코딩. 강등 경로(RERANK_ENDPOINT_FAILED 등)에서 inject-cap/token-budget 컷이 실제 발생해도 `cutoffApplied=false` 가 노출되어 spec §4.2 정의 위반 및 진단 정확도 저하 유발. | `rerank.service.ts` line 348 | `applyDynamicCut` 반환값 포착 후 `cutoffApplied` 에 반영: `const { kept, cutoffApplied } = applyDynamicCut(sorted, {...})` |
| 2 | Architecture | `searchWithMeta` / `searchWithRerank` 반환 타입 비대칭. `rerank?` 선택적 필드에 대해 discriminated union 또는 NonNullable 명시 타입이 없어 호출부가 실수로 undefined 를 non-null assert 할 위험. | `rag-search.service.ts` L97-106, `kb-tool-provider.ts` L241-251 | `searchWithRerank` 반환 타입에 `rerank: RerankDiagnostics`(NonNullable)를 명시하거나 판별 유니온으로 두 경로 분리. |
| 3 | Architecture | `RagSearchService` 가 vector·graph·rerank 세 경로를 단일 클래스(664라인)에서 처리. graph RAG 확장 시 크기 압박 예상. | `rag-search.service.ts` | graph traversal 관련 private 메서드가 200줄 이상 성장 시 `GraphSearchStrategy` 분리 검토. |
| 4 | Maintainability | `gradingNoGrounding = true` 시 tool_result 출력 포맷 명세 부재. "관련 근거 없음" 신호가 어느 출력 필드로 나타나는지 spec 미정의로 구현자 해석 오류 가능. | spec §4.2, §3.3 | spec §2.2 KB tool 결과 포맷 섹션에 `gradingNoGrounding=true` 시 tool_result 포맷 예시 추가. |
| 5 | Documentation | `DynamicCutOptions` / `DynamicCutResult<T>` 인터페이스에 JSDoc 블록 부재. 각 필드에 인라인 주석은 있으나 인터페이스 레벨 JSDoc 없어 IDE 호버 문서 빈 상태. | `dynamic-cut.util.ts` lines 18-29 | 각 인터페이스에 `/** RAG 동적 점수 컷 옵션 (spec §3.4). */` 형태 JSDoc 추가. |
| 6 | API Contract | `top_k` 파라미터 기본값(5) 폐기로 미지정 시 주입 청크 수가 최대 12 로 증가하는 관리된 breaking change. 기존 `ragTopK=5` 하드코딩 경로·테스트가 새 동작을 반영했는지 확인 필요. | spec §2.1, §3.1, `kb-tool-provider.ts` | 기존 소비자(테스트, 프론트엔드 진단 UI) 가 새 동작(최대 12)을 올바르게 반영하는지 검증. |
| 7 | API Contract | `rerank.cutoffApplied` 의미 확장("점수 임계 컷" → "θ/token-budget/inject-cap 중 어느 것이든"). 기존 소비자가 협의 해석 중이면 오탐 가능. | spec §4.2 | 릴리즈 노트·마이그레이션 가이드에 의미 변경 명시 권장. |
| 8 | Performance | wide 회수 도입(`LIMIT 5 → LIMIT 50`)으로 pgvector ANN 스캔 비용 증가. `hnsw.ef_search` / `ivfflat.probes` 인덱스 파라미터 조정 필요성이 spec·Rationale 어디에도 언급 없어 구현 시 지연 회귀 간과 위험. | spec §3.1, §3.4 | spec §3.1 또는 §7 에 "wide 회수 도입에 따른 pgvector 인덱스 파라미터 검토 필요" 를 Rationale 주석 또는 follow-up 항목으로 명시. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | token-budget 추정(char/3)이 한국어 BPE 환경에서 과소 추정 가능. 한국어 KB 에서 실제 토큰이 추정치의 3배 달할 수 있어 컨텍스트 창 압박 가능성. 단 spec 에서 "의도적 분리" 로 명시됨. | spec §3.4 상수 설명 | spec Rationale 에 한국어 over-inject 가능성 인지 및 `RAG_INJECT_TOKEN_BUDGET` 조정 흡수 방침 명시 또는 후속 follow-up 에 추가. |
| 2 | Performance | conditional escalate 임계 미정량으로 최악 케이스 시 구버전과 동일 LLM 호출 발생 가능. 단 성능 회귀 없음(구버전 동작과 동일이 상한). | spec §3.3.2 Rationale | Rationale 에 "escalate worst-case 는 구버전 '항상 grading' 과 동일, 성능 회귀 없음" 명시. |
| 3 | Performance | off 경로 동적 컷 app-layer 순회(O(50))는 negligible. 별도 우려 없음. | spec §3.4 | 없음. |
| 4 | Architecture | `applyDynamicCut` 순수 함수 분리, `AgentToolProvider` 인터페이스 추상화, 레이어 책임 분리(provider → service → util) 모두 우수. | `dynamic-cut.util.ts`, `agent-tool-provider.interface.ts` | 없음. |
| 5 | Architecture | `RAG_RECALL_K` / `RAG_INJECT_TOKEN_BUDGET` / `RAG_MAX_INJECT_COUNT` 상수 단일 파일 export, 단일 진실 준수. | `dynamic-cut.util.ts` L11-16 | 없음. |
| 6 | Architecture | off 경로 token-budget 컷 적용 여부가 v1 진단에 미노출(의도적 생략). 운영 환경 관찰 제한. | spec §4.2 | 필요 시 후속 `ragDiagnostics.dynamicCutApplied?` 추가 검토. |
| 7 | Requirement | `no_grounding` 경로에서 `cutoffApplied=false` 는 spec §4.2 정의("dropping 없음")를 정확히 표현. 기능상 문제 없음. | `rerank.service.ts` L161-165 | 없음. |
| 8 | Requirement | `shouldEscalateGrading` 평탄도 임계 상수는 spec 이 의도적으로 수치를 위임한 "provisional default". 불일치 아님. | `rerank.service.ts` L18-19 | 없음. |
| 9 | Requirement | multi-KB merge off 경로의 `cutoffApplied` 미노출은 spec §4.2 의도적 생략과 일치. | `rag-search.service.ts` L187-192 | 없음. |
| 10 | Scope | 변경 전체가 `spec/5-system/9-rag-search.md` 단일 파일에 집중. 불필요 리팩토링·무관 파일 수정 없음. | spec 파일 전체 | 없음. |
| 11 | Side Effect | `ragTopK` 기본값 제거로 미지정 노드 주입 청크 최대 12개 증가 — 의도된 변경, spec Rationale 에 근거 명시. | spec §2.1, Rationale | 구현 시 `ragTopK` null/undefined 일 때 `RAG_MAX_INJECT_COUNT`(12) ceiling 분기 확인 필요. |
| 12 | Side Effect | `gradingNoGrounding` 신규 필드는 순수 추가, 하위호환. | spec §4.2 | 없음. |
| 13 | Side Effect | `cross_encoder_llm` 항상 grading → conditional escalate 변경은 기존 구현 spec-impl 불일치 가능. | spec §3.3.1-3.3.2 | 기존 구현의 `cross_encoder_llm` 경로 conditional escalate 분기 추가 확인 필요. |
| 14 | Maintainability | §3.3.2 흐름과 §3.4 흐름 간 단계 번호(1)~5)) 중복으로 참조 명확성 저하. | spec §3.3.2, §3.4 | §3.4 흐름 블록을 §2 스타일(화살표 다이어그램)로 통일하거나 접두어(`R1/R2`, `C1a/C1b`) 구분. |
| 15 | Maintainability | `[^recall]` 각주와 `> 회수·컷 분기` blockquote 이중 서술. | spec §3.1 | 각주를 "§3.4 참조" 한 줄로 축약하고 상세를 blockquote 에 일원화. |
| 16 | Maintainability | `RAG_RECALL_K`(50)과 `rerank_candidate_k` 기본값(50) 동일 수치로 혼란 가능성. 두 곳(§3.1, §3.4) 분산 서술. | spec §3.1, §3.4 | §3.4 에 독립성 설명 일원화, §3.1 에서 `§3.4 참조` 단방향 링크. |
| 17 | Documentation | spec §2.1 `top_k` description 문구와 실코드 `kb-tool-provider.ts` 미세 표현 불일치 ("applies (internal ceiling)" vs "decides the count"). 의미 동일, 비차단. | spec §2.1, `kb-tool-provider.ts` L161 | spec 예시를 코드와 동일하게(`decides the count`) 맞추거나 방침 명확화. |
| 18 | Documentation | `cutoffApplied` off 경로 부재 설명이 함축적. `rerank` 서브객체 없는 off 경로에서 `cutoffApplied` 자체가 없음을 명시 미흡. | spec §4.2 | "off 경로 호출에는 `rerank` 서브객체 자체가 부재하므로 `cutoffApplied` 도 노출 안 됨" 한 줄 명시. |
| 19 | API Contract | `rerank.llmGradingApplied=false` 가 "escalate 미발생" + "grading 실패 강등" 두 케이스를 포함하도록 정밀화. `mode`·`error` 필드로 구분 가능. 타입 변경 없음. | spec §4.2 | 없음. |
| 20 | API Contract | `off` 경로 "byte-identical 하위호환" 조항 폐기, 새 하위호환 정의("리랭커 인프라 없이 동작")로 재정의. 의도적, spec 문서화 완료. | spec §3.3.1, Rationale | 없음. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| performance | LOW | wide 회수(LIMIT 50)로 pgvector 스캔 비용 증가, 인덱스 파라미터 조정 언급 부재 (WARNING) |
| architecture | LOW | `searchWithMeta`/`searchWithRerank` 반환 타입 비대칭 (WARNING), `RagSearchService` 메서드 집중 (WARNING) |
| requirement | LOW | `fallback()` 내 `cutoffApplied` 하드코딩 false — spec §4.2 정의 위반 (WARNING) |
| scope | NONE | 변경 범위 전체 적절, 의도 이상 변경 없음 |
| side_effect | LOW | `ragTopK` 기본값 제거·`cross_encoder_llm` 동작 변경의 구현 반영 확인 필요 (INFO) |
| maintainability | LOW | `gradingNoGrounding` tool_result 포맷 명세 빈칸 (WARNING), 내용 중복 서술 다수 (INFO) |
| documentation | LOW | 인터페이스 JSDoc 부재 (WARNING), `top_k` description 미세 불일치 (INFO) |
| api_contract | LOW | `top_k` 기본값 폐기·`cutoffApplied` 의미 확장 두 managed breaking change (WARNING) |

---

## 발견 없는 에이전트

- **scope**: 의도 이상 변경 없음, 위험도 NONE.

---

## 권장 조치사항

1. **[즉시 수정]** `rerank.service.ts` `fallback()` 에서 `applyDynamicCut` 반환값의 `cutoffApplied` 를 그대로 사용하도록 수정 (spec §4.2 위반 해소).
2. **[즉시 수정]** `searchWithMeta` / `searchWithRerank` 반환 타입 비대칭 해소 — `searchWithRerank` 반환에 `rerank: RerankDiagnostics` (NonNullable) 명시 또는 discriminated union 도입.
3. **[권장]** `spec §2.2` KB tool 결과 포맷 섹션에 `gradingNoGrounding=true` 시 tool_result 출력 포맷 예시 추가 (구현 해석 오류 방지).
4. **[권장]** `dynamic-cut.util.ts` `DynamicCutOptions` / `DynamicCutResult<T>` 인터페이스에 JSDoc 블록 추가.
5. **[권장]** spec §3.1 또는 §7 에 "wide 회수(LIMIT 50) 도입 시 pgvector `hnsw.ef_search`/`ivfflat.probes` 검토 필요" follow-up 항목 추가.
6. **[권장]** 기존 `ragTopK=5` 고정 경로 및 `cross_encoder_llm` "항상 grading" 구현이 새 동작(conditional escalate, 최대 12 청크)을 올바르게 반영했는지 테스트 커버리지 확인.
7. **[선택]** spec 내부 중복 서술(§3.3.2 흐름 ↔ §3.4 흐름, `[^recall]` 각주 ↔ blockquote) 단일 진실로 정리.
8. **[선택]** `rerank.cutoffApplied` 의미 확장을 릴리즈 노트·마이그레이션 가이드에 명시.

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행했습니다.

- **실행** (8명): `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `documentation`, `api_contract`
- **강제 포함(router_safety)**: `documentation`, `requirement`
- **제외** (6명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| security | 라우터 판단: 해당 변경에서 보안 리뷰 불필요 |
| testing | 라우터 판단: 해당 변경에서 테스트 리뷰 불필요 |
| dependency | 라우터 판단: 해당 변경에서 의존성 리뷰 불필요 |
| database | 라우터 판단: 해당 변경에서 데이터베이스 리뷰 불필요 |
| concurrency | 라우터 판단: 해당 변경에서 동시성 리뷰 불필요 |
| user_guide_sync | 라우터 판단: 해당 변경에서 사용자 가이드 동기화 불필요 |