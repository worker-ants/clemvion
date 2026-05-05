### 발견사항

- **[WARNING]** `main()` 함수에서 `ds.destroy()` 호출이 try/finally로 보호되지 않음
  - 위치: `migrate-button-ids.ts`, `main()` 함수 전체 구조
  - 상세: `ds.initialize()` 이후 에러가 발생하면 `ds.destroy()`가 호출되지 않아 커넥션이 누수됨. `process.exit(1)`이 CLI 실행 시 OS 레벨에서 정리하지만, 스크립트가 모듈로 import되어 테스트/재사용되는 경우(실제로 `export`된 함수들이 존재) 문제가 될 수 있음
  - 제안:
    ```typescript
    await ds.initialize();
    try {
      // ... query, backfill, transaction ...
    } finally {
      await ds.destroy();
    }
    ```

- **[WARNING]** 트랜잭션 내 N+1 UPDATE 패턴
  - 위치: `migrate-button-ids.ts` L245~250
  - 상세: `for (const update of pendingUpdates)` 루프에서 노드 수(N)만큼 개별 UPDATE를 실행함. 대상 노드가 수천 개라면 트랜잭션이 길어져 행 잠금 경합 및 성능 저하 발생. 또한 단일 트랜잭션 내 대량 UPDATE는 WAL 비용 증가 및 vacuum 부하로 이어짐
  - 제안: `UNNEST`를 이용한 배치 UPDATE로 개선
    ```sql
    UPDATE node n
    SET config = v.config::jsonb
    FROM UNNEST($1::uuid[], $2::text[]) AS v(id, config)
    WHERE n.id = v.id
    ```

- **[WARNING]** 전체 데이터를 메모리에 한 번에 로드 (페이지네이션 없음)
  - 위치: `migrate-button-ids.ts` L197~216, SELECT 쿼리
  - 상세: `carousel/chart/table/template` 타입 노드 전체를 단일 쿼리로 메모리에 올림. `config` 컬럼이 JSONB라면 노드 수에 따라 수백 MB~수 GB RAM 점유 가능. 운영 서버에서 실행 시 OOM 위험
  - 제안: `LIMIT / OFFSET` 또는 keyset pagination (`WHERE n.id > $cursor ORDER BY n.id LIMIT 500`)으로 청크 단위 처리. 청크별로 별도 트랜잭션을 커밋하면 잠금 보유 시간도 단축됨

- **[INFO]** `node.type` 컬럼 인덱스 의존성
  - 위치: `migrate-button-ids.ts` L203, `WHERE n.type = ANY($1)`
  - 상세: `node.type` 에 인덱스가 없으면 노드 테이블 전체 seq scan이 발생함. 대상 타입이 4개 (`carousel/chart/table/template`)이고 전체 노드 중 비율이 높다면 인덱스가 있어도 쿼리 플래너가 seq scan을 선택할 수 있음. 실행 전 `EXPLAIN ANALYZE`로 플랜 확인 권장
  - 제안: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_type ON node(type);` 사전 확인

- **[INFO]** audit_log `resource_id` NULL 삽입
  - 위치: `migrate-button-ids.ts` L257, `INSERT INTO audit_log ... NULL ...`
  - 상세: 배치 마이그레이션이라 단일 `resource_id`가 없는 상황은 맞지만, audit_log 스키마에 `resource_id NOT NULL` 제약이 있다면 실행 시 오류 발생. 스키마 확인 필요
  - 제안: audit_log DDL에서 해당 컬럼의 nullable 여부를 사전에 확인

---

### 요약

마이그레이션 스크립트의 핵심 로직(backfill + 幂等性)은 올바르게 설계되어 있고, 파라미터화 쿼리를 사용하여 SQL 인젝션 위험도 없으며 트랜잭션으로 원자성도 보장된다. 다만 운영 규모를 고려하지 않은 설계 문제가 있다: 전체 대상 행을 메모리에 한 번에 적재하는 구조와 트랜잭션 내 N개 개별 UPDATE는 테이블이 클수록 OOM·잠금 경합·장시간 트랜잭션 위험을 높인다. 청크 단위 페이지네이션 + 배치 UPDATE로 개선하면 대용량 운영 환경에서 안전하게 실행할 수 있다. 나머지 파일들(shadow-workflow, button-slug.util)은 순수 인메모리 로직으로 DB와 직접 무관하다.

### 위험도

**MEDIUM**