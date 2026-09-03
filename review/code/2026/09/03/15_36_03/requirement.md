# Requirement Review — `entity-nullable-column-type-mismatch` 배치 1 (3라운드, fix 2건 반영 후)

## 배경

본 diff 는 `null as unknown as X` 이중 캐스트 8건(`User` 7 · `Schedule` 1)을 제거하고 해당
엔티티 필드 타입을 `T | null` 로 넓히는 배치 1 작업과, 재발 방지 가드
(`nullable-type-lie-cast-guard.ts`/`.spec.ts`) 신설, 그리고 두 차례 리뷰(`14_44_15`,
`15_17_01`)에서 지적된 CRITICAL 1건(`@Column({ type: })` 누락 → 부팅 실패) + WARNING 4건
(`null`→`undefined` 회귀 커버리지 공백) + W1(가드 spec 이 프로덕션 파일을 변형)의 fix 커밋
2건(`40fa58b8f`, `52ca3128a`)까지 포함한 최종 상태다.

이번 라운드는 앞선 두 라운드가 이미 소스 확인·jest 실행·뮤테이션 RED 재현으로 검증한 항목을
재검증하지 않고, 그 결과가 실제로 현재 워킹트리 상태와 일치하는지, 그리고 새로 열린 갭이
있는지에 집중했다.

## 독립 확인한 것

- `grep -rn "null as unknown as" codebase/backend/src --include='*.ts' | grep -v spec.ts` →
  매치 3건 전부 `source-scan.ts`/`nullable-type-lie-cast-guard.ts` 의 **주석·정규식 리터럴**뿐,
  실제 프로덕션 캐스트는 **0건**. plan 문서의 "캐스트 8건 제거" 주장과 일치.
