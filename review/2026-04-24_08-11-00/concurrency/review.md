### 발견사항

- **[WARNING]** `for await` + `break` 시 페이지네이션 HTTP 요청 누수 가능성
  - 위치: `google.client.ts` — `listModels()`, `for await (const m of pager)` + `if (models.length >= MAX_MODELS) break;`
  - 상세: SDK 페이지네이터는 `for await` 루프를 `break`로 탈출해도 내부적으로 이미 인플라이트된 다음 페이지 요청을 취소하지 않는다. `AbortSignal`은 `this.ai.models.list()` 초기 호출에만 전달되며, 이후 자동 페이지 fetch 요청에는 전파되지 않는다. 결과적으로 100개 모델 상한 도달 후 탈출해도 백그라운드 HTTP 소켓이 계속 살아 있을 수 있다.
  - 제안: `controller.abort()`를 `break` 직전에 명시적으로 호출하거나, SDK가 `AsyncIterator.return()` 정리를 지원하는지 확인 후 `try/finally`에서 pager를 정리한다.

    ```typescript
    const controller = new AbortController();
    const pager = await this.ai.models.list({ config: { abortSignal: controller.signal } });
    try {
      for await (const m of pager) {
        if (models.length >= MAX_MODELS) { controller.abort(); break; }
        // ...
      }
    } finally {
      controller.abort(); // no-op if already aborted or normally completed
    }
    ```

- **[INFO]** `AnthropicClient.listModels` — 모델 수 상한 없음
  - 위치: `anthropic.client.ts` — `listModels()`
  - 상세: Google 클라이언트는 `MAX_MODELS = 100` 상한을 두었으나 Anthropic 클라이언트에는 없다. Anthropic이 향후 수백 개 모델을 반환하는 상황이 오면 `for await` 루프가 장기화되어 30초 타임아웃 전까지 소켓을 점유할 수 있다. 현재는 Anthropic 모델 수가 적으므로 실질 위험은 낮다.
  - 제안: Google과 동일하게 상한을 추가해 일관성을 유지한다.

- **[INFO]** `withTimeout` — `Promise.race` 패턴 검토 (이상 없음)
  - 위치: `llm.service.ts` — `withTimeout()`
  - 상세: `inner.catch(() => undefined)`로 타임아웃 후 inner가 reject 될 때 unhandled rejection을 방지하고, `finally`에서 `clearTimeout`을 호출해 타이머 누수를 방지한다. `AbortController`로 소켓 정리도 시도한다. 전반적으로 올바르다.

- **[INFO]** `previewModels` — 클라이언트 인스턴스 캐시 미사용 확인 (의도된 설계)
  - 위치: `llm.service.ts` — `previewModels()`
  - 상세: 요청마다 새 클라이언트 인스턴스를 생성하므로 API Key가 공유 상태에 남지 않는다. 동시 요청 간 credential 혼용 위험 없음. 다만 고빈도 동시 요청 시 클라이언트 생성 비용이 누적될 수 있으나 `@Throttle(10/60s)` 적용으로 실질 위험은 차단됨.

---

### 요약

이번 변경의 핵심 동시성 구현(`withTimeout` + `AbortController` + `Promise.race`)은 소켓 정리와 unhandled rejection 방지를 모두 고려한 올바른 패턴이다. 실질적인 위험은 `GoogleClient.listModels`의 `for await` + `break` 조합으로, 100개 상한 도달 후 이미 시작된 다음 페이지 HTTP 요청이 백그라운드에 남을 수 있다. `AbortSignal`이 초기 호출에만 전달되고 자동 페이지네이션 continuations에는 전파되지 않기 때문이다. 그 외 나머지 변경(TypeScript 타입 단언 제거, DTO 개선, 테스트 픽스처 정리)은 동시성과 무관하다.

### 위험도

**LOW**