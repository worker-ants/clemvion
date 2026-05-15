## 성능 코드 리뷰

### 발견사항

- **[INFO]** `useMemo` 내 중복 `mode` 변수 선언
  - 위치: `custom-node.tsx`, `outputs` useMemo 블록 (condPorts.length === 0 분기 및 그 이후)
  - 상세: `const mode = (data.config.mode as string) ?? "single_turn"`이 `condPorts.length === 0` 블록 내부와 블록 외부에 각각 한 번씩, 총 두 번 선언됨. 조건에 따라 한 번만 실행되므로 런타임 비용은 없지만 불필요한 코드 중복이며, 향후 조건 분기가 추가되면 실수의 여지가 있음.
  - 제안: `condPorts` 계산 직후 한 번만 선언하고 두 분기에서 공유.

```tsx
// 변경 전 (두 곳에 중복)
if (condPorts.length === 0) {
  const mode = (data.config.mode as string) ?? "single_turn";
  ...
}
const mode = (data.config.mode as string) ?? "single_turn";

// 변경 후
const mode = (data.config.mode as string) ?? "single_turn";
if (condPorts.length === 0) {
  ...
}
```

- **[INFO]** `useMemo` 의존성 배열이 `data.config` 전체를 참조
  - 위치: `custom-node.tsx:32` — `useMemo(..., [data.type, data.config])`
  - 상세: `data.config`는 객체 참조 비교이므로 부모가 config 객체를 매 렌더마다 새로 생성하면 `useMemo`가 매번 재실행됨. 이번 변경과 직접 관련은 없으나, AI Agent 포트 로직이 `mode`와 `conditions` 두 필드만 사용하므로 세분화된 의존성이 더 효율적.
  - 제안: 현재 구조를 크게 바꾸지 않는 선에서, 부모 컴포넌트에서 config를 안정적 참조로 관리하거나 `data.config.mode`, `data.config.conditions` 등 실제 사용 필드만 의존성에 나열하는 것을 고려. (단, 다른 노드 타입들도 config 전체를 소비하므로 전체 의존성 제거는 어렵고, 이는 기존 설계 문제.)

- **[INFO]** 테스트 파일: `renderNode` 헬퍼가 매 테스트마다 동일한 기본 props 객체를 재생성
  - 위치: `custom-node.test.tsx:46–69`
  - 상세: `renderNode`가 호출될 때마다 `defaultData`, `props` 객체를 새로 생성하는 것은 테스트 격리 측면에서 올바른 패턴이며 성능 문제가 아님. 단, `width: 180, height: 80` 등 고정값은 상수로 분리하면 가독성이 향상되나 성능 영향은 없음.

---

### 요약

이번 변경은 AI Agent 노드의 포트 렌더링 로직을 `mode` 값에 따라 분기하는 단순한 조건 추가로, 성능에 실질적인 영향을 주는 변경사항은 없다. 유일한 개선 여지는 `useMemo` 블록 내 `mode` 변수의 중복 선언인데, 이는 런타임 비용보다는 코드 품질 문제에 가깝다. `useMemo`의 의존성 배열에 `data.config` 전체가 포함된 기존 패턴은 이번 변경과 무관하게 존재하는 구조적 특성으로, 현재 노드 수 규모에서는 허용 가능한 수준이다. 전체적으로 성능 관점의 위험 요소는 없다.

### 위험도

**NONE**