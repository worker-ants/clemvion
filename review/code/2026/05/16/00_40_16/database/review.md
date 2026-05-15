### 발견사항

- **[INFO]** `RETURNING` 결과를 버리는 것은 의도적이나, 향후 호출자가 카운트를 필요로 할 경우 재쿼리 비용이 발생할 수 있음
  - 위치: `kb-stats.helper.ts` L240-251 (`refresh` 메서드 전체)
  - 상세: 변경 전 코드는 `rows[0]?.entity_count` 와 `rows[0]?.relation_count` 를 WebSocket emit 에 사용했으나, broadcast dead path 제거 후 `RETURNING` 절의 결괏값이 완전히 폐기된다. 현재는 호출자가 갱신된 카운트를 필요로 하지 않으므로 문제가 없지만, `RETURNING` 절 자체는 PostgreSQL 이 추가 I/O 없이 반환하는 값이라 성능 패널티는 없다. 다만 반환 타입이 `Promise<void>` 로 고정되어 있어, 미래에 카운트를 활용하려면 시그니처 변경이 필요하다.
  - 제안: 현재 범위에서는 수정 불필요. 향후 카운트 활용 시나리오가 생기면 `Promise<{ entityCount: number; relationCount: number } | null>` 반환으로 확장을 고려한다.

- **[INFO]** 단일 `UPDATE ... SET ... = (SELECT COUNT(*) ...)` 쿼리는 atomic 하고 인덱스 의존성이 높음 — `entity.knowledge_base_id` 와 `relation.knowledge_base_id` 인덱스 존재 여부를 확인할 것
  - 위치: `kb-stats.helper.ts` L242-249 (서브쿼리 두 개)
  - 상세: `SELECT COUNT(*) FROM entity WHERE knowledge_base_id = $1` 와 `SELECT COUNT(*) FROM relation WHERE knowledge_base_id = $1` 는 각각 `entity` 와 `relation` 테이블 전체를 스캔할 수 있다. 해당 컬럼에 인덱스가 없으면 KB 당 entity/relation 수가 많아질수록 갱신 비용이 선형 증가한다. 이 헬퍼는 "graph 데이터 변경 직후 한 번씩 호출"되므로 빈번한 경로다.
  - 제안: 마이그레이션에 `CREATE INDEX IF NOT EXISTS idx_entity_knowledge_base_id ON entity(knowledge_base_id)` 와 `CREATE INDEX IF NOT EXISTS idx_relation_knowledge_base_id ON relation(knowledge_base_id)` 가 이미 존재하는지 확인한다. 없다면 추가를 권고한다.

- **[INFO]** SQL 인젝션 관점에서 `$1` 파라미터화 쿼리가 정상 적용됨 — 이슈 없음
  - 위치: `kb-stats.helper.ts` L240-251
  - 상세: `knowledgeBaseId` 는 `$1` 바인딩 파라미터로 전달되며 문자열 보간이 없다. 테스트에서도 `expect(params).toEqual(['kb-1'])` 로 파라미터 분리 여부를 명시적으로 검증한다.
  - 제안: 현재 방식 유지.

### 요약

이번 변경의 핵심은 dead path 인 WebSocket broadcast 블록 제거로, 데이터베이스 조작 로직 자체(`UPDATE ... SET entity_count = (SELECT COUNT(*) ...) RETURNING ...`)는 변경되지 않았다. atomic 단일 쿼리 구조는 SELECT-then-UPDATE 의 비원자 패턴 대비 정합성 측면에서 올바르다. 파라미터화 쿼리 사용으로 SQL 인젝션 위험도 없다. 주요 잠재 위험은 `entity.knowledge_base_id` 와 `relation.knowledge_base_id` 컬럼의 인덱스 누락 여부인데, 이는 본 PR 변경 범위 밖에 있는 스키마 수준 사항이다. `RETURNING` 결과를 void 로 버리는 설계는 현재 요구사항에 적합하며, 마이그레이션 안전성·커넥션 관리·N+1 문제는 해당 없음이다.

### 위험도

LOW
