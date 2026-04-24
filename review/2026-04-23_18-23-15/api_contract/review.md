## 발견사항

### **[INFO]** `listModels` 응답 계약이 두 가지 형태를 허용함 (W-12 잔존)
- **위치**: `frontend/src/lib/api/__tests__/llm-configs.test.ts` — `listModels` describe
- **상세**: 테스트가 `{data: {data: [...]}}` (envelope)과 `{data: [...]}` (direct array) 두 가지 응답 형태를 모두 통과시키는 것을 계약으로 고정함. 이는 RESOLUTION.md W-12에서 의도적으로 채택한 접근이지만, API 클라이언트 레이어의 응답 계약이 여전히 모호한 상태임. 서버 측 transform interceptor의 동작이 일관화되기 전까지 이 fallback 분기는 잠재적 silent bug 온상으로 남음.
- **제안**: 현 범위에서는 유지. 단, `apiClient` 인터셉터 중앙화 시 해당 테스트의 "falls back to the body itself when not enveloped" 케이스 제거를 목표로 삼을 것.

---

### **[INFO]** `useSavedConfig && configId` 이중 검사로 인한 계약 의도 모호화
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:60`
- **상세**: `useSavedConfig = Boolean(configId) && !trimmedKey`로 이미 `configId` 존재 여부를 포함함에도 `if (useSavedConfig && configId)`로 재검사. TypeScript 타입 narrowing 목적이라면 의도가 코드에서 드러나지 않아, listModels/previewModels 분기 계약을 읽는 사람에게 혼란을 줄 수 있음.
- **제안**: `if (useSavedConfig)` 로 단순화하거나, narrowing 목적임을 주석으로 명시.

---

### **[INFO]** `baseUrl: undefined` 직렬화 동작 계약 미명시
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:52-57`, `model-combobox.test.tsx` 내 `previewModels` 검증
- **상세**: `baseUrl: trimmedBaseUrl ? trimmedBaseUrl : undefined`에서 `undefined` 값은 JSON 직렬화 시 키가 완전히 생략됨. 테스트는 `baseUrl: undefined`를 `toHaveBeenCalledWith`로 검증해 의도는 확인되나, 실제 HTTP 요청 바디에서 `baseUrl` 키 자체가 누락된다는 사실이 계약상 명시적이지 않음. 백엔드 DTO의 `@IsOptional()` 동작과는 일치하나, 혼동 여지가 있음.
- **제안**: 현재 동작은 올바름. 유지.

---

### **[INFO]** 하위 호환성 — Breaking Change 없음
- **상세**: 이번 변경(RESOLUTION 적용 후)은 신규 `POST /llm-configs/preview-models` 엔드포인트의 additive 추가이며, 기존 엔드포인트 경로·응답 스키마·에러 코드에 변경 없음. 컨트롤러 스펙이 서비스 위임 계약(`LlmService.previewModels`로 DTO 전달)을 명시적으로 고정하고 있음.

---

## 요약

RESOLUTION 적용 후의 코드는 API 계약 관점에서 이전 리뷰의 주요 지적 사항(rate limiting 추가, 서비스 파라미터 타입 강화, 정적 라우트 순서 조정, apiKey/baseUrl trim)이 모두 반영되었다. 잔존하는 계약 이슈는 `listModels`의 응답 envelope 이중 허용(W-12 의도적 보류)과 `useSavedConfig && configId` 이중 검사로 인한 가독성 저하 두 가지이며, 둘 다 기능 정확성에는 영향이 없다. 프론트엔드 API 클라이언트 테스트(`llm-configs.test.ts`)가 `previewModels`/`listModels` 양 경로의 요청 URL·바디·응답 언래핑 계약을 명시적으로 고정하여 회귀 보호를 갖춘 상태다.

## 위험도
**LOW**