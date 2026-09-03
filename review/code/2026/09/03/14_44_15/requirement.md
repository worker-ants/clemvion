# 요구사항(Requirement) 리뷰 — `null as unknown as X` 캐스트 제거 + 엔티티 타입 넓힘 (8건)

## 발견사항

- **[CRITICAL]** `User` 엔티티에서 `string | null` 로 넓힌 4개 컬럼이 `@Column()` 에 `type` 을
  명시하지 않아 **애플리케이션이 부팅하지 못한다** (`DataTypeNotSupportedError`).
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts:21`(`passwordHash`),
    `:39`(`twoFactorSecret`), `:70`(`emailVerifyToken`), `:80`(`passwordResetToken`)
    — 전체 파일 컨텍스트 게이트 기준.
  - 상세: TypeORM 은 `@Column()` 옵션에 `type` 이 없으면 TS 컴파일러가 방출한
    `design:type` reflect-metadata 로 컬럼 타입을 추론한다. TS 필드 타입이 `string` 처럼
    단일 타입이면 `design:type=String` 이 방출되지만, 본 PR 처럼 `string | null` **유니온**으로
    넓히면 TypeScript 는 유니온을 표현할 수 없어 `design:type=Object` 를 방출한다.
    `Column()` 데코레이터 소스(`node_modules/typeorm/decorator/columns/Column.js`)를 보면
    `reflectMetadataType`(=`Object`, truthy)를 그대로 `options.type` 에 대입해 버려서
    `ColumnTypeUndefinedError`(명시적 안내 에러)로도 안 걸리고, 대신 메타데이터 빌드 단계에서
    `ColumnMetadata` 가 `DataTypeNotSupportedError` 를 던진다.

    **실제로 재현했다.** HEAD(`7ce4fa92a`, 이 리뷰가 보는 커밋) 의
    `user.entity.ts` 를 그대로 컴파일해 `DataSource.buildMetadatas()`(=NestJS
    `TypeOrmModule` 이 부팅 시 호출하는 것과 동일 경로)를 호출하면:
    ```
    ERROR building metadata: Data type "Object" in "User.passwordHash" is not
    supported by "postgres" database.
    ```
    즉시 throw 한다. `synchronize:false`(Flyway 가 스키마 SoT, `app.module.ts:112`)라
    스키마 동기화 단계가 아니라 **`DataSource.initialize()` 자체**, 즉 앱 부팅의 가장
    이른 단계에서 죽는다 — 요청 처리 이전에 프로세스가 못 뜬다. `passwordHash` 뿐 아니라
    같은 패턴인 `twoFactorSecret`·`emailVerifyToken`·`passwordResetToken` 도 동일 메커니즘으로
    깨진다(검증기가 첫 위반에서 fail-fast 하므로 로그엔 하나만 찍힌다).

    이 회귀는 **`tsc --noEmit` 도, `jest` 유닛 스위트도, 새로 추가된
    `nullable-type-lie-cast.spec.ts` 가드(8/8 통과 확인함)도 못 잡는다** — 셋 다 타입
    올바름이나 순수 문자열 패턴만 보고, TypeORM 이 런타임에 reflect-metadata 를
    해석하는 방식은 아무도 실행하지 않는다. e2e(실제 `DataSource` 부팅)만 이 클래스를
    본다.

    같은 PR 에서 함께 넓힌 `emailVerifyExpiresAt`·`passwordResetExpiresAt`(User)·
    `lockedUntil`(User)·`nextRunAt`(Schedule) 은 전부 `@Column({ type: 'timestamptz', ... })`
    처럼 **원래부터 명시적 `type` 을 갖고 있어 이 결함에 걸리지 않는다.** 이미 넓혀져 있던
    `pendingEmail`·`emailChangeToken`·`emailChangeExpiresAt` 도 마찬가지로 명시적
    `type: 'varchar'`/`'timestamptz'` 를 갖는 기존 관례를 따르고 있었다 — 즉 저장소엔
    "`| null` 로 넓히면 `type` 도 명시한다" 는 확립된 관례가 이미 있었는데, 이번 배치의
    저 4개 필드만 그 관례를 놓쳤다.
  - 제안: 4개 `@Column()` 에 명시적 `type`(문자열 컬럼이므로 `type: 'varchar'`)을 추가한다.
    **참고**: 이 리뷰 시점에 같은 워크스페이스 트리에 정확히 이 수정(`type: 'varchar'` 4곳
    추가) + 회귀 가드(`findUntypedNullableColumns` — `| null` 컬럼인데 `@Column` 에 `type:`
    이 없는 자리를 정규식으로 잡고, `NodeExecution.parentNodeExecutionId` 처럼 관계가 타입을
    공급해 실제로 안전한 예외까지 반영)가 **미커밋 상태로 이미 존재**하는 것을 관측했다 —
    아래 "관측된 이상 상태" 참조. 그 변경이 커밋되면 본 CRITICAL 은 해소된다.

- **[INFO] 관측된 이상 상태 — 공유 워크트리의 미커밋 변경 (본 리뷰가 만든 것 아님)**
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts`,
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts`
  - 상세: 세 파일 모두 HEAD(`7ce4fa92a`) 대비 **미커밋 diff** 가 이미 존재한 채로 리뷰를
    시작했다(내가 만들지 않았다 — 세션 시작 `git status` 에는 없었고, 파일 read 도중
    확인했다). 내용은 위 CRITICAL 항목과 **정확히 같은 결함**을 겨냥한 수정 +
    회귀 가드로 보인다(가드 주석 자체가 "2026-09-03 에 실제로 그렇게 깨뜨렸다.
    lint·unit·build·tsc 가 전부 통과했고 오직 e2e 만 잡았다" 라고 적고 있어, 이 CRITICAL 이
    다른 경로로도 이미 실측됐음을 시사한다). 병렬 리뷰 규약에 따라 이 파일들을 되돌리거나
    추가로 건드리지 않았다 — `git status --short` 로 확인한 최종 상태는 세션 시작 이후
    내가 관측한 상태와 동일하다(내 프로빙은 전부 `/private/tmp/.../scratchpad` 에서
    수행했고, 재현을 위해 `user.entity.ts` 를 잠시 HEAD 내용으로 바꿔치기했을 때도
    `cp` 로 원래(미커밋 상태 포함) 내용으로 즉시 복원해 diff 가 동일함을 확인했다).
  - 제안: (조치 불필요 — 보고 목적) 위 CRITICAL 의 fix 가 이 미커밋 변경과 충돌하지 않게
    조율할 것.

- **[INFO] spec fidelity — 이 변경 영역은 spec 이 아니라 코드 컨벤션 범위**
  - 상세: 엔티티 TS 타입과 DB `nullable` 의 정합은 `spec/` 문서가 아니라 이 PR 이 스스로
    세우는 컨벤션(및 `plan/in-progress/entity-nullable-column-type-mismatch.md`)의
    범위다. `spec/5-system/1-auth.md` 등 관련 spec 문서를 확인했으나 컬럼 TS 타입 형태에
    대한 명세는 없다 — line-level 불일치 판정 대상 자체가 아니다. `PASSWORD_VERIFY_CODES`
    분기(`auth.service.ts:72-85`, `users.service.ts:287-304`)·2FA 비활성화 흐름
    (`totp.service.ts:121-127`)·비밀번호 재설정 흐름(`auth.service.ts:728-761`) 은 이번
    diff 로 **캐스트 표현만** 바뀌었고 분기·에러 코드·상태 전이는 전부 그대로다 — 별도
    spec 불일치 없음.

- **[INFO] `nullable-type-lie-cast.spec.ts` 자기 참조 안전성 확인**
  - 상세: `collectScanTargets()` 가 스캔하는 `src` 트리에는 술어 정의 파일
    `common/__test-utils__/source-scan.ts` 자신과 가드 파일
    `repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 도 포함된다(`*.spec.ts` 만
    제외하므로). 두 파일 모두 정규식 리터럴 소스 안에 `null as unknown as` 문자열을
    담고 있어 자기 자신을 오탐할 위험이 있어 보였으나, 실제로 `node` 로
    `countNullAsUnknownAsCasts(fs.readFileSync('source-scan.ts'))` 를 실행해 **0** 을
    확인했다 — 정규식 리터럴 앞의 `\b`(백슬래시+`b`) 문자가 스캔 정규식의 `\bnull` word
    boundary 를 막아 우연히 안전하다. 실제 위반은 아니지만 **깨지기 쉬운 우연**이다(예:
    누군가 그 정규식을 `new RegExp('null as unknown as', ...)` 문자열 방식으로 바꾸면
    자기 파일이 offender 로 잡혀 가드 스스로가 RED 가 된다). `npx jest
    src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 로 8/8 통과를 직접 확인했다.

- **[INFO] `null as unknown as` 잔존 여부 전수 확인**
  - 상세: `grep -rn "null as unknown as" codebase/backend/src --include="*.ts" | grep -v
    spec` 로 전수 확인한 결과, 남은 매치는 술어 정의(`source-scan.ts`)와 가드 헤더
    주석(`nullable-type-lie-cast-guard.ts` 의 `//` 주석) 뿐이었다 — 실제 프로덕션
    캐스트는 0건. plan 문서의 "8건 전부 제거" 주장과 실측이 일치한다.

## 요약

캐스트 제거·타입 넓힘 자체(비즈니스 로직·에러 코드·반환값 경로)는 8건 전부 정확하고
`tsc`/신규 가드 유닛 테스트는 그린이지만, `User` 엔티티의 4개 필드(`passwordHash`·
`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)를 `string | null` 로 넓히면서
`@Column()` 에 `type` 을 명시하지 않아, TypeORM 의 `design:type` 유니온 처리 한계로
`DataSource.initialize()` 가 `DataTypeNotSupportedError` 로 죽는다 — **실제로 재현했다**.
이는 컴파일 타임 타입 검사·유닛 테스트·신규 가드 어느 것도 못 잡는 순수 런타임 결함이라 이
PR 이 커밋된 상태(HEAD `7ce4fa92a`)로는 백엔드가 부팅조차 못 한다. 다만 리뷰 중 관측한
공유 워크트리의 미커밋 변경이 정확히 이 결함을 겨냥한 수정 + 회귀 가드로 보여, 다른 경로에서
이미 같은 문제가 실측·처방되고 있을 가능성이 높다 — 커밋 대상에는 포함되지 않았으므로 이
리뷰의 CRITICAL 로 계속 등재한다.

## 위험도

CRITICAL
