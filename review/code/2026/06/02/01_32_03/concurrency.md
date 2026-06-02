# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] fixed-window 카운터의 INCR-EXPIRE 비원자적 분리 (Redis race condition)
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` — `incrWithWindow()` 메서드
- **상세**: `INCR` 이후 count === 1 조건으로 `EXPIRE`를 별도 명령으로 실행한다. 두 명령 사이에 프로세스가 종료되거나 네트워크가 끊기면 키에 TTL이 설정되지 않아 영구적으로 남을 수 있다. 또한 동일 키에 대해 두 요청이 거의 동시에 도달했을 때 둘 다 count=1을 받아 각자 EXPIRE를 설정하는 경우, 그 자체는 idempotent하지만 첫 INCR 이후 두 번째 INCR 전에 크래시하면 TTL이 없는 키가 생성된다. fail-open 정책이므로 키가 영구 잔존할 때의 실제 피해는 해당 IP 카운터가 TTL 없이 누적되어 사실상 영구 rate-limit 대상이 되는 것이다. 단일 Redis 인스턴스에서도 INCR은 원자적이지만 EXPIRE가 별도 왕복이라는 점에서 TOCTTOU(Time of Check to Time of Use) 창이 열린다.
- **제안**: Lua 스크립트로 INCR과 EXPIRE를 원자적으로 묶는다:
  ```lua
  local c = redis.call('INCR', KEYS[1])
  if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return c
  ```
  `ioredis`에서 `redis.eval(script, 1, key, windowSec.toString())`으로 호출 가능. 또는 `SET key 0 EX <windowSec> NX` 선행 후 INCR을 통해 윈도우 첫 진입 시 TTL을 보장할 수도 있다.

### [INFO] `consumeStart` — 분당·시간당 카운터 사이 비원자적 2-step 검사
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` — `consumeStart()` 라인 342-350
- **상세**: 분당 카운터 증가 후 시간당 카운터를 별도로 증가시킨다. 분당 한도를 통과한 뒤 시간당 한도 초과로 deny 되더라도 분당 카운터는 이미 증가된 상태다. 동시 요청이 몰릴 경우 실제 허용된 것보다 카운터가 약간 많이 증가하는 over-counting이 발생한다. rate-limit 용도의 fixed-window에서는 통상 허용 가능한 수준이나(카운터가 약간 크면 보수적), 정확한 quota 측정이 요구된다면 Lua 스크립트로 두 INCR을 하나의 원자 연산으로 묶어야 한다. 현재 사용 목적(남용 방어)에는 큰 실용적 문제는 없으며 INFO 수준으로 분류.

### [INFO] `PublicWebhookThrottleGuard` — 동일 요청 내 trigger 조회 중복 (성능 관찰 메모)
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `canActivate()` trigger 조회
- **상세**: Guard에서 trigger를 DB 조회하고, 이후 `HooksService`에서도 동일한 endpointPath로 trigger를 재조회한다. 동시성 문제는 아니나 동일 요청에서 DB round-trip이 2회 발생한다. request-scoped 캐싱 또는 Guard → Service 로 조회 결과 전달로 개선 가능하나 현재 기능 정확성에는 영향 없음.

### [INFO] 브라우저 SDK `WidgetBridge` — 단일 스레드 이벤트 리스너 관리 (문제 없음)
- **위치**: `codebase/packages/web-chat-sdk/src/bridge.ts` — `on()`/`off()` 메서드
- **상세**: `listeners` 는 `Map<WidgetEvent, Set<Listener>>`로 구현되어 있다. 브라우저 JavaScript는 단일 스레드이므로 동시성 문제가 없다. `off(event, cb)` 호출 중 이벤트가 dispatch되는 상황은 이벤트 루프 특성상 발생할 수 없어 iterator invalidation 위험 없음. 문제 없음.

## 요약

이번 변경의 핵심 동시성 관련 코드는 `PublicWebhookQuotaService`의 Redis fixed-window 카운터다. 전반적으로 fail-open 정책과 `maxRetriesPerRequest: 2` 설정이 적절하게 적용되어 있어 장애 복원력은 양호하다. 주요 위험은 `incrWithWindow()`에서 `INCR`과 `EXPIRE`가 별도 명령으로 분리되어 있어 크래시/네트워크 장애 시 TTL 없는 키가 영구 잔존할 수 있다는 점(WARNING)이다. Lua 스크립트 한 줄로 해결할 수 있으며 구현 난이도는 낮다. 분당·시간당 카운터 간 비원자 2-step은 over-counting 가능성이 있으나 남용 방어 용도로는 허용 가능한 수준이다. 브라우저 SDK 측(`WidgetBridge`)은 단일 스레드 환경이므로 동시성 문제가 없으며, NestJS 측 나머지 변경(controller 데코레이터, module 등록)도 동시성 위험 없음.

## 위험도

LOW

---

STATUS=success ISSUES=2
