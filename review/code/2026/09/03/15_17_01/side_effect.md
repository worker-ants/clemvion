# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 이전 라운드(WARNING, `review/code/2026/09/03/14_44_15/side_effect.md`)에서 지적된 "가드 spec 이 실제 프로덕션 소스 파일(`users.service.ts`)을 `writeFileSync` 로 변형했다 복원한다" 문제는 **이번 diff 시점 코드에서 이미 해소돼 있다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — `withFixture` 헬퍼(파일 컨텍스트 기준 105~114줄)
  - 상세: 현재 파일을 직접 열어 확인한 결과, `withFixture(content, fn)` 은 `fs.mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'))` 로 저장소 밖 임시 디렉터리에 합성 fixture(`probe.entity.ts`)를 쓰고, `try { return fn(file) } finally { fs.rmSync(dir, { recursive: true, force: true }) }` 로 정리한다. 형제 가드(`masked-reject-callers-guard.ts` 등)와 동일한 관례이고, 저장소 내 실제 소스 파일에는 전혀 쓰기가 없다. `findCastOffenders`/`findUntypedNullableColumns` 를 다루는 모든 테스트가 이 헬퍼만 쓴다.
  - 제안: 없음 — 이미 반영됨. (참고: 같은 세션의 `RESOLUTION.md` 가 이 조치를 "W1" 로 기록하고 있고, 실측과 일치한다.)

- **[INFO]** 이전 라운드 CRITICAL(`User` 의 `T \| null` 로 넓힌 4개 컬럼이 `@Column` 에 `type:` 미명시 → `DataTypeNotSupportedError` 로 부팅 실패)도 **이번 diff 시점 코드에서 이미 해소돼 있다**
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` — `passwordHash`(21~27줄), `twoFactorSecret`(44~50줄), `emailVerifyToken`(80~86줄), `passwordResetToken`(95~101줄)
  - 상세: 4개 컬럼 모두 `@Column({ name, type: 'varchar', nullable: true, length: 255 })` 형태로 `type: 'varchar'` 를 명시하고 있음을 파일을 직접 읽어 확인했다. TypeORM 의 `design:type` 리플렉션이 유니언 타입에서 `Object` 를 방출하는 문제를 우회하는 정본 패턴(저장소 관례와 일치)이다.
  - 제안: 없음 — 이미 반영됨.

- **[INFO]** `User`/`Schedule` 엔티티 필드 타입이 `T` → `T \| null` 로 넓혀진 것은 형식상 "인터페이스 변경"(점검 관점 #5)이지만, 이번 diff 범위에서 실측한 결과 부작용으로 이어지는 소비처는 발견되지 않았다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts`(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`emailVerifyExpiresAt`·`passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil`), `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:42`(`nextRunAt`)
  - 상세: `grep -rn` 으로 이 필드들의 저장소 전역 참조를 전수 확인했다 — `sessions.service.ts`·`auth.service.ts`·`auth-configs.service.ts`·`totp.service.ts`·`users.service.ts` 등 모든 읽기 지점이 이미 `if (!user.passwordHash)`/`if (!user.twoFactorSecret)`/`if (!user.lockedUntil)` 형태로 null 을 먼저 검사한 뒤 사용하고 있었다 — 타입만 넓어졌을 뿐 새로 널 체크가 필요해진 무방비 지점은 없었다. 또한 `UsersController.toProfileData()`(`users.controller.ts:87-96`)가 `id`·`email`·`name`·`avatarUrl`·`locale`·`theme` 만 명시적으로 골라 응답을 만들므로, 넓혀진 민감 필드(`passwordHash` 등)가 엔티티 타입 변경만으로 공개 API 응답 계약에 새로 노출되는 경로는 없다.
  - 제안: 없음 — 이미 안전이 확인된 변경. 다만 이 확인은 `codebase/backend/src` 범위에 한정했고, 이 필드들을 소비하는 코드가 이 diff 밖(예: 별도 마이그레이션 스크립트·배치 잡)에 더 있는지는 이번 리뷰에서 전수 확인하지 못했다.

