## 발견사항

### **[CRITICAL]** `kb-selector` 확인 시 배열 필드에 단일 문자열 주입

- **위치**: `frontend/src/components/editor/assistant-panel/assistant-message.tsx` `CandidatePickers` → `onConfirm` 콜백 / `frontend/src/lib/stores/editor-store.ts` `updateNodeConfigField`
- **상세**: `CandidatePicker`의 `onConfirm`은 항상 `selectedId: string` 단일값을 반환한다. `kb-selector`의 대상 필드 `knowledgeBaseIds`는 `string[]` 타입인데, `updateNodeConfigField(nodeId, "knowledgeBaseIds", "kb-123")`을 호출하면 배열이 아닌 문자열이 주입된다. AI Agent 노드 실행 시 `knowledgeBaseIds: "kb-123"` 형태로 config가 저장돼 런타임 타입 오류 또는 KB 무시가 발생한다.
- **제안**: `onConfirm` 호출 전 `field.widget === 'kb-selector'`이면 `[selectedId]`로 감싸거나, `CandidatePicker`에 `valueTransform?: (id: string) => unknown` prop을 추가해 호출부에서 처리한다.

---

### **[WARNING]** Rehydrate 상태에서 라벨이 id 원문으로 노출됨

- **위치**: `frontend/src/components/editor/assistant-panel/candidate-picker.tsx:80-85` (`confirmed` 분기 내 `selectedLabel` 계산)
- **상세**: `currentValue`가 이미 채워진 상태로 컴포넌트가 마운트되면 `confirmed=true`, `selectedId=""`로 초기화된다. `field.candidates.find(c => c.id === "")` 는 항상 `undefined`이므로 fallback인 `currentValue`(예: `"int-abc123"`)가 그대로 표시된다. 사용자에게 "✓ Integration: int-abc123 로 설정됨"처럼 raw id가 노출된다.
- **제안**: fallback 로직을 `field.candidates.find(c => c.id === selectedId || c.id === currentValue)?.label ?? ...`으로 수정해 `candidates` 배열에서 `currentValue`로도 레이블을 찾도록 한다.

---

### **[WARNING]** `update_node` 툴 argument 키 가정이 검증되지 않음

- **위치**: `frontend/src/components/editor/assistant-panel/assistant-message.tsx:290-294` (`collectPickerEntries` 내)
- **상세**: `update_node` 대상 노드 id를 `call.arguments?.id`로 읽는다. `update_node` 스키마가 `nodeId`나 다른 키를 사용한다면 `nodeId`가 `""`이 되어 해당 picker가 조용히 렌더되지 않는다. 코드베이스 내 `update_node` 정의와 실제 인자 키가 일치하는지 스펙 검토 없이는 확인 불가능하다.
- **제안**: `update_node` 스키마의 실제 필드명을 확인하고, 일치하지 않을 경우 `call.arguments?.nodeId ?? call.arguments?.id`처럼 방어적으로 처리하거나 상수로 고정한다.

---

### **[WARNING]** `evaluateReviewGuard`에서 노드 수만큼 DB 쿼리 동시 실행

- **위치**: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts:1301-1318`
- **상세**: `Promise.all(snapshot.nodes.map(...))` 로 모든 non-trigger 노드에 대해 `collectPendingUserConfigWithCandidates`를 병렬 호출한다. 워크플로에 노드가 30개면 최대 120회(노드×4 widget 타입)의 DB 쿼리가 한 번의 review pass마다 발생한다. `CandidateLookupService`에 `limit: MAX_CANDIDATES`가 있어도 Integration/LLM/KB/Workflow 테이블을 각각 조회한다.
- **제안**: review guard에서는 `candidates`의 존재 여부보다 "필드가 비어있는지"만 필요하므로, `collectPendingUserConfig`(sync, schema만 검사) 결과를 그대로 사용해 `candidates`를 `undefined`로 취급하는 legacy 경로로 처리하고, candidates 조회는 `tool_result` 에 실을 때만 수행하도록 분리하는 방안을 검토한다.

---

### **[INFO]** `candidates` 프로퍼티 자체가 없는 legacy row 케이스 테스트 누락

- **위치**: `backend/src/modules/workflow-assistant/tools/review-workflow.spec.ts:1049-1061`
- **상세**: `review-workflow.ts`의 필터 로직은 `!Array.isArray(f.candidates)`로 property 미존재 케이스를 처리하도록 코멘트에 명시되어 있다. 그러나 테스트의 `integrationPending()`은 `candidates: []`를 명시적으로 포함하며, property 자체가 없는 진짜 legacy 객체(`{ field, widget, label }`)로는 테스트하지 않는다.
- **제안**: `{ field: 'integrationId', widget: 'integration-selector', label: 'Integration' }` (candidates 없음)으로 `PENDING_USER_CONFIG_UNMENTIONED` 발동 여부를 검증하는 케이스를 추가한다.

---

### **[INFO]** `lookupLlmConfigs` 정렬 순서 미검증

- **위치**: `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:111-132`
- **상세**: 스펙 §4.3.1은 `llm-config-selector` 후보를 "최근 수정순"으로 정렬한다고 명시하나, `PaginationQueryDto`에 정렬 파라미터가 없다. `LlmConfigService.findAll`이 기본적으로 최근 수정순을 적용하는지 이 diff만으로는 확인 불가.
- **제안**: `LlmConfigService.findAll` 시그니처를 확인해 기본 정렬이 스펙과 일치하는지 검증하거나, 명시적으로 sort 파라미터를 추가한다.

---

### **[INFO]** `fillCandidates` 빈 배열 단락 시 동일 참조 반환

- **위치**: `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:58`
- **상세**: `if (pending.length === 0) return pending` — JSDoc이 "불변으로 새 배열을 돌려준다"고 명시하지만, 빈 배열 경우는 원본 참조를 그대로 반환한다. 현재 호출부에서 이 참조를 변형하지 않으므로 기능상 무해하지만 문서-구현 불일치다.
- **제안**: `return []`로 변경해 항상 새 배열을 반환하거나, JSDoc에서 빈 배열 예외 처리를 명시한다.

---

## 요약

ED-AI-39 스펙(in-message candidate picker)의 핵심 흐름 — 서버 후보 조회, LLM 클로징 메시지 조건, 리뷰 가드 완화, 프론트 드롭다운 + 확인 — 은 전반적으로 충실히 구현되어 있다. 그러나 `kb-selector` 확인 시 `string[]` 필드에 `string`을 주입하는 타입 불일치가 런타임 노드 실행 오류를 일으킬 수 있는 기능적 버그로 남아 있으며, rehydrate 상태에서 사용자에게 raw id가 노출되는 UX 결함, `update_node` argument 키 가정, review guard의 O(N) DB 쿼리 누적이 추가 주의를 요한다.

## 위험도

**HIGH** — `kb-selector` 타입 불일치로 AI Agent 노드 설정이 올바르게 저장되지 않는 기능 버그가 포함되어 있다.