# Code Review Resolution — LLM listModels 실시간화 (Anthropic SDK + @google/genai 마이그레이션)

리뷰 보고서: [Batch 1 SUMMARY.md](./SUMMARY.md), [Batch 2 SUMMARY](../2026-04-23_18-23-15/SUMMARY.md)

전체 위험도 Batch1 MEDIUM → Batch2 LOW → **후속 작업으로 보류 항목 추가 해소 (2026-04-24)**.

## Batch 1 — 마이그레이션 직후 리뷰

### W-1. SSRF via `baseUrl` → ✅ 조치

`llm.service.ts`에 `isPrivateHost()` 헬퍼 추가 (loopback·RFC1918·169.254 link-local IP 리터럴 차단). `previewModels`에서 `provider !== 'local'` 인 경우 차단. `local` 프로바이더는 자체 Ollama/vLLM 런타임을 localhost에 띄우는 게 정상 사용 사례이므로 예외 처리.

- 파일: `backend/src/modules/llm/llm.service.ts`
- 테스트: 127.0.0.1 / 169.254.169.254 / 10.0.0.5 차단 + local localhost 허용 4건 추가

### W-2. Google `embed()` 배치 호출 → ✅ 검증 후 유지

`@google/genai` SDK 타입 정의 확인: `EmbedContentParameters.contents: ContentListUnion` 은 string[] 배치를 공식 지원. 응답 `embeddings: ContentEmbedding[]` 은 요청 순서 보장. 구 SDK의 N회 순차 호출 대비 왕복 1/N로 성능 향상.

### W-3. 스트리밍 usage fallback 제거 → ⏭️ 검증 후 유지

`@google/genai` 문서 기준 스트림의 **마지막 청크에 usageMetadata 포함**. 구 SDK는 `{stream, response}` 분리 구조였기에 fallback이 필요했으나 신 SDK는 flat AsyncGenerator + 청크에 usage 포함이 계약. 테스트도 이에 맞춰 갱신 ("picks up usageMetadata from a later chunk").

### W-4. `withTimeout` 이 HTTP 요청을 취소하지 않음 → ✅ 후속 작업으로 해소 (2026-04-24)

`LLMClient.listModels(signal?: AbortSignal)` 시그니처 추가. 각 provider 클라이언트가 SDK native abort 옵션으로 signal 전파:
- OpenAI/Azure/Local: `this.client.models.list({ signal })`
- Anthropic: `this.client.models.list(undefined, { signal })`
- Google: `this.ai.models.list({ config: { abortSignal: signal } })`

`llm.service.ts` `withTimeout` 도 `(signal) => client.listModels(signal)` 패턴으로 리팩터. Promise.race 와 AbortController 조합으로 (1) 시간 보장 + (2) 소켓 정리 모두 확보. 테스트 "aborts the client call via AbortSignal on timeout (socket cleanup)" 로 signal 전파 검증.

### W-5. Factory 에러 로그에 apiKey 포함 가능 → ⏭️ 검토 후 유지

`llm-client.factory.ts`의 모든 throw 메시지는 하드코딩된 문자열 ("Azure OpenAI requires a base URL", "Unsupported LLM provider: ..." 등)이며 `options.apiKey`를 에러 문자열에 포함하지 않는다. SDK 생성자는 lazy-init 이라 생성자에서 키를 사용하지 않으므로 여기서 apiKey가 에러 메시지로 새어나갈 경로가 없다. sanitize 적용 시 오히려 "Azure OpenAI requires a base URL" 같은 유용한 메시지가 소실됨.

### W-6. `GET /:id/models` 에도 sanitize + timeout 필요 → ✅ 조치

`llm.service.ts`의 `listModels(configId, workspaceId)` 도 `withTimeout(30s)` + `sanitizeErrorMessage` + `BadRequestException(LLM_MODEL_LIST_FAILED)` 로 감싸 preview 엔드포인트와 동일 에러 처리 계약.

### W-7. 스트림 `AsyncIterable<unknown>` 강제 캐스팅 → ✅ 조치

`@google/genai` 타입 `AsyncGenerator<GenerateContentResponse>` 을 `AsyncIterable<unknown>` 으로 내린 뒤 청크를 구조 분해 타입으로 재해석. 런타임 계약은 spec 에 문서화되어 있고 타입 안전성은 mock 테스트가 보증.

### W-8. 구 패키지 `@google/generative-ai` 공존 여부 → ✅ 조치

`pnpm remove @google/generative-ai` 로 제거 완료.

### W-9. Azure `baseUrl` 필수 DTO 검증 → ✅ 후속 작업으로 해소 (2026-04-24)

`PreviewLlmModelsDto.baseUrl` 에 `@ValidateIf` 적용. `provider === 'azure'`·`'local'` 이거나 사용자가 baseUrl 을 전달했을 때만 validator 가 실행되도록 해, **Azure/Local 필수 + 나머지 선택** 계약을 한 필드 선언으로 표현. 4건 테스트 추가: azure baseUrl 누락, local baseUrl 누락, 빈 문자열 거부, 그 외 프로바이더는 baseUrl 없이도 통과.

