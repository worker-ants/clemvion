## 발견사항

### [WARNING] `isPrivateHost` SSRF 가드 — 172.16.x.x 범위 미검증
- 위치: `llm.service.ts` `isPrivateHost()` / `llm.service.spec.ts`
- 상세: SSRF 테스트가 10.x, 169.254.x, 127.x를 커버하지만 `172.16.0.0/12` 범위가 누락됨. `172.16.x.x`, `172.31.x.x` 등 private 주소가 실제로 차단되는지 검증하는 케이스 없음.
- 제안:
  ```ts
  it('rejects 172.16.x.x (RFC1918 class B)', async () => {
    await expect(service.previewModels({ provider: 'openai', apiKey: 'k', baseUrl: 'http://172.16.0.1' }))
      .rejects.toThrow(BadRequestException);
  });
  ```

---

### [WARNING] 저장된 Config의 `listModels` — 타임아웃·에러 처리 경로 테스트 미갱신
- 위치: `llm.service.ts:listModels()` / `llm.service.spec.ts`
- 상세: 기존 `listModels(id, workspaceId)` 메서드가 이번에 `withTimeout`과 `BadRequestException` 래핑을 추가했으나, 기존 spec에는 timeout 케이스나 `LLM_MODEL_LIST_FAILED` 에러 경로가 없음. 신규 `previewModels` 쪽만 타임아웃 검증이 되어 있어 회귀 위험 존재.
- 제안: 기존 `listModels` describe 블록에 30초 timeout 케이스와 provider 에러 sanitization 케이스 추가 필요.

---

### [WARNING] Google 클라이언트 `MAX_MODELS = 100` 상한 미검증
- 위치: `google.client.ts:listModels()` / `google.client.spec.ts`
- 상세: 100개 초과 모델이 응답되면 잘라내는 로직이 있으나 이를 검증하는 테스트 없음. SDK 페이지네이션 동작 변경 시 silent regression 가능.
- 제안:
  ```ts
  it('caps model list at 100 entries', async () => {
    const { client } = makeStubs({ models: Array.from({ length: 150 }, (_, i) => ({
      name: `models/model-${i}`, supportedActions: ['generateContent'],
    })) });
    const models = await client.listModels();
    expect(models).toHaveLength(100);
  });
  ```

---

### [WARNING] Anthropic / OpenAI 클라이언트 `listModels` — `AbortSignal` 전달 미검증
- 위치: `anthropic.client.spec.ts`, `openai.client.spec.ts`
- 상세: 서비스 레벨에서는 "AbortSignal이 aborted=true인지"를 검증하나, 클라이언트가 `signal`을 SDK 호출로 실제 전달하는지는 클라이언트 단위 테스트에 없음. Anthropic의 경우 `client.models.list(undefined, { signal })` 형태가 맞는지 검증 불가.
- 제안: 각 클라이언트 spec에 signal 주입 케이스 추가:
  ```ts
  it('passes AbortSignal to SDK list call', async () => {
    const ctrl = new AbortController();
    const listMock = jest.fn().mockReturnValue(asyncIter([]));
    client.client = { models: { list: listMock } };
    await client.listModels(ctrl.signal);
    expect(listMock).toHaveBeenCalledWith(undefined, { signal: ctrl.signal });
  });
  ```

---

### [WARNING] Google 클라이언트 — `models/` prefix 제거·`supportedActions` 필터 단위 테스트 부재
- 위치: `google.client.ts:listModels()` / `google.client.spec.ts`
- 상세: `models/gemini-2.5-flash` → `gemini-2.5-flash` 변환 로직과, `generateContent`/`embedContent`가 없는 모델 제외 로직이 spec에서 직접 검증되지 않음 (diff가 잘려서 완전 확인 불가하나 현재 가시적인 테스트에는 없음).
- 제안:
  ```ts
  it('strips models/ prefix from resource name', async () => { ... });
  it('excludes models without generateContent or embedContent action', async () => { ... });
  it('classifies embedContent-only model as embedding type', async () => { ... });
  ```

---

### [INFO] `as unknown as T` 제거 — 타입 안전성 향상
- 위치: 다수 spec 파일
- 상세: `undefined as unknown as T`, `null as unknown as string` 등을 직접 `undefined`/`null`로 교체. TypeScript가 실제 타입을 검사하게 되어 Mock misuse를 컴파일 타임에 잡을 수 있음. 기능 변화 없음.

---

### [INFO] `PreviewLlmModelsDto` 검증 테스트 커버리지 우수
- 위치: `preview-llm-models.dto.spec.ts`
- 상세: 정상 케이스, 미지원 provider, apiKey 누락, URL scheme SSRF, max-length, azure/local baseUrl 필수 조건 등 13개 케이스가 체계적으로 커버됨. 크로스 필드 검증(azure는 baseUrl 필수)까지 포함되어 있어 DTO 레이어 품질이 높음.

---

### [INFO] `previewModels` 서비스 테스트 — 전반적으로 충실
- 위치: `llm.service.spec.ts`
- 상세: SSRF, 인증 에러 sanitization, timeout, AbortSignal 전달, factory 에러 surface, 캐시 미공유 등 핵심 시나리오 모두 커버. `jest.useFakeTimers()`를 finally로 복구하는 패턴도 격리성 유지.

---

## 요약

이번 변경의 핵심은 Google SDK 마이그레이션(`@google/generative-ai` → `@google/genai`), 하드코딩 모델 목록을 실시간 API 호출로 대체, `preview-models` 엔드포인트 추가다. `previewModels` 서비스 테스트와 DTO 검증 테스트는 SSRF·타임아웃·에러 sanitization까지 촘촘하게 작성되어 있어 신규 기능의 품질이 높다. 다만 SSRF 가드의 172.16.x.x 범위 미검증, 기존 `listModels` 경로의 timeout·에러 처리 테스트 미갱신, Google 클라이언트의 100개 상한과 prefix 제거·필터 로직의 단위 테스트 공백, 클라이언트 레벨의 AbortSignal 전달 미검증 등이 회귀 위험으로 남아 있다.

## 위험도

**MEDIUM** — 신규 기능 테스트는 우수하나 SSRF 가드 일부 범위 누락과 기존 경로의 회귀 테스트 공백이 존재함.