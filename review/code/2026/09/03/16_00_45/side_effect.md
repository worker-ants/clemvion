# 부작용(Side Effect) 리뷰

이 diff 는 `claude/entity-nullable-batch1` 브랜치의 4개 커밋(`7ce4fa92a`→`40fa58b8f`→`52ca3128a`→`e78b6dbad`) 누적본이다 — `null as unknown as X` 강제 이중 캐스트 8건 제거 + 엔티티 필드 타입을 `T | null` 로 확장(User 7 · Schedule 1) + 재발 방지 가드 신설 + 3라운드에 걸친 자체 리뷰 라운드의 fix 커밋과 그 산출물(`review/**`, `plan/**`)이 함께 포함돼 있다. 아래는 저장소 밖 오염 여부를 포함해 실제 파일을 직접 `Read`/`grep` 하여 확인한 결과다.

## 발견사항

- **[INFO] (해소 확인) 가드 spec 이 프로덕션 소스 파일을 직접 변형하던 이전 라운드 WARNING이 이 diff 시점에는 이미 해소돼 있다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (`withFixture` 함수, 게이트 105-114행 부근 및 `[대조군]` describe 블록 전체)
  - 상세: 1라운드(`14_44_15`) side_effect 리뷰가 "`fs.writeFileSync` 로 실제 `users.service.ts` 를 변형했다가 복원한다 — 복원 실패 시 서비스 소스가 손상된 채 남을 수 있다"를 MEDIUM 위험으로 지적했었다. 이번 diff 시점 실제 파일을 직접 `Read` 했다 — 현재 `withFixture` 는 `fs.mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'))` 로 저장소 밖 임시 디렉터리를 만들고, 그 안의 합성 파일(`probe.entity.ts`)만 쓰고 `finally` 에서 `fs.rmSync(dir, { recursive: true, force: true })` 로 정리한다. `codebase/backend/src/`, `codebase/backend/src/common/__test-utils__/source-scan.ts`, `nullable-type-lie-cast-guard.ts` 전체를 `grep` 한 결과 `writeFileSync`/`appendFileSync`/`unlinkSync` 등 저장소 파일에 대한 쓰기 호출이 하나도 없음을 확인했다. 형제 가드(`masked-reject-callers.spec.ts`)와 동일한 tmp-fixture 관례로 전환되어, 저장소 파일에 대한 쓰기 위험 자체가 사라졌다.
  - 제안: 조치 불요 — 확인 목적 기재. (극히 사소한 잔여: `mkdtempSync` 성공 후 `writeFileSync` 가 실패하는 극단적 경로에서는 그 tmp 디렉터리가 `finally` 진입 전이라 정리되지 않을 수 있으나, OS `tmpdir()` 바깥이라 저장소에는 영향이 없고 OS 가 결국 정리한다 — 무시 가능한 수준.)

