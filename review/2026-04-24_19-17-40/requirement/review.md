## 발견사항

### [WARNING] `system-prompt.spec.ts` 파일 헤더 주석이 ED-AI-40 이후 사실과 반대
- **위치**: `system-prompt.spec.ts` 파일 상단 docblock (변경 미포함 구간, 1~12번 줄)
- **상세**: 헤더 주석 1번 항목이 "LLM 이 isDynamicPorts 노드를 보고 `get_node_schema` 선행 호출이 필요함을 인지할 수 있도록" 라고 서술. 그러나 ED-AI-40은 정반대 — `result.ports`를 사용하도록 변경했고 `get_node_schema` 선행 호출은 더 이상 필수 아님. 같은 파일에서 `it` 설명과 주석은 올바르게 수정됐지만 docblock은 놓쳤음.
- **제안**: docblock 1)번 항목을 "add_node/update_node 성공 응답의 result.ports 로 live 포트 id를 공급해, LLM이 별도 get_node_schema 없이 add_edge 를 수행할 수 있도록" 로 수정.

---

### [WARNING] `update_node` 성공 응답의 `result.ports` 내용 검증 테스트 누락
- **위치**: `shadow-workflow.spec.ts`, `update_node` describe 블록
- **상세**: `buildRuntimePorts`는 `addNode`와 `updateNode` 양쪽 성공 경로에 동일하게 적용되지만, 포트 내용 검증 테스트 3개(`returns runtime ports on success`, `omits ports when no portResolver`, `caps at 50 per side`)는 모두 `add_node` 경로만 커버. `update_node` 호출 후 `result.ports`가 정확히 채워지는지, portResolver 없을 때 생략되는지, 50개 상한이 동작하는지 명시적으로 검증되지 않음.
- **제안**: `update_node` describe 블록에 동일 3가지 케이스의 미러 테스트 추가.

---

### [WARNING] `isSameEditTarget`에서 `add_node`의 레이블 비교가 `NODE_NOT_FOUND` 시나리오와 맞지 않음
- **위치**: `tool-call-badge.tsx`, `isSameEditTarget` 함수 내 `add_node` 분기
- **상세**: `add_node`가 `NODE_NOT_FOUND`를 반환하는 유일한 경로는 `containerId`가 존재하지 않을 때. 이 경우 LLM이 재시도할 때 보통 `containerId`를 수정하면서 `label`은 그대로 두는데, 이 경우에는 병합이 정상 동작. 그러나 `RECOVERABLE` set에 `NODE_NOT_FOUND`가 포함되어 있어 `add_node:NODE_NOT_FOUND → add_node:success(same label)` 경로가 recovery 대상이 됨. 이 경우에 대한 명시적 테스트가 없어 의도적 지원인지 불명확.
- **제안**: `tool-call-badge.test.ts`에 `add_node` + `NODE_NOT_FOUND` (containerId 오류 시나리오) recovery 케이스 테스트 추가 또는, `RECOVERABLE` 체크를 `add_edge`/`update_node`/`remove_node`만으로 제한.

---

### [INFO] `mergeRecoveryGroups`에서 연속 실패 2건 후 성공 시 두 번째 실패만 흡수
- **위치**: `tool-call-badge.tsx`, `mergeRecoveryGroups`
- **상세**: 실패(count=1) → 실패(count=1) → 성공 순서일 때, 첫 번째 실패는 그대로 노출되고 두 번째 실패만 성공과 병합됨. 사용자는 첫 번째 실패 배지를 여전히 봄. 스펙 의도와 부합하지만, `count=1 실패가 여러 번 쌓이는 시나리오`에 대한 테스트가 없어 검증되지 않은 경계 케이스.
- **제안**: 실패 × 2 → 성공 시나리오의 테스트 추가 (`[fail1, fail2(retried-success)]` 형태로 동작하는지 명시화).

---

### [INFO] `portResolver` 반환 `null` 시 캡 로직 우회
- **위치**: `shadow-workflow.ts`, `buildRuntimePorts` 메서드
- **상세**: `portResolver(node)`가 `null`을 반환하면 `buildRuntimePorts`도 `null`을 반환 → 응답에 `ports` 필드가 생략. 이는 "검사 비활성화 = permissive" 의도와 일치하지만, portResolver가 주입됐음에도 특정 노드 타입에 대해 `null`을 반환하는 경우(미등록 타입 등) 에도 동일하게 `ports`가 생략됨. LLM 입장에서는 해당 노드가 포트가 없는 건지 resolver가 미지원인 건지 구분 불가.
- **제안**: 현재 설계가 의도적이라면 문서에 명시, 또는 미지원 타입에 대한 `result.ports` 생략 이유를 hint로 포함 검토 (영향 범위가 크므로 INFO 수준).

---

### [INFO] `remove_node` recovery 경로에 대한 테스트 미포함
- **위치**: `tool-call-badge.test.ts`
- **상세**: `isSameEditTarget`이 `remove_node`를 처리하지만(`a.name === "remove_node"` 분기 존재), recovery 테스트는 `add_edge`와 `update_node`만 커버. `remove_node` → `NODE_NOT_FOUND` → 같은 id로 성공하는 경로 미검증.
- **제안**: `remove_node` recovery 케이스 테스트 추가.

---

### [INFO] `workflow-assistant-stream.service.ts`에서 비-error 포트 타입 정규화 테스트 없음
- **위치**: `workflow-assistant-stream.service.ts`, portResolver 클로저 내 outputs 매핑
- **상세**: `p.type === 'error' ? 'error' : 'data'` 로 system/control 등 기타 타입을 모두 'data'로 정규화. 동작이 명확하지만, 정규화 결과가 `ShadowResult.ports`를 통해 LLM에 노출되는 만큼, 실제 포트 type 다양성이 있는 노드에 대한 통합 테스트가 없어 회귀 발견이 어려움.
- **제안**: `resolveEffectiveOutputPorts`가 non-error/non-data type 포트를 반환하는 케이스에 대한 스냅샷 또는 단위 테스트 추가 검토.

---

## 요약

ED-AI-40 요구사항 — `add_node`/`update_node` 응답에 `result.ports` 자동 포함, `get_node_schema` 필수에서 선택으로 강등, 재시도-복구 배지 UI — 은 전반적으로 완전하게 구현되었다. `ShadowRuntimePort` 타입 도입, `buildRuntimePorts` 메서드, `mergeRecoveryGroups` 로직, 시스템 프롬프트 업데이트, i18n 키 추가까지 의도와 구현이 일치한다. 다만 `update_node` 경로의 `result.ports` 내용 검증 테스트 누락, 파일 헤더 docblock 미갱신이 회귀 위험을 높이며, `remove_node` recovery 경로 미검증과 연속 실패 시나리오 커버리지 부재가 경계값 처리 관점에서 보완이 필요하다.

## 위험도

**LOW**