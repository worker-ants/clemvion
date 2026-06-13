# 보안(Security) 리뷰

## 발견사항

### [INFO] stored-XSS 표면 축소 — `conversationKey` 를 `chatChannelLastError` 에서 제외한 설계는 올바름
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` — `markChatChannelRateLimited` 메서드
- 상세: 코드 주석 "외부 입력(conversationKey)을 lastError 에 넣지 않는다 (관리자 UI stored-XSS 표면 축소)" 가 명시적으로 XSS 위협을 인식하고 완화한다. `chatChannelLastError` 에 저장되는 문자열 `Inbound rate limit exceeded (${limitPerMinute}/min)` 는 외부 사용자 입력이 전혀 포함되지 않고, `limitPerMinute` 는 `Math.max(1, Math.min(600, Math.floor(limitPerMinute) || 60))` 로 이미 clamp 된 정수값이므로 인젝션 위험이 없다.
- 제안: 설계 적절. 향후 이 필드에 외부 입력을 추가하려는 경우 반드시 이 주석을 재검토해야 함을 명확히 해두는 것이 좋다.

### [INFO] Redis 키(`makeChatRateLimitKey`)에 외부 입력(`triggerId`, `conversationKey`) 사용 — 구조적으로 안전
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` L145-148 — `makeChatRateLimitKey`
- 상세: Redis 키는 `` `cc:rl:${triggerId}:${conversationKey}` `` 형식이다. Redis 는 SQL 처럼 키 값으로 명령 인젝션이 불가능한 구조이므로 커맨드 인젝션 위험은 없다. `triggerId` 는 NestJS DI 를 통해 DB 에서 조회된 UUID(콜론 없음), `conversationKey` 는 어댑터가 파싱한 채널 식별자다. 키가 길어지더라도 Redis 키 길이 제한(512 MB) 안에서 서비스 거부(DoS) 위험은 실질적으로 없다. 단, `conversationKey` 의 길이가 매우 긴 경우(예: 악의적으로 조작된 webhook payload) Redis 메모리를 낭비할 수 있다. 그러나 이 경로는 `parseUpdate` 이후(어댑터가 파싱·검증 후 반환한 값)이므로 어댑터가 conversationKey 를 적절히 제한할 책임을 진다.
- 제안: 어댑터별 `conversationKey` 최대 길이 제한이 명시적으로 문서화되어 있는지 확인 권장. 현 코드 자체의 추가 조치는 불필요.

### [INFO] `limitPerMinute` 입력 검증 — clamp 로 전체 차단 방지
- 위치: `chat-channel-rate-limiter.service.ts` L196 — `const limit = Math.max(1, Math.min(600, Math.floor(limitPerMinute) || 60));`
- 상세: `limitPerMinute` 에 0, 음수, `NaN`, `Infinity` 가 들어올 경우에도 `Math.floor(...) || 60` → `Math.max(1, ...)` 체인이 항상 1 이상의 정수를 보장한다. 이 방어 코드는 config 우회나 레거시 값으로 `limit = 0` 이 설정되어 모든 inbound 가 영구 차단되는 시나리오를 막는다. 보안 관점에서 DoS 방어 코드로 평가된다.
- 제안: 설계 적절. 해당 없음.

### [INFO] fail-open 정책 — Redis 장애 시 rate-limit 미적용
- 위치: `chat-channel-rate-limiter.service.ts` — `if (!this.redis) return true`, `if (!results || results.length === 0) return true`, `catch` 블록 `return true`
- 상세: Redis 가 완전히 미가용하거나 오류가 발생하면 rate-limit 이 우회된다(fail-open). 이는 가용성 우선 정책으로 문서에 명시된 의도된 설계다. 보안 관점에서 Redis 장애 시 rate-limit 이 우회되므로, Redis 인프라 자체가 가용성 공격(DoS)의 대상이 될 경우 rate-limit 보호도 함께 무력화된다. 단, rate-limit 은 "방어적 기능"으로 서비스 가용성을 희생하면서까지 강제할 필요는 없다는 트레이드오프가 이미 설계에 반영되어 있다.
- 제안: Redis 장애 시 fail-open 으로 전환되는 상황을 모니터링하는 메트릭/알람이 있는지 확인 권장. 현재 코드는 `logger.warn` 으로 로그를 남기나, Redis 장애 + 대용량 inbound 폭주가 동시에 발생하는 공격 시나리오에 대한 별도 알람 경로가 있으면 운영 가시성이 향상된다.

