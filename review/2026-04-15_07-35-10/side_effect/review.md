## 발견사항

### **[WARNING]** `pendingContinuations` 잠재적 메모리 누수
- **위치**: `execution-engine.service.ts` — `waitForForm`, `waitForAiConversation`, `waitForButtonInteraction`
- **상세**: 이전 구현에서는 타임아웃 콜백이 `this.pendingContinuations.delete(executionId)`를 명시적으로 호출한 후 reject/resolve했습니다. 타임아웃 제거 이후 이 정리 경로가 사라졌기 때문에, 외부 cancel이 발생할 때 `pendingContinuations` Map에서 항목을 반드시 삭제해야 합니다. cancel 핸들러가 `reject()`만 호출하고 Map에서 항목을 삭제하지 않는다면, 취소된 실행의 continuation이 Map에 영구히 잔류하여 메모리 누수가 발생합니다. 서버 재시작 전까지 누적될 수 있습니다.
- **제안**: `cancelExecution` 및 관련 외부 cancel 경로에서 `this.pendingContinuations.delete(executionId)` 호출 여부를 명시적으로 확인하세요.

---

### **[WARNING]** `button_timeout` interactionType 기존 DB 데이터 처리
- **위치**: `button.types.ts:17`, `execution-engine.service.ts:1811`
- **상세**: `ButtonInteractionData.interactionType`에서 `'button_timeout'`이 제거되고, `INTERACTION_STATUSES` 화이트리스트도 `['button_click', 'button_continue']`로 축소되었습니다. DB에 `interactionType: 'button_timeout'`으로 저장된 기존 `NodeExecution.interaction_data` 레코드를 이 코드가 재처리할 경우, `rawStatus`가 화이트리스트에 없어 폴백 분기로 처리됩니다. 현재 코드에서 폴백은 `'button_continue'`로 처리되며, 이는 이전 `button_timeout + continue action`의 의미와는 다를 수 있습니다(`cancel` action이었던 경우).
- **제안**: 히스토리 재처리 로직이 없다면 실용적으로 낮은 위험이나, `INTERACTION_STATUSES`에 레거시 타입 처리를 위한 주석이나 마이그레이션 노트를 추가하는 것을 권장합니다.

---

### **[WARNING]** `ButtonConfig` / `ButtonInteractionData` 인터페이스 파괴적 변경
- **위치**: `button.types.ts:9-10, 17`
- **상세**: 공개 인터페이스에서 `buttonTimeout`, `buttonTimeoutAction`, `'button_timeout'` interactionType이 제거되었습니다. 현재 코드베이스의 모든 소비자는 업데이트되었지만, 런타임에 DB/캐시에서 로드된 구형 `buttonConfig` 데이터에는 여전히 이 필드들이 포함될 수 있습니다. TypeScript는 이를 잡지 못하며, 프론트엔드의 `parseButtonConfig`는 이제 `timeout`/`timeoutAction` 필드를 무시합니다 — 이는 의도된 동작이나 명시적 처리가 없습니다.
- **제안**: 낮은 실제 위험도입니다. 기존 데이터의 추가 필드는 단순히 무시됩니다.

---

### **[INFO]** `executeSubWorkflow`에서 `timeoutMs = 0` 동작 변경
- **위치**: `execution-engine.service.ts:617-648`
- **상세**: 이전에는 `timeoutMs = 0`이면 0ms 타임아웃(즉시 실패)이 발생했습니다. 이제 `timeoutMs > 0` 조건으로 `null` 처리되어 무한 대기합니다. 이는 `WorkflowHandler`의 검증 변경(`timeout < 0` 거부)과 일관성이 있습니다. 기존에 `timeoutMs: 0`을 의도적으로 전달했던 호출자는 동작이 변경됩니다.

---

### **[INFO]** `clearTimeout(timeoutHandle!)` 수정
- **위치**: `execution-engine.service.ts:664`
- **상세**: `clearTimeout(undefined)`는 JS 런타임에서 no-op으로 안전했지만, 명시적 undefined 체크로 코드가 더 명확해졌습니다. 부작용 없음.

---

### **[INFO]** `ai_timeout` 분기 제거의 도달 불가능 코드 정리
- **위치**: `execution-engine.service.ts:1351-1368`
- **상세**: `{ type: 'ai_timeout' }` 해결값은 삭제된 타이머에서만 생성되었으므로, 이 분기 제거는 안전합니다. 잔류 도달 불가능 코드 없음.

---

## 요약

이번 변경은 모든 인터랙션 대기(버튼, 폼, AI 대화, 서브워크플로우)에서 타임아웃 기능을 일관되게 제거하는 대규모 리팩터링입니다. 프론트엔드·백엔드·스펙 문서·테스트가 동기화되어 있고 인터페이스 변경도 모든 소비자에 반영되어 있습니다. 핵심 위험은 타임아웃이 수행하던 `pendingContinuations` 정리 역할이 외부 cancel 경로에서도 보장되는지 여부이며, 이는 무한 대기 중인 실행이 취소될 때 Map 항목이 누적되지 않도록 명시적으로 검증이 필요합니다. 기존 DB에 `button_timeout` interactionType으로 저장된 레코드는 재처리 시 폴백 경로로 처리되므로 히스토리 페이지 표시에 영향을 줄 수 있습니다.

## 위험도

**LOW**