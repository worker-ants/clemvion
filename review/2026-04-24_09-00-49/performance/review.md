### 발견사항

- **[WARNING]** `AnthropicClient.listModels()` — 정적 배열 → 실시간 SDK 페이지네이션 전환
  - 위치: `anthropic.client.ts`, `listModels()` (신규 구현)
  - 상세: 이전엔 3개 하드코딩 배열을 O(1)로 반환했으나, 이제 매 호출마다 Anthropic API로 실제 HTTP 요청을 발행한다. 서비스 레이어에 per-config 캐시(`clearClientCache`)는 있지만 `previewModels` 경로는 캐시를 사용하지 않으므로, throttle(10/60s)로 막힌 최대 10 req/min이 모두 실제 네트워크 요청이 된다.
  - 제안: `listModels` 결과를 짧은 TTL(예: 5분)로 메모리 캐싱하거나, 최소한 per-request AbortSignal 외에 ETag/304 캐시 헤더 활용을 고려한다.

- **[WARNING]** `OpenAIClient.listModels()` — 모델 수 상한 없음
  - 위치: `openai.client.ts`, `listModels()` (기존 코드, 변경 없음이나 이번 변경과 함께 노출됨)
  - 상세: Anthropic 구현에는 `MAX_MODELS = 100` 상한이 있으나 OpenAI 경로에는 없다. OpenAI는 deprecated 포함 수백 개의 모델을 반환하며 전체가 메모리에 적재된다.
  - 제안: Anthropic과 동일하게 `MAX_MODELS = 100` 가드를 추가한다.

- **[INFO]** `previewModels` — 매 요청마다 새 SDK 클라이언트 인스턴스 생성
  - 위치: `llm.service.ts`, `previewModels()`
  - 상세: spec §5.5에 따라 per-config 캐시에 넣지 않는 것이 의도적 설계다. SDK 클라이언트 생성 비용 자체는 낮으나, rate limit(10/60s)과 함께 고려하면 정상 범위.
  - 제안: 현 설계로 충분하다. 문서화된 의도와 일치.

- **[INFO]** `sanitizeGeminiSchema()` — 매 chat/stream 호출 시 재귀 순회
  - 위치: `google.client.ts`, `buildToolConfig()` → `sanitizeGeminiSchema()`
  - 상세: 도구 스키마가 깊게 중첩된 경우 O(schema_nodes × tools) 연산이 매 요청마다 발생한다. 도구 정의는 호출 간 변경되지 않는 게 일반적이므로 낭비 가능성이 있다.
  - 제안: ChatParams에 도구가 있으면 첫 sanitize 결과를 WeakMap으로 메모이즈하거나, 핸들러가 미리 sanitize된 형태를 캐싱하도록 구조를 개선한다. 단, 일반적인 tool 수(< 20)에서는 무시 가능한 수준.

- **[INFO]** `withTimeout()` — Promise.race + AbortController 구현
  - 위치: `llm.service.ts`, `withTimeout()`
  - 상세: `inner.catch(() => undefined)` 패턴으로 타임아웃 후 SDK 응답에 의한 unhandled rejection을 방지하고, `finally`에서 `clearTimeout`으로 타이머 누수를 막는다. 구현이 올바르다.
  - 제안: 변경 없음.

- **[INFO]** `isPrivateHost()` — 동기 URL 파싱 + 유한 재귀
  - 위치: `llm.service.ts`, `isPrivateHost()`
  - 상세: IPv4-mapped IPv6 처리에 1단계 재귀가 있으나 최대 깊이가 1로 고정된다. 요청당 1회 호출, O(1) 상수 시간.
  - 제안: 변경 없음.

- **[INFO]** `llm-config.service.ts` — isDefault=true 경로의 트랜잭션 오버헤드
  - 위치: `llm-config.service.ts`, `create()` / `update()`
  - 상세: isDefault=true일 때만 트랜잭션(BEGIN/UPDATE/INSERT or UPDATE/COMMIT)을 사용해 경쟁 조건을 방지한다. 일반 경로(isDefault=false)는 영향 없음. 올바른 트레이드오프.
  - 제안: 변경 없음.

---

### 요약

이번 변경의 핵심 성능 영향은 LLM 모델 목록을 하드코딩 배열에서 프로바이더 API 실시간 호출로 전환한 것이다. Anthropic(100개 상한)·OpenAI(상한 없음)·Google(신 SDK) 모두 이제 네트워크 I/O를 수반하며, `preview-models` 엔드포인트는 인스턴스 캐시 없이 매 요청마다 새 SDK 클라이언트를 만든다. `withTimeout` + `AbortController` + throttle로 최악의 시나리오를 잘 통제하고 있으나, OpenAI 경로의 무제한 모델 적재와 Anthropic 결과의 무캐싱은 저위험 개선 여지다. 타입 캐스트 제거(대다수 파일)는 런타임 성능과 무관하다.

### 위험도

**LOW**