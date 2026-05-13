### 발견사항

- **[INFO]** plan 문서 상태 불일치
  - 위치: `plan/in-progress/fix-login-history-race.md`
  - 상세: 모든 체크박스(`git mv` 포함)가 `[x]` 완료 처리되어 있으나 파일이 `plan/in-progress/`에 그대로 남아 있음. CLAUDE.md 규약상 모든 항목 완료 시 `git mv`로 `plan/complete/`로 이동해야 함.
  - 제안: `git mv plan/in-progress/fix-login-history-race.md plan/complete/fix-login-history-race.md`

- **[INFO]** `forgotPassword` / `resetPassword` 경로에 audit 이벤트 없음
  - 위치: `auth.service.ts` — `forgotPassword()`, `resetPassword()`
  - 상세: diff 이전에도 존재하던 설계로 회귀는 아님. 비밀번호 재설정 요청·완료 시 `login_history` 기록이 없어 보안 audit 관점에서 사각지대가 될 수 있음.
  - 제안: 이번 PR 범위 밖이므로 별도 이슈로 추적 권장. 현 변경과 무관.

- **[INFO]** TOTP 챌린지 발급 시 history 이벤트 없음
  - 위치: `auth.service.ts:login()` — `user.twoFactorEnabled` 분기
  - 상세: TOTP 챌린지 토큰 발급 시 별도 이벤트를 기록하지 않음. `login_success`는 `loginWithTotp()` 성공 후에만 기록. 의도적인 설계로 보이나 "챌린지 발급 → 시간 초과 만료" 경로의 흔적이 history에 남지 않음.
  - 제안: 현 요구사항 범위 내 허용 가능. 필요 시 `totp_challenge_issued` 이벤트 추가를 spec 레벨에서 논의.

---

### 요약

이번 변경은 `void this.loginHistory.record(...)` → `await this.loginHistory.record(...)` 전환으로 race condition의 근본 원인을 정확히 제거했다. `record()` 내부가 이미 예외를 삼키므로 `await`로 바꿔도 인증 흐름에 새로운 실패 경로가 생기지 않는다. 13 + 2 = 15곳 전체가 빠짐없이 치환됐으며, `login-history.service.ts`의 호출 규약 주석 보강도 미래 호출자 실수를 예방한다. 실질적인 요구사항 미충족 항목은 없고, 발견된 사항은 모두 INFO 수준의 pre-existing 설계 선택 또는 문서 정리 문제다.

---

### 위험도

**LOW**