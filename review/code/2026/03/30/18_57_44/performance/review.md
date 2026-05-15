### 발견사항

**[INFO]** `onNodesChange` 내 `remove` 처리 시 `removedIds` 배열 중복 생성
- 위치: `editor-store.ts` — `onNodesChange`
- 상세: `edges` 필터링 시 `filteredChanges.filter(c => c.type === "remove").map(c => c.id)` 연산이 클로저 내부에서 매번 실행되며, 이미 `hasRemove` 체크를 통과한 상태에서도 재계산됨.
- 제안: `const removedIds = new Set(filteredChanges.filter(c => c.type === "remove").map(c => c.id))`로 한 번만 계산 후 `Set.has()`로 edge 필터링.

**[INFO]** `canDeleteNode`가 `contextMenu` 렌더마다 `nodes.find()` 재실행
- 위치: `workflow-canvas.tsx` — `canDeleteNode` + 컨텍스트 메뉴 JSX
- 상세: 컨텍스트 메뉴 버튼의 `disabled` 속성에서 `canDeleteNode(contextMenu.nodeId)`를 렌더마다 호출. `nodes` 배열 크기에 비례하는 선형 탐색이 반복됨.
- 제안: `contextMenu` 상태 자체에 `canDelete: boolean` 필드를 포함시켜 `onNodeContextMenu` 시점에 한 번만 계산.

**[INFO]** `AuthProvider`에서 `pathname`이 `useEffect` 의존성에 포함되어 불필요한 재실행 가능성
- 위치: `auth-provider.tsx:20, 44`
- 상세: `initAttempted.current` ref로 중복 실행을 막고 있지만, `pathname`이 의존성 배열에 있어 ESLint exhaustive-deps 경고를 피하기 위한 구조로 보임. 실제로는 `pathname`이 바뀌어도 `initAttempted.current === true`라 재실행되지 않으나, 불필요한 effect 등록/해제 오버헤드가 발생.
- 제안: `pathname`을 `useRef`로 캡처하거나 effect 내부에서 `window.location.pathname`을 직접 읽어 의존성에서 제거.

**[INFO]** `GET /users/me` — 전체 row 로드 후 필드 필터링
- 위치: `users.controller.ts:14-27`
- 상세: 기존 리뷰(SUMMARY.md INFO #3)에서 이미 언급된 사항. `findById`가 `passwordHash`, `twoFactorSecret` 등 민감 필드 포함 전체 row를 로드한 뒤 컨트롤러에서 6개 필드만 반환. 인증 후 거의 모든 페이지에서 호출되는 고빈도 엔드포인트.
- 제안: `UsersService.findById`에 SELECT 프로젝션 추가 또는 `findProfileById` 메서드 분리. 단기 Redis TTL 캐시(TTL 60s) 적용 검토.

**[INFO]** `NodeConfigRenderer` — 대형 switch문, 코드 스플리팅 없음
- 위치: `node-configs/index.tsx`
- 상세: 30개 이상의 노드 config 컴포넌트가 모두 즉시 import되어 설정 패널 최초 렌더 시 전체 번들을 로드. 사용자가 실제로 설정 패널을 열지 않더라도 비용 발생.
- 제안: `React.lazy` + `Suspense` 또는 Next.js `dynamic()`으로 지연 로딩 적용. 노드 타입별로 청크를 분리하면 초기 번들 크기를 줄일 수 있음.

**[INFO]** `sidebar.tsx` — `document.addEventListener` 조건부 등록 패턴
- 위치: `sidebar.tsx:38-44`
- 상세: `userMenuOpen`이 `true`일 때만 이벤트 리스너를 등록하는 패턴은 올바름. 다만 클린업 함수가 `userMenuOpen` 값과 무관하게 항상 `removeEventListener`를 호출하는 구조라 `userMenuOpen === false` 상태에서는 실제로 등록되지 않은 리스너를 제거 시도함. 기능적 문제는 없으나 불필요한 호출.
- 제안: 클린업도 조건부로 처리하거나 `useEffect` 분기를 단순화.

**[INFO]** config 컴포넌트들의 배열 조작 시 매번 새 배열 생성
- 위치: `logic-configs.tsx`, `ai-configs.tsx`, `data-configs.tsx` 등 전반
- 상세: `updateCondition`, `updateCategory` 등에서 `conditions.map(...)` + `onChange({ ...config, conditions: updated })` 패턴이 모든 키 입력마다 실행됨. 항목 수가 수십 개 이상으로 늘어나면 불필요한 객체 복사가 반복됨. 현재 규모에서는 무시 가능하나 구조적으로 주의 필요.
- 제안: 현재 Phase 1 규모에서는 허용 가능. 항목 수가 증가하면 `immer`의 `produce` 또는 `useReducer` 패턴으로 전환 검토.

---

### 요약

성능 관점에서 전반적인 위험도는 낮습니다. 가장 주목할 부분은 `GET /users/me`의 불필요한 전체 row 로드(고빈도 엔드포인트)와 `NodeConfigRenderer`의 즉시 로딩(번들 크기)이며, 이 두 항목은 이미 기존 리뷰에서도 언급된 사항입니다. `onNodesChange` 내 `removedIds` 중복 계산과 `canDeleteNode`의 반복 탐색은 일반적인 워크플로우 규모에서는 체감 성능에 영향이 없으나, 코드 정확성과 가독성 측면에서 개선 여지가 있습니다. `AuthProvider`의 의존성 배열 구성과 sidebar의 이벤트 리스너 패턴은 기능적으로는 올바르게 동작하지만 미세한 비효율이 존재합니다. 전체적으로 현재 Phase 1 규모에서는 실질적인 성능 병목은 없으며, DB 프로젝션 최적화와 설정 패널 코드 스플리팅이 중장기적으로 가장 효과적인 개선 포인트입니다.

### 위험도

**LOW**