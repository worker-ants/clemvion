### 발견사항

---

**[WARNING] `ResolvedNodePorts` 인터페이스 Breaking Change — `string[]` → `ShadowRuntimePort[]`**
- 위치: `shadow-workflow.ts` — `ResolvedNodePorts`, `NodePortResolver` 타입 정의
- 상세: `outputs`/`inputs` 필드 타입이 `string[]`에서 `ShadowRuntimePort[]`로 변경됐다. `NodePortResolver`를 구현하는 모든 코드가 반드시 새 descriptor 형태를 반환해야 한다. 현재 확인된 유일한 프로덕션 소비자(`workflow-assistant-stream.service.ts`)와 테스트 내 두 `makeResolver` 헬퍼 모두 업데이트됐다. 하지만 `shadow-workflow.spec.ts`의 두 번째 resolver 블록(line ~1766)이 별도의 `ids()` 로컬 헬퍼를 새로 정의하는 방식이 첫 번째 블록(line ~1601)의 `toDesc()` 모듈 헬퍼와 중복된다. 타입 오류는 없지만 두 헬퍼가 분리된 채 유지되면 이후 형태가 바뀔 때 하나를 놓칠 수 있다.
- 제안: `toDesc`/`ids` 둘 중 하나로 통일하거나 `describe` 블록 바깥으로 끌어올려 테스트 전체에서 공유.

---

**[WARNING] `update_node` / `add_node` 성공 응답에 `ports` 필드 신규 추가 — 프런트엔드 SSE 파싱 영향 미확인**
- 위치: `shadow-workflow.ts` `addNode`/`updateNode`, `workflow-assistant-stream.service.ts`
- 상세: `ShadowResult.ports` 필드가 새로 추가됐으며, `portResolver`가 주입된 프로덕션 경로에서는 항상 포함된다. 프런트엔드 SSE 이벤트 파싱 코드(`AssistantToolCallRecord.result` 타입)가 이 필드를 무시하거나 올바르게 수신하는지는 이번 diff에 포함된 파일에서 확인되지 않는다. 현재는 프런트엔드가 `result`를 `{ ok, id, ... }` 정도로만 읽으므로 미지의 필드는 silently 무시될 가능성이 높으나, 타입 선언과의 불일치가 발생할 수 있다.
- 제안: `AssistantToolCallRecord` (또는 `add_node`/`update_node`의 result 타입)에 `ports?: { outputs: {id: string; type?: string; label?: string}[]; inputs: ... }` 를 명시적으로 추가하여 타입 안전성 확보.

---

**[WARNING] `mergeRecoveryGroups` — `add_node` label 기반 identity 매칭의 false-positive 가능성**
- 위치: `tool-call-badge.tsx` `isSameEditTarget` 함수
- 상세: `add_node`는 `arguments.id`가 없으므로 `label`로 동일성을 판단한다. 만약 동일 label의 `add_node`가 여러 번 나타나고 그 사이에 `NODE_NOT_FOUND` 실패가 끼어있으면, 의미상 다른 두 호출이 하나의 "재시도 성공" 그룹으로 잘못 합쳐질 수 있다. 단, `RECOVERABLE` 집합이 `PORT_NOT_FOUND`와 `NODE_NOT_FOUND`로 제한되고, `add_node`에서 `NODE_NOT_FOUND`는 containerId가 없는 경우만 발생하므로 실제 충돌 빈도는 낮다.
- 제안: `add_node` 케이스를 `RECOVERABLE` 세트에서 제외하거나, 매칭 조건에 `type`까지 함께 비교하도록 보강 (`aType === bType && aLabel === bLabel`).

---

**[INFO] 시스템 프롬프트 계약 변경 — `get_node_schema` 필수 → 선택으로 전환**
- 위치: `system-prompt.ts` Dynamic-ports 섹션, Ex2
- 상세: LLM에게 주입되는 계약이 변경됐다. 이제 LLM은 `add_node`/`update_node` 성공 응답의 `result.ports`를 바로 사용해야 한다. `portResolver`가 주입된 프로덕션 경로에서는 이 필드가 항상 포함되므로 계약과 구현이 일치한다. 반면 `portResolver` 없는 레거시 경로(테스트·직접 인스턴스화)는 `result.ports`가 생략되고 프롬프트 지시와 어긋난다. 프롬프트에서도 이 조건을 명시("portResolver가 주입되지 않으면 생략")하고 있으나, LLM이 `result.ports` absent를 어떻게 처리할지 런타임 safeguard가 없다.
- 제안: 관련 없음 — 프로덕션 경로는 항상 `portResolver`가 주입되어 있어 실제 위험 없음. 문서화된 동작임.

---

**[INFO] `ToolCallBadge`의 `title` 속성 조건부 spread 패턴**
- 위치: `tool-call-badge.tsx` `ToolCallBadge` 컴포넌트
- 상세: `{...(title ? { title } : {})}` 패턴이 사용됐다. React는 `title={undefined}`를 속성에서 제거하므로 `title={title}`로 단순화해도 동일하게 동작한다. 현재 패턴이 틀린 건 아니지만 불필요하게 복잡하다.
- 제안: `title={title}` 로 단순화.

---

**[INFO] 히스토리 메시지의 배지 표시 소급 변경**
- 위치: `tool-call-badge.tsx` `groupToolCalls` 반환값 변경
- 상세: `groupToolCalls`가 이제 `mergeRecoveryGroups`를 거쳐 반환된다. 이미 어시스턴트 스토어에 저장된 이전 대화의 메시지도 다음 렌더 시 새 그룹 로직으로 재계산된다. 즉, 이전에는 별도 실패/성공 배지 두 개로 보이던 항목이 "재시도 후 성공" 단일 배지로 소급 변경될 수 있다. 이는 의도된 UX 개선이지만, 스토어가 원본 call 배열을 보존하므로 실제 데이터 손실은 없다.
- 제안: 의도된 동작이므로 조치 불필요. 단, QA 시 기존 대화 이력에서 배지가 올바르게 렌더되는지 확인 권장.

---

### 요약

이번 변경의 가장 큰 부작용 리스크는 `ResolvedNodePorts` 인터페이스 Breaking Change다. 현재 확인된 모든 소비자(`workflow-assistant-stream.service.ts`, 두 spec 파일의 mock resolver)는 빠짐없이 업데이트됐고, 외부 소비자도 없어 실질적인 런타임 오류 위험은 낮다. `ShadowResult.ports` 신규 필드가 프런트엔드 타입 선언에 반영되지 않았을 가능성과, `add_node` label 기반 recovery 매칭의 엣지 케이스가 낮은 위험으로 남아 있다. 나머지 변경(i18n 키 추가, 시스템 프롬프트 업데이트, 테스트 보강)은 의도된 부작용이며 unintended side-effect는 없다.

### 위험도

**LOW**