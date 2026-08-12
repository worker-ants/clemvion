# Testing Review — EIA §R8 idempotency 캐시 스코프 (409/410)

## 발견사항

- **[CRITICAL]** 실제 프로덕션의 409(`STATE_MISMATCH`)/410(`EXECUTION_TERMINATED`)은 이번 PR이 고친 `isCacheable` 분기에 절대 도달하지 않는다 — 단위 테스트가 "성공 emission + 인위적 statusCode" 로 예외 기반 경로를 흉내내면서 실제로는 검증되지 않는 주장을 GREEN 으로 통과시키고 있다.
  - 실제 코드에서 `STATE_MISMATCH`/`EXECUTION_TERMINATED`는 `interaction.service.ts`가 `throw new ConflictException(...)` (478·505행) / `throw new GoneException(...)` (253·431행) 로 **던진다**. NestJS 내부(`node_modules/@nestjs/core/interceptors/interceptors-consumer.js` `transformDeferred`: `rxjs.from(next())`)는 컨트롤러 핸들러의 rejected Promise 를 RxJS **error** notification 으로 변환한다. `IdempotencyInterceptor.cacheTapped()`가 반환하는 `tap({ next: fn })`(에러 콜백 없음, `idempotency.interceptor.ts` 161~190행, `isCacheable` 조건은 167~172행)은 error notification 에서는 `fn`(신규 `isCacheable` 로직 포함)을 **전혀 호출하지 않는다** — RxJS `tap` 은 error 콜백이 없으면 그냥 통과시킬 뿐 next 콜백을 대신 실행하지 않는다.
  - 그런데 새로 추가된 회귀 테스트 두 건 — `idempotency.interceptor.spec.ts` "409 는 캐시된다 (Spec EIA §R8 — 닫힌 목록)"(234~252행)와 "410 도 캐시된다"(254~265행) — 는 `makeCallHandler({ error: 'STATE_MISMATCH' })`를 쓰는데 이는 `of({...})`로 **성공(next) 채널**에 값을 흘리는 스텁이다. 여기에 `makeContext({ statusCode: 409, ... })`로 응답 객체의 `statusCode`를 인위적으로 프리셋해 `cacheTapped`의 `next` 콜백이 도는 것처럼 만든다. 즉 이 두 테스트는 "핸들러가 정상 반환했는데 상태코드만 409/410인" 가상의 시나리오를 검증할 뿐, 실제로 `interact()`/`cancel()`이 예외를 던지는 프로덕션 경로는 **한 번도 실행하지 않는다**.
  - 추가로 `node_modules/@nestjs/core/router/router-execution-context.js`를 직접 확인한 결과 `this.responseController.setStatus(res, httpStatusCode)`가 **컨트롤러 핸들러 호출 이전**(인터셉터 체인 진입 전)에 실행된다 — 즉 `res.statusCode`는 애초에 `@HttpCode()` 데코레이터 값(`/interact`=202, `/cancel`=202)으로 고정돼 있고, 핸들러가 던진 예외의 상태코드로 갱신되지 않는다. 두 사실(① error notification 에서 `tap.next` 미실행, ② `res.statusCode`가 데코레이터 값으로 선고정)이 겹쳐, `isCacheable`의 `statusCode === 409 || statusCode === 410` 분기는 예외로 발생하는 실제 409/410 트래픽에 대해 **도달 불가능한 코드**일 가능성이 높다.
  - `external-interaction.e2e-spec.ts`에는 `Idempotency-Key` 헤더를 사용하는 테스트가 전혀 없다(실측: grep 0건) — G-2("409 STATE_MISMATCH", 309행)가 있지만 idempotency 캐시 재현 여부는 검증하지 않는다.
  - CHANGELOG.md("**클라이언트 영향**: 같은 `Idempotency-Key` 로 `409`/`410` 을 받은 뒤 재요청하면 이제 24h 동안 동일 응답이 재현된다.")는 검증되지 않은, 실제로는 틀렸을 가능성이 높은 주장이다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (cacheTapped, 161~190행 / isCacheable, 167~172행), `codebase/backend/src/modules/external-interaction/interaction.service.ts` (throw 지점 253·431·478·505행), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (234~265행)
  - 제안: (a) `makeCallHandler`에 `handle: () => throwError(() => new ConflictException(...))` 같은 실패-채널 헬퍼를 추가해, 예외로 던져진 409/410이 현재 `redis.set`을 호출하지 **않는다**(도달 불가능)는 사실을 먼저 캐너리로 고정한다. (b) 그 결과가 사실이라면 이 PR의 실질 효과가 없다는 뜻이므로, `cacheTapped`를 error 경로까지 포괄하도록(`next.handle().pipe(catchError((err) => {...HttpException.getStatus() 기반 캐싱 재시도...}))`) 재설계하거나, 최소한 CHANGELOG/PR 범위를 "인터셉터가 자체적으로 반환하는 409(IDEMPOTENCY_KEY_CONFLICT)만 대상이고 서비스가 던지는 409/410은 대상 밖"으로 정정해야 한다. (c) `external-interaction.e2e-spec.ts`에 `Idempotency-Key` 헤더 + 동일 요청 재전송으로 STATE_MISMATCH 응답이 실제로 재현되는지 확인하는 e2e를 추가해 진짜 파이프라인에서 검증한다.

