# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)
검토 대상 spec 영역: `spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md) + 관련 변경 문서 (9-rag-search.md, 8-embedding-pipeline.md, 2-navigation/5-knowledge-base.md)

---

## 발견사항

### INFO — `embedding_dimension` NULL KB 의 silent 제외에서 명시 신호 전환: 기존 Rationale 과 정합하며 갱신 선언도 명시됨
- target 위치: `spec/5-system/9-rag-search.md §Rationale` 마지막 항목 ("왜 검색 불가(`embedding_dimension` NULL)를 silent 제외에서 명시 신호로 바꿨나")
- 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md §Rationale "결정: 다중 차원 임베딩 + KB 단위 모델 선택"` — RagSearchService 가 "NULL/unsupported 차원 KB 는 검색 제외" 한다는 기존 정책
- 상세: 기존 Rationale 은 NULL 차원 KB 를 "검색 제외"로만 기술하고, 그 사실을 호출부에 어떻게 신호할지는 명시하지 않았다(silent 였음). 9-rag-search §Rationale 은 이를 "silent 가 아니라 명시 신호" 로 바꾸었음을 선언하고 이유도 기술했다. 동시에 8-embedding-pipeline §7.3 본문도 "silent 가 아니라 명시 신호로 전달된다"로 갱신되어 cross-ref 가 일치한다. 번복이 아니라 정책 확장이며 새 Rationale 이 함께 작성됐으므로 Rationale 연속성에 문제없음.
- 제안: 현 상태 유지. 8-embedding-pipeline §Rationale 에도 이 신호화 결정을 한 줄 미러링하면 두 문서 독자 모두에게 완전한 이유가 노출된다 (선택).

### INFO — `byte-identical 하위호환` 조항 폐기 선언: Rationale 갱신 동반 확인됨
- target 위치: `spec/5-system/9-rag-search.md §Rationale` "byte-identical 조항 폐기 (D1, 2026-06-06)"
- 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md §1` 및 9-rag-search §3.3.1 구판 — "off = 현행과 byte-identical 하위호환"
- 상세: 과거 리랭킹 spec 이 확립한 "`off` 경로는 byte-identical" 조항을 D1 동적 컷 도입으로 폐기한다는 결정이 명시적으로 선언되어 있고, 폐기 이유("off 경로도 wide 회수 + app-layer 동적 컷을 거치므로 byte-identical 이 아님")와 새 하위호환 정의("리랭커 인프라 없이 동작·점진 도입 가능")가 함께 기술되어 있다. 기각 대안 기록 방식도 `plan/complete/spec-draft-rag-reranking.md §Rationale` 를 명시 cross-ref 하여 이력이 보존된다. 정책 번복이 Rationale 갱신 없이 이루어진 것이 아님.
- 제안: 현 상태 유지. 이미 충분한 Rationale 갱신이 이루어짐.

### INFO — `cross_encoder_llm` "항상 grading" → "conditional escalate" 번복: Rationale 갱신과 출처 cross-ref 명시됨
- target 위치: `spec/5-system/9-rag-search.md §Rationale` "왜 D2 conditional escalate 를 지금 도입하나"
- 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md §Rationale` · `rag-quality-improvement.md §6` 2026-06-04 확정 — "`cross_encoder_llm` 은 항상 grading"
- 상세: 과거 확정("LLM 콜 비용 보호용 단순화 — 항상 grading") 을 이번 개정에서 conditional escalate 로 번복하는데, 새 Rationale 에 번복 이유("escalate 미발생 시 cross-encoder 결과를 그대로 쓰므로 v1 동작의 부분집합, 회귀 위험 낮음"), 과거 결정의 출처 명시("spec-draft-rag-reranking.md §Rationale · rag-quality-improvement.md §6 2026-06-04 확정"), 그리고 정량 임계 확정은 후속으로 분리한다는 사실이 모두 기록되어 있다. 무근거 번복이 아님.
- 제안: 현 상태 유지.

