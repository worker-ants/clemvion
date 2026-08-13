# 동시성(Concurrency) 리뷰 — CCH-SE-02 chat-channel update dedup

## 발견사항

- **[INFO]** `ChatChannelDedupService.claim()` 이 Redis `SET key 1 EX 30 NX` **단일 명령**으로
  구현되어 있어, "재도착 여부 확인"과 "선점" 사이에 별도 GET→SET 구간이 없다 — 고전적인
  check-then-act(TOCTOU) 경쟁 조건이 애초에 발생할 수 없는 구조다. 다중 앱 인스턴스가 같은
  provider 재전송을 동시에 받아도 Redis 서버 쪽에서 원자적으로 하나만 `'OK'`를 받고 나머지는
  `null`을 받는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:59`-`67`
    (`claim()` 내부 `this.redis.set(...)` 호출부, NX/EX 옵션 포함)
  - 상세: 테스트(`chat-channel-dedup.service.spec.ts:28`-`41`)도 `redis.set` 호출 인자를
    `key, '1', 'EX', 30, 'NX'` 로 통째로 단언해 NX/EX 누락 회귀를 잡는다. TTL 로 자동 만료시켜
    별도의 명시적 unlock/release 호출이 없으므로 락 해제 누락으로 인한 데드락·영구 억제 위험도
    없다.
  - 제안: 조치 불요. 참고용 긍정 기록.

- **[INFO]** 호출부(`HooksService.handleChatChannelWebhook`)가 `claim()` 결과를 반드시
  `await` 하고 그 boolean 을 즉시 분기에 사용한다 — "가드를 부르기만 하고 반환값을 버리는"
  race(= 가드가 무력화되는 흔한 회귀 패턴)가 없다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338`-`345`
    (`if (!(await this.chatChannelDedup.claim(trigger.id, parsed.idempotencyKey))) { ... return }`)
  - 상세: 이 회귀 클래스는 서비스 단위 테스트만으로는 못 잡는다는 점을 PR 스스로 인지하고
    `hooks.service.spec.ts:1227`-`1271` 에 호출부 전용 테스트(반환값 사용 여부 + 호출 순서 +
    인자까지 단언)를 별도로 추가했다 — await 누락/무시 회귀에 대한 방어가 이중으로 갖춰져 있다.
  - 제안: 조치 불요.

- **[INFO]** dedup 체크가 rate-limit 소비(`ChatChannelRateLimiterService.consume`) **이전**에
  배치되어 있고, 이 순서 자체가 원자성 요구사항이다 — "재도착은 새 트래픽이 아니므로 쿼터를
  이중 소비하면 안 된다" 는 의도가 순차 guard 체인(early-return)으로 정확히 구현됐다. 두
  guard 사이에 별도 공유 트랜잭션/락이 필요 없는 이유는 각 guard 가 자신의 Redis 키에 대해서만
  독립적으로 원자 연산을 수행하기 때문이며, 두 guard 간 상호 배제는 요구되지 않는다(순서만
  중요).
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338`(dedup 체크) 및 바로 다음
    rate-limit 체크(347행대)
  - 상세/제안: 조치 불요.

- **[INFO]** fail-open 경로(Redis 미주입·에러)에서는 동시 재도착 두 건이 모두 통과할 수 있다
  — 즉 Redis 장애 구간에는 이 PR 이 막으려는 경쟁(중복 dispatch)이 다시 열린다. 이는 코드
  주석·CHANGELOG·spec(`spec/data-flow/14-chat-channel.md:196`)에 명시적으로 문서화된 **의도된
  트레이드오프**(형제 서비스 `ChatChannelRateLimiterService`·`PublicWebhookQuotaService`와 동일
  정책)이며, `claim()` 생성자가 한 번 `null`/non-null 을 결정하면 그 결정은 프로세스 수명 동안
  안정적이다(`RedisConnectionProvider.getClientOrNull()` 은 config 누락 시에만 `null` — lazy
  connect 라 "아직 연결 안 됨" 때문에 null 이 되는 창은 없음, `redis-connection.provider.ts:94`-`110`
  확인). 새 결함이 아니라 기존에 승인된 클래스의 정책을 그대로 재사용한 것.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:55`,`68`-`72`
  - 제안: 조치 불요(이미 warn 으로 관측 가능하게 되어 있고, plan 문서의 INFO 처분 목록에도
    별도 항목으로 반영돼 있음).

CRITICAL/WARNING 없음. 나머지 diff(`chat-channel.module.ts` DI 등록, plan/spec/review 산출물
문서 파일들)는 공유 자원 동시 접근·async 흐름과 무관한 순수 배선/문서 변경이라 동시성 관점
검토 대상이 아니다.

## 요약

이번 PR 의 핵심 변경(`ChatChannelDedupService`)은 Redis `SET NX EX` 단일 원자 명령으로 재도착
억제를 구현해, 다중 인스턴스·동시 재전송 상황에서도 TOCTOU 경쟁 조건이나 데드락 없이 정확히
"최초 1건만 통과"를 보장한다. 호출부도 그 boolean 결과를 빠짐없이 `await`·분기에 사용하고,
"결과를 버리는" 흔한 회귀 클래스를 막는 전용 테스트까지 갖췄다. rate-limit 과의 순서(원자성이
요구되는 유일한 지점)도 의도대로 배치돼 있다. Redis 장애 시 fail-open 으로 억제가 사라지는
것은 신규 결함이 아니라 형제 서비스와 동일한 기존 승인 정책이며 문서화·관측(warn)도 갖춰져
있다. 동시성 관점에서 조치가 필요한 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
