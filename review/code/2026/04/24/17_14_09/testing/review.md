### 발견사항

---

**[WARNING] `updateNodeConfigField` 액션에 테스트 없음**
- 위치: `frontend/src/lib/stores/editor-store.ts` — 신규 `updateNodeConfigField` 액션
- 상세: 이 액션은 `pushUndo()` 호출 → config 병합 → `isDirty: true` 설정까지 세 가지 부수효과를 갖는다. 기존 `updateNodeConfig`(전체 교체)와 달리 머지(merge) 방식이므로 동작이 다르다. 테스트 파일에서 이 액션을 커버하는 케이스가 전혀 없다.
- 제안: `updateNodeConfig`와 동일 패턴으로 (a) config 필드가 기존 값을 보존하며 병합되는지, (b) `isDirty`가 true로 전환되는지, (c) undo 스택에 스냅샷이 쌓이는지, (d) 존재하지 않는 `id`에 호출 시 안전하게 no-op이 되는지를 테스트 추가 필요.

---

**[WARNING] `collectPickerEntries` / `CandidatePickers` 컴포넌트 테스트 없음**
- 위치: `frontend/src/components/editor/assistant-panel/assistant-message.tsx` — `collectPickerEntries`, `CandidatePickers`
- 상세: `collectPickerEntries`는 `add_node`(→ `result.id`)와 `update_node`(→ `args.id`)에서 nodeId를 다르게 추출하는 분기가 있고, `ok: false` 필터링, `pendingUserConfig` 부재 처리 등 복잡한 로직을 갖는다. `CandidatePicker` 컴포넌트 자체는 잘 테스트되어 있으나, 이 조합 로직은 `candidate-picker.test.tsx`에 포함되지 않았다.
- 제안: `collectPickerEntries`에 대해 (a) `update_node` 경로(`args.id`), (b) `ok: false` call 스킵, (c) `result.pendingUserConfig`가 없는 경우, (d) 비-편집 tool call 필터링 케이스를 단위 테스트로 추가.

---

**[WARNING] review-workflow 레거시 경로(`candidates` 프로퍼티 자체 없음) 미테스트**
- 위치: `backend/src/modules/workflow-assistant/tools/review-workflow.spec.ts:1034`
- 상세: `review-workflow.ts`의 필터 조건이 `!Array.isArray(f.candidates) || f.candidates.length === 0`인데, 전자(`candidates` 프로퍼티 자체 없음)는 레거시 호환을 위한 경로다. 그러나 `integrationPending()`은 `candidates: []`(빈 배열)를 반환하므로 레거시 path를 실제로 실행하는 케이스가 없다. 두 케이스의 코드 경로가 다르지 않지만, 의도를 명시적으로 고정하는 테스트가 필요하다.
- 제안:
  ```typescript
  function integrationPendingLegacy() {
    return [{ field: 'integrationId', widget: 'integration-selector', label: 'Integration' }];
    // candidates 프로퍼티 없음
  }
  ```
  위 fixture로 `PENDING_USER_CONFIG_UNMENTIONED` 가 발동하는 케이스 추가.

---

**[WARNING] `evaluateReviewGuard` 비동기 변환 후 통합 경로 미테스트**
- 위치: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts`
- 상세: `evaluateReviewGuard`가 async로 변환되면서 내부에서 모든 non-trigger 노드에 대해 `collectPendingUserConfigWithCandidates`를 `Promise.all`로 사전 조회한다. 기존 `finish` 도구 리뷰 경로에서 이 사전 조회 맵이 실제로 체크리스트에 전달되는지 검증하는 테스트가 없다.
- 제안: `finish` 호출 시나리오에서 노드가 존재하고 candidates가 있을 때 `PENDING_USER_CONFIG_UNMENTIONED`가 발동하지 않음을, candidates가 없을 때 발동함을 스트림 레벨에서 커버하는 케이스 추가.

---

**[INFO] CandidateLookupService: 복수 widget 동시 조회 시나리오 미테스트**
- 위치: `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.spec.ts`
- 상세: `fillCandidates`는 `Promise.all`로 다수 항목을 병렬 조회하는데, 현재 모든 테스트가 `pending` 1건 케이스다. 서로 다른 widget 2개 이상이 동시에 있는 경우(예: `integration-selector` + `llm-config-selector`) 두 개의 서비스 모두 호출되고 결과가 올바르게 매핑되는지 테스트가 없다.
- 제안: `pending` 2건(통합 + llm-config) 시나리오에서 출력 배열 길이와 각 항목의 `candidates`를 검증하는 케이스 추가.

---

**[INFO] `CandidatePicker` — `settingsHref` 없을 때 후보 0 케이스 미테스트**
- 위치: `frontend/src/components/editor/assistant-panel/candidate-picker.test.tsx`
- 상세: 후보 0 테스트는 `settingsHref="/integrations"`가 전달된 케이스만 다루고, `settingsHref`가 없을 때 링크가 렌더되지 않는 경로는 테스트되지 않는다.
- 제안: `settingsHref` 없이 후보 0인 경우 링크(`<a>`)가 DOM에 없고 amber 안내 박스만 렌더되는지 검증하는 케이스 추가.

---

**[INFO] LlmConfig fallback label/id 경로 미테스트**
- 위치: `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.spec.ts`
- 상세: `lookupLlmConfigs`의 fallback 분기(`cfg.name`이 없으면 `cfg.provider`, 그것도 없으면 `'LLM Config'`)와 `cfg.id`가 string이 아닌 경우(`id: ''` fallback)가 테스트되지 않는다.
- 제안: `{ id: 123, provider: 'openai' }` 형태의 row fixture로 fallback 경로를 커버하는 케이스 추가.

---

### 요약

핵심 구성요소인 `CandidateLookupService`, `detectPendingUserConfig`, `CandidatePicker` 컴포넌트는 각각 독립적이고 잘 격리된 테스트로 주요 경계값까지 커버한다. 특히 후보 0 / 후보 1+ / rehydrate / 에러 degradation 분기는 충분히 고정되어 있다. 그러나 **`updateNodeConfigField`(undo 연동 포함)** 과 **`collectPickerEntries` / `CandidatePickers`** 는 전혀 테스트되지 않았고, review-workflow의 레거시 호환 경로와 비동기 전환된 `evaluateReviewGuard` 통합 경로도 커버되지 않아 이 네 가지 gap이 잠재적 회귀 위험으로 남는다.

### 위험도
**MEDIUM**