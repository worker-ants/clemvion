# Rationale 연속성 검토

## 검토 범위 및 방법

- target: `spec/5-system/` (diff-base `origin/main` 대비 **spec 델타 0개** — 이 브랜치는 해당 영역 spec 을 바꾸지 않았다)
- 실제로 검토한 것: 구현 diff 14개 파일 / 755줄 — `null as unknown as X` 이중 캐스트 제거 + 관련 TypeORM 엔티티 컬럼 타입을 `| null` 로 넓히는 리팩터(User 7필드·Schedule 1필드) + 회귀 방지 가드(`nullable-type-lie-cast*`) 신규 추가
- 대조 대상: `spec/5-system/1-auth.md`(전문 + `## Rationale`), `spec/5-system/2-api-convention.md`(전문 + `## Rationale`), `spec/0-overview.md`/`spec/1-data-model.md`/`spec/2-navigation/*` 의 Rationale 발췌, `spec/conventions/**`, 그리고 diff 가 직접 인용하는 `plan/in-progress/entity-nullable-column-type-mismatch.md`
- 보조 확인: `git log -S "null as unknown as"`(캐스트 도입 이력 — 별도 Rationale 로 의도적으로 도입된 것이 아니라 monorepo 이전부터 있던 타입 부채임을 확인), `git show origin/main:.../schedule.entity.ts`(`nextRunAt` 컬럼의 `nullable: true` 가 이 diff 이전부터 이미 존재했음을 확인 — 이번 PR 이 DB 제약을 새로 바꾼 게 아니라 TS 타입만 그 기존 제약에 맞춘 것)

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO] `Schedule.next_run_at` — 데이터모델 문서 표기(`Timestamp`, 비-nullable)와 DB 제약(`nullable: true`)의 기존 불일치, 이번 diff 가 노출만 함**
  - target 위치: 이번 diff `codebase/backend/src/modules/schedules/entities/schedule.entity.ts`(`nextRunAt: Date` → `Date | null`)
  - 관련 spec: `spec/1-data-model.md` §2.9 Schedule 표 — `next_run_at | Timestamp | 다음 실행 예정 시각` (같은 표의 `last_run_at | Timestamp?` 와 비교하면 `?` 미표기 = 비-nullable 컨벤션)
  - 상세: DB 컬럼은 이 PR 이전부터 `nullable: true` 였다(`git show origin/main:...schedule.entity.ts` 로 확인). 이번 diff 는 그 기존 DB 제약에 TS 타입을 맞춘 것일 뿐, DB 제약이나 동작을 새로 바꾼 게 아니다. 다만 데이터모델 문서의 `next_run_at` 행이 여전히 `Timestamp`(비-nullable 표기)로 남아 있어 실제 스키마와 어긋난다 — 이는 이번 PR 이 만든 번복이 아니라 **선재하던 문서-코드 간극**이며, `spec/1-data-model.md` 의 `## Rationale` 에도 이 필드에 대한 항목이 없어 "기각된 대안 재도입"이나 "결정 번복"에 해당하지 않는다.
  - 제안: 본 검토(Rationale 연속성) 범위 밖이므로 이 PR 을 막을 사유는 아니다. 별도로 `spec/1-data-model.md` §2.9 의 `next_run_at` 표기를 `Timestamp?` 로 정정하는 문서 동기화 작업을 고려할 수 있다(cross-spec/consistency 검토 쪽 항목).

## 근거 (Rationale 연속성 관점에서 위반이 없다고 판단한 근거)

1. **기각된 대안의 재도입 없음** — diff 는 새로운 설계 결정을 도입하지 않는다. `null as unknown as X` 캐스트 제거와 컬럼 타입 확장은 이 저장소가 이미 두 차례 적용한 동일 처방(`Execution.error`, `llm-usage-log.workflowId`/`executionId`)의 연장이며, `plan/in-progress/entity-nullable-column-type-mismatch.md` 가 그 선례를 명시적으로 인용하고 있다. `spec/5-system/1-auth.md` §1.1 표는 이미 "`user.password_hash` 는 nullable — OAuth 단독 가입 사용자는 NULL" 이라고 명시하고 있어, 이번 타입 정정은 spec 서술과 **정합화**되는 방향이지 그것을 거스르는 방향이 아니다.
2. **합의된 원칙 위반 없음** — `spec/5-system/2-api-convention.md` §5.4("부재 표현: null vs 키 생략")는 **HTTP 응답 wire 계약** 층위의 원칙이고, 이번 diff 가 다루는 `null`(명시 대입) vs `undefined`(TypeORM `update()` 의 SET 절 생략) 구분은 **ORM/DB 갱신 페이로드** 층위로 서로 다른 계층이다 — 원칙이 겹치지 않으므로 위반이라 볼 근거가 없다.
3. **결정의 무근거 번복 없음** — `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 `spec_impact: none` 이 명시하듯 이번 변경은 spec 이 규정한 결정을 뒤집는 것이 아니라 타입-런타임 간극(코드 품질)을 좁히는 작업이며, plan 문서 자체가 실측(캐스트 8건 제거·타입 오류 0건 증가·e2e 로 부팅 실패 재현 후 `type:` 보강)을 상세히 기록하고 있어 "무근거"가 아니다.
4. **암묵적 가정 충돌 없음** — `spec/5-system/1-auth.md` 의 `## Rationale`(2.3.C 비밀번호 변경 세션 revoke, 4.1.B 감사 귀속 등)이 규정하는 invariant 들은 이번 diff 가 건드리는 필드 타입·null 처리와 직교한다. diff 는 오히려 "소비된 토큰을 `undefined` 로 회귀시키면 DB 에 남는다"는 **기존에 지켜지고 있던 실제 동작**을 테스트로 고정하는 방향이다.

## 요약

이번 diff 는 spec/5-system 을 변경하지 않았고(델타 0), 내용상으로도 새로운 설계 결정을 내리거나 과거 Rationale 이 기각한 대안을 되살리지 않는다. TypeORM 엔티티의 nullable 컬럼 타입을 DB 제약(`nullable: true`, 이 PR 이전부터 존재)에 맞게 정정하고 그 과정에서 강제되던 `null as unknown as X` 이중 캐스트를 제거한 코드 품질 리팩터로, 저장소 내 두 차례 선례(`Execution.error`, `llm-usage-log.*`)를 따르는 점진적 조치이며 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 결정 근거·측정·후속 배치 기준이 모두 기록돼 있다. `spec/5-system/1-auth.md`·`2-api-convention.md` 의 `## Rationale` 전문을 대조했을 때 이 diff 와 충돌하는 원칙·invariant 는 발견되지 않았다. 유일하게 표기한 INFO(`spec/1-data-model.md` §2.9 `next_run_at` 문서 표기 vs 실제 DB nullable)는 이 PR 이 만든 번복이 아니라 선재 간극이 노출된 것이며 Rationale 연속성 위반이 아니다.

## 위험도

NONE
