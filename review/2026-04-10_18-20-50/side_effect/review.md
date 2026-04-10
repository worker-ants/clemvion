## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] 응답 구조 변경으로 인한 호출자 불일치 가능성**
- 위치: `integrations.service.ts:90` — `testConnection` 반환 타입
- 상세: `IntegrationsService.testConnection()`의 반환 타입이 `{ success, message }` → `{ data: { success, message } }`로 변경됐습니다. 이 메서드를 호출하는 `IntegrationsController`의 응답 처리를 확인해야 합니다. 컨트롤러에서 별도 래핑 없이 서비스 반환값을 그대로 클라이언트에 내려보낼 경우, 프런트엔드가 `data.data` 이중 중첩 구조를 받을 수 있습니다.
- 제안: `IntegrationsController`의 `testConnection` 핸들러를 확인하고, 프런트엔드 측 `integrations` API 클라이언트도 `llm-configs.ts`처럼 `data?.data ?? data` 패턴으로 처리됐는지 검토하세요.

---

**[WARNING] `continueExecution` 응답 구조 변경 — 프런트엔드 호환성 미확인**
- 위치: `executions.controller.ts:49`
- 상세: `{ success: true }` → `{ data: { success: true } }`로 변경됐습니다. 프런트엔드에서 이 엔드포인트의 응답을 직접 소비하는 코드(예: `continueExecution` 후 `result.success` 체크)가 있다면 조용히 깨집니다(`undefined`가 됨).
- 제안: 프런트엔드의 `/executions/:id/continue` 호출부를 검색하여 `.success` 또는 `.data.success` 중 어느 것을 참조하는지 확인하세요.

---

**[WARNING] 프런트엔드 방어 코드의 불일치 범위**
- 위치: `frontend/src/lib/api/llm-configs.ts:68`
- 상세: `data?.data ?? data` 패턴으로 `LlmService.testConnection`의 구조 변경을 흡수했습니다. 그러나 동일한 패턴의 방어 처리가 `IntegrationsService.testConnection` 응답, `ExecutionsController.continueExecution` 응답에 대해서는 적용되지 않았습니다. 수정 범위가 일관되지 않습니다.
- 제안: 세 곳의 변경이 동일한 목적(API 응답 표준화)이라면, 모든 영향받는 프런트엔드 API 클라이언트에 동일한 방어 처리를 적용하거나, `apiClient` 인터셉터 레벨에서 통합 처리하는 것이 낫습니다.

---

**[INFO] `testConnection` 에러 핸들링 시그니처 변경의 일관성**
- 위치: `llm.service.ts:69-80`, `llm.service.spec.ts`
- 상세: 구현과 테스트가 함께 변경되어 내부적으로는 일관됩니다. `catch` 블록에서 에러를 throw하지 않고 `{ data: { success: false, error } }`를 반환하는 기존 설계도 유지됩니다. 부작용 없음.

---

**[INFO] 비동기 미처리 (`continueExecution`)**
- 위치: `executions.controller.ts:44`
- 상세: `this.executionEngineService.continueExecution(...)` 호출 결과를 `await` 하지 않습니다. 이는 이번 변경에서 도입된 것이 아니라 기존 코드이지만, fire-and-forget 패턴으로 동작 중임을 주의해야 합니다. 반환값 변경(`{ data: { success: true } }`)은 실제 실행 성공 여부와 무관하게 항상 성공을 반환합니다.

---

### 요약

이번 변경의 핵심은 API 응답을 `{ data: ... }` 구조로 표준화하는 것입니다. `LlmService`는 구현·테스트·프런트엔드 클라이언트가 모두 함께 수정되어 일관성이 있습니다. 그러나 `IntegrationsService.testConnection`과 `ExecutionsController.continueExecution`의 응답 구조 변경에 대응하는 프런트엔드 수정이 누락되어 있어, 해당 엔드포인트를 소비하는 프런트엔드 코드에서 묵시적 버그가 발생할 가능성이 있습니다. 또한 방어 처리(`data?.data ?? data`)가 `llm-configs.ts`에만 국소적으로 적용되어 전체 API 클라이언트 계층의 일관성이 깨졌습니다.

### 위험도

**MEDIUM** — 런타임에서 `undefined` 참조로 인한 UI 오류가 발생할 수 있으나, TypeScript 컴파일 에러나 서버 크래시는 없습니다.