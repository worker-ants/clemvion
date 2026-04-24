### 발견사항

- **[WARNING]** `update_node` 성공 경로의 `result.ports` 미테스트
  - 위치: `shadow-workflow.spec.ts` — 새로 추가된 3개의 `add_node` 테스트
  - 상세: `buildRuntimePorts`는 `addNode`와 `updateNode` 두 경로 모두에서 호출되지만, 신규 테스트는 `add_node`만 커버한다. `update_node({ ok: true })` 응답에 `ports`가 올바르게 포함되는지 검증하는 케이스가 없다.
  - 제안: `update_node` describe 블록에 `portResolver` 주입 상태에서 `result.ports`가 반환되는지 확인하는 테스트를 추가한다.

- **[WARNING]** `portResolver` 타입 변경(`string[]` → `ShadowRuntimePort[]`)에 대한 서비스 단위 테스트 부재
  - 위치: `workflow-assistant-stream.service.ts`의 `portResolver` 구현
  - 상세: resolver 반환 타입이 `string[]`에서 `ShadowRuntimePort[]`로 바뀐 것은 계약 변경이지만, `WorkflowAssistantStreamService`에 대한 테스트 파일이 이 PR에 없다. `p.type === 'error'`가 아닌 경우(`'system'`, `'control'` 등)를 `'data'`로 정규화하는 로직도 비검증 상태다.
  - 제안: 스트림 서비스의 `portResolver` 빌드 로직을 단위 테스트하거나, 최소한 `p.type`이 `'error'`·`'data'` 외 값일 때 정규화가 올바른지 확인하는 테스트를 추가한다.

- **[WARNING]** `mergeRecoveryGroups`의 연속 복구 쌍 미테스트
  - 위치: `tool-call-badge.test.ts` — `recovery merge` describe
  - 상세: `[fail_A → success_A → fail_B → success_B]` 순열에서 두 쌍이 모두 독립적으로 `retried` 그룹으로 축약되는지 검증이 없다. 루프 내 `i++` 건너뜀 로직이 연속 두 번 작동하는 경로를 커버해야 한다.
  - 제안: 두 개의 연속 PORT_NOT_FOUND → 성공 시퀀스가 각각 하나의 retried 그룹으로 묶이는지 테스트를 추가한다.

- **[INFO]** `isSameEditTarget`에서 `remove_node` 복구 경로 미테스트
  - 위치: `tool-call-badge.test.ts` — `recovery merge` describe
  - 상세: `isSameEditTarget`이 `remove_node`를 명시적으로 처리하지만 RECOVERABLE 에러(NODE_NOT_FOUND) + `remove_node` 조합에 대한 테스트가 없다.
  - 제안: `remove_node`에서 NODE_NOT_FOUND → 성공 시퀀스에 대한 케이스를 추가한다.

- **[INFO]** `add_node`의 label 기반 `isSameEditTarget` 폴백 — 실질적으로 도달 불가능한 코드
  - 위치: `tool-call-badge.tsx:isSameEditTarget`, `tool-call-badge.test.ts`
  - 상세: `add_node`는 `RECOVERABLE` 에러(PORT_NOT_FOUND, NODE_NOT_FOUND)를 반환하지 않으므로 `add_node`에서 label 기반 매칭 분기는 실제 실행되지 않는다. 기존 테스트의 `LABEL_CONFLICT` 케이스는 이 경로를 커버하지 않는다.
  - 제안: 실제로 `add_node` + `PORT_NOT_FOUND`가 발생할 수 없다면 `isSameEditTarget`에서 `add_node` 분기를 제거하거나, 의도적으로 남겨두는 이유를 주석에 명시한다.

- **[INFO]** `toDesc` / `ids` 헬퍼 중복 정의
  - 위치: `shadow-workflow.spec.ts` — line ~1601의 `makeResolver` 블록과 line ~1766 루프 테스트 블록
  - 상세: 두 describe 블록이 동일 변환(`id 문자열 배열 → descriptor 배열`)을 각각 `toDesc`, `ids`라는 다른 이름으로 독자 정의한다. 동작은 동일하지만 관리 지점이 분산된다.
  - 제안: 파일 상단에 공유 헬퍼로 추출하거나, 기존 ED-AI-40 신규 테스트의 인라인 resolver와 통합한다.

- **[INFO]** `system-prompt.spec.ts` 주석의 설명이 구현 의도와 불일치
  - 위치: `system-prompt.spec.ts` 파일 상단 블록 주석 (4~12번째 줄)
  - 상세: 파일 상단 주석("노드 카탈로그가 isDynamicPorts 노드를 표시해 LLM이 `get_node_schema` 선행 호출이 필요함을 인지할 수 있도록")은 ED-AI-40 이후 바뀐 의미를 반영하지 않았다. 이제 `get_node_schema`는 선행 필수 호출이 아니며, 이 설명이 남아있으면 차후 독자 혼란을 유발한다.
  - 제안: 파일 상단 주석을 ED-AI-40 기준("edit 결과의 `result.ports`를 직접 사용, `get_node_schema`는 pre-existing 노드에만 예외적으로")으로 업데이트한다.

---

### 요약

전반적으로 테스트 구조는 양호하다. ED-AI-40의 핵심 변경(add_node 성공 응답에 `result.ports` 포함, 포트 검증에서 descriptor 사용, 재시도 복구 배지)에 대한 단위 테스트가 추가되었고 경계값(50개 상한, resolver 미주입, camelCase 인자)도 커버된다. 그러나 `update_node` 성공 경로의 `ports` 반환 검증 누락, 서비스 레이어 resolver 타입 변경에 대한 테스트 부재, 연속 복구 쌍 시나리오 미검증이 실제 회귀 위험으로 남는다. 특히 `portResolver`의 타입 계약 변경(`string[]` → `ShadowRuntimePort[]`)은 호출 사이트가 많을수록 묵시적 실패를 유발할 수 있으므로, 서비스 단위 테스트 추가가 필요하다.

### 위험도

**MEDIUM**