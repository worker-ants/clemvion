# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 위험도 NONE, Critical/Warning 없음.

## 전체 위험도
**NONE** — `change-password` 실패 코드를 형제 흐름(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)과 정렬한 target(`spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`) 델타는 cross-spec 정합·Rationale 연속성·규약 준수·plan 정합·신규 식별자 충돌 5개 관점 모두에서 결함이 발견되지 않았다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `error-codes.md §5` Rename 이력 표의 `PR` 열이 PR 번호 대신 in-progress plan 링크(`auth-change-password-oauth-only-code-split.md`)를 사용 — 표의 다른 행과 표기 형식이 국소적으로 다름 | `spec/conventions/error-codes.md` §5, `INVALID_PASSWORD` 행 | plan 이 `plan/complete/` 로 이동하고 실제 PR 번호가 확정되면 그 시점에 `PR` 열을 번호로 갱신 (Plan Coherence checker 도 동일 항목을 마무리 하우스키핑으로 확인) |
| 2 | Plan Coherence | governing plan 2건(`auth-change-password-oauth-only-code-split.md`, `spec-draft-change-password-code-alignment.md`)이 체크리스트 전항목 `[x]`이나 아직 `plan/in-progress/`에 위치 — 리뷰 진행 중이라 이동 보류 상태 | `plan/in-progress/auth-change-password-oauth-only-code-split.md`, `plan/in-progress/spec-draft-change-password-code-alignment.md` | 마무리 커밋에서 두 plan 을 `plan/complete/` 로 이동 + 위 #1 PR 번호 갱신을 함께 처리 |
| 3 | Naming Collision | 신규 상수 `PASSWORD_VERIFY_CODES`(`password.util.ts`) — 저장소 전수 grep 결과 유일 정의처, 충돌 없음 확인 (조치 불요, 기록용) | `codebase/backend/src/common/utils/password.util.ts:30` | 없음 |
| 4 | Naming Collision | `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 발행 범위가 `changePassword` 로 확장 — 기존 `verifyPasswordForUser`/`verifyReauth` 와 동일 의미 공유이며 문서·근거·실측 모두 정합 (조치 불요, 기록용) | `spec/5-system/1-auth.md:339`, `spec/5-system/3-error-handling.md` §1.2.1 | 없음 |
| 5 | Naming Collision | 은퇴된 `INVALID_PASSWORD` 는 `login_history.failure_reason` 감사값 레이어로만 잔존 — wire 코드로는 0건, 레이어 분리가 문서에 명시됨 (조치 불요, 기록용) | `spec/1-data-model.md:710`, `codebase/backend/src/modules/auth/auth.service.ts:348` | 없음 |
| 6 | Naming Collision | 기각된 후보 `PASSWORD_NOT_SET`(wire 신설안)은 이미 존재하는 동명 audit 사유값(`auth.service.ts:331`)과의 충돌을 사전에 식별해 회피한 이력 (조치 불요, 기록용) | `plan/in-progress/auth-change-password-oauth-only-code-split.md` "선택지" | 향후 이 이름을 wire 코드로 재도입 시 이 audit 충돌을 재확인할 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API 계약·요구사항 ID(에러 코드)·감사값 vs wire 코드 레이어 구분 등 모든 교차-영역 지점이 코드 diff·frontend 문서와 정확히 일치. 충돌 없음. |
| Rationale Continuity | NONE | 전날(`#1268`) 이월된 미결 사항을 오늘 완결한 것으로, 기각된 대안(`PASSWORD_NOT_SET`) 재도입 없음·합의 원칙(`error-codes.md §2` rename 금지) 위반 없음·번복마다 근거 동반·암묵적 invariant(감사값 vs wire 레이어) 유지. |
| Convention Compliance | NONE (INFO 1건) | 명명·출력 포맷·문서 구조·API 문서·금지 항목 규약 전부 준수. `error-codes.md §5` `PR` 열 표기만 INFO. |
| Plan Coherence | NONE (INFO 1건 부수 관찰) | governing plan 2건의 변경안 표·체크리스트와 diff 가 항목 단위로 정확히 대조됨. 미해결 결정·미해소 선행조건·무효화된 후속 항목 없음. `complete/` 이동만 잔여 하우스키핑. |
| Naming Collision | NONE (INFO 4건, 전부 확인용) | 유일한 신규 식별자(`PASSWORD_VERIFY_CODES`) 충돌 없음. 기존 코드 발행 범위 확장·은퇴 코드 잔존 모두 레이어 분리가 문서화되어 충돌 아님. |

## 권장 조치사항
1. (선택, non-blocking) 마무리 커밋에서 `auth-change-password-oauth-only-code-split.md`·`spec-draft-change-password-code-alignment.md` 를 `plan/complete/` 로 이동하고, PR 생성 후 `spec/conventions/error-codes.md §5` `INVALID_PASSWORD` 행의 `PR` 열을 실제 PR 번호로 갱신.
2. 그 외 추가 조치 불요 — BLOCK 사유 없음.