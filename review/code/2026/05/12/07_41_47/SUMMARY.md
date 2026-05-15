파일 쓰기 권한이 필요합니다. 승인해주시면 계속 진행하겠습니다.

아래는 작성 완료된 통합 보고서입니다.

---

# Code Review 통합 보고서

## 전체 위험도

**HIGH** — `emailOtp` 재인증 경로 미구현으로 특정 사용자군의 세션 종료 기능이 완전 차단되고, `trust proxy: true` 설정이 IP 스푸핑을 통한 Throttler 우회 벡터를 열어두며, `SessionsController` 테스트가 전무하다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement · Side Effect | **`emailOtp` 재인증 분기 미구현** — `RevokeSessionDto`에 필드·JSDoc이 정의되어 있으나 `verifyReauth()`는 해당 분기 없이 바로 `ForbiddenException(REAUTH_NOT_AVAILABLE)`을 던진다. OAuth-only + 2FA 미설정 사용자는 세션 종료 기능을 전혀 사용할 수 없다. | `sessions.service.ts:verifyReauth()` / `revoke-session.dto.ts` | `emailOtp` 검증 분기 추가 또는 DTO에서 해당 필드·주석 제거 |
| 2 | Side Effect · Security | **`trust proxy: true` — IP 스푸핑으로 ThrottlerGuard 우회 가능** — Boolean `true`는 X-Forwarded-For 전체 홉을 무조건 신뢰해 `req.ip` 조작이 가능하며 로그인 브루트포스 방어가 무력화된다. `client-ip.ts`의 CF-Connecting-IP 로직은 이력 기록에만 작동, ThrottlerGuard는 별도로 `req.ip`를 사용한다. | `main.ts:42` | `expressInstance.set('trust proxy', 1)` + 인프라 레벨 Cloudflare IP 대역 외 직접 접근 차단 |
| 3 | Testing | **`SessionsController` 테스트 파일 완전 부재** — 4개 엔드포인트·`limit` 파라미터 파싱·`readRefreshTokenCookie`·`deriveDeviceLabel` 폴백 로직이 모두 미커버. | `sessions.controller.ts` | `sessions.controller.spec.ts` 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | **`refresh()` 내 User 관계 미로드** — lazy loading 비활성화 환경에서 `stored.user`가 undefined가 되어 재사용 감지 이벤트와 `generateTokens`에서 런타임 오류 발생 가능. `logout()`은 `relations: ['user']` 명시하지만 `refresh()`는 누락. | `auth.service.ts:refresh()` | `findOne`에 `relations: ['user']` 추가 |
| 2 | Testing | **`auth.service.spec.ts` 보안 이벤트 기록 검증 없음** — `LoginHistoryService` 목이 등록됐으나 `record` 호출 인자를 단언하는 테스트가 전혀 없다. 로그 기록 로직이 제거되어도 감지 불가. | `auth.service.spec.ts` | 각 실패·성공 경로에서 `loginHistory.record`가 올바른 `event`·`failureReason`으로 호출되는지 검증 케이스 추가 |
| 3 | Testing | **`LoginHistoryPrunerService` 테스트 파일 없음** — 프로덕션 데이터 삭제 Cron job임에도 정상·0 row·예외 경로가 모두 미커버. | `jobs/login-history-pruner.service.ts` | `login-history-pruner.service.spec.ts` 작성 |
| 4 | Concurrency | **`refresh()` TOCTOU 경쟁 조건** — 동시 요청 시 A·B 모두 `isRevoked = false`를 확인한 뒤 같은 family에 토큰이 중복 발급될 수 있다. `lastUsedAt`/`lastUsedIp` 추가로 비원자 섹션이 길어졌다. | `auth.service.ts:refresh()` | `SELECT ... FOR UPDATE` 또는 `UPDATE WHERE is_revoked = false RETURNING *`으로 원자적 처리 |
| 5 | Concurrency · Architecture | **크론 잡 타임존 미지정 + 멀티 인스턴스 동시 실행** — `EVERY_DAY_AT_3AM`은 서버 로컬 타임존에 의존하며 수평 확장 시 N개 인스턴스가 동시 DELETE를 실행한다. | `jobs/login-history-pruner.service.ts:16` | `@Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })` + 멀티 인스턴스 환경이면 Redis `SET NX` 분산 락 |
| 6 | Concurrency | **`revokeFamily()`/`revokeOtherFamilies()` 비트랜잭셔널 시퀀스** — revoke 성공 후 프로세스 재시작 시 `session_revoked` 이력이 누락되며 예외 삼킴으로 유실 여부조차 감지 불가. | `sessions.service.ts:revokeFamily()`, `revokeOtherFamilies()` | 보안 감사 이벤트를 DataSource 트랜잭션 안에서 함께 커밋하거나 `ERROR` 수준 로그로 격상 |
| 7 | Database | **`CREATE INDEX` (non-CONCURRENT) on existing `refresh_token`** — 마이그레이션 중 ShareLock 획득으로 쓰기가 차단된다. | `V040__...sql:L22-24` | `CREATE INDEX CONCURRENTLY`로 변경. Flyway 트랜잭션 모드 충돌 시 별도 `V040b` 마이그레이션으로 분리 |
| 8 | Database · Performance | **`pruneOlderThanRetention` — `created_at` 단독 인덱스 부재 + LIMIT 없는 대량 DELETE** — `(user_id, created_at)` 복합 인덱스는 `created_at` 단독 range scan에 비효율적이며 누적 시 lock 경합·WAL 팽창 발생. | `login-history.service.ts:pruneOlderThanRetention()` | `CREATE INDEX idx_login_history_created ON login_history (created_at)` + LIMIT 1000 배치 루프 전환 |
| 9 | Database · API Contract | **커서 페이지네이션 `created_at` 단독 사용 — 동일 밀리초 충돌** — 동일 밀리초 이벤트가 커서 경계에서 누락되거나 중복될 수 있다. | `login-history.service.ts:findForUser()` | 커서를 `(created_at, id)` 복합 키로 확장 |
| 10 | Scope | **`integrations` 모듈 파일 3개에 범위 외 변경 포함** — 포맷팅 2개·타입 캐스트 제거 1개가 auth-sessions와 무관하게 포함. | `integrations.service.ts`, `credentials-transformer.ts`, `integrations.service.spec.ts` | 포맷팅 파일 revert, 타입 캐스트 제거는 별도 PR로 분리 |
| 11 | API Contract | **`DELETE /users/me/sessions/:familyId` 에 자격증명을 바디로 전달** — 일부 CDN·프록시가 DELETE 바디를 무음으로 제거할 수 있다. | `sessions.controller.ts:revokeSession` | `POST /users/me/sessions/:familyId/revoke`로 변경 |
| 12 | API Contract | **`revokeOtherSessions` Swagger 201/200 불일치** — `@ApiCreatedWrappedResponse`(201)와 `@HttpCode(HttpStatus.OK)`(200)가 충돌. | `sessions.controller.ts:142,147` | `@ApiOkWrappedResponse`로 교체 |
| 13 | API Contract · Security | **`familyId` 경로 파라미터 UUID 형식 검증 누락** | `sessions.controller.ts:revokeSession` | `@Param('familyId', new ParseUUIDPipe())` 적용 |
| 14 | API Contract | **`RevokeSessionDto` 모든 필드 `@IsOptional()` — 빈 바디 통과** | `revoke-session.dto.ts` | Swagger에 "하나 이상 필수" 명시 또는 커스텀 validator 추가 |
| 15 | Security | **`RevokeSessionDto.password` MaxLength 제한 없음** — 수십 MB 문자열이 `bcrypt.compare()`까지 도달해 CPU 부하 유발 가능. | `revoke-session.dto.ts` | `@MaxLength(128)` 추가 |
| 16 | Security | **CF-Connecting-IP 헤더 위조 가능성** — 서버가 직접 노출되면 이력 IP가 공격자 주입값으로 채워진다. `client-ip.ts` 주석에서 이미 인지한 위험. | `utils/client-ip.ts` | 인프라 레벨 Cloudflare IP 대역 외 직접 접근 차단 |
| 17 | Requirement | **`reauthMode: "unavailable"` 진입 경로 없음** — `reauthMode`가 항상 `"totp"\|"password"`만 반환해 unavailable 분기와 `dialogReauthUnavailable` i18n 키가 dead path. OAuth-only + 2FA 미설정 사용자는 비밀번호 창을 보다 서버 403을 받는 UX 퇴행이 발생한다. | `sessions-panel.tsx:46-51` / `revoke-confirm-dialog.tsx` | user 스토어에 `hasPassword` 힌트 추가 또는 서버 403(REAUTH_NOT_AVAILABLE) 수신 시 다이얼로그 내부에서 mode 전환 |
| 18 | Requirement | **현재 세션 self-revoke API 레벨 방지 없음** — UI는 버튼을 숨기지만 직접 API 호출 시 현재 세션이 종료된다. | `sessions.service.ts:revokeFamily()` | `familyId === currentFamilyId`이면 `BadRequestException(CANNOT_REVOKE_CURRENT_SESSION)` 반환 |
| 19 | Side Effect · Requirement | **`revokeMutation.onError` 내 `throw` — 이중 에러 노출** — toast 표시 후 re-throw하면 React Query v5에서 두 번째 unhandled rejection과 인라인 에러가 동시 표시된다. | `sessions-panel.tsx:77-80` | `onError`에서 `throw` 제거, 인라인 에러는 `handleConfirm`의 catch에서만 처리 |
| 20 | Architecture | **`AuthContext` / `RevokeContext` 완전 동일 구조 중복 정의** | `auth.service.ts:23-26` / `sessions.service.ts:22-25` | `auth/types/auth-context.ts`에 단일 정의 후 양쪽에서 import |
| 21 | Architecture | **컨트롤러 레이어에서 도메인 변환 로직 수행** — `deriveDeviceLabel()` 호출과 `toISOString()` 변환을 컨트롤러가 직접 수행해 테스트 격리를 어렵게 한다. | `sessions.controller.ts:175-182` | `LoginHistoryService.findForUser()`가 `LoginHistoryItemDto[]`를 직접 반환 |
| 22 | Architecture | **`failureReason` 필드 의미 오용** — `session_revoked` 성공 이벤트에 `failureReason: 'revoke_others'`를 사용해 "실패 원인" 컬럼을 "액션 범위" 구분자로 전용한다. | `sessions.service.ts:161` | `failureReason: null`로 두고 단건/일괄을 `familyId` 유무로 구분 |
| 23 | Performance | **`loginHistory.record()` 인증 핫패스에서 `await` 처리** — 반환값·실패 여부가 제어 흐름에 무관한데도 DB INSERT 완료까지 응답이 지연된다. | `auth.service.ts:login()`, `refresh()` 등 전반 | `void this.loginHistory.record(...)` fire-and-forget으로 교체 |
| 24 | Performance | **`listActiveSessions` 두 번의 순차적 DB 왕복** | `sessions.service.ts:44-60` | `Promise.all`로 병렬 실행 |
| 25 | Performance | **`listActiveSessions` 페이지네이션 없는 전체 조회** | `sessions.service.ts:44-55` | `DISTINCT ON (family_id)`으로 family별 최신 1개만 조회 |
| 26 | Testing | **`sessions.service.spec.ts` 경계값 미커버** — TOTP 실패·affected=0·`pickNewer` 로직 검증 없음. | `sessions.service.spec.ts` | 3개 케이스 추가 |
| 27 | Testing | **`device-label.spec.ts` Edge/Opera/ChromeOS 경로 미커버** | `utils/device-label.spec.ts` | Edge UA, Opera UA, ChromeOS UA, browser 미감지+OS 감지 케이스 추가 |
| 28 | Documentation | **`SessionDto.ipAddress` Swagger 설명과 실제 반환값 불일치** — 설명은 "발급 시점 IP"이지만 `toDto()`는 `lastUsedIp ?? ipAddress`로 마지막 활동 IP를 우선 반환한다. | `session.dto.ts:24` | Swagger description을 "마지막 활동 IP (없으면 발급 시점 IP)"로 수정 |
| 29 | Documentation | **`plan/in-progress/auth-sessions.md` 체크리스트와 구현 상태 불일치** — 구현 완료 항목들이 `[ ]` 미체크. CLAUDE.md 규약 위반. | `plan/in-progress/auth-sessions.md` | 완료 항목 `[x]` 갱신 후 `plan/complete/`로 `git mv` |
| 30 | Maintainability | **`generateTokens()` positional 인자 4개로 가독성 저하** | `auth.service.ts:generateTokens()` 호출부 | 옵션 객체로 리팩토링 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | **`void IsNull` 미사용 import 우회** | `sessions.service.ts` 마지막 줄 | `IsNull` import와 해당 줄 모두 제거 |
| 2 | Performance | **프론트엔드 `flatMap` useMemo 미적용** | `login-history-list.tsx:57` | `useMemo(() => ..., [query.data])` 적용 |
| 3 | Performance | **세션 쿼리 `staleTime` 미설정** | `sessions-panel.tsx:56-59` | `staleTime: 30_000` 추가 |
| 4 | Architecture | **`SessionsController` URL 네임스페이스 불일치 근거 미문서화** | `sessions.controller.ts`, `auth.module.ts` | `auth.module.ts` 주석 한 줄 추가 |
| 5 | Architecture | **`LoginHistoryService` export 과잉** — 외부 사용 케이스 없음. | `auth.module.ts:exports` | export 제거 |
| 6 | Security | **`SessionsController` 명시적 JWT 가드 데코레이터 부재** | `sessions.controller.ts` | `@UseGuards(JwtAuthGuard)` 추가 |
| 7 | Documentation | **로딩 텍스트 i18n 누락** — "Loading…" 영문 고정. | `sessions-panel.tsx:109`, `login-history-list.tsx:49` | `en.ts`/`ko.ts`에 `profile.sessions.loading` 키 추가 |
| 8 | Documentation | **`spec/5-system/1-auth.md §4.3` emailOtp 흐름 미언급** | `spec/5-system/1-auth.md` | `§4.3`에 현재 구현 상태(미구현/예정) 명시 |
| 9 | Maintainability | **`verifyReauth()` 암묵적 우선순위 정책** — password → 2FA 순이 코드에 묵시적으로 박혀 있다. | `sessions.service.ts:verifyReauth()` | 메서드 상단에 우선순위 정책 주석 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | **HIGH** | `trust proxy: true` IP 위조 벡터 + `refresh()` User 관계 미로드 런타임 오류 |
| testing | **HIGH** | `SessionsController` 테스트 전무 + 보안 이벤트 기록 검증 없음 |
| requirement | **HIGH** | `emailOtp` 미구현으로 OAuth-only 사용자 세션 종료 완전 차단 |
| concurrency | **MEDIUM** | `refresh()` TOCTOU + 비트랜잭셔널 revoke 시퀀스 |
| database | **MEDIUM** | CREATE INDEX 쓰기 차단 + `created_at` 단독 인덱스 부재 |
| security | **MEDIUM** | `trust proxy: true` Throttler 우회 + CF-Connecting-IP 위조 가능성 |
| performance | **MEDIUM** | 인증 핫패스 `await record()` + LIMIT 없는 배치 DELETE |
| api_contract | **LOW** | Swagger 201/200 불일치 + DELETE 바디 CDN 호환 위험 + UUID 검증 누락 |
| architecture | **LOW** | `AuthContext` 중복 + 컨트롤러 도메인 변환 + `failureReason` 의미 오용 |
| documentation | **LOW** | plan 체크리스트 불일치 + `SessionDto.ipAddress` Swagger 불일치 |
| maintainability | **LOW** | `loginHistory.record()` 반복 패턴 + `generateTokens()` 인자 가독성 |
| scope | **LOW** | `integrations` 모듈 범위 외 변경 3개 포함 |
| dependency | **LOW** | 조치 필요 없음. 신규 패키지 호환성 모두 정상. |

