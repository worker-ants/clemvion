### 발견사항

- **[INFO]** V056 마이그레이션: CREATE INDEX CONCURRENTLY 와 DROP INDEX CONCURRENTLY 가 단일 SQL 파일 안에 순차 실행
  - 위치: `backend/migrations/V056__notification_active_partial_index.sql` (전체)
  - 상세: `executeInTransaction=false` (.conf) 를 명시해 트랜잭션 블록 밖에서 실행하는 것은 올바른 접근이다. CONCURRENTLY 는 트랜잭션 안에서 실행 불가하므로 필수 처리다. 다만 CREATE 성공 후 DROP 직전에 프로세스가 중단되는 경우 구 인덱스와 신 인덱스가 동시에 존재하는 상태가 되는데, 이 경우 플래너가 두 인덱스 중 비효율적인 쪽을 선택할 수 있다. `IF NOT EXISTS` / `IF EXISTS` 를 두어 재실행 안전성은 확보되어 있으므로 실제로 재실행하면 복구된다.
  - 제안: 운영 가이드 또는 마이그레이션 주석에 "CREATE 성공 + DROP 이전 중단 시 재실행으로 복구" 절차를 명시하면 충분하다. 현재 주석에 부분 상태 복구 언급이 있으므로 허용 수준이다.

- **[INFO]** `dismiss()` 단건: findOne 후 save 패턴 — 경쟁 조건(race condition) 가능성
  - 위치: `backend/src/modules/notifications/notifications.service.ts` L596–L614 (`dismiss` 메서드)
  - 상세: `findOne` → `dismissedAt` 확인 → `save` 흐름은 두 동시 요청이 같은 알림을 동시에 dismiss 하려 할 때 둘 다 `dismissedAt === null` 을 보고 각각 `new Date()` 를 저장할 수 있다. 결과는 최종적으로 둘 중 하나의 타임스탬프로 덮이는 last-write-wins 상황이다. 멱등성 보장 목적상 기존 dismissed_at 을 보존해야 한다고 스펙이 요구하는 경우 이 경쟁이 문제가 된다. 단, 알림 dismiss 는 사용자 UI 동작이라 동시 요청 빈도가 극히 낮고, 양쪽 모두 성공 응답을 반환하는 방향이므로 실제 데이터 손상보다는 "어느 시각이 저장되느냐" 차이만 남는다.
  - 제안: 멱등성 정합성을 강화하려면 `UPDATE notification SET dismissed_at = NOW() WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL RETURNING *` 단일 쿼리로 교체해 DB 레벨 원자성을 이용하고, 영향 행 0이면 별도 `findOne` 으로 기존 dismissed_at 을 반환하는 방식이 더 안전하다. 현재 수준의 동시성 위험도는 낮으므로 INFO 로 분류.

- **[INFO]** `findAll` 의 `dismissed_at IS NULL` 조건: 인라인 문자열 조건 사용
  - 위치: `backend/src/modules/notifications/notifications.service.ts` L706 (`findAll` 내 `qb.andWhere('n.dismissed_at IS NULL')`)
  - 상세: 파라미터화가 필요 없는 IS NULL 조건은 인라인 문자열로 쓰는 것이 TypeORM 관용적 패턴이므로 SQL 인젝션 위험은 없다. 단, 추후 `dismissed_at` 비교 조건을 변수화해야 할 경우 파라미터 바인딩을 추가하면 된다. 현재는 적절하다.
  - 제안: 해당 없음(현재 패턴 유지).

- **[INFO]** `dismissAll` 의 `NOW()` 함수 리터럴 사용
  - 위치: `backend/src/modules/notifications/notifications.service.ts` L629 (`.set({ dismissedAt: () => 'NOW()' })`)
  - 상세: TypeORM `.set()` 에서 함수 형태로 DB 함수 리터럴을 넘기는 것은 TypeORM 공식 패턴이며 SQL 인젝션 위험 없다. `dismissed_at` 은 `WHERE dismissed_at IS NULL` 조건으로 이미 visible 알림만 대상으로 한정되어 있어 partial index (`WHERE dismissed_at IS NULL`) 를 활용할 수 있다.
  - 제안: 적절하다. 추가 조치 불필요.

- **[INFO]** `createMany` 에서 배열을 `repository.save(rows)` 로 일괄 INSERT
  - 위치: `backend/src/modules/notifications/notifications.service.ts` L886 (`createMany` 메서드)
  - 상세: TypeORM 의 `save(array)` 는 각 row 를 개별 INSERT 로 발행하거나 chunks 로 처리할 수 있다. 대량 알림 fan-out(관리자 다수) 시 N개 INSERT 가 나갈 수 있다. 현재 admin 수가 적은 범위면 큰 문제는 없지만, 수십~수백 명의 관리자에게 fan-out 하는 경우 성능 저하 가능성이 있다.
  - 제안: 대규모 fan-out이 예상되면 TypeORM 의 `createQueryBuilder().insert().into(Notification).values(rows).execute()` 방식으로 단일 multi-row INSERT 로 교체하는 것을 고려한다.

- **[INFO]** `DatabaseQueryHandler` 커넥션 풀 — 풀 크기 고정값
  - 위치: `backend/src/nodes/integration/database-query/database-query.handler.ts` L1331 (`POOL_MAX_CONNECTIONS = 5`)
  - 상세: 각 integration별로 `max: 5` 의 커넥션 풀을 인스턴스 단위로 유지한다. 여러 integration 이 동시에 활성화되고 병렬 실행이 많을 경우 총 커넥션 수가 `5 × integration 수 × worker 수` 로 증가할 수 있다. `pool.on('error')` 로 idle 클라이언트 오류를 로깅하는 것은 적절하다. PostgreSQL `client?.release()` 는 finally 블록에서 안전하게 호출된다.
  - 제안: 운영 환경에서 integration 수와 워커 수를 고려해 `POOL_MAX_CONNECTIONS` 를 환경변수로 구성 가능하게 만드는 것을 장기적으로 검토한다.

### 요약

이번 변경의 DB 관련 핵심은 `dismissed_at` soft delete 컬럼 추가(V055)와 partial index 전환(V056)이다. V055 는 `ALTER TABLE ADD COLUMN NULL` 메타데이터-only 작업으로 무중단 배포에 안전하다. V056 은 `executeInTransaction=false` + CONCURRENTLY 를 올바르게 사용하고 `IF NOT EXISTS` / `IF EXISTS` 로 재실행 안전성을 확보했다. `NotificationsService` 의 `findAll`, `getUnreadCount`, `dismissAll` 은 모두 `dismissed_at IS NULL` 조건을 일관되게 적용해 partial index 를 적절히 활용할 수 있는 구조다. `dismiss()` 단건에서 findOne-then-save 패턴이 이론적 경쟁 조건을 내포하지만 알림 dismiss 특성상 실제 영향이 미미하다. `hasRecentByResource` 가 dismissed row 를 의도적으로 포함하는 설계는 spec 에 근거한 올바른 결정이다. `DatabaseQueryHandler` 의 커넥션 풀 관리는 자격증명 해시 기반 캐시, `release()` finally 보장, 풀 오류 이벤트 로깅 등 적절한 수준이다. 전반적으로 DB 설계와 마이그레이션 안전성이 잘 고려된 변경이다.

### 위험도

LOW
