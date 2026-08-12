# 보안(Security) 코드 리뷰 — CCH-SE-02 update dedup (`ChatChannelDedupService`) 재검토

이 라운드(`02_50_38`)는 직전 라운드(`02_38_41`)의 RESOLUTION 적용 결과에 대한 재검토다. 핵심 보안 표면(`ChatChannelDedupService` 신설, `HooksService` 배선, `ChatChannelModule` DI 등록)은 직전 라운드와 동일 코드이며, 이번 diff 에 새로 추가된 부분은 (1) `hooks.service.spec.ts` 의 호출부 warn 로그 단언 1건, (2) `CHANGELOG.md` 항목, (3) `spec/4-nodes/7-trigger/providers/telegram.md` / `spec/5-system/15-chat-channel.md` 의 문서 갱신, (4) `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크박스 — 전부 보안에 중립적인 문서/테스트 변경이다. 소스 코드(`chat-channel-dedup.service.ts`, `hooks.service.ts`, `chat-channel.module.ts`)는 실제 파일을 다시 Read 하여 프롬프트 diff 와 일치함을 확인했다.

## 발견사항

- **[INFO]** provider 공급 `idempotencyKey` 에 길이 제한 없이 Redis 키를 구성한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:9` (`makeChatDedupKey`), 호출부 `codebase/backend/src/modules/hooks/hooks.service.ts:339`
  - 상세: `makeChatDedupKey(triggerId, idempotencyKey)` 는 provider update id 를 검증·길이 제한 없이 그대로 Redis 키 접미사로 쓴다. 이 `SET NX EX` 호출은 `chatChannelRateLimiter.consume()` (요청 볼륨 제한) **보다 먼저** 배선돼 있어(의도된 설계 — 재도착이 쿼터를 소비하면 안 됨) 그 자체는 per-chat rate-limit 의 보호를 받지 않는다. 다만 이 지점에 도달하려면 `chatChannelInboundAuthenticator.verify()` (`hooks.service.ts:291`, provider 서명/시크릿 검증)와 컨트롤러 레벨 `PublicWebhookThrottleGuard` (`hooks.controller.ts:95`, `DEFAULT_MAX_BODY_BYTES` 로 요청 바디 전체 크기를 이미 제한)를 통과해야 한다. 실질 익스플로잇 표면은 "유효한 provider 인증 자료를 가진 발신자가 큰 `idempotencyKey` 값을 대량 전송"하는 좁은 시나리오로 한정된다.
  - 제안: 급하지 않음. 필요 시 상한 길이(예: 200자) clamp 를 `claim()` 진입부에 추가하는 방어적 하드닝을 고려할 수 있다.

- **[INFO]** Redis 장애 시 fail-open — 문서화된 의도된 트레이드오프.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:55` (client 미주입, 무경고) / `:69-73` (런타임 에러, `catch` → warn 후 `true`)
  - 상세: Redis 미가용/에러 시 억제 없이 통과한다. 같은 모듈의 `ChatChannelRateLimiterService`·`PublicWebhookQuotaService` 와 동일 정책이며 클래스 docstring 이 명시적으로 선언한다. 인증 우회나 정보 노출은 없고, 다운스트림 영향은 "재도착 억제가 최대 30초 창에서 무력화"뿐이다 — 가용성 저하이지 신뢰 경계 붕괴가 아니다. `chat-channel-dedup.service.spec.ts` 의 "Redis 에러 → fail-open + warn" 테스트, 그리고 이번 라운드에 새로 추가된 `hooks.service.spec.ts` CCH-SE-02 케이스의 호출부 warn 단언(`expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('재도착 무시'))`)이 로그 소실 회귀까지 고정한다.
  - 제안: 조치 불필요.

- **[INFO]** catch 블록이 Redis 에러 메시지를 그대로 로그에 싣는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:71`
  - 상세: `err instanceof Error ? err.message : String(err)` 를 `logger.warn` 에 삽입한다. 같은 파일이 속한 모듈의 다른 catch 블록들과 동일 패턴이며, 사용자에게 반환되는 응답(`{ executionId: 'ignored' }`)에는 노출되지 않고 서버 로그로만 간다. 신규 위험이 아니다.
  - 제안: 조치 불필요.

