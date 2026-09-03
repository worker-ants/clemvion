# 부작용(Side Effect) 리뷰

## 검토 방법

이번 diff(`entity-nullable-column-type-mismatch` 배치 1 + 그 배치를 다룬 리뷰 라운드
`14_44_15`·`15_17_01`·consistency 라운드 `15_17_03` 산출물 포함, 총 46개 파일)는 이미 같은
worktree 안에서 side_effect 관점으로 **두 차례**(`review/code/2026/09/03/14_44_15/side_effect.md`
WARNING·`review/code/2026/09/03/15_17_01/side_effect.md` INFO-only) 리뷰됐다. 이번 라운드는 그
두 라운드가 낸 결론을 워킹트리 실물(`Read`/`grep`, 저장소 변경 없음)로 재검증하고, 기존 두 라운드가
놓쳤을 수 있는 새 부작용을 독립적으로 찾는 데 집중했다.

- `nullable-type-lie-cast.spec.ts` 전문을 직접 읽어 W1(프로덕션 파일 `writeFileSync` 변형) 수정이
  실제로 반영돼 있는지 확인.
- `user.entity.ts` 전체 컬럼 데코레이터를 grep 해 CRITICAL(4개 컬럼 `type:` 누락 → 부팅 실패) 수정이
  실제로 반영돼 있는지 확인.
- `passwordHash`(민감 필드 대표 샘플)의 저장소 전역 소비처를 grep 해 `T → T | null` 인터페이스 확장이
  무방비 non-null 가정 지점을 남기지 않았는지 재검증.
- `git status --short` 로 이번 검토가 워킹트리를 변경하지 않았음을 확인(clean, 신규 리뷰 세션
  디렉터리만 존재).

## 발견사항

- **[INFO]** 1R(`14_44_15`)이 WARNING 으로 지적한 "가드 spec 이 실제 프로덕션 소스 파일
  (`users.service.ts`)을 `writeFileSync` 로 변형했다 복원한다" 는 이번 diff 시점 코드에서
  **완전히 해소**되어 있음을 직접 재확인했다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:105-114`
    (`withFixture` 헬퍼)
  - 상세: 파일을 직접 열어 확인한 결과 `withFixture(content, fn)` 는 `fs.mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'))` 로 저장소 **밖** 임시 디렉터리에 `probe.entity.ts` 를 쓰고, `try { return fn(file) } finally { fs.rmSync(dir, { recursive: true, force: true }) }` 로 정리한다. `[대조군]` 하위 테스트 5개(캐스트 offender·type 누락·여러 줄 데코레이터·JoinColumn 예외 경계)가 전부 이 헬퍼만 쓰고, 저장소 내 실제 소스 파일에는 어떤 쓰기 경로도 남아 있지 않다. 형제 가드(`masked-reject-callers-guard.ts` 등)와 동일한 관례로 전환됐다.
  - 제안: 없음 — 이미 반영·검증 완료.