- **[INFO] `User`/`Schedule` 엔티티 필드 타입 시그니처 변경 — 인터페이스 변경이지만 넓히는 방향이고 diff 내에서 전 소비처가 함께 검증됨**
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`emailVerifyExpiresAt`·`passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil`, 각 컬럼 데코레이터 다음 줄), `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:42`(`nextRunAt`)
  - 상세: TypeORM 엔티티의 public 필드 타입이 `T` → `T | null` 로 넓어졌다. 이는 §5(인터페이스 변경) 관점에 해당하고, 이 엔티티들을 소비하는 코드가 저장소 전역에 걸쳐 있다는 점에서 파급 범위가 넓다. 다만 narrow→wide 방향이라 기존 쓰기 코드는 전부 그대로 유효하며, `user.entity.ts` 를 직접 `Read` 해 4개 컬럼(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)에 `type: 'varchar'` 가 실제로 명시돼 있음을 확인했다 — 1R 에서 지적된 CRITICAL(타입 확장만으로 TypeORM `design:type` 리플렉션이 `Object` 를 방출해 `DataSource.initialize()` 가 `DataTypeNotSupportedError` 로 부팅 즉사하던 것)의 fix 가 이 diff 안에 실제로 반영돼 있다. plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`)는 `strictNullChecks=true` 상태에서 `tsc` 직접 실행으로 신규 타입 오류 0건을 실측했다고 기록한다.
  - 제안: 없음 — 이미 검증됨.

- **[INFO] `null as unknown as X` → `null` 치환 자체는 런타임 무영향(타입 전용 변경)**
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts:233-234, 752-753`, `codebase/backend/src/modules/auth/totp.service.ts:124`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts:190`, `codebase/backend/src/modules/schedules/schedules.service.ts:241`, `codebase/backend/src/modules/users/users.service.ts:387`
  - 상세: 이중 캐스트를 제거하고 리터럴 `null` 만 남긴 변경은 컴파일 타임에만 의미가 있고, 런타임에 대입되는 값(`null`)은 이전과 동일하다. DB UPDATE 페이로드·트랜잭션 경계·호출 순서·조건 분기 어느 것도 바뀌지 않았다. 부작용 없음.

- **[INFO] 신규 export 함수(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`/`collectScanTargets`/`findCastOffenders`/`findUntypedNullableColumns`)는 순수 읽기 전용, 새 전역 상태·환경 변수·네트워크 호출 없음**
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:158-168`, `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:16-126`
  - 상세: 정규식 매칭·`fs.readdirSync`/`fs.readFileSync` 만 수행하고 어떤 파일도 쓰지 않는다(직접 `grep` 으로 두 파일 전체를 확인 — write 계열 fs 호출·`process.env` 참조·`require`/동적 import 없음). 기존 심벌(`countRawUpdateReturning` 등)과 마찬가지로 순수 함수이며 시그니처 변경도 없다(전부 신규 추가, 기존 export 시그니처 불변).
  - 제안: 없음.

- **[INFO] 저장소 부수 오염 없음 — 리뷰 세션 중 직접 확인**
  - 위치: 저장소 루트 `git status --short`
  - 상세: 이번 리뷰(읽기 전용 `Read`/`grep`/`git diff`/`git log` 만 수행, 저장소에 아무것도 쓰지 않음) 시점 `git status --short` 결과 자신의 세션 출력 디렉터리(`review/code/2026/09/03/16_00_45/`, 아직 파일 없음) 외에 dirty 한 파일이 없다. 이전 리뷰 라운드(1R)가 관측했던 미커밋 `user.entity.ts` 잔여물은 이후 라운드에서 정식 커밋(`40fa58b8f`)으로 흡수되어 이번 diff 시점에는 남아 있지 않다.
  - 제안: 없음.

## 요약

핵심 부작용 우려였던 "가드 spec 이 실제 프로덕션 소스 파일(`users.service.ts`)을 `writeFileSync` 로 변형했다가 복원한다"(1R WARNING, MEDIUM)는 이 diff 시점에 `os.tmpdir()` 기반 합성 fixture(`withFixture`)로 전환돼 있음을 소스를 직접 읽어 확인했다 — 저장소 파일에 대한 쓰기 자체가 없다. 나머지 변경은 (a) `null as unknown as X` → `null` 리터럴 치환(런타임 완전 동일), (b) 엔티티 필드 타입을 `T` → `T | null` 로 넓히는 인터페이스 변경(narrow→wide, `tsc` 신규 오류 0건 실측 + 부팅 실패를 일으켰던 `@Column({ type: ... })` 누락 4건이 이 diff 안에 이미 수정돼 있음을 직접 확인), (c) 순수 읽기 전용 신규 함수 5개(전역 상태·환경 변수·네트워크 호출·이벤트/콜백 변경 전혀 없음)로 구성된다. 기존 함수 시그니처 변경은 없다(전부 신규 추가). 저장소 트리에 리뷰로 인한 잔여 오염도 없다(`git status --short` 확인).

## 위험도

NONE
