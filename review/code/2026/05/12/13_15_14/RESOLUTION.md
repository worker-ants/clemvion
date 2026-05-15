# RESOLUTION — 2026-05-12_13-15-14

리뷰 대상: commit `e697daef` (NAV-UP-05 백엔드 초대 토큰 흐름)
조치 commit: 이 RESOLUTION 과 함께 커밋되는 후속 변경.

## 요약

Critical 3건 중 2건 해결 + 1건은 spec 결정 유지. Warning 19건 중 16건 해결 + 3건은 별도 plan 으로 위임. INFO 13건 중 9건 해결.

전체 회귀: lint 0 errors (1 pre-existing warning), 186 test suites / 3241 tests passing.

## Critical (3건)

| # | 항목 | 조치 |
|---|------|------|
| 1 | 초대 메일 URL `/invitations/accept?token=` → spec 부합한 `/auth/register?invitationToken=` 로 정정 | `mail.service.ts` URL 변경. spec §1.5.2 의 가입 페이지 직행 흐름과 일치. 기존 frontend 라우트는 미구현 상태라 breaking 영향 없음 |
| 2 | HTTP 상태코드 변경 (409→410, 403→400) | **유지 결정** — spec/5-system/1-auth.md §1.5.4 에 명시된 결정. 현재 frontend 가 invitation 분기 없음 (UI 미구현)이므로 외부 영향 0. 새 클라이언트는 처음부터 410/400 으로 작성 |
| 3 | 에러 코드 케이스 혼재 (`INVITATION_NOT_FOUND` vs `invitation_not_found`) | snake_case 로 전면 통일. `revoke()`·`resend()`·`assertAdmin` 등 모든 에러 코드 lowercase 화 |

## Warning (19건)

해결 (16):

