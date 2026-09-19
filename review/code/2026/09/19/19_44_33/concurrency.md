# 동시성(Concurrency) 코드 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 범위

이번 변경의 동시성 관련 실질 코드는 다음 5개다 (나머지는 review/consistency 산출물·spec 문서·순수 export-list 등 동시성과 무관):

- `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql` — 신규 테이블 + DB 트리거 함수 `reserve_webhook_endpoint_path()`
- `codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts` — TypeORM 엔티티(읽기 전용, 쓰기 로직 없음)
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `isEndpointPathUniqueViolation` predicate 확장(제약 이름 1개 → `ReadonlySet` 2개), `rethrowEndpointPathConflict` 메시지 변경
- `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` (신규) — SQL 을 실제 DB 에 대고 SAVEPOINT 로 순차 검증
- `codebase/backend/test/webhook-trigger.e2e-spec.ts` — B7/B8/B9 신규 e2e (API 를 통한 순차 HTTP 검증)

`triggers.controller.ts`(문서 문자열), `triggers.service.spec.ts`(unit 테스트 매트릭스 확장), `app.module.spec.ts`/`root-entities.ts`(엔티티 등록 리스트)는 동시성 관점에서 위험 없음.

## 설계 확인 (긍정적 관찰)

- **앱 레벨 TOCTOU 없음**: `create()`(`triggers.service.ts:497-504`)와 `update()`(같은 파일 `:643-730`, 이번 diff 밖의 기존 코드)는 `endpointPath` 에 대해 사전 `findOne` 검사를 하지 않고, `save()`/`m.save()` 를 그대로 시도한 뒤 DB 가 던지는 `unique_violation` 을 `.catch(() => this.rethrowEndpointPathConflict(err))` 로만 반응적으로 처리한다. 소유권 검증·유일성 강제는 전부 V133 의 `BEFORE INSERT OR UPDATE` DB 트리거로 위임돼 있어, 애플리케이션 계층이 "확인 후 쓰기(check-then-act)" 창을 새로 만들지 않는다. V132 와 같은 원칙의 올바른 재적용이다.
- **트리거 함수 내부의 INSERT→SELECT 순서**: `reserve_webhook_endpoint_path()`(`V133__webhook_endpoint_reservation.sql` 게이트 33~55행)는 `INSERT … ON CONFLICT (endpoint_path) DO NOTHING` 뒤에 같은 키를 다시 `SELECT` 한다. PostgreSQL 의 `ON CONFLICT` 는 동일 키에 대한 동시 INSERT 시 speculative insertion 프로토콜로 한쪽을 블록시키고, 승자가 커밋/롤백된 뒤에야 패자를 진행시키는 것이 문서화된 동작이다. PL/pgSQL 함수 안에서 READ COMMITTED(기본값) 는 문장마다 새 스냅샷을 잡으므로, 블록 해제 뒤의 `SELECT` 는 승자가 커밋한 최신 행을 정확히 본다 — 설계 주석이 주장하는 "PK 가 한쪽만 통과시키고 다른 쪽은 주인이 다르다는 것을 본다" 는 실제 Postgres 동작과 부합한다.
- **BEFORE 트리거 우선순위**: `CREATE TRIGGER … BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id … WHEN (NEW.endpoint_path IS NOT NULL)` (게이트 58~62행)이 기존 `idx_trigger_endpoint_path` 부분 UNIQUE 검사보다 먼저 실행되므로, "다른 워크스페이스의 살아 있는 트리거와 겹치는" 흔한 경우도 이 트리거가 먼저 잡는다는 주석의 주장이 맞다. `triggers.service.ts` 의 `isEndpointPathUniqueViolation` 이 두 제약 이름(`idx_trigger_endpoint_path`, `webhook_endpoint_reservation_owner`)을 모두 인식하도록 확장돼(`triggers.service.ts:233-249`) 이 두 경로가 실제로 같은 409 로 수렴하는 것도 확인했다 — 직전 consistency 세션이 지적한 WARNING(예약 트리거 경로가 predicate 에서 누락되면 500 이 난다)이 이번 커밋에서 해소돼 있다.

## 발견사항

