### 발견사항

---

**[WARNING]** DTO에 양수 제약 없음 — 0px 또는 음수 값 허용
- 위치: `assistant-message-request.dto.ts` `AssistantWorkflowNodeDto.width/height`
- 상세: `@IsNumber()`만 있고 `@Min(1)`이 없어 `width: 0`, `height: 0`, 음수 값이 통과된다. 시스템 프롬프트의 레이아웃 공식 `x = predecessor.x + (predecessor.width ?? 250) + 32`에서 `??` 연산자는 `0`을 falsy로 간주하지 않으므로 `width: 0`이 전달되면 폴백 250이 적용되지 않고 `x = predecessor.x + 0 + 32`가 되어 노드가 겹친다.
- 제안:
  ```typescript
  @IsNumber()
  @Min(1)
  width?: number;
  ```

---

**[WARNING]** 프론트엔드 0값 edge case — React Flow legacy `width/height` 필드
- 위치: `assistant-panel.tsx:106-111`
- 상세: `measured?.width ?? legacy.width` 구문에서 `measured?.width`가 `undefined`일 때 `legacy.width`를 쓰는데, React Flow v11에서 hidden/collapsed 노드의 경우 `n.width === 0`이 될 수 있다. `typeof 0 === 'number'`는 `true`이므로 DTO로 0이 그대로 전송되고 위의 레이아웃 계산 오류로 이어진다.
- 제안:
  ```typescript
  const width = (measured?.width ?? legacy.width) || undefined;
  const height = (measured?.height ?? legacy.height) || undefined;
  ```
  또는 DTO 레벨 `@Min(1)`로 방어.

---

**[INFO]** `workflow-view.spec.ts` — 0값 케이스 미검증
- 위치: `workflow-view.spec.ts` 전체
- 상세: `width: 0`, `height: 0`이 주어졌을 때 `typeof 0 === 'number'`가 `true`여서 필드가 포함되는 동작을 검증하는 테스트가 없다. 현재 구현이 의도된 동작인지(0을 유효한 측정값으로 전달) 아닌지(폴백 처리) 명시적 검증이 필요하다.

---

**[INFO]** `ShadowWorkflow.addNode`에서 width/height를 초기화하지 않음 — 명시적 의도이지만 테스트 미검증
- 위치: `shadow-workflow.ts:addNode()`
- 상세: 새로 추가된 노드는 width/height 없이 생성되는 것이 의도된 동작(렌더 전 미측정)이며 시스템 프롬프트 fallback 지침과 일치한다. 그러나 `add_node` 후 `get_current_workflow`가 width/height를 omit하는 엔드투엔드 경로를 검증하는 테스트가 없어 향후 `addNode` 수정 시 회귀 탐지가 어렵다.

---

**[INFO]** 스펙 문서의 `edges` 인터페이스 필드명 불일치
- 위치: `spec/3-workflow-editor/4-ai-assistant.md:§5.2`
- 상세: 스펙의 `edges: Array<{id, sourceId, sourcePort, targetId, targetPort, type}>` 표기에서 `sourceId`/`targetId`를 쓰는데, 실제 DTO(`AssistantWorkflowEdgeDto`)는 `sourceNodeId`/`targetNodeId`를 쓴다. 이번 변경과 무관하지만 기존 불일치가 스펙에서 수정되지 않았다.

---

### 요약

이번 변경의 핵심 요구사항인 "React Flow 측정값(width/height)을 DTO→ShadowSnapshot→WorkflowView→시스템 프롬프트까지 전파하고, 미측정 노드는 필드 자체를 누락하여 LLM에 폴백(250×80px)을 적용"은 전 계층에 걸쳐 일관되게 구현되어 있다. DTO의 optional 선언, `typeof n.width === 'number'` 조건부 spread, 프론트의 v11/v12 dual-source 처리, 시스템 프롬프트의 `??` 폴백 문구, 스펙 문서 갱신 모두 정합성이 확인된다. 다만 DTO의 `@Min(1)` 부재로 인해 `width: 0` 값이 유효성 검사를 통과하고 시스템 프롬프트의 `??` 폴백을 무력화할 수 있다는 점이 실질적인 위험이며, 프론트의 legacy fallback 경로에서도 동일한 0값이 유입될 수 있다. 이 두 경로를 방어하는 것이 이번 기능의 신뢰성을 완성하는 마지막 조각이다.

### 위험도

**MEDIUM**