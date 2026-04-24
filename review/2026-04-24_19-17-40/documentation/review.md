### 발견사항

- **[WARNING]** `system-prompt.spec.ts` 모듈 수준 docstring이 ED-AI-40 변경사항과 불일치
  - 위치: `system-prompt.spec.ts`, 파일 상단 `describe('buildSystemPrompt')` 바로 위 블록 주석 (전체 파일 컨텍스트 기준 6~12줄)
  - 상세: 현재 docstring은 다음과 같이 기술하고 있음:
    ```
    1) 노드 카탈로그가 isDynamicPorts 노드를 표시해 LLM 이 이를 보고
       `get_node_schema` 선행 호출이 필요함을 인지할 수 있도록.
    ```
    그러나 ED-AI-40 변경에서 `get_node_schema` 선행 호출은 더 이상 필수가 아니며, `add_node`/`update_node`의 `result.ports`를 우선 사용하는 방식으로 전환되었음. 테스트 케이스 자체의 인라인 주석(`// (c) ED-AI-40: ...`)은 정확히 업데이트되었으나 파일 수준 설명은 구 행동을 설명하는 채로 남아 있음.
  - 제안: 모듈 docstring을 아래와 같이 수정
    ```
    1) 노드 카탈로그가 isDynamicPorts 노드를 표시하고, add_node/update_node
       성공 응답의 result.ports 로 runtime port id 를 직접 전달해 LLM 이
       get_node_schema 선행 호출 없이 add_edge 를 수행할 수 있도록.
    ```

- **[INFO]** `tool-call-badge.tsx` — `isSameEditTarget` 함수의 `add_node` label 매칭 경로에 주석 없음
  - 위치: `tool-call-badge.tsx`, `isSameEditTarget` 함수 내 `add_node` 분기
  - 상세: `add_node`는 실패 시 `arguments.id`가 없으므로 `label` 기반으로 동일 재시도를 판별하는 fallback 경로가 있는데, 이 로직이 왜 `label`을 사용하는지(실패한 call에는 UUID가 없음) 설명하는 주석이 없어 처음 보는 독자에게 비직관적임. 현재 인라인 `// add_node 는 arguments.id 가 없는 게 정상. label 기반으로 매칭.` 주석은 *무엇*을 하는지 설명하지만 *왜* label인지(실패한 add_node에는 result.id가 없고 arguments에도 id가 없기 때문)는 빠져 있음.
  - 제안: `// add_node 실패 call 은 result.id 가 없고 arguments.id 도 정의되지 않으므로,` 를 앞에 추가

- **[INFO]** `readEdgeEndpoint` 함수에 JSDoc 없음
  - 위치: `tool-call-badge.tsx`, `readEdgeEndpoint` 함수
  - 상세: 파일의 다른 exported/private 함수들(`mergeRecoveryGroups`, `isSameEditTarget`, `isFailedCall`)은 JSDoc 또는 인라인 주석이 있으나 이 함수만 없음. snake_case/camelCase 양쪽을 수용하는 이유(`source_id` vs `sourceId` 방어)가 비직관적이므로 한 줄 주석이 도움이 됨.
  - 제안: `// LLM 이 snake_case(source_id) / camelCase(sourceId) 둘 다 사용할 수 있어 양쪽 수용.` 추가

- **[INFO]** `shadow-workflow.spec.ts` — 포트 검증 테스트 영역의 `makeResolver` 주석이 정확하게 업데이트됨
  - 위치: `shadow-workflow.spec.ts`, 포트 검증 describe 블록 내 `makeResolver` 앞 주석
  - 상세: `toDesc` 헬퍼와 배열 형태 변경(string[] → descriptor[])에 대한 설명이 한국어로 추가되어 있어 긍정적. 다만 이 주석이 diff에서만 보이는 "테스트 파일 내 문서" 이므로 별도 지적 사항 없음.

- **[INFO]** i18n 키(`toolCallBadgeRetryRecovered`) — `en.ts`와 `ko.ts` 양쪽에 추가되어 있으며 기존 주석 패턴과 일관성 유지. 추가 문서화 불필요.

---

### 요약

전반적으로 이번 변경은 문서화 품질이 높다. 새로 추가된 인터페이스(`ShadowRuntimePort`, `ResolvedNodePorts` 업데이트), 상수(`RUNTIME_PORTS_MAX_PER_SIDE`), 메서드(`buildRuntimePorts`, `mergeRecoveryGroups`) 모두 목적·제약·spec 참조(ED-AI-40 §4.3.2)가 명확한 JSDoc을 보유하고 있다. 가장 주목할 점은 `system-prompt.spec.ts` 파일 상단의 모듈 수준 docstring이 ED-AI-40 이전의 `get_node_schema` 필수 호출 패러다임을 그대로 서술하고 있어, 이후 이 파일을 처음 읽는 개발자가 현재 의도와 반대되는 설명을 먼저 접하게 된다는 점이다. 테스트 케이스 내 인라인 주석은 정확히 업데이트되었으므로 모듈 docstring 한 곳만 수정하면 된다.

### 위험도

**LOW**