---

## 발견 없는 에이전트

- **dependency** — `@nestjs/schedule`, `cron`, `luxon` 모두 MIT 라이선스·피어 요건·엔진 요건 충족. 라이선스·보안 취약점·버전 충돌 없음.

---

## 권장 조치사항

**배포 전 필수 (1–6번)**

1. **`trust proxy` 수정** — `expressInstance.set('trust proxy', 1)` (Critical #2)
2. **`refresh()` User 관계 로드** — `findOne`에 `relations: ['user']` 추가 (WARNING #1)
3. **`emailOtp` 처리 결정** — 분기 구현 또는 DTO에서 제거 + spec 미구현 명시 (Critical #1)
4. **`reauthMode` unavailable 경로 수정** — 서버 403 수신 시 mode 전환 처리 (WARNING #17)
5. **`familyId` UUID 검증** — `ParseUUIDPipe` 적용 (WARNING #13)
6. **`sessions.controller.spec.ts` 작성** — 4개 엔드포인트 최소 커버 (Critical #3)

**권장 (7–14번)**

7. `auth.service.spec.ts` 이벤트 기록 단언 추가 (WARNING #2)
8. `login-history-pruner.service.spec.ts` 작성 (WARNING #3)
9. `loginHistory.record()` fire-and-forget 전환 (WARNING #23)
10. 크론 잡 `timeZone: 'Asia/Seoul'` 명시 (WARNING #5)
11. `onError` re-throw 제거 (WARNING #19)
12. `CREATE INDEX CONCURRENTLY` — 별도 `V040b` 마이그레이션 분리 (WARNING #7)
13. 커서 복합 키 `(created_at, id)` 전환 (WARNING #9)
14. `RevokeSessionDto.password` `@MaxLength(128)` 추가 (WARNING #15)

**선택 (15번 이후)**

15. `integrations` 범위 외 변경 분리 (WARNING #10)
16. `plan/in-progress/auth-sessions.md` 체크리스트 갱신 → `plan/complete/` 이동 (WARNING #29)
17. `SessionDto.ipAddress` Swagger 설명 수정 (WARNING #28)
18. `void IsNull` 제거 (INFO #1)
19. `AuthContext`/`RevokeContext` 통합 (WARNING #20)
20. `revokeOtherSessions` `@ApiOkWrappedResponse` 교체 (WARNING #12)

---

SUMMARY.md 파일 저장을 위한 쓰기 권한이 필요합니다. 허용해주시면 `review/2026-05-12_07-41-47/SUMMARY.md`에 저장하겠습니다.

보고서 요약:
- **Critical 3건** (emailOtp 미구현, trust proxy IP 스푸핑, SessionsController 테스트 전무)
- **WARNING 30건** (배포 전 필수 5건 포함)
- **INFO 9건**
- 전체 위험도: **HIGH**