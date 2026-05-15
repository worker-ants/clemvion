### 발견사항

- **[WARNING]** `GET /api/llm-configs/:id/models` 에 throttle 추가 (10/60s)
  - 위치: `llm-config.controller.ts` — `@Get(':id/models')`
  - 상세: 기존에 rate limit 없이 호출하던 클라이언트가 429를 받을 수 있음. 새 엔드포인트와 동일한 제한이 기존 경로에 소급 적용됨.
  - 제안: 클라이언트 측 재시도 로직 유무 확인. 제한 수치(10회/60s)가 정상 UX 시나리오에서 충분한지 검증 필요.

- **[WARNING]** Anthropic/Google `listModels()` — 하드코딩 목록 → 라이브 API 호출로 교체
  - 위치: `anthropic.client.ts`, `google.client.ts`
  - 상세: 기존에는 반환 모델 ID가 고정되어 있었으나 이제 프로바이더 API 응답에 따라 달라짐. 기존에 저장된 `defaultModel` 값이 새 목록에 없을 수 있음(모델 deprecated 등). 또한 라이브 호출이므로 API 키가 유효하지 않은 설정에서는 `GET /api/llm-configs/:id/models`가 새로운 실패 모드를 보임.
  - 제안: 저장된 `defaultModel` 값이 목록에 없더라도 UI가 자유 입력으로 fallback하는지 확인. 프론트엔드 `ModelCombobox`의 fallback 동작 명시 필요.

- **[WARNING]** `PreviewLlmModelsDto` 정의가 diff에 포함되지 않음
  - 위치: `llm-config.controller.ts` — `@ApiBody({ type: PreviewLlmModelsDto })`
  - 상세: `apiKey` 필드에 대한 최대 길이, `@IsString`, `@IsUrl` 등 입력 검증 데코레이터를 확인할 수 없음. 특히 `baseUrl`에 대한 DTO 수준 검증 없이 서비스 레이어에서만 SSRF 가드를 수행하는 구조임.
  - 제안: `PreviewLlmModelsDto`에 `@IsUrl()` + `@MaxLength()` 등 Swagger 문서화와 함께 DTO 수준 검증 추가 권장.

- **[INFO]** `POST /api/llm-configs/preview-models` 신규 엔드포인트 추가 — 순수 additive
  - 위치: `llm-config.controller.ts` L149~, `llm.service.ts`
  - 상세: 기존 경로와 충돌 없음 (`ParseUUIDPipe`가 `preview-models` 문자열을 거부하므로 `:id` 라우트와 분리). 인가(`editor`), rate limit, 30s timeout, AbortSignal 전파, SSRF 가드가 모두 구현되어 있음. `apiKey`가 로그·캐시·응답에 기록되지 않음은 spec §5.5와 일치.

- **[INFO]** `DELETE /api/llm-configs/:id` — 캐시 삭제 순서 변경 (DB 삭제 후 캐시 해제)
  - 위치: `llm-config.controller.ts` L227~
  - 상세: 이전에는 캐시 선삭제 → DB 삭제였으나, DB 삭제 실패 시 캐시 불일치 버그가 있었음. 순서 변경은 원자성 측면에서 올바른 방향. HTTP 응답(204 No Content)은 변경 없음.

- **[INFO]** 프론트엔드 `listModels` 응답 파싱 버그 수정
  - 위치: `frontend/src/lib/api/llm-configs.ts`
  - 상세: `data as ModelInfo[]` → `(data?.data ?? data) as ModelInfo[]`. `TransformInterceptor`가 배열을 `{ data: [...] }` 로 래핑하므로 이전 코드는 타입 불일치 버그. API 계약 자체는 변경 없고 클라이언트 버그 수정.

- **[INFO]** Google SDK 마이그레이션 (`@google/generative-ai` → `@google/genai`)
  - 위치: `google.client.ts`
  - 상세: SDK 교체로 `listModels()` 동작이 하드코딩 → 라이브 API로 전환. 내부 구현 변경이며 LLMClient 인터페이스 계약(`listModels(signal?: AbortSignal): Promise<ModelInfo[]>`)은 유지됨.

---

### 요약

이번 변경의 API 계약 핵심은 `POST /api/llm-configs/preview-models` 신규 엔드포인트 추가(순수 additive)와 Anthropic/Google `listModels()`의 라이브 API 전환이다. 신규 엔드포인트는 SSRF 가드·rate limit·권한 체계가 모두 갖춰져 있고, 기존 경로와 충돌이 없다. 주의할 점은 기존 `GET /api/llm-configs/:id/models`에 소급 적용된 throttle과, 모델 목록이 라이브화되면서 저장된 `defaultModel`이 유효하지 않을 수 있는 경우이며, `PreviewLlmModelsDto` 검증 강도는 diff 외부 파일이라 직접 확인이 필요하다.

### 위험도
**LOW**