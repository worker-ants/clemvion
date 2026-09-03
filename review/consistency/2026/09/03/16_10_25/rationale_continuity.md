# Rationale 연속성 검토

## 검토 범위 및 방법

- target: `spec/5-system/` (diff-base `origin/main` 대비 **spec 델타 0개** — 이 브랜치는 해당 영역 spec 을 바꾸지 않았다)
- 실제로 검토한 것: `origin/main...HEAD` 구현 diff 14개 파일 / 764줄. 확인 결과 이 델타는 **entity-nullable-column-type-mismatch 배치 1** 단일 작업이다 — `null as unknown as X` 이중 캐스트 제거 + `User`(7필드)·`Schedule`(1필드) 엔티티 컬럼 타입을 `| null` 로 넓히는 리팩터 + 회귀 방지 가드(`nullable-type-lie-cast-guard.ts`/`nullable-type-lie-cast.spec.ts`) 신규 추가 + 각 필드별 `undefined`-회귀 방지 단위테스트 5건.
  - 참고로 커밋 로그의 `change-password` 실패 코드 정렬(`af41a3c6e`, `#1269`)은 **이미 `origin/main` 의 조상**임을 `git merge-base --is-ancestor` 로 확인했다 — 이번 검토 대상 델타에는 포함되지 않는다.
  - 이번 세션은 동일 작업에 대한 3회의 추가 리뷰 라운드(`e78b6dbad`·`52ca3128a`·`40fa58b8f`) 이후 재검토다. 직전 세션(`review/consistency/2026/09/03/15_17_03/rationale_continuity.md`, 14파일/755줄, 결론 NONE)과 실질적으로 같은 대상이며, 이번 라운드에서 늘어난 9줄은 리뷰 W1~W4 대응(캐스트 강제 4필드 `type:` 보강, 대조군 fixture 를 synthetic 로 교체, `undefined` 회귀 테스트 보강)이다.
- 대조 대상: `spec/5-system/1-auth.md`(전문 + `## Rationale`), `spec/5-system/2-api-convention.md`(전문 + `## Rationale`), `spec/1-data-model.md`(User/Schedule 엔티티 표 + `## Rationale`), `spec/data-flow/10-triggers.md` 의 `## Rationale`, `spec/0-overview.md`/`spec/2-navigation/*` 의 Rationale 발췌, `spec/conventions/migrations.md`(엔티티-DB 정합 관련 유일하게 근접한 정식 규약), 그리고 diff 가 직접 인용하는 `plan/in-progress/entity-nullable-column-type-mismatch.md`(전문)
- 보조 확인: `spec/1-data-model.md` 에서 `password_hash`/`email_verify_token`/`email_verify_expires_at`/`password_reset_token`/`password_reset_expires_at`/`locked_until`/`two_factor_secret` 7개 필드 모두 이미 `String?`/`Timestamp?` (nullable 표기 `?`) 로 문서화돼 있음을 확인 — 이번 TS 타입 확장(`| null`)은 이 기존 문서 서술과 **정합화**되는 방향. `Schedule.next_run_at` 만 문서가 `Timestamp`(비-nullable 표기)로 남아 있어 여전히 어긋남을 확인 (아래 발견사항 참고)

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO] `Schedule.next_run_at` 문서-코드 간극 — 이미 plan 에 후속 항목으로 등재되어 있음**
  - target 위치: 이번 diff `codebase/backend/src/modules/schedules/entities/schedule.entity.ts`(`nextRunAt: Date` → `Date | null`), `schedule-runner.service.ts`/`schedules.service.ts` 의 `null` 명시 대입
  - 관련 spec: `spec/1-data-model.md:260` `next_run_at | Timestamp | ...` (같은 표 바로 아래 `:261` `last_run_at | Timestamp?` 와 대비하면 `?` 없음 = 비-nullable 표기 관례)
  - 상세: DB 컬럼은 이 PR 이전부터 `nullable: true` 였고(코드 diff 자체가 신규 제약을 만들지 않음), 이번 diff 는 그 기존 DB 제약에 TS 타입을 맞췄을 뿐이다. `spec/1-data-model.md` §2.9 표기는 여전히 `Timestamp`(비-nullable)로 남아 있어 실제 스키마·이번에 고정된 코드 동작과 어긋난다. 다만 이는 **이번 PR 이 만든 결정 번복이 아니라 선재하던 문서 간극**이며, `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 의 `## Rationale` 어디에도 `next_run_at` 비-nullable을 명시적으로 결정한 항목이 없어 "기각된 대안 재도입"이나 "합의 원칙 위반"에 해당하지 않는다.
  - 제안: 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "할 일" 목록에 **"후속(planner 턴) — `spec/1-data-model.md` §2.9 `next_run_at` 표기 정정"** 으로 명시 등재되어 있고, developer 가 "권한 밖(자기-반증형 소정정 예외 미해당)"이라고 스스로 판단해 planner 턴으로 위임한 상태다 — CLAUDE.md 의 역할 분리 규약을 정확히 따른 처리이므로 이번 diff 를 막을 사유는 아니다. planner 턴에서 §2.9 `next_run_at` 을 `Timestamp?` 로, `spec/data-flow/10-triggers.md §3.2` 에 "cron 파싱 실패 시 `next_run_at` 은 NULL" 한 줄을 보강하면 종결된다.

