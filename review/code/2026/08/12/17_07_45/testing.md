# 테스트(Testing) 리뷰 — `eia-r8-cache-scope` (2026-08-12 17:07:45)

대상: `idempotency.interceptor.ts` / `idempotency.interceptor.spec.ts` 의 §R8 캐시 스코프 재설계 (`16_29_45` CRITICAL — dead code + vacuous mock — 을 error 채널 재설계로 수정한 2차 시도) + CHANGELOG/plan/spec 문서 동기화.

## 총평 (먼저)

이전 라운드(`16_29_45`)의 CRITICAL 은 "mock 이 만들 수 있는 상태" 와 "시스템이 실제로 만드는 상태" 를 혼동한 vacuous test 였다. 이번 diff 는 그 결함 클래스를 정면으로 겨냥해 고쳤다 — `makeThrowingHandler` 로 **error 채널**을 실제로 행사하고, 기존 400 테스트까지 자매 자리로 소급 적용했으며(`16_53_26` WARNING 실측 반영), 뮤테이션 표로 두 방향(`>=400`/`=== 400`) 오답을 각각 다른 테스트가 잡는다는 것도 확인했다. 테스트 가독성·격리·회귀 커버리지는 전반적으로 우수하다. 다만 아래 두 가지는 **같은 "자매 자리 누락" 패턴**이 이번 수정 안에도 남아 있다.

---

### 발견사항

- **[WARNING]** `isErrorStatusCacheable` 의 "네 경우 모두 spec 에 회귀 테스트가 있다" 주장이 5xx 쪽에서는 사실이 아니다 — 실제로는 그 함수 자체를 통과하지 않는 경로로 검증된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:237`(주석 "네 경우 모두 spec 에 회귀 테스트가 있다"), `:239`(`isErrorStatusCacheable` 함수), `:186-189`(`catchError` 의 `if (err instanceof HttpException)` 가드) / `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:351`(`'throw 된 5xx 는 캐시하지 않는다'` 테스트)
  - 상세: `cacheTapped()` 의 `catchError` 는 `err instanceof HttpException` 을 먼저 확인하고, 참일 때만 `isErrorStatusCacheable(err.getStatus())` 를 호출한다. 그런데 "5xx" 테스트는 `makeThrowingHandler(new Error('boom'))` — **`HttpException` 이 아닌 순수 `Error`** — 를 던진다. 이 경우 `instanceof HttpException` 이 거짓이라 `isErrorStatusCacheable` 은 아예 호출되지 않고 `storeEntry` 도 처음부터 스킵된다. 즉 이 테스트는 "`isErrorStatusCacheable(5xx) === false`" 를 검증하는 게 아니라 "`HttpException` 이 아닌 예외는 애초에 캐시 판정 로직에 도달하지 않는다" 는 **다른 명제**를 검증한다.
    실측: `isErrorStatusCacheable` 를 `statusCode === 409 || statusCode === 410 || statusCode >= 500` 로 뮤테이션해도(실제 `InternalServerErrorException`(500) 같은 `HttpException` 기반 5xx 가 캐시되도록 하는 오답) — 이 spec 파일 안에는 `HttpException` 서브클래스이면서 `getStatus() >= 500` 인 케이스가 **하나도 없다**(`grep InternalServerErrorException` 0건). 404 테스트(`NotFoundException`)는 `>= 400` 방향 뮤턴트만 잡고, 이 5xx 뮤턴트는 어떤 테스트도 못 잡는다. `RESOLUTION.md` 의 2차 뮤테이션 표에도 `isErrorStatusCacheable → >= 400` (404 로 검출) 만 있고 `>= 500` 추가 방향은 없다 — 실제로 검증되지 않은 방향이다.
    이번 CRITICAL 의 근본 원인이 "mock 이 실제로 발생 가능한 상태를 재현하지 못했다" 는 것이었는데, 이 5xx 테스트는 형태는 error 채널이라 옳지만 **`HttpException` 이 아닌 예외를 골라 판정 함수 자체를 우회**하고 있어 같은 성격의 갭이 축소된 형태로 남았다.
  - 제안: `makeThrowingHandler(new InternalServerErrorException({ error: { code: 'INTERNAL' } }))` 처럼 실제 `HttpException` 기반 5xx 로 바꾸거나(더 현실적 — Nest 예외 필터가 5xx 를 던질 때 보통 `HttpException` 서브클래스), 현재 테스트는 유지하되 제목을 "HttpException 이 아닌 예외는 캐시 판정을 우회한다" 로 좁히고 별도로 진짜 `HttpException` 5xx 테스트를 추가.

- **[WARNING]** `409` 는 "캐시 히트 → 예외로 재현" 까지 테스트되는데 `410` 은 "적재" 만 테스트되고 "재조회 시 예외로 재현" 테스트가 없다 — 이번 CRITICAL 을 만든 것과 같은 "자매 자리 미적용" 패턴.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:322`(`'캐시된 409 는 재조회 시 **예외로** 재현된다'` — 409 전용) — `410` 에 대응하는 테스트가 파일 전체에 없음(같은 파일에서 `410` 은 `:296`의 적재 테스트 하나뿐).
  - 상세: `intercept()` 의 `isErrorStatusCacheable(cached.statusCode)` 분기(`idempotency.interceptor.ts:135-140`)는 409·410 을 동일 코드 경로로 처리하므로 현재 위험도는 낮다. 그러나 이 CRITICAL 자체가 "409/410 재현" 이라는 **핵심 계약**을 다루고, PR 도 "`409` 테스트와 동형으로 payload 까지" 라는 주석(`:317`)으로 대칭을 명시적으로 신경 쓰고 있음에도 정작 재현(replay) 쪽 대칭은 빠졌다. 향후 누군가 `isErrorStatusCacheable` 을 두 값 중 하나만 남기도록 잘못 리팩터링해도(예: `409` 만 남기는 오탈자) 410 replay 쪽은 스토어 단언(`stored.statusCode).toBe(410)`)까지만 걸리고, "캐시 히트 시 실제로 예외로 재throw 되는가" 는 검증되지 않는다.
  - 제안: `'캐시된 410 은 재조회 시 **예외로** 재현된다'` 를 409 테스트와 동일한 패턴(redis.get 이 `statusCode: 410` 캐시 엔트리를 반환 → `handler.handle` 이 호출되지 않고 `.rejects.toMatchObject({ status: 410 })`)으로 추가.