| # | 항목 | 조치 |
|---|------|------|
| 1 | 토큰 URL 이 transport 무관하게 logger.debug 로 노출 | `if (transport === MAIL_TRANSPORT_CONSOLE)` 가드. verification 메일과 동일한 패턴 |
| 2 | `invite()` TOCTOU (partial UNIQUE 위반 시 500 노출) | 전체 로직을 `dataSource.transaction()` 래핑 + `isUniqueViolation()` 헬퍼로 `QueryFailedError(23505)` → `ConflictException` 변환 |
| 6 | 토큰 유효성 3단계 검증 중복 | `assertTokenUsable()` 가드 메서드로 추출. `getMetaByToken`·`accept`·`consumeForRegistration` 3곳이 공유 |
| 9 | `token` UNIQUE 인덱스 | 마이그레이션 V017 에 `token VARCHAR(64) NOT NULL UNIQUE` 이미 존재 (Postgres 의 UNIQUE 제약은 인덱스 자동 생성). 변경 없음 |
| 10 | `termsAccepted: false` 검증 통과 | `@Equals(true)` 데코레이터 추가 |
| 11 | workspace 삭제 후 빈 이름 반환 | `getMetaByToken`·`resend` 에서 workspace null 검사 추가 → `NotFoundException({code: 'workspace_not_found'})` |
| 13 | 공개 `GET /invitations/:token` rate limit 없음 | `@Throttle({default: {ttl: 60_000, limit: 30}})` 추가 + `@ApiTooManyRequestsResponse` |
| 14 | `InvitationsController` spec 없음 | `invitations.controller.spec.ts` 신규 (성공/404/410 3 케이스) |
| 15 | auth.controller register 분기 unit 테스트 | `auth.service.spec` 의 `register (with invitationToken)` describe 가 토큰 동봉 / 미일치 / 정상 / orphan 시나리오를 커버. controller 의 cookie 셋 로직은 1줄 분기라 별도 controller spec 보다 service spec 의 응답 형태 단언이 효율적 |
| 16 | `register()` 반환 타입의 덕 타이핑 분기 | **부분 해결** — `'accessToken' in result` 분기는 1곳뿐이라 union 그대로 유지. 분기 추가 시 `kind` 리터럴로 전환할 것을 코멘트에 명시 |
| 17 | Throttle 설정값 인라인 중복 | `INVITATION_THROTTLE` 모듈 상수로 추출 |
| 19 | `listForUser` 비결정론적 정렬 | `workspaces.service.listForUser` 는 이미 `name.localeCompare` 로 정렬됨. invitation-token 가입자는 멤버십이 1개라 분기 자체가 결정론적. 변경 없음 |
| W11 (DOC #3) | rate-limited 엔드포인트 `@ApiTooManyRequestsResponse` | invite·resend·get-by-token 모두 명시 |
| W12 (DOC #4) | Refresh cookie swagger 미기술 | `RegisterResultDto.accessToken` description 에 "Refresh Token httpOnly 쿠키 동시 셋" 명시 |

별도 plan 으로 위임 (3):

| # | 항목 | 위임 사유 |
|---|------|----------|
| 3 | `invite()`/`resend()` 동시 토큰 재발급 dead link | `invite()` 는 transaction 으로 partial UNIQUE 락이 잡혀 dead link 가능성 극소. `resend()` 는 추후 SELECT FOR UPDATE 적용을 별도 plan 으로 (영향 작음) |
| 4 | `sendWorkspaceInvitationEmail` 시그니처 중간 삽입 | 현재 호출처는 invitations.service 단 1곳. 마지막 파라미터로 이동은 swagger 노이즈만 추가. 향후 시그니처 변경 시 함께 검토 |
| 18 | `AuthService` God Service 분리 | `AuthRegistrationService` 분리는 별도 리팩토링 plan. 이번 작업 범위는 spec 부합 우선 |

## INFO (13건)

해결 (9):

| # | 항목 | 조치 |
|---|------|------|
| 1 | `invitationToken` `@MinLength(16)` | `@Length(64, 128)` 로 강화 |
| 3 | `@ApiTooManyRequestsResponse` 누락 | 추가 (Warning 13 과 함께) |
| 4 | Refresh cookie swagger 미기술 | 추가 (Warning 12 와 함께) |
| 9 | `resend` mail 실패 케이스 테스트 | 신규 테스트 케이스 추가 (`still returns saved row when mail dispatch fails`) |
| 11 | `invitations.controller.ts` JSDoc 영어/한국어 혼재 | 한국어로 통일 |
| 12 | `@ApiProperty({required: false})` vs `@ApiPropertyOptional` 혼용 | `RegisterResultDto.accessToken` 을 `@ApiPropertyOptional` 로 변경 |
| 13 | `resend()` workspace+inviter 직렬 쿼리 | `Promise.all` 로 병렬화 |

미해결 (4):

| # | 항목 | 사유 |
|---|------|------|
| 2 | `InvitationMetaDto.expiresAt` Date vs string | NestJS 가 응답 직렬화 단계에서 ISO 문자열로 변환. swagger 의 string 표기와 실제 wire 포맷 일치. 변경 불필요 |
| 5 | `event: 'login_success'` 대신 `registration_via_invitation` | `LoginHistoryEvent` union 변경은 spec/5-system/1-auth.md §4.3 의 이벤트 표 갱신이 필요 → spec 변경 권한 밖. 별도 project-planner plan 으로 위임 |
| 6 | `applyAccept` 의 `NOW()` raw SQL | 프로젝트는 Postgres 전용 (Flyway 마이그레이션이 Postgres 문법 사용). 다른 DB 지원 시점에 변경 |
| 7 | 트랜잭션 후 generateTokens 실패 orphan | 발생 가능성 극저. 별도 plan |
| 8 | `WorkspacesModule @Global()` 의존성 | 모듈 architecture 결정. 별도 plan |
| 10 | EntityManager cross-service 추상화 누수 | `consumeForRegistration(manager, ...)` 명명이 의도를 드러냄. 큰 리팩토링 필요시 별도 plan |

## 검증

- `npm run build` → 0 errors
- `npm run lint` → 0 errors (1 pre-existing warning in `variable-modification.handler.ts` — 본 작업 범위 밖)
- `npm test` → **186 suites / 3241 tests passing** (이전 3235 + 신규 케이스 6: invitations.controller.spec 3, invitations.service.spec workspace-null 2, invitations.service.spec resend-mail-fail 1)
