## 리뷰 결과

### 발견사항

- **[INFO]** Self-referential foreign key 도입
  - 위치: `ADD COLUMN parent_node_execution_id UUID REFERENCES node_execution(id) ON DELETE SET NULL`
  - 상세: `node_execution` 테이블이 자기 자신을 참조하는 FK를 갖게 됩니다. `ON DELETE SET NULL` 덕분에 부모 레코드 삭제 시 자식의 컬럼이 NULL로 업데이트되므로 데이터 정합성은 유지됩니다. 단, 부모 행을 삭제할 때 연쇄적으로 많은 자식 행의 컬럼을 UPDATE하는 암묵적인 쓰기가 발생합니다.
  - 제안: 대량 삭제(예: 실행 로그 정리 배치)가 있다면 해당 시나리오에서 lock contention 가능성을 검토하세요.

- **[INFO]** `nullable` 컬럼 추가 — 기존 행에 대한 영향
  - 위치: `ADD COLUMN parent_node_execution_id UUID ... ON DELETE SET NULL`
  - 상세: nullable 컬럼 추가는 DDL 수준에서 기존 행을 재작성하지 않아 일반적으로 안전합니다. 기존 레코드는 자동으로 `NULL`을 가지며, 기존 쿼리·ORM 코드가 이 컬럼을 모르더라도 SELECT * 결과에 새 컬럼이 포함되어 불필요한 데이터 전송이 소폭 증가합니다.
  - 제안: ORM Entity(`node-execution.entity.ts` 등)가 이 컬럼을 반영하지 않으면 `SELECT *` 를 사용하는 쿼리에서 결과 매핑이 불일치할 수 있으므로, 동시에 Entity를 업데이트하는 것이 좋습니다.

- **[INFO]** 인덱스 생성 — 온라인 처리 여부
  - 위치: `CREATE INDEX idx_node_execution_parent ON node_execution(parent_node_execution_id)`
  - 상세: 표준 `CREATE INDEX`는 테이블에 ShareLock을 획득합니다. `node_execution` 테이블에 레코드가 많거나 운영 중 마이그레이션이 실행된다면 해당 테이블에 대한 DML이 잠시 블로킹될 수 있습니다.
  - 제안: PostgreSQL이라면 `CREATE INDEX CONCURRENTLY`를 사용하면 운영 중 쓰기를 차단하지 않습니다. (단, 트랜잭션 블록 내에서는 사용 불가하므로 Flyway/Liquibase 트랜잭션 설정을 확인하세요.)

---

### 요약

이 마이그레이션은 nullable 컬럼 추가와 인덱스 생성만 수행하며, 기존 데이터를 변경하거나 테이블 구조를 파괴적으로 수정하지 않습니다. 부작용의 주요 리스크는 두 가지입니다. 첫째, `CREATE INDEX`가 테이블 잠금을 유발해 운영 중 실행 시 짧은 DML 차단이 발생할 수 있고, 둘째, `ON DELETE SET NULL`로 인해 부모 레코드 대량 삭제 시 연쇄 UPDATE가 발생합니다. 두 경우 모두 서비스 로직에 의도하지 않은 상태 변경을 일으키지는 않으나, 운영 환경에서의 잠금 관리는 주의가 필요합니다.

---

### 위험도

**LOW**