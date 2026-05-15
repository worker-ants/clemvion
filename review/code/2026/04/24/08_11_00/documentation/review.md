## 발견사항

### [WARNING] `llm.service.ts` - SSRF 완화 주석 블록이 잘못된 위치에 배치됨
- **위치**: `llm.service.ts` — `previewModels()` 메서드 종료 후, `withTimeout()` 정의 직전
- **상세**: SSRF 완화를 설명하는 주석 블록이 파일 상단에 정의된 `isPrivateHost()` 함수가 아닌, `previewModels()` 메서드와 `withTimeout()` 메서드 사이에 고아처럼 배치되어 있음. 이는 주석이 묘사하는 대상 함수와 분리되어 독자 혼란을 유발함.
- **제안**: SSRF 주석은 `isPrivateHost()` 함수 정의 바로 위로 이동하고, `withTimeout()` 위에는 타임아웃 관련 주석만 남길 것.

---

### [WARNING] `google.client.ts` - Gemini API 비표준 동작 설명 주석 대거 삭제됨
- **위치**: `google.client.ts` — `buildContents()`, `sanitizeGeminiSchema()`, `stream()` 전반
- **상세**: 다음 항목들의 설명 주석이 제거됨:
  - `role: 'function'` 사용 이유 (`user` role에 functionResponse 넣으면 400 반환)
  - `thoughtSignature` echo 요구사항 (2.5+ 모델 대화 연속성)
  - `sanitizeGeminiSchema` 의 존재 이유 (OpenAPI 확장 키워드 필터링)
  - 스트림 종료 후 aggregated response fallback 제거 이유
  - `ObjectSchema.properties` 빈 경우 null 반환 이유
  - 이 모두는 "왜(WHY)"가 명백하지 않은 Gemini API 특유의 제약들
- **제안**: SDK 마이그레이션으로 일부 맥락이 변경되었더라도, Gemini 특유의 400 에러 케이스나 필수 echo 동작 등 비표준 제약은 짧게라도 주석으로 보존하는 것이 권장됨.

---

### [WARNING] `LlmClientInterface.listModels` - Breaking change에 대한 하위호환성 설명 부재
- **위치**: `llm-client.interface.ts:107-110`
- **상세**: `listModels()` 시그니처에 `signal?: AbortSignal`이 추가됨. JSDoc은 signal의 용도를 설명하지만, 기존 구현체(커스텀 클라이언트 확장 시)에 미치는 영향(선택적 파라미터이므로 하위호환 유지)을 명시하지 않음.
- **제안**: JSDoc에 `@param signal` 태그를 추가하거나, 선택적임을 명시. 기존 구현체는 파라미터 무시 가능함을 한 줄로 언급 권장.

---

### [INFO] `llm-config.controller.ts` - `@ApiBody` 데코레이터 누락
- **위치**: `llm-config.controller.ts` — `previewModels()` 엔드포인트
- **상세**: `POST /preview-models` 엔드포인트에 `@ApiOperation`, `@ApiOkWrappedResponse` 등은 있으나 요청 바디 스키마를 문서화하는 `@ApiBody` 데코레이터가 없음. Swagger UI에서 요청 바디 예시가 보이지 않음.
- **제안**: `@ApiBody({ type: PreviewLlmModelsDto })` 추가.

---

### [INFO] `isPrivateHost()` 함수 - DNS 이름 미검사 한계 미문서화
- **위치**: `llm.service.ts` — `isPrivateHost()` 함수 내 주석
- **상세**: 코드 내 주석에 `// IPv4 숫자 주소만 고려 (DNS 이름은 해석 비용상 제외...)` 라는 설명이 있으나, 이 한계가 함수 문서에 명시적으로 기재되어 있지 않음. `hostname === 'metadata.google.internal'` 같은 DNS 이름 기반 우회가 가능함을 알리는 주석이 서비스 운영자에게는 중요한 보안 한계 정보임.
- **제안**: 함수 상단 또는 JSDoc에 "DNS-based hostnames are not resolved — callers must validate at a higher layer if needed" 수준의 설명 추가.

---

### [INFO] `llm-configs.ts` (프론트엔드 API 클라이언트) - `previewModels` 메서드 주석 없음
- **위치**: `frontend/src/lib/api/llm-configs.ts` — `previewModels()` 함수
- **상세**: API Key가 저장되지 않는다는 보안 특성이 백엔드 서비스에는 주석으로 명시되어 있으나, 프론트엔드 API 클라이언트 함수에는 이에 대한 설명이 없음.
- **제안**: `// apiKey is used only for this request and is never persisted` 수준의 짧은 주석 추가.

---

### [INFO] `spec/5-system/7-llm-client.md` - Google AI 섹션 번호 변경으로 기존 `§5.3` 참조 깨짐 가능성
- **위치**: `spec/5-system/7-llm-client.md`
- **상세**: 기존 `5.3 Local` 섹션이 `5.4 Local`로 밀림. `previewModels` 동작 설명(`spec §5.4` 참조)이 `llm.service.ts` 주석에 있는데, 이 참조는 이제 정확함. 그러나 다른 문서나 주석에서 옛 `§5.3`을 참조하는 경우 깨질 수 있음.
- **제안**: 코드베이스 전체에서 `spec §5.3` 문자열 검색 후 필요 시 업데이트.

---

## 요약

전반적인 문서화 품질은 양호하다. 새 `previewModels` 기능은 Swagger 데코레이터, MDX 사용자 문서(한·영), 스펙 파일 모두에 일관되게 반영되어 있으며 i18n 키도 양쪽 언어로 추가되었다. 다만 `llm.service.ts`의 SSRF 주석 블록 위치 오류, `google.client.ts`에서 제거된 Gemini API 비표준 동작 설명(특히 `function` role 강제 사용 이유, `thoughtSignature` echo 요구사항), 그리고 컨트롤러의 `@ApiBody` 누락이 아쉬운 부분이다. 이 중 가장 실질적인 유지보수 위험은 Gemini API 제약 주석의 삭제로, 향후 개발자가 동일한 시행착오를 겪을 가능성이 있다.

## 위험도

**LOW**