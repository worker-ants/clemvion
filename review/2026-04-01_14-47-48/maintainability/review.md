### 발견사항

---

**[INFO]** `auth.controller.ts` — 쿠키 타입 캐스팅 중복
- 위치: `auth.controller.ts` `logout()` L65, `refresh()` L83
- 상세: `(req as unknown as { cookies: Record<string, string> }).cookies?.refreshToken` 패턴이 두 메서드에 동일하게 반복됨. 타입 구조 변경 시 두 곳을 동시에 수정해야 함
- 제안: `private getRefreshTokenFromCookie(req: Express.Request): string | undefined` 헬퍼로 추출

---

**[INFO]** `client.ts` — `setSessionRestoreInProgress`와 인터셉터 간 암묵적 결합
- 위치: `client.ts` L37-39, L85
- 상세: 함수명만으로는 인터셉터의 `window.location.href` redirect를 억제한다는 부작용이 드러나지 않음. `auth-provider.tsx`에서 호출하는 개발자가 `client.ts` 인터셉터를 직접 읽어야 의도를 파악 가능
- 제안: 함수 선언부에 인라인 주석 추가 — `// Suppresses interceptor redirect to /login during session restore`

---

**[INFO]** `client.ts` — 모듈 레벨 가변 상태 3개 (`accessToken`, `refreshPromise`, `sessionRestoreInProgress`) 집중
- 위치: `client.ts` L14, L32, L36
- 상세: 상태 간 관계가 암묵적이며, 테스트에서 격리를 위해 `vi.resetModules()` + dynamic import 패턴을 강제함. 현재 규모에서는 허용 가능하나 상태 추가 시 관리 부담 증가
- 제안: 상태가 더 늘어날 경우 `TokenState` 객체로 그룹화하거나 `__resetForTest()` export 고려

---

**[INFO]** `auth-provider.tsx` — `restoreSession` 내 복합 책임 (약 30줄)
- 위치: `auth-provider.tsx` L26-56
- 상세: 로딩 상태 관리, 세션 복원 플래그, API 호출, 인증 상태 설정, 에러 처리, 리다이렉트 로직이 한 함수에 집중됨. 현재 HttpOnly cookie 단일 경로로 단순화되어 이전보다 명확해졌으나, 복원 경로 추가 시 즉시 복잡도 임계점 도달
- 제안: 현재 규모에서는 허용 가능. 분기 추가 시 `tryRestoreFromCookie()` 분리 필요

---

**[INFO]** `client.test.ts` — `beforeEach` 모듈 재로드 패턴의 복잡도
- 위치: `client.test.ts` L7-11
- 상세: 각 테스트마다 `vi.resetModules()` + dynamic `import()`를 수행하여 상태 초기화. 모듈 레벨 가변 상태의 직접적 산물이며 테스트 수 증가 시 선형 성능 저하 및 패턴 파악 비용 발생
- 제안: 테스트가 늘어나면 `client.ts`에 `__resetForTest()` 함수를 export하여 대체

---

**[INFO]** `RefreshTokenDto` — `@IsOptional()` 데코레이터 선언 순서
- 위치: `refresh-token.dto.ts` L3-5
- 상세: `@IsString()`이 `@IsOptional()` 위에 선언됨. class-validator 관례상 `@IsOptional()`이 먼저 선언되어야 값이 없을 때 이후 검증자를 건너뛰는 동작이 명확해짐. 라이브러리 버전에 따라 동작이 달라질 수 있음
- 제안: `@IsOptional()` → `@IsString()` 순서로 변경

---

### 요약

이번 변경은 이전 리뷰에서 지적된 sessionStorage 보안 이슈, 동시 refresh 중복, 이중 리다이렉트 충돌을 해소하며 전반적으로 코드 구조가 명확해졌다. 유지보수성 관점에서 즉각적인 위험은 없으며 모든 발견사항이 INFO 수준이다. 개선 여지는 `auth.controller.ts`의 쿠키 타입 캐스팅 중복, `setSessionRestoreInProgress`의 암묵적 부작용, `restoreSession`의 책임 집중, 테스트의 모듈 재로드 패턴으로 좁혀지며 — 현재 규모에서는 수용 가능하나 코드베이스 확장 전에 정리해두면 기술 부채를 선제적으로 방지할 수 있다.

### 위험도
**LOW**