- **[INFO]** 성공 채널 캐시 조건 `statusCode < 200 || statusCode >= 300` 의 상한 경계값(`300` 자체)이 정확히 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:177` / 테스트는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:367`(`statusCode: 304`)만 사용.
  - 상세: `>= 300` 을 `> 300` 으로 바꾸는 뮤턴트(정확히 300 인 응답을 캐시해 버리는 오답)는 `304` 테스트로 잡히지 않는다(304 는 `> 300` 도 참이라 여전히 캐시 제외로 판정됨). 이 API 가 실제로 3xx 를 내지 않는다는 전제가 있어 실질 위험은 낮지만(테스트 주석에도 명시), `2xx`/`409`/`410` 경계는 정확한 값으로 고정해 둔 프로젝트 관행(정확히 `409`·`410`·`400`·`404` 를 쓴 것)과 비교하면 이 상한만 근사값(`304`)으로 남아 있다.
  - 제안: 선택 사항 — `statusCode: 300` 케이스를 추가하면 상한 경계도 나머지와 동일한 정밀도로 고정된다. 이번 PR 스코프상 필수는 아님.

- **[INFO]** (확인, 문제 아님) `Idempotency-Key` e2e 부재는 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 후속 항목으로 등재돼 있다(이번 diff 의 파일 4). 이번 CRITICAL 이 "단위 mock 이 실제 Nest 파이프라인(예외 필터·`@HttpCode`) 을 반영하지 못해" 생긴 것이므로 이 판단은 타당하고, 별도로 재지적할 필요는 없음.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:539`(체크박스 항목)

---

### 잘된 점 (참고용, 감점 아님)

- `makeThrowingHandler` 도입으로 409/410/400/404 를 **실제 예외 throw 경로**로 행사 — 이전 라운드의 vacuous mock(`makeCallHandler({ error })` + `statusCode` 프리셋)을 대체. 이것이 이번 diff 의 핵심 수정이고 올바르게 적용됨.
- `400 VALIDATION_ERROR` 테스트도 error 채널로 소급 수정 — `16_53_26` WARNING(같은 결함 클래스를 자매 자리에 미적용)이 정확히 지적한 갭을 닫음.
- `Logger.prototype.warn` spy 는 두 곳(`get()` 실패, `set()` 실패) 모두 `try/finally` 로 `mockRestore()` — 테스트 격리 양호.
- 각 테스트가 독립적으로 `redis`/`interceptor` 를 새로 만들어 상태 공유 없음 — 병렬/순서 무관하게 안전.
- `isErrorStatusCacheable`/`storeEntry` 를 named 함수/메서드로 추출해 테스트 가독성·재사용성 개선(이전 라운드 INFO 12 해소).
- 이전 라운드 WARNING(테스트 제목이 "401·404" 라 해놓고 404 만 행사)이 "404 단독" 으로 정정됨 — 제목·커버리지 불일치 해소.
- `3xx` 축소를 조용히 넘기지 않고 회귀 테스트(`304`)와 주석으로 명시 — 이전 라운드 WARNING #5 해소.

---

### 요약

핵심 수정(error 채널로 캐시 적재/재현 확장)은 실제 예외 경로를 정확히 행사하는 `makeThrowingHandler` 기반 테스트로 잘 뒷받침됐고, 이전 CRITICAL 의 근본 원인(vacuous mock)을 정면으로 겨냥한 재설계다. 다만 그 CRITICAL 을 만든 "자매 자리 누락" 패턴이 축소된 형태로 두 곳 남아 있다 — `isErrorStatusCacheable` 의 5xx 방향은 실제로는 `instanceof HttpException` 가드에 막혀 함수 자체가 호출되지 않는 경로로 우회 검증되고 있고(코드 주석의 "네 경우 모두 회귀 테스트가 있다" 는 주장과 어긋남), `410` 은 적재만 검증되고 409 처럼 "캐시 히트 → 예외 재현" 대칭 테스트가 빠졌다. 둘 다 현재 프로덕션 동작을 깨뜨리는 살아있는 결함은 아니며(현재 코드는 정상 동작), 향후 회귀에 대한 안전망 갭이라는 점에서 WARNING 수준이 적절하다. 나머지(테스트 격리·가독성·mock 사실성·문서-테스트 정합)는 이전 라운드 지적 사항을 성실히 반영해 양호한 상태.

### 위험도
MEDIUM