- `codebase/backend/src/modules/users/entities/user.entity.ts` 를 직접 `Read` — 4개 컬럼
  (`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`passwordResetToken`)에
  `type: 'varchar'` 가 실제로 붙어 있음을 확인(직전 CRITICAL fix 반영 확인).
- `resetLoginAttempts`(`users.service.ts`)·`update`(`schedules.service.ts`) 구현을 직접 읽고
  신규 테스트(`users-login-attempts.service.spec.ts:128-144`,
  `schedules.service.spec.ts:326-359`)의 mock 경로·단언이 실제 구현 분기(`userRepository.update`
  호출, `computeNextRuns` destructure→`nextRun ? new Date(nextRun) : null`)와 정확히 일치함을
  대조 확인.
- `totp.service.spec.ts:114-122` 의 기존 `disable` 테스트가 `toHaveBeenCalledWith` 로 전체 patch
  객체를 비교하므로 `twoFactorSecret: undefined` 회귀도 이미 잡는다는 이전 라운드 주장을 재확인
  (Jest `toEqual`/`toHaveBeenCalledWith` 는 `undefined` 값과 `null` 값을 구분한다).
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 를 전체 Read — `15_17_01` W1 에서
  지적된 "추적된다고 썼는데 이름이 없다" 문제(`Schedule.lastRunAt` 비대칭,
  `auth.service.spec.ts:58` 낡은 캐스트)가 이번 fix 커밋(`52ca3128a`)에서 "할 일" §배치 2 후보
  (d)·(e)로 **실제로 이름과 함께** 등재됐음을 확인 — 재발 없음.

## Spec fidelity (점검 관점 9)

- `spec/1-data-model.md` §2.1(User)의 `password_hash`·`email_verify_token`·
  `email_verify_expires_at`·`password_reset_token`·`password_reset_expires_at`·`locked_until`·
  `two_factor_secret` 은 이미 전부 `String?`/`Timestamp?` 로 nullable 선언돼 있다 — 이번 타입
  확장(`User` 7필드)은 spec 과의 **기존 불일치를 해소**하는 방향이라 충돌 없음.
- `spec/1-data-model.md` §2.9(Schedule) `next_run_at | Timestamp`(물음표 없음, 이 문서의 명시적
  표기 관례상 non-nullable — 바로 아래 `last_run_at | Timestamp?` 와 대조됨)와, 이번 diff 가
  `Schedule.nextRunAt: Date | null` 로 nullable 을 코드·테스트로 **공식 고정**한 것 사이에 실제
  불일치가 있다. 직접 대조해 확인했다: `git log -p -- codebase/backend/src/modules/schedules/entities/schedule.entity.ts`
  기준 `@Column({ nullable: true })` 자체는 이 PR 이전부터 있었고, cron 파싱 실패 시 `null` 대입
  로직(`schedule-runner.service.ts` catch 분기, `schedules.service.ts::update`)도 이 PR 이전부터
  존재했다 — **이 PR 이 그 동작을 새로 만든 것이 아니라, 타입 표기만 그 실제 동작에 맞춰 정직하게
  넓혔다.**
  - 판정: **[SPEC-DRIFT]**(코드가 맞고 spec 이 낡음) — DB·backend 런타임·frontend
    (`nextRunAt?: string`, optional)전 스택이 이미 nullable 로 취급하고 있었는데
    `spec/1-data-model.md` §2.9 만 그 사실을 반영하지 않고 있었다.
  - 이미 올바르게 처리됨: `plan/in-progress/entity-nullable-column-type-mismatch.md` "## 할 일"
    §151-158 에 "**후속(planner 턴) — `spec/1-data-model.md` §2.9 `next_run_at` 표기 정정**"
    항목이 정확한 대상(`:260` 행, `Timestamp?` 로 정정)과 함께 등재돼 있고, "developer 권한
    밖"(자기-반증형 소정정 예외 미해당 — developer 가 그 문장을 쓴 게 아니고 제품 데이터 모델은
    예외 대상이 아님)이라 planner 턴으로 명시적으로 위임했다. `review/consistency/2026/09/03/15_17_03/cross_spec.md`
    가 동일 항목을 WARNING 으로 이미 지적했고 plan 이 그 지적을 정확히 반영해 등재를 마쳤다 —
    **새로 조치할 것이 없다.** (본 reviewer 는 spec 을 직접 고치지 않음 — planner 위임 경로 유지)

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` `spec/1-data-model.md` §2.9 `next_run_at` 의 nullable 표기 누락 —
  이미 plan 에 planner 후속 항목으로 정확히 등재되어 신규 조치 불요
  - 위치: `spec/1-data-model.md:260`(`next_run_at | Timestamp`) vs `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158`(할 일 항목)
  - 상세: 위 "Spec fidelity" 절 참고. 코드(`Schedule.nextRunAt: Date | null`)가 옳고 spec 표기가
    낡은 경우이며, 이번 PR 이 이미 그 갭을 인지하고 planner 턴으로 올바르게 위임했다.
  - 제안: 조치 불요(이미 등재됨). planner 세션에서 `spec/1-data-model.md:260` 을 `Timestamp?` 로
    정정하고, 가능하면 `spec/data-flow/10-triggers.md §3.2` 에 cron 파싱 실패 시 NULL 대입 한
    줄을 보강할 것 — plan 문서가 이미 정확히 이 두 가지를 명시했다.

- **[INFO]** 나머지 발견 없음 — 기능 완전성·엣지 케이스·TODO/FIXME·에러 시나리오·데이터
  유효성·비즈니스 로직·반환값 관점에서 신규 결함을 발견하지 못했다.
  - 상세: `null as unknown as X` → `null`/`T | null` 치환은 런타임 무영향(리터럴 `null` 대입 값
    동일)이며 컴파일 타임 타입 표기 정정에 국한된다. 5곳의 "명시 `null` 대입이 `undefined` 로
    회귀하면 안 된다"는 비즈니스 규칙(TypeORM `update()` 의 `undefined`-필드-생략 특성)을 정확히
    이해하고 `toBeNull()`(`toBeFalsy()` 아님) 로 단언하는 신규 테스트 5건이 추가돼 있으며, 실제
    구현 분기와 mock 호출 경로가 전부 일치함을 직접 대조 확인했다. `findUntypedNullableColumns`
    의 관계-컬럼 예외(`@JoinColumn` 이름 일치)는 임의 허용목록이 아니라 대조군 테스트로 양방향
    (면제/비면제)이 고정돼 있다. TODO/FIXME/HACK/XXX 주석은 diff 전체에서 0건.

## 요약

배치 1(캐스트 8건 제거 + 타입 확장 8필드) + fix 2건(CRITICAL: `type:` 누락 4건 · WARNING: 커버리지
공백 5건 + 추적 누락 2건)이 모두 워킹트리에 정확히 반영돼 있음을 grep·Read 로 독립 재확인했고,
신규 테스트의 mock 경로·단언이 실제 구현 분기와 line-level 로 일치한다. 유일한 spec 불일치는
`spec/1-data-model.md` §2.9 `next_run_at` nullable 미표기이며, 이는 코드가 옳고 spec 이 낡은
**SPEC-DRIFT** 로 판정되고 — 이번 PR 이 자체적으로 그 갭을 정확히 식별해 developer 권한 밖임을
인지하고 planner 후속 항목으로 이름과 대상 위치까지 명시해 올바르게 이연했으므로 신규 조치가
필요 없다. CRITICAL/WARNING 급 신규 결함은 발견되지 않았다.

## 위험도

NONE
