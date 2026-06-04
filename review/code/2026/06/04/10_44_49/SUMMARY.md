# Code Review 통합 보고서

**대상**: RAG 리랭킹 P1 구현 (rag-rerank-impl)
**리뷰 일시**: 2026-06-04
**실행 reviewer**: requirement, documentation (router_safety 강제 포함)
**RISK**: MEDIUM · Critical 0 · Warning 7

> ⚠️ **router 오판 주의**: router 가 diff 를 "코드 변경 없음 — 리뷰 문서·플랜 메모만" 으로 잘못 판단해 code reviewer 12명(security/performance/architecture/database/testing/scope/side_effect/maintainability/dependency/concurrency/api_contract/user_guide_sync) 을 skip. 실제로는 backend 코드 대량 변경 존재(forced requirement 가 코드 결함을 실제로 발견). → fix 적용 후 `--route=all` 재리뷰로 보정 권장.

## Critical
_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견 | 위치 | 조치 |
|---|----------|------|------|------|
| 1 | 요구사항 | `ragDiagnostics.rerank` 가 kb-tool-provider 경로에서 미전달 (`search()` 만 호출, `searchWithMeta()` rerank 진단 누락) | `kb-tool-provider.ts:237` | searchWithMeta 교체 + ragDiagnosticsDelta 에 rerank 포함 |
| 2 | 요구사항 | `fallback()` 강등 결과에 `origin:'reranked'` 오표시 (cosine 강등인데 reranked 라벨) | `rerank.service.ts:141` | fallback 의 origin 제거 |
| 3 | 요구사항 | `rerank_candidate_k` CHECK 상한 200 근거 spec 미기술 | `V074:17` | `1-data-model §2.11` 에 범위 1~200 명시 |
| 4 | SPEC-DRIFT | `9-rag-search §4.1/§4.2` "(Planned)" 마커가 실제 구현 상태 미반영 | `9-rag-search.md` | "(v1 cross_encoder 구현됨; cross_encoder_llm 후속)" 갱신 |
| 5 | 문서화 | `9-rag-search.md` Rationale 가 plan draft 외부 링크만 — plan 이동 시 추적 불가 | `9-rag-search.md` | `## Rationale` 섹션 신설 |
| 6 | 문서화 | `7-llm-client.md` Rationale 부재 (RerankClient 분리 근거) | `7-llm-client.md` | `## Rationale` 신설 |
| 7 | 문서화 | `pending_plans` 의 `rag-rerank-followup.md` 미생성 | frontmatter | **이미 해소** — 파일 생성됨 |

## 참고 (INFO 발췌)
- I1: 정상 경로에서 유효 index 0건이면 빈 배열 조용히 반환 — `reranked.length===0 && candidates.length>0` 시 fallback/error 고려.
- I2/I3: rerankConfigId null→default 동작, is_default 해제 시 자동승격 없음 — spec 주석 권고.
- I7: 에러코드 EXECUTION_TIME_LIMIT 전체문서 정합(리랭킹 무관·기존).

## 별도 (e2e 가 발견, ai-review 외)
- `RerankConfig.apiKey: string|null` 명시 type 누락 → `DataTypeNotSupportedError` 부팅실패 → `type:'varchar'` fix 적용(uncommitted).

## 라우터 결정
routing=done. 실행 requirement·documentation(2). skip 12 (router "코드 변경 없음" 오판). → 재리뷰 권장.
