### 발견사항

- **[WARNING]** `withTimeout` 메서드에서 타임아웃 발동 후 원본 Promise가 계속 실행됨
  - 위치: `backend/src/modules/llm/llm.service.ts` — `withTimeout` 메서드
  - 상세: `Promise.race([p, timeoutPromise])` 패턴에서 타임아웃이 먼저 reject되면 호출자는 즉시 예외를 받지만, `p`(= `client.listModels()`)는 백그라운드에서 계속 실행됩니다. Node.js에는 Promise 취소 메커니즘이 없으므로 이미 개설된 HTTP 소켓·메모리가 원본 요청이 완료될 때까지 회수되지 않습니다. 단일 요청이라면 무해하지만 타임아웃이 빈번하게 발생하면 연결 누수가 누적될 수 있습니다.
  - 제안: `AbortController`를 생성하여 `signal`을 클라이언트 호출에 전달하고, 타임아웃 발생 시 `abort()`를 호출해 HTTP 소켓을 조기 종료하세요.

```typescript
private async withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await factory(ac.signal);
  } catch (err) {
    if (ac.signal.aborted) {
      throw new Error(`Request timed out after ${ms}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

그런 다음 `client.listModels(signal)`처럼 signal을 전파하면 됩니다. 단, 현재 LLMClient 인터페이스에 `signal` 파라미터가 없으므로 인터페이스 변경이 선행되어야 합니다.

- **[INFO]** `Throttle({ default: { limit: 10, ttl: 60_000 } })` — 적절히 적용됨
  - 위치: `llm-config.controller.ts` — `previewModels` 엔드포인트
  - 상세: 분당 10회 제한은 프리뷰 특성상 합리적이며, NestJS ThrottlerGuard는 요청 단위로 원자적으로 카운트하므로 경쟁 조건 없음.

- **[INFO]** Google 클라이언트의 `embed()` 순차 루프 → 단일 배치 호출로 교체
  - 위치: `google.client.ts` — `embed` 메서드
  - 상세: 이전 코드는 텍스트 배열을 순차적으로 `await`하여 N번의 왕복이 발생했으나, 신규 구현은 단일 배치 호출로 대체됩니다. 동시성 문제가 제거된 개선입니다.

---

### 요약

변경사항의 대부분은 TypeScript 타입 단언 정리와 테스트 픽스처 개선으로, 런타임 동시성에 영향을 주지 않습니다. 실질적인 동시성 관련 변경은 `previewModels`의 `withTimeout` 구현인데, `Promise.race` 기반 타임아웃 패턴이 원본 HTTP 요청을 취소하지 않아 타임아웃 발동 시 소켓 누수가 발생할 수 있습니다. Rate limit과 비동기 패턴 전반은 올바르게 구현되어 있으며, 데드락·경쟁 조건·스레드 안전성 문제는 없습니다.

### 위험도

**LOW**