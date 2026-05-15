## 발견사항

### [CRITICAL] `AuthController`의 새 OAuth 엔드포인트 테스트 전무
- **위치**: `auth.controller.spec.ts`
- **상세**: `beginOauth`, `oauthCallback` 두 엔드포인트가 추가되었으나 `auth.controller.spec.ts`에 관련 테스트가 단 하나도 없음. `mockOauthService` 주입만 추가되고 실제 동작 검증은 없음.
- **제안**: 다음 케이스를 반드시 추가해야 함:
  - `beginOauth`: 정상 리다이렉트, `rememberMe=true` 전달, 지원하지 않는 provider
  - `oauthCallback`: `providerError` 쿼리 파라미터 존재 시, `code`/`state` 누락 시, 정상 성공(쿠키 설정 + 리다이렉트), 각 에러 코드별 리다이렉트 URL 검증

---

### [CRITICAL] `mapOauthError` 함수 미테스트
- **위치**: `auth.controller.ts` 파일 하단 모듈 레벨 함수
- **상세**: 에러 코드를 사용자 노출 문자열로 매핑하는 핵심 함수임에도 전혀 테스트되지 않음. `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `OAUTH_PROVIDER_UNKNOWN` → `invalid_state`, `OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_PROFILE_FAILED` → `token_exchange_failed`, `OAUTH_EMAIL_REQUIRED` → `email_required`, 그 외 → `server_error` 분기 모두 미검증.
- **제안**: 함수를 export하거나, `oauthCallback` 통합 테스트를 통해 각 에러 코드가 올바른 리다이렉트 URL을 생성하는지 검증.

---

### [WARNING] `handleCallback`의 `rememberMe: true` 전파 미검증
- **위치**: `auth-oauth.service.spec.ts` → `handleCallback` 테스트 블록
- **상세**: 모든 `handleCallback` 테스트가 `validState.rememberMe = false`로 고정되어 있음. `rememberMe: true`일 때 `authService.generateTokens(user, true)` 호출 여부와 반환값의 `rememberMe: true` 전파가 검증되지 않음.
- **제안**:
  ```ts
  it('propagates rememberMe=true', async () => {
    dataSource.query.mockResolvedValueOnce([{ ...validState, rememberMe: true }]);
    usersService.findByOauth.mockResolvedValue(baseUser as User);
    const result = await service.handleCallback('google', 'code', 'abc');
    expect(result.rememberMe).toBe(true);
    expect(authService.generateTokens).toHaveBeenCalledWith(baseUser, true);
  });
  ```

---

### [WARNING] `beginAuth` 저장 내용 미검증
- **위치**: `auth-oauth.service.spec.ts` → `beginAuth` → `persists state and returns Google authorize URL`
- **상세**: `stateRepo.save`가 1회 호출되었음만 확인하고 저장된 state 객체의 내용(provider, mode, rememberMe, expiresAt 범위)을 검증하지 않음.
- **제안**:
  ```ts
  expect(stateRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'google',
      mode: 'login',
      rememberMe: false,
      expiresAt: expect.any(Date),
    }),
  );
  ```

---

### [WARNING] `UsersService.findByOauth` 테스트 누락
- **위치**: `backend/src/modules/users/users.service.ts:20-27`
- **상세**: 신규 추가된 `findByOauth` 메서드에 대한 `users.service.spec.ts` 테스트가 없음. `oauthProvider`/`oauthProviderId` 컬럼 기반 조회 정확성 검증 불가.
- **제안**: `users.service.spec.ts`에 `findByOauth` 단위 테스트 추가. 매칭 성공/실패 케이스 모두 포함.

---

### [WARNING] `authService.generateTokens` 가시성 변경 후 계약 테스트 부재
- **위치**: `auth.service.ts:299` (`private` → `public`)
- **상세**: `AuthOauthService`가 호출할 수 있도록 접근자가 변경되었으나, 외부 호출자 관점의 계약(입력/출력)을 검증하는 테스트가 없음. 내부 구현 변경 시 회귀 탐지가 어려움.
- **제안**: `auth-oauth.service.spec.ts`에서 이미 mock으로 처리하고 있으므로 수용 가능하나, `auth.service.spec.ts`에 공개 API로서의 호출 시나리오를 명시적으로 추가 권장.

---

### [WARNING] 프론트엔드 `startOauth` 함수 테스트 없음
- **위치**: `login-form.tsx:54-57`, `register-form.tsx:37-39`
- **상세**: `window.location.href` 변경을 통한 OAuth 리다이렉트 로직이 테스트되지 않음. `NEXT_PUBLIC_API_URL` 환경변수 미설정 시 fallback URL 사용, `rememberMe` 값 반영 여부 등 미검증.
- **제안**: `jsdom` 환경에서 `window.location.href` 모킹 후 클릭 이벤트 검증 테스트 추가.

---

### [INFO] `purgeExpired` 내부 동작 미테스트
- **위치**: `auth-oauth.service.ts:purgeExpired`
- **상세**: `beginAuth` 호출 시 `void this.purgeExpired()`가 fire-and-forget으로 실행되지만 테스트에서 `stateRepo.delete` 호출 여부가 검증되지 않음. 오류 발생 시 경고 로그만 남기고 무시하는 동작도 미검증.
- **제안**: `purgeExpired`가 `stateRepo.delete`를 `LessThan(new Date())`와 함께 호출하는지 검증하는 테스트 추가.

---

### [INFO] `handleCallback`의 `usersService.update` 후 `generateTokens` 인자 검증 부족
- **위치**: `auth-oauth.service.spec.ts` → `links existing email user with OAuth`
- **상세**: `usersService.update` 호출이 검증되지만 그 반환값(업데이트된 User)이 `authService.generateTokens`에 올바르게 전달되는지 검증하지 않음.
- **제안**: `usersService.update.mockResolvedValue(updatedUser)`로 명확히 설정 후 `expect(authService.generateTokens).toHaveBeenCalledWith(updatedUser, false)` 검증 추가.

---

## 요약

핵심 비즈니스 로직인 `AuthOauthService`는 8개의 유닛 테스트로 주요 분기를 대체로 잘 커버하고 있으나, `AuthController`의 신규 OAuth 엔드포인트(`beginOauth`, `oauthCallback`)와 에러 매핑 함수(`mapOauthError`)에 대한 테스트가 전혀 없는 것이 가장 큰 문제다. 이 두 엔드포인트는 사용자와 직접 맞닿는 진입점으로서 리다이렉트 URL 구성, 쿠키 설정 타이밍, 에러 코드 전파 등의 동작 검증이 필수적이다. 또한 `rememberMe: true` 흐름, `findByOauth` 메서드, 프론트엔드 OAuth 리다이렉트 로직의 테스트 공백이 존재하여 회귀 탐지 능력이 저하된 상태다.

## 위험도

**HIGH**