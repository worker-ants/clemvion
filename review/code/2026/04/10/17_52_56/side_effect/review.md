### 발견사항

- **[CRITICAL]** `multi_turn` 조건 없음 노드의 `out` 포트 제거 — 기존 엣지 단절
  - 위치: `custom-node.tsx` `outputs` useMemo, 기존 `condPorts.length === 0` 분기
  - 상세: 변경 전에는 `getNodeDefinition("ai_agent")?.outputs`(즉, 노드 정의의 기본 포트, `out` 포함)를 그대로 반환했음. 변경 후 `multi_turn` + 조건 0개 케이스는 `user_ended`, `max_turns`, `error`만 반환하고 `out`을 제거함. 이미 저장된 워크플로우에서 `multi_turn` ai_agent의 `out` 핸들에 연결된 엣지가 있다면 즉시 dangling 상태가 됨. spec의 마이그레이션 노트는 `timeout` 포트에 대해서만 언급하고 있어 이 케이스가 누락됨.
  - 제안: spec의 **마이그레이션** 섹션에 "기존 `multi_turn` ai_agent (조건 없음)의 `out` 포트에 연결된 엣지는 dangling 상태가 됨. `user_ended` 또는 `max_turns` 포트로 수동 재연결 필요" 내용을 추가할 것. 백엔드에 저장된 워크플로우 데이터가 있다면 마이그레이션 스크립트 필요 여부도 검토.

- **[WARNING]** `mode` 변수 중복 계산
  - 위치: `custom-node.tsx` lines ~48, ~63
  - 상세: `condPorts.length === 0` 분기 안에서 `mode`를 한 번 읽고, 분기 밖(conditions 존재하는 경우)에서 동일한 `(data.config.mode as string) ?? "single_turn"` 표현식을 다시 계산함. 직접적인 부작용은 없으나 두 표현식의 `??` fallback 기본값이 달라지면 미묘한 버그가 발생할 수 있음.
  - 제안: `useMemo` 상단에서 `mode`를 한 번만 추출하고 재사용.

- **[INFO]** `single_turn` 조건 없음 노드에 `error` 포트 추가 — 가산적 변경
  - 위치: `custom-node.tsx` 새 반환값 (`single_turn` 분기)
  - 상세: 노드 정의(`getNodeDefinition`)가 기존에 `error` 포트를 포함하지 않았다면, `single_turn` + 조건 0개 케이스에서 `error` 핸들이 새로 나타남. 기존 엣지는 끊어지지 않지만 UI상 포트가 추가되어 레이아웃이 달라짐. 노드 정의가 이미 `error`를 가지고 있었다면 영향 없음.
  - 제안: `getNodeDefinition("ai_agent")?.outputs` 원본 내용을 확인하여 중복/누락 없는지 검증.

- **[INFO]** 테스트 설명 변경이 실제 동작 변경과 일치함 — 정상
  - 위치: `custom-node.test.tsx` 전반
  - 상세: 테스트 이름과 assertion이 구현 변경과 정확히 대응함. `multi_turn` 조건 없음 케이스에서 `handle-out` 미존재 및 `handle-user_ended`, `handle-max_turns`, `handle-error` 존재 검증은 새 스펙을 올바르게 반영함.

---

### 요약

이 변경의 핵심 부작용은 **기존 저장된 워크플로우의 엣지 단절** 리스크다. `single_turn` 케이스는 `out` 포트 ID를 유지하므로 기존 연결에 영향이 없지만, `multi_turn` + 조건 없음 케이스는 `out` 포트를 완전히 제거하므로 해당 포트에 연결된 엣지가 dangling 상태가 된다. 코드 자체의 로직(전역 상태 오염, 네트워크 호출, 파일시스템 등)은 문제 없으며, React의 `useMemo` 범위 내 순수 계산 변경이므로 렌더링 외 부작용은 없다. 그러나 spec 마이그레이션 노트와 실제 데이터 마이그레이션 전략이 이 케이스를 다루고 있지 않다는 점이 가장 큰 위험이다.

### 위험도

**MEDIUM** — 코드 자체는 안전하나, 기존 워크플로우 데이터와의 하위 호환성 파괴 가능성이 있음. 운영 환경에 저장된 `multi_turn` ai_agent 워크플로우가 존재한다면 **HIGH**로 상향 조정 필요.