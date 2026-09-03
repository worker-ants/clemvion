# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전부 success, 전문 확보 완료)

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. `rationale_continuity` 가 INFO 1건을 근거로 LOW 를 보고했고, 나머지 4개 checker 는 모두 NONE. 통합 관점에서 가장 강한 등급인 LOW 를 채택.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 이 발견되지 않았다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | spec 본문 note 는 정정 시 원문 취소선을 남기지 않음 (plan·JSDoc 과 형식 비대칭) | `spec/5-system/1-auth.md` §5 "민감 동작 비밀번호 재확인 코드" note (commit `5232a5540`) | 결론·근거 자체는 정확·측정됨. 필요하면 note 끝에 `(정정 이력: plan/complete/auth-change-password-oauth-only-code-split.md)` 포인터 한 구절 추가 |
| 2 | convention_compliance | §5 rename 이력 표 `PR` 컬럼이 티켓 식별자 대신 plan 문서 링크(형제 행과 형식 편차) | `spec/conventions/error-codes.md` §5, `INVALID_PASSWORD` 행 | 조치 불요(선택). 일관성 원하면 plan 링크를 `비고` 셀로 이동 |
| 3 | convention_compliance | §2 "새 코드를 신설한다" 문면과 실제 처리(기존 코드 재사용)의 자구 긴장 — 단 §5 흡수 메커니즘(Grade B)으로 정식 해소됨 | `spec/conventions/error-codes.md` §2 vs §5 `INVALID_PASSWORD` 행 | 조치 불요. 선택적으로 §2 본문에 "§5 흡수 조건 충족 시 기존 코드 재사용 가능" 상호참조 추가 |
| 4 | naming_collision | `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 가 이제 3개 발행처(`verifyPasswordForUser`·`verifyReauth`·`changePassword`) 공유 — 발행처별 안내 문구 구분 불가 | `codebase/backend/src/common/utils/password.util.ts`(`PASSWORD_VERIFY_CODES`) | 조치 불요(현재 범위 밖). 프론트엔드가 이 코드로 분기할 계획이 생기면 UX 설계 시 참고 |
| 5 | naming_collision | `INVALID_PASSWORD` 문자열의 wire/audit 레이어 분리가 명시적으로 문서화됨 — 잠재적 동명 충돌의 해소 사례 | `spec/5-system/1-auth.md:339`, `3-error-handling.md:69`, `error-codes.md:175` | 조치 불요 — 신규 충돌이 아니라 기존 잠재적 충돌의 해소로 평가 |
| 6 | naming_collision | 신규 TS 상수 `PASSWORD_VERIFY_CODES` 는 기존 식별자와 겹치지 않음(전수 grep 확인) | `codebase/backend/src/common/utils/password.util.ts:30` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `INVALID_PASSWORD` 잔존 참조·신규 코드 명명 충돌·plan 링크·프론트엔드 계약·사용자 문서 전수 확인 — 모순 없음 |
| rationale_continuity | LOW | 직전 라운드 WARNING("순환 의존" 미검증 근거)이 이후 커밋에서 실측 근거로 해소됨을 재확인. 유일 잔여는 spec note 취소선 미보존 형식 비일관(INFO) |
| convention_compliance | NONE | `error-codes.md` 명명·rename·Grade B 절차·북키핑 카운터·i18n-userguide 규약(P5/P6/P6-B/P7) 전부 실측과 일치 |
| plan_coherence | NONE | 사용자 결정으로 닫힌 plan 의 정당한 실행. spec_impact·plan 이동·상호 링크 전부 일치. 잔여 항목(`passwordHash` 타입)은 별도 plan 으로 정식 이관 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·endpoint·이벤트·env·파일경로 없음. 유일한 신규 식별자(`PASSWORD_VERIFY_CODES`)는 미충돌. 기존 근접 명명 위험을 해소하는 방향 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical/Warning 없음)
2. 선택 사항(비차단): `spec/5-system/1-auth.md` §5 note 끝에 정정 이력 포인터(`plan/complete/auth-change-password-oauth-only-code-split.md`) 한 구절 추가 — 다음에 이 note 를 재편집할 사람이 "왜 예전엔 순환 의존이라 썼는지" 추적 비용을 줄임.
3. 선택 사항(비차단): `error-codes.md` §5 `PR` 컬럼 형식(티켓 식별자 vs plan 링크) 통일 여부 결정 — 현행 유지도 무방.
