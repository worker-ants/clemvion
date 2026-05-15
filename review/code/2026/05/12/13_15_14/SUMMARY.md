# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 초대 이메일 URL 변경·HTTP 상태코드 변경·에러 코드 스타일 혼재 3건이 현재 클라이언트와의 API 계약을 직접 파괴하며, 프로덕션 로그에 초대 토큰이 무조건 노출되는 보안 결함이 추가로 존재한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 범위 | 초대 이메일 URL 포맷 변경 (`/invitations/accept?token=...` → `/invitations/${token}`). 프론트엔드 라우트 업데이트 없이 배포 시 기존 대기 중 링크 포함 모든 신규 초대 링크가 404 | `mail.service.ts` `sendWorkspaceInvitationEmail` | 프론트엔드 라우트 변경과 동시 배포, 또는 구 URL을 신 URL로 301 리다이렉트하는 전환 기간 운영 |
| 2 | API 계약 / 범위 | HTTP 상태코드 breaking change — 이미 수락·만료된 초대: `409→410`, 이메일 불일치: `403→400`. 기존 클라이언트가 409/403으로 분기 처리 중이라면 즉시 오동작 | `workspace-invitations.service.ts` `accept()`, `getMetaByToken()` | 버전 네고시에이션 계획 수립 또는 신규 에러 코드(`invitation_already_used` 등)를 기존 상태코드 안에 담아 단계적 마이그레이션 |
| 3 | API 계약 / 유지보수 | 에러 코드 케이스 혼재 — `revoke()`·`resend()`는 `INVITATION_NOT_FOUND`(SCREAMING_SNAKE), `getMetaByToken()`·`accept()`는 `invitation_not_found`(snake_case). 동일 개념에 두 코드가 공존하여 클라이언트 파싱 분기 불일치 | `workspace-invitations.service.ts` 전반 | snake_case로 전면 통일 후 Changelog 명시 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 초대 토큰 URL이 `transport` 설정 무관하게 `logger.debug`로 항상 기록됨. 프로덕션 로그 집계 시스템(CloudWatch 등)에 토큰이 수집될 수 있음 | `mail.service.ts` `sendWorkspaceInvitationEmail` | 이메일 인증 토큰과 동일하게 `if (this.transport === MAIL_TRANSPORT_CONSOLE)` 조건으로 감쌀 것 |
| 2 | 동시성 / DB | `invite()` TOCTOU — 두 동시 요청이 모두 `pending = null`로 읽으면 두 INSERT가 경쟁하고, partial UNIQUE 제약 위반이 애플리케이션에서 미처리되어 500으로 노출 | `workspace-invitations.service.ts` `invite()` | 전체 로직을 `dataSource.transaction()`으로 감싸거나 upsert 단일 연산으로 처리; `QueryFailedError` unique violation을 `ConflictException`으로 변환 |
| 3 | 동시성 | `invite()`/`resend()` 동시 토큰 재발급 — 두 호출이 같은 pending 행을 동시에 읽으면 마지막 write가 이기고 첫 번째 이메일 링크가 dead link가 됨 | `workspace-invitations.service.ts` `invite()`, `resend()` | pending 행 조회에 `SELECT FOR UPDATE` 적용 |
| 4 | 사이드이펙트 / 테스트 | `sendWorkspaceInvitationEmail` 파라미터 중간 삽입(`invitedByName`) — 다른 호출부가 업데이트되지 않으면 컴파일 에러 또는 런타임 오동작 | `mail.service.ts` | 코드베이스 전체 호출부 확인 필수; `invitedByName`을 마지막 파라미터로 이동하면 향후 시그니처 변경에 더 안전 |
| 5 | 아키텍처 / 사이드이펙트 | `resolveTokenWorkspaceContext` 리팩토링이 모든 토큰 발급 경로(로그인·이메일 인증·refresh·OAuth 콜백)에 영향을 줌. `findPersonalWorkspace` null + `listForUser` 빈 배열인 기존 사용자에서 `workspaceId` 클레임이 달라질 수 있음 | `auth.service.ts` `resolveTokenWorkspaceContext` | 리팩토링 전후 기존 사용자 대상 별도 회귀 테스트 검증 |
| 6 | 유지보수 | 초대 토큰 유효성 3단계 검증(`findOne → null → 404`, `acceptedAt → 410`, `expiresAt < now → 410`)이 `getMetaByToken`·`accept`·`consumeForRegistration` 3곳에 중복 | `workspace-invitations.service.ts` | `private assertTokenUsable(invitation): asserts invitation is WorkspaceInvitation` 가드 메서드로 추출 |
| 7 | 성능 | `registerWithInvitation`에서 동일 초대 토큰 행을 2회 조회 — `getMetaByToken` + `consumeForRegistration` 내부 `findOne` | `auth.service.ts` `registerWithInvitation` | 첫 조회 결과를 `consumeForRegistration`에 직접 전달하거나 두 단계를 단일 메서드로 통합 |
| 8 | 성능 | `resolveTokenWorkspaceContext`가 모든 토큰 발급 경로에서 직렬 2-hop 쿼리(`findPersonalWorkspace` → `getMemberRole`) 실행 | `auth.service.ts` `resolveTokenWorkspaceContext` | `findPersonalWorkspace`를 `WorkspaceMember` JOIN으로 변경해 단일 쿼리로 단축 |
| 9 | DB | `token` 컬럼 인덱스 미확인 — `getMetaByToken`·`accept`·`consumeForRegistration` 3곳이 토큰으로 직접 조회하는데 UNIQUE 인덱스 존재 여부 미검증 | `workspace-invitations.service.ts`, 마이그레이션 | 마이그레이션에서 `CREATE UNIQUE INDEX ... ON workspace_invitation(token)` 확인 또는 추가 |
| 10 | 요구사항 | `termsAccepted: false`가 DTO 검증을 통과함 — `@IsBoolean()`은 타입만 확인하고 `true` 여부는 검사하지 않음 | `register.dto.ts:50` | `@Equals(true, { message: '이용약관에 동의해야 합니다.' })` 추가 |
| 11 | 요구사항 | workspace 삭제 후 초대 토큰 조회 시 `workspaceName: ''` 반환 — 스펙상 NotFoundException이 의미상 올바름 | `workspace-invitations.service.ts` `getMetaByToken()`, `resend()` | workspace null 시 `NotFoundException({ code: 'workspace_not_found' })` throw |
| 12 | API 계약 | `POST /workspaces/:id/invitations` — upsert(기존 pending 행 업데이트)인데 기본 `201 Created` 반환 | `workspaces.controller.ts` `createInvitation()` | `@HttpCode(200)` 적용 또는 응답에 `created: boolean` 필드 추가 |
| 13 | 보안 | `GET /invitations/:token` — 공개 엔드포인트인데 `@Throttle` 없음. 워크스페이스 이름·초대자 이름·이메일이 응답에 포함됨 | `invitations.controller.ts` | `@Throttle({ default: { ttl: 60_000, limit: 30 } })` 추가 |
| 14 | 테스트 | 신규 `InvitationsController` 전용 spec 파일 없음 — `@Public()` guard bypass, 404·410 HTTP 매핑 미검증 | `invitations.controller.ts` | `InvitationsController.spec.ts` 추가 (성공/404/410 각 1케이스) |
| 15 | 테스트 | `auth.controller.ts` register 분기(`'accessToken' in result`)에 따른 쿠키 설정/미설정 로직 컨트롤러 테스트 없음 | `auth.controller.ts:125–138` | 컨트롤러 테스트에 (1) 초대 토큰 가입 → 쿠키 설정, (2) 일반 가입 → 쿠키 미설정 케이스 추가 |
| 16 | 유지보수 | `register()` 반환 타입이 `'accessToken' in result` 덕 타이핑 분기에 의존 — 분기 케이스 추가 시 취약 | `auth.service.ts:52–55`, `auth.controller.ts:131–140` | `kind: 'pending_verification' \| 'auto_login'` 판별 리터럴 필드 추가 |
| 17 | 유지보수 | Throttle 설정값 인라인 중복 — `@Throttle({ default: { ttl: 60_000, limit: 10 } })`이 두 엔드포인트에 복사 | `workspaces.controller.ts` `createInvitation`, `resendInvitation` | 상수 `INVITATION_THROTTLE`으로 추출 |
| 18 | 아키텍처 | `AuthService` 생성자 의존성 9개+ — `WorkspaceInvitationsService` 추가로 God Service 징후 심화 | `auth.service.ts` constructor | `registerWithInvitation` + `resolveTokenWorkspaceContext`를 `AuthRegistrationService`로 분리 검토 |
| 19 | 범위 | `resolveTokenWorkspaceContext`의 `listForUser`가 전체 멤버십을 로드하고 `memberships[0]`만 사용 — 다중 멤버십 사용자에서 비결정론적 워크스페이스 선택 가능성 | `auth.service.ts` `resolveTokenWorkspaceContext` | `listForUser`에 명시적 정렬(`joinedAt ASC`) 추가 또는 `LIMIT 1` 메서드 분리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 / 보안 | `invitationToken` `@MinLength(16)` 하한이 실제 발급 길이(64자)와 불일치; `@MaxLength` 없음 | `register.dto.ts` | `@Length(64, 64)` 또는 최소 `@MinLength(64)` + `@MaxLength(128)` |
| 2 | 문서 | `InvitationMetaDto.expiresAt` Swagger 타입 `string`인데 서비스는 `Date` 객체를 그대로 반환 | `workspace-response.dto.ts`, `workspace-invitations.service.ts` | 서비스에서 `.toISOString()` 명시 변환 또는 `@Transform()` 데코레이터 추가 |
| 3 | 문서 | 쓰로틀 적용 엔드포인트에 `@ApiTooManyRequestsResponse` 누락 | `workspaces.controller.ts` | `@ApiTooManyRequestsResponse({ description: '요청 빈도 초과 (분당 10건)' })` 추가 |
| 4 | 문서 | 초대 토큰 가입 흐름에서 Refresh Token 쿠키 발급이 Swagger에 미기술 | `auth.controller.ts` | `@ApiResponse` description에 쿠키 발급 사실 명시 |
| 5 | 유지보수 | `registerWithInvitation`에서 `event: 'login_success'`로 기록 — 실제로는 최초 가입 경로라 감사 로그 구분 불가 | `auth.service.ts` `registerWithInvitation` | `event: 'registration_via_invitation'` 별도 타입 사용 |
| 6 | DB | `applyAccept`의 `() => 'NOW()'` raw SQL — PostgreSQL 외 DB 미지원 | `workspace-invitations.service.ts` `applyAccept()` | 테스트 환경이 SQLite 등이라면 `CURRENT_TIMESTAMP` 또는 앱 레벨 `new Date()`로 교체 |
| 7 | DB | 트랜잭션 커밋 후 `generateTokens()` 실패 시 사용자 row는 존재하지만 클라이언트는 토큰을 받지 못하는 orphan 상황 | `auth.service.ts` `registerWithInvitation` | 실패 시 명확한 에러 메시지와 로그인 재시도 안내 추가; 구조적 해결은 refresh token 저장을 동일 트랜잭션에 포함 |
| 8 | 의존성 | `@Global()` 암묵적 의존 — `WorkspacesModule` `@Global()` 제거 시 `AuthService` DI 즉시 실패 | `workspaces.module.ts`, `auth.service.ts` | `AuthModule`의 `imports`에 `WorkspacesModule` 명시적 추가 고려 |
| 9 | 테스트 | `resend` describe에 "mail 실패 시에도 저장 결과 반환" 케이스 없음 (`invite`에는 있음) | `workspace-invitations.service.spec.ts` | `resend` describe에 동일 케이스 추가 |
| 10 | 아키텍처 | `AuthService`가 `WorkspaceInvitationsService`에 `EntityManager`를 직접 전달 — 레이어 추상화 누수 | `auth.service.ts` → `consumeForRegistration(manager, ...)` | 메서드명에 `InTransaction` 접미사 명시 또는 도메인 이벤트 기반으로 결합 분리 |
| 11 | 문서 | `invitations.controller.ts` 클래스 JSDoc이 영어, 나머지 컨트롤러는 한국어 — 언어 혼재 | `invitations.controller.ts` 상단 | 클래스 JSDoc 한국어로 통일 |
| 12 | 유지보수 | `@ApiProperty({ required: false })` vs `@ApiPropertyOptional` 스타일 혼용 (같은 변경 내) | `auth-response.dto.ts:51` | `@ApiPropertyOptional`로 교체 |
| 13 | 성능 | `resend()`에서 workspace + inviter 조회가 직렬 실행 — `getMetaByToken`에서는 이미 `Promise.all` 패턴 사용 | `workspace-invitations.service.ts` `resend()` | `Promise.all([workspaceRepo.findOne(...), userRepo.findOne(...)])` 병렬화 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Scope | HIGH | 이메일 URL 변경·HTTP 상태코드 변경·`resolveTokenWorkspaceContext` 전역 영향 |
| API Contract | HIGH | HTTP 상태코드 breaking change·에러 코드 케이스 불일치·공개 엔드포인트 rate limit 없음 |
| Security | MEDIUM | 초대 토큰 프로덕션 로그 무조건 노출(HIGH 항목 1건 포함) |
| Architecture | MEDIUM | EntityManager 크로스 서비스 전달·AuthService God Service 징후·이중 토큰 조회 |
| Maintainability | MEDIUM | 유효성 검증 3중 중복·에러 코드 케이스 혼용·덕 타이핑 분기 |
| Performance | MEDIUM | 동일 토큰 2회 조회·`resolveTokenWorkspaceContext` 직렬 2-hop 쿼리 |
| Database | MEDIUM | `invite()` TOCTOU·`token` 컬럼 인덱스 미확인 |
| Requirement | MEDIUM | `termsAccepted: false` 통과·workspace 삭제 시 빈 이름·스로틀 단위 스펙 불일치 |
| Side Effect | MEDIUM | `sendWorkspaceInvitationEmail` 시그니처 삽입·비결정론적 워크스페이스 선택 |
| Testing | LOW | `InvitationsController` spec 없음·컨트롤러 register 분기 미검증 |
| Documentation | LOW | `expiresAt` 타입 불일치·쓰로틀 응답 미문서화 |
| Concurrency | LOW | `accept()` CAS 설계 올바름; `invite()` 동시 토큰 교체 시 dead link 발송 |
| Dependency | LOW | 신규 외부 패키지 없음; `package-lock.json` 단독 변경 확인 권장 |

