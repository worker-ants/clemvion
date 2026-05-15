### 발견사항

- **[WARNING]** `ResolvedNodePorts` 인터페이스 이중 역할 (ISP 위반)
  - 위치: `shadow-workflow.ts` — `ResolvedNodePorts`, `NodePortResolver`
  - 상세: 기존에는 포트 **검증 전용** 입력 타입이었으나, 이번 변경으로 LLM 응답 payload (`ShadowResult.ports`) 출력 타입을 겸하게 됨. resolver가 반환해야 하는 shape과 LLM에 노출해야 하는 shape이 물리적으로 동일 인터페이스에 묶여, 향후 둘 중 한 쪽만 스키마를 바꿔야 할 때 다른 쪽도 강제로 변경됨. `InternalResolvedPorts` (검증용 id만) vs `RuntimePortDescriptor` (외부 노출용 id + type + label)로 분리하면 두 관심사를 독립적으로 진화시킬 수 있음.
  - 제안: 분리는 현재 schema가 단순하고 두 사용처 간 차이도 크지 않으므로 지금 당장 필수는 아니나, `ResolvedNodePorts`에 JSDoc으로 "이 타입은 검증 입력 겸 LLM 응답 payload"임을 명시해 다음 변경 시 분리 판단을 쉽게 할 것.

- **[WARNING]** 프론트엔드가 백엔드 에러 코드를 하드코딩 (암묵적 계층 간 결합)
  - 위치: `tool-call-badge.tsx:131` — `const RECOVERABLE = new Set(["PORT_NOT_FOUND", "NODE_NOT_FOUND"])`
  - 상세: 어떤 에러가 "자연 복구 가능"한지의 판단은 백엔드 도메인 지식(`ShadowErrorCode`)에 속하는 비즈니스 규칙이다. 이를 프레젠테이션 레이어 파일에 리터럴로 박으면, 백엔드에서 새 recoverable 코드가 추가되거나 코드명이 변경될 때 프론트엔드 변경이 누락되기 쉽고 타입 시스템이 이를 잡지 못함.
  - 제안: `@/lib/api/assistant.ts` (혹은 assistant store)에 `RECOVERABLE_TOOL_ERRORS` 상수를 정의하거나, 백엔드 응답에 `recoverable: true` 플래그를 포함시켜 프론트엔드가 코드 의미를 직접 해석하지 않도록 함.

- **[WARNING]** `ResolvedNodePorts` 파괴적 인터페이스 변경이 레이어를 횡단함 (OCP 위반)
  - 위치: `shadow-workflow.ts`, `workflow-assistant-stream.service.ts`, `shadow-workflow.spec.ts` 내 모든 resolver mock
  - 상세: `string[]` → `ShadowRuntimePort[]` 변경은 3개 레이어(도메인·서비스·테스트)에 걸친 일괄 수정을 요구함. 이번에는 모두 정확히 조율되었으나, 인터페이스가 한 추상화 경계 안에 캡슐화되지 않았기 때문에 동일 패턴의 다음 변경도 같은 비용을 치름.
  - 제안: `NodePortResolver` 타입과 `ResolvedNodePorts`를 별도 파일(`port-types.ts`)에 분리·export하면 변경 영향 범위가 한눈에 보이고, shadow 내부 구현 상세가 외부 계층으로 누수되는 것을 줄일 수 있음.

- **[INFO]** `buildRuntimePorts`가 ShadowWorkflow SRP를 소폭 확장
  - 위치: `shadow-workflow.ts:706–720`
  - 상세: 기존 ShadowWorkflow의 책임은 "워크플로 상태 복제 + tool call 시퀀스 검증"이었으나, `buildRuntimePorts`는 "LLM 응답 payload 조립"이라는 책임을 추가함. resolver가 이미 주입되어 있고 노드 state 접근이 필요하므로 이 위치가 실용적이지만, 책임이 확장되었음.
  - 제안: 현 규모에서는 수용 가능. 다만 `ShadowResult` 조립 책임이 더 커지면 `ShadowResultBuilder`를 별도로 두는 것을 고려.

- **[INFO]** truncation 시 무음 처리 (`slice(0, 50)`)
  - 위치: `shadow-workflow.ts:717–718`
  - 상세: 50개 초과 포트를 조용히 잘라냄. 현실 시나리오에서 넘을 일은 없지만, 잘못된 config로 truncation이 발생해도 호출자·LLM이 인지할 방법이 없음.
  - 제안: `resolved.outputs.length > RUNTIME_PORTS_MAX_PER_SIDE` 시 경고 로그를 찍거나, `ShadowResult`에 `portsTruncated: true` 힌트를 추가하는 방어 정책을 검토.

- **[INFO]** `mergeRecoveryGroups`의 연속 쌍(fail→success) 만 처리
  - 위치: `tool-call-badge.tsx:128–175`
  - 상세: 현재 알고리즘은 [fail count=1] → [success] 인접 쌍만 축약. 실제 LLM 응답에서 fail → explore → success처럼 중간에 다른 call이 끼면 축약되지 않음. 현재 spec 범위에서는 문제없으나, 복구 패턴이 다양해지면 한계를 드러냄.
  - 제안: 현 범위에서는 무방. 함수 JSDoc의 경계 조건 설명은 이미 충분함.

---

### 요약

ED-AI-40 변경은 전반적으로 잘 구조화되어 있다. 핵심 도메인(`ShadowWorkflow`)의 변경은 기존 DIP 패턴(portResolver 주입)을 확장하는 방식으로 일관성을 유지했고, 프론트엔드의 `mergeRecoveryGroups`는 파이프라인 후처리로 분리해 기존 grouping 로직과 관심사를 깔끔하게 분리했다. 주요 아키텍처 우려는 두 가지다: `ResolvedNodePorts`가 검증 입력과 LLM 응답 payload를 동시에 담당하면서 이중 역할을 갖게 된 점(향후 진화 비용 증가), 그리고 백엔드 에러 코드 의미론이 프론트엔드 프레젠테이션 레이어에 하드코딩된 점(암묵적 계층 간 결합). 나머지는 현 규모에서 실용적으로 수용 가능한 트레이드오프다.

### 위험도

**LOW**