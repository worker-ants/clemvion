## 발견사항

- **[INFO]** React Flow 측정값의 비결정적 타이밍
  - 위치: `frontend/src/components/editor/assistant-panel/assistant-panel.tsx`, `measured?.width ?? legacy.width` 부분
  - 상세: `useMemo`로 스냅샷을 동기 계산하는 시점과 React Flow가 DOM 렌더 후 `measured` 필드를 채우는 시점 사이에 레이스가 존재한다. 사용자가 노드를 추가한 직후 메시지를 빠르게 전송하면, 신규 노드의 `measured`가 아직 `undefined`인 채로 스냅샷이 구성될 수 있다.
  - 제안: 이 경우 서버 시스템 프롬프트가 `250×80px` 폴백으로 명시적으로 처리하도록 설계되어 있어 안전하다. 현 구현은 의도된 수준에서 적절히 처리되고 있다.

---

### 요약

변경 사항은 전적으로 선택적 필드(`width`/`height`) 추가에 해당하며, 기존 동시성 모델을 변경하지 않는다. `ShadowWorkflow`는 요청마다 새 인스턴스로 격리되고, `streamMessage`의 이벤트 처리는 `for await` 루프로 순차 진행되므로 공유 가변 상태로 인한 경쟁 조건이 없다. `WorkflowAssistantStreamService`는 싱글턴이지만 모든 상태가 각 `streamMessage` 호출 스코프 내에서만 선언·변형되어 스레드 안전성에 문제가 없다. React Flow 측정값의 비동기 타이밍 특성은 서버 측 폴백 처리로 이미 명시적으로 설계에 반영되어 있다.

### 위험도

**LOW**