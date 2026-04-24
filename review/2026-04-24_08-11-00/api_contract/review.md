### 발견사항

- **[WARNING]** 프론트엔드 응답 언래핑 불일치
  - 위치: `frontend/src/lib/api/llm-configs.ts` — `listModels` 변경
  - 상세: 기존 `return data as ModelInfo[]`에서 `return (data?.data ?? data) as ModelInfo[]`로 변경됨. `TransformInterceptor`가 모든 응답을 `{ data: [...] }` 로 감싸므로 axios `data` 필드는 `{ data: ModelInfo[] }` 형태다. 이전 코드는 `{ data: ModelInfo[] }`를 `ModelInfo[]`로 잘못 캐스팅하고 있었던 버그 수정이지만, `?? data` 폴백이 남아 있어 응답 포맷 계약이 명확하지 않음을 시사함.
  - 제안: `data.data`만 사용하고 폴백 제거. 또는 `apiClient` 인터셉터에서 `data` 언래핑을 일관되게 처리.

- **[WARNING]** SSRF 방어 불완전 — DNS rebinding 미차단
  - 위치: `backend/src/modules/llm/llm.service.ts` — `isPrivateHost()`
  - 상세: IPv4 리터럴만 검사하며 공개 DNS가 내부 IP로 해석되는 DNS rebinding 공격을 막지 못함. 코드 내 주석도 이를 인정하고 있으나, 공격자가 `attacker.example.com → 10.0.0.1`로 DNS를 설정하면 우회 가능함.
  - 제안: 단기적으로는 현 상태 유지하되, 중기적으로 DNS 해석 후 IP 재검증 또는 egress 화이트리스트 방식 도입 검토.

- **[WARNING]** `POST /llm-configs/preview-models` 라우트 등록 순서 의존성
  - 위치: `backend/src/modules/llm-config/llm-config.controller.ts`
  - 상세: NestJS는 정적 경로가 파라미터화 경로보다 우선하므로 현재는 문제없으나, 컨트롤러에 `:id` 패턴의 POST 핸들러가 추가되는 경우 `preview-models`가 `:id`로 오인될 수 있음. Swagger 문서에서도 `preview-models`가 먼저 등록되어야 올바르게 표시됨.
  - 제안: `@Post('preview-models')`를 `@Post(':id/...')` 핸들러 앞에 배치하도록 컨트롤러 내 순서 고정.

- **[INFO]** `LLMClient.listModels(signal?: AbortSignal)` 인터페이스 변경 — 하위 호환
  - 위치: `backend/src/modules/llm/interfaces/llm-client.interface.ts`
  - 상세: 파라미터가 선택적(`?`)이므로 기존 구현체를 교체 없이 사용 가능. OpenAI·Anthropic·Google 모두 구현체가 업데이트되어 계약 일치.

- **[INFO]** `POST /api/llm-configs/preview-models` 신규 엔드포인트 계약 검토
  - 위치: `llm-config.controller.ts`, `preview-llm-models.dto.spec.ts`
  - 상세: `@Roles('editor')` 인가, `@Throttle(10/60s)` 속도 제한, DTO 레벨에서 `azure`/`local` 프로바이더 `baseUrl` 필수 검증, `file://` 스킴 차단 모두 적용됨. 응답 포맷은 기존 `GET /:id/models`와 동일한 `ModelInfo[]`로 일관성 유지. 스펙 문서(`spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`)에도 반영됨.

- **[INFO]** Google SDK `@google/generative-ai` → `@google/genai` 마이그레이션
  - 위치: `backend/src/modules/llm/clients/google.client.ts`
  - 상세: 내부 구현 변경이므로 외부 API 계약에는 영향 없음. 단, `stream()` 반환 타입이 `flat AsyncGenerator`로 변경되고 aggregated response promise 폴백 로직이 제거됨 — 청크에 `usageMetadata`가 없는 경우 토큰 카운트가 0으로 보고될 수 있음.

---

### 요약

이번 변경의 핵심은 `POST /api/llm-configs/preview-models` 신규 엔드포인트 추가와 LLM 모델 목록의 하드코딩 제거(실시간 API 호출)다. 신규 엔드포인트는 인가·요청 검증·에러 코드·스펙 문서화가 일관되게 갖춰져 있고, `listModels` 인터페이스 변경은 하위 호환을 유지한다. 다만 프론트엔드 `listModels`의 응답 언래핑 불일치(이전 코드의 잠재적 타입 버그 수정 과정에서 폴백이 잔류)와 SSRF 방어의 DNS 우회 가능성이 개선 여지로 남는다.

### 위험도
**LOW**