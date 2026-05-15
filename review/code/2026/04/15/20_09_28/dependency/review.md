## 의존성 리뷰 결과

### 발견사항

**[INFO]** 새 외부 패키지 없음 — Node.js 내장 `crypto` 및 `fetch` 활용
- 위치: `auth-oauth.service.ts` 전체
- 상세: `randomBytes`는 Node.js 내장 `crypto` 모듈, HTTP 호출은 Node.js 18+ 내장 `fetch` 사용. 별도 OAuth 라이브러리(`passport-google-oauth20` 등) 없이 구현됨.
- 제안: 현재 Node.js 버전이 18+ 인지 `package.json`의 `engines` 필드로 명시하면 좋음.

**[INFO]** 기존 NestJS 생태계 내에서 의존성 추가
- 위치: `auth.module.ts`
- 상세: `TypeOrmModule.forFeature([AuthOAuthState])` 추가. 이미 프로젝트에서 TypeORM을 사용 중이므로 신규 외부 의존성 없음.

**[INFO]** `AuthService` → `AuthOauthService` 단방향 의존
- 위치: `auth-oauth.service.ts:17`, `auth.module.ts:36`
- 상세: `AuthOauthService`가 `AuthService.generateTokens()`를 호출하는 단방향 의존. `generateTokens`가 `private` → `public`으로 변경됨(`auth.service.ts` diff). 순환 의존은 없음.
- 제안: `generateTokens`가 public으로 노출되면 다른 서비스에서도 호출 가능해지는 API 표면 확대 위험. 서비스 경계 관리 필요.

**[WARNING]** `AuthOauthService`가 `UsersService`, `WorkspacesService`를 직접 주입
- 위치: `auth-oauth.service.ts:73-78`, `auth.module.ts`
- 상세: `AuthModule`이 이미 `UsersModule`, `WorkspacesModule`을 import하고 있어 의존 경로는 유효. 그러나 `AuthOauthService`가 `resolveUser`에서 `dataSource.transaction` 내부에서 `usersService.create`를 호출하는데, `UsersService`의 repository가 해당 transaction manager를 사용하지 않음 — entity manager를 bypass하여 트랜잭션 원자성이 깨질 수 있음.
- 제안: `resolveUser` 내 신규 사용자 생성 시 `manager.getRepository(User).save(...)` 패턴을 사용하거나, `UsersService`에 `EntityManager`를 받는 오버로드를 추가하는 방식 검토.

**[INFO]** 프론트엔드 환경변수 의존
- 위치: `login-form.tsx:34`, `register-form.tsx:37`
- 상세: `process.env.NEXT_PUBLIC_API_URL`에 폴백(`http://localhost:3001/api`) 하드코딩. 두 파일에 동일 상수가 중복 선언됨.
- 제안: `lib/constants.ts` 등 공통 모듈로 추출하여 단일 관리 필요.

**[INFO]** 마이그레이션 파일 번호 연속성 확인 필요
- 위치: `V013__auth_oauth_state.sql`
- 상세: `V013`이 기존 마이그레이션과 순서상 충돌하지 않는지 확인 필요. Flyway/Liquibase 환경에서 번호 누락 또는 중복 시 실행 오류 발생.

---

### 요약

이번 변경은 외부 라이브러리를 새로 추가하지 않고 Node.js 내장 `crypto`·`fetch`와 기존 NestJS/TypeORM 스택만으로 OAuth 흐름을 구현한 점이 의존성 관점에서 긍정적입니다. 모듈 간 의존 방향도 단방향으로 유지되어 순환 의존 위험이 없습니다. 다만 `resolveUser`의 신규 사용자 생성 시 `DataSource.transaction` 내부에서 `UsersService`가 해당 `EntityManager`를 사용하지 않아 트랜잭션 원자성이 보장되지 않는 점이 실질적인 위험이며, 프론트엔드의 `API_BASE_URL` 상수 중복도 유지보수 측면에서 개선이 필요합니다.

### 위험도

**MEDIUM** — 트랜잭션 원자성 미보장 이슈로 인해 신규 OAuth 사용자 생성 실패 시 불완전한 상태(사용자 생성 후 워크스페이스 미생성 또는 반대) 가능성 존재.