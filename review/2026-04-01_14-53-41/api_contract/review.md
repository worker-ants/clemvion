### 발견사항

---

**[WARNING]** `POST /auth/refresh` — 에러 응답 코드 변경 (400 → 401)
- **위치**: `refresh-token.dto.ts` + `auth.controller.ts:83-87`
- **상세**: `refreshToken`이 `required → optional`로 변경됨에 따라, body에 토큰 미포함 시 기존 class-validator의 **400 Bad Request** 대신 컨트롤러의 **401 Unauthorized**가 반환됨. 동일한 "토큰 없음" 입력에 대해 HTTP 상태 코드가 변경되는 behavioral breaking change. 기존 클라이언트가 400을 기준으로 에러 분기를 처리한다면 영향을 받음.
- **제안**: API 문서에 에러 코드 변경을 명시하고, 기존 클라이언트의 에러 핸들러 분기 확인 필요.

---

**[WARNING]** `UnauthorizedException` 응답 구조 불일치
- **위치**: `auth.controller.ts:83-87` — `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`
- **상세**: NestJS 기본 직렬화 시 실제 응답 구조는 `{ statusCode: 401, message: { code: 'TOKEN_INVALID', message: '...' }, error: 'Unauthorized' }` — `message` 필드가 문자열이 아닌 중첩 객체가 됨. 프로젝트 성공 응답(`{ data: {...} }`)과 스키마가 불일치하며, 클라이언트 인터셉터가 `error.response.data.message`를 문자열로 처리할 경우 예상치 못한 동작이 발생함.
- **제안**: 글로벌 예외 필터 유무를 확인. 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화하거나, 프로젝트 전역 에러 컨벤션을 글로벌 필터에서 통일 처리.

---

**[WARNING]** `@IsString()` / `@IsOptional()` 데코레이터 순서 역전
- **위치**: `refresh-token.dto.ts:3-5`
- **상세**: class-validator 관례상 `@IsOptional()`이 `@IsString()` **위**에 선언되어야 값이 없을 때 이후 검증자를 올바르게 건너뜀. 현재 `@IsString() → @IsOptional()` 순서는 라이브러리 버전에 따라 `undefined` 값에 대해 `@IsString()` 검증이 먼저 실행되어 의도치 않은 400 에러가 발생할 수 있음.
- **제안**:
  ```ts
  @IsOptional()
  @IsString()
  refreshToken?: string;
  ```

---

**[INFO]** `POST /auth/logout` — `clearCookie` path 추가
- **위치**: `auth.controller.ts:71` — `res.clearCookie('refreshToken', { path: '/' })`
- **상세**: 쿠키 설정 시 `path: '/'`를 사용하므로 삭제 시에도 동일한 path를 지정해야 실제로 삭제됨. 이번 수정 이전에는 path 불일치로 로그아웃 후에도 refresh token 쿠키가 브라우저에 잔존하는 버그가 있었음. 계약상 breaking change 아님.
- **제안**: 없음 (올바른 수정).

---

**[INFO]** `POST /auth/refresh` — 쿠키 우선 토큰 공급 흐름 명시화
- **위치**: `auth.controller.ts:82-86` + `client.ts` — `doRefresh()`
- **상세**: 프론트엔드 `doRefresh()`가 빈 body `{}`로 요청하고, 백엔드는 쿠키 우선으로 토큰을 읽음. `RefreshTokenDto.refreshToken`이 optional이므로 이 흐름은 유효성 검증을 통과. 쿠키 기반 자동 갱신 계약이 클라이언트-서버 간 일관되게 구현됨.
- **제안**: API 문서에 "토큰 공급 우선순위: HttpOnly 쿠키 > body.refreshToken" 명시 권장.

---

**[INFO]** Refresh Token의 Body Fallback 유지 — 잠재적 로그 노출 경로
- **위치**: `auth.controller.ts:84` — `dto.refreshToken`
- **상세**: Refresh Token이 HttpOnly 쿠키(기본)와 Request Body(`dto.refreshToken`) 두 경로로 모두 수락됨. Body로 전송된 토큰은 서버 액세스 로그, 리버스 프록시 로그에 기록될 가능성이 있어 HttpOnly 쿠키의 보안 격리가 무력화될 수 있음. 현재 `doRefresh()`는 빈 body를 전송하므로 정상 경로는 안전하나 공격 경로로 활용될 수 있음.
- **제안**: Body fallback 제거 검토. 쿠키가 없는 경우 `UnauthorizedException`만 반환하는 것으로 충분함.

---

### 요약

이번 변경의 핵심 API 계약 이슈는 두 가지다. 첫째, `RefreshTokenDto.refreshToken`의 required → optional 전환으로 "토큰 없음" 입력에 대한 에러 코드가 400에서 401로 변경되는 behavioral breaking change가 발생한다. 둘째, `UnauthorizedException`에 객체를 전달하는 방식이 실제 응답의 `message` 필드를 중첩 객체로 만들어 프로젝트의 에러 응답 스키마와 불일치할 수 있다. `clearCookie`에 `path: '/'` 추가는 실제 쿠키 삭제 버그를 수정하는 올바른 변경이며, 쿠키 기반 refresh 흐름의 명시화는 계약 일관성을 높인다. 프론트엔드 변경(`auth-provider.tsx`, `client.ts`)은 API 계약과 무관한 클라이언트 내부 구현 변경이다.

### 위험도
**LOW**