### [INFO] DI 토큰 `'CHAT_CHANNEL_RATE_LIMIT_REDIS'` — 하드코딩된 문자열이나 시크릿 아님
- 위치: `chat-channel-rate-limiter.service.ts` L175 — `@Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')`
- 상세: 이 문자열은 NestJS DI 주입 토큰으로, 비밀번호·API 키·인증서 등 민감 정보가 아니다. 하드코딩된 시크릿 관점에서 위험 없음.
- 제안: 해당 없음.

### [INFO] 에러 메시지 노출 — `err.message` 가 로그에 기록되나 응답에는 미포함
- 위치: `chat-channel-rate-limiter.service.ts` L211-213 — `this.logger.warn(... err.message ...)`, `hooks.service.ts` `markChatChannelRateLimited` warn 로그
- 상세: Redis 오류 메시지(`err.message`)가 서버 로그에 기록된다. 로그는 운영자만 접근하는 내부 채널이며, 이 정보가 HTTP 응답 바디에 포함되지 않는다. `chatChannelLastError` 에 저장되는 내용도 오류 메시지가 아니라 rate-limit 한도 수치만 포함한다. 따라서 외부 클라이언트에 민감 정보가 노출되는 경로는 없다.
- 제안: 해당 없음.

### [INFO] `conversationKey` 가 `chatChannelLastError` 에 누락된 점 — 보안상 올바른 결정이나 운영 진단 제약
- 위치: `hooks.service.ts` — `markChatChannelRateLimited` 내 주석
- 상세: rate-limit 초과 시 어느 conversation 이 초과했는지 `chatChannelLastError` 에 기록하지 않는 것은 stored-XSS 방어 측면에서 옳다. 그러나 관리자가 어느 chat 에서 폭주가 발생했는지 파악하려면 운영 로그나 메트릭에 의존해야 한다. 이는 보안과 운영 가시성 간의 의도된 트레이드오프이며, 보안 관점에서는 올바른 선택이다.
- 제안: 로그(`logger.warn`)에 `conversationKey` 를 포함시켜 운영 진단을 지원하는 것을 고려할 수 있다. 단, 로그는 내부 접근이므로 XSS 위험이 없다. 현재 로그에 `triggerId` 는 기록되나 `conversationKey` 는 없으므로 진단 가시성 보강 여지가 있다.

### [INFO] 의존성 보안 — 신규 외부 패키지 없음, `ioredis ^5.10.1` 기존 버전 유지
- 위치: `package.json` / `package-lock.json`
- 상세: 이번 변경은 신규 외부 패키지를 추가하지 않는다. 기존 `ioredis ^5.10.1` 을 type-only import 로 재사용한다. `ioredis 5.x` 에 현재 시점(2026-06) 기준 알려진 Critical CVE 가 없다(`package-lock.json` 변경 내용이 제공되지 않았으나, dependency 리뷰어가 `ioredis` 에 대한 취약점 없음을 확인). 의존성 보안 위험 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경(CCH-NF-03 per-chat Redis fixed-window rate-limit)은 보안 관점에서 전반적으로 건전하다. 특히 주목할 긍정적 설계 결정은 (1) 외부 입력(`conversationKey`)을 `chatChannelLastError` 에 포함하지 않아 관리자 UI stored-XSS 표면을 명시적으로 축소한 점, (2) `limitPerMinute` 에 0/음수/NaN 방어 clamp 를 적용하여 설정 오류로 인한 전체 차단(DoS) 시나리오를 방지한 점, (3) 에러 메시지가 HTTP 응답에 노출되지 않고 내부 로그에만 기록되는 점이다. 인젝션 취약점(SQL/XSS/커맨드), 하드코딩된 시크릿, 인증 우회, 신규 의존성 취약점은 발견되지 않았다. fail-open 정책은 Redis 장애 시 rate-limit 이 우회되는 특성을 내포하나, 이는 문서화된 의도된 설계 결정이며 가용성 우선 트레이드오프로 적절하다. 모든 발견사항은 INFO 수준으로, Critical 또는 Warning 등급의 보안 취약점은 없다.

## 위험도

LOW

STATUS: SUCCESS
