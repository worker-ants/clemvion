# 부작용(Side Effect) Review

### 발견사항

- **[WARNING]** retry 경로에서 상위(`context.abortSignal`) 시그널에 리스너가 누적된다 — 코드 주석의 "누적 방지" 주장과 실제 동작이 다름
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1215-1227` (`executeWithRateLimit` 내 cascade 블록), 대칭적으로 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:844-856` (`executeWithRetry` 내 cascade 블록)
  - 상세: 두 client 모두 다음 패턴을 새로 도입했다.
    ```
    const onUpstreamAbort = () => controller.abort();
    upstream.addEventListener('abort', onUpstreamAbort, { once: true });
    controller.signal.addEventListener(
      'abort',
      () => upstream.removeEventListener('abort', onUpstreamAbort),
      { once: true },
    );
    ```
    주석은 "the listener is removed when the controller settles (timeout, completion, or this same abort) so a long upstream signal does not accumulate listeners across retries" 라고 주장한다. 그러나 `controller.signal` 의 `'abort'` 이벤트는 **`controller.abort()` 가 실제로 호출될 때만** 발화한다 — 정상 완료(fetch 가 200/429/401 등으로 그냥 응답을 반환하고 `finally` 에서 `clearTimeout(timer)` 만 호출되는 경우)에는 `controller.signal` 이 `'abort'` 를 발화하지 않으므로 cleanup 리스너가 **절대 실행되지 않는다**. 즉 "completion" 은 리스너를 제거하지 않는다 — 주석의 그 부분은 사실과 다르다.
    한편 이 cascade 블록은 **재귀 재시도 함수**(`executeWithRateLimit`/`executeWithRetry`) 안에 있고, 이 함수는 429 rate-limit 재시도(최대 `MAX_RATE_LIMIT_RETRIES`회)와 401 자가 회복 재시도 시 **자기 자신을 다시 호출**하면서 매번 새 `controller` 를 만들고 `opts.signal`(== 상위 `upstream`, 대개 `context.abortSignal`)에 **새 리스너를 추가**한다(`executeWithRateLimit` 재귀 호출부: `cafe24-api.client.ts:1274`, `:1335` / `executeWithRetry` 재귀 호출부: `makeshop-api.client.ts:892`, `:926`). 이전 시도가 abort 없이 (429/401 응답으로) 정상 완료된 경우, 그 시도가 등록한 리스너는 위 이유로 제거되지 않고 `upstream` 에 그대로 남는다. 한 번의 top-level `client.call()` 호출 안에서 재시도가 여러 번 일어나면, 그 횟수만큼 리스너가 같은 `upstream` `AbortSignal` 에 쌓인다.
    비교: 이 패턴이 "identical" 하다고 주석이 인용하는 `http-request.handler.ts` 는 이 블록을 **재시도 없이 execute() 안에서 1회만** 실행한다(redirect follow 는 같은 controller 를 재사용). 따라서 원 패턴에서는 최악의 경우에도 노드 실행당 리스너 1개가 남는 정도지만, cafe24/makeshop 은 재귀 재시도 구조라 **동일 client.call() 1회 안에서도 리스너가 여러 개 쌓일 수 있어** 원 패턴보다 실제로 더 넓은 표면을 갖는다. "Identical to http-request.handler.ts" 라는 주석의 프레이밍은 코드 형태만 같을 뿐 호출 컨텍스트(재귀 vs 단발)가 달라 다소 오해의 소지가 있다.
    실질 영향은 제한적이다 — `context.abortSignal` 은 현재 `parallel-executor.ts` 의 cancel-others-on-fail 그룹에서만 세팅되고(plan 문서 자체가 이를 명시), 그 그룹/AbortController 는 병렬 브랜치가 끝나면 함께 GC 대상이 되므로 무한 누적은 아니다. 다만 코드 주석이 명시적으로 부인하는 시나리오가 실제로는 일어난다는 점에서, 문서-동작 불일치이자 이벤트 리스너 누적이라는 부작용 관점의 실질 결함이다.
  - 제안: (a) 상위 함수(`call()`) 레벨에서 단 하나의 controller/리스너 쌍만 만들고 매 재시도가 그 controller 를 재사용하도록 리팩터하거나, (b) 최소한 각 재시도 attempt 가 정상 완료될 때도 `finally` 블록에서 `upstream.removeEventListener(onUpstreamAbort, ...)` 를 명시적으로 호출해 attempt-scoped cleanup 을 보장할 것. 그것이 여의치 않다면 주석의 "so a long upstream signal does not accumulate listeners across retries" 문구를 재시도 시나리오에서는 참이 아니라고 정정할 것.

