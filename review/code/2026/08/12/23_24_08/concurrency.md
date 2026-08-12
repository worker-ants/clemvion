# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `IdempotencyInterceptor` 의 GET→SET 비원자성(TOCTOU) — 본 diff 로 신규 도입된 것이 아니라 **기존에 이미 문서화된 accepted trade-off**
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:68-73` (클래스 docstring, diff 컨텍스트 영역이며 이번 hunk 로 수정되지 않음)
  - 상세: 두 요청이 같은 `Idempotency-Key` 로 거의 동시에 도착하면 둘 다 `redis.get()` 에서 캐시 미스를 관측할 수 있고(캐시 적재가 아직 안 끝났으므로), 그 결과 downstream 핸들러(`next.handle()`)가 **두 번** 실행될 수 있다 — 멱등성이 "보장" 이 아니라 "best-effort" 라는 점을 docstring 이 이미 명시하고 있다(§EIA-RL-02 는 정상 경로 계약, 장애 구간에서는 창이 더 넓어진다고 스스로 적음). `storeEntry()` 의 `void this.redis.set(...).catch(...)` (line 295-301) 도 fire-and-forget 이라 클라이언트 응답이 캐시 쓰기 완료를 기다리지 않는다 — 이 역시 같은 창의 일부이며 이번 diff 로 변경되지 않았다.
  - 제안: 이번 PR 범위 밖(순수 corruption-handling 리팩터)이므로 조치 불필요. 향후 강한 멱등성이 필요해지면 Redis `SET NX` 기반의 claim-then-execute 패턴(락) 또는 advisory lock 검토가 필요하다는 점만 기록해 둔다.

- **[INFO]** RxJS 연산자 순서(`catchError` → `switchMap`) — 이번 diff 로 변경되지 않았고, 회귀 방지 테스트(`fail-open 이 409 충돌까지 삼키지 않는다 — catchError 위치 캐너리`)로 이미 고정돼 있음을 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:131-137` (`catchError` 가 `switchMap` 앞)
  - 상세: `catchError` 를 `switchMap` **뒤**로 옮기면 캐시 히트 시 `switchMap` 내부에서 던지는 `ConflictException`(정상 동작)까지 GET 실패 fail-open 경로가 삼켜 버려 멱등성 충돌 검출이 조용히 죽는다. 현재 순서는 올바르고, `idempotency.interceptor.spec.ts:769-792` (파일 컨텍스트 기준, diff 로 신규 추가되지 않음)의 캐너리 테스트가 이를 고정한다.
  - 제안: 조치 불필요 — 확인 목적의 기록.

- **[INFO]** `discardCorruptEntry()` 신설 및 파싱 순서 재배치는 동기(synchronous) 경로만 다뤄 새 경쟁 조건을 만들지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:143-190` (`switchMap` 콜백), `202-211` (`discardCorruptEntry`)
  - 상세: `switchMap` 콜백은 `async/await` 없이 전부 동기적으로 `Observable` 을 반환한다(`processFresh()`, `discardCorruptEntry(...)`, `throw`, `of(...)`). 공유 가변 상태(mutable shared state)나 인스턴스 필드에 대한 쓰기가 없고, `this.logger` 호출도 부작용만 있을 뿐 동시 접근 문제가 없다(Node.js 단일 스레드 이벤트 루프). `bodyHash` 판정을 `responseJson` 파싱보다 먼저 두는 순서는 새 테스트(`idempotency.interceptor.spec.ts:596-627`, 게이트 기준)로 뮤테이션 검증까지 거쳐 고정돼 있다.
  - 제안: 없음.

- **[INFO]** 테스트의 마이크로태스크 대기 패턴(`await Promise.resolve()`)은 이번 diff 로 신설된 테스트가 아니며, 기존 패턴을 새 테스트들이 답습하지 않아도 되는 이유가 명확함
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:794-827` (파일 컨텍스트 기준 — 이번 diff 의 추가분 아님)
  - 상세: 이번 diff 로 추가된 4개 테스트(`엔트리 손상`·`payload 손상`·`판정 순서`·`에러 재현 분기`)는 모두 `redis.get`/`redis.set` 을 동기적으로 `mockResolvedValue` 하고 `warn` 호출도 `catchError`/`try-catch` 동기 경로 안에서 발생하므로 `await Promise.resolve()` 같은 틱 양보가 필요 없다 — `lastValueFrom` 의 resolve 시점에 이미 warn 이 호출된 상태다. `storeEntry()` 의 fire-and-forget `.set().catch()` 만 마이크로태스크 양보가 필요한 유일한 자리이며 그 테스트는 이미 존재하고 이번 diff 로 건드리지 않았다.
  - 제안: 없음 — 정합성 확인용 기록.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 캐시 엔트리 손상(외부 JSON) 및 payload 손상(내부 `responseJson`) 처리를 통합하고 warn 로그를 추가한 리팩터로, 새 비동기 오케스트레이션·락·공유 가변 상태를 도입하지 않는다. `switchMap` 콜백은 전 분기가 동기적이라 경쟁 조건의 여지가 없고, `catchError`(GET 실패 fail-open)가 `switchMap` 앞에 위치해 캐시 충돌(409/410) 예외를 삼키지 않는 기존 설계도 그대로 유지된다. 유일하게 실재하는 동시성 리스크는 GET→SET 비원자성으로 인한 멱등성 best-effort 특성인데, 이는 이번 diff 이전부터 클래스 docstring 이 명시적으로 문서화한 accepted trade-off(spec 의 "가용성 우선" 결정)이며 이번 변경으로 확대되거나 축소되지 않았다. 신규 테스트 4건도 전부 동기 mock 을 사용해 관측 타이밍 문제 없이 안정적으로 동작한다.

## 위험도

LOW
