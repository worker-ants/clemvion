# 신규 식별자 충돌 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

## 발견사항

### INFO — `CHAT_RATE_LIMIT_WINDOW_SEC` vs `MINUTE_WINDOW_SEC` (비슷한 의미의 상수 분리)
- **target 신규 식별자**: `CHAT_RATE_LIMIT_WINDOW_SEC = 60` (`chat-channel-rate-limiter.service.ts`)
- **기존 사용처**: `MINUTE_WINDOW_SEC = 60` (`hooks/public-webhook-quota.service.ts` line 141)
- **상세**: 두 상수는 모두 "60초 윈도우" 를 나타내는 동일한 값이지만 이름이 다르다. `MINUTE_WINDOW_SEC` 는 IP 단위 공개 webhook throttle, `CHAT_RATE_LIMIT_WINDOW_SEC` 는 per-chat 채널 rate-limit 용도로 의미상 맥락이 다르므로 *충돌은 아님*. spec 에서도 두 카운터가 별개 목적임을 명시 (R-CC-19). 그러나 향후 공통 추출 시 동일 값이 두 이름으로 분산되어 있음을 인식하면 유지보수가 쉬워진다.
- **제안**: 현재 분리 유지는 의도적·합당함. 단일 추출이 필요하면 `common/redis/redis-rate-limit.ts` 등에 `RATE_LIMIT_MINUTE_SEC` 로 통일 후 두 파일이 동일 상수를 참조하도록 리팩토링 가능 — v2 후속으로 검토.

### INFO — Redis 키 접두사 패턴 혼재 (`cc:rl:` vs `chat-channel:`)
- **target 신규 식별자**: `cc:rl:{triggerId}:{conversationKey}` (`chat-channel-rate-limiter.service.ts` line 9)
- **기존 사용처**: `chat-channel:{triggerId}:{conversationKey}` (`channel-conversation.service.ts` line 179)
- **상세**: 동일 모듈 안에 Redis 키 접두사 스타일이 두 가지다 — conversation state 키는 긴 형태 `chat-channel:`, rate-limit 키는 짧은 형태 `cc:rl:`. `wh:rl:min:` / `wh:rl:hour:` (공개 webhook throttle) 와 비교해도 `cc:rl:` 은 `wh:rl:` 과 접두사 2글자가 다르므로 충돌 위험은 없다. 그러나 같은 도메인(chat-channel)의 키가 `chat-channel:` 과 `cc:rl:` 두 스타일로 혼재한다.
- **제안**: 기능상 충돌 없음. 일관성을 원한다면 rate-limit 키도 `chat-channel:rl:{triggerId}:{conversationKey}` 로 통일하거나, conversation 키를 `cc:conv:` 로 단축하는 방향이 있으나 기존 키 마이그레이션 비용이 있어 신규 키 추가 시점에 선택 가능. 단일 prefix 규약(`cc:`)을 채택한다면 `spec/conventions/chat-channel-adapter.md §2` 또는 `data-flow/14-chat-channel.md §1` 에 Redis 키 패턴 표로 명시 권장.

## 요약

target(`spec/5-system/15-chat-channel.md`, `spec/data-flow/14-chat-channel.md`) 이 도입한 신규 식별자 — 요구사항 ID `CCH-NF-03`(기존 ID 의 재정의), Rationale `R-CC-19`(신규), 설정 키 `rateLimitPerMinute`(기존 필드의 semantics 구체화), 서비스 타입 `ChatChannelRateLimiterService`, 상수 `CHAT_RATE_LIMIT_WINDOW_SEC` / `CHAT_RATE_LIMIT_DEFAULT_PER_MIN`, Redis 키 접두사 `cc:rl:` — 모두 기존 식별자와 의미 충돌이 없다. `R-CC-19` 번호는 `15-chat-channel.md` 의 기존 `R-CC-15~18` 시리즈 다음 순번으로 정확히 이어진다. Redis 키 `cc:rl:` 은 `wh:rl:` 과 접두사가 구분되며, `chat-channel:{triggerId}:` conversation 키와도 네임스페이스가 분리되어 있다. 주의할 점은 같은 chat-channel 도메인 내 Redis 키 접두사 스타일이 이번 추가로 두 갈래로 늘어났다는 점이지만, 이는 현재 기능 범위에서 충돌을 유발하지 않으므로 LOW 위험이다.

## 위험도

NONE
