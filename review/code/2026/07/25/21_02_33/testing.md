# 테스트(Testing) 리뷰 — node-cancellation §4 cascade (Cafe24 / MakeShop)

## 발견사항

- **[WARNING]** cascade cleanup 경로("완료 시 listener 제거") 가 테스트로 검증되지 않고, 실제로도 정상 완료(success) 경로에서는 동작하지 않는다 — 리스너 누수가 무테스트 상태
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1208-1228` (`executeWithRateLimit`), 동일 패턴 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:837-857` (`executeWithRetry`)
  - 상세: 주석은 "the listener is removed when the controller settles (timeout, completion, or this same abort)" 라고 명시하지만, 실제 구현은 `controller.signal` 의 `'abort'` 이벤트에만 제거 로직을 건다(`controller.signal.addEventListener('abort', () => upstream.removeEventListener(...), { once: true })`). 요청이 **정상 완료**되면(타임아웃도 안 걸리고 cascade 도 안 걸리면) `controller.abort()` 가 전혀 호출되지 않으므로 `controller.signal` 의 `'abort'` 이벤트가 발생하지 않고, 따라서 `onUpstreamAbort` 리스너가 **영구히 `upstream`(=`context.abortSignal`, 실행 전체에서 공유되는 장수명 시그널)에 남는다.** 재시도 경로(429 rate-limit retry, 401 auth retry)는 매 시도마다 `executeWithRateLimit`/`executeWithRetry` 를 재귀 호출해 **새 컨트롤러 + 새 리스너**를 매번 upstream 에 추가하므로, 같은 실행 안에서 이 client 를 반복 호출하는 워크플로(루프 등)는 `context.abortSignal` 에 리스너가 계속 누적된다(Node 의 AbortSignal 도 EventTarget 리스너 상한 경고 대상).
    실측: 새로 추가된 4개 테스트(`aborts the in-flight fetch...`, `does not abort...`, `aborts before issuing...`, `leaves the timeout path untouched...`) 중 어느 것도 `removeEventListener` 호출 여부나 정상 완료 후 리스너 잔존 여부를 검증하지 않는다 — 즉 `controller.signal.addEventListener('abort', () => upstream.removeEventListener(...))` 줄만 삭제하는 뮤턴트를 넣어도 client/handler spec 전부 그대로 통과한다(plan 문서가 보고한 mutation 표는 "cascade 블록 전체 제거"만 다뤘고 "cleanup 만 제거"는 다루지 않았다).
  - 제안: 성공 경로에서 `upstream.removeEventListener` 가 실제로 호출되는지 스파이로 고정하는 회귀 테스트를 추가한다. 예:
    ```ts
    const upstream = new AbortController();
    const removeSpy = jest.spyOn(upstream.signal, 'removeEventListener');
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
    await client.call(integration, { method: 'GET', path: 'product', signal: upstream.signal });
    expect(removeSpy).toHaveBeenCalled();
    ```
    이 테스트는 현재 구현으로는 **실패**할 것이므로, 구현 쪽에서 `finally` 블록(또는 fetch 성공/실패 모두를 포괄하는 위치)에서 명시적으로 `upstream.removeEventListener(...)` 를 호출하도록 고쳐야 한다.

