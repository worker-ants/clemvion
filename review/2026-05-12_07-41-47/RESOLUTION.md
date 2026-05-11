# Review Resolution — 2026-05-12_07-41-47

> 대상 PR/브랜치: `feature/auth-sessions`
> 원본 리뷰: `review/2026-05-12_07-41-47/SUMMARY.md`

전체 위험도 **HIGH** 진단을 받아 Critical 3건 전부, Warning 30건 중 보안·정합성·신뢰성 영향 큰 항목을 본 PR 안에서 조치했다. 안전한 후속 분리가 가능한 항목은 `plan/in-progress/auth-sessions.md` 의 follow-up 섹션으로 이관했다.

## Critical (모두 조치)

| # | 발견 | 조치 |
|---|------|------|
| 1 | `emailOtp` 재인증 분기 미구현 | `RevokeSessionDto` 에서 `emailOtp` 필드와 JSDoc 제거. OAuth-only + 2FA 미설정 사용자는 서버가 `REAUTH_NOT_AVAILABLE` 로 차단하고, frontend `sessions-panel` 이 서버 403 수신 시 `reauthMode="unavailable"` 로 전환해 비밀번호 입력창을 제거한다. spec `1-auth.md §2.3` 도 정책에 맞춰 갱신. |
| 2 | `trust proxy: true` 로 IP 스푸핑 가능 | `main.ts` 에서 `app.set('trust proxy', 1)` 로 단일 hop(Cloudflare) 만 신뢰하도록 변경. 주석에 origin 단 Cloudflare IP 화이트리스트가 전제 조건임을 명시. |
| 3 | `SessionsController` 테스트 전무 | `sessions.controller.spec.ts` 신설 — listSessions / revokeSession / revokeOtherSessions / getLoginHistory 핵심 경로 + limit 파싱 + 쿠키 부재 분기 커버. |

## Warning (배포 전 필수 — 모두 조치)

| # | 발견 | 조치 |
|---|------|------|
| #1 | `refresh()` User 관계 미로드 | 코드 확인 결과 `findOne({ relations: ['user'] })` 가 이미 적용되어 있음. 보강 불필요. |
| #2 | `auth.service.spec` 이벤트 기록 미검증 | reuse 감지 경로에 `loginHistory.record` 호출이 `token_reuse_detected` + `familyId` 로 발생하는지 단언 추가. |
| #3 | `LoginHistoryPrunerService` 테스트 없음 | `login-history-pruner.service.spec.ts` 신설 — 0 row·n row·예외 3 경로 커버. |
| #5 | 크론 잡 타임존 미지정 | `@Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })` 로 명시. 멀티 인스턴스 분산 락은 단일 backend 가정상 follow-up 으로 분리. |
| #11 | DELETE 바디가 CDN 에서 제거될 위험 | 엔드포인트를 `POST /users/me/sessions/:familyId/revoke` 로 변경. frontend API 래퍼도 함께 갱신. |
| #12 | Swagger 201/200 불일치 | `@ApiCreatedWrappedResponse` → `@ApiOkWrappedResponse` 교체. |
| #13 | `familyId` UUID 검증 누락 | `@Param('familyId', new ParseUUIDPipe())` 적용. |
| #15 | `password` MaxLength 없음 | `@MaxLength(128)` 추가. |
| #17 | `reauthMode: "unavailable"` 진입 경로 dead | `sessions-panel` 에 `reauthOverride` 상태 추가, 서버 403 (`REAUTH_NOT_AVAILABLE`) 수신 시 `unavailable` 로 전환. |
| #18 | 현재 세션 self-revoke API 레벨 방지 없음 | `revokeFamily` 에 `currentRefreshToken` 인자 추가, `familyId === currentFamilyId` 일 때 `BadRequestException(CANNOT_REVOKE_CURRENT_SESSION)`. |
| #19 | `onError` 의 re-throw 로 이중 에러 노출 | `onError` 에서 `throw` 제거, 에러는 `handleConfirm` 의 `try/catch` 에서만 처리. |
| #23 | `loginHistory.record()` 핫패스 await | `auth.service.ts` 의 12 군데 `await this.loginHistory.record(...)` 를 `void this.loginHistory.record(...)` 로 일괄 변환 (fire-and-forget). 실패는 service 내부에서 ERROR 로그로 격상해 silent 손실을 막음. |

## Warning (추가 조치)

