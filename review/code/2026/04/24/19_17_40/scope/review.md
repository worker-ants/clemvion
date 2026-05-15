### 발견사항

**[INFO]** `ShadowRuntimePort.type` / `.label` 필드 추가 — 코어 요건보다 약간 확장된 shape
- 위치: `shadow-workflow.ts` `ShadowRuntimePort` 인터페이스, `workflow-assistant-stream.service.ts` resolver 변환 로직
- 상세: ED-AI-40의 핵심 요건은 "add_node/update_node 성공 시 port id 목록 반환"이지만, 실제 구현은 `{ id, type?, label? }` 디스크립터 형태로 확장됨. `type` 필드는 LLM이 error 포트에 대해 `add_edge({ type: 'error' })` 를 정확히 쓰도록 하기 위해, `label` 은 dynamic 포트의 사용자 표시 문자열을 전달하기 위해 추가.
- 제안: 추가 필드 모두 `result.ports` 를 소비하는 LLM 측에서 즉시 필요한 정보이므로 과도한 확장으로 보기 어렵고, 시스템 프롬프트의 `type: 'error'` 안내(file 2)와 정합성이 맞아야 하므로 현 설계가 타당. 단, `label` 필드는 현재 프롬프트 교육에서 별도 언급이 없어 향후 "label 을 source_port 에 실수로 쓰는" 새 실수 벡터가 열릴 수 있음. INFO 수준으로만 기록.

**[INFO]** `isSameEditTarget`에서 `add_node` 레이블 기반 매칭 포함
- 위치: `tool-call-badge.tsx:isSameEditTarget`
- 상세: `add_node` 의 NODE_NOT_FOUND(containerId 미존재) → 성공 패턴도 레이블 기준으로 recovery merge 대상이 됨. RECOVERABLE 집합이 PORT_NOT_FOUND / NODE_NOT_FOUND 만 포함하므로 실질적 영향은 제한적이나, `add_node`가 NODE_NOT_FOUND를 반환하는 시나리오가 실제로 발생하는지 명확하지 않음.
- 제안: `add_node` 분기를 `isSameEditTarget` 에서 제거하거나, 해당 경로를 커버하는 테스트를 추가해 의도를 명시할 것. 현재는 `"does NOT collapse other error codes like LABEL_CONFLICT"` 테스트만 있고 `add_node + NODE_NOT_FOUND` 케이스는 미검증.

---

### 요약

전체 변경사항은 ED-AI-40의 두 하위 기능("edit 결과에 런타임 포트 포함" + "재시도 후 성공 배지 축약")에 집중되어 있다. 백엔드의 `ResolvedNodePorts` 타입 변경(string[] → descriptor[])은 breaking 변경이지만 모든 호출지점이 일관되게 갱신되었고, 프론트엔드의 `mergeRecoveryGroups` 로직과 i18n 키 추가는 UI 요건에 최소한으로 대응한다. 무관한 리팩토링, 불필요한 포맷팅 변경, 관련 없는 파일 수정은 발견되지 않는다.

### 위험도

**NONE**