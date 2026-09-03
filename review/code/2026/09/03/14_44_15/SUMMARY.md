# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — `User` 엔티티에서 `string | null` 로 넓힌 4개 컬럼(`passwordHash`·`twoFactorSecret`·
`emailVerifyToken`·`passwordResetToken`)이 `@Column()` 에 `type` 을 명시하지 않아, TypeORM 이
유니언 타입의 `design:type` 리플렉션을 `Object` 로 방출하고 그 결과 `DataSource.initialize()` 가
`DataTypeNotSupportedError` 로 죽는다 — **앱이 부팅 자체를 못 한다.** `requirement`·`testing` 두
reviewer 가 각각 독립적으로 재현/실측했다(unit 테스트는 리포지토리를 mock 하므로 구조적으로 이
결함을 못 보고, e2e 만이 유일한 방어선이었다는 증거가 같은 워크트리의 미커밋 변경 주석에 남아
있다). 이 diff 만으로는 프로덕션 배포가 불가능하다.

**참고**: forced whitelist(router_safety) 7명 전원 결과가 확보되어 있고 누락된 reviewer 는 없다 —
위 CRITICAL 은 "결과 미확보로 인한 거짓 음성"이 아니라 확보된 결과 안에서 실제로 발견된 것이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, testing | `User` 엔티티의 nullable 문자열 컬럼 4개(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)를 `T \| null` 로 넓히면서 `@Column()` 에 `type` 을 명시하지 않음 → TS 유니언은 `design:type` 리플렉션으로 표현 불가해 `Object` 로 방출되고, TypeORM 이 이를 그대로 컬럼 타입에 대입해 `DataSource.initialize()` 단계(=앱 부팅 최초 단계)에서 `DataTypeNotSupportedError` 로 즉시 throw. 두 reviewer 가 각각 `DataSource.buildMetadatas()` 직접 호출 재현 / 같은 워크트리 미커밋 가드 주석("2026-09-03 에 실제로 그렇게 깨뜨렸다. lint·unit·build·tsc 전부 통과, e2e 만 잡음")으로 확인. 함께 넓힌 나머지 필드(`emailVerifyExpiresAt`·`passwordResetExpiresAt`·`lockedUntil`·`Schedule.nextRunAt`)는 원래부터 `type: 'timestamptz'` 를 명시하고 있어 이 결함에 걸리지 않음 — 저장소에 이미 있던 "`\| null` 로 넓히면 `type` 도 명시" 관례를 이 4개 필드만 놓침 | `codebase/backend/src/modules/users/entities/user.entity.ts:21`(`passwordHash`), `:39`(`twoFactorSecret`), `:70`(`emailVerifyToken`), `:80`(`passwordResetToken`) | 4개 컬럼에 `type: 'varchar'` 명시. 신규 가드(`nullable-type-lie-cast.spec.ts`)는 캐스트 잔존만 검사하고 이 결함 클래스는 검사하지 않으므로, `type` 누락을 잡는 별도 가드(`findUntypedNullableColumns` 류)도 함께 필요. 참고로 같은 워크트리에 정확히 이 두 수정을 담은 미커밋 변경이 이미 관측됨 — 이번 배치 커밋에 흡수하거나 같은 PR 사이클 안에서 별도 커밋으로 병합할 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security, side_effect, testing | 신규 가드 spec 의 대조군 테스트가 **실제 프로덕션 소스 파일**(`users.service.ts`)을 `fs.writeFileSync` 로 변형했다가 `finally` 에서 복원함 — 같은 디렉터리의 형제 가드 3개(`masked-reject-callers.spec.ts` 등)는 전부 `os.tmpdir()`/`mkdtempSync` 기반 합성 fixture 를 써서 저장소 파일에 손대지 않는 관례를 따름. `try/finally`+사후 재확인 단언으로 일반 실패 경로는 안전하지만, 프로세스 강제 종료나 복원용 `writeFileSync` 자체의 실패(디스크 풀·권한 등) 시 실제 서비스 파일이 변조된 채 워킹트리에 영구히 남을 수 있음. watch 모드에서는 무관한 스펙 재실행 노이즈도 유발 가능 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:84-99` | `masked-reject-callers.spec.ts` 와 동일하게 `os.tmpdir()` 에 `null as unknown as X` 한 줄만 담은 합성 fixture 파일을 만들어 `findCastOffenders([tmpFile])` 를 호출하도록 변경. 실제 `users.service.ts` 를 빌릴 필요 없음 |
| 2 | testing | 이 diff 가 직접 건드린 `auth.service.ts::verifyEmail`/`resetPassword` 의 null 대입 경로가 정확한 호출 인자로 검증되지 않음 — `verifyEmail` 테스트는 트랜잭션 호출 여부만 확인하고 `update()` 인자(`{emailVerifyToken: null, ...}`)는 미단언, `resetPassword` 는 **성공 경로 테스트 자체가 없음**(실패 경로만 존재). TypeORM `update()` 는 `undefined` 필드를 SET 절에서 통째로 생략하므로(`null` 과 의미가 다름), 향후 `null` 대신 `undefined` 로 회귀해도 못 잡음. 반대로 같은 diff 의 `totp.service.ts::disable()` 은 `totp.service.spec.ts` 가 정확한 인자를 단언하는 올바른 패턴을 보임 | `codebase/backend/src/modules/auth/auth.service.spec.ts:1028-1047`(`verifyEmail`), `:902-921`(`resetPassword`) | `verifyEmail` 성공 테스트에 `update` 호출 인자 단언 추가, `resetPassword` 성공 경로 테스트 신설 — `totp.service.spec.ts` 와 동일 수준으로 |
| 3 | testing | 이 diff 가 건드린 `UsersService.resetLoginAttempts`(`lockedUntil: null`)가 백엔드 스펙 전체에서 직접 테스트되지 않음 — `isLocked()` 의 잠금 자동 해제 분기에서도 호출되는 보안 관련 경로인데 `resetLoginAttempts`/`isLocked` 를 직접 부르는 테스트가 전무(`AuthService.login` 이 호출했는지 spy 확인만 존재) | `codebase/backend/src/modules/users/users.service.ts:384-389` | `users-login-attempts.service.spec.ts` 에 `resetLoginAttempts`(+ `isLocked` 만료 분기)의 정확한 update 인자를 단언하는 테스트 추가 |
| 4 | testing | 이 diff 가 정확히 건드린 `nextRunAt = null` 두 분기가 각 spec 에서 실행되지 않음 — `schedules.service.spec.ts` 의 `update()` 테스트는 `cronExpression`/`timezone` 을 바꾸는 케이스가 없어 241행 분기 미도달, `schedule-runner.service.spec.ts` 는 `CronExpressionParser.parse` 가 throw 하는 케이스가 없어 190행 catch 분기(=`nextRunAt = null`) 미도달 | `codebase/backend/src/modules/schedules/schedules.service.ts:241`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts:190` | `schedules.service.spec.ts` 에 cron/timezone 변경 시 재계산 테스트, `schedule-runner.service.spec.ts` 에 무효 cron → `nextRunAt: null` 테스트 추가 |
| 5 | maintainability | `repo-guards/__tests__/` 안에서 디렉터리를 재귀 스캔해 `.ts` 파일을 모으는 `walk` 류 로직이 이번 PR 로 5번째 사본(`collectScanTargets`)이 생김 — `source-scan.ts` 자신의 docstring 은 "세는 로직은 한 곳에 모은다" 원칙을 명시하면서도 "모으는(walk)" 축에는 같은 원칙을 적용하지 않음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:29-41` | `(root, {excludeSpec, excludeDirs})` 같은 옵션을 받는 공용 walker 를 뽑아 형제 guard 들과 공유. 이 PR 범위를 넘으면 최소 후속 항목으로 plan 에 기록 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, scope, testing | 리뷰 진행 중 같은 워크트리에서 `user.entity.ts` + 신규 가드 2파일 + plan 문서에 **미커밋 변경**이 관측됨(리뷰 대상 diff 밖) — 내용은 정확히 위 CRITICAL(4개 컬럼 `type` 누락)을 겨냥한 수정(`type: 'varchar'` 4곳 추가) + `findUntypedNullableColumns` 회귀 가드로 보임. 병렬 리뷰 규약에 따라 아무도 이 파일을 되돌리거나 추가로 건드리지 않았고, 등급 판정에도 반영하지 않음 — 사실만 보고 | `user.entity.ts`, `nullable-type-lie-cast-guard.ts`, `nullable-type-lie-cast.spec.ts`, `plan/in-progress/entity-nullable-column-type-mismatch.md` | CRITICAL fix 를 커밋할 때 이 미커밋 변경과 충돌하지 않도록 조율 |
| 2 | requirement | 이 변경 영역(엔티티 TS 타입 vs DB nullable 정합)은 `spec/` 문서가 아니라 이 PR 이 스스로 세우는 코드 컨벤션 범위 — spec 불일치 판정 대상 아님. 분기·에러 코드·상태 전이는 캐스트 표현만 바뀌었을 뿐 전부 그대로 | 해당 없음 | 조치 불요 |
| 3 | requirement | `nullable-type-lie-cast.spec.ts` 가 스캔하는 대상에 술어 정의 파일 자신(`source-scan.ts`)과 가드 파일 자신이 포함되나, 정규식 리터럴의 `\b` 문자 덕에 우연히 자기 오탐이 없음(실측 0건) — 정규식 표현 방식이 문자열 방식으로 바뀌면 깨지기 쉬운 우연 | `common/__test-utils__/source-scan.ts`, `nullable-type-lie-cast-guard.ts` | 향후 정규식 리팩터 시 자기참조 주의 |
| 4 | scope | 신규 회귀 가드 2파일은 "캐스트 제거" 라는 핵심 범위를 넘는 부가 산출물이지만, plan 문서에 명시적 근거가 있고 저장소의 기존 guard+spec 관례를 그대로 따름 — over-engineering 으로 보기엔 근거가 탄탄해 INFO 로 낮춤 | `nullable-type-lie-cast-guard.ts`, `nullable-type-lie-cast.spec.ts` | 배치 2/3 에는 가드 재생성이 불필요함(`countNullAsUnknownAsCasts` 가 이미 범용)을 plan 문서에서 확인 권장 |
| 5 | scope | `schedules.service.ts` 의 3줄 대입문이 캐스트 제거 결과 prettier 에 의해 1줄로 축약 — 포맷팅 변경이 실질 변경(캐스트 제거)과 한 hunk 에 섞임 | `codebase/backend/src/modules/schedules/schedules.service.ts:241` | 조치 불요 |
| 6 | maintainability | `source-scan.ts` 에 신규 함수 쌍(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`)이 기존 `countRawUpdateReturning`/`hasRawUpdateReturning` 페어링 사이에 끼어들어 인접성이 깨짐(33줄 스크롤 필요) | `codebase/backend/src/common/__test-utils__/source-scan.ts:135-172` | 신규 함수 쌍은 파일 끝에 추가 권장 |
| 7 | maintainability | 같은 guard 디렉터리 안에서 "스캔 루트를 어떻게 받는가" 관례가 파일마다 다름(`SRC_ROOT` 상수 디폴트 vs 파라미터+별도 상수 조합) | `nullable-type-lie-cast-guard.ts:16` | 공용 walker 추출 시 루트 계산 관례도 함께 통일 |
| 8 | maintainability | `schedule.entity.ts` 의 `lastRunAt`(nullable 이지만 미확장)과 `nextRunAt`(확장)이 나란히 있어 비대칭 — plan 문서에 배치 2 후보로 추적되어 근거는 있으나 파일 자체엔 포인터 없음 | `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:44-45` | 엔티티 파일에 "나머지는 배치 2 대기 — plan 문서 참조" 한 줄 포인터 추가 고려 |
| 9 | testing | `countNullAsUnknownAsCasts` 는 형제 함수(`countRawUpdateReturning`)와 달리 "이 축이 안 보는 것" 한계 서술이 없음(문자열 리터럴 내 우연 매칭 가능성 등) | `codebase/backend/src/common/__test-utils__/source-scan.ts:158-163` | 우선순위 낮음(오탐 방향이 안전 쪽). 여유 있으면 blind spot 한 줄 명시 |
| 10 | testing | `findCastOffenders` 는 단일 offender 파일로만 테스트됨 — 여러 파일 동시 위반(배열 aggregation) 케이스 미검증 | `nullable-type-lie-cast.spec.ts:84-98` | 낮은 우선순위, 실사용 시나리오 희소 |
| 11 | documentation | 가드 docstring 의 "spec fixture 캐스트 12건 전부 정당하다" 주장이 같은 PR 의 `lockedUntil` 타입 확장으로 1건(`auth.service.spec.ts:58`) 낡음 — `mockUser: Partial<User>` 이므로 이제 캐스트 없이 `lockedUntil: null` 만으로 타입체크 통과 가능. 나머지 11건은 여전히 정당 | `nullable-type-lie-cast-guard.ts:27`, `auth.service.spec.ts:58` | 해당 캐스트 정리 또는 docstring 에 "일부는 이번 배치로 이미 불필요해졌을 수 있다" 각주 추가 |
| 12 | documentation | 이번 배치(타입 확장 8건 + 회귀 가드 신설)가 CHANGELOG 에 미반영 — 유사 선례(`Execution.error` nullable 정정)는 기록됨. 순수 내부 타입 정합화라 저장소 관례상 필수는 아님 | `plan/in-progress/entity-nullable-column-type-mismatch.md:71` | 필수 아님. 별도 PR 이면 한두 줄 기록 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | CRITICAL | User 엔티티 4컬럼 `type` 누락 → 앱 부팅 실패, 실측 재현 |
| testing | CRITICAL | 동일 부팅 실패 결함 독립 재확인 + null 분기 다수 미검증(WARNING 4건) |
| side_effect | MEDIUM | 가드 spec 이 프로덕션 소스 파일 직접 변조(WARNING) |
| maintainability | LOW | `walk` 로직 5번째 중복(WARNING), 경미한 구조 정돈 여지(INFO 3건) |
| documentation | LOW | 문서 품질 높음, docstring 수치 1건 경미하게 낡음(INFO) |
| scope | LOW | 배치 범위가 plan 문서와 필드 수·캐스트 수·파일 목록 정확히 일치, 무관한 변경 없음 |
| security | NONE | 보안 영향 없는 순수 타입 리팩터(INFO 1건, side_effect/testing 과 중복 지적) |

