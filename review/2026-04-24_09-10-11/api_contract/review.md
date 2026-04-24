### 발견사항

---

**[INFO]** `apiKey` 빈 문자열 허용 계약 — DTO vs 서비스 레이어 이중 경계
- **위치**: `preview-llm-models.dto.ts` `apiKey` 필드 / `llm.service.ts:previewModels()`
- **상세**: DTO는 `@IsString()` + `@MaxLength(500)` 만 적용하므로 `apiKey: ""` 가 422 없이 통과하고, 서비스 레이어에서 non-local 프로바이더에 대한 빈 값 거부가 HTTP 400으로 반환된다. 동일 위반이 레이어에 따라 422(DTO 검증 실패)와 400(서비스 실패)으로 다른 상태 코드를 반환하는 계약 불일치다. Swagger `description`에 `"local 프로바이더는 빈 문자열 허용"` 이 명시되어 있어 읽는 사람이 역으로 추론은 가능하나, 반환 코드 차이가 OpenAPI 스키마에 문서화되어 있지 않다.
- **제안**: `description`에 `"local 이외에는 서비스 레이어에서 빈 값을 거부하며 HTTP 400(코드 LLM_CREDENTIALS_REQUIRED)으로 반환됩니다"` 를 추가하거나, `@ValidateIf((dto) => !PROVIDERS_REQUIRING_BASE_URL.includes(dto.provider) || dto.provider !== 'local')` + `@IsNotEmpty()` 조합으로 DTO 레이어에서 일관되게 처리.

---

**[INFO]** `previewModels` fallback 테스트에 임시(interim) 계약 표시 누락
- **위치**: `frontend/src/lib/api/__tests__/llm-configs.test.ts` — `previewModels` → `"falls back to the body itself when not enveloped"` 케이스
- **상세**: `listModels`의 동일 케이스에는 `// TODO: response envelope 중앙화(axios 인터셉터) 적용 시 이 fallback 계약은 제거한다.` 주석이 붙어 있으나, `previewModels`의 fallback 케이스에는 없다. 두 함수 모두 `data?.data ?? data` 패턴을 사용하며 동일한 임시 계약이므로, 향후 인터셉터 중앙화 시 `previewModels` 케이스도 함께 제거 대상임을 명시해야 한다.
- **제안**: `previewModels`의 non-envelope fallback 케이스에도 `// TODO: remove after transform interceptor centralization` 주석 추가.

---

**[INFO]** `baseUrl` 조건부 필수 계약 — 잘 구현됨 (긍정적 확인)
- **위치**: `preview-llm-models.dto.ts:22-38`, `preview-llm-models.dto.spec.ts`
- **상세**: `@ValidateIf((dto) => PROVIDERS_REQUIRING_BASE_URL.includes(dto.provider) || dto.baseUrl !== undefined)` 패턴이 azure/local 필수 + 그 외 선택(단, 입력 시 검증) 계약을 한 필드 선언으로 올바르게 표현하고 있다. SSRF 방어(`file://` 스킴 차단), 빈 문자열 거부(`@IsNotEmpty`), 최대 길이(`@MaxLength(500)`), azure 누락·local 누락·빈 문자열 거부 케이스까지 spec 테스트로 모두 고정되어 있다. 이전 리뷰(W-9)가 완전히 해소된 상태다.

---

**[INFO]** 컨트롤러 spec의 `as unknown as LlmService` 캐스트 — 범위 내 수용 가능
- **위치**: `llm-config.controller.spec.ts:22-26`
- **상세**: 이전 배치 리뷰에서 지적된 `as never` 대신 `jest.Mocked<Pick<LlmService, ...>>` 타입 선언을 사용하고 있어 서비스 메서드 시그니처 drift를 컴파일 타임에 잡을 수 있다. 생성자 호출 시 `as unknown as LlmService` 는 DI 컨테이너를 우회하는 표준 NestJS 단위 테스트 패턴으로 허용 범위 내다.

---

**[INFO]** 하위 호환성 — Breaking Change 없음
- **상세**: `POST /api/llm-configs/preview-models` 신규 엔드포인트는 additive 추가이며, 기존 `GET /llm-configs/:id/models`, `POST /llm-configs/:id/test` 등 기존 엔드포인트의 경로·응답 스키마·에러 코드에 변경 없음. `listModels`/`previewModels` 프론트엔드 API 함수의 응답 언래핑 수정(`data?.data ?? data`)은 기존 버그 수정이며, 이 변경으로 호출자가 받는 타입이 올바르게 `ModelInfo[]`로 정정된다.

---

### 요약

이번 변경은 `POST /api/llm-configs/preview-models` 신규 엔드포인트에 대한 DTO·컨트롤러·프론트엔드 API 클라이언트 계약을 테스트로 고정한 작업이다. `@ValidateIf` 기반 조건부 baseUrl 필수 검증(W-9), SSRF 방어, Rate Limiting은 이전 RESOLUTION에 따라 모두 반영되었으며, 컨트롤러 spec이 위임 계약(캐시 미사용, 에러 전파)을 명시적으로 검증하는 점이 양호하다. 잔존하는 계약 이슈는 두 가지로, 첫째 `apiKey` 빈 문자열이 DTO(통과)와 서비스(거부)에서 다른 HTTP 상태 코드로 반환되는 점, 둘째 `previewModels`의 fallback 테스트에 임시 계약임을 표시하는 주석이 누락된 점이다. 두 가지 모두 기능 정확성에는 영향이 없다.

### 위험도
**LOW**