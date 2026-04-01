### 발견사항

---

**[WARNING]** `POST /auth/refresh` — 에러 응답 코드 변경 (400 → 401)
- **위치**: `refresh-token.dto.ts` + `auth.controller.ts:83-87`
- **상세**: `refreshToken`이 required → optional로 변경됨에 따라, body에 토큰 미포함 시 기존 class-validator의 **400 Bad Request** 대신 컨트롤러의 **401 Unauthorized**가 반환됨. 동일한 "토큰 없음" 입력에 대해 HTTP 상태 코드가 변경되는 breaking change.
- **제안**: 기존 클라이언트가 400으로 분기하는 경우 마이그레이션 필요. API 문서에 에러 코드 변경 명시.

---

**[WARNING]** `UnauthorizedException` 응답 구조 불일치
- **위치**: `auth.controller.ts:83-87` — `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`
- **상세**: NestJS 기본 직렬화 시 실제 응답 구조는 `{ statusCode: 401, message: { code: 'TOKEN_INVALID', message: '...' }, error: 'Unauthorized' }` — `message` 필드가 문자열이 아닌 객체가 됨. 프로젝트의 성공 응답(`{ data: { ... } }`)과 스키마가 불일치하며, 다른 인증 에러들과도 형식이 다를 수 있음.
- **제안**: 글로벌 예외 필터 유무 확인 후, 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화하거나 프로젝트 전체 에러 응답 컨벤션에 맞게 글로벌 필터 도입 권장.

---

**[INFO]** `POST /auth/logout` — `clearCookie` path 추가
- **위치**: `auth.controller.ts:71`
- **상세**: 쿠키 설정 시 `path: '/'`를 사용하므로 삭제 시에도 동일 path 지정 필수. 이번 수정으로 쿠키가 실제로 삭제되지 않던 버그 수정. 계약상 breaking change 아님.
- **제안**: 없음 (올바른 수정).

---

**[INFO]** `POST /auth/refresh` — 쿠키 우선 토큰 공급 흐름 명시화
- **위치**: `auth.controller.ts:82-86`
- **상세**: 프론트엔드가 빈 body `{}`로 요청하고 백엔드가 쿠키 우선으로 토큰 읽는 계약이 클라이언트-서버 간 일관되게 구현됨. `RefreshTokenDto.refreshToken` optional화로 이 흐름이 유효성 검증 통과.
- **제안**: API 문서에 "토큰 공급 우선순위: HttpOnly 쿠키 > body.refreshToken" 명시 권장.

---

### 요약

프론트엔드 변경(auth-provider, client.ts)은 API 계약과 무관한 클라이언트 내부 구현 변경이다. 백엔드 변경의 핵심 API 계약 이슈는 두 가지다: `refreshToken` DTO의 required → optional 전환으로 동일 입력에 대한 에러 코드가 400에서 401로 변경되는 behavioral breaking change, 그리고 `UnauthorizedException`에 객체를 전달하는 방식이 프로젝트의 에러 응답 스키마와 불일치할 수 있다는 점이다. `clearCookie`에 `path: '/'` 추가는 쿠키 삭제 버그를 수정하는 올바른 변경이다.

### 위험도

**LOW**