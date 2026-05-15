### 발견사항

- **[WARNING]** 대용량 테이블에서의 `ALTER TABLE` Lock 위험
  - 위치: `ALTER TABLE node_execution ADD COLUMN ...`
  - 상세: PostgreSQL은 `ADD COLUMN`에 대해 일반적으로 짧은 `ACCESS EXCLUSIVE` 락을 획득합니다. 그러나 `DEFAULT` 값이 없는 nullable 컬럼 추가는 테이블 재작성(table rewrite) 없이 빠르게 처리되므로 이 경우 위험은 낮습니다. 단, `REFERENCES` 제약 포함 시 외래 키 유효성 검사를 위한 `SHARE ROW EXCLUSIVE` 락이 추가로 발생하고, 기존 데이터가 많을 경우 전체 테이블 스캔이 발생할 수 있습니다.
  - 제안: 무중단 배포가 중요한 환경이라면 FK 제약을 별도 단계로 분리하거나 `NOT VALID` 옵션을 사용하세요.
    ```sql
    ALTER TABLE node_execution
      ADD COLUMN parent_node_execution_id UUID,
      ADD CONSTRAINT fk_parent_node_execution
        FOREIGN KEY (parent_node_execution_id)
        REFERENCES node_execution(id)
        ON DELETE SET NULL
        NOT VALID;
    -- 별도 배포 또는 유지보수 윈도우에서:
    ALTER TABLE node_execution
      VALIDATE CONSTRAINT fk_parent_node_execution;
    ```

- **[INFO]** 자기 참조(self-referential) FK의 `ON DELETE SET NULL` 동작 확인
  - 위치: `ON DELETE SET NULL`
  - 상세: 부모 `NodeExecution`이 삭제될 때 자식 행의 `parent_node_execution_id`가 `NULL`로 설정됩니다. 이 동작은 타임라인 계층 구조를 유지하는 목적에 부합하지만, 부모가 삭제된 자식 행이 고아(orphan) 상태로 남아 타임라인 UI에서 루트 노드로 오인될 수 있습니다. `ON DELETE CASCADE` 또는 애플리케이션 레이어에서 명시적 처리가 적절한지 검토가 필요합니다.
  - 제안: 서브 워크플로우 실행이 항상 부모 실행과 생명주기를 함께한다면 `ON DELETE CASCADE` 검토를 권장합니다.

- **[INFO]** 부분 인덱스(Partial Index) 고려
  - 위치: `CREATE INDEX idx_node_execution_parent ON node_execution(parent_node_execution_id)`
  - 상세: `parent_node_execution_id`는 대부분의 일반 노드에서 `NULL`이 됩니다(서브 워크플로우 자식 노드만 값을 가짐). 전체 인덱스는 대다수 `NULL` 값을 포함하게 되어 인덱스 크기가 불필요하게 커집니다.
  - 제안: `NULL`을 제외한 부분 인덱스를 사용하면 인덱스 크기를 줄이고 쓰기 성능을 개선할 수 있습니다.
    ```sql
    CREATE INDEX idx_node_execution_parent
      ON node_execution(parent_node_execution_id)
      WHERE parent_node_execution_id IS NOT NULL;
    ```

- **[INFO]** 트랜잭션 래핑 부재
  - 위치: 마이그레이션 전체
  - 상세: `ALTER TABLE`과 `CREATE INDEX`가 단일 트랜잭션으로 묶여 있지 않아, 인덱스 생성 중 실패 시 컬럼만 추가된 중간 상태로 남을 수 있습니다. Flyway는 기본적으로 각 마이그레이션을 트랜잭션으로 감싸지만, 명시적으로 확인이 필요합니다.
  - 제안: Flyway 설정에서 `outOfOrder`/트랜잭션 처리 방식을 확인하거나 명시적 `BEGIN`/`COMMIT`을 추가하세요.

---

### 요약

이 마이그레이션은 서브 워크플로우 타임라인 계층 구조를 위한 자기 참조 FK 컬럼을 추가하는 단순하고 의도가 명확한 스키마 변경입니다. nullable 컬럼 추가이므로 PostgreSQL에서 테이블 재작성 없이 처리되어 기본적인 안전성은 확보됩니다. 다만 FK 제약으로 인한 락, `ON DELETE SET NULL`의 고아 행 발생 가능성, 대다수 `NULL`인 인덱스 효율성 세 가지를 검토하면 더 견고한 마이그레이션이 됩니다.

### 위험도
**LOW**