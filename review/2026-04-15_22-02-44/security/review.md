## 발견사항

### **[WARNING]** `OAUTH_STUB_MODE` 프로덕션 우회 위험
- **위치:** `auth-oauth.service.ts` — `getEnabledProviders()`, `exchangeCodeForToken()`, `fetchProfile()`
- **상세:** `OAUTH_STUB_MODE=true`가 프로덕션 환경에 잘못 설정될 경우, OAuth 인증 전체가 우회됩니다. `exchangeCodeForToken`은 실제 code 교환 없이 stub 토큰을 반환하고, `fetchProfile`은 무작위 이메일 주소로 프로필을 생성합니다. 즉, 어떤 OAuth 콜백이라도 성공하며 임의 사용자 계정이 생성됩니다.
- **제안:** 빌드 타임 또는 앱 시작 시점에 프로덕션 환경(`NODE_ENV=production`)에서 `OAUTH_STUB_MODE=true`이면 즉시 서버를 중단시키는 가드 추가. ConfigService를 통해 타입-세이프하게 관리하고 `process.env` 직접 읽기를 지양:
  ```typescript
  // app bootstrap 단계
  if (process.env.NODE_ENV === 'production' && process.env.OAUTH_STUB_MODE === 'true') {
    throw new Error('OAUTH_STUB_MODE must not be enabled in production');
  }
  ```

---

### **[WARNING]** Access Token URL 파라미터 전달
- **위치:** `auth.controller.ts` — `oauthCallback()` 메서드
- **상세:**
  ```typescript
  `${frontendUrl}/callback?success=true&token=${encodeURIComponent(result.accessToken)}`
  ```
  Access Token이 URL 쿼리 파라미터로 전달됩니다. URL은 브라우저 히스토리, 서버 액세스 로그, Referrer 헤더, CDN/프록시 로그에 기록될 수 있어 토큰이 의도치 않게 유출될 수 있습니다.
- **제안:** 단기(예: 30초) 일회용 교환 코드(exchange code)를 DB에 저장하고, 프론트엔드 `/callback`에서 해당 코드를 서버로 교환하여 실제 토큰을 획득하는 방식으로 변경. 스펙에 "클라이언트가 즉시 메모리에 저장 후 URL 정리"가 명시되어 있으나, 정리 이전의 로그 노출 구간을 제거하는 것이 근본적 해결책입니다.

---

### **[WARNING]** 공개 엔드포인트를 통한 서버 설정 노출
- **위치:** `auth.controller.ts` — `getOauthProviders()`, `auth-oauth.service.ts` — `getEnabledProviders()`
- **상세:** `GET /api/auth/oauth/providers`는 인증 없이 접근 가능하며(`@Public()`), `Cache-Control: public, max-age=300`으로 CDN/프록시 캐싱도 허용됩니다. 이 응답은 서버에 어떤 OAuth 자격증명이 설정되어 있는지를 공개하며, 공격자의 공격 표면 파악에 활용될 수 있습니다.
- **제안:** 엔드포인트 자체는 UI 목적상 설계적 결정이나, `Cache-Control: private` 또는 `no-store` 검토 필요. 최소한 `Vary: Accept-Encoding` 헤더를 추가하고, 장기적으로는 프론트엔드 빌드 타임 환경변수로 처리하는 방안을 고려하세요.

---

### **[INFO]** `NEXT_PUBLIC_API_URL`의 서버 사이드 fetch 사용
- **위치:** `frontend/src/lib/api/auth-providers.ts`
- **상세:** `NEXT_PUBLIC_` prefix는 클라이언트 번들에 포함되는 환경변수입니다. Server Component에서 이를 사용하면 서버가 외부(클라이언트용) URL로 자기 자신을 호출하게 됩니다. 내부 네트워크 환경(Docker, K8s)에서 외부 URL이 접근 불가능하거나 불필요한 네트워크 홉이 발생할 수 있습니다.
- **제안:** 서버 사이드 전용 환경변수(`INTERNAL_API_URL` 또는 `API_BASE_URL`)를 별도로 사용하여 내부 서비스 통신에 활용:
  ```typescript
  const SERVER_API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3011/api";
  ```

---

### **[INFO]** 테스트에서 `process.env` 직접 재할당
- **위치:** `auth-oauth.service.spec.ts` — `afterAll(() => { process.env = originalEnv; })`
- **상세:** `process.env`를 다른 객체로 교체하는 방식은 Node.js의 `process.env`가 특수 객체(환경 블록을 직접 참조)이므로 테스트 간 격리가 불완전할 수 있습니다. 일부 환경에서 기존 참조가 원본 env를 계속 읽어 테스트 오염이 발생할 수 있습니다.
- **제안:** `jest.spyOn(process, 'env', 'get')` 또는 개별 키 복원 패턴 사용:
  ```typescript
  afterEach(() => {
    process.env.OAUTH_STUB_MODE = originalEnv.OAUTH_STUB_MODE;
    // ...
  });
  ```

---

## 요약

이번 변경은 OAuth 프로바이더 목록을 서버에서 동적으로 조회하여 UI를 제어하는 기능을 추가한 것으로, 전반적인 설계는 적절합니다. SQL 인젝션(파라미터화된 쿼리 사용), XSS(하드코딩된 provider 문자열만 URL에 사용), CSRF(충분한 엔트로피의 state 값) 등 주요 취약점은 잘 방어되어 있습니다. 그러나 `OAUTH_STUB_MODE`가 프로덕션에 활성화될 경우 완전한 인증 우회가 발생한다는 점이 가장 심각한 위험입니다. Access Token을 URL 파라미터로 전달하는 패턴도 로그 기반 토큰 유출 위험이 있어 장기적으로 개선이 필요합니다.

## 위험도

**MEDIUM**