- **[WARNING]** `isCacheable` 조건이 `statusCode >= 400`(구 구현)에서 `(>=200 && <300) || 409 || 410`(신 구현)로 바뀌면서, 종전에는 캐시 대상이던 3xx(300~399) 응답이 이번 PR로 조용히 캐시 대상에서 빠졌다 — 구 docstring은 명시적으로 "status 가 200~399 일 때만 적재"라고 적고 있었다. 이 축소는 CHANGELOG·PR 설명·docstring 어디에도 언급되지 않고(추가된 docstring은 R8 열거만 설명), 회귀 테스트도 전혀 없다 — `idempotency.interceptor.spec.ts` 전체에 3xx(300~399) statusCode를 쓰는 테스트가 0건이다. `< 300`을 `<= 300`으로 바꾸는 뮤턴트도 이 상태로는 검출되지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 167~171행 (`isCacheable` 정의)
  - 제안: `statusCode: 304`(혹은 300대 임의값) 케이스로 "3xx는 더 이상 캐시되지 않는다"는 회귀 테스트를 추가하고, 이 축소가 의도적(§R8의 닫힌 목록에 3xx가 없으므로)인지 여부를 docstring/CHANGELOG에 한 줄로 명시한다.

- **[INFO]** `'401·404 같은 다른 4xx 도 캐시하지 않는다 — 목록이 닫혀 있다'` 테스트(spec.ts 282~294행)는 제목이 401과 404 두 케이스를 모두 커버한다고 주장하지만 실제로 요청을 보내는 것은 `statusCode: 404` 하나뿐이다 — 401 은 별도로 행사되지 않는다. `isCacheable`이 401/404를 구분하는 분기가 없어 기능적 위험은 낮지만, 테스트 이름이 실제로 검증한 것보다 넓은 커버리지를 주장해 다음 사람이 401 케이스가 잠겨 있다고 오인할 수 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 282~294행
  - 제안: 제목을 "404" 단독으로 좁히거나, 401 요청도 별도 `it`/추가 단언으로 함께 행사한다.

## 요약

새로 추가된 4개 회귀 테스트(409/410/5xx/404)는 `isCacheable` 조건식 자체의 축약 오류(`>= 400` vs `=== 400`)를 뮤테이션으로 잘 잠갔고 테스트 격리·가독성도 양호하다. 그러나 그 테스트들이 사용하는 `makeCallHandler({ error: ... }) + makeContext({ statusCode: 409/410 })` 조합은 **실제 프로덕션에서 STATE_MISMATCH/EXECUTION_TERMINATED가 예외(`ConflictException`/`GoneException`)로 던져진다는 사실을 반영하지 못한 mock**이다. NestJS 소스(`interceptors-consumer.js`의 `rxjs.from(next())`, `router-execution-context.js`의 `setStatus` 선행 호출)를 직접 대조한 결과, `cacheTapped`의 `tap({next})`은 error notification에서 실행되지 않고 `res.statusCode`도 핸들러 실행 전 데코레이터 값으로 고정되므로, 실제 409/410 예외 경로가 새 `isCacheable` 분기에 도달하는지 자체가 의심스럽다 — 즉 이 PR이 CHANGELOG에서 주장하는 "24h 동일 응답 재현"이 실제로는 동작하지 않을 가능성이 있는데, 이를 잡아낼 단위/e2e 테스트가 전무하다. 이 mock-리얼리티 갭이 이번 리뷰의 핵심 리스크이며, 예외 기반 실패 채널을 흉내내는 테스트(및 가능하면 Idempotency-Key 헤더를 단 e2e)를 추가하기 전까지는 이 fix가 실제로 효과가 있다고 확신할 근거가 부족하다. 그 외 3xx 캐시 범위 축소가 무테스트·무문서로 조용히 들어간 점도 별도 커버리지 갭이다.

## 위험도

CRITICAL