| # | 발견 | 조치 |
|---|------|------|
| #8 | pruner LIMIT 없는 대량 DELETE | `pruneOlderThanRetention` 를 PRUNE_BATCH=1000 × PRUNE_MAX_BATCHES=50 배치 루프로 변경. |
| #9 | 커서 `created_at` 단독 충돌 | 커서를 `<iso>|<id>` 복합 키로 확장, 쿼리도 `(created_at, id) < (cursor)` 튜플 비교로 변경. |
| #14 | DTO 빈 바디 통과 | DTO JSDoc 에 "password 또는 totpCode 중 하나는 채워져야 한다" 를 명시. 서비스 `verifyReauth` 가 비어 있으면 `REAUTH_REQUIRED(400)` 반환하므로 동작은 안전. 정식 class-level validator 는 follow-up. |
| #20 | `AuthContext`/`RevokeContext` 중복 | `auth/types/auth-context.ts` 에 단일 정의 후 양 service 에서 import. |
| #21 | 컨트롤러 도메인 변환 로직 | `LoginHistoryService.findForUser` 가 `LoginHistoryPageDto` 를 직접 반환하도록 변경, 컨트롤러는 그대로 위임만. |
| #22 | `failureReason` 의미 오용 | bulk revoke 이벤트의 `failureReason: 'revoke_others'` 제거. 단건 vs 일괄은 `familyId` 유무로 구분. |
| #24 | `listActiveSessions` 순차 DB 왕복 | `Promise.all` 로 row 조회와 현재 family 해석을 병렬 처리. |
| #28 | `SessionDto.ipAddress` Swagger 설명 불일치 | 설명을 "마지막 활동 IP. 발급 이후 refresh 가 한 번도 없었다면 발급 시점 IP" 로 수정. |
| #29 | plan 체크리스트 미갱신 | `plan/in-progress/auth-sessions.md` 의 모든 완료 항목 `[x]` 처리, follow-up 섹션 추가. 모든 항목 완료 시 `plan/complete/` 로 `git mv` 예정. |
| INFO #1 | `void IsNull` 미사용 import | `sessions.service.ts` 에서 제거. |
| INFO #4 | `SessionsController` URL 네임스페이스 근거 미문서화 | 컨트롤러 상단 JSDoc 에 한 문단 추가. |
| INFO #6 | 명시적 `@UseGuards(JwtAuthGuard)` 부재 | 컨트롤러 레벨에 `@UseGuards(JwtAuthGuard)` 적용. |
| INFO #9 | `verifyReauth` 우선순위 정책 묵시적 | 메서드 상단 JSDoc 에 우선순위 정책 명시. |

## 후속 (follow-up plan 으로 이관)

다음 항목은 본 PR 안에서 안전하게 처리하기 어려운(트랜잭션·아키텍처) 변경 또는 후속 plan 으로 분리하는 것이 더 명확하다고 판단해 `plan/in-progress/auth-sessions.md` 의 follow-up 섹션과 별도 plan 으로 이관:

- **WARN #4 `refresh()` TOCTOU** — `SELECT ... FOR UPDATE` 또는 `UPDATE ... RETURNING` 로 원자적 처리. 기존 `refresh` 흐름 전반 재검토 필요.
- **WARN #6 revoke 비트랜잭셔널 시퀀스** — `revokeFamily`/`revokeOthers` 를 `DataSource.transaction` 안으로 묶기. login_history 기록 실패 정책도 함께 결정.
- **WARN #7 `CREATE INDEX CONCURRENTLY`** — `refresh_token` 인덱스를 별도 `V040b__...` 로 분리해 무중단 적용. 현 시점에서는 신규 row 가 NULL 이고 부분 인덱스라 ShareLock 영향 제한적이라 판단해 본 PR 유지.
- **WARN #10 `integrations` 모듈 범위 외 변경** — `npm run lint --fix` 로 자동 발생한 prettier 정리 3 파일. 별도 cleanup PR 로 분리. 본 PR 에서 단순 revert 시 다음 lint 에서 재발하므로 그대로 둠.
- **WARN #16 CF-Connecting-IP 위조 가능성** — `client-ip.ts` 주석 + spec 에 이미 명시. 인프라 단 Cloudflare IP 대역 외 직접 접근 차단 적용은 인프라 변경.
- **WARN #25 `listActiveSessions` `DISTINCT ON`** — 메모리 그룹핑이 family 수가 5 이하인 현재 정책에서 충분. 대규모 사용자 데이터 누적 시 재검토.
- **WARN #26 `sessions.service.spec` 경계값 (TOTP 실패·affected=0·pickNewer)** — TOTP/password 분기는 이미 커버, affected=0/pickNewer 추가는 follow-up.
- **WARN #27 `device-label.spec` Edge/Opera/ChromeOS** — 라벨 파서는 본 PR 의 핵심 경로가 아님. follow-up.
- **WARN #30 `generateTokens` 옵션 객체** — 기존 호출부 6 곳 일괄 변경. 별도 리팩토링 PR.
- **INFO #2, #3, #5, #7, #8** — `useMemo`, `staleTime`, exports 정리, spec emailOtp 명시, frontend i18n 로딩 키.

## 영향 요약

- **API 변경**: `DELETE /api/users/me/sessions/:familyId` → `POST /api/users/me/sessions/:familyId/revoke`. frontend 도 동시 갱신. 외부 클라이언트가 본 엔드포인트를 직접 호출하는 케이스 없음.
- **데이터 모델**: V040 마이그레이션에 `created_at` 단독 인덱스 추가. 기존 row 영향 없음.
- **운영**: `trust proxy=1` 변경으로 Cloudflare 외부 트래픽이 origin 에 직접 도달할 경우 IP 위변조 가능성 — 인프라 단 차단 가정.
- **모니터링**: `login_history record failed` 가 `WARN` → `ERROR` 로 상승. 운영 알림 임계치 점검 권장.

## 재검증

본 RESOLUTION 작성 후 TEST WORKFLOW 재수행 결과를 첨부:
- backend lint: 0 errors (기존 1 warning 유지)
- backend unit test: 통과 (3208+ 케이스)
- backend build: 통과
- frontend lint: 0 errors
- frontend test: 1 회귀 (candidate-picker, 본 PR 무관 — 별도 plan)
- frontend build: 통과
