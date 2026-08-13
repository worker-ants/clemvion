# 보안(Security) 코드 리뷰 — CCH-SE-02 chat-channel update dedup (`ChatChannelDedupService`)

44개 변경 파일 중 실제 실행 코드는 `chat-channel-dedup.service.ts`(신규) / `chat-channel-dedup.service.spec.ts`(신규) /
`chat-channel.module.ts` / `hooks.service.ts` / `hooks.service.spec.ts` 5개이고, 나머지(`CHANGELOG.md`,
`plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/**`, `review/code/**`, `review/consistency/**`)는
문서·이전 리뷰 라운드(`02_38_41`, `02_50_38`) 산출물 그대로다. 아래는 실행 코드에 대한 독립 분석이며,
`hooks.service.ts` 실제 소스를 직접 Read 하여 가드 순서를 재확인했다.

## 발견사항

- **[INFO]** provider 공급 `idempotencyKey` 길이 제한 없이 Redis 키 구성 — 이론적 리소스 소모 벡터
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:6`-`9` (`makeChatDedupKey`), 호출부 `codebase/backend/src/modules/hooks/hooks.service.ts:339`
  - 상세: `makeChatDedupKey(triggerId, idempotencyKey)` 는 provider 의 update id 를 검증·길이 제한 없이 그대로 Redis 키 접미사로 사용한다. 이 `SET NX EX` 호출은 의도적으로 `chatChannelRateLimiter.consume()` 보다 앞에 배선돼 있어 그 자체는 per-chat rate-limit 의 보호를 받지 않는다. 다만 이 지점 도달에는 `chatChannelInboundAuthenticator.verify()`(`hooks.service.ts:291`, provider 서명/시크릿 검증)를 먼저 통과해야 하고, 컨트롤러 레벨 body-size/throttle 가드도 앞서 적용된다 — 실질 익스플로잇 표면은 "유효한 provider 인증 자료를 가진 발신자가 큰 `idempotencyKey` 값을 대량 전송"하는 좁은 시나리오다. 동일 사안이 이전 두 리뷰 라운드(`02_38_41`, `02_50_38`)에서도 INFO 로 확인·유예됐고 근거(인증 선행, 상위 스로틀)가 실제 소스와 일치함을 재확인했다.
  - 제안: 급하지 않음. 필요 시 `claim()` 진입부에 `idempotencyKey` 상한 길이(예: 200자) clamp 를 방어적으로 추가할 수 있다.

- **[INFO]** Redis 미가용/에러 시 fail-open — 문서화된 의도된 트레이드오프, 신뢰 경계 붕괴 아님
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:55` (client 미주입 시 무경고 통과) / `:69`-`73` (`catch` → `logger.warn` → `true`)
  - 상세: Redis 장애 시 억제 없이 통과한다. 같은 모듈의 `ChatChannelRateLimiterService`·`PublicWebhookQuotaService` 와 동일 정책이며 클래스 docstring 이 명시 선언한다. 인증 우회·정보 노출은 없고 영향은 "재도착 억제가 최대 30초 창에서 무력화"뿐 — 가용성 저하이지 인가/신뢰 경계 문제가 아니다. `chat-channel-dedup.service.spec.ts` 의 "Redis 에러 → fail-open + warn" 및 `hooks.service.spec.ts` 의 호출부 warn 단언(`재도착 무시` 문자열)이 로그 소실 회귀까지 고정한다.
  - 제안: 조치 불필요.

