# 동시성(Concurrency) 리뷰

## 발견사항

### [WARNING] INCR + 별도 EXPIRE 사이의 원자성 갭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` 라인 267–276
- 상세: `pipeline.incr(key)` + `await pipeline.exec()` 후 결과가 `1`이면 `await this.redis.expire(key, CHAT_RATE_LIMIT_WINDOW_SEC)` 를 별도 명령으로 호출한다. pipeline 의 `exec()` 와 `expire()` 사이에 프로세스 크래시·네트워크 단절이 발생하면 키가 TTL 없이 영구 잔류한다. 이 경우 해당 per-chat 카운터가 만료되지 않아 이후 모든 메시지가 한도 초과로 잘못 판정될 위험이 있다.
  - INCR 과 EXPIRE 를 **같은 pipeline** 에 포함하면 두 명령이 서버에 일괄 전송되어 중간 실패 노출 시간이 최소화된다. `count === 1` 조건부 EXPIRE 는 Lua script(`EVAL`) 또는 `SET key 0 EX 60 NX` + `INCR` 조합으로 원자적으로 처리할 수 있다.
  - 실제로는 `count === 1` 조건이므로 이 경로는 윈도우 최초 진입 시에만 해당하고, 실패 빈도가 낮다. 그러나 멀티 인스턴스 환경에서 여러 요청이 동시에 카운트 `1` 을 반환받는 경우(두 인스턴스가 동시에 첫 INCR 을 실행하면 둘 다 `1` 을 받을 수 없으므로 실제 경쟁은 없음—Redis 단일 스레드 INCR 보장), 그러나 첫 INCR 성공 → expire 호출 전 크래시 시나리오는 여전히 존재한다.
- 제안: pipeline 내에 INCR 과 조건부 EXPIRE 를 함께 포함시키거나(`pipeline.incr(key); pipeline.expire(key, CHAT_RATE_LIMIT_WINDOW_SEC); exec()` 후 INCR 결과가 1일 때만 expire 가 필요하지만, 이 경우 항상 expire 를 pipeline 에 포함하면 매 요청마다 슬라이딩 윈도우가 되어 설계 의도와 다름), 안전한 대안으로 `SET key 0 EX 60 NX; INCR key` Lua script 사용을 권장한다. 혹은 현 구조를 유지하되 expire 실패를 warn 로그 이상으로 처리(현재는 try-catch 내부라 expire 실패 시 swallow 됨)해야 한다.

### [INFO] markChatChannelRateLimited 의 동시 호출 시 중복 UPDATE
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 709–727
- 상세: `if (trigger.chatChannelHealth === 'degraded') return;` 가드는 **메모리 내 객체**의 상태를 확인한다. 멀티 인스턴스 환경에서 동일 trigger 에 대해 두 인스턴스가 동시에 rate-limit 초과 경로를 타면, 둘 다 `degraded` 가 아닌 로컬 `trigger` 객체를 들고 있어 `UPDATE` 가 두 번 발생한다. 동일 값으로의 중복 UPDATE 이므로 데이터 정합성 오류는 아니나 불필요한 DB write 가 발생한다.
- 제안: 현 구현의 주석("이미 `degraded` 면 skip (폭주 중 중복 write 방지)")이 best-effort 임을 인정하고 있으므로, 이 패턴은 허용 가능하다. 단 주석에 "멀티 인스턴스 환경에서는 중복 write 가 발생할 수 있으나 idempotent 하므로 무해"를 명시하면 유지보수자 혼란을 방지할 수 있다.

### [INFO] async consume 의 await 체인 — 이벤트 루프 블로킹 없음 확인
- 위치: `chat-channel-rate-limiter.service.ts` 전체
- 상세: `pipeline.exec()` 와 `this.redis.expire()` 모두 await 처리되어 있어 이벤트 루프 블로킹 없음. try-catch 가 전 경로를 감싸며 fail-open 이 보장됨.
- 제안: 해당 없음 (정상 구현).

## 요약

이번 변경의 핵심 동시성 요소는 Redis fixed-window rate-limit 카운터(`INCR + EXPIRE`)이다. Node.js 단일 스레드 + Redis 단일 스레드 INCR 보장 덕분에 경쟁 조건이나 데드락 위험은 없다. 다만 `pipeline.exec()` 성공 후 별도 `this.redis.expire()` 호출 사이에 프로세스 중단이 발생하면 키가 TTL 없이 영구 잔류하는 원자성 갭이 존재한다(WARNING). `markChatChannelRateLimited` 의 중복 UPDATE 는 멀티 인스턴스 환경에서 idempotent 하지만 주석 보강이 권고된다(INFO). 전체적으로 async/await 사용, fail-open 처리, 이벤트 루프 비블로킹 측면은 올바르게 구현되어 있다.

## 위험도

LOW
