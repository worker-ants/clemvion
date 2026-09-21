# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `remove()` 에 `findById` SELECT 와 원자적 `DELETE` 가 순차 실행되어 왕복 쿼리가 1회 추가된다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:299` (`findById` 호출), `:316-320` (`delete` + `affected` 판정)
  - 상세: `affected === 0` 판정만으로 이미 "대상 없음"(최초부터 없던 경우·동시 삭제로 진 경우 모두)을 404 `RESOURCE_NOT_FOUND` 로 정확히 가려낸다. 그 앞의 `await this.findById(id, workspaceId)` (299행)는 반환값을 전혀 쓰지 않고 오직 사전 존재 확인용으로만 남아 있어, 매 삭제 요청마다 `SELECT` 1회가 구조적으로 낭비된다. 다만 이 엔드포인트는 관리자 단발 액션이라 트래픽이 낮고, 형제 서비스들(트리거/스케줄/워크스페이스 등)과 동일한 코드 형태를 유지하려는 의도로 보여 심각도는 낮다.
  - 제안: 성능이 중요하지 않다면 현행 유지도 무방하나, 정리한다면 `findById` 호출을 제거하고 `delete()` 의 `affected === 0` 판정 하나로 404 를 던지도록 단순화할 수 있다(동작 동일, 왕복 1회 절감).

- **[INFO]** 삭제(`DELETE`)와 감사 로그 기록(`recordAudit`)이 단일 트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:316-328`
  - 상세: 이 자체는 새로 도입된 리스크가 아니라 이 저장소의 기존 계약(`@remarks` 주석: "감사 기록은 best-effort — audit DB 장애가 본 CRUD 를 실패시키지 않는다")을 그대로 따른 것이고, `AuditLogsService.record` 가 내부에서 실패를 swallow 하는 것도 별도로 검증되어 있다. 형제 PR(#1369~#1373)들과 동일한 패턴이므로 이번 변경이 만든 새 문제는 아니다.
  - 제안: 현행 계약 유지. 별도 조치 불요.

## 검증한 항목 (문제 없음)

- **동시성 정합성**: 종전 `findOne` → `remove(entity)` 조합은 락이 없어 동시 DELETE 두 건이 모두 `affected` 를 확인하지 않고 감사 로그를 남기는 결함이 있었다. 이번 변경은 `DELETE ... WHERE id = $1 AND workspace_id = $2` 단일 원자적 문장으로 전환하고 `affected === 0` 을 **명시 비교**로 판정한다. Postgres 에서 동일 행을 겨냥한 두 개의 단일 `DELETE` 문은 첫 번째가 행 잠금을 잡고 커밋하면 두 번째는 자동으로 0행에 매치되므로, 별도의 advisory lock/row lock 없이도 "진 쪽=0행" 이 보장된다 — 락을 새로 들이지 않겠다는 코드 주석의 판단은 타당하다.
- **`affected: null|undefined` 오판정 방지**: `!affected` 대신 `affected === 0` 명시 비교를 사용해, 드라이버가 `affected` 를 보고하지 않는 경우(`null`/`undefined`)를 "삭제 실패"로 오판하지 않도록 했다. 회귀 테스트(`it.each([[undefined],[null]])`)가 이 분기를 정확히 겨냥한다.
- **인덱스**: `auth_config.id` 는 PK(UUID) 이고 `workspace_id` 도 이미 인덱스(`V127__auth_config_workspace_id_index.sql`)가 있어, `DELETE ... WHERE id = $1 AND workspace_id = $2` 는 PK 조회 1건으로 처리되며 풀스캔 위험이 없다.
- **캐스케이드/라이프사이클 훅 무영향 확인**: `AuthConfig` 엔티티(`entities/auth-config.entity.ts`)를 직접 확인한 결과, `@OneToMany`·`cascade: true` 가 없어 `remove(entity)` → `delete(criteria)` 전환이 ORM 레벨 캐스케이드 동작을 바꾸지 않는다는 코드 주석의 주장이 실측과 일치한다. `trigger.auth_config_id` 의 `ON DELETE SET NULL` 은 DB 레벨 FK 제약(`V001__initial_schema.sql:210`)이라 두 방식 모두 동일하게 발동한다.
- **마이그레이션**: 이번 diff 에 스키마 변경(신규 `.sql` 마이그레이션)이 없어 무중단 배포 관점의 lock/데이터 손실 리스크가 없다.
- **SQL 인젝션**: 서비스 코드는 TypeORM `Repository.delete(criteria)`/`QueryBuilder` 파라미터 바인딩만 사용한다. 신규 e2e 테스트(`auth-config-delete-concurrency.e2e-spec.ts`)의 raw `pg.Client` 쿼리도 전부 `$1`/`$2` 파라미터화되어 있고 문자열 결합이 없다.
- **N+1**: 반복문 내 개별 쿼리 패턴 없음(단건 삭제 경로).
- **커넥션 관리**: e2e 테스트의 `db`/`locker` 두 `pg.Client` 는 `beforeAll`에서 connect, `afterAll`에서 `end()` 로 명시적으로 해제된다. `locker` 트랜잭션은 `try/finally` 로 `ROLLBACK`(또는 위 COMMIT)이 보장되어 커넥션이 열린 트랜잭션 상태로 유실되지 않는다.
- **대량 데이터**: 이번 변경은 단건 삭제 경로이며 페이지네이션 대상 쿼리(`findAll`, `getUsage`)에는 변경이 없다.

## 요약

핵심 변경은 `auth-configs.service.ts` 의 `remove()` 를 "조회 후 `remove(entity)`" 방식에서 "조건부 원자적 `DELETE` + `affected` 명시 비교" 방식으로 바꿔, 동시 삭제 두 건이 모두 감사 로그를 남기던 결함을 락 없이 DB 원자성만으로 해결한 것이다. PK/인덱스 활용, 파라미터화, 캐스케이드 무영향 확인, `null`/`undefined` vs `0` 판정 구분이 모두 실측·코드로 뒷받침되어 있고 신규 마이그레이션도 없다. 유일한 흠은 이제는 불필요해진 사전 `findById` SELECT 가 매 요청마다 왕복 1회를 추가한다는 점이지만, 저빈도 관리자 액션이라 영향은 미미하다(INFO). 감사 로그가 삭제와 같은 트랜잭션에 묶여 있지 않은 점도 이 저장소의 기존 best-effort 계약을 그대로 따른 것으로 새로운 리스크가 아니다.

## 위험도

LOW
