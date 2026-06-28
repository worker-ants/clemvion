# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경된 코드(`public-webhook-quota.service.ts`, `public-webhook-throttle.guard.ts` 및 관련 테스트)는 동시성 로직을 직접 도입하거나 변경하지 않는다. 구체적으로:

- `UNIDENTIFIED_IP_BUCKET` 은 단순 `const` 문자열 상수로, 공유 가변 상태가 없다.
- `consumeStart(ip: string)` 메서드 시그니처는 변경되지 않았으며, 기존 Redis pipeline + INCR/EXPIRE 의 원자적 구현을 그대로 재사용한다.
- Guard의 변경(`?? UNIDENTIFIED_IP_BUCKET`)은 동기 null-coalescing 연산이며, async 흐름이나 이벤트 루프에 영향을 주지 않는다.
- 테스트의 in-memory fake Redis(`makeFakeRedis`)는 단일 스레드 환경에서 동기적으로 동작하며, 실제 동시성 구조를 도입하지 않는다.

공유 가변 상태, 새로운 락/뮤텍스/세마포어, async/await 변경, 이벤트 루프 블로킹, 스레드 풀 변경이 이번 diff 에 포함되어 있지 않다.

해당 없음, 위험도 NONE.

## 요약

이번 변경은 IP 미식별 요청에 대한 sentinel 상수(`UNIDENTIFIED_IP_BUCKET`)를 추가하고 Guard의 null-IP 분기 로직을 단순 `?? sentinel` 으로 교체한 것에 한정된다. 기존 Redis 원자 연산 경로를 그대로 활용하며, 새로운 동시성 구조나 공유 가변 상태의 도입이 없다. 동시성 관점에서 검토할 사항이 없다.

## 위험도

NONE
