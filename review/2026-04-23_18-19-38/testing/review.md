## 발견사항

### [WARNING] `listModels` 에러 경로 미테스트 (Anthropic/Google)
- **위치**: `anthropic.client.spec.ts`, `google.client.spec.ts`
- **상세**: `AnthropicClient.listModels()`와 `GoogleClient.listModels()`가 이제 실제 API를 호출하는데, API 호출 실패(네트워크 오류, 401, 429) 케이스 테스트가 없음. 기존 hardcoded 목록 반환에서 live API 호출로 전환은 실패 가능성을 새로 도입한 것임.
- **제안**:
  ```typescript
  it('throws on API failure', async () => {
    client.client = {
      models: { list: jest.fn().mockRejectedValue(new Error('401 Unauthorized')) },
    };
    await expect(client.listModels()).rejects.toThrow();
  });
  ```

---

### [WARNING] `GoogleClient.embed()` 구현 변경 — 배치 처리 로직 미테스트
- **위치**: `google.client.ts` (embed 메서드), `google.client.spec.ts`
- **상세**: 기존에는 텍스트마다 개별 `embedContent()` 호출이었는데, 신 SDK에서는 배치 호출(`contents: texts`)로 변경됨. `(response.embeddings ?? []).map(e => e.values ?? [])` 매핑 로직이 새로 추가되었으나 테스트에서 `embedResult`만 stub하고 multi-text 배치 응답을 검증하는 케이스가 없음.
- **제안**: `texts` 배열 길이와 반환 `embeddings` 배열 길이가 일치하는지, 빈 배열 처리(`embeddings: undefined`)가 올바른지 테스트 추가 필요.

---

### [WARNING] `PreviewLlmModelsDto` — 내부 IP SSRF 방어 미테스트
- **위치**: `preview-llm-models.dto.spec.ts` (라인 ~48)
- **상세**: `file:///etc/passwd` 스킴 차단 테스트는 있으나, `http://192.168.1.1`, `http://169.254.169.254` (AWS metadata) 같은 내부 네트워크 IP는 `IsUrl({ protocols: ['http','https'] })`가 통과시킴. SSRF 완화가 스킴 레벨에서만 이루어지고 있음.
- **제안**: 현재 구현 한계를 테스트로 문서화하거나, `IsUrl({ allow_underscores: false, require_tld: true })` + 화이트리스트 검증 추가 및 그에 맞는 테스트 작성.

---

### [WARNING] `ModelCombobox` 프론트엔드 컴포넌트 — 테스트 없음
- **위치**: `frontend/src/components/llm-config/model-combobox` (diff에 미포함)
- **상세**: `llm-configs/page.tsx`에서 새 `ModelCombobox`를 사용하나 컴포넌트 spec 파일이 변경 목록에 없음. "모델 불러오기" 버튼 클릭, 로딩 상태, 에러 폴백(자유 입력), `chat` 모델 필터링 등 UX 로직이 테스트되지 않음.
- **제안**: `ModelCombobox.spec.tsx` 작성 — `previewModels` API 호출, 로딩/에러 상태, 자유 타이핑 fallback 케이스 포함.

---

### [WARNING] `sanitizeErrorMessage` 미지정 패턴 처리 미테스트
- **위치**: `llm.service.spec.ts` (previewModels describe 블록)
- **상세**: 401, 429, ECONNREFUSED 패턴은 테스트되어 있으나, 어떤 패턴에도 해당하지 않는 일반 에러(`"Some unexpected provider error"`)가 어떻게 처리되는지 — 원문 노출인지, 제네릭 메시지 대체인지 — 테스트가 없음.
- **제안**:
  ```typescript
  it('uses a generic message for unrecognized errors', async () => {
    mockClient.listModels.mockRejectedValue(new Error('weird internal error'));
    await expect(service.previewModels({ provider: 'openai', apiKey: 'k' }))
      .rejects.toMatchObject({
        response: expect.not.objectContaining({ message: 'weird internal error' })
      });
  });
  ```

---

### [INFO] `withTimeout` — 간접 테스트만 존재
- **위치**: `llm.service.ts` (private `withTimeout`), `llm.service.spec.ts`
- **상세**: `withTimeout`이 private이라 직접 테스트하지 않는 것은 합리적이나, `clearTimeout`이 정상 완료 케이스에서도 호출되는지(타이머 누수 방지) 검증하는 테스트가 없음. `jest.useFakeTimers()`를 활용해 30s 이전 정상 완료 시 timer가 정리되는지 확인 가능.

---

### [INFO] `as unknown as T` 제거 — `asyncIter` done case
- **위치**: `anthropic.client.spec.ts`, `google.client.spec.ts`, `openai.client.spec.ts`, `workflow-assistant-stream.service.spec.ts`
- **상세**: `{ value: undefined as unknown as T, done: true }` → `{ value: undefined, done: true }` 변경은 `AsyncIterator` 프로토콜상 완전히 올바름(`done: true`일 때 value는 `TReturn | undefined`). 타입 정확도 개선.

---

### [INFO] `@Throttle` 제한 — 단위 테스트 미포함 (예상된 범위)
- **위치**: `llm-config.controller.ts` (previewModels 엔드포인트)
- **상세**: `10req/60s` throttle이 단위 테스트에 없는 것은 컨트롤러 단위 테스트의 일반적 패턴에 부합. e2e 레벨 검증 권장.

---

### [INFO] `previewModels` — AbortSignal 미전달
- **위치**: `llm.service.ts`, `google.client.ts`
- **상세**: `withTimeout`이 Promise.race로 30s 타임아웃을 걸지만, 실제 HTTP 요청에 AbortSignal을 전달하지 않아 타임아웃 후에도 연결이 유지될 수 있음. 테스트는 통과하나 리소스 누수 가능성. 별도 이슈로 추적 권장.

---

## 요약

변경의 대부분은 불필요한 `as unknown as X` / `as any` 타입 단언 제거로, 테스트 코드의 타입 안정성을 실제 동작 제약에 맞게 올바르게 개선한 것이다. 신규 기능(`previewModels` 서비스 메서드, `preview-models` 엔드포인트)은 에러 sanitization, 타임아웃, 캐시 비사용 등 핵심 동작에 대한 포괄적인 단위 테스트가 추가되어 전반적으로 양호하다. `PreviewLlmModelsDto` 검증 테스트도 SSRF 스킴 차단을 포함해 잘 작성되었다. 주요 미흡 사항은 두 가지다: **live API 호출로 전환된 `listModels`의 에러 경로 미테스트**(특히 Anthropic/Google 클라이언트)와 **신규 `ModelCombobox` 프론트엔드 컴포넌트의 테스트 부재**. Google SDK 마이그레이션(`@google/generative-ai` → `@google/genai`)은 내부 스텁 구조까지 모두 업데이트되었으나, `embed()` 배치 처리 변경에 대한 회귀 테스트가 확인되지 않는다.

## 위험도

**MEDIUM** — 신규 live API 호출 경로(listModels)의 에러 처리 미검증 및 프론트엔드 신규 컴포넌트 미테스트가 주요 요인.