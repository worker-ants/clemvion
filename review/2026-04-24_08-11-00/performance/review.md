## 발견사항

### [INFO] `embed()` 배치 처리 전환 — 성능 개선
- **위치**: `google.client.ts` — `embed()` 메서드
- **상세**: 기존 구현은 `texts` 배열을 순회하며 텍스트마다 `embedModel.embedContent(text)` HTTP 호출(N번 직렬 I/O). 신규 구현은 `ai.models.embedContent({ contents: texts })` 단일 호출로 교체되어 O(N) → O(1) HTTP 왕복.
- **제안**: 개선 사항. 유지.

---

### [WARNING] `listModels()` — 하드코딩 → 실시간 API 호출, 결과 캐싱 없음
- **위치**: `anthropic.client.ts:listModels()`, `google.client.ts:listModels()`
- **상세**: 기존엔 정적 배열을 즉시 반환(O(1), 0 I/O). 변경 후 매 호출마다 프로바이더 API를 실시간 호출한다. `previewModels`는 명시적으로 per-config 캐시에 넣지 않도록 설계되어 있어(`mockClientFactory.create`가 두 번 호출되는 테스트 확인), N명의 사용자가 동시에 폼을 열면 N번의 외부 API 호출이 발생한다. Throttle(10/60s)이 엔드포인트 단위로 걸려 있지만, 워크스페이스 사용자 수가 많으면 프로바이더 rate limit에 걸릴 수 있다.
- **제안**: 저장된 configId 기반의 `GET /llm-configs/:id/models` 경로에는 서비스 레이어에서 짧은 TTL(예: 5분) 인메모리 캐시를 추가할 것. `previewModels`는 보안 상 의도적으로 캐시 제외가 맞으므로 현행 유지.

---

### [WARNING] Google `listModels()` — 페이지네이션 복수 HTTP 왕복
- **위치**: `google.client.ts:listModels()` — `for await (const m of pager)`
- **상세**: Gemini API는 수백 개의 모델을 페이지네이션으로 반환할 수 있다. MAX_MODELS=100 캡과 `break`로 조기 종료되지만, 첫 100개를 채우기 전에 여러 페이지 요청이 순차적으로 발생한다. 페이지당 모델 수가 적은 경우 최악 수십 회 HTTP 왕복 가능.
- **제안**: `pageSize` 파라미터를 지원하는 경우 `list({ pageSize: 100 })` 형태로 단일 요청으로 충분한 수를 가져오는 것이 바람직. Google GenAI SDK 문서 확인 필요.

---

### [INFO] `isPrivateHost()` — 인라인 정규식
- **위치**: `llm.service.ts:isPrivateHost()` — `exec(hostname)` 내부 정규식
- **상세**: `/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/`가 함수 호출마다 리터럴로 평가된다. V8은 리터럴 정규식을 최적화하지만, 모듈 상단 상수로 추출하면 명확성과 미세 성능 모두 개선된다.
- **제안**:
  ```ts
  const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  ```

---

### [INFO] `withTimeout()` — AbortSignal 비전파 시 소켓 누수 가능성
- **위치**: `llm.service.ts:withTimeout()`
- **상세**: `inner.catch(() => undefined)` 처리로 unhandled rejection은 방지되어 있다. 단, 개별 SDK가 `AbortSignal`을 내부 HTTP 요청까지 전파하지 않는 경우(예: Google SDK의 `list()` 호출에서 `config: { abortSignal }` 경로) Promise.race 로 서비스 응답은 즉시 거부되지만, SDK 내부 HTTP 소켓은 OS 타임아웃(수 분)까지 열려 있을 수 있다.
- **제안**: 각 SDK별로 AbortSignal 실제 전파 여부를 통합 테스트로 검증 필요. Google `models.list()`의 signal 전달 경로(`config: { abortSignal }`)는 이번 변경에 포함되어 있어 의도는 올바름.

---

### [INFO] `previewModels()` — 클라이언트 인스턴스 미재사용 (의도적)
- **위치**: `llm.service.ts:previewModels()`
- **상세**: 매 요청마다 `clientFactory.create()`로 새 클라이언트를 생성한다. SDK 클라이언트 생성 자체는 경량이나, 내부에서 HTTP agent pool을 새로 초기화하는 경우 연결 재사용이 되지 않는다. 보안상 apiKey를 캐시에 두지 않는 설계는 정확하다.
- **제안**: OpenAI SDK 등 `httpAgent`를 별도로 주입할 수 있는 경우, agent pool만 공유하고 클라이언트는 매번 생성하는 방식으로 소켓 재사용을 유지할 수 있다. 현 트래픽 규모에서는 낮은 우선순위.

---

### [INFO] Google `buildGenerationConfig()` — 다중 spread 연산
- **위치**: `google.client.ts:buildGenerationConfig()`
- **상세**: `cfg` 객체를 여러 조건부 spread로 구성한다(`{ ...field }`가 6회 이상). 각 spread는 새 객체를 생성하나, chat/stream 핫패스에서 호출당 1회로 규모가 작아 실질적 영향 없음.
- **제안**: 유지. 가독성이 더 중요한 영역.

---

## 요약

이번 변경에서 가장 의미 있는 성능 변화는 Google `embed()`의 N번 직렬 HTTP 호출 → 단일 배치 호출 전환(명확한 개선)과, Anthropic·Google `listModels()`의 하드코딩 제거 → 실시간 API 호출 전환(정확도 향상이지만 캐싱 없음이라는 트레이드오프 수반)이다. `withTimeout()` + `AbortController` 패턴은 소켓 자원 관리 측면에서 올바르게 구현되어 있으며, SSRF 가드와 Rate Limit도 적절히 배치되어 있다. 주요 위험은 저장된 configId 경로의 `listModels()` 결과에 캐싱이 없어 동시 사용자 증가 시 프로바이더 API 호출이 선형적으로 증가할 수 있다는 점이다.

## 위험도

**LOW**