### INFO — Graph RAG 모드 선택 "불변" 원칙: 기존 Rationale 과 target 사이에 상충 없음
- target 위치: `spec/5-system/10-graph-rag.md §Rationale "사용자 결정 #6: KB 모드 사후 변경"`, `§Rationale "비-목표: Microsoft GraphRAG community detection / Apache AGE / Neo4j"` 등
- 과거 결정 출처: `spec/5-system/10-graph-rag.md §Rationale` — graph 모드 선택 불변, LLM 추출 단일 경로 채택, PostgreSQL 관계형 + recursive CTE 로 충분 등 여러 결정
- 상세: 이번 검토 범위에 포함된 10-graph-rag.md 의 본문·Rationale 모두 확인했으나, 기존 Rationale 이 기각한 대안(Neo4j 도입, 모드 사후 변경, 룰 기반 추출 등)이 target 에 재도입된 흔적은 없다. §8 "비-목표" 및 §2.2 "본 문서 범위 밖" 이 기각 대안 목록을 일관되게 유지한다.
- 제안: 이상 없음.

### INFO — MCP client: Internal Bridge stdio 미지원 결정 및 세션 풀링 미채택: target 에서 기각 대안 재도입 없음
- target 위치: `spec/5-system/11-mcp-client.md §2.2 stdio 미지원 사유`, `§4.3 동시성/풀링`
- 과거 결정 출처: `spec/5-system/11-mcp-client.md §2.2` — stdio 미지원, `§4.3` — 세션 간 공유 없음(의도적 미풀링)
- 상세: target 이 §2.2 에서 stdio 미지원 이유("멀티테넌트 백엔드 보안·비용 부담")를 명시하고, §4.3 에서 노드 간·실행 간 세션 공유를 의도적으로 하지 않는다고 명시함. 기각 대안 재도입 없음.
- 제안: 이상 없음.

### INFO — Auth spec: 복구 코드 풀 분리(TOTP/WebAuthn 별도), WebAuthn credential 삭제 시 복구 코드 NULL화 주체 (DB 트리거 아닌 서비스): Rationale 정합
- target 위치: `spec/5-system/1-auth.md §1.4.1`, `§5 API 엔드포인트 DELETE /api/auth/2fa/webauthn/credentials/:id`
- 과거 결정 출처: `spec/5-system/1-auth.md §Rationale 1.4.B` — TOTP/WebAuthn 복구 코드 풀 분리, `§Rationale 1.4.E` — counter 역행 시 credential 강제 삭제(suspend 아님)
- 상세: DELETE /credentials/:id 엔드포인트 설명에 "마지막 credential 삭제 시 `user.webauthn_recovery_codes` 를 `WebAuthnService.deleteCredential` 가 NULL화 (DB 트리거 아님)" 가 명시됨. 1.4.E 의 suspend 기각 결정도 target 에서 유지됨(suspend 컬럼 없음 언급). 기각 대안 재도입 없음.
- 제안: 이상 없음.

---

## 요약

검토 범위(`spec/5-system` 전체: 1-auth.md, 10-graph-rag.md, 11-mcp-client.md 및 관련 변경된 9-rag-search.md, 8-embedding-pipeline.md, 2-navigation/5-knowledge-base.md)에 걸쳐 Rationale 연속성 관점의 중대한 위반은 발견되지 않았다. 주요 설계 변경 사항(embedding_dimension NULL KB 의 silent 제외→명시 신호 전환, `off` 경로의 byte-identical 조항 폐기, `cross_encoder_llm` "항상 grading"→conditional escalate 번복) 모두 새 Rationale 과 과거 결정 출처 cross-ref 를 동반하고 있어 "결정의 무근거 번복" 요건에 해당하지 않는다. 기각된 대안(stdio MCP, Neo4j, 모드 사후 변경, 세션 풀링, suspend credential 등)의 재도입도 확인되지 않는다. 선택적 보완 제안(8-embedding-pipeline Rationale 미러링)은 문서 완성도 향상을 위한 INFO 수준이다.

---

## 위험도

NONE
