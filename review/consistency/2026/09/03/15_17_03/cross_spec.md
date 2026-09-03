# Cross-Spec 일관성 검토 — `entity-nullable-column-type-mismatch` 배치1 (impl-done, scope=spec/5-system/)

## 개요

`spec/5-system/` 자체의 spec 델타는 0개 파일 — 이 브랜치는 그 영역의 spec 문서를 바꾸지 않았다.
검토 대상은 구현 diff(14파일/755줄): `User`/`Schedule` 엔티티의 `null as unknown as X` 이중
캐스트 8건을 제거하고 해당 필드 타입을 `| null` 로 넓힌 것, 그리고 재발 방지용 신규 backend
가드(`nullable-type-lie-cast-guard.ts`/`.spec.ts`) 추가. plan
(`plan/in-progress/entity-nullable-column-type-mismatch.md`)은 `spec_impact: none` 을 선언했다 —
이 판단이 실제로 맞는지가 본 검토의 핵심 질문이다.

`User` 쪽 7필드(`passwordHash`/`twoFactorSecret`/`emailVerifyToken`/`emailVerifyExpiresAt`/
`passwordResetToken`/`passwordResetExpiresAt`/`lockedUntil`)는 전부 `spec/1-data-model.md` §2.1
에서 이미 `String?`/`Timestamp?`(nullable)로 선언돼 있어 — 이번 타입 확장은 **spec 과의 불일치를
해소**하는 방향이다(코드가 거짓말하던 것을 spec 에 맞게 정정). 이 부분은 충돌 없음.

## 발견사항

- **[WARNING]** `Schedule.next_run_at` — 코드는 이제 nullable 을 공식 계약으로 굳혔는데 데이터 모델 문서는 여전히 non-null 로 표기
  - target 위치: diff `codebase/backend/src/modules/schedules/entities/schedule.entity.ts` (`nextRunAt: Date | null`, `@Column({ nullable: true })` 는 원래부터 있었음) · `schedule-runner.service.ts` catch 분기(cron 파싱 실패 시 `null` 대입) · `schedules.service.ts` (`nextRun ? new Date(nextRun) : null`) · 신규 테스트 2건(`schedule-runner.service.spec.ts`, `schedules.service.spec.ts`)이 이 `null` 대입을 `toBeNull()` 로 명시 단언
  - 충돌 대상: `spec/1-data-model.md` §2.9 Schedule 테이블 — `next_run_at | Timestamp | 다음 실행 예정 시각` (물음표 없음 → 이 문서 관례상 non-nullable; 바로 아래 `last_run_at | Timestamp?` 는 nullable 로 명시돼 대조됨). 부수적으로 `spec/data-flow/10-triggers.md` §3.2(`schedule.next_run_at` 계산)도 cron 파싱 실패 시 NULL 이 되는 케이스를 언급하지 않는다
  - 상세: DB 컬럼은 이 diff 이전부터 `nullable: true` 였고, cron 파싱 실패 시 `nextRunAt`(구: `null as unknown as Date`)을 `null` 로 대입하는 런타임 동작도 사전에 존재했다(`git log -p` 로 확인 — 이 PR 이 도입한 동작이 아니다). 프론트엔드도 이미 `nextRunAt?: string`(optional)로 다루고 있다(`codebase/frontend/.../schedule-config-card.tsx`: `{trigger.nextRunAt && (...)}`). 즉 "next_run_at 이 NULL 일 수 있다"는 스택 전체(DB·backend·frontend)에서 이미 사실이었는데, `spec/1-data-model.md` 만 이를 반영하지 않고 있었다. 이번 diff 는 그 사전 존재 갭을 새로 만든 게 아니라, 타입 시스템 레벨에서 **공식화·테스트로 고정**했다 — 앞으로 이 필드를 non-null 로 되돌리기가 더 어려워진다는 뜻이다. plan frontmatter 의 `spec_impact: none` 은 "동작 변경 없음" 관점에서는 맞지만, "문서와 실제 계약의 괴리를 감춘 채로 굳힌다" 는 관점에서는 재검토 여지가 있다.
  - 제안: `spec/1-data-model.md` §2.9 의 `next_run_at` 행을 `Timestamp?` 로 정정하고, 가능하면 `spec/data-flow/10-triggers.md` §3.2 에 "cron 파싱 실패 시 `next_run_at` 은 NULL 로 대입되며, 발사에는 영향 없다(정보성 컬럼)" 한 줄을 보강할 것을 권장. planner 턴이 필요한 영역(제품 정의·데이터 모델은 developer 자기반증 예외 대상이 아님).

- **[INFO]** TypeORM `nullable: true` + union 타입 시 `design:type` 함정이 정식 convention 문서에 없음
  - target 위치: 신규 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`/`.spec.ts` 의 `findUntypedNullableColumns` — "`| null` 컬럼은 `@Column` 에 `type:` 명시 필수" 규칙이 코드 주석과 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에만 적혀 있다
  - 충돌 대상: `spec/conventions/` — TypeORM 엔티티 컬럼 타입 규칙을 다루는 문서 부재(검색 결과 없음)
  - 상세: 이번 배치에서 타입만 넓혔다가 `DataTypeNotSupportedError` 로 e2e 부팅이 실제로 깨진 사건이 있었고(plan 문서에 기록), 그 교훈이 지금은 가드 코드 주석 + plan 문서에만 존재한다. 이는 충돌은 아니지만, 다음 사람이 같은 함정(`nullable: true` 필드를 `| null` 로 넓히며 `type:` 누락)을 반복하지 않으려면 `spec/conventions/`(또는 backend 엔티티 관례 문서)에 정식 규약으로 승격하는 편이 SoT 원칙에 맞다.
  - 제안: 선택 사항 — 이 배치가 전부 끝나고(잔여 38건) 안정화되면 `spec/conventions/`에 짧게 남길 것을 권고. 이번 PR 을 막을 사유는 아님.

CRITICAL 등급 발견 없음. API 계약·요구사항 ID·상태 머신(트리거/스케줄 라이프사이클)·RBAC·계층 책임 관점에서는 이번 diff 가 새 endpoint·권한·계층 경계를 건드리지 않아 해당 없음. `User` 7필드의 타입 확장은 오히려 기존 `spec/1-data-model.md` 선언과의 불일치를 해소하는 방향이라 충돌 없음.

## 요약

이번 diff 는 `User`/`Schedule` 엔티티의 nullable 컬럼 타입 거짓말을 걷어내는 좁게 스코프된 내부 타입-정합성 작업이며, `User` 7필드는 오히려 `spec/1-data-model.md` 와의 기존 불일치를 해소한다. 유일한 실질 발견은 `Schedule.next_run_at` — DB·backend·frontend 전 스택에서 이미 nullable 로 다뤄지고 있었는데 `spec/1-data-model.md` §2.9 만 non-null 로 표기돼 있던 사전 존재 갭이며, 이번 diff 가 이를 도입한 것은 아니지만 테스트로 영구 고정했다. 코드 동작 자체는 안전하고(정보성 컬럼, 발사 트리거 아님) 다른 영역과의 API·RBAC·상태 머신 충돌은 없다.

## 위험도

LOW
