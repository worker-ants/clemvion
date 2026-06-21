# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] race condition e2e — email_change_expires_at NULL화 미단언
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/test/users-email-change.e2e-spec.ts` L296-302 (verify race 테스트)
- 상세: spec §1.1.B "선점 시 409 + pending NULL화" 는 `pending_email`, `email_change_token`, `email_change_expires_at` 세 필드 모두를 NULL로 정리함을 함의한다. `clearPendingEmailChange` 구현도 세 필드 전부를 NULL로 설정한다. 그러나 e2e 테스트의 SELECT 쿼리가 `email`, `pending_email`, `email_change_token` 만 선택하고 `email_change_expires_at` 를 포함하지 않아, 만료 시각이 정리됐는지 검증하지 않는다. 이미 기능은 구현에서 올바르게 동작하므로 실제 버그는 아니지만 테스트 커버리지 갭이 있다.
- 제안: `email_change_expires_at` 를 SELECT 절에 추가하고 `toBeNull()` 단언을 추가하면 spec §1.1.B pending NULL화 완전 검증이 된다. 비차단.

### [INFO] seedPendingEmailChange — expiresSql 직접 삽입 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/test/users-email-change.e2e-spec.ts` L44
- 상세: `expiresSql` 파라미터가 `${}` 템플릿 리터럴로 SQL 문에 직접 삽입된다. 현재 호출 지점은 모두 하드코딩된 SQL 표현식(`"NOW() + INTERVAL '1 hour'"`, `"NOW() - INTERVAL '1 minute'"`)이므로 SQL 인젝션 위험이 없다. 그러나 테스트 헬퍼가 비파라미터화 삽입 패턴을 정립하는 것은 향후 잘못 복사될 경우의 위험이 있다. 기능 요구사항 위반은 아니며 테스트 코드에 한정된 패턴이다.
- 제안: `expiresSql` 을 `'future' | 'past'` 같은 열거형 또는 Date 객체로 받아 내부에서 파라미터화하면 패턴이 더 안전하다. 비차단.

### [INFO] 프론트엔드 verify 테스트 — toast.success 단언 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx` L50-62
- 상세: spec §1.1.B 와 구현(`page.tsx` L38: `toast.success(...)`) 에 따르면 verify 성공 시 `toast.success` 를 호출한다. 단위 테스트 "성공" 케이스가 `setAccessToken`·`replace` 를 검증하지만 `toast.success` 호출은 단언하지 않는다. 비차단(핵심 흐름은 검증됨).
- 제안: `expect(toast.success).toHaveBeenCalled()` 추가 가능. 선택적 개선.

---

## 요구사항 충족 여부 평가

이번 변경 세트(V101 마이그레이션, auth.service.spec 단위 테스트 추가, e2e 테스트 보강, 프론트엔드 단위 테스트 신규 추가)는 spec §1.1.B 의 핵심 요구사항을 충실히 충족한다. 구체적으로: (1) V101 마이그레이션은 `emailTakenByOther`의 LOWER() 조회를 가속하는 함수 인덱스를 올바르게 추가하며 non-unique 선택 근거가 명확하다. (2) auth.service.spec W2 추가 테스트는 spec §1.1.B "resend 발송 실패 시 갱신된 토큰 유지(롤백 없음)" 비대칭 동작을 서비스 레이어에서 검증하며, 구현(`resendEmailChange` 의 try/catch 부재로 인한 error 전파)과 정확히 일치한다. (3) e2e 테스트는 resend 성공 시 pending 유지 + 토큰·만료 시각 갱신, pending 없는 resend 400 VALIDATION_ERROR, verify 시점 선점 409 + pending 정리를 모두 검증한다. (4) 프론트엔드 verify 페이지 단위 테스트는 성공/실패/토큰없음 세 경로를 커버하며 spec의 인증 필수 + access token 교체 + /profile 리다이렉트 흐름과 일치한다. (5) profile-info-card 단위 테스트는 CTA 링크 및 pendingEmail 표시 여부를 검증한다. 발견된 사항은 전부 INFO 수준이며 기능 요구사항 충족에 영향을 주지 않는다.

## 위험도

NONE