- **[WARNING]** 이 기능이 닫으려는 "진짜 경쟁 조건"이 새 테스트 어디에서도 **동시 실행**으로 검증되지 않는다
  - 위치: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` — `describe('V133 웹훅 경로 영구 예약 (e2e)')` > `it('백필은 경로가 있는 트리거만 각자의 워크스페이스로 예약하고 …')` (게이트 없음 — 프롬프트에서 diff 생략됨, 파일 직접 열람으로 확인. 해당 파일 전체 40~213행)
    / `codebase/backend/test/webhook-trigger.e2e-spec.ts` — `it('B7. 지우거나 바꾼 경로 …')`, `it('B8. 워크스페이스를 지우면 …')`, `it('B9. schema: …')` (마찬가지로 게이트 없음, `git diff origin/main` 로 직접 확인)
  - 상세: 마이그레이션 주석과 `isEndpointPathUniqueViolation` JSDoc 이 반복해서 강조하는 핵심 주장은 "**새 경로를 동시에 잡는 두 요청**은 PK 가 한쪽만 통과시키고, 다른 쪽은 주인이 다르다는 것을 본다"(`V133__webhook_endpoint_reservation.sql` 게이트 11~12행) 는 것이다. 그런데 추가된 두 e2e 는 모두 **한 커넥션/한 요청씩 순차로** 검증한다 — `webhook-endpoint-reservation.e2e-spec.ts` 는 `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` 로 한 트랜잭션 안에서 "이미 예약된 경로에 다른 워크스페이스가 쓰면 거부되는가"만 확인하고, `webhook-trigger.e2e-spec.ts` B7~B9 는 `await` 로 직렬화된 supertest 호출이다. 두 워크스페이스가 **동시에 같은 새 경로**(백필도, 사전 예약도 없는 완전히 새로운 `endpoint_path`)를 놓고 실제로 경합하는 시나리오 — 즉 두 개의 독립된 DB 커넥션이 같은 순간에 같은 키로 `INSERT … ON CONFLICT DO NOTHING` 을 실행하는 인터리빙 — 은 어떤 테스트에서도 재현되지 않는다. 이 인터리빙이 바로 이 마이그레이션이 존재하는 이유(V132 의 "동시에 존재하는 중복만 막는다"는 한계)와 대칭되는, 가장 중요하게 검증해야 할 지점이다. 현재는 PostgreSQL 의 문서화된 `ON CONFLICT` 동시성 보장에만 의존하고 있고, 그 보장이 실제로 이 트리거 함수·이 애플리케이션의 트랜잭션 경계(격리 수준·커넥션 풀) 위에서 성립하는지는 실측되지 않았다.
  - 제안: 두 개의 독립된 `pg.Client`(또는 두 개의 API 요청을 `Promise.all` 로 동시에 발사)로 같은 브랜드-뉴 `endpointPath` 를 서로 다른 워크스페이스에서 동시에 `create()` 하는 테스트를 추가한다. 기대값은 "정확히 하나만 201, 나머지는 409(`webhook_endpoint_reservation_owner`)이고, `webhook_endpoint_reservation` 테이블에는 승자의 행 하나만 남는다"이다. 타이밍 제어가 어려우면 최소한 두 트랜잭션을 `BEGIN` 해 둔 채로 한쪽이 `INSERT … ON CONFLICT DO NOTHING` 실행 후 커밋하지 않고 대기시키고, 다른 커넥션이 같은 문장을 실행할 때 블록되는지(그리고 첫 커넥션 커밋/롤백 후 올바르게 해소되는지)를 두 개의 `pg.Client` 로 직접 관찰하는 SQL 레벨 테스트로도 충분하다.

- **[INFO]** 트리거 함수의 정합성이 암묵적으로 READ COMMITTED(기본 격리 수준)를 전제한다
  - 위치: `V133__webhook_endpoint_reservation.sql` 게이트 33~55행 (`reserve_webhook_endpoint_path()`), 호출 측 `codebase/backend/src/modules/triggers/triggers.service.ts:497-504`(`create()`), `:643-645`(`update()` 의 `this.triggerRepository.manager.transaction(async (m) => {...})`)
  - 상세: `INSERT … ON CONFLICT DO NOTHING` 뒤 곧바로 `SELECT` 로 재확인하는 패턴은 REPEATABLE READ/SERIALIZABLE 격리 수준에서는 다르게 동작한다 — 그 격리 수준에서 동시 커밋과 충돌하면 Postgres 는 조용히 최신 행을 보여주는 대신 직렬화 실패(SQLSTATE `40001`)를 던질 수 있다. `isPostgresUniqueViolation`/`isEndpointPathUniqueViolation` 은 `23505` 만 인식하므로, 그 경우 409 대신 처리되지 않은 예외(500)로 샐 수 있다. 현재 확인한 바로는 `create()`/`update()` 어디에도 명시적 isolation level 지정이 없어 Postgres 기본값(READ COMMITTED)으로 동작하므로 **지금은 문제가 되지 않는다.** 다만 이 안전성이 "누구도 트리거 생성/수정 경로를 더 높은 격리 수준으로 감싸지 않는다"는 문서화되지 않은 전제에 기대고 있다는 점만 기록해 둔다 — 향후 이 경로를 SERIALIZABLE 트랜잭션으로 감싸는 변경이 생기면 이 트리거 함수도 함께 재검토해야 한다.
  - 제안: 필수 조치는 아님. `reserve_webhook_endpoint_path()` 함수 주석에 "이 함수는 호출 트랜잭션이 READ COMMITTED 인 것을 전제한다" 한 줄을 남겨 두면 향후 회귀를 막을 수 있다.

## 요약

새 DB 트리거(`trg_trigger_reserve_endpoint_path`)와 이를 반영한 서비스 계층 predicate 확장은 애플리케이션 레벨 check-then-act 을 도입하지 않고 PostgreSQL 의 `INSERT … ON CONFLICT DO NOTHING` + BEFORE 트리거 우선순위에 강제를 전량 위임하는, V132 와 일관된 안전한 설계다. 문서화된 Postgres 동시성 보장에 비춰 보면 로직 자체에서 새로운 경쟁 조건·데드락·원자성 결함은 찾지 못했다. 다만 이 변경이 존재하는 이유인 "두 워크스페이스가 동시에 새 경로를 놓고 경합하는" 시나리오를 실제 동시 실행으로 검증하는 테스트가 하나도 추가되지 않았다는 점(WARNING)과, 정합성이 암묵적으로 기본 격리 수준에 의존한다는 점(INFO)을 남긴다. 둘 다 현재 동작하는 코드의 결함이 아니라 검증·문서화 갭이다.

## 위험도

LOW
