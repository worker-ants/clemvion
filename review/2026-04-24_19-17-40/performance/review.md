### 발견사항

- **[WARNING]** `RECOVERABLE` Set이 매 호출마다 재생성됨
  - 위치: `tool-call-badge.tsx` — `mergeRecoveryGroups` 함수 내부
  - 상세: `const RECOVERABLE = new Set(["PORT_NOT_FOUND", "NODE_NOT_FOUND"])` 가 함수 내에 선언되어, 메시지가 렌더될 때마다 (=toolCalls 배열이 참조된 매 렌더마다) Set 객체가 새로 할당됨. `mergeRecoveryGroups`는 `groupToolCalls` → `AssistantMessageView` 렌더 경로에서 호출되어, 채팅 패널에 메시지가 많을수록 반복 횟수가 선형 증가함.
  - 제안: 모듈 스코프 상수로 끌어올림. `const RECOVERABLE_ERRORS = new Set(["PORT_NOT_FOUND", "NODE_NOT_FOUND"]);` 를 파일 최상단에 선언.

- **[INFO]** `buildRuntimePorts`의 무조건적 `.slice()` 복사
  - 위치: `shadow-workflow.ts` — `buildRuntimePorts` 메서드 (라인 약 704–718)
  - 상세: `resolved.outputs.slice(0, RUNTIME_PORTS_MAX_PER_SIDE)` 는 배열 길이가 50 미만이어도 항상 새 배열을 할당함. 실제 동적 포트 수는 대부분 한 자릿수이므로, 99%의 경우 불필요한 복사 발생. `add_node`/`update_node` 성공 시마다 실행되는 경로.
  - 제안:
    ```typescript
    outputs: resolved.outputs.length <= RUNTIME_PORTS_MAX_PER_SIDE
      ? resolved.outputs
      : resolved.outputs.slice(0, RUNTIME_PORTS_MAX_PER_SIDE),
    ```

- **[INFO]** `portResolver` 내 조건부 spread로 인한 단기 객체 할당
  - 위치: `workflow-assistant-stream.service.ts` — `portResolver` 클로저 (라인 약 308–325)
  - 상세: `...(p.label ? { label: p.label } : {})` 패턴이 label이 없는 포트마다 빈 `{}` 객체를 생성 후 즉시 파기함. 포트 수 × 노드 수만큼 단기 객체가 발생하여 GC 압력을 소폭 높임.
  - 제안:
    ```typescript
    const port: ShadowRuntimePort = {
      id: p.id,
      type: p.type === 'error' ? 'error' : 'data',
    };
    if (p.label) port.label = p.label;
    return port;
    ```

- **[INFO]** `t("assistant.toolCallBadgeRetryRecovered")` 무조건 호출
  - 위치: `tool-call-badge.tsx` — `ToolCallBadge` 컴포넌트
  - 상세: `retried`가 false인 일반 배지에서도 번역 조회가 항상 실행됨. 배지 수가 많은 턴에서는 불필요한 i18n 조회가 누적됨.
  - 제안: `const retrySuffix = retried ? \` (${t("...")})\` : "";` 에서 삼항 내부를 `retried && t(...)` 로 단락평가 처리하거나, `useMemo`로 메모이제이션.

---

### 요약

ED-AI-40 변경은 런타임 포트 정보를 `add_node`/`update_node` 응답에 인라인으로 포함시켜 LLM의 `get_node_schema` 선행 호출을 제거한다는 설계 의도가 명확하고, 전체적인 알고리즘 복잡도·캐싱 전략·데이터 구조 선택은 적절하다. 성능 우려는 모두 마이크로 최적화 수준으로, 실 서비스 병목이 될 가능성은 낮다. 단, `mergeRecoveryGroups` 내 `RECOVERABLE` Set 재생성은 모듈 상수로 끌어올리는 것이 관례상 옳고, `buildRuntimePorts`의 무조건 `.slice()` 복사는 분기 한 줄로 제거 가능하므로 합쳐서 수정할 만하다.

### 위험도

**LOW**