- **[WARNING]** signal cascade × 재시도(429/401) 상호작용이 완전히 미검증
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` `executeWithRateLimit` 재귀 호출부(`:1274`, `:1335`) / `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` `executeWithRetry` 재귀 호출부(`:892`, `:926`); 테스트: `cafe24-api.client.spec.ts:93-167`, `makeshop-api.client.spec.ts:92-167`
  - 상세: 새 cascade 테스트 4건은 모두 단발성(재시도 없는) 호출만 다룬다. `opts`(따라서 `opts.signal`) 는 재시도 시 그대로 재사용되는데, 매 attempt 마다 새 `AbortController` + 새 `onUpstreamAbort` 리스너가 upstream 에 붙는다. 위 첫 번째 항목의 누수가 바로 이 경로에서 재시도 횟수만큼 배가된다 — 그런데 이 조합(예: 429 → sleep → retry → success, signal 지정)을 검증하는 테스트가 하나도 없다.
  - 제안: `429 재시도 성공` 또는 `401 자가회복` 기존 테스트 중 하나에 `signal: upstream.signal` 을 추가하고, 최종적으로 `fetchMock` 이 여러 번 호출된 각 call 의 `init.signal` 이 서로 다른(각 attempt 전용) 시그널인지, 그리고 완료 후 upstream 리스너가 정리되는지 확인하는 케이스를 별도로 추가.

- **[INFO]** 테스트 스타일 불일치 — 형제 테스트들과 다른 Promise 체이닝 스타일
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:116` (`it('does not abort the fetch when the upstream signal stays open', () => { ... return client.call(...).then(...) })`), 동일하게 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts:115`
  - 상세: 같은 `describe` 블록의 나머지 3개 테스트는 모두 `async () => { await ... }` 패턴인데 이 테스트만 `() => { return client.call(...).then(...) }` 로 작성되어 있다. 기능상 문제는 없으나(Jest 가 반환된 Promise 를 기다림) 가독성·일관성이 떨어진다.
  - 제안: `async/await` 로 통일.

- **[INFO]** 기존 광범위 `toEqual` 단언이 새 `signal` 필드에 대해 우연히 안전한 이유가 암묵적
  - 위치: 예 `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts:314-321` (`expect(callArgs[1]).toEqual({ method, path, query, body })` — `signal` 키 없이 비교), `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.spec.ts` 동일 패턴
  - 상세: handler 가 이제 항상 `signal: context.abortSignal` 을 `apiClient.call` 옵션에 포함시키므로, `makeContext()` 처럼 `abortSignal` 이 없는 컨텍스트에서는 실제 전달 객체가 `{ ..., signal: undefined }` 가 된다. Jest 의 `toEqual` 은 객체 비교 시 값이 `undefined` 인 프로퍼티를 무시하므로 기존의 "signal 필드 없는" 리터럴과 그대로 일치해 회귀가 발생하지 않았다 — 의도된 것이라기보다 Jest 동작에 우연히 기댄 것이라 향후 `context.abortSignal` 기본값이 바뀌면(예: 항상 채워지는 컨텍스트로 변경) 이 경로의 넓은 `toEqual` 단언들이 아무 언급 없이 깨질 수 있다.
  - 제안: 필수는 아니나, 새로 추가된 `abortSignal forwarding` describe 블록이 이미 `signal` 필드를 명시적으로 커버하고 있으므로 이 자체는 즉각 조치 불필요 — 다만 리뷰어 주석 정도로 남겨 향후 리팩터 시 참고.

- **[INFO]** cascade 테스트가 GET 메서드로만 고정
  - 위치: `cafe24-api.client.spec.ts:94-166`, `makeshop-api.client.spec.ts:93-166`
  - 상세: 4개 신규 테스트 모두 `method: 'GET'` 만 사용한다. cascade 로직(`controller`/`upstream` 처리)은 메서드 분기 이전에 실행되므로 기능적 위험은 낮지만, envelope-wrapping 이 있는 POST/PUT 경로와 결합했을 때의 회귀는 이 스위트만으로는 보장되지 않는다.
  - 제안: 우선순위 낮음. 필요 시 write-method 1건 추가.

## 요약

새로 추가된 cascade/forwarding 테스트(client 4건 × 2 + handler 2건 × 2, cafe24/makeshop 대칭)는 "upstream abort 가 in-flight fetch 를 취소한다 / 무조건 취소하는 회귀는 아니다 / 이미 aborted 면 즉시 전파 / signal 없으면 timeout 경로 불변 / handler 가 signal 을 발명하지 않고 그대로 전달한다" 라는 핵심 계약을 각각 정확한 대조군과 함께 잘 고정했고, plan 문서가 제시한 mutation 결과(양쪽 축 각각 4 failed)도 이를 뒷받침한다. 다만 구현이 명시적으로 주장하는 "컨트롤러가 settle(타임아웃/완료/abort) 하면 리스너를 정리한다" 는 계약 중 **완료(success) 케이스는 실제 코드에 구현되어 있지 않고**, 이 결함은 현재 테스트 스위트로는 전혀 드러나지 않는다 — 정상 완료 후 `upstream.removeEventListener` 가 호출되는지 검증하는 테스트가 하나도 없기 때문이다. 같은 시그널이 실행 전체에서 공유되고 재시도 시 매 attempt 마다 새 리스너가 붙는 구조라 이 갭은 장기 실행/루프/재시도 시나리오에서 리스너 누적으로 이어질 수 있다. 나머지는 스타일(Promise 체이닝 불일치)·부수적 관찰(toEqual 의 undefined 무시에 암묵적으로 의존) 수준의 INFO.

## 위험도

MEDIUM
