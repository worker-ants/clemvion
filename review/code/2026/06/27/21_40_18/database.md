# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `buildCosineMatch` 내 `dim` 문자열 보간 — SQL 인젝션 위험 낮음
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` 메서드, `castExpr`/`whereClause` 구성부
  - 상세: `dim`(TypeScript `number`)과 `getEmbeddingCastType(dim)` 반환값을 SQL 문자열에 직접 보간한다. TypeScript 컴파일러가 `number` 타입을 보장하므로 SQL 인젝션 문자를 포함할 수 없다. `findSimilarFact` 호출 경로에는 `SUPPORTED_EMBEDDING_DIMS.has(dim)` 화이트리스트 가드가 존재하나, `recall` 호출 경로에는 동등한 가드가 없다 — 기존 코드에서도 동일 패턴이므로 이번 리팩터링으로 인한 회귀는 없다. 지원되지 않는 dim이 유입되면 `getEmbeddingCastType`이 예상치 못한 cast 문자열을 반환해 쿼리 오류가 날 수 있으나, 보안 위협은 아니다.
  - 제안: 중장기적으로 `recall`에도 `SUPPORTED_EMBEDDING_DIMS.has(dim)` 조기 반환 가드를 추가하면 방어 일관성이 높아진다.

- **[INFO]** `scoreExpr` 이중 평가 — SELECT·WHERE 양쪽 계산 중복
  - 위치: `agent-memory.service.ts` — `recall` 쿼리 `SELECT ${scoreExpr} AS score … AND ${scoreExpr} >= $4`
  - 상세: PostgreSQL은 WHERE 절에서 SELECT alias를 참조할 수 없으므로 cosine distance 표현식(`1 - (am.embedding::${castExpr} <=> $1::${castExpr})`)이 SELECT와 WHERE에서 각각 평가된다. 이는 기존 코드에서도 동일하게 존재하던 패턴이며, `buildCosineMatch` 빌더로 통일한 후에도 동일하게 유지된다. pgvector HNSW 인덱스 환경에서는 통상 허용되는 패턴이나, 향후 성능 최적화가 필요할 경우 서브쿼리 + alias 방식으로 개선 가능하다.
  - 제안: 현재 데이터 규모에서는 무해하다. 대용량 테이블 대상 성능 이슈 발생 시 `SELECT * FROM (SELECT …, score FROM …) sub WHERE score >= $4` 형태의 서브쿼리 래핑을 검토한다.

## 요약

이번 변경은 `saveMemories` API 옵션 객체화(I3), `buildCosineMatch` SQL 빌더 추출(I5), `updateSummaryState` 단일 변이 경로 신설(I-7), `memoryState` sub-namespace 이전(I12)이 주축이다. 실질적인 SQL·스키마·트랜잭션 구조는 변경되지 않았으며, `buildCosineMatch`가 `recall`/`findSimilarFact` 양쪽의 cosine WHERE/score 식을 단일화해 유지보수성이 향상됐다. 파라미터화 쿼리(`$1`~`$5`) 사용이 올바르고, HNSW partial index 조건(`vector_dims(am.embedding) = ${dim}`)이 명시적으로 유지된다. 트랜잭션·커넥션·마이그레이션·스키마에 신규 위험 없음. `recall` 경로의 `SUPPORTED_EMBEDDING_DIMS` 가드 부재 및 `scoreExpr` 이중 평가는 기존 동작 유지로 회귀 없는 INFO 수준 사항이다.

## 위험도

LOW