## 발견 없는 에이전트
없음 (전 에이전트 발견사항 있음)

---

## 권장 조치사항

1. **[즉시 — 배포 전 필수]** 초대 이메일 URL 변경에 대응하는 프론트엔드 라우트(`/invitations/:token`)를 동시 배포하거나, 구 URL을 신 URL로 리다이렉트하는 전환 계획을 수립한다.
2. **[즉시 — 배포 전 필수]** `mail.service.ts`의 초대 토큰 `logger.debug` 호출을 `MAIL_TRANSPORT_CONSOLE` 조건부 블록으로 이동한다 (토큰 1줄 수정).
3. **[즉시 — 배포 전 필수]** HTTP 상태코드 변경(409→410, 403→400)에 대응하는 프론트엔드 에러 핸들러를 확인·업데이트하거나, 클라이언트 마이그레이션 기간을 두고 기존 코드를 유지한다.
4. **[단기]** `workspace-invitations.service.ts` 에러 코드를 `snake_case`로 전면 통일 (`INVITATION_NOT_FOUND` 등 구 코드 일괄 변경).
5. **[단기]** `invite()` TOCTOU — `dataSource.transaction()` 래핑 + `QueryFailedError` unique violation → `ConflictException` 변환 처리.
6. **[단기]** `register.dto.ts`에 `termsAccepted: @Equals(true)`, `invitationToken: @MinLength(64) @MaxLength(128)` 추가.
7. **[단기]** `workspace_invitation.token` 컬럼 UNIQUE 인덱스를 마이그레이션에서 확인하고 누락 시 추가한다.
8. **[단기]** `InvitationsController.spec.ts` 및 `auth.controller.ts` register 분기 컨트롤러 테스트를 추가한다.
9. **[중기]** 초대 토큰 유효성 3단계 검증을 `assertTokenUsable()` 가드로 추출한다.
10. **[중기]** `registerWithInvitation`의 이중 토큰 조회를 단일 조회로 통합하고, `resolveTokenWorkspaceContext`의 직렬 2-hop 쿼리를 JOIN으로 최적화한다.
11. **[중기]** `register()` 반환 타입에 `kind` 판별 리터럴 필드를 추가해 컨트롤러 분기를 타입 안전하게 변경한다.
12. **[장기]** `AuthService`에서 `registerWithInvitation` + `resolveTokenWorkspaceContext`를 `AuthRegistrationService`로 분리해 God Service 의존성을 줄인다.