# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `User`/`Schedule` 엔티티 nullable 컬럼의 TS 타입을 `T | null` 로 넓히면서, TypeORM `design:type` 리플렉션이 `Object` 로 방출되는 4개 컬럼에 `@Column({ type: 'varchar', ... })` 를 명시적으로 붙여 이전 라운드(`review/code/2026/09/03/14_44_15`)에서 발견된 CRITICAL(`DataTypeNotSupportedError` → 앱 부팅 실패)이 이 diff 자체에 이미 반영되어 있음을 확인했다.
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (게이트 `21-27`(`passwordHash`), `44-50`(`twoFactorSecret`), `80-86`(`emailVerifyToken`), `95-101`(`passwordResetToken`))
  - 상세: `Read` 로 현재 파일 상태를 직접 확인한 결과 4개 컬럼 모두 `type: 'varchar'` 가 붙어 있다. RESOLUTION.md 에 따르면 `information_schema` 로 실제 컬럼 타입(`character varying`)을 실측해 일치시켰다고 기록되어 있어, 스키마 드리프트 없이 ORM 메타데이터만 DB 현실에 맞춘 것으로 보인다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** 이번 변경은 실제 DB 스키마(DDL)를 바꾸지 않는다 — 신규 Flyway 마이그레이션 파일(`migrations/*.sql`)이 포함되어 있지 않고, `app.module.ts:112` 에서 `synchronize: false` 로 고정되어 있어 TypeORM 이 부팅 시 자동으로 컬럼을 변경/생성하지 않는다.
  - 위치: `codebase/backend/src/app.module.ts:112` (미변경, 확인용), `codebase/backend/src/modules/users/entities/user.entity.ts` 전체
  - 상세: 이번 diff 는 TS 필드 타입(`| null` 폭 확장)과 `null as unknown as X` 이중 캐스트 제거에 국한되며, 컬럼의 `nullable: true` 는 이미 존재하던 값을 그대로 두었다. 즉 "무중단 배포 안전성" 관점에서 실질적 DDL lock/데이터 손실 위험이 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 단위 테스트들(`auth.service.spec.ts`, `users-login-attempts.service.spec.ts`, `schedule-runner.service.spec.ts`, `schedules.service.spec.ts`)이 TypeORM `repository.update()` 가 `undefined` 필드를 SET 절에서 **통째로 생략**한다는 사실을 근거로, `null` 을 **명시적으로** 대입하는지(`toBeNull()`)를 정확히 단언한다.
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` (게이트 `922-951`, `1080-1115`), `codebase/backend/src/modules/users/users-login-attempts.service.spec.ts` (게이트 `120-144`), `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts` (게이트 `223-255`), `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (게이트 `319-359`)
  - 상세: `null as unknown as X` 캐스트를 제거하고 `T | null` 로 타입을 넓히는 과정에서 실제 대입값이 `undefined` 로 조용히 회귀하면 "소비된 토큰/잠금이 DB 에 남는" 데이터 정합성 결함이 된다. 이번 테스트들은 그 회귀를 정확히 잡도록 설계되어 있고(`toBeFalsy()` 대신 `toBeNull()`), RESOLUTION.md 에 뮤테이션 검증(RED)까지 기록되어 있다. 데이터베이스 쓰기 정합성 관점에서 바람직한 보강이다.
  - 제안: 조치 불요.

- **[INFO]** 인덱스·N+1·트랜잭션·커넥션 관리·SQL 인젝션·대량 데이터/페이지네이션 관점에서 이번 diff 로 인한 신규 쿼리 패턴, 반복문 내 쿼리, raw SQL, 커넥션 획득/해제 코드는 없다. `auth.service.ts::verifyEmail` 의 `dataSource.transaction(...)` 사용은 기존 패턴을 그대로 유지하며(캐스트만 리터럴 `null` 로 교체), 트랜잭션 경계 변경은 없다.
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` (게이트 `230-235`, `749-754`), `codebase/backend/src/modules/auth/totp.service.ts` (게이트 `121-127`), `codebase/backend/src/modules/schedules/schedule-runner.service.ts` (게이트 `187-192`), `codebase/backend/src/modules/schedules/schedules.service.ts` (게이트 `238-243`), `codebase/backend/src/modules/users/users.service.ts` (게이트 `384-389`)
  - 상세: 모든 변경은 리터럴 `null` 대입과 컬럼 TS 타입 확장에 국한된다. 신규 가드 파일(`nullable-type-lie-cast-guard.ts`, `nullable-type-lie-cast.spec.ts`)도 파일시스템 정적 스캔이며 DB 접근이 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 TypeORM 엔티티의 nullable 컬럼 TS 타입을 실제 DB 제약(`nullable: true`)에 맞게 `T | null` 로 넓히고, 그 과정에서 강제되던 `null as unknown as X` 이중 캐스트를 제거하는 순수 타입 정합화 작업이다. 실제 DDL 변경(마이그레이션 파일)은 없고 `synchronize: false` 로 자동 스키마 변경도 없어 무중단 배포 위험이 없으며, 직전 리뷰 라운드에서 발견된 컬럼 `type:` 누락으로 인한 부팅 실패(CRITICAL)는 이 diff 안에서 이미 `type: 'varchar'` 명시로 해결되어 있음을 `Read` 로 직접 확인했다. 신규 단위 테스트는 TypeORM `update()` 의 `undefined`-필드-생략 특성으로 인한 데이터 잔존(소비된 토큰/잠금 미해제/옛 실행 시각 잔존) 회귀를 정확히 방어하도록 설계되어 데이터 정합성 관점에서도 긍정적이다. 쿼리 구성, 인덱스, N+1, 트랜잭션 경계, 커넥션 관리, SQL 인젝션, 대량 데이터 페이지네이션에 영향을 주는 변경은 없다.

## 위험도

LOW
