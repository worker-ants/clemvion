### 발견사항

---

**[WARNING] EH-DETAIL-07: 선택된 버튼 하이라이트 구현 검증 불가**
- 위치: `execution-engine.service.ts` (buttonConfig 보존), `presentation-renderers.tsx` (diff 잘림)
- 상세: PRD EH-DETAIL-07은 "버튼이 있는 노드에서 모든 버튼 표시 + 선택된 버튼 하이라이트"를 요구함. 백엔드는 `buttonConfig`를 `cleanNodeOutput`에 보존하고 `_selectedPort`를 `interactionData`에 유지하여 데이터를 제공하나, `presentation-renderers.tsx`의 diff가 잘려서 실제로 선택된 버튼의 시각적 하이라이트가 구현되었는지 확인 불가.
- 제안: `presentation-renderers.tsx`에서 `interactionData._selectedPort`와 `buttonConfig.buttons`를 비교하여 선택된 버튼을 시각적으로 구분하는 로직이 있는지 확인 필요.

---

**[WARNING] ND-CL-10: `source` 표현식 resolution 파이프라인 연결 불명확**
- 위치: `carousel.handler.ts` L163 — `const sourceData = config.source`
- 상세: 주석에 "source is resolved by the expression engine before reaching the handler"라고 명시되어 있으나, `{{ $node["API"].output.items }}` 같은 표현식이 실제로 실행 전에 resolve되는지 — 즉 expression engine이 carousel config의 `source` 필드를 평가하는 코드가 있는지 — 확인되지 않음. 표현식이 미처리 문자열로 전달되면 배열이 아닌 string이 오고 `Array.isArray(sourceData)` 체크에서 false가 되어 `input` fallback으로 동작해 silent failure 발생.
- 제안: expression engine이 노드 config의 `source` 필드를 순회하여 평가하는지 확인하고, 미해결 표현식이 도달하는 경우에 대한 방어 코드 또는 테스트 추가 필요.

---

**[WARNING] ND-CL-09: action 타입 버튼에서 `selectedItem` 포함 여부 미확인**
- 위치: `execution-engine.service.ts` — action button 처리 (diff 잘림)
- 상세: port 타입 버튼에서는 `...(selectedItem !== undefined && { selectedItem })`이 `interactionData`에 추가되나, diff가 잘려서 action 타입 버튼 처리 부분에도 동일하게 `selectedItem`이 포함되는지 확인 불가. 아이템별 버튼은 port 또는 action 타입 모두 사용 가능하므로, action 타입에서 누락 시 ND-CL-09 부분 미충족.
- 제안: action 타입 버튼 처리 경로에서도 동일하게 `selectedItem`이 포함되는지 검증 필요.

---

**[WARNING] EH-DETAIL-05: Skipped 노드 제외 로직 테스트 누락**
- 위치: `execution-detail-page.test.tsx` — `makeExecution()` 픽스처
- 상세: PRD EH-DETAIL-05는 "Skipped 상태 노드는 목록에서 제외"를 필수 요구사항으로 명시. 테스트 픽스처에 `status: "skipped"` 노드가 없고, 실제 컴포넌트에서 이 필터링이 적용되는지 검증하는 테스트가 없음.
- 제안: `status: "skipped"` 인 nodeExecution을 포함한 픽스처로 렌더링 시 해당 노드가 목록에 나타나지 않음을 검증하는 테스트 추가.

---

**[WARNING] carousel `buttonConfig`가 다운스트림 입력으로 전달되는 부작용**
- 위치: `execution-engine.service.ts` — `delete cleanNodeOutput.buttonConfig` 제거
- 상세: 이전에는 `buttonConfig`를 `cleanNodeOutput`에서 제거하여 다운스트림 노드에 전달하지 않았음. 변경 후 `buttonConfig` (버튼 목록, `buttonItemMap`, timeout 설정 등)가 `cleanNodeOutput`에 포함된 채 `interactionData.nodeOutput`에 저장되고, 이 값이 다운스트림 노드의 입력 데이터로 흘러들어갈 경우 불필요한 내부 메타데이터가 노출됨. 실행 엔진에서 `updatedOutput`을 어떻게 구성하느냐에 따라 영향이 달라지나, 주석이 없어 의도가 불명확함.
- 제안: `buttonConfig`는 execution record 표시용으로만 사용되고 다운스트림 입력에는 포함되지 않음을 확인하는 테스트 또는 주석 추가.

---

**[INFO] EH-LIST-03: `pending` 상태 필터 미포함**
- 위치: `executions/page.tsx` — `FILTER_BUTTONS`
- 상세: `STATUS_LABEL`에 `pending: "Pending"`이 정의되어 있고 `ExecutionStatus` 타입에도 포함되나, FILTER_BUTTONS에는 없음. PRD EH-LIST-03에 명시된 필터 목록("Waiting for Input" 포함)에 "Pending"이 없으므로 의도적 제외로 보이나 명시적 주석이 없음.
- 제안: `pending` 제외가 의도적임을 주석으로 명시하거나 `waiting_for_input`과 동일하게 처리하는 방안 검토.

---

**[INFO] ND-CL-08: Static 모드 아이템 버튼 포트 ID와 에디터 엣지의 일관성**
- 위치: `custom-node.tsx` — static mode item buttons portDefs, `carousel.handler.ts` — static mode execute
- 상세: Static 모드에서 각 아이템 버튼은 원래 ID(예: `btn-approve-item0`)를 포트로 사용. Dynamic 모드와 달리 `__item_` 접미사 없이 원본 ID가 포트가 됨. 에디터에서 연결한 엣지 ID와 실행 시 `selectedPort`가 일치해야 하는데, static 아이템 버튼은 `buttonItemMap`에 정상 등록되므로 실행 흐름은 정확함. 다만 아이템이 추가/삭제되면 포트 ID 구조가 변경되어 기존 엣지가 끊어지는 UX 이슈 잠재.
- 제안: 스펙에 static 모드 아이템 버튼 ID 불변성 요구사항을 명시하거나, 아이템 변경 시 사용자에게 경고 제공 검토.

---

### 요약

전반적으로 캐러셀 아이템별 버튼(ND-CL-08/09) 및 실행 내역(EH-LIST/DETAIL) 핵심 기능은 구현되어 있으나, 세 가지 요구사항 충족 여부가 불확실하다. EH-DETAIL-07(선택 버튼 하이라이트)은 백엔드 데이터 지원은 되나 프론트엔드 렌더링이 diff 잘림으로 미확인이고, ND-CL-10(`source` 표현식 resolution)은 파이프라인 연결이 명시적으로 검증되지 않아 silent failure 가능성이 있으며, EH-DETAIL-05(Skipped 노드 제외)는 테스트 커버리지 없이 구현 여부가 불확실하다. `buttonConfig` 다운스트림 전달 부작용은 실행 엔진의 `updatedOutput` 구성 방식에 따라 실제 문제로 이어질 수 있어 명시적 검증이 필요하다.

### 위험도

**MEDIUM**