## 점검했으나 문제 없음으로 판단한 항목

- **인젝션**: `this.redis.set(key, value, 'EX', ttl, 'NX')` 는 ioredis 의 파라미터화 호출(RESP 프로토콜, length-prefixed bulk string)이며 raw 커맨드 문자열 조립이 아니다 — Redis 커맨드 인젝션 표면 없음. `triggerId`(내부 UUID, DB 조회 결과) + `idempotencyKey`(provider 값)를 콜론으로 단순 결합하지만 키가 `triggerId` 로 스코프돼 워크스페이스/트리거 경계를 벗어나지 않는다(`chat-channel-dedup.service.spec.ts` 의 "trigger 가 다르면 서로를 막지 않는다" 테스트로 고정).
- **인증/인가**: `hooks.service.ts` 를 직접 Read 해 순서를 재확인 — `chatChannelInboundAuthenticator.verify()`(:291, provider 서명 검증) → `trigger.isActive` 재검사(:301) → `adapter.parseUpdate()`(:320) → **dedup claim**(:339) → rate-limit(:354). dedup 은 인증·활성 검사를 통과한 뒤에만 실행되므로 미인증 요청이 이 경로로 Redis 자원을 소모할 수 없다.
- **하드코딩 시크릿**: 없음. `'CHAT_CHANNEL_DEDUP_REDIS'` 는 NestJS DI 토큰 문자열이며 자격 증명이 아니고, `chat-channel.module.ts` 어디에도 이 토큰을 provide 하는 곳이 없어(운영 경로는 `RedisConnectionProvider` 폴백만 탐) 테스트 전용 오버라이드 훅이다.
- **SQL/DB**: 이 diff 는 SQL 을 만지지 않는다. `chat-channel.module.ts` 변경은 provider/export 배열에 서비스 추가뿐.
- **암호화/평문 전송**: 해당 없음(이 diff 범위 밖 — 봇 토큰/서명 시크릿은 기존 `SecretResolver`/AES-256-GCM 경로로 별도 관리되며 이번 변경이 건드리지 않음).
- **에러 처리**: 사용자 응답(`{ executionId: 'ignored' }`)에는 내부 에러 메시지가 노출되지 않는다.
- **의존성 보안**: 새 외부 의존성 추가 없음(`ioredis` 재사용).
- **재검토 확인**: 이번 라운드에서 추가된 `hooks.service.spec.ts` 의 warn 단언(직전 WARNING #4 조치)은 보안 관점에서 회귀 감지력을 높이는 방향으로만 작용하며 새 취약점을 도입하지 않는다. `CHANGELOG.md`/`spec/4-nodes/7-trigger/providers/telegram.md`/`spec/5-system/15-chat-channel.md` 의 문서 변경은 서술 갱신뿐으로 실행 코드에 영향 없다.

## 요약

`ChatChannelDedupService` 는 chat-channel inbound 재도착에 대한 원자적(`SET NX EX 30`) 억제를 provider 서명 검증 이후·rate-limit 이전에 배선한다. 미인증 요청은 이 경로에 도달할 수 없고, Redis 커맨드는 파라미터화되어 인젝션 표면이 없으며, fail-open 정책은 기존 관례와 일관되고 로그로 가시화된다(이번 라운드에서 호출부 warn 단언까지 추가돼 관측 가능성이 더 보강됐다). 소스 코드는 직전 라운드에서 이미 검토된 것과 동일함을 재확인했고, 이번 라운드의 변경분(테스트 단언·CHANGELOG·spec 문서 정정)은 보안적으로 중립적이다. CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

LOW