- **[INFO]** catch 블록이 Redis 클라이언트 에러 메시지를 그대로 로그에 싣는다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:71` (`err instanceof Error ? err.message : String(err)`)
  - 상세: `hooks.service.ts` 의 다른 catch 블록들과 동일한 기존 관례다. 사용자 응답(`{ executionId: 'ignored' }`)에는 노출되지 않고 서버 로그로만 간다 — 신규 위험 아님, 민감정보(토큰·시크릿) 노출 경로도 아니다.
  - 제안: 조치 불필요.

## 점검했으나 문제 없음으로 판단한 항목

- **인젝션**: `this.redis.set(key, '1', 'EX', 30, 'NX')` 는 ioredis 파라미터화 호출(RESP 프로토콜)이며 raw 커맨드 문자열 조립이 아니다 — Redis 커맨드 인젝션 표면 없음. `triggerId`(DB 조회로 얻은 내부 UUID) + `idempotencyKey`(provider 값)를 콜론으로 단순 결합하지만 키가 `triggerId` 로 스코프돼 워크스페이스/트리거 경계를 벗어나지 않는다(`chat-channel-dedup.service.spec.ts` "trigger 가 다르면 서로를 막지 않는다" 케이스로 고정). SQL/경로탐색/XSS/커맨드 인젝션 해당 없음.
- **인증/인가**: `hooks.service.ts` 실제 소스를 직접 확인한 호출 순서 — `chatChannelInboundAuthenticator.verify()`(:291, provider 서명 검증) → `trigger.isActive` 재검사 → `adapter.parseUpdate()`(:320) → **dedup claim**(:339) → rate-limit(:354). dedup 게이트는 인증·활성 검사를 통과한 뒤에만 실행되므로 미인증 요청이 이 경로로 Redis 자원을 소모하거나 정당한 사용자의 재도착 억제 키를 조작할 수 없다.
- **하드코딩 시크릿**: 없음. `'CHAT_CHANNEL_DEDUP_REDIS'` 는 NestJS DI 토큰 문자열이며 자격증명이 아니다. `chat-channel.module.ts` 어디에도 이 토큰을 provide 하는 provider 가 없어(운영 경로는 항상 `RedisConnectionProvider` 폴백) 테스트 전용 오버라이드 훅일 뿐 — 하드코딩된 값이 아니다. `git diff` 전체 시크릿 패턴(`api_key=`, `password=`, `AKIA...`, PEM private key, 하드코딩 토큰) 스캔 결과 매치 없음.
- **입력 검증**: 빈 `idempotencyKey` 는 명시적으로 dedup 대상에서 제외해(`chat-channel-dedup.service.ts:58`) 서로 다른 update 가 한 키로 뭉쳐 억제가 아닌 유실로 이어지는 것을 방지 — 방어적으로 타당하다. `ChannelUpdate.idempotencyKey` 는 non-optional `string` 이고 세 파서(telegram/slack/discord) 모두 실 provider id 를 채운다.
- **SQL/DB**: 이 diff 는 SQL 을 만지지 않는다. `chat-channel.module.ts` 변경은 provider/export 배열에 서비스 추가뿐.
- **암호화/평문 전송**: 해당 없음(이 diff 범위 밖). 봇 토큰/서명 시크릿은 기존 `SecretResolver`/AES-256-GCM 경로로 별도 관리되며 이번 변경이 건드리지 않는다.
- **에러 처리**: 사용자에게 반환되는 응답에는 내부 에러 메시지·스택트레이스가 노출되지 않는다.
- **의존성 보안**: 새 외부 의존성 추가 없음(`ioredis` 기존 의존성 재사용).
- **문서/plan 변경**(`CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/**`, `review/**`): 실행 코드가 아니며 신규 시크릿·보안 이슈 없음. `spec/5-system/15-chat-channel.md` CCH-SE-02 문면 갱신은 실제 구현(키 형식·TTL·fail-open)과 일치해 spec-구현 드리프트를 줄이는 방향이다.

## 요약

`ChatChannelDedupService` 는 chat-channel inbound 재도착에 대한 원자적(`SET NX EX 30`) 억제를 provider 서명 검증 이후·rate-limit 이전 지점에 배선한다. 미인증 요청은 이 경로에 도달할 수 없고, Redis 호출은 파라미터화되어 인젝션 표면이 없으며, 키는 `triggerId` 로 스코프돼 트리거 경계를 넘지 않는다. fail-open 정책은 같은 모듈의 rate-limiter·quota 서비스와 일관되고 로그로 가시화되며(서비스 단위 + 호출부 양쪽에서 warn 단언), 사용자 응답에는 내부 에러가 노출되지 않는다. 이전 두 리뷰 라운드(`02_38_41`→WARNING 4건 조치·1건 유예, `02_50_38`→CRITICAL/WARNING 0)의 결론을 소스 직접 대조로 재검증했고 새로운 Critical/Warning 급 취약점은 발견되지 않았다. 유일한 잔여 관찰(INFO)은 `idempotencyKey` 길이 무제한으로 인한 이론적 리소스 소모 벡터인데, 인증 선행·상위 스로틀로 실질 위험이 낮아 즉시 조치가 필요한 수준은 아니다.

## 위험도
LOW
