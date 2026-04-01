### 발견사항

---

**[WARNING]** `RefreshTokenDto.refreshToken` 필드 유효성 검증 동작 변경
- **위치**: `refresh-token.dto.ts` — `refreshToken` 필드
- **상세**: `refreshToken`이 `required → optional`로 변경됨. 기존에는 body에 `refreshToken` 미포함 시 class-validator가 400 Bad Request를 반환했으나, 변경 후에는 컨트롤러 레벨에서 쿠키 + body 모두 없을 때 401 Unauthorized를 반환. 동일한 "토큰 없음" 입력에 대해 응답 코드가 400 → 401로 변경되어 기존 클라이언트의 에러 처리 분기에 영향 가능.
- **제안**: 변경 의도(토큰 공급 경로가 쿠키 또는 body 둘 다이므로 body는 선택적)는 타당함. 다만 이 동작 변경을 API 문서(Swagger 등)에 반영하고, 기존 클라이언트가 400으로 분기하고 있다면 마이그레이션 가이드 필요.

---

**[WARNING]** `UnauthorizedException` 응답 구조가 프로젝트 성공 응답 형식과 불일치
- **위치**: `auth.controller.ts:83-87` — `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`
- **상세**: NestJS의 `UnauthorizedException`에 객체를 전달하면 실제 응답은 `{ statusCode: 401, message: { code: 'TOKEN_INVALID', message: '...' }, error: 'Unauthorized' }` 구조가 됨. 프로젝트의 성공 응답은 `{ data: { ... } }` 래퍼를 사용하는데, 에러 응답의 `message` 필드가 문자열이 아닌 객체로 중첩되어 응답 스키마가 불일치함. 기존 다른 인증 에러들이 어떤 형식을 사용하는지 확인 필요.
- **제안**: 프로젝트에 글로벌 예외 필터가 있다면 해당 필터가 이 구조를 어떻게 처리하는지 검증. 필터가 없다면 `throw new UnauthorizedException('No refresh token provided')` 형태로 단순화하거나, 프로젝트 에러 응답 컨벤션(`{ code, message }`)을 글로벌 필터에서 일관되게 처리하는 방식 도입 권장.

---

**[INFO]** `POST /auth/logout` — `clearCookie` path 추가
- **위치**: `auth.controller.ts:71` — `res.clearCookie('refreshToken', { path: '/' })`
- **상세**: 쿠키 설정 시 `path: '/'`를 사용하므로 삭제 시에도 동일한 `path`를 지정해야 실제로 삭제됨. 이 변경은 API 동작의 정확성을 높이는 수정이며, 계약상 breaking change는 아님.
- **제안**: 해당 없음 (올바른 수정).

---

**[INFO]** `POST /auth/refresh` — body 없이 쿠키만으로 토큰 갱신 흐름 명시화
- **위치**: `auth.controller.ts:82-86` + `client.ts` — `doRefresh()`
- **상세**: 프론트엔드 `doRefresh()`가 `apiClient.post("/auth/refresh", {})` 빈 body로 요청하고, 백엔드는 쿠키 우선으로 토큰을 읽음. `RefreshTokenDto.refreshToken`이 optional이므로 이 흐름은 유효성 검증을 통과. 쿠키 기반 자동 갱신 계약이 클라이언트-서버 간에 일관되게 구현됨.
- **제안**: API 문서에 "토큰 공급 우선순위: HttpOnly 쿠키 > body.refreshToken" 명시 권장.

---

### 요약

이번 변경의 핵심 API 계약 이슈는 `RefreshTokenDto.refreshToken`의 required → optional 전환으로 인한 검증 에러 코드 변경(400 → 401)과, `UnauthorizedException`에 객체를 전달하는 방식이 프로젝트의 에러 응답 스키마와 불일치할 수 있다는 점이다. `clearCookie`에 `path: '/'` 추가와 쿠키 우선 refresh 흐름 명시화는 계약 일관성을 높이는 올바른 수정이다. 전반적으로 기능 동작은 개선되었으나, 에러 응답 구조의 일관성 검토와 기존 클라이언트의 에러 코드 처리 분기 영향도 확인이 필요하다.

### 위험도

**LOW**