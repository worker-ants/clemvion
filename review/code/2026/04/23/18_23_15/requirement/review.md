## 발견사항

### **[WARNING]** `model-combobox.test.tsx` — `shows a sanitized error message` 테스트의 에러 mock 방식
- **위치**: `model-combobox.test.tsx`, 마지막 it 블록
- **상세**: `mockImplementation(() => { throw ... })`으로 동기 throw를 사용하고 있으나, `mutationFn`이 `async`여서 async wrapper가 이를 rejection으로 변환해 현재는 동작함. 실제 axios 에러는 비동기 reject이므로 `mockRejectedValue`가 구현 의도에 더 부합하며, 이후 mock 대상이 async 함수로 변경될 경우 테스트가 묵묵히 통과할 위험이 있음.
- **제안**: `mockImplementation(() => { throw ... })` → `mockRejectedValue(Object.assign(...))`으로 변경.

---

### **[WARNING]** `llm-configs.test.ts` — `previewModels` non-envelope 폴백 케이스 미검증
- **위치**: `frontend/src/lib/api/__tests__/llm-configs.test.ts`, `previewModels describe`
- **상세**: `listModels`는 "unwraps envelope"와 "falls back to the body itself" 두 케이스를 모두 검증하는 반면, `previewModels`는 enveloped 케이스만 테스트함. 두 함수 모두 `data?.data ?? data` 패턴을 사용한다면 `previewModels`의 폴백 경로도 동일하게 계약이 고정되어야 함.
- **제안**: `previewModels describe`에 `data` 자체가 배열인 non-envelope 케이스 추가.

---

### **[WARNING]** `canLoad` 내 `PROVIDERS_REQUIRING_BASE_URL` 검사가 `apiKey` 조건과 독립적으로 분리됨
- **위치**: `model-combobox.tsx`, `canLoad` useMemo
- **상세**: `azure`는 `PROVIDERS_REQUIRING_BASE_URL`에 포함되어 baseUrl 없으면 false를 반환하지만, baseUrl이 있으면 그 이후에 `providerRequiresApiKey('azure') → true` 조건을 거쳐 apiKey도 요구됨. 테스트에는 `provider="openai"` + `apiKey=""` 케이스만 있고, `provider="azure"` 처럼 두 조건이 동시에 걸리는 케이스가 미검증임. 로직 자체는 올바르나 회귀 안전망 부재.
- **제안**: `it("disables the load button when azure provider has baseUrl but missing apiKey")` 케이스 추가.

---

### **[INFO]** `model-combobox.tsx` — `useSavedConfig && configId` 이중 검사 잔존
- **위치**: `model-combobox.tsx:44-47`
- **상세**: `useSavedConfig = Boolean(configId) && !trimmedKey`이므로 `if (useSavedConfig && configId)`의 `&& configId`는 항상 참인 중복 조건. RESOLUTION.md에서 조치 목록에 포함되지 않아 남아 있음. 동작에는 영향 없으나 가독성을 떨어뜨림.
- **제안**: `if (useSavedConfig && configId)` → `if (useSavedConfig)`로 단순화.

---

### **[INFO]** `model-combobox.test.tsx` — `loadMutation.isSuccess && chatModels.length === 0` 상태 미검증
- **위치**: `model-combobox.test.tsx` 전체
- **상세**: `previewModels`가 빈 배열을 반환할 때 컴포넌트가 `t("llmConfigs.noModelsFound")` 메시지를 렌더하는 경로가 테스트되지 않음. `model-combobox.tsx`의 렌더 분기 중 한 가지가 완전히 누락된 상태.
- **제안**: `mockResolvedValue([])` + 로드 후 `noModelsFound` i18n 키(또는 해당 텍스트) 렌더 확인 케이스 추가.

---

### **[INFO]** `llm-config.controller.spec.ts` — `previewModels` 외 컨트롤러 메서드 부재
- **위치**: `llm-config.controller.spec.ts` 전체
- **상세**: 이번 spec 파일은 `previewModels` 3개 케이스만 포함하며 `findAll`, `create`, `setDefault` 등 기존 메서드에 대한 테스트가 없음. 별도의 controller spec이 존재한다면 문제없으나, 이 파일이 유일한 컨트롤러 테스트라면 `previewModels` 추가로 인한 기존 엔드포인트 회귀를 감지할 수 없음.
- **제안**: 기존 컨트롤러 스펙과 이 파일의 관계를 확인 후, 필요 시 merge하거나 별도 파일로 분리 명시.

---

## 요약

핵심 요구사항인 생성/수정 플로우 분기(`previewModels` vs `listModels`), chat 모델 필터링, apiKey/baseUrl trim, local/azure 프로바이더별 필드 필수 조건, 에러 메시지 표시는 모두 `model-combobox.tsx`에 올바르게 구현되어 있으며 대응하는 테스트도 갖춰져 있다. RESOLUTION.md에 기재된 주요 조치(I-1 local baseUrl 가드, W-6 trim, W-8 configId+apiKey 케이스, I-7 testid)가 실제 코드에 반영된 것도 확인된다. 다만 `previewModels`의 non-envelope 폴백 테스트 누락, `azure` 프로바이더 버튼 비활성화 케이스 미검증, "모델 없음" 렌더 상태 미검증 등 테스트 계약의 빈 구간이 남아 있어, 향후 API 응답 포맷 변경이나 프로바이더 추가 시 회귀 감지가 불완전할 수 있다.

## 위험도

**LOW**