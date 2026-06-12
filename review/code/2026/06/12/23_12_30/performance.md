# 성능(Performance) 리뷰

## 발견사항

### [INFO] Redis pipeline 사용 — INCR + EXPIRE(NX) 를 단일 왕복으로 묶어 네트워크 지연 최소화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` `consume()` 메서드 (라인 202–205)
- 상세: `pipeline.incr(key); pipeline.expire(..., 'NX'); await pipeline.exec()` 패턴으로 두 Redis 명령을 단일 왕복에 묶었다. 개별 `await redis.incr()` + `await redis.expire()` 두 번 호출 대비 RTT(Round-Trip Time)가 절반으로 줄어든다. RESOLUTION W16 이 이미 이 개선을 반영한 것으로 확인된다.
- 제안: 현행 구현이 적절하다.

### [INFO] fail-open 조기 반환 — Redis 미가용 시 pipeline 연산 전혀 수행하지 않음
- 위치: `chat-channel-rate-limiter.service.ts` `consume()` 라인 194 (`if (!this.redis) return true`)
- 상세: `this.redis` null 체크를 가장 먼저 수행해 Redis 미연결 상태에서는 연산 비용이 0이다. 알고리즘·I/O 양 측면 모두 최적.
- 제안: 없음.

### [WARNING] `consume()` 호출마다 `makeChatRateLimitKey()` 에서 템플릿 문자열 연결 수행 — 캐싱 없음
- 위치: `chat-channel-rate-limiter.service.ts` 라인 197, `makeChatRateLimitKey()` 함수 (라인 145–148)
- 상세: `makeChatRateLimitKey(triggerId, conversationKey)` 는 `` `cc:rl:${triggerId}:${conversationKey}` `` 템플릿 연결을 매번 수행한다. inbound 트래픽이 높은 환경(60req/min per-chat × 다수 chat)에서 동일 `(triggerId, conversationKey)` 쌍에 대해 반복 키 계산이 발생한다. V8 JIT 기준 단순 문자열 연결은 수십 ns 수준이라 단독으로는 병목이 아니나, hot path 에서 동일 쌍이 반복될 경우 `Map<string, string>` 메모이제이션으로 추가 할당을 없앨 수 있다. 그러나 triggerId·conversationKey 조합 수가 많아 캐시가 무한 증가할 수 있으므로 LRU 없이 단순 Map 캐싱은 메모리 누수 위험이 있다.
- 제안: 현재 규모(단순 문자열 연결, ns 단위 비용)에서는 캐싱 도입보다 현행 유지가 더 안전하다. 단, 성능 프로파일 결과 hot path 로 식별된다면 fixed-size LRU(예: 1000 항목 상한) 캐시를 고려한다.

### [INFO] `Math.max(1, Math.min(600, Math.floor(limitPerMinute) || 60))` — 매 호출 3회 Math 연산
- 위치: `chat-channel-rate-limiter.service.ts` 라인 196
- 상세: clamp 연산이 매 `consume()` 호출마다 수행된다. `limitPerMinute` 는 config 에서 읽어온 값으로 요청 간 변하지 않는 경우가 대부분이다. 서비스 생성자에서 `this.redis` 세팅 시점에 clamp 된 값을 캐시하거나, 호출자(`HooksService`)가 config 에서 한 번만 clamp 해 전달하는 방식이 더 효율적이다. 단, 현재 비용은 O(1)이고 연산 자체가 매우 가벼워 실질 영향은 무시 수준.
- 제안: 호출자(`HooksService`)가 config 값을 한 번만 clamp 해 전달하는 구조로 변경하면 `consume()` 내부 clamp 코드를 제거할 수 있어 코드도 단순해진다. 현행 유지도 무방.