- **[INFO]** `Cafe24CallOptions.signal` / `MakeshopCallOptions.signal` 신규 필드는 optional 이라 하위 호환 — 기존 호출자(연결 테스트, 토큰 리프레시 등 `signal` 미전달 경로) 영향 없음. `if (upstream) {...}` 게이트가 `signal` 미지정 시 cascade 블록 전체를 스킵하므로 대다수 실행(현재 `context.abortSignal` 이 세팅되는 경우는 parallel 브랜치뿐)에서는 동작 변화가 없음. 시그니처 변경 관점에서는 안전.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:68-73` (인터페이스 확장), `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:62-67`

- **[INFO]** `Cafe24Handler.execute`/`MakeshopHandler.execute` 는 시그니처 변경 없이 내부 호출부(`this.apiClient.call(integration, {..., signal: context.abortSignal})`)만 변경했다. `context.abortSignal` 은 이번 diff 이전부터 `ExecutionContext` 인터페이스에 이미 존재하던 optional 필드(`node-handler.interface.ts:236`)이므로 새 공개 인터페이스 도입이 아니다. 테스트가 "signal 미보유 시 `undefined` 를 그대로 전달(발명하지 않음)" 경계를 명시적으로 고정하고 있어 회귀 위험 낮음.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` (`execute` 내 `apiClient.call` 호출부), `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts` (동일 패턴)

- **[INFO]** `plan/in-progress/node-cancellation-residual-signal-propagation.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 변경은 문서 산출물이며 코드 부작용 없음. 신규 plan 파일이 지적하는 "ShutdownStateService 와의 상태 분류 경합" 이슈는 이번 diff 범위(commerce 2건 signal 배선) 밖으로 명시적으로 분리되어 있고, `shutdown-state.service.ts` 는 이번 diff 에서 건드리지 않았음을 확인함(별도 파일에 대한 grep 결과와 plan 서술 일치).

### 요약

이번 변경은 Cafe24/MakeshopApiClient 에 기존 `AbortController`(per-call timeout)로 상위 `context.abortSignal` 을 cascade 하는 배선으로, optional 필드 추가·기존 필드 소비라는 점에서 공개 인터페이스·시그니처 관점의 파급은 낮고 하위 호환적이다. 다만 이 cascade 블록이 429/401 재시도 시 자기 자신을 재호출하는 함수(`executeWithRateLimit`/`executeWithRetry`) 내부에 위치해, 정상 완료(비-abort)로 끝나는 재시도 attempt 마다 `upstream` 시그널에 등록한 `abort` 리스너가 정리되지 않고 남는 실질적인 이벤트 리스너 누적이 있다 — 코드 주석이 명시적으로 "재시도 간 누적되지 않는다" 고 주장하는 것과 반대되는 동작이다. 영향 범위는 `context.abortSignal` 이 현재 parallel-executor 의 cancel 그룹에만 한정돼 있어 제한적이지만, 재현 가능하고 문서(주석)와 실제 동작이 어긋난다는 점에서 WARNING 으로 분류해 수정 또는 주석 정정을 권고한다. 그 외 항목(인터페이스 확장, handler 호출부 변경, plan 문서)은 부작용 관점에서 안전하다.

### 위험도
MEDIUM
