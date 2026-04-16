### 발견사항

- **[WARNING]** 모듈 레벨 가변 카운터 — SSR 하이드레이션 불일치 위험
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/shared.tsx` — `checkboxIdCounter` 변수 및 `nextCheckboxId()` 함수
  - 상세: `checkboxIdCounter`는 모듈 스코프의 가변 변수(`let`)로 선언되어 있음. Next.js SSR 환경에서는 모든 요청이 같은 모듈 인스턴스를 공유하므로, 서버에서 렌더링할 때 누적된 카운터 값(`N`)으로 `cb-N` ID가 생성되지만, 클라이언트에서는 카운터가 `0`부터 다시 시작해 `cb-1`이 생성됨. 이 불일치는 React hydration 경고(또는 silent mismatch)를 유발하고, `<label htmlFor>` ↔ `<input id>` 연결이 끊어져 접근성이 깨짐.
  - React 18 Concurrent 렌더링(Suspense, time-slicing)에서는 컴포넌트가 커밋 없이 여러 번 렌더될 수 있어 카운터가 예상보다 빠르게 증가하는 추가 부작용도 있음.
  - 제안: 모듈 레벨 카운터 대신 React 18이 기본 제공하는 `useId()` 훅을 사용하면 SSR/CSR 모두에서 결정적이고 일관된 ID가 보장됨.

```tsx
// 수정 전
let checkboxIdCounter = 0;
function nextCheckboxId() {
  checkboxIdCounter += 1;
  return `cb-${checkboxIdCounter}`;
}

export function CheckboxField({ label, checked, onChange }) {
  const id =
    typeof label === "string"
      ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
      : nextCheckboxId();
  // ...
}

// 수정 후
export function CheckboxField({ label, checked, onChange }) {
  const reactId = useId();          // import { useId } from "react"
  const id =
    typeof label === "string"
      ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
      : `cb-${reactId}`;
  // ...
}
```

---

### 요약

변경된 코드는 대부분 MDX 문서 인프라 추가, UI 컴포넌트(CanvasEmptyState, FieldHelp), CSS 스타일, 문서 파일로 구성되어 있어 실질적인 동시성 문제가 없음. 단, `shared.tsx`에서 모듈 레벨 가변 카운터(`checkboxIdCounter`)를 도입한 부분은 Next.js SSR 환경에서 서버-클라이언트 렌더링 간 ID 불일치를 일으킬 수 있는 잠재적 hytdration 버그임. JavaScript가 단일 스레드이므로 실제 경쟁 조건(race condition)은 아니지만, SSR 특성상 서버 누적값과 클라이언트 초기값이 달라지는 구조적 결함이 있으며, `useId()` 훅으로 간단히 해결 가능함.

### 위험도
**LOW**