## 요구사항 리뷰 결과

### 발견사항

**[WARNING]** `GET /users/me` 엔드포인트에 인증 가드 누락
- 위치: `users.controller.ts:10-22`
- 상세: `@UseGuards(JwtAuthGuard)` 데코레이터가 없어 인증 없이 접근 가능. `@CurrentUser()` 데코레이터는 JWT 페이로드를 추출하지만, 가드가 없으면 요청 인터셉션 자체가 보장되지 않음.
- 제안: `@UseGuards(JwtAuthGuard)` 를 컨트롤러 또는 메서드에 추가

**[WARNING]** 사용자 미발견 시 404 응답 미반환
- 위치: `users.controller.ts:14-16`
- 상세: 사용자가 없을 때 `{ data: null }` 을 200 OK로 반환. REST 관행상 본인 정보를 찾지 못하면 `NotFoundException` (404)이 적합. 유효한 JWT를 가진 사용자가 DB에 없는 상황은 탈퇴/삭제 케이스이므로 null 반환보다 에러가 맞음.
- 제안: `throw new NotFoundException('User not found')` 사용

**[INFO]** SQL 마이그레이션에 idempotency 보장 없음
- 위치: `V003__add_trigger_category.sql:2`
- 상세: Flyway는 버전 관리로 중복 실행을 막지만, `ADD VALUE`는 이미 존재하는 값에 대해 에러를 발생시킴. 일부 환경(수동 실행, 롤백 후 재실행)에서 문제 발생 가능.
- 제안: PostgreSQL 12+에서는 `IF NOT EXISTS` 사용 가능: `ALTER TYPE node_category ADD VALUE IF NOT EXISTS 'trigger' BEFORE 'logic';`

**[INFO]** 테스트에 인증 가드 미적용 케이스 누락
- 위치: `users.controller.spec.ts`
- 상세: 가드가 추가된 후 인증 실패 케이스(401 Unauthorized)에 대한 테스트가 없음.
- 제안: 가드 추가 후 인증 미포함 요청에 대한 테스트 케이스 보완

**[INFO]** `locale`, `theme` 필드의 기본값/null 처리 미확인
- 위치: `users.controller.ts:18-21`
- 상세: `user.locale`, `user.theme` 가 DB에서 null일 경우 그대로 반환됨. 스펙상 기본값이 있다면 컨트롤러 또는 서비스 레이어에서 처리 필요.
- 제안: 스펙 확인 후 필요시 `locale: user.locale ?? 'ko'` 형태로 기본값 보장

---

### 요약

`GET /users/me` API의 기본 구조는 올바르게 구현되어 있으나, 인증 가드 누락이 가장 중요한 문제입니다. JWT 페이로드를 파라미터로 받는 구조임에도 가드가 없으면 인증되지 않은 요청이 컨트롤러까지 도달할 수 있어 보안 요구사항을 충족하지 못합니다. SQL 마이그레이션은 기능적으로 정확하나 `IF NOT EXISTS` 추가로 견고성을 높일 수 있고, 사용자 미발견 시 HTTP 의미론에 맞는 404 응답으로 개선이 필요합니다.

### 위험도

**MEDIUM**