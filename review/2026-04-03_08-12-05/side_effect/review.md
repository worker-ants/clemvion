## 부작용 코드 리뷰 결과

### 발견사항

---

**[WARNING] `useStore`의 ReactFlow 컨텍스트 의존성**
- 위치: `custom-node.tsx:33` — `useStore((s) => s.transform[2] >= 0.5)`
- 상세: `@xyflow/react`의 `useStore`는 ReactFlow 컨텍스트 내부에서만 동작합니다. 현재 테스트에서는 정상적으로 mock되지만, 향후 `CustomNode`를 캔버스 외부(프리뷰 패널, 문서, Storybook 등)에서 렌더링할 경우 컨텍스트 없음 오류가 발생합니다. `useExecutionStore`(Zustand)는 어디서든 안전하지만, `useStore`는 그렇지 않습니다.
- 제안: 컴포넌트 내부에서 `try/catch`로 감싸거나, `ReactFlowProvider`로 래핑하는 공용 래퍼를 만들 것을 권장합니다.

---

**[WARNING] `tableSummary`의 pagination 기본값 동작 모호성**
- 위치: `node-config-summary.ts:150-154` — `if (pagination === false)`
- 상세: `pagination`이 `undefined`(미설정)일 때 `"pagination"` 표시가 붙습니다. `false`가 아닌 모든 값을 "pagination 있음"으로 취급하므로, 아직 설정하지 않은 노드도 마치 페이지네이션이 활성화된 것처럼 보입니다. 이는 의도된 설계일 수 있으나 사용자를 오도할 수 있습니다.
- 제안: `if (!pagination)`으로 변경하거나, `pagination === true`일 때만 명시적으로 표시하도록 수정하세요.

---

**[INFO] `WARNING` 싱글톤 객체 참조 반환**
- 위치: `node-config-summary.ts:27`, `getConfigSummary` 내 반환부
- 상세: `WARNING` 상수가 참조로 반환됩니다. 호출자가 반환값을 직접 변경(`result.text = "..."`)하면 이후 모든 호출에 영향을 미칩니다. TypeScript 타입 수준에서는 막히지 않습니다.
- 제안: `return { ...WARNING }` 또는 `Object.freeze(WARNING)`으로 방어적 처리를 권장합니다.

---

**[INFO] `<p>` 요소의 `title` 속성과 Radix Tooltip 중복**
- 위치: `custom-node.tsx:131` — `title={isTruncated ? summary.text : undefined}`
- 상세: 브라우저 기본 `title` 툴팁과 Radix UI `TooltipContent`가 동시에 동작할 수 있습니다. 기본 툴팁이 먼저 나타나면 Radix 툴팁의 `delayDuration`과 충돌하여 이중 툴팁이 표시됩니다.
- 제안: `title` 속성을 제거하고 Radix Tooltip만 사용하세요.

---

**[INFO] 다수 노드의 zoom 구독 성능**
- 위치: `custom-node.tsx:34` — `useStore((s) => s.transform[2] >= 0.5)`
- 상세: 캔버스에 마운트된 모든 `CustomNode` 인스턴스가 ReactFlow 스토어의 transform 변화를 구독합니다. 줌 동작 시마다 모든 노드의 셀렉터가 평가됩니다. Boolean 반환이므로 0.5 임계점에서만 실제 리렌더가 발생하는 것은 맞으나, 셀렉터 평가 자체는 노드 수에 비례합니다. `memo` 래핑으로 리렌더는 최소화되므로 대부분 환경에서 허용 수준입니다.
- 제안: 노드가 수백 개 이상인 경우 성능을 모니터링하세요.

---

**[INFO] `TooltipProvider` 중첩 가능성**
- 위치: `workflow-canvas.tsx:368, 545`
- 상세: 상위 트리에 이미 `TooltipProvider`가 존재하는 경우 내부 Provider가 외부 Provider를 덮어씁니다. Radix UI 스펙상 허용되는 동작이나, 전체 앱에서 일관된 `delayDuration` 등의 설정이 의도치 않게 달라질 수 있습니다.
- 제안: 앱 최상위 레이아웃에서 한 번만 선언하는 방식을 권장합니다.

---

### 요약

이번 변경은 ReactFlow 캔버스의 줌 레벨에 따른 노드 설정 요약 표시 기능을 추가하는 것으로, 기존 상태나 공개 API를 변경하지 않는 순수 추가 변경입니다. 가장 주의할 부분은 `useStore`가 ReactFlow 컨텍스트에 강하게 의존하여 향후 컴포넌트 재사용 시 런타임 오류를 발생시킬 수 있다는 점과, `tableSummary`에서 `pagination` 미설정 시 기본적으로 "pagination"이 표시되는 모호한 의도입니다. 나머지는 방어적 코딩과 UX 일관성에 관한 사항들입니다.

### 위험도

**LOW**