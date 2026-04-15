### 발견사항

**[INFO]** `API_BASE_URL` 상수 중복 선언
- 위치: `login-form.tsx:34`, `register-form.tsx:36`
- 상세: 동일한 `API_BASE_URL` 상수가 두 파일에 각각 정의되어 있음
- 제안: `@/lib/api/client.ts` 또는 `@/lib/constants.ts`에 공통 상수로 추출

**[INFO]** `startOauth` 함수 로직 중복
- 위치: `login-form.tsx:54-56`, `register-form.tsx:38-40`
- 상세: OAuth 시작 로직이 두 컴포넌트에 거의 동일하게 구현되어 있음. `login-form`은 `rememberMe` 파라미터를 추가로 처리하는 차이만 있음
- 제안: 공통 훅 `useOAuthRedirect(mode)` 또는 유틸 함수로 추출

**[WARNING]** `generateTokens` 가시성 변경의 의도 불명확
- 위치: `auth.service.ts:299`
- 상세: `private` → `public`으로 변경되었는데, 이는 서비스 내부 헬퍼가 외부에 노출됨을 의미함. `AuthOauthService`가 직접 호출하기 위해 변경된 것으로 보이지만, 서비스 간 직접 의존보다 인터페이스나 내부 메서드 패턴이 더 명확함
- 제안: `protected` 또는 `@Internal()` 주석 추가로 의도를 명시하거나, 토큰 발급 책임을 별도 `TokenService`로 분리 검토

**[INFO]** `requireEnv`가 `ConfigService` 대신 `process.env` 직접 참조
- 위치: `auth-oauth.service.ts:177-183`
- 상세: 프로젝트 전반에서 `ConfigService`를 통해 환경변수를 참조하는 패턴을 사용하고 있으나, `requireEnv`는 `process.env`를 직접 읽음. `redirectUri`도 동일한 혼용 패턴
- 제안: `configService.get<string>(...)` 패턴으로 통일하거나, 두 방식의 의도적 차이를 주석으로 명시

**[INFO]** `mapOauthError` 함수가 컨트롤러 파일 최하단에 모듈 외부 함수로 선언
- 위치: `auth.controller.ts:433-452`
- 상대: NestJS 프로젝트에서 컨트롤러 파일 내 자유 함수(non-class function)는 비관용적 패턴. 컨트롤러 내 `private` 메서드이거나 별도 유틸 파일이 더 자연스러움
- 제안: `AuthController` 클래스 내 `private mapOauthError(err: unknown): string`으로 이동

**[INFO]** `oauthCallback`에서 `frontendUrl` 폴백 하드코딩
- 위치: `auth.controller.ts:360`
- 상세: `?? 'http://localhost:3002'` 폴백이 컨트롤러 내부에 매직 스트링으로 존재. `app.config.ts`에 이미 `frontendUrl` 설정이 있을 가능성이 높음
- 제안: 설정 모듈에서 기본값을 관리하고 컨트롤러에서는 단순히 `configService.get`만 호출

**[INFO]** 테스트에서 `AuthOauthService` 인스턴스를 `as unknown as AuthOauthService`로 캐스팅
- 위치: `auth.controller.spec.ts:27-30`
- 상세: 필요한 메서드만 목킹하는 패턴 자체는 정상이나, `jest.Mocked<AuthOauthService>` 타입을 사용하면 타입 안전성이 향상됨
- 제안: `as unknown as jest.Mocked<AuthOauthService>` 또는 `createMock<AuthOauthService>()` 유틸 활용

**[INFO]** `auth.service.ts` 내 `console.log` DEBUG 코드 잔존
- 위치: `auth.service.ts:221-228`
- 상세: 이번 변경과 무관하지만 리뷰 범위 내에서 발견. `[DEBUG refresh]` 로그가 프로덕션 코드에 잔류
- 제안: `this.logger.debug(...)`로 교체하거나 제거

---

### 요약

전반적으로 OAuth 인증 플로우가 명확한 관심사 분리(컨트롤러/서비스/엔티티/마이그레이션)와 함께 일관되게 구현되어 있으며, 상태 원자적 소비(`DELETE ... RETURNING`) 및 에러 코드 매핑 등 유지보수성을 고려한 설계가 돋보입니다. 다만 프론트엔드의 `API_BASE_URL`과 `startOauth` 로직 중복, 컨트롤러 파일의 자유 함수 패턴, `generateTokens`의 `public` 노출 의도 불명확, `process.env` 직접 참조 혼용 등 소소한 일관성 이슈들이 있어 장기 유지보수 시 혼란 요소가 될 수 있습니다.

### 위험도

**LOW**