### [INFO] `markChatChannelRateLimited()` DB UPDATE — 폭주 시 rate-limit 초과 호출 수만큼 DB write 시도 가능
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `markChatChannelRateLimited()` (라인 844–895)
- 상세: `if (trigger.chatChannelHealth === 'degraded') return` 가드는 메모리 내 스냅샷 기준이다. 동일 trigger 에 대해 폭주가 발생하면 첫 번째 초과 요청이 DB UPDATE 를 완료하기 전에 두 번째·세 번째 요청이 동시에 도달해 모두 `degraded` 가 아닌 스냅샷을 읽어 UPDATE 를 수행한다. 각 UPDATE 는 동일 값 write 이므로 데이터 정합성 문제는 없으나, 폭주 시 DB에 동시 UPDATE 가 burst 로 쏠릴 수 있다. 현재 best-effort 정책으로 설계된 것이므로 기능적 문제는 없다.
- 제안: 단기적으로는 현행 유지. 향후 폭주 방어가 필요하다면 `degraded` 갱신 자체에도 per-trigger debounce(예: 마지막 write 후 5s 이내 재시도 차단) 또는 DB 레벨 `UPDATE WHERE chatChannelHealth != 'degraded'` 조건을 추가해 불필요한 write 를 막을 수 있다.

### [INFO] `enrichInbound` 이전 rate-limit 검사 — 한도 초과분에 불필요한 외부 API 호출 차단
- 위치: `hooks.service.ts` rate-limit 단락이 `enrichInbound`(Slack `files.info` 등 외부 API) 호출보다 앞에 위치 (라인 267 이후, RESOLUTION W17 반영)
- 상세: rate-limit 초과 시 Slack files.info 등 외부 API를 호출하지 않으므로 불필요한 외부 I/O 비용이 발생하지 않는다. placement 가 성능 관점에서 최적이다.
- 제안: 없음.

### [INFO] 테스트 파일(`spec.ts`) — `makeRedis()` 팩토리 함수가 각 `it()` 내에서 새 mock 객체 생성
- 위치: `chat-channel-rate-limiter.service.spec.ts` `makeRedis()` 함수 (라인 50–56)
- 상세: 각 테스트마다 pipeline mock 객체를 새로 할당한다. 테스트 90행 규모에서 메모리·속도 관점 영향 없음. `beforeEach` 공유 mock 대비 테스트 격리가 보장되므로 올바른 패턴이다.
- 제안: 없음.

### [INFO] 공간 복잡도 — Redis 키 증가 추이
- 위치: `chat-channel-rate-limiter.service.ts` 키 스키마 `cc:rl:{triggerId}:{conversationKey}`
- 상세: 키는 `EXPIRE 60s NX` 로 60초 후 자동 만료된다. 활성 chat 수 × trigger 수에 비례한 키 수가 존재하나 TTL 보장으로 무한 증가하지 않는다. Redis 메모리 관점에서 문제없다.
- 제안: 없음.

---

## 요약

이번 변경(CCH-NF-03 per-chat Redis fixed-window rate-limit)은 성능 관점에서 전반적으로 건전하다. INCR + EXPIRE(NX) 를 단일 pipeline 으로 묶어 RTT를 최소화하고, fail-open 조기 반환으로 Redis 미가용 시 오버헤드를 0으로 만들었으며, rate-limit 검사를 외부 API 호출(`enrichInbound`) 이전에 배치해 초과분에 대한 불필요한 I/O를 차단한 것이 특히 긍정적이다. 주목할 잠재적 비효율은 두 가지다: (1) `makeChatRateLimitKey()` 가 매 호출 문자열 연결을 수행하나 단위 비용이 ns 수준이므로 현재 규모에서는 무시 가능하다. (2) `markChatChannelRateLimited()` 의 메모리 스냅샷 기반 중복 write 방지가 폭주 시 burst DB UPDATE 를 허용하나 idempotent write 이고 best-effort 정책으로 설계된 것이므로 기능·데이터 정합성 문제는 없다. 전체적으로 N+1 쿼리, 블로킹 I/O, 과도한 메모리 할당, 비효율 알고리즘 등 주요 성능 위험 항목은 해당 없다.

## 위험도

NONE

STATUS: SUCCESS