- **[INFO]** 1R CRITICAL(`User` 4개 컬럼이 `@Column` 에 `type:` 미명시 → `T | null` 로 넓혀진 순간 TypeORM `design:type` 이 `Object` 를 방출해 `DataSource.initialize()` 가 `DataTypeNotSupportedError` 로 죽는다)도 이번 diff 시점 코드에서 **해소**되어 있음을 직접 재확인했다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken` 각 `@Column` 블록)
  - 상세: `grep -n "type:|nullable|@Column"` 로 전체 컬럼 데코레이터를 나열해 확인한 결과, `| null` 로 넓혀진 8개 필드(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`emailVerifyExpiresAt`·`passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil`·`Schedule.nextRunAt`) 전부 `type: 'varchar'`/`'timestamptz'` 를 명시하고 있다. 부팅을 깨뜨렸던 클래스의 재발은 코드 레벨에서 막혀 있다.
  - 제안: 없음 — 이미 반영·검증 완료.

- **[INFO]** `User` 필드 타입 확장(`T` → `T | null`)은 형식상 인터페이스 변경(점검 관점 #5)이지만, 대표 민감 필드(`passwordHash`)의 저장소 전역 소비처를 독립적으로 재확인한 결과 무방비 non-null 가정 지점은 없다
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts:73,79,324,339`, `codebase/backend/src/modules/auth/sessions.service.ts:255,267`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:310,316`, `codebase/backend/src/modules/users/users.service.ts:287,298`
  - 상세: 이 필드를 읽는 모든 지점이 `if (!user.passwordHash)` 류의 null 체크를 먼저 수행한 뒤에만 값을 쓰고 있었다(예: `sessions.service.ts:267` 의 `user.passwordHash!` 도 바로 위 255줄의 `hasPassword` 가드 뒤에서만 실행된다). 이는 앞선 두 라운드(특히 `15_17_01/side_effect.md`)가 이미 확인한 것과 같은 결론이며, 오늘 이 리뷰에서 별도로 재현했다. `dashboard.service.ts`/`executions.service.ts` 는 애초에 이 필드를 select 하지 않는다는 주석까지 있어 노출 표면이 좁다.
  - 제안: 없음 — 이미 안전이 확인됨.

- **[INFO]** `null as unknown as X` → `null` 치환 자체와 신규 export 함수(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`/`collectScanTargets`/`findCastOffenders`/`findUntypedNullableColumns`)는 순수 읽기 전용이며 런타임 무영향 — 새 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 변경이 없다
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts:233-234,752-753`, `totp.service.ts:124`, `schedule-runner.service.ts:190`, `schedules.service.ts:241`, `users.service.ts:387`, `codebase/backend/src/common/__test-utils__/source-scan.ts:158-168`, `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 전체
  - 상세: 캐스트 제거 6곳 모두 대입값이 리터럴 `null` 그대로이고 `update()`/`save()` 페이로드·트랜잭션 경계·호출 순서 어느 것도 바뀌지 않았다. 신규 함수들은 `fs.readdirSync`/`fs.readFileSync` 와 정규식 매칭만 하며 어떤 파일도 쓰지 않는다(직접 확인). 기존 심벌(`countRawUpdateReturning` 등)의 시그니처도 그대로다.
  - 제안: 없음.

- **[INFO]** 신규 리뷰/일관성 검토 산출물 21개 파일(`review/code/2026/09/03/14_44_15/*`, `review/code/2026/09/03/15_17_01/*`, `review/consistency/2026/09/03/15_17_03/*`)이 저장소에 추가됨 — 예상된 파일시스템 부작용
  - 위치: 위 세 디렉터리 전체
  - 상세: `CLAUDE.md` 가 명시한 저장 위치 관례(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `review/consistency/…`)와 정확히 일치하는 위치·이름이다. 코드 side effect 가 아니라 harness 가 의도적으로 남기는 산출물이며, 프로덕션 코드 경로·런타임과 무관하다.
  - 제안: 없음.

새로 발견된 결함은 없다 — 두 이전 라운드가 지적하고 조치한 항목(W1 프로덕션 파일 변형, CRITICAL 타입 누락)이 이번 diff 시점 코드에 실제로 반영돼 있음을 파일을 직접 열어 재확인했고, 그 외 축(전역 변수·환경 변수·네트워크 호출·시그니처 변경의 소비처 영향·이벤트/콜백)에서 새로운 부작용은 관측되지 않았다.

## 요약

이번 diff(entity-nullable-column-type-mismatch 배치 1, 두 차례 리뷰 라운드의 fix 커밋 포함)를 side-effect 관점에서 재검증한 결과, 1R 이 지적한 두 실질 항목 — 가드 spec 의 프로덕션 소스 파일 직접 변형(WARNING)과 `@Column` `type:` 누락으로 인한 부팅 실패(CRITICAL) — 는 모두 이번 diff 코드에 실제로 반영돼 있음을 파일을 직접 열어 확인했다(가드 spec 은 `os.tmpdir()` 합성 fixture 로 전환, entity 는 `type:` 명시). `User`/`Schedule` 엔티티 필드의 `T → T | null` 인터페이스 확장은 대표 민감 필드(`passwordHash`)의 저장소 전역 소비처를 독립 재확인한 결과 무방비 non-null 가정 지점이 없다. `null as unknown as X` → `null` 치환과 신규 정적 스캔 함수들은 런타임·전역 상태·환경 변수·네트워크·이벤트에 영향이 없는 순수 변경이다. 새로 추가된 21개 리뷰 산출물 파일은 저장소 관례에 부합하는 예상된 파일시스템 부작용이다. 새로운 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

NONE
