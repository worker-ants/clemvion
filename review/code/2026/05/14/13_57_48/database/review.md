### 발견사항

---

**[WARNING]** `handleInstall` 쿼리에 인덱스 누락

- **위치**: `integration-oauth.service.ts` — `handleInstall()` 내 `createQueryBuilder`
- **상세**: 쿼리가 `service_type = 'cafe24'` AND `status = 'pending_install'` 로 필터링하지만, 기존 인덱스는 `(workspaceId, status)` 복합 인덱스만 존재한다. 이 인덱스는 `workspaceId` 가 선두 컬럼이므로 해당 쿼리에서는 사용되지 않아 전체 테이블 스캔이 발생한다.
- **제안**: `pending_install` 레코드는 일시적으로 소수일 것이므로 현재는 실용적 영향이 낮다. 다만 테이블 규모가 커지면 `status` 단독 또는 `(service_type, status)` 복합 인덱스를 추가하는 것이 권장된다.
  ```sql
  CREATE INDEX idx_integration_service_status ON integration(service_type, status);
  ```

---

**[WARNING]** 마이그레이션의 `ACCESS EXCLUSIVE` 락 이중 획득

- **위치**: `V042__cafe24_private_app_pending_install.sql` — `DROP CONSTRAINT` + `ADD CONSTRAINT CHECK`
- **상세**: PostgreSQL에서 `DROP CONSTRAINT`와 `ADD CONSTRAINT CHECK` 각각이 `ACCESS EXCLUSIVE` 락을 획득하며, 이 락은 테이블의 모든 읽기·쓰기를 차단한다. 또한 `NOT VALID` 없이 CHECK 제약을 추가하면 기존 전체 행을 즉시 검증한다(행 수에 비례하는 스캔). 무중단 배포 환경에서 테이블 크기나 장기 실행 트랜잭션에 따라 짧은 서비스 중단이 발생할 수 있다.
- **제안**: integration 테이블 규모가 크지 않은 경우 실질 위험은 낮지만, 프로덕션 배포 시점에 장기 트랜잭션이 없는 메인터넌스 윈도우를 선택하는 것이 안전하다. 더 엄격한 제로다운타임 요건이 있다면 `NOT VALID` 패턴을 고려할 수 있다.
  ```sql
  ALTER TABLE integration
    ADD CONSTRAINT integration_status_check
    CHECK (status IN ('connected', 'expired', 'error', 'pending_install'))
    NOT VALID; -- 기존 행 즉시 검증 생략
  -- 별도 배포 후:
  ALTER TABLE integration VALIDATE CONSTRAINT integration_status_check;
  ```

---

**[INFO]** TypeORM QueryBuilder에서 원시 컬럼명과 문자열 리터럴 직접 사용

- **위치**: `integration-oauth.service.ts:680` 부근
  ```typescript
  .where("i.service_type = 'cafe24'")
  .andWhere("i.status = 'pending_install'")
  ```
- **상세**: 하드코딩된 값이므로 SQL 인젝션 위험은 없다. 그러나 DB 컬럼명을 문자열로 직접 사용하면 TypeORM의 엔티티 추상화를 우회하게 되어, 컬럼명 변경 시 런타임에서야 오류가 발생한다. TypeORM QueryBuilder의 파라미터 바인딩 방식이 더 견고하다.
- **제안**:
  ```typescript
  .where("i.serviceType = :serviceType", { serviceType: 'cafe24' })
  .andWhere("i.status = :status", { status: 'pending_install' })
  ```

---

**[INFO]** `handleInstall`에서 `mall_id` 를 DB 쿼리 단계에 포함하지 않음

- **위치**: `integration-oauth.service.ts` — `handleInstall()` 후보 조회 로직
- **상세**: 현재 `mall_id` 필터링을 HMAC 검증 루프 안에서 인메모리로 수행한다. `pending_install` 레코드가 소수인 현재 아키텍처에서는 문제없지만, JSONB 컬럼(`credentials->>'mall_id'`)을 DB 쿼리에 추가하면 후보를 더 좁혀올 수 있다.
- **제안**: `pending_install` 상태의 레코드는 설계상 항상 소수이므로, 현재 구현이 실용적으로 충분하다. 우선순위 낮음.

---

### 요약

이번 변경의 핵심 DB 작업은 `integration` 테이블에 nullable 컬럼 추가와 CHECK 제약 확장이다. nullable 컬럼 추가는 PostgreSQL에서 메타데이터 변경만으로 처리되어 안전하다. CHECK 제약의 DROP+ADD 패턴이 `ACCESS EXCLUSIVE` 락을 두 번 획득하는 점이 프로덕션에서 주의 사항이나, 테이블 규모가 작고 값 집합을 축소하는 게 아닌 확장하는 변경이므로 실질 위험은 낮다. `handleInstall`의 `(service_type, status)` 인덱스 부재는 `pending_install` 레코드의 일시적·소규모 특성상 현재 영향은 미미하지만, 장기적으로 인덱스 추가를 권장한다.

### 위험도

**LOW**