# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] Redis pipeline INCR+EXPIRE(NX) race window — 설계 의도 확인

- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` 라인 205–208
- **상세**: `pipeline.incr(key)` + `pipeline.expire(key, CHAT_RATE_LIMIT_WINDOW_SEC, 'NX')` 를 단일 pipeline 으로 묶어 원자적으로 실행하는 구현은 올바르다. NX 옵션 덕분에 TTL 은 최초 키 생성 시에만 설정되고 이후 INCR 은 기존 TTL 을 보존한다. 코드 내 주석도 이 의도를 명시하고 있다. 멀티 인스턴스 환경에서도 Redis 단일 서버(또는 클러스터)가 INCR 의 원자성을 보장하므로 경쟁 조건 없음. 참고 사항으로 기록: EXPIRE NX 는 Redis 7.0+ 부터 지원되므로 배포 인프라가 Redis 7.0 미만이라면 NX 플래그가 무시되어 키가 갱신될 때마다 TTL 이 리셋되는 sliding window 로 동작한다. 현재 코드에 Redis 버전 검증 로직이 없으므로 인프라 요구사항 문서화를 권장한다.
- **제안**: `README` 또는 배포 명세에 "Redis >= 7.0 필요 (EXPIRE NX 지원)" 요구사항을 명시. 코드 레벨로는 서비스 초기화 시 `redis.info('server')` 버전 체크 또는 주석으로 최소 버전을 경고하는 방법을 고려.

---

### [INFO] fail-open 정책과 동시 초과 요청의 미세 오버카운팅

- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` 라인 209–212
- **상세**: `results[0]` 의 count 가 limit 보다 크면 false 를 반환하지만, INCR 은 이미 실행되어 카운터가 증가한 후다. 동시에 여러 요청이 limit 경계에서 동시에 도착하면 일부가 limit 을 초과한 카운트 값을 받으면서도 이미 카운터는 증가된 상태가 된다. 이는 fixed-window 카운터 패턴의 구조적 특성으로, 허용-후-카운트(post-increment check) 방식은 경계에서 최대 동시요청 수만큼 초과를 허용할 수 있다. rate-limit 의 목적이 하드 캡이 아닌 분당 평균 방어라면 허용 가능한 설계다.
- **제안**: 설계 의도가 "엄격한 하드 캡"이라면 Lua 스크립트로 GET-체크-INCR 을 원자화하거나 token bucket 패턴을 사용. 현재처럼 분당 방어 수준이면 INFO 수준 참고 사항으로 충분.

---

### [INFO] markChatChannelRateLimited — 경합 없는 "이미 degraded 체크" 패턴

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 482
- **상세**: `if (trigger.chatChannelHealth === 'degraded') return;` 는 메모리에 있는 `trigger` 객체의 값을 기준으로 skip 하는 조건이다. 동시에 여러 요청이 같은 trigger 에 대해 rate-limit 초과를 감지하면, 첫 번째 요청이 DB 를 갱신하기 전에 다른 요청들도 이 체크를 통과해 중복 UPDATE 를 보낼 수 있다. 현재 trigger 엔터티를 매 요청마다 `findOne` 으로 fresh-load 하는 구조라면 이 문제가 완화되지만, DB hit 없이 캐싱된 객체를 재사용하는 경우 주의 필요. 그러나 코드 의도("best-effort — 실패는 swallow", 중복 write 방지는 최선 노력)와 `update` 자체가 멱등(같은 값으로의 SET)이므로 실제 손상은 없다.
- **제안**: 현재 best-effort 정책으로 충분하다. 엄밀한 중복 방지가 필요하다면 DB 레벨에서 `UPDATE ... WHERE chatChannelHealth != 'degraded'` 조건을 추가하거나 낙관적 잠금을 활용.

---

## 요약

변경된 코드의 핵심인 `ChatChannelRateLimiterService` 는 Redis pipeline 을 통한 INCR+EXPIRE(NX) 단일 원자 실행으로 멀티 인스턴스 환경에서도 정확한 fixed-window 카운팅을 보장한다. async/await 처리는 일관되고 await 누락 없으며, fail-open 패턴은 Redis 미가용 시 이벤트 루프를 차단하지 않는다. `markChatChannelRateLimited` 의 중복 write 방지는 best-effort 수준이나 UPDATE 의 멱등성 덕분에 실제 데이터 손상 없음. 전체적으로 동시성 관련 심각한 결함은 없으며, 발견된 사항은 모두 INFO 등급 참고 사항이다.

## 위험도

LOW
