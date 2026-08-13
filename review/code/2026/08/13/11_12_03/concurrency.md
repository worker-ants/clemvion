# 동시성(Concurrency) 리뷰 — CCH-SE-02 chat-channel update dedup (11_12_03 라운드)

## 검토 범위

이번 changeset 의 실질 코드 변경은 이전 라운드(`02_38_41`/`02_50_38`/`09_09_58`)와 동일한
6개 파일이다 — `ChatChannelDedupService` 신설(`chat-channel-dedup.service.ts` +
`.spec.ts`), `chat-channel.module.ts` DI 등록, `HooksService` 배선(`hooks.service.ts` +
`.spec.ts`), CHANGELOG. 나머지는 이전 리뷰 라운드들의 산출물(RESOLUTION/SUMMARY/meta.json 등
review·consistency 문서)과 `plan/`·`spec/` 문서 갱신으로, 실행 코드가 아니므로 동시성 관점
검토 대상이 아니다. 실제 소스 파일(`chat-channel-dedup.service.ts`, `hooks.service.ts`)을
직접 열어 diff 와 현재 상태가 일치함을 확인했다.

## 발견사항

- **[INFO]** `ChatChannelDedupService.claim()` 은 Redis `SET key 1 EX 30 NX` **단일 명령**으로
  "재도착 여부 확인"과 "선점"을 한 번에 처리한다 — 별도 GET→SET 구간이 없어 TOCTOU 경쟁 조건이
  구조적으로 발생할 수 없다. 다중 인스턴스가 같은 provider 재전송을 동시에 받아도 Redis 서버
  쪽에서 원자적으로 하나만 `'OK'`를 받는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:61`-`67`
    (`claim()` 내부 `this.redis.set(...)`)
  - 상세: TTL(`EX 30`)로 자동 만료되며 명시적 unlock/release 호출이 없어, 락 해제 누락으로 인한
    영구 억제·데드락 위험도 없다. `chat-channel-dedup.service.spec.ts:34`-`40`(게이트)이
    `redis.set` 호출 인자(`key,'1','EX',30,'NX'`) 전체를 단언해 NX/EX 누락 회귀를 잡는다.
  - 제안: 조치 불요.

- **[INFO]** 호출부(`HooksService.handleChatChannelWebhook`)가 `claim()` 결과를 반드시
  `await` 하고 그 boolean 을 즉시 분기(`if (!(await ...)) { ...; return }`)에 사용한다 —
  "가드를 호출만 하고 반환값을 버려 무력화되는" 흔한 회귀 패턴이 없다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338`-`345`
  - 상세: 서비스 단위 테스트만으로는 이 회귀를 못 잡는다는 점을 PR 자체가 인지하고
    `hooks.service.spec.ts:1227`-`1271`(게이트)에 호출부 전용 테스트(반환값 사용 여부 +
    `dedup.claim` 호출 인자 + `rate-limit`/`interactionService.interact` 미호출까지 단언)를
    별도로 붙였다. 직접 확인: `hooks.service.ts:79`에 생성자 파라미터로 주입되고, `moduleRef`가
    `beforeEach`마다 재생성되므로(spec 파일 상단) `mockResolvedValueOnce(false)`가 다른 테스트로
    새는 오염도 없다.
  - 제안: 조치 불요.

- **[INFO]** dedup 체크가 rate-limit 소비(`ChatChannelRateLimiterService.consume`) **이전**에
  배치된 순서 자체가 이 변경의 원자성/정합성 요구사항이다 — "재도착은 새 트래픽이 아니므로
  쿼터를 이중 소비하면 안 된다"는 의도가 순차 guard 체인(early-return)으로 정확히 구현됐다.
  두 guard 는 각자 독립된 Redis 키에 대해 자신만의 원자 연산을 수행하므로 guard 간 상호
  배제(락)가 필요하지 않고, 요구되는 것은 오직 **호출 순서**뿐이다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338`(dedup) → 바로 다음
    rate-limit 체크(347행대)
  - 제안: 조치 불요.

- **[INFO]** fail-open 경로(Redis 미주입·에러)에서는 동시 재도착이 모두 통과할 수 있다 — 즉
  Redis 장애 구간에서는 이 기능이 막으려는 경쟁(중복 dispatch)이 다시 열린다. 이는 코드
  주석·CHANGELOG·spec(`spec/data-flow/14-chat-channel.md`)에 명시된 **의도된 트레이드오프**로,
  형제 서비스 `ChatChannelRateLimiterService`·`PublicWebhookQuotaService`와 동일 정책이다.
  `redis` 필드는 생성자에서 한 번 `null`/non-null 로 결정되고(`chat-channel-dedup.service.ts:45`)
  이후 프로세스 수명 동안 불변이다 — `RedisConnectionProvider.getClientOrNull()`은 config
  누락 시에만 예외를 던지는 구조(`redis-connection.provider.ts:94`-`109`, 직접 확인)라 "아직
  lazy connect 가 끝나지 않아 일시적으로 null" 같은 시간 의존적 창(window)은 없다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:55`,
    `68`-`73`(catch 블록, warn + fail-open)
  - 제안: 조치 불요 — warn 으로 관측 가능하며 plan 문서에도 별도 유예 항목으로 이미 반영돼 있다.

CRITICAL/WARNING 없음. `chat-channel.module.ts`(DI 등록), `plan/`·`spec/`·`review/`·`CHANGELOG.md`
등 나머지 파일은 공유 자원 동시 접근·async 흐름과 무관한 순수 배선/문서 변경이라 동시성 관점
검토 대상이 아니다.

## 요약

이번 changeset 의 핵심 변경(`ChatChannelDedupService`)은 Redis `SET NX EX` 단일 원자 명령으로
재도착 억제를 구현해, 다중 인스턴스·동시 재전송 상황에서도 TOCTOU 경쟁 조건이나 데드락 없이
"최초 1건만 통과"를 정확히 보장한다. 호출부도 그 boolean 결과를 빠짐없이 `await`·분기에
사용하며, "결과를 버리는" 흔한 회귀 클래스를 막는 전용 호출부 테스트까지 갖췄다. rate-limit
과의 순서(이 변경에서 유일하게 원자성/정합성이 요구되는 지점)도 의도대로 배치돼 있다. Redis
장애 시 fail-open 으로 억제가 사라지는 것은 신규 결함이 아니라 형제 서비스와 동일한 기존
승인 정책이며 warn 으로 관측 가능하다. 이 라운드에 새로 추가된 나머지 파일(이전 리뷰 라운드
산출물·spec/plan 문서)은 실행 코드가 아니므로 동시성 관점에서 추가로 지적할 사항이 없다.
동시성 관점에서 조치가 필요한 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
