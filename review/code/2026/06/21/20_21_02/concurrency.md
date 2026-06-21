# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] requestEmailChange TOCTOU — 주석 명시로 수용 처리 확인

- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange`
- 상세: 이전 리뷰(18_29_37 W8)에서 `emailTakenByOther` 검사와 `update` 사이의 TOCTOU 경쟁 조건이 지적되었다. 이번 변경에서 해당 코드 경로에 아래 주석이 명시 추가되었다.

  ```
  // TOCTOU 주의: emailTakenByOther 검사 후 이 update 사이에 다른 계정이 동일 이메일로
  // 가입할 수 있다. 최종 가드는 verifyEmailChange 의 email UNIQUE 제약이므로 여기서는
  // 관측 가능한 UX 저하(409 at verify time)로 수용한다 — transaction-per-request 구조.
  ```

  DB UNIQUE 제약이 `verifyEmailChange` 단계의 최종 방어선으로 기능한다는 사실은 여전히 유효하며, `pendingEmail` 컬럼에 UNIQUE 제약이 없어 두 사용자가 동시에 동일 이메일을 `pendingEmail`로 저장하는 것이 물리적으로 가능하다. 이는 데이터 무결성 위반이 아니며 최종 verify 단계에서 409로 차단된다. 신규 코드에서 변경된 부분이 없으므로 조치 불필요. INFO 등급 유지.

- 제안: 조치 불필요 — 주석 명시로 의도가 문서화되었고 설계가 일관된다.

### [INFO] requestEmailChange 메일 발송 실패 시 rollback — 비원자성 처리 개선 확인

- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` try/catch 블록
- 상세: 이전 리뷰(18_29_37 W6/W9)에서 지적된 메일 발송 실패 시 pending 3필드 DB 잔류 문제가 이번 변경에서 수정되었다. 신규 코드:

  ```typescript
  try {
    await this.mailService.sendEmailChangeVerification(newEmail, user.name, rawToken);
  } catch (mailErr) {
    try {
      await this.clearPendingEmailChange(userId);
    } catch {
      // clearPendingEmailChange 실패는 무시 — 주 오류를 rethrow 하는 게 우선.
    }
    throw mailErr;
  }
  ```

  네트워크 I/O(메일 발송)와 DB write를 원자적으로 처리할 수 없다는 한계 안에서 best-effort rollback이 추가된 것은 적절한 개선이다. `clearPendingEmailChange` 실패가 중첩되는 경우 silently swallow하고 주 오류를 rethrow하는 패턴은 올바르다 — 이미 주 오류가 throw된 상태이므로 추가 예외로 original cause를 덮어씌우지 않아야 한다. 동시성 관점에서 추가 위험 없음.

- 제안: 조치 불필요.

### [INFO] verifyEmailChange logger.warn 추가 — 세션 revoke 후 알림 실패 가시성 확보

- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` catch(noticeErr) 블록
- 상세: 이전 리뷰(18_29_37 W7)에서 `sendEmailChangedNotice` 실패를 빈 catch로 삼켰던 부분에 `logger.warn`이 추가되었다. 이메일 교체가 이미 커밋된 후 알림 실패가 운영자에게 가시화된다. 동시성 구조 변경 없음 — 단순 로깅 개선이므로 경쟁 조건·데드락 위험 없음.
- 제안: 조치 불필요.

### [INFO] EMAIL_CHANGE_TTL_MS 상수 추출 — TTL 중복 제거

- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — 모듈 최상단 상수 선언
- 상세: `requestEmailChange`와 `resendEmailChange` 두 곳에 하드코딩되어 있던 `60 * 60 * 1000` 이 `EMAIL_CHANGE_TTL_MS` 상수로 추출되었다. 동시성 관점에서 영향 없는 리팩토링이며, `Date.now() + EMAIL_CHANGE_TTL_MS` 계산은 여전히 JavaScript 단일 스레드 이벤트 루프 내에서 안전하게 수행된다.
- 제안: 조치 불필요.

### [INFO] React useRef(false) 가드 — 변경 없음

- 위치: 프론트엔드 verify/page.tsx — `VerifyEmailChangeInner`
- 상세: 이번 diff에서 verify/page.tsx의 동시성 관련 코드(`ran.current` 가드)에 변경이 없다. 이전 리뷰에서 StrictMode 이중 실행 방어가 올바르게 구현된 것으로 이미 확인되었다. 재검토 사항 없음.
- 제안: 조치 불필요.

## 요약

이번 변경셋(commit 71fd0f02 적용 후 코드)의 동시성 관련 수정 사항들은 모두 이전 리뷰(18_29_37)의 WARNING/INFO 항목에 대한 정확한 조치이다. TOCTOU 경쟁 조건은 DB UNIQUE 제약을 최종 방어선으로 두고 주석으로 명시하는 방식으로 수용 처리되었으며, 메일 발송 실패 시 best-effort rollback 추가로 비원자성 구간의 부작용이 완화되었다. async/await 사용은 전 코드에서 누락 없이 올바르게 작성되어 있고, NestJS 싱글 스레드 이벤트 루프 환경에서 실질적 경쟁 조건 위험은 존재하지 않는다. 신규로 발견된 동시성 위험도 없다. 모든 발견 사항은 이전 리뷰에서 이미 식별·처리된 항목의 검증에 해당하며 INFO 등급이다.

## 위험도

LOW

STATUS=success ISSUES=5 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/concurrency.md RESET_HINT=
