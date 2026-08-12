# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** payload 손상 방어의 "에러 재현 분기" 테스트가 형제 테스트보다 단언이 약하다 — `discardCorruptEntry` 호출을 증명하는 핵심 단언 2개가 빠져 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:629` (`it('안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리 — 에러 재현 분기도 같은 방어를 받는다', ...)`)
  - 상세: 바로 위 형제 테스트 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:559`(`엔트리는 멀쩡한데 안쪽 responseJson 이 깨진 경우 → 500 이 아니라 신규 처리`, 성공 채널 케이스)는 `warnSpy`(`expect.stringContaining('cache payload 손상')`)와 `redis.set` 재적재(`toHaveBeenCalledTimes(1)`)를 둘 다 단언한다. 그런데 이 테스트(같은 `discardCorruptEntry('payload', …)` 호출을 exercise 하는 "에러 재현 분기" 형제)는 `result`/`handleSpy` 만 단언하고 `warnSpy`·`redis.set` 은 전혀 확인하지 않는다. 테스트 이름 자체가 "**같은 방어를 받는다**" 라고 주장하는데 실제 단언 깊이는 형제보다 얕아, 그 주장을 이 테스트 단독으로는 증명하지 못한다(현재는 559의 테스트가 같은 private 메서드를 exercise 하므로 뮤테이션 관점에서 우회는 되지만, 이 테스트가 독립적으로 서지 못한다). 이 파일의 다른 자리들(GET 실패/SET 실패/직렬화 실패 각 쌍)은 예외 없이 "행위+warn" 세트로 짝지어 둔 관례이기도 하다.
  - 제안: `warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 를 추가하고 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cache payload 손상'))`, `expect(redis.set).toHaveBeenCalledTimes(1)` 을 형제 테스트와 동형으로 붙인다.

- **[INFO]** 두 번째 `describe` 블록 docstring 이 신규 4건 테스트(엔트리/ payload 손상 방어, 파싱 순서 캐너리)를 반영하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:236`-`243` (`describe('IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)', ...)` 바로 위 블록 주석)
  - 상세: 이 주석은 여전히 "`HttpResponseLike` 의 optional 이 지탱하는 typeof 가드" 만 설명한다. 개별 `it` 마다 자체 설명 주석이 충실히 달려 있어 의도 파악에는 지장이 없지만, 블록 수준 요약은 지금 담긴 내용(엔트리 손상 warn · payload 손상 방어 2건 · bodyHash 판정 순서 캐너리)을 더 이상 반영하지 않는다.
  - 제안: 블록 docstring에 "엔트리/`responseJson` payload 손상 시 fail-open + warn, 그리고 bodyHash 판정이 payload 파싱보다 먼저라는 순서 계약" 한두 문장을 추가.

- **[INFO]** payload 손상 신규 2건 테스트는 재적재된 캐시 값의 내용을 깊이 단언하지 않는다 — 형제 테스트(엔트리 손상)만큼 촘촘하지 않다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:559`, `:629`
  - 상세: 기존 "손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재" 테스트(`:503`, 변경 안 됨)는 `redis.set` 호출 후 `stored.bodyHash`/`stored.statusCode`/`JSON.parse(stored.responseJson)` 까지 값 단위로 검증한다. 반면 신규 두 payload-손상 테스트는 `toHaveBeenCalledTimes(1)` 까지만 본다(`:629` 는 그마저도 없음 — 위 WARNING 참조). `processFresh()`/`cacheTapped` 는 세 경우 모두 동일한 공유 코드 경로라 실질 위험은 낮지만(예: bodyHash 재계산 대신 손상된 캐시의 `cached.bodyHash` 를 그대로 저장하는 뮤턴트가 있다면 `:503` 테스트가 잡는다), 개별 테스트만 놓고 보면 저장 내용 뮤테이션에 대해 독립적인 증거력이 없다.
  - 제안: 여유가 있다면 `:559` 에도 `stored.bodyHash`/`stored.statusCode` 값 단언을 추가해 세 테스트의 엄밀도를 맞춘다. 필수는 아님(낮은 우선순위).

## 요약

`idempotency.interceptor.ts` 의 `responseJson` 내부 손상 방어(단일 파싱 + `discardCorruptEntry` 도입, bodyHash 판정을 payload 파싱보다 먼저 두는 순서 계약)에 대응하는 4건의 신규 테스트는 전반적으로 견고하다 — 엔트리/payload 두 손상 지점을 분리해 각각의 `warn` 메시지(`cache 엔트리 손상` / `cache payload 손상`)를 구분해 단언하고, bodyHash 판정 순서를 뒤집으면 RED 가 나는 캐너리를 별도로 두었으며(plan 문서에 기록된 대로 "블록 제거+재삽입"이 무효 뮤턴트였던 점을 인덱스 비교로 재확인한 이력도 신뢰도를 높인다), 성공 채널/에러 재현 채널(409) 양쪽에서 payload 손상 방어가 적용되는지도 함께 고정했다. 다만 에러 재현 분기(409) 테스트가 스스로 주장하는 "같은 방어를 받는다"를 형제 테스트만큼 단언으로 뒷받침하지 못하는 점(WARNING 1건)과 문서 최신화·저장값 단언 깊이의 사소한 비대칭(INFO 2건)이 있다. mock 설계(`makeRedis`/`makeContext`/`makeThrowingHandler`)는 실제 채널(성공 vs 예외 throw)을 정확히 재현하도록 이미 다듬어져 있고, `try/finally` 로 `Logger.prototype.warn` spy 를 매 테스트 복원해 격리도 안전하다. 회귀 위험은 낮다 — 기존 캐시 히트/충돌/스코프 테스트는 리팩터 후에도 동일 happy-path 를 exercise 하므로 유효하다.

## 위험도
LOW
