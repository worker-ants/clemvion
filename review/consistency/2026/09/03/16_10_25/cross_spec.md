# Cross-Spec 일관성 검토 — `entity-nullable-column-type-mismatch` (impl-done, scope=`spec/5-system/`)

## 검토 개요

본 diff(14파일/764줄)는 `spec/5-system/` 자체를 변경하지 않는다(scope 델타 0, 정상). 실질 변경은
`nullable: true` 컬럼인데 TS 필드가 non-null 로 선언돼 `null as unknown as X` 이중 캐스트를
강제하던 8개 자리(`User` 7 · `Schedule` 1)의 타입을 `| null` 로 넓히고, 회귀 가드(신규 repo-guard
2파일)와 테스트를 추가한 것이다. API 계약·요구사항 ID·RBAC·계층 책임 변경은 없어 해당 관점(2·3·5·6)은
이 diff 범위에서 적용 대상이 없다. 데이터 모델 관점(1)에서 한 건의 실질적 불일치를 확인했다.

## 발견사항

- **[WARNING]** `Schedule.next_run_at` — 엔티티가 이제 명시적으로 nullable 을 선언·테스트로 고정했는데, 데이터 모델 spec 은 여전히 non-null 로 문서화
  - target 위치: `codebase/backend/src/modules/schedules/entities/schedule.entity.ts` (`nextRunAt: Date` → `Date | null`, diff L232-234) + `schedule-runner.service.ts` catch 분기(`schedule.nextRunAt = null`) + `schedules.service.ts` 의 `nextRun ? new Date(nextRun) : null` 분기 + 신규 가드 테스트(`schedule-runner.service.spec.ts`/`schedules.service.spec.ts`)가 "cron 파싱 실패/재계산 결과 없음 시 `nextRunAt` 을 **명시적으로 `null`** 로 대입한다"를 계약으로 못박음.
  - 충돌 대상: `spec/1-data-model.md` §2.9 Schedule 테이블 — `next_run_at | Timestamp |` (물음표 없음 = non-nullable). 바로 옆 `last_run_at | Timestamp? |` 은 물음표가 있어, 이 문서의 nullable 표기 관례(`?` 접미사, 문서 전체 26곳에서 일관 사용)상 `next_run_at` 은 명시적으로 "NULL 불가"로 선언돼 있다. 보조로 `spec/data-flow/10-triggers.md` §3.2(`schedule.next_run_at` 계산)도 cron 파싱 실패 시 NULL 이 되는 분기를 서술하지 않는다.
  - 상세: DB 컬럼(`migrations/V001__initial_schema.sql:168` `next_run_at TIMESTAMPTZ,` — NOT NULL 제약 없음)과 TypeORM `@Column({ nullable: true })` 는 이 필드가 처음부터 nullable 이었음을 보여준다. 이 PR 이전에는 코드가 `null as unknown as Date` 이중 캐스트로 타입을 속이며 그 사실을 가려 왔는데, 이번 PR 이 타입을 정직하게 `Date | null` 로 넓히고 "무효 cron 이면 `null` 이 되는 게 맞다"는 것을 신규 테스트로 **계약화**했다. 그 결과 코드(구현+테스트)와 `spec/1-data-model.md` §2.9 의 문서화된 필드 타입이 정면으로 어긋나는 상태가 이제 더 뚜렷해졌다. 추가로 `spec/1-data-model.md:913` 은 `(next_run_at, is_active)` 를 "스케줄러 다음 실행 대상 조회" 인덱스로 명시하는데, `next_run_at=NULL` 이면서 `is_active=true` 인 행이 이 인덱스 스캔에서 어떻게 취급되는지(다음 실행 불능으로 조용히 방치되는지)는 어느 spec 문서에도 서술이 없다 — 상태 전이 관점(4)에서도 미문서화된 곁가지다.
  - 제안: 이 diff 자체는 코드 정직화일 뿐 새 결함을 만들지 않으므로 코드 수정은 불필요. `spec/1-data-model.md` §2.9 의 `next_run_at` 을 `Timestamp?` 로 정정하고, `spec/data-flow/10-triggers.md` §3.2 에 "cron 파싱 실패 시 `next_run_at` 은 NULL(정보성 컬럼이라 발사 자체에는 영향 없음)" 한 줄을 보강할 것. **이미 개발자 자신이 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "할 일" 목록에 이 항목을 planner 턴 필요 사유("developer 권한 밖")로 남겨 두었다** — 본 발견은 그 항목의 우선순위를 뒷받침하는 독립 근거다.

## 요약

diff 는 `spec/5-system/` 을 직접 건드리지 않는 좁은 범위(nullable 타입 정직화 + 회귀 가드)이고, API 계약·요구사항 ID·RBAC·계층 책임 축에서는 다른 spec 영역과 충돌하지 않는다. 유일한 실질 발견은 `Schedule.next_run_at` 의 nullable 여부에 대한 `spec/1-data-model.md` §2.9 의 문서 오류로, DB·엔티티는 처음부터(V001) nullable 이었으나 문서만 non-null 로 남아 있었고 이번 PR 이 그 간극을 코드·테스트 수준에서 더 명확하게 드러냈다. 이는 이번 diff 가 새로 만든 충돌이 아니라 기존에 잠재해 있던 spec 오기재이며, 개발자도 이미 자기 권한 밖으로 판단해 planner 턴 대기 항목으로 plan 에 남겨 두었다. 그 외 User 엔티티 6개 필드(passwordHash·twoFactorSecret·emailVerifyToken/ExpiresAt·passwordResetToken/ExpiresAt·lockedUntil)는 이미 `spec/1-data-model.md` 에 `?`(nullable)로 정확히 문서화돼 있어, 이번 타입 정직화가 오히려 spec 과 코드의 기존 불일치를 해소하는 방향이다.

## 위험도

LOW
