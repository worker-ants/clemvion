# 부작용(Side Effect) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 범위

- `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql` (신규 테이블·인덱스·DB 트리거·백필)
- `codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts` (신규 엔티티)
- `codebase/backend/src/database/root-entities.ts` · `codebase/backend/src/app.module.spec.ts` (엔티티 등록)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`isEndpointPathUniqueViolation` 확장, 메시지 변경)
- `codebase/backend/src/modules/triggers/triggers.controller.ts` (문서 문자열만)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` · `test/deletion-cascade-indexes.e2e-spec.ts` · `test/webhook-endpoint-reservation.e2e-spec.ts`(신규) · `test/webhook-trigger.e2e-spec.ts`(B7~B9 추가)
- spec 문서 5건(문서 전용 변경, 부작용 없음)

가장 우려되는 지점(신규 DB 트리거의 실행 범위)을 실제로 검증하기 위해, 저장소를 수정하지 않고 다음을 대조했다:

- `node_modules/.pnpm/typeorm@0.3.31.../persistence/SubjectChangedColumnsComputer.js` — `TriggersService.update()` 가 쓰는 `triggerRepository.save(trigger)` 는 로드된 엔티티와 DB 값을 **컬럼 단위로 diff** 해 실제로 값이 바뀐 컬럼만 UPDATE `SET` 절에 싣는다(`computeDiffColumns`, line 149 `if (normalizedValue === databaseValue) return;`). 즉 `endpointPath` 를 건드리지 않는 일반 PATCH(이름·isActive·config)는 `workspace_id`/`endpoint_path` 가 `SET` 절에 들어가지 않으므로 새 `BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id` 트리거를 깨우지 않는다.
- `triggerRepository.update(...)` 를 호출하는 5개 파일(`chat-channel.dispatcher.ts`, `triggers.service.ts` 3곳, `notification-webhook.processor.ts`, `schedules.service.ts`, `hooks.service.ts`)을 전수 확인 — 전부 `chatChannelHealth`/`notificationSecretV2`/`lastTriggeredAt`/`name`/`isActive` 등 무관한 컬럼만 patch 하고, `endpointPath`/`workspaceId` 를 싣는 곳은 없다. Postgres 의 `UPDATE OF col` 은 값이 실제로 바뀌지 않아도 그 컬럼이 `SET` 절에 **나열**되기만 하면 발동하므로(partial-update 계열 API 는 diff 를 안 한다), 이 전수 확인이 새 트리거가 "웹훅 경로 생성·변경" 이외의 경로에서 조용히 더 자주 실행되지 않음을 뒷받침한다.
- `codebase/backend/src/modules/triggers/entities/trigger.entity.ts` — `workspaceId` 는 `nullable` 이 아니므로, 트리거 함수의 `NEW.workspace_id` 가 NULL 로 예약을 오염시킬 경로는 없다.
- `app.module.ts` 의 `TypeOrmModule.forRootAsync` 는 `synchronize: false` — 엔티티 등록(`ROOT_ENTITIES`/`REQUIRED_ENTITIES`) 자체가 스키마를 바꾸는 부작용은 없고, 실제 DDL 은 V133 SQL 단독 출처다.
- `webhook-endpoint-reservation.e2e-spec.ts`(신규)는 `BEGIN` → 전용 스키마(`v133_probe`) 생성 → `search_path` 로 V133 SQL 을 격리 실행 → `finally` 블록에서 무조건 `ROLLBACK` — 공유 e2e DB 의 `public` 스키마를 건드리지 않는다. V131 가드와 동일한 패턴이며 정상 종료·예외 종료 모두 롤백을 보장한다.

## 발견사항

- **[INFO]** 새 DB 트리거의 실제 발동 범위는 "웹훅 트리거 생성 · `endpointPath`/`workspaceId` 실변경" 으로 올바르게 좁혀져 있으나, 이는 `TriggersService.update()` 가 diff 기반 `save()` 를 쓰기 때문이며 **트리거 정의 자체는 이를 보장하지 않는다**(`UPDATE OF workspace_id` 는 값이 같아도 `SET` 절에 그 컬럼이 나열되면 발동한다).
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:58-63` (`CREATE TRIGGER trg_trigger_reserve_endpoint_path ... BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id ...`)
  - 상세: 오늘 기준으로는 안전하다(직접 확인함 — 위 "검토 범위" 절 참고). 다만 앞으로 `triggerRepository.update()`(partial, non-diff) 나 raw query builder 로 `workspace_id`/`endpoint_path` 를 명시적으로 `SET` 하는 새 코드가 생기면(예: 워크스페이스 간 트리거 이관 기능), 값이 그대로여도 이 DB 트리거가 매번 추가 INSERT+SELECT 왕복을 발생시키게 된다. 지금은 함수 로직상 오탐(원치 않는 409)은 나지 않지만(같은 소유자면 `reserved_by IS DISTINCT FROM NEW.workspace_id` 가 false), 조용한 성능 부작용의 표면이 넓어질 잠재 지점이다.
  - 제안: 새로 `triggerRepository.update()`/QueryBuilder 로 `workspaceId`/`endpointPath` 를 건드리는 코드가 추가될 때 이 트리거의 "OF" 컬럼 목록을 상기하도록, `triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` 주석 부근이나 엔티티 JSDoc 에 "partial update API 로 이 두 컬럼을 건드리면 값이 같아도 이 트리거가 돈다" 한 줄을 남겨두면 향후 회귀를 막기 좋다. 필수 수정은 아니다.

