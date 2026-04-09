### 발견사항

---

**[WARNING] 백엔드 CarouselHandler의 `source` 필드 처리 책임 혼재**
- 위치: `carousel.handler.ts` — `execute()` 메서드
- 상세: `config.source`를 "실행 엔진이 표현식을 resolve하여 전달한다"고 주석에 명시했지만, 핸들러 내부에서 `Array.isArray(sourceData) ? sourceData : Array.isArray(input) ? input : ...` 폴백 체인으로 자체 처리도 시도. 표현식 resolve 책임이 실행 엔진 레이어에 있다면 핸들러는 resolve된 값만 신뢰해야 함. 두 레이어가 모두 데이터 소스 결정 로직을 갖는 혼재 구조.
- 제안: `source` 필드가 항상 실행 엔진에서 resolve됨을 전제한다면, 핸들러에서의 `Array.isArray(input)` 폴백 분기를 제거하고 단일 경로로 통일.

---

**[WARNING] `buttonItemMap`이 실행 엔진 내부 상태로 누출**
- 위치: `execution-engine.service.ts` — `handleButtonClick()`
- 상세: `buttonItemMap`은 CarouselHandler가 생성한 렌더링 보조 데이터인데, 실행 엔진이 이 구조를 직접 파싱(`(nodeOutput.buttonConfig as ...).buttonItemMap`)하여 `selectedItem`을 결정. 실행 엔진이 특정 노드 유형(Carousel)의 내부 데이터 구조에 결합됨. CarouselHandler가 아닌 다른 핸들러가 `buttonItemMap` 없이 item-level 버튼을 구현하려면 실행 엔진 코드 수정 필요.
- 제안: `buttonItemMap` 해석 로직을 실행 엔진이 아닌 핸들러 레이어에 위임하는 인터페이스 도입. 예: 핸들러가 `resolveButtonClick(buttonId, nodeOutput): { selectedPort, selectedItem }` 메서드를 구현하는 방식.

---

**[WARNING] `__item_` 구분자 기반 buttonId 파싱이 실행 엔진에 하드코딩**
- 위치: `execution-engine.service.ts` L1604
- 상세: `buttonId.includes('__item_') ? buttonId.split('__item_')[0] : buttonId` — 이 문자열 파싱 규칙은 CarouselHandler가 `${btn.id}__item_${itemIdx}`로 ID를 생성하는 방식과 암묵적으로 결합. 실행 엔진이 특정 핸들러의 ID 생성 규칙을 알아야 하는 설계로, OCP(개방-폐쇄 원칙) 위반. 새로운 아이템 레벨 버튼 패턴 추가 시 실행 엔진 수정 필요.
- 제안: CarouselHandler가 `normalizeButtonId(buttonId): string` 인터페이스를 구현하거나, 버튼 정의에 `portId` 필드를 별도로 포함시켜 실행 엔진이 파싱 없이 사용.

---

**[WARNING] `ConversationInspector`의 `previewOnly` prop이 단일 책임 원칙 위반**
- 위치: `conversation-inspector.tsx`
- 상세: `previewOnly` 플래그 하나로 내부 상태 관리 방식(`internalSelectedIndex` vs 외부 `selectedItemIndex`), 네비게이션 버튼 노출, Output Data 섹션 노출, 클릭 가능 여부가 모두 분기됨. 동일 컴포넌트가 두 가지 완전히 다른 모드(라이브 인터랙션 vs 히스토리 프리뷰)로 동작. 모드에 따라 props 사용 방식도 달라짐(`selectedItemIndex`가 `previewOnly=true`일 때 무시됨).
- 제안: `ConversationPreview`(히스토리 용)와 `ConversationInspector`(라이브 용)로 분리하거나, 공통 로직을 훅으로 추출 후 각자 조합.

---

**[INFO] `GenericRenderer`의 `previewOnly` prop 전파**
- 위치: `generic-renderer.tsx`, `conversation-inspector.tsx`
- 상세: `previewOnly` 플래그가 컴포넌트 트리 아래로 전파되는 prop drilling 패턴. 현재는 2단계지만 렌더러 계층이 깊어지면 모든 렌더러에 전파 필요.
- 제안: Context로 관리하거나, 렌더러가 표시할 섹션을 명시적인 `sections?: ('output' | 'input' | 'error')[]` prop으로 받는 방식.

---

**[INFO] `execution-status.ts` 공통 모듈 — 타입 안전성 미흡**
- 위치: `frontend/src/lib/utils/execution-status.ts`
- 상세: `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`이 모두 `Record<string, ...>` 타입. `ExecutionStatus` 유니온 타입이 `executions.ts`에 정의되어 있음에도 불구하고 이를 키로 사용하지 않아 컴파일 타임 완전성 검사가 불가능. 새 상태 추가 시 매핑 누락을 타입 시스템이 잡지 못함.
- 제안: `Record<ExecutionStatus, string>` 타입을 적용하여 exhaustive mapping 강제.

---

**[INFO] `RunResultsDrawer`가 라우팅 파라미터에 직접 의존**
- 위치: `run-results-drawer.tsx`
- 상세: `useParams()`로 `workflowId`를 직접 읽어 "All Executions" 링크를 생성. Drawer 컴포넌트가 URL 구조에 결합됨. 컴포넌트 재사용 맥락이 바뀌거나 라우팅 구조가 변경되면 수정 필요.
- 제안: `workflowId`를 prop으로 전달받거나, 링크 생성을 부모 컴포넌트에 위임.

---

### 요약

이번 변경의 핵심 아키텍처 문제는 **실행 엔진이 특정 핸들러(Carousel)의 내부 데이터 구조(`buttonItemMap`, `__item_` ID 패턴)를 직접 파싱**하는 구조로, 새로운 아이템 레벨 버튼 지원이 필요한 핸들러가 추가될 때마다 실행 엔진 수정이 강제된다는 점이다. 프론트엔드는 `execution-status.ts` 공통 모듈 추출로 중복 제거를 잘 수행했으나, `ConversationInspector`의 `previewOnly` 모드 분기와 `GenericRenderer`로의 플래그 전파는 컴포넌트 역할 경계가 흐릿해지는 신호다. `executionsApi`의 `unwrap()` 함수 도입으로 API 계약 책임은 올바른 레이어로 이동했지만, `getByWorkflow`는 여전히 unwrap 없이 raw 응답을 반환하여 일관성이 없다.

### 위험도
**MEDIUM**