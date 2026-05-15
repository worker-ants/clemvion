### 발견사항

- **[INFO]** `auth.controller.ts` — 쿠키 타입 캐스팅 중복
  - 위치: `auth.controller.ts` `logout()` L65, `refresh()` L83
  - 상세: `(req as unknown as { cookies: Record<string, string> }).cookies?.refreshToken` 패턴이 두 메서드에 동일하게 반복됨. 향후 `cookies` 타입이 변경되면 두 곳을 동시에 수정해야 함
  - 제안: `private getCookieToken(req: Express.Request): string | undefined` 헬퍼 메서드로 추출

- **[INFO]** `auth.controller.ts` — 쿠키 만료 시간 매직 넘버
  - 위치: `auth.controller.ts` `setRefreshTokenCookie()` L127-128
  - 상세: `30 * 24 * 60 * 60 * 1000`, `7 * 24 * 60 * 60 * 1000`이 인라인 계산으로 하드코딩됨. 숫자 자체는 readable하나 상수로 명명하면 의도 파악이 더 명확함
  - 제안: `REMEMBER_ME_COOKIE_MAX_AGE`, `DEFAULT_COOKIE_MAX_AGE` 상수로 추출

- **[INFO]** `client.ts` — 모듈 레벨 가변 상태 3개 집중
  - 위치: `client.ts` — `accessToken`, `refreshPromise`, `sessionRestoreInProgress`
  - 상세: 모듈 레벨에 3개의 가변 상태가 분산되어 있어, 테스트에서 `vi.resetModules()` + dynamic import로 상태를 초기화해야 하는 복잡한 패턴이 강제됨. 상태 간 관계가 암묵적임
  - 제안: 현재 규모에서는 허용 가능. 상태가 더 늘어날 경우 `TokenState` 객체로 묶거나 테스트용 `__resetForTest()` export 고려

- **[INFO]** `client.ts` — `setSessionRestoreInProgress`와 인터셉터 간 암묵적 결합
  - 위치: `client.ts` L37-39, L85
  - 상세: `setSessionRestoreInProgress(true)` 호출이 응답 인터셉터의 `window.location.href` redirect를 억제한다는 사실이 함수 이름만으로는 드러나지 않음. `auth-provider.tsx`에서 이 함수를 호출하는 개발자는 해당 부작용을 알기 위해 `client.ts` 인터셉터 코드를 직접 읽어야 함
  - 제안: 함수 선언부에 간략한 인라인 주석 추가: `// Suppresses interceptor redirect during session restore`

- **[INFO]** `client.test.ts` — `beforeEach` 모듈 재로드 패턴의 복잡도
  - 위치: `client.test.ts` L7-11
  - 상세: 각 테스트마다 `vi.resetModules()` + dynamic `import()`를 수행하여 상태를 초기화함. 테스트 수가 늘어나면 실행 시간이 선형 증가하고, 패턴이 낯선 개발자에게 진입 장벽이 됨
  - 제안: 현재 4개 테스트에서는 허용 가능. 테스트가 늘어나면 `client.ts`에 `__resetForTest`용 함수를 export하는 방식으로 전환 권장

- **[INFO]** `auth-provider.tsx` — `restoreSession` 내 복합 책임
  - 위치: `auth-provider.tsx` L26-56
  - 상세: 로딩 상태 관리, 세션 복원 플래그, API 호출, 인증 상태 설정, 에러 처리, 리다이렉트 로직이 약 30줄에 집중됨. 현재 HttpOnly cookie 단일 경로로 단순화되어 이전보다 나아졌으나, 추가 복원 경로가 생기면 즉시 복잡도 임계점에 도달함
  - 제안: 현재 규모에서는 허용 가능. 분기 추가 시 `tryRestoreFromCookie()` 분리 필요

---

### 요약

이번 변경은 이전 리뷰에서 지적된 sessionStorage 보안 이슈, 동시성 문제, 이중 리다이렉트 충돌을 잘 해소했으며, 전반적으로 코드 구조가 명확해졌다. 유지보수성 관점에서 즉각적인 위험은 없다. 개선 여지가 있는 사항으로는 `auth.controller.ts`의 쿠키 타입 캐스팅 중복과 매직 넘버, `setSessionRestoreInProgress`와 인터셉터 간 암묵적 결합 관계가 주석 없이 전달되는 점, 테스트의 `vi.resetModules()` 패턴이 모듈 레벨 가변 상태의 직접적 산물임을 인지하고 있어야 한다는 점이 있다. 현재 규모에서는 모두 INFO 수준의 개선 사항으로, 즉각 조치보다는 코드베이스가 확장될 시점에 함께 처리하는 것이 적절하다.

### 위험도
**LOW**