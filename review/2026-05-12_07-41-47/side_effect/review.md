### 발견사항

---

**[CRITICAL] `trust proxy: true` 전역 신뢰 설정**
- 위치: `main.ts` — `expressInstance.set('trust proxy', true)`
- 상세: Boolean `true`를 전달하면 Express는 X-Forwarded-For 체인의 모든 홉을 무조건 신뢰한다. Cloudflare가 앞에 한 단계만 있으므로 `1`(숫자) 또는 Cloudflare IP CIDR 목록이어야 한다. `true`로 설정하면 Cloudflare를 우회해서 직접 접근한 공격자가 임의의 `X-Forwarded-For` 헤더를 삽입해 IP를 위조할 수 있으며, ThrottlerModule의 IP 기반 속도 제한도 우회된다. `client-ip.ts` 보안 주석에서 동일 위험을 언급했으나 `main.ts`에서 근본 조치가 누락됐다.
- 제안: `expressInstance.set('trust proxy', 1)` 또는 Cloudflare IP 범위를 명시적으로 지정

---

**[WARNING] `refresh()` / 재사용 감지에서 `stored.user` 관계 미로드**
- 위치: `auth.service.ts` — refresh 흐름 내 `if (stored.user)` 블록
- 상세: `logout()`은 명시적으로 `relations: ['user']`를 추가했으나 `refresh()`는 추가하지 않았다. TypeORM lazy loading이 활성화되지 않은 환경에서는 `stored.user`가 항상 `undefined`가 되어, 재사용 감지(`token_reuse_detected`) 이벤트와 이후 `generateTokens`로 전달되는 `user` 객체가 undefined가 될 수 있다. `generateTokens`가 이 `user`를 직접 사용한다면 런타임 오류로 번진다.
- 제안: `refresh()` 내 `findOne`에도 `relations: ['user']` 추가 (logout과 동일하게)

---

**[WARNING] React Query `onError` 내 재throws → Unhandled Rejection**
- 위치: `sessions-panel.tsx` — `revokeMutation.onError` 콜백
- 상세: `mutateAsync`는 에러 시 이미 throw한다. `onError` 콜백 내에서 다시 `throw`하면 React Query v5에서 두 번째 unhandled promise rejection이 발생한다. `RevokeConfirmDialog`의 `handleConfirm`이 `mutateAsync`의 throw를 catch해 인라인 에러를 표시하는 의도라면 `onError` 내 `throw`는 불필요하고 부작용을 유발한다.
- 제안: `onError`에서 `throw` 제거. `mutateAsync`의 throw만으로 다이얼로그 에러 표시 흐름 충분

---

**[WARNING] 프론트엔드 `reauthMode` 추론 오류 가능성**
- 위치: `sessions-panel.tsx` — `reauthMode` useMemo
- 상세: `useAuthStore`에서 읽는 `user` 객체의 `twoFactorEnabled` 필드가 JWT payload에 포함되지 않는 경우 항상 `undefined`이므로 `has2fa = false` → `reauthMode = 'password'`가 된다. 2FA만 있고 비밀번호가 없는 OAuth 사용자가 비밀번호 다이얼로그를 받게 된다. 서버가 `REAUTH_NOT_AVAILABLE(403)` 또는 `PASSWORD_INVALID(401)`을 반환할 때까지 사용자는 비밀번호 입력 화면을 보게 되는 UX 퇴행이 발생한다.
- 제안: `/users/me` 응답 또는 JWT payload에 `twoFactorEnabled` 포함 여부 확인; 없다면 별도 API 호출로 보완

---

**[INFO] `LoginHistoryService.record()` 무음 실패**
- 위치: `login-history.service.ts` — `record()` catch 블록
- 상세: 의도적 설계이지만 DB 다운, 제약 위반 등 모든 오류가 `logger.warn`만 남기고 삼켜진다. 이벤트 누락이 모니터링 알림 없이 발생하고, 메트릭/감사 도구가 이 경고를 별도로 추적하지 않는다면 무음 데이터 손실이 장기간 지속될 수 있다.
- 제안: `logger.warn` 외 메트릭 카운터(Prometheus 등) 증분 추가

---

**[INFO] 타임스탬프 기반 커서 페이징에서 중복/누락 위험**
- 위치: `login-history.service.ts` — `findForUser()`, `lh.created_at < :cursor`
- 상세: 동일한 `created_at` 값을 가진 이벤트가 커서 경계에 걸릴 경우 일부가 누락된다. 빠른 연속 이벤트(자동화된 공격 등)에서 실제로 발생할 수 있다.
- 제안: 복합 커서 `(created_at, id)` 방식으로 전환하거나 `id` 기반 보조 정렬 조건 추가

---

**[INFO] `session_revoked` 이벤트에 `failureReason: 'revoke_others'` 혼용**
- 위치: `sessions.service.ts` — `revokeOtherFamilies()` 내 `loginHistory.record` 호출
- 상세: `failure_reason` 컬럼은 `login_failed`/`totp_failed` 등 실패 이벤트의 원인 코드를 위한 필드다. 성공적인 일괄 종료 이벤트(`session_revoked`)에 `failureReason: 'revoke_others'`를 넣는 것은 필드 의미를 왜곡한다. DB 제약 위반은 없지만 이력 조회 시 `failureReason`이 UI에 노출된다.
- 제안: 일괄 종료 메타데이터는 `familyId: null`로만 구분하거나 별도 컬럼/메타 필드 활용

---

**[INFO] `plan/in-progress/auth-sessions.md` 체크박스 불일치**
- 위치: `plan/in-progress/auth-sessions.md` — Backend·Frontend 섹션
- 상세: 다수 항목이 `[ ]` 미완료로 표시되어 있으나 이번 diff에 해당 구현이 모두 포함돼 있다. plan 문서가 실제 상태를 반영하지 못해 후속 작업자의 혼란을 유발한다.
- 제안: 완료된 항목 체크 처리 후, 미완료 항목(lint/build/e2e 검증 등)만 남기고 `plan/complete/`로 이동 검토

---

### 요약

전체적으로 설계 의도가 명확하고 새 컴포넌트(LoginHistoryService·SessionsService)는 에러를 삼켜 기존 인증 흐름을 보호하는 방어적 패턴을 잘 따른다. 그러나 `trust proxy: true` 설정이 IP 위조 방어와 ThrottlerModule의 신뢰성을 실질적으로 약화시키는 치명적 부작용을 유발하고, `refresh()` 경로에서 User 관계가 로드되지 않아 reuse 감지 이벤트 기록과 `generateTokens` 호출이 런타임에 실패할 수 있다. 프론트엔드에서는 `onError` 재throw로 인한 Unhandled Rejection과 `reauthMode` 추론 오류가 UX 퇴행 및 콘솔 노이즈를 야기한다.

### 위험도

**HIGH** (`trust proxy: true`로 인한 IP 위조 벡터 + `refresh()` 내 User 관계 미로드로 인한 잠재적 런타임 오류)