- **[INFO]** 새 마이그레이션의 `CREATE TRIGGER` 는 `trigger` 테이블에 `SHARE ROW EXCLUSIVE` 잠금을 커밋 시점까지 유지한다 — 배포 시점에 동시 INSERT/UPDATE 가 짧게 대기한다.
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:58-67` (`CREATE TRIGGER` 다음 백필 `INSERT ... SELECT`)
  - 상세: 마이그레이션 헤더 주석(파일 17~19행)이 이 순서를 의도적으로 설명하고 있어 의도치 않은 부작용은 아니다. 다만 "부작용" 관점에서 배포 시점에 `trigger` 테이블 쓰기 트래픽이 몰리는 워크스페이스가 있다면 짧은 지연이 관측될 수 있음을 기록해 둔다(V132 선례와 동일한 성격이라 신규 리스크는 아님).

- **[INFO]** `isEndpointPathUniqueViolation()` 은 `export function` 으로 공개돼 있어 시그니처는 그대로이지만 반환 의미가 넓어졌다(이름 1개 → 2개 매칭).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `export function isEndpointPathUniqueViolation`
  - 상세: 현재 이 모듈 밖에서 import 하는 곳은 없다(전수 grep 확인 — `triggers.service.ts`/`triggers.service.spec.ts` 뿐). 향후 다른 모듈이 이 predicate 를 재사용하면 "예약 충돌"도 true 로 묶인다는 점을 알고 있어야 한다. 시그니처 변경은 아니고, 현재 호출자에게 영향도 없다.

## 확인되어 문제 없음 (오탐 방지 기록)

- `webhook_endpoint_reservation.workspace_id` `ON DELETE SET NULL` — `trigger` 테이블과는 FK 관계가 없어(예약 테이블은 `workspace` 만 참조), 워크스페이스 삭제 캐스케이드가 트리거 행을 지우는 것과 예약 행을 NULL 처리하는 것은 서로 독립적으로 일어나며 순서 의존성이 없다.
- V133 신규 테이블·인덱스는 `test/deletion-cascade-indexes.e2e-spec.ts` 에 검증 행이 추가돼 FK 인덱스 부재로 인한 삭제 성능 회귀 표면에서 제외된다.
- `webhook-trigger.e2e-spec.ts` B7/B8 은 실제 DB에 워크스페이스·트리거를 생성/삭제하는 비-롤백 e2e 이지만, 같은 파일의 기존 B1~B6 패턴(`registerAndLogin`/`createTeamWorkspace` 조합)과 동일한 관례이며 앱 계층(API)을 통해서만 쓰므로 이 diff 가 새로 도입한 오염 패턴이 아니다.
- 엔티티 등록(`ROOT_ENTITIES`/`REQUIRED_ENTITIES`)은 `synchronize: false` 환경에서 스키마에 영향을 주지 않는다.

## 요약

핵심 부작용(신규 BEFORE INSERT/UPDATE DB 트리거가 `trigger` 테이블 쓰기마다 두 번째 테이블에 개입하는 것)은 이 PR 의 명시적 설계 목표이며, TypeORM 의 diff 기반 `save()` 동작과 `triggerRepository.update()` 호출부 전수 확인을 통해 오늘 기준으로는 "웹훅 경로 생성·실변경" 경로에만 정확히 국한됨을 확인했다. 마이그레이션의 테이블 잠금·백필 순서, e2e 테스트의 트랜잭션 격리(신규 SQL 가드는 ROLLBACK 보장, 기존 API e2e 는 기존 관례 유지)도 모두 의도된 범위 안에 있다. CRITICAL/WARNING 급 미의도 부작용은 발견하지 못했고, 위에 남긴 INFO 3건은 향후 코드가 이 DB 트리거의 "OF" 컬럼을 실수로 더 자주 건드리게 될 잠재 회귀 지점을 기록해 둔 것이다. 저장소 파일은 뮤테이션하지 않았다(읽기·grep·sed -n 조회만 수행, `git status --short` 로 확인).

## 위험도

LOW
