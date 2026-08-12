# 요구사항(Requirement) 리뷰 — EIA §R8 idempotency 캐시 범위 (409/410)

## 발견사항

- **[CRITICAL]** 이번 PR 이 추가한 `409`/`410` 캐싱 분기가 **실제 트래픽에서는 절대 실행되지 않는 dead code** — R8/`EIA-RL-02` 갭이 여전히 열려 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:156-190` (`cacheTapped()`, 특히 `161: return tap({` / `162: next: (value) => {…}` / `172: if (!isCacheable) return;` / `186-188` 의 "409·410 이 캐시되는 것은 컨트롤러가 그 상태코드로 **정상 반환**하는 경로" 주석)
  - 상세: `cacheTapped()` 는 `tap({ next })` 형태로, RxJS `next.handle()` 이 **정상적으로 값을 emit** 했을 때만 `res.statusCode` 를 읽어 캐시 여부를 판정한다(`error` 콜백을 주지 않았으므로 소스가 error 를 emit 하면 `next` 콜백은 아예 호출되지 않고 예외가 그대로 통과한다 — RxJS `tap` 표준 동작).
    그런데 이 인터셉터가 캐시하려는 실제 대상, `409 STATE_MISMATCH` 와 `410 EXECUTION_TERMINATED` 는 `interaction.service.ts` 에서 전부 **throw** 로 만들어진다 — 정상 반환이 아니다:
    - `loadAndAssertAlive()` → `throw new GoneException({ error: { code: 'EXECUTION_TERMINATED', … } })` (410, `interact`/`cancel` 공통 진입점)
    - `assertWaiting()` → `throw new ConflictException({ error: { code: 'STATE_MISMATCH', … } })` (409)
    - `dispatchContinuation()` catch 분기 → `InvalidExecutionStateError` 를 `throw new ConflictException({ code: 'STATE_MISMATCH' })` 로 매핑 (409)

    NestJS 의 인터셉터 파이프라인을 실제 설치된 `@nestjs/core@11.1.27` 소스로 추적하면(`interceptors-consumer.js` `transformDeferred` → `from(next())`, `router-proxy.js` `createProxy`), 컨트롤러 핸들러가 reject 되면 `next.handle()` Observable 이 **error** 를 emit 하고, 그 예외는 인터셉터 체인을 그대로 통과해 `RouterProxy.createProxy` 의 `catch` 블록에서 `exceptionsHandler.next(e, host)` 로 전달돼 `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts`) 가 `response.status(status).json(...)` 을 **직접** 호출한다 — 이 경로는 인터셉터의 `tap.next` 콜백을 전혀 거치지 않는다.
    즉 `statusCode === 409 || statusCode === 410` 조건이 참이 되려면 컨트롤러가 **예외를 던지지 않고** `res.statusCode` 를 409/410 으로 세팅한 채 정상 반환해야 하는데, 이 코드베이스의 `interaction.controller.ts` 는 그런 경로를 갖고 있지 않다(모든 핸들러가 typed DTO 를 반환하거나 예외를 throw). 새로 추가된 `cacheTapped()` 의 `409`/`410` 분기, 그리고 `186-188` 라인의 "컨트롤러가 그 상태코드로 정상 반환" 이라는 전제는 실제 코드와 어긋난다.
  - 이 결함의 파급: `idempotency.interceptor.spec.ts` 의 신규 테스트(`409 는 캐시된다`, `410 도 캐시된다`) 는 `makeCallHandler({ error: 'STATE_MISMATCH' })` 로 **`of(value)`(정상 emit)** 를 흘리고 `makeContext({ statusCode: 409 })` 로 응답 객체의 `statusCode` 를 수동으로 미리 세팅한다 — 이는 실제 시스템이 409/410 을 만드는 방식(예외 throw)과 다른, 존재하지 않는 시나리오를 가정한 목이다. 테스트는 GREEN 이지만 실제 서버에서 같은 `Idempotency-Key` 로 `409`/`410` 을 두 번 요청하면 **여전히 매번 새로 처리**된다(캐시 SET 자체가 발생하지 않는다) — CHANGELOG/plan 이 "해소됐다" 고 서술하는 결함이 실은 그대로 남아 있다.
  - 제안: (a) `cacheTapped`/`intercept()` 를 `HttpException` 을 잡는 `catchError`(또는 `tap` 의 `error` 콜백)로 확장해, 던져진 예외에서 `exception.getStatus()`/`exception.getResponse()` 를 뽑아 409/410 일 때 캐시에 적재하고 **원래 예외를 다시 throw** 하도록 재설계할 것. (b) 재설계 후에는 실제 컨트롤러+서비스+인터셉터 스택을 통과하는 통합/e2e 테스트(동일 `Idempotency-Key` 로 두 번 `interact` 호출 → 두 번째가 캐시에서 동일 409 재현되는지)를 추가해, 단위 테스트 목이 실제 호출 경로를 재현하지 못하는 이 구조적 문제를 다시 만들지 않도록 할 것.

- **[WARNING]** CHANGELOG 의 클라이언트 영향 서술이 위 CRITICAL 로 인해 사실과 다르다.
  - 위치: `CHANGELOG.md:19` (`**클라이언트 영향**: 같은 \`Idempotency-Key\` 로 \`409\`/\`410\` 을 받은 뒤 재요청하면 이제 24h 동안 동일 응답이 재현된다.`)
  - 상세: 위 CRITICAL 이 사실이면 이 문장은 거짓이다 — 실제로는 여전히 매번 새로 처리된다.
  - 제안: 위 CRITICAL 을 먼저 해소한 뒤 CHANGELOG 를 갱신(또는 CRITICAL 이 맞다면 이 문단 자체를 되돌릴 것).

- **[WARNING]** plan 체크리스트의 "완료" 마킹이 시기상조.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:542`(체크박스 `[x]`), `:570-583`(`> **완료 (2026-08-12, developer 턴 \`eia-r8-cache-scope\`).**` 서술과 뮤테이션 표)
  - 상세: 뮤테이션 표(`>= 400` → 409·410 에서 RED, `=== 400` → 5xx·404 에서 RED)는 **단위 테스트 내부에서만** 유효하다 — 그 단위 테스트 자체가 실제 호출 경로(예외 throw)를 재현하지 못하므로, "완료" 판정의 근거가 무효화된다.
  - 제안: 위 CRITICAL 해소 전까지 체크박스를 되돌리고, 완료 서술에 "단위 테스트는 통과했으나 실제 예외 경로에서는 미검증" 같은 경고를 남기거나, e2e 검증 완료 후 재승격.

- **[WARNING]** spec 문서의 "선재 갭" 주석 삭제가 시기상조 — 갭이 실제로는 닫히지 않았다.
  - 위치: `spec/data-flow/15-external-interaction.md:258`
  - 상세: 삭제된 문구("⚠️ 현행 구현은 `statusCode >= 400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)")가 지목하던 **증상**(409/410 미재현)은 위 CRITICAL 로 인해 여전히 참이다. 원인만 바뀌었다(조건식 → 인터셉터 아키텍처가 예외 경로를 못 잡음).
  - 이는 spec 이 틀려서가 아니라 **코드가 spec 요구(R8/`EIA-RL-02`)를 실제로 충족하지 못해서** 발생한 불일치이므로 `[SPEC-DRIFT]` 가 아니다 — spec 을 되돌리는 것이 아니라 코드를 마저 고쳐야 한다.
  - 제안: 위 CRITICAL 해소 전까지 caveat 를 복원(또는 갱신)하거나, 최소한 이 표 행을 "구현 검증 필요" 로 표기.

- **[INFO]** `cacheTapped()` 의 캐시 가능 범위가 `statusCode < 400`(1xx/2xx/3xx 전부) 에서 `200 ≤ x < 300`(2xx 만) 으로 좁아졌다 — 3xx 를 캐시 대상에서 제외하는 변경인데 CHANGELOG/plan 어디에도 이 축소가 명시되지 않았다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:169`
  - 상세: `interaction.controller.ts` 의 핸들러들은 `@HttpCode(HttpStatus.ACCEPTED)`/`HttpStatus.OK` 로 고정돼 있어 실제로 3xx 를 반환할 일이 없어 보이므로 실무 영향은 낮아 보이지만, R8 스펙(2xx·409·410 닫힌 목록)과 일치시키는 근거가 있는 변경이면 CHANGELOG/docstring 에 명시하는 편이 추적에 낫다.
  - 제안: 의도된 변경이면 docstring/CHANGELOG 에 한 줄 추가(경미, 선택).

- **[INFO]** `idempotency.interceptor.spec.ts` 의 `410 도 캐시된다` 테스트는 `redis.set` 호출 여부만 단언하고 저장된 `statusCode` 값은 검증하지 않는다(`409` 테스트는 `stored.statusCode === 409` 까지 확인).
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:254-265`
  - 상세: `isCacheable` 분기 존재 자체는 뮤테이션으로 잡히지만, "410 이 저장될 때 statusCode 필드가 실제로 410 인지"는 별도로 고정돼 있지 않다. 경미한 커버리지 갭.
  - 제안: `409` 테스트와 동형으로 `stored.statusCode).toBe(410)` 단언 추가(선택).

## 요약

diff 자체는 spec `EIA §R8`("캐시 대상은 2xx·409·410 의 닫힌 목록, `statusCode>=400`/`===400` 두 축약 모두 오답")의 문구를 정확히 그대로 조건식으로 옮겼고 단위 테스트도 그 조건식 자체는 정확히 커버한다 — line-level 정합성만 보면 통과다. 그러나 그 조건이 실제로 관측되는 지점(`cacheTapped()` 의 `tap.next`)은 NestJS 인터셉터 파이프라인 구조상 **컨트롤러가 예외 없이 정상 반환할 때만** 실행되는데, 이 코드베이스에서 `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 는 전부 `ConflictException`/`GoneException` **throw** 로 만들어진다 — 즉 새로 추가된 분기는 프로덕션 트래픽에서 도달 불가능한 dead code 이고, 신규 단위 테스트는 이 아키텍처적 사실과 어긋나는 목(정상 반환 + 수동 `statusCode` 세팅)을 써서 GREEN 이 됐을 뿐 실제 수정 효과를 증명하지 못한다. 결과적으로 CHANGELOG 가 "이제 24h 동안 동일 응답이 재현된다" 고 적은 클라이언트 영향, plan 의 "완료" 체크, spec 문서의 "선재 갭 caveat 삭제" 는 모두 이 결함이 실제로는 닫히지 않았다는 점에서 시기상조다. `EIA-RL-02`(동일 키 24h 동일 응답 재현)는 409/410 범위에서 여전히 지켜지지 않는다.

## 위험도
CRITICAL