- **[INFO]** `null as unknown as X` → `null` 치환 자체는 런타임 무영향(순수 타입 표기 변경)
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` (`verifyEmail`·`resetPassword` 각 update 호출), `codebase/backend/src/modules/auth/totp.service.ts` (`disable`), `codebase/backend/src/modules/schedules/schedule-runner.service.ts` (catch 분기), `codebase/backend/src/modules/schedules/schedules.service.ts` (`update`), `codebase/backend/src/modules/users/users.service.ts` (`resetLoginAttempts`)
  - 상세: 각 파일을 직접 읽어 확인했다 — 이중 캐스트가 사라진 자리에 남는 값은 여전히 리터럴 `null` 이고, `TypeORM.update()`/`.save()` 에 전달되는 페이로드·트랜잭션 경계·호출 순서 어느 것도 바뀌지 않았다. (TypeORM `update()` 의 `undefined` 생략 vs `null` 명시 문제는 이 diff 가 만든 게 아니라 원래부터 있던 계약이고, 이번 캐스트 제거로 그 값이 바뀌는 것도 아니다 — 이 값이 실제로 `null` 로 도달하는지 검증하는 테스트 커버리지 문제는 requirement/testing 리뷰 영역이라 여기서는 다루지 않는다.)
  - 제안: 없음.

- **[INFO]** 신규 export 함수(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`/`collectScanTargets`/`findCastOffenders`/`findUntypedNullableColumns`)는 순수 읽기 전용이며 기존 심벌의 시그니처를 바꾸지 않는다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:158-168`(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:29-122`(`collectScanTargets`/`findCastOffenders`/`findUntypedNullableColumns`)
  - 상세: 두 파일 모두 정규식 매칭과 `fs.readdirSync`/`fs.readFileSync` 만 수행하고 어떤 파일도 쓰지 않는다(직접 읽어 확인). `collectScanTargets` 가 `src` 를 재귀적으로 스캔할 때 `node_modules`/`dist` 폴더가 그 아래 존재하지 않음을 확인했다(`find` 실측 — 0건이므로 우연히 과대스캔 리스크 없음). 새 전역 변수·환경 변수 읽기/쓰기·네트워크 호출은 없고, 기존 export 함수(`countRawUpdateReturning` 등)의 시그니처도 그대로다.
  - 제안: 없음. (walker 중복 문제는 maintainability 영역의 WARNING 으로 이미 별도 보고돼 있어 여기서는 부작용으로 취급하지 않는다.)

- **[INFO]** 신규 리뷰 산출물 11개 파일(`review/code/2026/09/03/14_44_15/*`)이 이번 diff 로 저장소에 추가됨 — 예상된 파일시스템 부작용
  - 위치: `review/code/2026/09/03/14_44_15/RESOLUTION.md`·`SUMMARY.md`·`_retry_state.json`·`meta.json`·`documentation.md`·`maintainability.md`·`requirement.md`·`scope.md`·`security.md`·`side_effect.md`·`testing.md`
  - 상세: 이 저장소의 `CLAUDE.md` 가 명시한 "코드 리뷰 산출물 저장 위치"(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`) 관례와 정확히 일치하는 위치·이름이다. 예상치 못한 파일 생성이 아니라 harness 가 의도적으로 남기는 산출물이다.
  - 제안: 없음.

## 요약

이번 diff 는 `null as unknown as X` 이중 캐스트 제거(런타임 무영향, 순수 타입 표기 정리)와 그에 따른 `User`/`Schedule` 엔티티 필드의 `T → T | null` 확장(형식상 인터페이스 변경이지만 저장소 전역 소비처를 전수 확인한 결과 무방비 널 역참조 지점은 없었고, 공개 API 응답도 명시적 화이트리스트 매핑을 거쳐 영향 없음)으로 구성된다. 직전 라운드 리뷰가 지적한 두 항목 — CRITICAL(엔티티 `type:` 누락으로 인한 부팅 실패)과 WARNING(가드 spec 의 실제 프로덕션 파일 `writeFileSync` 변형) — 은 이번 diff 시점의 실제 파일을 직접 읽어 확인한 결과 둘 다 이미 해소돼 있다: 4개 컬럼에 `type: 'varchar'` 가 명시돼 있고, 가드 spec 은 `os.tmpdir()` 기반 합성 fixture 로 완전히 전환돼 저장소 파일에 쓰기가 없다. 신규 export 함수는 전부 순수 읽기 전용이고, 새 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 변경은 없다. 새로 추가된 리뷰 산출물 파일들은 저장소 관례에 부합하는 예상된 파일시스템 변경이다. 부작용 관점에서 신규로 제기할 CRITICAL/WARNING 은 없다.

## 위험도

NONE
