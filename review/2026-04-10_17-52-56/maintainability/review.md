### 발견사항

- **[WARNING]** `useMemo` 내 `ai_agent` 분기 로직에서 `mode` 변수가 중복 선언됨
  - 위치: `custom-node.tsx`, `condPorts.length === 0` 블록 내부 및 그 이후 (라인 ~55, ~65)
  - 상세: `const mode = (data.config.mode as string) ?? "single_turn"`이 `if (condPorts.length === 0)` 블록 안에서 한 번, 블록 밖에서 다시 한 번 선언됨. 중복 선언으로 인해 미래에 한 쪽만 수정하는 실수가 발생하기 쉬움
  - 제안: `mode`를 블록 진입 전에 한 번만 선언하여 두 분기가 공유하도록 끌어올림

  ```ts
  const mode = (data.config.mode as string) ?? "single_turn";
  if (condPorts.length === 0) {
    if (mode === "multi_turn") { ... }
    return [...];
  }
  // 이후 mode 재사용
  ```

- **[WARNING]** `useMemo` 콜백이 단일 함수로 보기에 너무 길고 복잡함
  - 위치: `custom-node.tsx`, `outputs` useMemo 전체
  - 상세: `switch`, `ai_agent`, `carousel/table/chart/template` 등 여러 노드 타입 분기가 하나의 useMemo 안에 200줄 가까이 중첩됨. 순환 복잡도가 높아 새 노드 타입 추가 시 사이드 이펙트를 파악하기 어려움
  - 제안: 각 노드 타입의 포트 계산 로직을 `getAiAgentOutputs(config)`, `getPresentationOutputs(config, type)` 같은 순수 함수로 분리하여 `useMemo` 내부는 디스패치만 담당하도록 리팩토링 고려

- **[INFO]** 테스트 설명이 구현 사양 변경을 정확히 반영했으나, "system ports"라는 표현이 포트 `type` 필드값(`"system"`)과 혼용됨
  - 위치: `custom-node.test.tsx`, 라인 300 `"renders multi_turn ai_agent with system ports when no conditions"`
  - 상세: 테스트 명칭의 "system ports"는 `user_ended`, `max_turns`, `error` 세 포트를 통칭하지만, 코드에서는 `error` 포트의 `type`은 `"error"`, 나머지만 `"system"`. 용어가 불일치하여 처음 읽는 사람에게 혼동 소지 있음
  - 제안: 테스트 설명을 `"renders multi_turn ai_agent with user_ended, max_turns, and error ports when no conditions"` 또는 `"renders multi_turn ai_agent with termination ports when no conditions"`로 구체화

- **[INFO]** 스펙 문서와 구현 간 포트 색상 규칙이 조건 없는 경우에 명시적으로 기술되지 않음
  - 위치: `spec/4-nodes/3-ai-nodes.md`, "포트 시각적 구분" 섹션
  - 상세: 스펙의 시각적 구분 설명이 "조건 ≥ 1인 경우"로 한정되어 있어 조건 0개일 때의 포트 색상 규칙이 스펙에 명시되어 있지 않음. 구현은 동일한 색상 규칙을 적용하고 있으나, 스펙과 구현 사이에 암묵적 가정이 존재함
  - 제안: 스펙 문서에 "조건이 0개인 경우에도 동일한 포트 타입별 색상 규칙 적용" 문구 추가

---

### 요약

이번 변경은 Multi Turn AI Agent의 기본 포트를 하위 호환 방식(`out` 포트)에서 모드 의미론적으로 정확한 전용 포트(`user_ended`, `max_turns`, `error`)로 전환하는 스펙 개정과 그 구현이다. 스펙-구현-테스트가 일관되게 갱신된 점은 긍정적이나, `custom-node.tsx`의 `outputs` useMemo 내에서 `mode` 변수가 중복 선언되는 문제가 가장 직접적인 유지보수 위험 요소다. 해당 블록은 이미 복잡도가 높은 분기 구조를 가지고 있어, 추후 새로운 모드나 포트 타입이 추가될 때 오류가 발생하기 쉬운 구조다. 테스트 커버리지 자체는 충분하며, 변경된 동작에 대한 케이스도 적절히 추가되었다.

### 위험도

**LOW**