## 근거 (Rationale 연속성 관점에서 위반이 없다고 판단한 근거)

1. **기각된 대안의 재도입 없음** — `spec/5-system/**`·`spec/1-data-model.md`·`spec/conventions/migrations.md` 어디에도 "엔티티 TS 타입은 DB nullable 과 무관하게 non-null 로 유지한다" 류의 명시적 결정이나 `null as unknown as X` 캐스트 패턴을 의도적으로 채택한 Rationale 이 없다. 오히려 plan 문서가 인용하는 저장소 내 두 선례(`Execution.error`, `llm-usage-log.workflowId`/`executionId` → `| null`)가 정확히 같은 처방의 연장선이다. `spec/5-system/1-auth.md` §1.1 표는 이미 "`user.password_hash` 는 nullable — OAuth 단독 가입 사용자는 NULL" 이라 명시하고 있어, 이번 타입 정정은 그 서술을 거스르지 않고 오히려 코드가 뒤늦게 따라잡은 것이다.
2. **합의된 원칙 위반 없음** — `spec/5-system/2-api-convention.md` §5.4("부재 표현: null vs 키 생략")는 **HTTP 응답 wire 계약** 층위의 원칙이고, 이번 diff 가 다루는 `null`(명시 대입) vs `undefined`(TypeORM `update()` 의 SET 절 생략) 구분은 **ORM/DB 갱신 페이로드** 층위다 — 계층이 다르므로 원칙이 충돌하지 않는다. `spec/conventions/migrations.md` 의 append-only/단조 V번호 원칙도 이번 diff 가 새 마이그레이션을 추가하지 않으므로 관련이 없다(기존 `nullable: true` 제약에 TS 타입만 맞춤).
3. **결정의 무근거 번복 없음** — `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 `spec_impact: none` 이 명시하듯 이번 변경은 spec 이 규정한 결정을 뒤집는 것이 아니라 타입-런타임 간극(코드 품질)을 좁히는 작업이다. plan 은 실측(캐스트 8건 제거·`tsc` 비-spec 오류 0건·e2e 부팅 실패 재현→`type:` 보강·뮤테이션 7축 RED)과 3라운드 리뷰의 지적·조치 이력을 상세히 기록하고 있어 "무근거"가 아니다. 유일하게 남은 문서 간극(`Schedule.next_run_at`)도 developer 가 스스로 발견해 명시적으로 planner 턴 후속 항목으로 등재했다 — 침묵한 번복이 아니다.
4. **암묵적 가정 충돌 없음** — `spec/5-system/1-auth.md` 의 `## Rationale`(2.3.C 비밀번호 변경 세션 revoke, 1.1.B 이메일 변경 토큰 바인딩 등)이 규정하는 invariant 들은 이번 diff 가 건드리는 필드 타입·null 처리와 직교한다. 오히려 diff 는 "소비된 토큰을 `undefined` 로 회귀시키면(= SET 절 생략) DB 에 남아 재사용 가능해진다"는, 이미 auth 도메인이 암묵적으로 지키고 있던 보안 invariant를 테스트로 명시 고정하는 방향이다(`resetPassword`/`verifyEmail`/`resetLoginAttempts`/schedule 재계산 5곳에 `toBeNull()` 단언 신규 추가).

## 요약

이번 diff 는 `spec/5-system` 을 변경하지 않았고(델타 0), 3라운드의 코드 리뷰를 거치며 분량이 늘었지만 내용의 성격은 직전 세션(`15_17_03`, 결론 NONE)과 동일하다 — TypeORM 엔티티의 nullable 컬럼 타입을 기존 DB 제약(`nullable: true`, 이 PR 이전부터 존재)에 맞게 정정하고 그 과정에서 강제되던 `null as unknown as X` 이중 캐스트를 제거한 코드 품질 리팩터다. 저장소 내 선례(`Execution.error`, `llm-usage-log.*`)를 따르는 점진적 조치이며, `spec/5-system/1-auth.md`·`spec/1-data-model.md` 의 기존 nullable 서술(`String?`/`Timestamp?`)과 정합화되는 방향이지 이를 거스르지 않는다. `spec/5-system/1-auth.md`·`2-api-convention.md`·`spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 의 `## Rationale` 전문을 대조했을 때 이 diff 와 충돌하는 원칙·invariant 는 발견되지 않았다. 유일한 INFO(`Schedule.next_run_at` 문서 표기 vs DB nullable)는 이 PR 이 만든 번복이 아니라 선재 간극이며, developer 가 이미 이를 인지해 "권한 밖" 판단과 함께 planner 턴 후속 항목으로 명시 등재한 상태 — 역할 분리 규약을 정확히 따른 처리다.

## 위험도

NONE
