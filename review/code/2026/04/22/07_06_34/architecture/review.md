## 아키텍처 리뷰

### 발견사항

- **[WARNING]** React Flow 버전 감지 로직이 렌더링 컴포넌트에 혼재
  - 위치: `assistant-panel.tsx:103-110`
  - 상세: `(n as { measured?: {...} }).measured` 타입 캐스팅과 v11/v12 fallback 분기가 컴포넌트에 직접 내장되어 있다. 이 로직은 React Flow 버전이 바뀔 때 컴포넌트 수정이 필요하며, 동일한 버전 호환 처리가 다른 컴포넌트에서 노드를 사용할 때도 중복될 위험이 있다.
  - 제안: 에디터 스토어 레이어(또는 별도 `getNodeMeasuredSize(node)` 유틸)에서 `measured ?? { width, height }` 정규화를 처리하고, 컴포넌트는 이미 정규화된 값을 소비하도록 분리

- **[INFO]** 레이아웃 폴백 상수(250 / 80 / 32)가 여러 곳에 산재
  - 위치: `system-prompt.ts`, `shadow-workflow.ts` 주석, `assistant-panel.tsx` 주석
  - 상세: 폴백 너비/높이/간격 값이 프롬프트 문자열·JSDoc 주석·스펙 문서에 개별적으로 기술되어 있어, 값을 바꿔야 할 때 누락 위험이 있다.
  - 제안: `layout-constants.ts` 같은 단일 출처에 `DEFAULT_NODE_WIDTH = 250` 등 상수를 정의하고 프롬프트 빌더에서 참조하면 변경 지점이 하나로 수렴된다. 현재 규모에서는 허용 가능하나, 값이 늘어나면 관리 부담이 증가한다.

- **[INFO]** `ShadowNode` 인터페이스에 렌더링 메타데이터 포함
  - 위치: `shadow-workflow.ts:8-15`
  - 상세: `width`/`height`는 React Flow DOM 렌더링이 완료된 뒤에야 채워지는 프레젠테이션 계층 정보다. `ShadowWorkflow`는 "in-memory replica" 역할을 하므로, 렌더 측정값이 도메인 모델에 포함되는 것이 설계상 다소 혼재하는 지점이다. 다만 `addNode`에서 의도적으로 이 필드를 생성하지 않고 LLM 레이아웃 계산에만 사용하는 것은 명확하게 문서화되어 있어 실용적 타협으로 수용 가능하다.
  - 제안: 현재 구조 유지 가능. 향후 `ShadowNode`가 비대해지면 `position`·`dimensions` 등 그룹별 중첩 객체로 분리하는 것을 검토할 수 있다.

- **[INFO]** DTO에 최솟값 검증 없음
  - 위치: `assistant-message-request.dto.ts:56-64`
  - 상세: `@IsNumber()`만 선언되어 있어 `width: -1` 또는 `height: 0` 이 유효하다. 비정상 값이 LLM 프롬프트에 그대로 유입될 경우 레이아웃 지침이 역효과를 낼 수 있다.
  - 제안: `@Min(1)` 또는 `@IsPositive()` 데코레이터 추가 고려

- **[INFO]** `toWorkflowView` 스프레드 패턴은 의도적이며 적합
  - 위치: `workflow-view.ts:52-53`
  - 상세: `undefined` 필드를 JSON에 `null`로 노출하지 않으려는 의도가 명확하며, 토큰 비용 절감에도 유효하다. 패턴 자체는 코드베이스 내에서 일관되게 사용되고 있다.

---

### 요약

이번 변경은 React Flow 렌더 측정값(`width`/`height`)을 프론트엔드 → DTO → ShadowSnapshot → WorkflowView → 시스템 프롬프트까지 단방향으로 전파하는 전형적인 **데이터 파이프라인 확장**이다. 레이어 간 책임 분리와 단방향 흐름은 유지되고 있으며, 선택 필드(optional)로 추가해 하위 호환성을 보장한 점도 적절하다. 주요 우려는 React Flow 버전 호환 분기 로직이 컴포넌트에 직접 노출된 점으로, 이 로직이 확산되기 전에 스토어 또는 유틸 레이어로 격리하는 것이 바람직하다. 나머지 지적 사항은 정보성(INFO) 수준이며 현재 규모에서 큰 리스크는 없다.

### 위험도

**LOW**