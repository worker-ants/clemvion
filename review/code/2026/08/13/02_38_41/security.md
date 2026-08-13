# 보안(Security) 코드 리뷰 — CCH-SE-02 update dedup (`ChatChannelDedupService`)

## 발견사항

- **[INFO]** provider 가 공급하는 `idempotencyKey` 에 길이 제한 없이 Redis 키를 구성 — 잠재적 리소스 소모(볼류메트릭) 벡터
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:9` (`makeChatDedupKey`), 호출부 `codebase/backend/src/modules/hooks/hooks.service.ts:339`
  - 상세: `makeChatDedupKey(triggerId, idempotencyKey)` 는 `idempotencyKey`(provider 의 update id — 텔레그램 `update_id`/Slack `event_id`/Discord interaction id) 를 검증·길이 제한 없이 그대로 Redis 키 접미사로 사용한다. `SET NX EX` 호출은 `chatChannelRateLimiter.consume()`(요청 볼륨 제한) **보다 앞**에 배선돼(의도된 설계 — 재도착이 쿼터를 소비하면 안 되므로) 있어, 이 SET 호출 자체는 per-chat rate-limit 의 보호를 받지 않는다. 다만 (1) `chatChannelInboundAuthenticator.verify()` 가 이 지점보다 먼저 provider 서명/시크릿을 검증하므로 유효한 인증 자료 없이는 도달할 수 없고, (2) 컨트롤러 레이어의 `PublicWebhookThrottleGuard` 가 엔드포인트 단위로 이미 전역 스로틀링을 걸어 두므로, 실질 익스플로잇 표면은 "유효한 봇 토큰/서명 키를 가진 발신자가 매우 큰/서로 다른 `idempotencyKey` 를 대량 전송" 하는 좁은 시나리오로 한정된다. 심각도는 낮지만 이 변경으로 새로 생긴 표면이라 기록한다.
  - 제안: 급하지 않음. 필요 시 `idempotencyKey` 에 상한 길이(예: 200자, 이 저장소가 `readKey`/`MAX_KEY_LENGTH` 에서 이미 쓰는 관례와 동일 패턴)를 적용하는 방어적 clamp 를 고려할 수 있다.

- **[INFO]** Redis 장애 시 fail-open — 문서화된 의도된 트레이드오프, 부작용 없음
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:69-73` (`catch (err) { … return true; }`)
  - 상세: Redis 미가용/에러 시 억제 없이 통과(`return true`)한다. 이는 같은 모듈의 `ChatChannelRateLimiterService`·`PublicWebhookQuotaService` 와 동일 정책이며, 클래스 docstring 이 명시적으로 선언하고 `warn` 로그도 남긴다(`chat-channel-dedup.service.spec.ts` 의 "Redis 에러 → fail-open + warn" 테스트가 로그 소실 회귀까지 고정). 인증 우회나 정보 노출은 없다 — 다운스트림 영향은 "duplicate 처리가 최대 30초 창에서 가능해짐" 뿐이며 이는 방어기능의 가용성 저하이지 신뢰 경계 붕괴가 아니다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 로그에 원본 에러 메시지 포함 — 기존 관례와 동일 수준, 신규 위험 아님
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:71` (`err instanceof Error ? err.message : String(err)`)
  - 상세: `logger.warn` 이 Redis 클라이언트 에러의 `message` 를 그대로 로그에 싣는다. 이 파일이 속한 `hooks.service.ts` 의 다른 모든 catch 블록(`markChatChannelRateLimited`, `reNoiseFormModal`, `handleFormStep` 등)도 동일 패턴을 쓰고 있어 이 diff 가 새로 도입한 위험이 아니다. 사용자에게 노출되는 응답이 아니라 서버 로그로만 가므로 정보 노출 위험은 낮다.
  - 제안: 조치 불필요.

## 점검했으나 문제 없음으로 판단한 항목

- **인젝션**: `redis.set(key, value, 'EX', ttl, 'NX')` 는 ioredis 파라미터화 호출이며 raw 커맨드 문자열 조립이 아니다 — Redis 커맨드 인젝션 표면 없음. `triggerId`(내부 UUID) + `idempotencyKey`(provider 값) 를 단순 문자열 결합으로 키를 만들지만, 이는 이 저장소 전반의 Redis 키 관례와 동일하며 콜론(`:`)이 섞여도 키 스코프 충돌만 발생할 수 있을 뿐(다른 트리거의 억제를 우연히 공유하는 정도) 권한 상승이나 크로스 테넌트 유출로 이어지지 않는다(키가 `triggerId` 로 스코프되어 워크스페이스 경계를 벗어나지 않음 — 테스트 `trigger 가 다르면 서로를 막지 않는다` 로 고정됨).
- **인증/인가**: `handleChatChannelWebhook` 내 배선 순서를 확인 — `chatChannelInboundAuthenticator.verify()`(서명 검증) → `isActive` 체크 → `parseUpdate()` → **dedup claim** → rate-limit. dedup 은 인증·활성 검사를 통과한 뒤에만 실행되므로 미인증 요청이 이 경로로 Redis 자원을 소모할 수 없다.
- **하드코딩 시크릿**: 없음. `CHAT_CHANNEL_DEDUP_REDIS` 는 NestJS DI 토큰이며 값이 아니다.
- **SQL/DB**: 이 diff 는 SQL 을 만지지 않는다. `chat-channel.module.ts` 변경은 provider/export 배열에 서비스 추가뿐.
- **암호화**: 해당 없음(이 diff 범위 밖).
- **에러 처리**: 사용자 응답(`{ executionId: 'ignored' }`)에는 내부 에러 메시지가 노출되지 않는다 — 노출은 서버 로그로만 제한.
- **의존성**: 새 외부 의존성 추가 없음 (`ioredis` 는 기존 의존성 재사용).
- 테스트 파일(`chat-channel-dedup.service.spec.ts`, `hooks.service.spec.ts` 추가분)은 억제 로직·fail-open·trigger 스코프 분리·빈 키 처리·호출부 반환값 소비를 각각 별도 단언으로 고정하고 있어 보안 관련 회귀(예: 호출부가 `claim()` 결과를 무시하는 회귀)를 포착할 수 있다.
- `spec/5-system/15-chat-channel.md` CCH-SE-02 개정은 실제 구현(키 형식, fail-open, 서비스명)과 일치하며 spec-구현 드리프트를 오히려 줄였다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 는 이력/추적 문서로 실행 코드가 아니며 신규 보안 이슈 없음.

## 요약

이번 변경은 `ChatChannelDedupService` 를 신설해 chat-channel inbound 재도착(re-delivery)에 대한 원자적(`SET NX EX 30`) 억제를 `parseUpdate` 직후·rate-limit 이전에 배선한다. 인증(provider 서명 검증)이 이 로직보다 먼저 수행되므로 미인증 요청이 이 경로를 악용할 수 없고, Redis 커맨드는 파라미터화되어 인젝션 표면이 없으며, 실패 시 fail-open 정책은 이 저장소의 기존 관례와 일관되고 로그로 가시화된다. 발견된 사항은 모두 INFO 수준으로, 유효 인증 자료를 가진 발신자가 임의 길이의 `idempotencyKey` 로 Redis 키 공간을 소모할 수 있는 이론적 여지(상위 스로틀 가드로 상당 부분 완화됨)와 기존 패턴을 따르는 에러 로깅 정도다. Critical/Warning 급 취약점은 발견되지 않았다.

## 위험도

LOW
