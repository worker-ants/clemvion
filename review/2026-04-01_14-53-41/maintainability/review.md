### 발견사항

---

**[INFO]** `auth.controller.ts` — 쿠키 토큰 추출 패턴 중복
- 위치: `logout()` L65, `refresh()` L83
- 상세: `(req as unknown as { cookies: Record<string, string> }).cookies?.refreshToken` 타입 캐스팅이 두 메서드에 동일하게 반복됨. 타입 구조 변경 시 두 곳을 동시에 수정해야 하는 유지보수 부담 발생
- 제안: `private getRefreshTokenFromCookie(req: Express.Request): string | undefined` 헬퍼 메서드로 추출

---

**[INFO]** `refresh-token.dto.ts` — `@IsOptional()` 데코레이터 순서
- 위치: `refresh-token.dto.ts:3-5`
- 상세: class-validator 관례상 `@IsOptional()`이 먼저 선언되어 값 부재 시 이후 검증자를 건너뜀. 현재 `@IsString()` → `@IsOptional()` 순서는 의도와 역순이며 라이브러리 버전에 따라 동작이 달라질 수 있음
- 제안: `@IsOptional()` → `@IsString()` 순서로 변경

---

**[INFO]** `client.ts` — `setSessionRestoreInProgress` 함수명과 부작용 불일치
- 위치: `client.ts:40-42`
- 상세: 함수명만으로는 401 인터셉터의 `window.location.href` 리다이렉트를 억제한다는 핵심 부작용이 드러나지 않음. `AuthProvider`에서 호출하는 개발자가 `client.ts` 인터셉터를 직접 읽어야 의도 파악 가능
- 제안: 함수 선언부 직전에 한 줄 주석 추가 — `// Suppresses interceptor redirect to /login during session restore`

---

**[INFO]** `client.ts` — 모듈 레벨 가변 상태 3개 집중
- 위치: `client.ts:14, 32, 36`
- 상세: `accessToken`, `refreshPromise`, `sessionRestoreInProgress` 세 상태가 모듈 최상위에 분산. 상태 간 관계가 암묵적이고, 테스트에서 격리를 위해 `vi.resetModules()` + dynamic import 패턴을 강제하게 됨
- 제안: 현재 규모에서는 허용 가능. 상태 추가 시 `__resetForTest()` export 또는 `TokenState` 객체 그룹화 고려

---

**[INFO]** `auth-provider.tsx` — `restoreSession`의 복합 책임
- 위치: `auth-provider.tsx:26-56`
- 상세: 로딩 상태 관리, 세션 복원 플래그, API 호출, 인증 상태 설정, 에러 처리, 리다이렉트 로직이 약 30줄에 집중. 현재 단일 경로(HttpOnly cookie)라 이전보다 명확해졌으나, 복원 경로 추가 시 즉시 복잡도 임계점 도달
- 제안: 현재 규모에서는 허용 가능. 분기 추가 시 `tryRestoreFromCookie()` 분리 필요

---

**[INFO]** `auth-provider.tsx` — `setLoading(false)` 암묵적 의존
- 위치: `auth-provider.tsx:26`, finally 블록
- 상세: `setLoading(true)`로 시작하지만 `finally`에서 `setSessionRestoreInProgress(false)`만 호출하고 `setLoading(false)` 없음. 로딩 해제를 `setAuthenticated()`/`logout()` 내부 구현에 암묵적으로 위임 — 스토어 액션 변경 시 로딩 스피너 무기한 표시 가능
- 제안: `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리

---

**[INFO]** `client.test.ts` — `beforeEach` 모듈 재로드 패턴 복잡도
- 위치: `client.test.ts:7-11`
- 상세: 각 테스트마다 `vi.resetModules()` + dynamic import로 모듈 전체를 재로드. 모듈 레벨 가변 상태의 직접적 산물이며 테스트 수 증가 시 실행 시간 선형 증가 및 패턴 파악 비용 발생
- 제안: 테스트가 늘어나면 `client.ts`에 `export function __resetForTest()` 함수를 추가하여 대체

---

### 요약

이번 변경은 이전 리뷰에서 지적된 sessionStorage 보안, 동시성, 이중 리다이렉트 이슈를 해소하여 전반적으로 코드 구조가 명확해졌다. 유지보수성 관점에서 즉각적인 위험은 없으며 모든 발견사항이 INFO 수준이다. 주요 개선 여지는 `auth.controller.ts`의 쿠키 타입 캐스팅 중복, `setSessionRestoreInProgress`의 암묵적 부작용 미문서화, `restoreSession`의 `setLoading(false)` 암묵적 의존, `@IsOptional()` 데코레이터 순서 오류로 좁혀진다. 현재 규모에서는 모두 수용 가능한 수준이나, 특히 `setLoading(false)` 누락과 데코레이터 순서는 단순 수정으로 해결 가능하므로 선제적 조치를 권장한다.

### 위험도
**LOW**