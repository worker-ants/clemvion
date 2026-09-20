# 데이터베이스(Database) 리뷰 — schedule-dup-delete

## 발견사항

- **[INFO]** CASCADE 경로의 `scheduleRepository.remove(schedule)` 는 이제 항상 0행 no-op
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:364`
  - 상세: `triggerId` 가 있는 삭제 경로에서는 락 안 `m.delete(Trigger, triggerId)` 가 커밋되는 순간 `schedule.trigger_id → trigger` 의 `onDelete: 'CASCADE'` 로 스케줄 행도 DB 가 함께 지운다. 따라서 트랜잭션 밖에서 실행되는 `this.scheduleRepository.remove(schedule)` (364행) 은 매 성공 경로마다 PK 기준 DELETE 를 한 번 더 왕복시키지만 항상 0행 no-op 이다. 정합성 결함은 아니며 주석(362-363행)에 "CASCADE 가 없어지면 이 줄이 유일한 삭제"라는 방어 근거가 명시돼 있어 의도된 설계임을 확인했다.
  - 제안: 그대로 두어도 무방하나, 원한다면 CASCADE 를 신뢰 SoT 로 확정하고 이 줄을 제거해 불필요한 왕복을 없앨 수 있다. 다만 그 경우 엔티티 데코레이터가 CASCADE 정책의 유일한 안전망이 되므로, 트레이드오프로 지금 형태(방어적 이중 삭제)가 더 안전한 선택일 수 있다 — 필수 수정 아님.

- **[INFO]** advisory lock 은 트랜잭션 범위(`pg_advisory_xact_lock`)이므로 `NotFoundException` throw 로도 정상 해제됨을 확인
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:329-335`
  - 상세: `m.delete(Trigger, triggerId)` 의 `affected` 가 0이면 트랜잭션 콜백 안에서 `NotFoundException` 을 던진다. `manager.transaction()` 은 이를 잡아 ROLLBACK 후 재throw 하므로, 진 쪽 요청도 락을 정상적으로 해제한다(트랜잭션 종료 시 자동 해제되는 `_xact_lock` 계열이기 때문). e2e 테스트(`schedule-delete-concurrency.e2e-spec.ts`)가 `pg_advisory_xact_lock` 로 동일 락을 직접 쥐어 겹침을 만들고, 락 해제 후 두 요청이 `[204, 404]` 로 갈리는 것을 실제로 관측해 이 경로를 검증한다 — 형제 PR(#1369·#1370)과 동일한 검증 패턴.

## 관점별 확인

1. **인덱스**: 신규 쿼리 없음(기존 PK/FK 기준 `delete`). 인덱스 영향 없음.
2. **N+1**: 반복문 내 개별 쿼리 없음.
3. **트랜잭션**: 핵심 변경 지점 — advisory lock 을 트랜잭션 안에서 잡고, `m.delete(Trigger, triggerId)` 의 `affected` 를 판별자로 삼아 진 쪽을 즉시 롤백+404 시킨다. 판정 기준을 스케줄 행이 아니라 트리거 행의 `affected` 로 잡은 근거(CASCADE로 인해 스케줄 행 수로는 이긴 쪽도 0행이 되어 오판정된다)가 코드 주석·plan 문서·e2e 양쪽에서 일관되게 설명되고 실측(e2e `[204,204]`→`[204,404]`, 감사 2건→1건)으로 뒷받침된다. 적절하다.
4. **마이그레이션 안전성**: 스키마 변경 없음(엔티티 CASCADE 설정은 기존 값을 그대로 인용). 해당 없음.
5. **스키마 설계**: `schedule.trigger_id` FK `ON DELETE CASCADE` 라는 기존 설계를 전제로 애플리케이션 판정 로직을 정합화한 것 — 새로운 정규화/비정규화 이슈 없음.
6. **커넥션 관리**: `this.triggerRepository.manager.transaction(...)` 로 커넥션 풀에서 받은 연결을 TypeORM 이 자동 관리·해제. e2e 의 `db`/`locker` pg `Client` 도 `beforeAll`/`afterAll` 에서 명시적으로 connect/end 하여 누수 없음.
7. **SQL 인젝션**: `m.delete(Trigger, triggerId)`, `scheduleRepository.delete({ id, workspaceId })` 모두 TypeORM 파라미터화 API 사용. e2e 의 raw SQL(`pg_advisory_xact_lock(hashtext($1))`, `SELECT ... WHERE id = $1` 등)도 전부 `$1` 플레이스홀더로 파라미터화됨. 인젝션 위험 없음.
8. **대량 데이터**: 단건 PK 기준 삭제/조회만 존재. 페이지네이션·대용량 스캔과 무관.

## 요약

이번 변경은 동시 `DELETE` 두 건이 `schedule.deleted` 감사 행을 중복 기록하던 결함을, 이미 검증된 advisory-lock 트랜잭션 패턴(형제 PR #1369·#1370)에 맞춰 트리거 삭제의 `affected` 값을 판별자로 삼아 닫는다. `schedule.trigger_id` 의 `ON DELETE CASCADE` 때문에 스케줄 행 수로 판정하면 이긴 쪽도 오판정된다는 함정을 정확히 짚고 트리거 쪽 `affected` 를 판별자로 선택한 근거가 코드·plan 문서·e2e 테스트 삼자에서 일관된다. 트랜잭션 스코프, advisory lock 해제 시점(롤백 포함), 파라미터화 쿼리, 커넥션 해제 모두 안전하게 처리되어 있다. 발견된 사항은 CASCADE 이후 no-op 이 된 방어적 `remove()` 호출 정도로, 정합성에 영향 없는 INFO 수준이다.

## 위험도

LOW
