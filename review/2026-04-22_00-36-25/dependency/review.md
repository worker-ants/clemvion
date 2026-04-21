## 의존성 코드 리뷰

### 발견사항

- **[INFO]** `lucide-react`에서 `Send` 아이콘 추가 사용
  - 위치: `frontend/src/components/editor/assistant-panel/plan-card.tsx` L3
  - 상세: `lucide-react`는 이미 프로젝트 의존성에 포함되어 있으며, 같은 파일에서 `Check`, `CircleDashed`, `AlertCircle`을 import하고 있음. 신규 패키지 추가 없음.
  - 제안: 해당 없음.

- **[INFO]** React `useState` 추가 import
  - 위치: `frontend/src/components/editor/assistant-panel/plan-card.tsx` L1
  - 상세: `useState`는 기존 React 의존성 내에 포함되어 있음. 신규 의존성 없음.
  - 제안: 해당 없음.

- **[WARNING]** `evaluateFinishGuard` / `findLatestPlanInHistory` 메서드에서 인라인 import 타입 사용
  - 위치: `workflow-assistant-stream.service.ts` L488–554
  - 상세: 두 메서드의 파라미터 타입 선언에 `import('./entities/workflow-assistant-message.entity').WorkflowAssistantMessage[]` 형태로 인라인 동적 import를 사용하고 있음. 파일 상단에서 이미 `AssistantToolCallRecord`, `AssistantPlanRecord`를 named import하고 있으나 `WorkflowAssistantMessage` 엔티티 자체는 누락되어 인라인으로 우회된 것으로 보임. 추적 난이도가 올라가고 리팩토링 시 누락될 가능성 있음.
  - 제안: 파일 상단 import 블록에 `WorkflowAssistantMessage`를 명시적으로 추가할 것:
    ```typescript
    import {
      AssistantToolCallRecord,
      AssistantPlanRecord,
      WorkflowAssistantMessage,
    } from './entities/workflow-assistant-message.entity';
    ```

- **[INFO]** `AssistantToolCallKind` 타입에 `'finish'` 추가
  - 위치: `workflow-assistant-message.entity.ts` L14
  - 상세: 내부 타입 확장. PLAN_NOT_COMPLETE로 block된 finish 호출을 `pendingToolCalls`에 기록할 때 `kind: 'finish'`가 필요하여 추가된 것. `TOOL_KIND_BY_NAME`에 `finish`가 이미 매핑되어 있어야 하는 전제가 있음. `tool-definitions.ts`가 이번 diff에 포함되지 않아 직접 확인은 불가하나, 기존 `if (kind === 'finish')` 분기가 작동하던 것으로 보아 매핑은 존재하는 것으로 추정됨.
  - 제안: `tool-definitions.ts`의 `TOOL_KIND_BY_NAME`에 `finish: 'finish'`가 명시적으로 선언되어 있는지 확인 권장.

- **[INFO]** `onAnswerPlanQuestions` prop 체인 추가
  - 위치: `assistant-panel.tsx` → `assistant-message.tsx` → `plan-card.tsx`
  - 상세: 3단계 컴포넌트를 거쳐 콜백이 전달되는 prop drilling 구조. 현재 규모에서는 문제없으나 컴포넌트 트리가 깊어질 경우 관리 부담 증가. 추가 패키지 없음.
  - 제안: 현재 규모에서는 수용 가능. 향후 상태 관리 레이어(`assistant-store`)로 흡수 고려.

---

### 요약

이번 변경에서 **신규 외부 패키지는 단 하나도 추가되지 않았다.** `lucide-react`의 `Send` 아이콘과 React의 `useState`는 모두 기존 의존성 범위 내 사용이며, 번들 크기 증가나 라이선스 문제는 없다. 유일한 실질적 지적 사항은 `workflow-assistant-stream.service.ts`의 두 private 메서드에서 인라인 import 타입을 사용하는 패턴으로, top-level import로 정리하면 가독성과 리팩토링 안정성이 개선된다.

### 위험도

**LOW**