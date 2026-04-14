## 발견사항

### [WARNING] WorkflowHandler의 `timeout` 설정값이 실제 실행에 전달되지 않음
- **위치**: `workflow.handler.ts` `execute()`, `execution-engine.service.ts` `executeSubWorkflow()`
- **상세**: `WorkflowConfig` 인터페이스에 `timeout` 필드가 정의되어 있고 검증도 수행하지만, `execute()` 메서드에서 `timeout`은 구조분해되지 않습니다. `executeInline()` 호출 시에도 timeout 옵션이 전달되지 않습니다. 따라서 `timeout=0` (무제한 대기) 유효성 검증 변경의 의도가 실제 실행 경로에 반영되지 않으며, 기본값인 300,000ms가 항상 적용됩니다.
  ```ts
  // workflow.handler.ts - timeout이 구조분해에서 누락됨
  const { workflowId, mode = 'sync', inputMapping = [] } = config as unknown as WorkflowConfig;
  // executeInline 호출 시 timeout 미전달
  await this.executionEngine.executeInline(workflowId, effectiveInput, { executionId, context, ... });
  ```
- **제안**: `WorkflowHandler.execute()`에서 `timeout`을 구조분해하고, `executeInline()` 인터페이스에 `timeoutMs` 옵션을 추가하거나, `executeSubWorkflow()` 호출 경로와 일치시켜야 합니다.

---

### [WARNING] MergeHandler 백엔드의 `timeout=0` 지원 여부 불명확
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx:532`, `spec/4-nodes/1-logic-nodes.md`
- **상세**: 프론트엔드 `MergeConfig`는 `min={0}`과 "0 = no timeout" 힌트로 변경되었고, 스펙도 "0 = no timeout (무제한 대기)"으로 업데이트되었습니다. 그러나 MergeHandler 백엔드 구현 코드는 이번 diff에 포함되지 않아 `timeout=0` 처리 여부를 확인할 수 없습니다. 백엔드가 여전히 `timeout=0`을 유효하지 않은 값으로 처리하거나 기본값으로 대체할 경우 스펙과 동작이 불일치합니다.
- **제안**: MergeHandler 백엔드에서도 `timeout=0`을 무제한 대기로 처리하는 로직을 명시적으로 추가하고, 관련 테스트를 작성해야 합니다.

---

### [WARNING] 히스토리 실행 데이터의 하위 호환성 문제
- **위치**: `button.types.ts` `ButtonInteractionData`, `button.types.spec.ts`
- **상세**: `ButtonInteractionData.interactionType`에서 `'button_timeout'`이 제거되었습니다. 데이터베이스에 저장된 기존 `NodeExecution` 레코드 중 `interactionType: 'button_timeout'`이 포함된 경우, 실행 내역 페이지에서 해당 데이터를 렌더링할 때 타입 경계에서 처리되지 않는 값으로 인해 UI가 예상치 않게 동작할 수 있습니다.
- **제안**: `result-detail.tsx` 및 `page.tsx`의 상호작용 데이터 처리 코드에 `'button_timeout'` 폴백 케이스를 추가하거나, 마이그레이션 스크립트를 통해 기존 데이터를 `'button_continue'`로 정규화해야 합니다.

---

### [INFO] `pendingContinuations` 무기한 대기 시 외부 취소 메커니즘 검증 필요
- **위치**: `execution-engine.service.ts` `waitForFormSubmission()`, `waitForButtonInteraction()`, `waitForAiConversation()`
- **상세**: 모든 대기 노드가 무기한 대기로 전환되었으며, 주석은 "external cancel is the only exit"이라고 명시합니다. 그러나 WebSocket 취소 명령 핸들러가 `pendingContinuations`의 `reject()`를 실제로 호출하는 코드는 이번 diff에 포함되지 않아, 사용자가 연결을 끊거나 실행을 취소할 때 `Promise`가 정상적으로 정리되는지 확인할 수 없습니다.
- **제안**: 취소 명령 핸들러가 `pendingContinuations.get(executionId)?.reject(new ExecutionCancelledError())`를 올바르게 호출하는지 검토 및 테스트를 보강하세요.

---

### [INFO] `executeSubWorkflow`의 `timeoutMs=0` 처리 개선은 정확함
- **위치**: `execution-engine.service.ts:617-664`
- **상세**: 기존에는 `timeoutMs=0`이 `timeoutMs > 0` 조건으로 인해 기본값 300,000ms로 대체되지 않고 0ms 타임아웃으로 즉시 실패했을 가능성이 있습니다. 이번 변경으로 `timeoutMs=0`은 명시적으로 "타임아웃 없음"으로 처리되어 스펙과 일치합니다.

---

### [INFO] 스펙과 코드 간 일관성은 전반적으로 양호
- **위치**: 전체 변경 파일
- **상세**: `turnTimeout`, `buttonTimeout`, `buttonTimeoutAction`이 스펙 문서, 백엔드 핸들러, 프론트엔드 UI, 타입 정의, 테스트 코드에서 일관되게 제거되었습니다. 예약 포트 ID 목록에서 `timeout` 제거, WebSocket 프로토콜 스펙 업데이트도 정확히 반영되었습니다.

---

## 요약

이번 변경은 모든 사용자 인터랙션 대기(버튼, 폼, AI 대화)를 무기한 대기 모델로 전환하는 요구사항을 전반적으로 일관되게 구현하였습니다. 스펙, 백엔드, 프론트엔드 간 `turnTimeout`/`buttonTimeout` 제거는 체계적으로 수행되었습니다. 다만, `WorkflowHandler`에서 `timeout` 설정값이 실제 실행 엔진에 전달되지 않는 구조적 단절이 있어 `timeout=0` 지원 의도가 WorkflowHandler 경로에서는 동작하지 않으며, MergeHandler 백엔드의 `timeout=0` 대응 여부가 이번 diff에서 확인되지 않고, 기존 `button_timeout` 히스토리 데이터 처리에 대한 폴백이 없다는 점이 주요 위험 요소입니다.

## 위험도

**MEDIUM**