# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

- target scope(`spec/5-system/`) 델타: **0개 파일** — 이 브랜치는 spec 을 바꾸지 않았다. 정상.
- 실제 구현 diff: 14개 파일 — `User`/`Schedule` 엔티티의 `nullable: true` 컬럼을 `| null` 타입으로
  넓히고 `null as unknown as X` 이중 캐스트 8건을 제거, 회귀 가드(`nullable-type-lie-cast-guard.ts`
  + spec) 신설. 이 diff 는 top commit `40fa58b8f`(및 직전 `7ce4fa92a`)에 해당.
- 이 작업 자체가 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "배치 1" 섹션으로
  **자체 문서화되어 있다** — diff 의 파일 목록·근거(캐스트 8건, `type:` 누락 부팅 실패, 가드 위치
  선정 사유)가 그 plan 문서의 서술과 1:1로 일치함을 확인했다.

## 조사한 것

1. 변경된 엔티티 필드명(`passwordHash`, `twoFactorSecret`, `emailVerifyToken`,
   `emailVerifyExpiresAt`, `passwordResetToken`, `passwordResetExpiresAt`, `lockedUntil`,
   `nextRunAt`)과 `user.entity.ts`/`schedule.entity.ts` 를 `plan/in-progress/**` 전체에서
   grep — `entity-nullable-column-type-mismatch.md` 자신 외에 참조하는 다른 plan 없음.
2. 이 작업의 출처로 명시된 `#1269`(`auth-change-password-oauth-only-code-split.md`)는 이미
   `plan/complete/` 로 이동 완료(커밋 `af41a3c6e`) — 선행 작업이 실제로 종결된 상태에서
   후속(엔티티 타입 정정)이 새 plan 으로 분리된 것으로, 선행-후속 관계가 문서와 일치한다.
3. `repo-guards/__tests__/` 의 "guard+spec 2종 관례" 선례로 지목된 `masked-reject-callers-guard`·
   `eslint-unicorn-peer-guard`, 그리고 `source-scan.ts` 의 "세는 축 통합" 관례를 참조하는
   `update-returning-tuple-shape.md`·`backend-lint-gate-broken-on-main.md` 등을 확인 — ratchet
   baseline 수치(`199/38`)·가드 배치 관례 서술이 서로 모순되지 않는다.
4. 이 plan 이 배치 1 완료 후 남긴 두 미해결 항목(`## 할 일`):
   - "공용 walker 추출" (deferred, 별도 배치로 명시)
   - "배치 2 기준 결정" (후보 (a)/(b)/(c) 나열, 미확정)
   diff 는 이 두 항목 어느 쪽도 선제적으로 결정하지 않는다 — 배치 1 범위(캐스트 강제 8필드)에만
   국한되어 있어, plan 이 "결정 필요"로 남긴 것과 diff 가 실제로 내린 결정 사이에 충돌이 없다.
5. 다른 in-progress plan 중 이 엔티티들의 non-null 타입을 전제로 코드 스니펫·계약을 서술하는
   문서가 있는지 grep — 없음. 따라서 이번 타입 확장이 다른 plan 의 서술을 stale 하게 만들지
   않는다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 어느 등급도 해당 사항을 찾지 못했다.

## 요약

이번 diff 는 그 자신을 추적하는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의
"배치 1" 서술과 정확히 일치하며, target scope(`spec/5-system/`)에 델타가 없는 것도 순수 내부
타입 정합화 작업의 성격상 정상이다. 변경된 엔티티 필드·타입을 참조하거나 그에 의존하는 다른
`plan/in-progress/**` 문서는 없어 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 중 어느 것도
관측되지 않았다. 이 plan 자신이 남긴 두 개의 미결 항목(walker 추출, 배치 2 기준)은 diff 범위
밖으로 명시적으로 유보되어 있어 별도 조치가 필요 없다.

## 위험도

NONE
