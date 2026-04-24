## 발견사항

### **[WARNING]** `listModels` 프론트엔드 응답 언래핑 불일치 (기존 버그 노출)
- **위치**: `frontend/src/lib/api/llm-configs.ts` `listModels`
- **상세**: 기존 `return data as ModelInfo[]`에서 `return (data?.data ?? data) as ModelInfo[]`로 수정됨. 이는 기존에 래퍼 객체가 그대로 반환되던 무음 버그를 수정한 것. 그러나 API 클라이언트 전반에서 응답 언래핑 방식이 `data.data` / `data?.data ?? data` / `data` 세 가지가 혼재함.
- **제안**: `apiClient`의 응답 인터셉터에서 `data.data`를 자동으로 unwrap하거나, 모든 API 함수가 동일한 unwrap 패턴을 사용하도록 통일할 것.

---

### **[WARNING]** `previewModels` 서비스 메서드의 파라미터 타입이 DTO보다 느슨함
- **위치**: `backend/src/modules/llm/llm.service.ts:183`
- **상세**: 서비스 메서드 시그니처가 `{ provider: string; ... }`로 선언되어, DTO의 `@IsIn(LLM_PROVIDERS)` 검증을 우회한 직접 호출(e.g. 테스트, 내부 호출)이 허용됨. 컨트롤러를 통하지 않으면 유효하지 않은 프로바이더가 팩토리까지 전달될 수 있음.
- **제안**: 서비스 파라미터 타입을 `PreviewLlmModelsDto` 또는 `{ provider: LlmProvider; apiKey: string; baseUrl?: string }`으로 좁혀 타입 시스템이 검증을 보장하게 할 것.

---

### **[WARNING]** 팩토리 에러 메시지가 sanitize 없이 클라이언트에 노출됨
- **위치**: `backend/src/modules/llm/llm.service.ts:196-204`
- **상세**: `clientFactory.create()` 예외 블록에서 에러 메시지가 `sanitizeErrorMessage()` 없이 그대로 `BadRequestException` body의 `message` 필드로 전달됨. 반면 `client.listModels()` 예외 블록은 `sanitizeErrorMessage()`를 거침. 팩토리 에러(예: "Azure OpenAI requires a base URL...")는 구현 세부사항을 노출함.
- **제안**: 팩토리 에러는 고정 메시지("Invalid provider configuration")만 노출하고 실제 에러는 `logger.warn()`으로만 기록하는 방식으로 통일할 것. 또는 `sanitizeErrorMessage()`를 팩토리 에러에도 적용할 것.

---

### **[INFO]** 정적 라우트가 동적 라우트 뒤에 등록됨 (스타일 이슈)
- **위치**: `backend/src/modules/llm-config/llm-config.controller.ts:167`
- **상세**: `@Post('preview-models')`가 `@Post(':id/test')` 뒤에 선언됨. NestJS(Express)에서 `preview-models`(1 세그먼트)와 `:id/test`(2 세그먼트)는 세그먼트 수가 달라 실제 충돌은 없음. 그러나 NestJS 공식 권장 사항은 정적 경로를 동적 경로보다 먼저 등록하는 것.
- **제안**: `@Post('preview-models')`를 `@Post(':id/test')` 앞으로 이동시킬 것.

---

### **[INFO]** `preview-models` 엔드포인트에 rate limiting 없음
- **위치**: `backend/src/modules/llm-config/llm-config.controller.ts:167-184`
- **상세**: 엔드포인트 호출 시마다 외부 LLM 프로바이더 API가 실시간 호출됨. `editor` 권한을 가진 사용자가 단시간 내 다수 호출 시 외부 API 쿼터 소진 또는 서버 리소스 낭비가 발생할 수 있음.
- **제안**: `@Throttle()` 데코레이터 또는 NestJS `ThrottlerGuard`를 적용하여 사용자별 호출 빈도를 제한할 것.

---

### **[INFO]** 하위 호환성 확인
- **상세**: 신규 `POST /api/llm-configs/preview-models` 엔드포인트는 additive 추가이며, 기존 엔드포인트 스키마·경로·응답 포맷에 변경 없음. Breaking change 없음.

---

## 요약

`preview-models` 엔드포인트는 설계 의도(자격증명 비저장, 캐시 미사용, 에러 sanitize)를 서비스·DTO·테스트 전 계층에서 일관되게 구현했으며, 기존 API 계약을 깨지 않는 additive 추가다. 다만 세 가지 주의 사항이 있다: ① 팩토리 에러 메시지가 sanitize 없이 클라이언트에 도달하는 경로, ② 프론트엔드 API 클라이언트의 응답 언래핑 방식 불일치(기존 버그 노출), ③ 서비스 메서드의 느슨한 파라미터 타입. 이 세 항목을 수정하면 보안 및 유지보수 품질이 개선된다.

## 위험도
**LOW**