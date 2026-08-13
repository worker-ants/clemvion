# 보안(Security) 코드 리뷰 — CCH-SE-02 update dedup (`ChatChannelDedupService`) 통합 라운드

이번 프롬프트 번들은 67개 파일로 구성되지만, 실제 실행 코드 변경은 `git diff origin/main...HEAD --stat -- codebase/` 로 재확인한 5개 파일뿐이다:

- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` (신규)
- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts` (신규)
- `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` (provider/export 등록)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (dedup 게이트 배선)
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts` (호출부 테스트)

나머지(CHANGELOG, plan, spec 3건, `review/code/**`·`review/consistency/**` 산출물 60여 개)는 문서·이전
리뷰 라운드(`02_38_41`, `02_50_38`, `09_09_58`) 산출물이며 실행 코드가 아니다. 실제 소스(`chat-channel-dedup.service.ts`,
`hooks.service.ts`, `chat-channel.module.ts`)를 `Read`/`Grep` 으로 직접 열어 프롬프트 diff 와 일치함을
독립적으로 재확인했다.

## 발견사항

- **[INFO]** provider 가 공급하는 `idempotencyKey` 에 길이 제한 없이 Redis 키를 구성한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:9` (`makeChatDedupKey`), 호출부 `codebase/backend/src/modules/hooks/hooks.service.ts:339`
  - 상세: `makeChatDedupKey(triggerId, idempotencyKey)` 는 provider update id(텔레그램 `update_id`/Slack `event_id`/Discord interaction id) 를 검증·길이 제한 없이 그대로 Redis 키 접미사로 사용한다. 이 `SET NX EX` 호출은 의도적으로 `ChatChannelRateLimiterService.consume()`(요청 볼륨 제한) **보다 먼저** 배선돼(재도착이 쿼터를 소비하면 안 되므로) 있어 그 자체는 per-chat rate-limit 의 보호를 받지 않는다. 다만 이 지점 도달에는 `chatChannelInboundAuthenticator.verify()`(`hooks.service.ts:291`, provider 서명 검증)와 컨트롤러 레벨 `PublicWebhookThrottleGuard`(`hooks.controller.ts:95`)를 먼저 통과해야 하므로, 실질 익스플로잇 표면은 "유효한 provider 인증 자료를 가진 발신자가 매우 큰 `idempotencyKey` 값을 대량 전송"하는 좁은 시나리오로 한정된다.
  - 제안: 급하지 않음. 필요 시 `claim()` 진입부에 상한 길이(예: 200자) clamp 를 방어적으로 추가할 수 있다.

- **[INFO]** Redis 미가용/에러 시 fail-open — 문서화된 의도된 트레이드오프, 신뢰 경계 붕괴 아님.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:55` (client 미주입 시 무경고 통과), `:69`-`73` (`catch` → `logger.warn` → `true`)
  - 상세: Redis 장애 시 억제 없이 통과(`return true`)한다. 같은 모듈의 `ChatChannelRateLimiterService`·`PublicWebhookQuotaService` 와 동일 정책이며 클래스 docstring 이 명시적으로 선언한다. 인증 우회·정보 노출은 없고, 영향은 "재도착 억제가 최대 30초 창에서 무력화"뿐 — 가용성 저하이지 인가/신뢰 경계 문제가 아니다. `chat-channel-dedup.service.spec.ts` 의 "Redis 에러 → fail-open + warn" 테스트와 `hooks.service.spec.ts` 의 호출부 warn 단언(`재도착 무시` 문자열)이 로그 소실 회귀까지 고정한다.
  - 제안: 조치 불필요.

- **[INFO]** catch 블록이 Redis 클라이언트 에러 메시지를 그대로 로그에 싣는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:71` (`err instanceof Error ? err.message : String(err)`)
  - 상세: `hooks.service.ts` 의 다른 catch 블록들과 동일한 기존 관례다. 사용자에게 반환되는 응답(`{ executionId: 'ignored' }`)에는 노출되지 않고 서버 로그로만 간다 — 신규 위험 아님, 자격증명·토큰 노출 경로도 아니다.
  - 제안: 조치 불필요.

## 점검했으나 문제 없음으로 판단한 항목

- **인젝션**: `this.redis.set(key, '1', 'EX', CHAT_DEDUP_WINDOW_SEC, 'NX')` 는 ioredis 파라미터화 호출(RESP 프로토콜)이며 raw 커맨드 문자열 조립이 아니다 — Redis 커맨드 인젝션 표면 없음. `triggerId`(DB 조회로 얻은 내부 UUID) + `idempotencyKey`(provider 값)를 콜론으로 단순 결합하지만 키가 `triggerId` 로 스코프돼 트리거 경계를 넘지 않는다(`chat-channel-dedup.service.spec.ts` "trigger 가 다르면 서로를 막지 않는다" 테스트로 고정). SQL/경로탐색/XSS/커맨드 인젝션 해당 없음.
- **인증/인가**: `hooks.service.ts` 실제 소스를 직접 확인한 호출 순서 — `chatChannelInboundAuthenticator.verify()`(:291, provider 서명 검증) → `trigger.isActive` 재검사(:301) → `adapter.parseUpdate()`(:320) → **dedup claim**(:339) → rate-limit(:354). dedup 게이트는 인증·활성 검사를 통과한 뒤에만 실행되므로 미인증 요청이 이 경로로 Redis 자원을 소모하거나 정당한 사용자의 억제 키를 조작할 수 없다.
- **하드코딩 시크릿**: 없음. `'CHAT_CHANNEL_DEDUP_REDIS'` 는 NestJS DI 토큰 문자열이며 자격증명이 아니다. `grep -rn "CHAT_CHANNEL_DEDUP_REDIS" codebase/backend/src/` 로 전수 확인한 결과 이 토큰을 실제로 `provide` 하는 곳이 코드베이스 어디에도 없다 — 운영 경로는 항상 `RedisConnectionProvider` 폴백을 타고, 이 토큰은 테스트 전용 오버라이드 훅일 뿐이다. API 키·비밀번호·PEM·JWT 시크릿 패턴 매치 없음.
- **입력 검증**: 빈 `idempotencyKey` 는 명시적으로 dedup 대상에서 제외해(`chat-channel-dedup.service.ts:58`) 서로 다른 update 가 한 키로 뭉쳐 "억제"가 아니라 "유실"이 되는 것을 방지한다 — 방어적으로 타당하다. `ChannelUpdate.idempotencyKey` 는 `types.ts:129` 에서 non-optional `string` 으로 선언돼 파서 3종(telegram/slack/discord) 모두 실 provider id 를 채운다.
- **SQL/DB**: 이 diff 는 SQL 을 만지지 않는다. `chat-channel.module.ts` 변경은 provider/export 배열에 서비스 추가뿐.
- **암호화/평문 전송**: 해당 없음(이 diff 범위 밖). 봇 토큰/서명 시크릿은 기존 `SecretResolver`/AES-256-GCM 경로로 별도 관리되며 이번 변경이 건드리지 않는다.
- **에러 처리**: 사용자에게 반환되는 응답(`{ executionId: 'ignored' }`)에는 내부 에러 메시지·스택트레이스가 노출되지 않는다.
- **의존성 보안**: 새 외부 의존성 추가 없음(`ioredis` 기존 의존성 재사용).
- **문서/plan/review 변경**(`CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/**`, `review/**`): 실행 코드가 아니며 신규 시크릿·보안 이슈 없음. `spec/5-system/15-chat-channel.md`·`spec/4-nodes/7-trigger/providers/telegram.md`·`spec/data-flow/14-chat-channel.md` 의 CCH-SE-02 문면 갱신은 실제 구현(키 형식·TTL·fail-open)과 일치해 spec-구현 드리프트를 줄이는 방향이며, 보안적으로 새로 노출되는 정보는 없다.

## 요약

`ChatChannelDedupService` 는 chat-channel inbound 재도착(re-delivery)에 대한 원자적(`SET NX EX 30`)
억제를 provider 서명 검증(`chatChannelInboundAuthenticator.verify`) 이후·`ChatChannelRateLimiterService.consume`
이전 지점에 배선한다. 미인증 요청은 이 경로에 도달할 수 없고, Redis 호출은 파라미터화되어 인젝션
표면이 없으며, 키는 `triggerId` 로 스코프돼 트리거/워크스페이스 경계를 넘지 않는다. fail-open 정책은
같은 모듈의 rate-limiter·quota 서비스와 일관되고 서비스 단위·호출부 양쪽에서 warn 단언으로
관측 가능성이 보장돼 있다. 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회·평문 전송·민감정보 로그
노출 어느 것도 발견되지 않았다. 유일한 잔여 관찰(INFO)은 `idempotencyKey` 길이 무제한으로 인한
이론적 리소스 소모 벡터인데, 인증 선행·상위 스로틀(`PublicWebhookThrottleGuard`)로 실질 위험이
낮아 즉시 조치가 필요한 수준은 아니다. 이 결과는 동일 코드를 세 차례(`02_38_41`, `02_50_38`,
`09_09_58`) 독립 검토한 이전 라운드의 결론(CRITICAL/WARNING 0, LOW)과 일치한다.

## 위험도

LOW
