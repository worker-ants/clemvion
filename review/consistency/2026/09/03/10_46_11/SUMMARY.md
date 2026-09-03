# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — 5개 checker 모두 위험도 NONE~LOW. 유일한 실질 이슈는 rationale_continuity 가 지적한 WARNING 1건(설계 결정 자체는 안전, 근거 서술이 부정확)이며 나머지는 서식/위생 INFO 뿐.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위반 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | "`UsersService` 는 `AuthService` 를 순환 의존 때문에 주입할 수 없다"는 근거가 검증되지 않았고 이 저장소의 기존 패턴으로 반증됨 | `spec/5-system/1-auth.md` §5 note; `codebase/backend/src/common/utils/password.util.ts` `PASSWORD_VERIFY_CODES` JSDoc; `plan/in-progress/auth-change-password-oauth-only-code-split.md` 106~110행 | 같은 `UsersController` 가 이미 `@Inject(forwardRef(() => AuthService))` 로 `AuthService` 를 주입 중(`users.controller.ts:74`, refactor 04 A-1). `forwardRef` 순환 주입은 `websocket.gateway.ts` 등 12곳 이상에서 쓰는 표준 패턴 | 세 곳 문구를 "순환이라 불가능"에서 "가능하지만 refactor 04 B-2 SRP 경계(컨트롤러=오케스트레이션, 서비스=도메인 로직) 보존을 위해 코드 상수만 공유하고 헬퍼는 공유하지 않는다"로 교체. 설계 결정 자체(코드 상수만 공유)는 유지 — 근거 서술만 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance, plan_coherence | `error-codes.md` §5 Rename 이력 표 `PR` 컬럼이 다른 행(PR 번호)과 달리 `INVALID_PASSWORD` 행만 plan 파일 링크를 씀 — plan 자신이 "PR 생성 전이라 임시로 plan 링크" 라고 이미 예정해 둔 상태 | `spec/conventions/error-codes.md` §5, `INVALID_PASSWORD` 행 | 헤더를 `PR/근거` 로 일반화하거나, PR 생성 직후 실제 PR 번호로 교체 (규약 위반 아님, 필수 아님) |
| 2 | plan_coherence | `auth-change-password-oauth-only-code-split.md` `## 할 일` 의 developer 턴 항목이 `- [ ]` 미체크지만 diff 상 실제로는 완료(unit/e2e/mdx 갱신 포함)되어 있고 `/ai-review` fix 커밋(`139115d34`)까지 반영됨 | `plan/in-progress/auth-change-password-oauth-only-code-split.md` `## 할 일` | 마무리 커밋에서 체크박스 동기화 + `plan/complete/` 이동 여부 판단 (이 저장소 표준 순서: review → consistency → 마무리 커밋) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | wire 코드 카탈로그·rename 이력·감사값 레이어 분리·API 표·구현 3발행처 정합 — 위배 없음 |
| rationale_continuity | LOW | rename 자체는 선례(#1193)와 정합. "순환 의존 불가" 근거만 미검증·반증됨(WARNING 1건) |
| convention_compliance | NONE | 명명·rename 안정성·historical-artifact 레지스트리·i18n·swagger 규약 전부 준수. PR 컬럼 서식 INFO 1건 |
| plan_coherence | NONE | 소유 plan 2건의 결정(D안, 신규 코드 0)을 target 이 누락 없이 이행. 제3자 plan 과 충돌 없음. 체크박스/PR 열 위생 INFO |
| naming_collision | NONE | 신규 식별자 `PASSWORD_VERIFY_CODES` 뿐, 기존 코드 재사용. `PASSWORD_NOT_SET` 동명 충돌을 target 이 사전 회피한 사례 확인 |

## 권장 조치사항
1. (WARNING 해소) `spec/5-system/1-auth.md §5` note, `password.util.ts` `PASSWORD_VERIFY_CODES` JSDoc, `auth-change-password-oauth-only-code-split.md` 106~110행 — "순환 의존이라 불가능"을 "가능하지만 refactor 04 B-2 SRP 경계 보존을 위해 코드 상수만 공유한다"로 정정.
2. (INFO, 선택) `error-codes.md §5` `PR` 컬럼 헤더를 `PR/근거` 로 일반화하거나 PR 생성 시 실제 번호로 교체.
3. (INFO, 선택) 마무리 커밋에서 `auth-change-password-oauth-only-code-split.md` 체크박스 동기화 + `plan/complete/` 이동 여부 판단.
