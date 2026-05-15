## 발견사항

---

### `llm.service.spec.ts`

- **[WARNING]** `sanitizeErrorMessage` 의 다른 분기가 `previewModels` 에서 테스트되지 않음
  - 위치: `previewModels describe` 블록
  - 상세: 401/Unauthorized만 검증. 403, 404, 429, timeout, ECONNREFUSED, ENOTFOUND 분기는 `testConnection` 테스트에만 있고 `previewModels` 에서는 누락
  - 제안: 최소한 429(Rate limit), timeout 케이스를 `previewModels` 에도 추가 — 두 경로가 같은 `sanitizeErrorMessage`를 쓰지만 예외 처리 경로(throw vs return)가 달라 독립 확인 필요

- **[WARNING]** async 함수에 `mockImplementation(() => { throw ... })` 사용 (factory error 테스트)
  - 위치: `should surface factory errors` 케이스
  - 상세: `clientFactory.create`는 동기 함수이므로 이 패턴 자체는 문제없으나, `listModels` 에러 케이스(`mockRejectedValue`)와 일관성 없이 혼용됨. 향후 `create`가 async로 변경될 경우 테스트가 묵묵히 통과하지 않을 수 있음
  - 제안: 동기 throw는 현재 구현상 맞으나, 주석으로 의도 명시 권장

- **[INFO]** `anthropic`, `google` 프로바이더에서 빈 apiKey 거부 확인 누락
  - 위치: `should reject empty apiKey for non-local providers`
  - 상세: `openai` 케이스 하나만 검증. spec상 `local` 외 모두 적용되므로 `anthropic`, `azure` 케이스를 추가하면 회귀 보호 강화
  - 제안: `it.each([['anthropic'], ['google'], ['azure']])` 로 파라미터화

---

### `preview-llm-models.dto.spec.ts`

- **[WARNING]** `apiKey` 가 `undefined` (누락)인 경우 검증 없음
  - 위치: 전체 spec
  - 상세: DTO에 `@IsOptional()` 없이 `@IsString()`만 있으므로 `apiKey` 필드 자체가 없으면 유효성 검사 실패해야 하는데, 이 케이스가 없음. `apiKey: ''` (빈 문자열) 허용 케이스와 구별 필요
  - 제안: `await expectValidationError({ provider: 'openai' }, 'apiKey')` 케이스 추가

- **[INFO]** `baseUrl`이 빈 문자열일 때 동작 미검증
  - 위치: baseUrl 관련 케이스
  - 상세: 빈 문자열 `baseUrl: ''`은 `@IsOptional()` + `@IsString()` 조합에서 통과하지만, 서비스 레이어의 `baseUrl?.trim() ? baseUrl : undefined` 정규화와 일치하는지 DTO 레벨 테스트 없음

---

### `model-combobox.test.tsx`

- **[WARNING]** `configId` 있고 `apiKey`도 있는 케이스(수정 플로우에서 키 재입력) 미검증
  - 위치: 전체 spec
  - 상세: `useSavedConfig = Boolean(configId) && !apiKey.trim()` 로직에 따라 이 경우 `previewModels`로 분기해야 하는데 해당 분기 테스트 없음. spec에 "수정 플로우: API Key 재입력한 경우 미리보기 엔드포인트 사용"이라고 명시되어 있음
  - 제안: `configId="existing-uuid"` + `apiKey="new-key"` → `previewModels` 호출 케이스 추가

- **[WARNING]** error mock이 `mockRejectedValue` 대신 synchronous throw 사용
  - 위치: `shows a sanitized error message` 케이스
  - 상세: `mutationFn`이 `async`이므로 동기 throw는 async wrapper에 의해 rejection으로 변환되어 현재는 동작하지만, `mockRejectedValue`가 의미상 더 정확하고 실제 axios 에러 응답 형태와 일치
  - 제안: `vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(...)` 로 변경

- **[INFO]** `loadMutation.isSuccess && chatModels.length === 0` 상태(모델 없음 메시지) 미검증
  - 위치: 전체 spec
  - 상세: 빈 배열 반환 후 "사용 가능한 모델이 없어요" 텍스트가 실제로 렌더되는지 확인하는 케이스 없음

- **[INFO]** `datalist option` 쿼리를 `document.querySelectorAll`로 직접 접근
  - 위치: `renders chat-only options` 케이스
  - 상세: Testing Library 원칙에서 벗어남. `<datalist>`는 직접 렌더 확인이 어려운 한계가 있어 현재 접근 방식이 불가피하나, `aria-autocomplete="list"` 연결이 실제로 브라우저에서 작동하는지는 e2e 테스트로 보완 필요

---

### `llm-configs.ts` (API 클라이언트)

- **[WARNING]** `listModels`의 응답 언래핑 수정(`data?.data ?? data`)에 대한 단위 테스트 없음
  - 위치: `listModels` 함수
  - 상세: 이 수정은 기존 동작의 버그 픽스인데, API 클라이언트 레이어 자체에 대한 테스트가 없어 회귀 감지 불가. 컴포넌트 테스트는 `llmConfigsApi.listModels`를 통째로 mock하므로 이 코드 경로를 통과하지 않음

---

### `llm-config.controller.spec.ts`

- **[INFO]** `@Roles('editor')` 가드 동작 미검증 (단위 테스트 한계)
  - 위치: 전체 spec
  - 상세: 컨트롤러 단위 테스트 특성상 가드를 테스트하지 않는 것은 일반적이나, 기존 `testConnection`은 `@Roles` 없이 열려 있고 `previewModels`는 `editor` 이상이어야 하므로 통합/e2e 테스트에서 권한 검증이 필요함

---

## 요약

전체적으로 테스트 커버리지 수준이 양호하다. 백엔드 서비스의 핵심 경로(캐시 우회, 자격증명 검증, 에러 sanitize)와 프론트엔드 컴포넌트의 주요 분기(create/edit flow, 버튼 활성화 조건, 모델 필터링)가 잘 커버되어 있으며, DTO 유효성 검사 테스트도 주요 케이스를 갖추고 있다. 주요 갭은 `previewModels` 에러 sanitize의 부분적 커버리지(401만 검증), `configId+apiKey` 동시 존재 케이스 미검증, `listModels` API 클라이언트 수정에 대한 테스트 부재다. 이 갭들이 잠재적 회귀를 일으킬 수 있으나 critical한 수준은 아니다.

## 위험도

**LOW**