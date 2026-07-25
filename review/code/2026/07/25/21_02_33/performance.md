# 성능(Performance) 리뷰 — node-cancellation abortSignal cascade (cafe24 / makeshop)

## 발견사항

- **[WARNING]** `context.abortSignal`(upstream) 에 등록한 `abort` 리스너가 정상 완료 경로에서 절대 해제되지 않아, 실행(execution) 하나당 API 호출 수만큼 리스너가 무한 누적된다 (메모리 누수).
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1215-1228` (`executeWithRateLimit`), `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:844-857` (`executeWithRetry`)
  - 상세:
    ```ts
    const upstream = opts.signal;
    if (upstream) {
      if (upstream.aborted) {
        controller.abort();
      } else {
        const onUpstreamAbort = () => controller.abort();
        upstream.addEventListener('abort', onUpstreamAbort, { once: true });
        controller.signal.addEventListener(
          'abort',
          () => upstream.removeEventListener('abort', onUpstreamAbort),
          { once: true },
        );
      }
    }
    ```
    정리(clean-up) 로직이 **오직 `controller.signal`의 `'abort'` 이벤트가 실제로 발화될 때만** 동작한다. 그런데 `controller.signal`은 (a) 자체 타임아웃 타이머가 발화하거나 (b) 위 `onUpstreamAbort`가 호출될 때만 abort 되며, 정상 완료 경로는 `finally { clearTimeout(timer); }` 로 타이머만 취소할 뿐 `controller.abort()`를 호출하지 않는다(같은 파일 cafe24 `:1246`, makeshop `:871`). 즉 **성공/4xx·5xx 응답/네트워크 에러 등 타임아웃이 아닌 모든 종료 경로에서 `upstream.removeEventListener` 가 실행되지 않고, `onUpstreamAbort` 클로저가 `upstream`(=`context.abortSignal`) 에 영구히 남는다.**
    바로 위 주석 "the listener is removed when the controller settles (timeout, **completion**, or this same abort)" 은 사실과 다르다 — `controller.signal` 은 명시적 `.abort()` 호출 없이는 "completion" 으로 자동 abort 되지 않는다(WHATWG AbortController/Node 표준 동작). 이는 실수로 보인다.
    추가로 두 함수 모두 429/401 재시도 시 **자기 자신을 재귀 호출**하면서 동일한 `opts`(따라서 동일한 `opts.signal`) 를 그대로 넘긴다 (`MAX_RATE_LIMIT_RETRIES = 2`, cafe24 `:232`/makeshop `:210`). 재시도마다 새 `AbortController` + 새 리스너가 만들어지므로, **재시도 1회당 리스너 1개씩 추가로 leak** 된다.
    결과적으로 하나의 workflow 실행(`executionId` 당 하나의 `context.abortSignal`로 보임) 안에서 이 두 커머스 노드가 반복 호출되는 흔한 시나리오 — 배치/루프 노드로 다수 상품·주문을 순회, 429 재시도가 잦은 대량 동기화 — 에서 동일 `AbortSignal` 객체에 abort 리스너가 호출 횟수만큼 계속 쌓인다. Node/EventTarget 기본 임계값(통상 10개)을 넘기면 `MaxListenersExceededWarning` 로그 잡음이 발생하고, 실행이 끝날 때까지(또는 실제로 그 signal 이 abort 될 때까지) 각 클로저가 `controller` 참조를 붙들어 GC 되지 않는다. 만약 실행 도중 실제로 취소되면, 누적된 리스너 수백~수천 개가 한꺼번에 동기적으로 발화해 이미 끝난 각 `controller` 에 대해 의미 없는 `controller.abort()` 를 반복 호출한다 — 기능상 무해하지만 취소 시점에 불필요한 동기 작업 스파이크를 유발한다.
  - 제안: `finally` 블록에서 타이머 취소와 함께 **무조건** `upstream?.removeEventListener('abort', onUpstreamAbort)` 을 호출하도록 바꾼다(`controller.signal`의 abort 이벤트에 의존하지 말 것). 예:
    ```ts
    let onUpstreamAbort: (() => void) | undefined;
    if (upstream && !upstream.aborted) {
      onUpstreamAbort = () => controller.abort();
      upstream.addEventListener('abort', onUpstreamAbort, { once: true });
    } else if (upstream?.aborted) {
      controller.abort();
    }
    try {
      response = await this.fetchImpl(url, { ... });
    } finally {
      clearTimeout(timer);
      if (upstream && onUpstreamAbort) upstream.removeEventListener('abort', onUpstreamAbort);
    }
    ```
    이 패턴은 `http-request.handler.ts` (`:400-419`) 에 이미 존재하는 동일 구조를 그대로 복제한 것이므로, 이번 fix 는 3곳(http-request, cafe24, makeshop) 모두에 적용하는 편이 일관적이다. 신규 도입 버그는 아니지만 이번 diff 로 노출 지점이 1곳 → 3곳으로 늘었다.

- **[INFO]** 리스너/클로저 2개(`onUpstreamAbort`, cleanup 콜백) 를 신호가 있을 때마다 매 호출·매 재시도마다 새로 할당한다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1220-1226`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:849-855`
  - 상세: 네트워크 왕복(수십~수백 ms) 대비 클로저 할당 비용은 무시할 수준이라 단독으로는 문제되지 않는다. 위 WARNING 항목이 고쳐지면 이 할당도 호출 종료 시점에 정상적으로 회수된다.

- **[INFO]** handler 쪽 변경(`cafe24.handler.ts:260`, `makeshop.handler.ts:247` — `signal: context.abortSignal` 한 줄 추가) 은 객체 리터럴에 속성 하나를 추가하는 것뿐이라 성능 영향 없음.

## 요약

이번 diff 의 핵심 로직(두 client 의 `context.abortSignal` → per-call `AbortController` cascade)은 알고리즘적으로 단순하고 N+1·블로킹 I/O·불필요한 재계산 같은 통상적 문제는 없다. 다만 cascade cleanup 이 "controller 가 abort 될 때"에만 동작하도록 짜여 있는데, 정상 완료·4xx/5xx·네트워크 에러 등 **타임아웃이 아닌 모든 종료 경로에서 실제로는 정리되지 않아**, 실행(execution) 하나가 이 노드를 반복 호출할 때마다 `context.abortSignal` 에 abort 리스너가 무한정 쌓이는 메모리 누수가 있다 — 429/401 재시도가 재귀 호출로 처리되어 리스너 수를 더 늘린다. 코드 주석의 "completion 시 해제된다"는 설명은 AbortController 표준 동작과 맞지 않는 잘못된 전제다. 이 패턴은 `http-request.handler.ts` 에 이미 있던 것을 그대로 복제한 것이라 신규 결함은 아니지만, 이번 변경으로 노출 지점이 3곳으로 늘어난다. 대량 순회(상품/주문 동기화 루프) 워크로드에서 체감될 수 있는 리소스 문제이므로 `finally` 블록에서 무조건 `removeEventListener` 하도록 수정할 것을 권고한다. 그 외 나머지 변경(테스트 4파일, plan 문서 2파일)은 성능 관점에서 특기할 사항 없음.

## 위험도

MEDIUM
