# 보안(Security) Review

## 발견사항

### [INFO] `SET LOCAL hnsw.ef_search = ${efSearch}` — 직접 보간이지만 정수·범위 보장으로 인젝션 안전
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (diff 라인 +258)
- 상세: `SET LOCAL hnsw.ef_search = ${efSearch}` 는 SQL 에 값을 직접 보간한다. pgvector GUC(`SET LOCAL`) 는 파라미터 바인딩(`$n`)을 지원하지 않으므로 이 패턴이 불가피하다. `efSearch` 는 `hnswEfSearchFor(topK)` 의 반환값으로, `hnswEfSearchFor` 는 비유한 입력(NaN/Infinity) 을 `HNSW_EF_SEARCH_DEFAULT(40)` 로 치환하고 `Math.ceil(limit) * 2` 에 `[40, 1000]` 범위 clamp 를 적용한 뒤 반환한다. TypeScript 의 `number` 타입과 이 함수 로직이 결합해 반환값은 항상 안전한 정수다. 인젝션 공격 벡터가 없음을 `dynamic-cut.util.spec.ts` 의 방어 케이스(`NaN`, `Infinity`, `5.5`, `25.1`)가 검증한다.
- 제안: 현재 구현은 안전하다. 코드 주석(diff +254~+256)에 "파라미터 바인딩 불가 → 정수·범위 보장이 안전성의 근거"가 명시돼 있어 향후 유지보수 시에도 의도가 명확하다. 추가 조치 불필요.

### [INFO] `hnswEfSearchFor` 의 입력 — 호출 지점 타입 계약 확인
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (diff 라인 +256), `dynamic-cut.util.ts` (diff 라인 +92~+98)
- 상세: `hnswEfSearchFor(topK)` 의 `topK` 는 서비스 내부에서 결정되는 값이므로 외부 사용자 입력이 직접 전달되지 않는다. `searchVectorGroup` 의 `topK` 는 `RAG_RECALL_K`(50) 또는 `rerankCandidateK`(최대 200) 계산값이며, 모두 서버 내 상수·KB 메타 필드에서 유래한다. 사용자 제공 값이 신뢰 경계 없이 `hnswEfSearchFor` 로 전달되는 경로는 존재하지 않는다. 함수 자체의 비유한 가드가 있어 내부 버그로 비정상 값이 전달되더라도 안전하게 기본값으로 수렴한다.
- 제안: 없음.

### [INFO] 트랜잭션 스코프(`SET LOCAL`) — 커넥션 풀 오염 없음
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (diff 라인 +257~+272)
- 상세: `SET LOCAL` 은 현재 트랜잭션 안에서만 유효하며, 트랜잭션 종료(커밋 또는 롤백) 시 자동 해제된다. 커넥션 풀 재사용 커넥션에 `ef_search` 설정값이 잔류하는 커넥션 오염이 발생하지 않는다. 에러 발생 시 TypeORM 트랜잭션이 롤백되므로 GUC 도 함께 해제된다. 잘못된 `ef_search` 값이 다른 쿼리에 영향을 주는 시나리오가 없다.
- 제안: 없음.

### [INFO] 테스트 파일 내 `SET LOCAL` regex 검증
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` (diff 라인 +135~+138, +164~+167)
- 상세: mock `em.query` 가 `/^\s*SET LOCAL/i` regex 로 `SET LOCAL` SQL 을 구분해 흡수한다. 이 regex 는 케이스 인센시티브이고 선두 공백을 허용하는 안전한 패턴이다. SQL 보간 값 검증(`'SET LOCAL hnsw.ef_search = 100'`, `'hnsw.ef_search = 400'`)이 테스트에서 직접 단언되어 부적절한 값이 SET LOCAL 에 전달되는 회귀를 감지할 수 있다.
- 제안: 없음.

### [INFO] `docker-compose.e2e.yml` ENCRYPTION_KEY — e2e 전용 저엔트로피 패턴 유지
- 위치: `docker-compose.e2e.yml` (diff 라인 +368)
- 상세: 이전 리뷰(`review/code/2026/06/06/17_27_54/security.md`)에서 이미 분석된 항목이다. 이번 diff 는 해당 파일을 수정하지 않으며, `ENCRYPTION_KEY` 는 그 리뷰에서 교정된 64-hex 값이 그대로 유지된다. 본 PR(ef_search 기능 추가) 범위에서는 신규 보안 변경이 없다.
- 제안: 없음 (이전 리뷰 W2 수용 결정 유지).

---

## 요약

이번 변경은 pgvector HNSW `ef_search` recall 보전을 위한 `hnswEfSearchFor` 유틸 추가 및 `SET LOCAL` 트랜잭션 래핑이 핵심이다. 보안 관점에서 가장 주목할 부분은 `SET LOCAL hnsw.ef_search = ${efSearch}` 의 직접 보간이나, `hnswEfSearchFor` 의 비유한(NaN/Infinity) 방어 가드와 `[40, 1000]` 정수 clamp 보장으로 인젝션 벡터가 원천적으로 차단된다. 입력 `topK` 는 외부 사용자 입력이 아닌 서버 내부 상수에서 유래하므로 추가 위협 표면이 없다. `SET LOCAL` 트랜잭션 스코프 설계로 커넥션 풀 오염도 발생하지 않는다. 하드코딩된 시크릿, 인증/인가 우회, 인젝션 취약점, 에러 정보 노출, 취약 의존성 등 OWASP Top 10 해당 항목은 발견되지 않았다.

## 위험도

NONE
