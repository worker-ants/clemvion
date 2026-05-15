## 아키텍처 코드 리뷰

### 발견사항

---

- **[WARNING]** AI Agent 포트 로직이 컴포넌트 내부에 하드코딩됨 (OCP 위반)
  - 위치: `custom-node.tsx` L43–80 (`outputs` useMemo 블록)
  - 상세: `ai_agent` 모드별 포트 구성 로직이 `CustomNode` 프레젠테이션 컴포넌트 안에 직접 내장되어 있음. 새로운 모드(예: `async_turn`, `streaming`)가 추가될 때마다 컴포넌트를 수정해야 하며, `switch`/`ai_agent`/`carousel` 등 노드 유형별 분기가 동일한 `useMemo` 안에 중첩되어 단일 책임 원칙도 침해함.
  - 제안: 포트 계산 로직을 `getAiAgentOutputPorts(config)` 형태의 순수 함수로 분리하여 `node-definitions` 레이어 또는 별도 `port-resolver` 유틸로 이동. 컴포넌트는 렌더링만 담당하도록 책임 분리.

---

- **[WARNING]** 모드 판별 로직 중복
  - 위치: `custom-node.tsx` L51–52, L63
  - 상세: `const mode = (data.config.mode as string) ?? "single_turn"` 구문이 동일 `useMemo` 블록 내에서 두 번 선언됨. 조건 분기(`condPorts.length === 0` 분기와 이후 분기) 각각에서 독립적으로 mode를 읽고 있어 변경 시 누락 위험이 있음.
  - 제안: `useMemo` 블록 상단에서 한 번만 선언하여 재사용.

---

- **[WARNING]** 포트 타입 시스템의 불완전한 추상화
  - 위치: `custom-node.tsx` 전반, `custom-node.test.tsx` L264–340
  - 상세: 포트 타입이 `"data" | "system" | "error"` 리터럴로 분산 사용되고 있으나, 이 타입 정의가 컴포넌트 파일 내 인라인 `as const` 캐스팅으로만 존재함. `node-definitions`의 출력 포트 타입과 일관성이 보장되지 않으며, 테스트도 `data-testid`로 DOM을 직접 조회하여 포트 ID 계약에만 의존함.
  - 제안: `PortType = "data" | "system" | "error"`, `PortDef = { id: string; label: string; type: PortType }` 타입을 공유 타입 파일(`node-definitions` 또는 별도 `port-types.ts`)에 선언하고 컴포넌트와 정의 파일이 동일 타입을 참조하도록 통일.

---

- **[INFO]** 스펙 변경과 구현의 Breaking Change 관리
  - 위치: `spec/4-nodes/3-ai-nodes.md` diff, `custom-node.tsx` L53–58
  - 상세: `multi_turn` 모드에서 조건 없을 때 기존 `out` 포트를 제거하고 `user_ended + max_turns + error`로 교체하는 것은 스펙 상으로 올바른 결정이나, 기존에 `out` 포트로 연결된 엣지가 있을 경우 dangling edge가 발생함. 스펙에는 `timeout` 포트에 대한 마이그레이션 주석이 있으나, `multi_turn` 의 `out → user_ended/max_turns` 포트 변경에 대한 마이그레이션 처리는 언급되지 않음.
  - 제안: 스펙 문서에 `multi_turn` 모드의 `out` 포트 제거에 따른 마이그레이션 주의사항 추가. 백엔드에서 기존 워크플로우 저장 데이터에 해당 포트가 존재하지 않음을 확인하거나, 프론트엔드 캔버스 로드 시 dangling edge 감지 로직이 이를 처리하는지 확인 필요.

---

- **[INFO]** 테스트의 구현 세부사항 의존
  - 위치: `custom-node.test.tsx` 전반
  - 상세: 테스트가 `data-testid="handle-{portId}"` DOM 선택자로 포트 존재 여부를 검증하는 방식은 현재 Mock 구조에서 합리적이나, 포트 렌더링 방식(Handle 컴포넌트 → 다른 구현)이 변경될 경우 테스트 전체가 깨질 수 있음. 테스트가 "어떤 포트 ID가 렌더링되는가"라는 계약보다 "DOM에 handle이 있는가"라는 구현에 의존하는 구조.
  - 제안: 포트 계산 로직이 순수 함수로 분리되면(`getAiAgentOutputPorts` 등) 해당 함수를 직접 단위 테스트하는 것이 더 견고한 아키텍처. UI 통합 테스트는 현 방식을 유지하되, 포트 로직 자체는 독립적으로 검증 가능하도록 구조 개선 권장.

---

### 요약

이번 변경은 스펙 정합성 측면에서 올바른 방향이며, Multi Turn AI Agent의 포트 모델을 더 명확하게 만들었다. 그러나 근본적인 아키텍처 문제는 **포트 계산 비즈니스 로직이 프레젠테이션 컴포넌트(`CustomNode`) 안에 직접 내장**되어 있다는 점이다. 현재 `outputs` useMemo는 `switch`, `ai_agent`, `carousel/table/chart/template` 등 노드 유형별 복잡한 분기를 모두 포함하며, 각 노드 유형의 포트 규칙이 변경될 때마다 컴포넌트를 수정해야 하는 구조다. 이는 OCP와 SRP를 동시에 위반하며 확장성을 저해한다. 모드 중복 선언과 타입 인라인 캐스팅은 단기적으로 관리 가능한 수준이지만, 포트 로직이 계속 복잡해질수록 유지보수 부담이 커질 것이다. Breaking change 마이그레이션 문서화 누락도 운영 안전성 측면에서 보완이 필요하다.

### 위험도

**MEDIUM**