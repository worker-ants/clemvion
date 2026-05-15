### 발견사항

**[CRITICAL] `SessionsController` 테스트 파일 없음**
- 위치: `backend/src/modules/auth/sessions.controller.ts`
- 상세: 4개 엔드포인트(listSessions, revokeSession, revokeOtherSessions, getLoginHistory)에 대응하는 spec 파일이 전혀 없음. `limit` 쿼리 파라미터 파싱 분기(`parsedLimit && Number.isFinite(...)`), `readRefreshTokenCookie` 헬퍼, `deriveDeviceLabel` 폴백 로직이 모두 미커버 상태.
- 제안: `sessions.controller.spec.ts`를 작성해 각 엔드포인트의 정상 경로와 쿠키 없는 경우를 최소한 커버할 것.

---

**[HIGH] `auth.service.spec.ts`에 보안 이벤트 기록 검증 없음**
- 위치: `backend/src/modules/auth/auth.service.spec.ts`
- 상세: `LoginHistoryService` 목을 provider에 추가했으나 `record`가 실제로 올바른 인자로 호출되는지 단언하는 테스트가 없음. `login_failed`(USER_NOT_FOUND, ACCOUNT_LOCKED, EMAIL_NOT_VERIFIED, PASSWORD_NOT_SET, INVALID_PASSWORD), `login_success`, `totp_failed`, `logout`, `token_reuse_detected` 이벤트 기록은 보안 감사 로그의 핵심인데 어떤 테스트도 `expect(loginHistory.record).toHaveBeenCalledWith(expect.objectContaining({ event: '...' }))` 형태의 단언을 하지 않음.
- 제안: 각 실패 경로와 성공 경로에서 `loginHistory.record`가 올바른 `event`·`failureReason`으로 호출되는지 검증하는 케이스를 추가.

---

**[HIGH] `LoginHistoryPrunerService` 테스트 파일 없음**
- 위치: `backend/src/modules/auth/jobs/login-history-pruner.service.ts`
- 상세: Cron job의 정상 동작(삭제 row > 0일 때 log 출력), 0 row 시 silent, 예외 catch·log 경로가 모두 미커버.
- 제안: `login-history-pruner.service.spec.ts` 작성. `pruneOlderThanRetention` 목을 주입해 세 경로를 단위 테스트.

---

**[WARNING] `sessions.service.spec.ts` — TOTP 실패·revoked=0 경로 누락**
- 위치: `backend/src/modules/auth/sessions.service.spec.ts`
- 상세: (1) `revokeFamily`에서 잘못된 TOTP 코드를 제공했을 때 `UnauthorizedException`이 발생하는 경로가 테스트되지 않음. (2) `revokeOtherFamilies`에서 `affected === 0`일 때 `loginHistory.record`를 호출하지 않아야 하는 경로가 검증되지 않음. (3) `listActiveSessions`에서 `lastUsedAt ?? createdAt` 기반 `pickNewer` 로직이 실제로 더 최신 row를 선택하는지 검증 없음.
- 제안: TOTP 실패 케이스, revoked=0 케이스, pickNewer 동작 케이스를 각각 추가.

---

**[WARNING] `login-history.service.spec.ts` — 경계값 미커버**
- 위치: `backend/src/modules/auth/login-history.service.spec.ts`
- 상세: (1) 유효하지 않은 cursor 문자열("not-a-date") 입력 시 `andWhere`가 호출되지 않아야 하는 경로 미테스트. (2) `pruneOlderThanRetention`에서 `result.affected`가 `null`일 때 0을 반환해야 하는 경로 미테스트. (3) `record` 호출 시 `userAgent`가 null이면 `deviceLabel`도 null이어야 하는 케이스 미테스트.
- 제안: 세 케이스 추가. 특히 invalid cursor는 production 데이터 없이 검증 가능.

---

**[WARNING] `device-label.spec.ts` — Edge, Opera, ChromeOS, "OS만 감지" 경로 미커버**
- 위치: `backend/src/modules/auth/utils/device-label.spec.ts`
- 상세: `detectBrowser`에서 `Edg/`, `OPR/` 분기, `detectOs`에서 `CrOS` 분기, browser=null·OS=non-null일 때 "Unknown browser on macOS" 형태의 출력이 테스트되지 않음. 순서 의존성(`Edg/`가 `Chrome/`보다 앞에 검사됨)도 회귀 방어 테스트 없음.
- 제안: Edge UA, Opera UA, ChromeOS UA, browser 미감지+OS 감지 케이스를 추가.

---

**[WARNING] `auth.controller.spec.ts` — ctx 추출 로직 검증 부재**
- 위치: `backend/src/modules/auth/auth.controller.spec.ts`
- 상세: `refresh` 테스트는 `expect.objectContaining({ ip: null, userAgent: null })`만 단언해 실제 헤더에서 IP가 추출되는 경로를 검증하지 않음. OAuth callback 케이스는 `{} as never`로 ctx를 완전히 무시. `authContextFromRequest` 함수 자체가 컨트롤러 스펙에서 검증되지 않음.
- 제안: `req.headers['cf-connecting-ip']`가 채워진 mock으로 `ip` 필드가 실제 값으로 전달되는지 1~2개 케이스를 추가.

---

**[INFO] `revokeFamily` — `emailOtp` 경로 미테스트**
- 위치: `sessions.service.spec.ts`
- 상세: `RevokeSessionDto`에 `emailOtp` 필드가 정의되어 있으나 `sessions.service.ts`에서 `emailOtp`를 처리하는 분기가 없고 테스트도 없음. DTO 주석("OAuth-only + 2FA 미설정 사용자 → emailOtp 필수")과 서비스 구현 간 불일치.
- 제안: `emailOtp` 처리 로직을 서비스에 추가하거나, 현재 미구현임을 명시하는 TODO 주석을 추가.

---

**[INFO] 프론트엔드 컴포넌트 테스트 없음**
- 위치: `frontend/src/app/(main)/profile/sessions/`
- 상세: `sessions-panel.tsx`, `session-row.tsx`, `revoke-confirm-dialog.tsx`, `login-history-list.tsx`, `sessions.ts` API 래퍼 모두 테스트 없음. Vitest/React Testing Library 환경이 프로젝트에 존재한다면 최소 `RevokeConfirmDialog`의 confirm 비활성화 조건(password 비어있을 때, totp < 6자)은 단위 테스트 가치가 높음.

---

### 요약

유틸리티 레이어(`client-ip`, `device-label`)와 `LoginHistoryService`, `SessionsService`의 핵심 경로는 잘 작성된 단위 테스트로 커버되어 있어 기반은 탄탄하다. 그러나 `SessionsController` 테스트 파일의 완전 부재, 그리고 `auth.service.spec.ts`에서 `loginHistory.record` 호출 여부를 검증하는 단언이 전혀 없다는 점이 가장 큰 위험 요소다 — 서비스의 로그 기록 로직이 리팩터링으로 제거되더라도 현재 테스트는 이를 감지하지 못한다. `LoginHistoryPrunerService`도 프로덕션 데이터 삭제 작업임에도 테스트가 없어 Cron 표현식·예외 처리 경로가 검증되지 않은 상태다.

### 위험도

**HIGH**