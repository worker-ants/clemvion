## 발견사항

### **[INFO]** `apiKey` 빈 문자열 허용 — DTO와 서비스 레이어 간 계약 분리 잔존
- **위치**: `preview-llm-models.dto.ts` `apiKey` 필드
- **상세**: `@IsString()` + `@MaxLength(500)` 만 선언되어 빈 문자열이 DTO 레벨을 통과함. `local` 프로바이더 이외의 경우 빈 apiKey 거부는 서비스 레이어에서만 처리되어, API 문서(`@ApiProperty` 설명)와 실제 400 응답 발생 지점이 불일치. Swagger 소비자는 빈 문자열로 422가 아닌 400을 받게 되는 이유를 schema만 보고는 알 수 없음.
- **제안**: `@ApiProperty.description`에 "local 프로바이더 이외는 서비스에서 빈 값 거부(400 `LLM_CREDENTIALS_REQUIRED`)" 명시. 기존 세 라운드 리뷰에서 반복 지적된 사항이며 현 범위에서 문서 수준 조치만으로 충분.

---

### **[INFO]** `listModels` 이중 응답 형태 허용 계약 고착 (W-12 잔존)
- **위치**: `llm-configs.test.ts` — `"falls back to the body itself when not enveloped"` 케이스
- **상세**: `(data?.data ?? data)` 패턴과 해당 폴백 테스트 케이스가 `listModels`와 `previewModels` 양쪽에 유지됨. RESOLUTION.md W-12에서 의도적으로 보류했으나, 이 이중 계약은 `apiClient` 인터셉터 중앙화 전까지 API 응답 형식의 단일 진실 소스가 없는 상태를 문서화 없이 영속화함. `previewModels`에는 폴백 케이스 테스트가 없어 두 함수 간 계약 표현이 비대칭.
- **제안**: 현 범위에서는 유지 허용. `previewModels`에도 non-envelope 케이스 테스트를 추가해 계약 비대칭 해소. 인터셉터 중앙화 시 두 폴백 케이스 모두 제거 목표로 삼을 것.

---

### **[INFO]** `useSavedConfig && configId` 이중 가드 — 분기 계약 가독성 저하
- **위치**: `model-combobox.tsx:60` (근사)
- **상세**: `useSavedConfig = Boolean(configId) && !trimmedKey`로 정의 후 `if (useSavedConfig && configId)` 로 재검사. `listModels` vs `previewModels` 분기 계약의 단일 진입점이 `useSavedConfig` 변수가 아닌 `configId` 재참조로 흐려짐. 세 라운드 리뷰에서 반복 지적됐으나 미조치.
- **제안**: `if (useSavedConfig)` 로 단순화. TypeScript narrowing 필요 시 non-null assertion 사용.

---

### **[INFO]** `baseUrl: undefined` 직렬화 계약 미명시
- **위치**: `model-combobox.tsx:52-56`, `llm-configs.test.ts` `previewModels` 검증
- **상세**: `trimmedBaseUrl ? trimmedBaseUrl : undefined`에서 `undefined` 직렬화 시 JSON 키 자체가 생략됨. 백엔드 DTO의 `@IsOptional()` 동작과 일치하나, 테스트에서 `baseUrl: undefined`를 `toHaveBeenCalledWith`로 고정해 "키 생략"을 암묵적 계약으로 검증. 의도는 올바르나 계약이 명시적이지 않음.
- **제안**: 현행 유지. 추가 설명 없음.

---

### **[INFO]** 하위 호환성 — Breaking Change 없음
- **상세**: 이번 변경은 `POST /llm-configs/preview-models` additive 추가이며, 기존 엔드포인트 경로·응답 스키마·에러 코드에 변경 없음. 컨트롤러 스펙이 `LlmService.previewModels`로의 위임 계약을 명시적으로 고정하고 있음. 정적 라우트(`preview-models`) 순서 조치(I-10) 반영 확인.

---

## 요약

세 라운드에 걸친 리뷰를 통해 API 계약의 핵심 위험 요소(Rate Limiting, SSRF, 서비스 파라미터 타입, apiKey/baseUrl trim, 정적 라우트 순서, 에러 테이블)가 모두 조치된 상태다. 현재 코드는 `POST /llm-configs/preview-models` 엔드포인트의 인증(`editor` 롤), 입력 검증(`@IsIn`, `@IsUrl`), 에러 응답 일관성(`LLM_CREDENTIALS_REQUIRED` 등) 측면에서 안정적이다. 잔존하는 사항은 모두 INFO 수준으로 — `apiKey` 빈 문자열 허용이 Swagger 문서에 미반영된 계약 분리, `listModels`의 이중 응답 형태 허용(의도적 보류), `useSavedConfig && configId` 이중 검사로 인한 가독성 저하 — 기능 정확성에는 영향이 없다.

## 위험도

**LOW**