### W-10. ThrottlerModule 전역 등록 확인 → ✅ 확인 완료

`app.module.ts`에 이미 `ThrottlerModule.forRoot()` + `APP_GUARD` 로 `ThrottlerGuard` 등록 존재.

### W-11. `listModels()` 에러 경로 테스트 추가 → ✅ 조치

- `anthropic.client.spec.ts`: "propagates errors from the SDK models.list call" (401 Unauthorized)
- `google.client.spec.ts`: "propagates errors from the SDK list call" (429 Too Many Requests)

### W-12. `integration-oauth.service.ts:303` `JSON.parse` → ⏭️ 범위 외

본 PR 범위 밖(integration OAuth 자격증명 처리). 별도 이슈로 이관 권장.

### W-13. Gemini 비자명 주석 대거 삭제 → ✅ 조치

`google.client.ts` 재작성 시 주요 제약 주석 모두 보존.

### W-14. 타입 단언 일괄 정리 혼재 → ⏭️ 범위 외

리뷰 오케스트레이터가 전체 stash 를 한 batch 에 포함해 보고한 false positive. 본 PR 커밋은 LLM listModels 관련 파일만 포함한다.

### W-15. `sanitizeErrorMessage` 존재 확인 → ✅ 확인 완료

`llm.service.ts` 에 기존 구현 유지 및 사용 중.

### W-16. `listModels` 응답 언래핑 변경 영향 → ✅ 조치

`data?.data ?? data` 2단 fallback 으로 envelope·raw 배열 양쪽 모두 허용. 프론트 테스트 2케이스 모두 검증.

### W-17. `ModelCombobox` 테스트 누락 → ✅ 확인 완료 (false positive)

`frontend/src/components/llm-config/__tests__/model-combobox.test.tsx` 이미 존재. 후속 작업에서 isPending / 빈 목록 / azure baseUrl 누락 / retry 실패 시 기존 목록 유지 / disabled prop 전파 등 케이스를 추가해 총 15개 테스트로 확장.

### W-18. Google pager 상한 없음 → ✅ 조치

`google.client.ts`의 `listModels()` 에 `MAX_MODELS = 100` 상한 추가.

---

## Batch 2 — RESOLUTION 적용 후 재리뷰

### W-1 (B2). 에러 mock 동기 throw → ✅ 후속 작업으로 해소 (2026-04-24)

`model-combobox.test.tsx` 의 에러 케이스를 `mockRejectedValue` + `Object.assign(new Error(), ...)` 패턴으로 단순화. 이전 `Object.create` 2단 패턴 제거.

### W-2 (B2). `onError` 에서 `setModels([])` 초기화 → ✅ 조치

재시도 실패 시 이전에 로드된 모델 목록을 유지하도록 `setModels([])` 제거. 테스트 "keeps previously loaded models visible when a retry fails" 로 검증.

### W-3 (B2). `onMutate` 부재 → ✅ 조치

`onMutate: () => setErrorMessage(null)` 추가.

### W-4 (B2). `useSavedConfig && configId` 이중 검사 → ⏭️ 유지

TS narrowing 안정성을 위해 명시적 재확인 유지.

### W-5 (B2). Verbose ternary → ✅ 조치

`trimmedBaseUrl ? trimmedBaseUrl : undefined` → `trimmedBaseUrl || undefined`.

### W-6~15 (B2). 기타 테스트 개선 → ✅ 후속 작업으로 부분 해소 (2026-04-24)

- `model-combobox.test.tsx`: isPending 상태, 빈 모델 목록 UI, azure baseUrl 누락, retry 시 기존 목록 유지, disabled prop 전파 케이스 추가 (총 15개 테스트)
- `llm-configs.test.ts`: previewModels fallback 케이스, API 실패 케이스 추가. `afterEach` 중복 제거. W-12 중앙화 TODO 주석 추가 (총 6개 테스트)
- `llm-config.controller.spec.ts` 의 `as never` 타입 단언은 서비스 전체 mock 타입 정의가 필요해 이번 범위에서는 유지.

---

## 검증

- Backend: `pnpm lint` clean, `pnpm test` **1686 passed** (+5 신규 — DTO conditional validation 4건 + AbortSignal 전파 1건), `pnpm build` clean
- Frontend: `pnpm lint` clean, `pnpm test` **1055 passed** (+8 신규 — ModelCombobox 5건 + llm-configs API 3건), `pnpm build` clean
- Spec / 사용자 문서 동기화 완료

## 미조치 항목 (확인된 범위 외)

| 항목 | 사유 |
|------|------|
| W-5 Batch1 | 팩토리 에러는 사용자 입력을 포함하지 않아 sanitize 불필요, UX 친화 메시지 유지 |
| W-12 Batch1 | integration-oauth JSON.parse — 본 PR 범위 밖 |
| W-14 Batch1 | 리뷰 오케스트레이터 false positive |
| W-1/4 Batch2 | 기능 영향 없는 스타일 (현재 동작 문제 없음) |