## 발견 없는 에이전트

없음 — 7개 에이전트 전원 최소 1건 이상(INFO 이상) 발견을 보고했다.

## 권장 조치사항

1. **(최우선, CRITICAL)** `User` 엔티티의 `passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken` 4개 컬럼 `@Column()` 에 `type: 'varchar'` 명시 — 앱 부팅 실패를 막는다. 같은 워크트리에 이미 존재하는 미커밋 수정을 이번 배치 커밋에 흡수할 것.
2. `type` 누락 클래스를 잡는 회귀 가드(`findUntypedNullableColumns` 류) 추가 — 현재 신설된 `nullable-type-lie-cast.spec.ts` 는 캐스트 잔존만 검사하고 이 결함 클래스는 못 본다.
3. 신규 가드 spec 의 대조군 테스트를 `os.tmpdir()` 기반 합성 fixture 로 전환 — 프로덕션 소스 파일(`users.service.ts`) 직접 변조 제거.
4. `auth.service.ts::verifyEmail`/`resetPassword` 성공 경로에 정확한 null 인자 단언(및 `resetPassword` 성공 테스트 신설) 추가.
5. `resetLoginAttempts`, `schedules.service.ts`/`schedule-runner.service.ts` 의 `nextRunAt = null` 분기에 대한 단위 테스트 추가.
6. `walk`/`collectScanTargets` 류 재귀 스캔 로직을 공용 헬퍼로 추출(후속 항목으로 plan 기록 가능).
7. (낮은 우선순위) 가드 docstring 수치·CHANGELOG 반영 등 문서 정밀도 보완.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — 즉 실행된 전원이 강제 화이트리스트에 속함, forced 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 산출(prompt 에 개별 사유 미제공) — diff 성격(순수 타입 표기 정리)상 성능 영향 낮음으로 판단된 것으로 추정 |
  | architecture | 라우터 산출(prompt 에 개별 사유 미제공) — 구조적 재설계 없는 필드 타입 정합화라 관련도 낮음으로 판단된 것으로 추정 |
  | database | 라우터 산출(prompt 에 개별 사유 미제공) — 스키마 변경 없음(TS 타입만 변경, `synchronize:false`)이라 관련도 낮음으로 판단된 것으로 추정 |
  | concurrency | 라우터 산출(prompt 에 개별 사유 미제공) — 동시성 관련 로직 변경 없음으로 판단된 것으로 추정 |
  | api_contract | 라우터 산출(prompt 에 개별 사유 미제공) — wire 응답 DTO(`schedule-response.dto.ts` 등)는 이미 nullable 선언되어 있어 API 계약 변경 없음으로 판단된 것으로 추정 |