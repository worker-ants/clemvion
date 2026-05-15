## 의존성 코드 리뷰

### 발견사항

---

**[WARNING]** `@xyflow/react` 내부 구현 세부사항에 직접 접근
- 위치: `custom-node.tsx:33` — `useStore((s) => s.transform[2])`
- 상세: `s.transform[2]`는 `@xyflow/react`의 내부 상태 구조(줌 레벨을 배열 인덱스로 접근)로, 공개 API가 아닙니다. 라이브러리 버전 업그레이드 시 `transform` 배열의 구조가 변경되면 무음 버그(silent bug)가 발생할 수 있습니다.
- 제안: 공개 훅인 `useViewport()`로 교체하세요.
  ```tsx
  import { useViewport } from "@xyflow/react";
  const { zoom } = useViewport();
  const showSummary = zoom >= 0.5;
  ```

---

**[INFO]** `@radix-ui/react-tooltip` 신규 외부 의존성
- 위치: `tooltip.tsx` 전체
- 상세: shadcn/ui 패턴을 따르는 Radix UI 컴포넌트 래퍼입니다. 프로젝트가 이미 `@xyflow/react`, Radix UI 기반 컴포넌트들을 사용하고 있으므로 생태계 일관성은 유지됩니다. MIT 라이선스로 호환성 문제 없음. 단, `package.json`에 명시적으로 추가되었는지 확인이 필요합니다.
- 제안: `package.json`에 `@radix-ui/react-tooltip`가 포함되어 있는지 확인하고, 없다면 추가하세요.

---

**[INFO]** `LANG_DISPLAY` 객체가 함수 내부에서 매 호출마다 재생성
- 위치: `node-config-summary.ts` — `codeSummary` 함수 내 `const LANG_DISPLAY`
- 상세: 의존성 이슈는 아니지만, 상수 객체를 함수 스코프 내에 정의하면 호출마다 새 객체가 생성됩니다. 모듈 레벨로 이동하는 것이 적절합니다.
- 제안: 다른 상수들(`OPERATOR_DISPLAY`, `UNARY_OPERATORS`)과 같이 모듈 최상단으로 이동.

---

**[INFO]** `TooltipProvider`의 배치 범위
- 위치: `workflow-canvas.tsx:368,551`
- 상세: `TooltipProvider`가 `WorkflowCanvas` 컴포넌트 전체를 래핑하고 있습니다. 앱 레벨 레이아웃에 이미 `TooltipProvider`가 있다면 중복 Provider 중첩이 발생할 수 있습니다 (기능적 문제는 없으나 불필요한 중첩).
- 제안: 앱 루트 레이아웃(`layout.tsx` 등)에 `TooltipProvider`가 이미 있는지 확인하세요. 있다면 `workflow-canvas.tsx`의 Provider는 제거해도 됩니다.

---

### 요약

이번 변경에서 실질적인 신규 외부 의존성은 `@radix-ui/react-tooltip` 하나로, MIT 라이선스이며 기존 Radix UI 생태계와 일관됩니다. 번들 크기 영향도 경미합니다. 주요 위험은 `useStore((s) => s.transform[2])`를 통해 `@xyflow/react`의 내부 구현에 직접 결합한 부분으로, 공개 API인 `useViewport()`로 교체해야 합니다. 나머지 내부 의존성(`node-config-summary.ts`, `tooltip.tsx`)은 순방향 의존성 구조를 올바르게 따르고 있으며 순환 의존성 우려도 없습니다.

### 위험도

**LOW** — `useStore` 내부 API 접근 문제가 잠재적 런타임 버그 가능성이 있으나 즉각적 장애는 아님. `@radix-ui/react-tooltip` 추가는 정상적인 의존성 확장입니다.