### 발견사항

---

**[WARNING] `ModelCombobox` 구현체가 리뷰 대상에서 누락됨**
- 위치: `frontend/src/app/(main)/llm-configs/page.tsx` import, `spec/2-navigation/6-config.md`
- 상세: `page.tsx`가 `@/components/llm-config/model-combobox`를 import하나, 해당 컴포넌트 파일은 diff에 포함되지 않았다. 스펙에 명시된 `type === 'chat'` 모델 필터링, "모델 불러오기" 버튼 동작, 수정 플로우에서 `configId` 유무에 따른 API 분기(`preview-models` vs `:id/models`) 등 핵심 UX 요구사항의 충족 여부를 검증할 수 없다.
- 제안: `model-combobox.tsx` 파일을 리뷰에 포함하거나 별도로 스펙 항목별 체크리스트를 확인해야 한다.

---

**[WARNING] `sanitizeErrorMessage` 메서드가 diff에 없음**
- 위치: `backend/src/modules/llm/llm.service.ts` — `previewModels` 메서드 내 `this.sanitizeErrorMessage(raw)` 호출
- 상세: 스펙 §5.5는 "apiKey는 로그·응답·캐시 어디에도 기록하지 않는다"고 명시한다. `sanitizeErrorMessage`가 기존 메서드라면 apiKey가 포함된 오류 메시지(`401 ... key=sk-xxx`)를 실제로 마스킹하는지 확인이 필요하다. 프로바이더 SDK가 오류 메시지에 apiKey를 포함하는 경우가 있다(예: OpenAI SDK `AuthenticationError`).
- 제안: `sanitizeErrorMessage` 구현에서 apiKey 패턴(`sk-[A-Za-z0-9]+`, Bearer 토큰 등)을 명시적으로 마스킹하고, 해당 케이스에 대한 테스트를 추가한다.

---

**[WARNING] Google 스트림 Usage Fallback 제거로 인한 회귀 가능성**
- 위치: `backend/src/modules/llm/clients/google.client.ts` — 구 `result.response` 집계 fallback 코드 삭제
- 상세: 기존 코드는 스트림 청크에 `usageMetadata`가 포함되지 않을 경우 `result.response`(집계 응답)에서 usage를 한 번 더 읽었다. 신 SDK(`@google/genai`)의 `generateContentStream`이 flat AsyncGenerator를 반환하면서 이 fallback이 제거되었다. 일부 Gemini 모델(특히 구형)은 마지막 청크에만 `usageMetadata`를 포함하지 않을 수 있으며, 그 경우 `usage.totalTokens === 0`이 되어 과금 모니터링·컨텍스트 관리에 영향을 줄 수 있다.
- 제안: 신 SDK에서도 스트림 종료 후 usage가 0으로 남는 케이스를 실제 모델로 검증하거나, 0일 때 경고 로그를 추가해 모니터링한다.

---

**[WARNING] Azure 프로바이더 `baseUrl` 필수값 검증이 DTO 레벨에서 누락**
- 위치: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts`
- 상세: 스펙은 "Azure/Local 프로바이더에 필수"라고 명시하나, DTO에서는 `@IsOptional()`로 처리되어 있다. Azure에 `baseUrl`을 빠뜨리면 factory에서 예외가 발생하고 `LLM_CONFIG_INVALID`로 반환되지만, 에러 메시지가 내부 구현에 의존한다. DTO 레벨 검증이 없어 API 문서(`Swagger`)의 `400 Bad Request` 이유가 불명확해진다.
- 제안: 커스텀 validator 또는 class-validator의 conditional validation으로 `provider === 'azure'`일 때 `baseUrl` 필수를 강제하거나, 최소한 `PreviewLlmModelsDto` spec 테스트에 해당 케이스를 추가한다.

---

**[INFO] `listModels` API 응답 unwrapping 수정**
- 위치: `frontend/src/lib/api/llm-configs.ts` — `(data?.data ?? data)`
- 상세: `TransformInterceptor`가 응답을 `{ data: [...] }`로 래핑하므로 기존 `data as ModelInfo[]`는 사실 `{ data: ModelInfo[] }`를 반환하고 있었다. 이번 수정이 올바른 fix다. `previewModels`도 동일한 패턴을 사용한다.
- 제안: 기존 `listModels` 호출자들이 이 변경 이전에 `data.data`를 별도로 접근하고 있었다면 중복 언래핑 버그가 있을 수 있다. 호출 사이트를 확인한다.

---

**[INFO] NestJS 라우트 순서 적절**
- 위치: `backend/src/modules/llm-config/llm-config.controller.ts`
- 상세: `@Post('preview-models')`가 `@Post(':id/test')` 이전에 위치해 있어 NestJS 라우트 매칭 순서 문제가 없다. `ParseUUIDPipe`가 붙은 `:id` 경로와의 충돌도 없다.

---

**[INFO] TypeScript type cast 정리**
- 위치: 다수 `*.spec.ts` 파일
- 상세: `as unknown as T`, `as any` 제거는 타입 안전성을 높이는 올바른 변경이다. Jest mock의 return 타입이 자동으로 추론되므로 기능상 동일하다.

---

**[INFO] `withTimeout` 구현의 타이머 누수 방지**
- 위치: `backend/src/modules/llm/llm.service.ts` — `withTimeout`
- 상세: `finally { clearTimeout(timer) }` 패턴으로 정상 완료 시 타이머 누수를 올바르게 방지한다. 테스트도 `jest.useFakeTimers()`로 30s 경계를 검증하고 있다.

---

**[INFO] `previewModels` 테스트 커버리지 충분**
- 위치: `backend/src/modules/llm/llm.service.spec.ts`
- 상세: 정상 경로, baseUrl 전달, 로컬 빈 apiKey, 비로컬 빈 apiKey 거부, 캐시 미사용 확인, 401/429/ECONNREFUSED sanitize, 30s timeout, factory 오류 등 스펙 §5.5의 주요 요구사항을 망라하고 있다.

---

### 요약

이번 변경의 핵심은 LLM Config 저장 전 폼 자격증명으로 모델 목록을 미리 조회하는 `preview-models` 엔드포인트 추가와, Google/Anthropic 클라이언트의 하드코딩된 목록을 실시간 API 호출로 전환한 것이다. 백엔드 구현(DTO 유효성 검사, Rate Limit, Timeout, 에러 sanitize, 테스트)은 스펙 §5.5를 대체로 충실히 따르고 있다. 그러나 핵심 프론트엔드 구성요소인 `ModelCombobox`가 리뷰 대상에서 빠져 있어 스펙의 `chat` 타입 필터링·수정 플로우 분기 요건의 충족 여부를 확인할 수 없고, `sanitizeErrorMessage`의 apiKey 마스킹 실효성, Google 스트림 usage fallback 제거로 인한 회귀 가능성, Azure의 `baseUrl` 필수 검증 누락이 미결 사항으로 남는다.

### 위험도

**MEDIUM**