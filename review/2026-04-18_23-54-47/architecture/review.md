## 아키텍처 코드 리뷰

### 발견사항

---

**[INFO]** 단일 책임 원칙 — 두 모듈 책임 분리 명확
- 위치: `reachable-nodes.ts`, `validate-scope.ts`
- 상세: 그래프 도달 가능성 계산(순수 알고리즘)과 표현식 스코프 검증(토큰 매칭 + 에러 생성)이 완전히 독립된 파일로 분리됨. 각 모듈이 하나의 책임만 담당.
- 제안: 현재 구조 유지.

---

**[INFO]** 의존성 역전 원칙 — 자연스러운 달성
- 위치: `validate-scope.ts`
- 상세: `validate-scope.ts`는 `reachable-nodes.ts`를 직접 import하지 않고, 호출자가 `availableKeys`/`allNodeKeys` Set을 주입하는 구조. 두 모듈이 인터페이스를 통해 느슨하게 결합되어 있고, 순환 참조 없음.
- 제안: 현재 구조 유지.

---

**[WARNING]** 인터페이스 계약 과다 선언 — `ScopedNode.type` dead field
- 위치: `reachable-nodes.ts:22`, `ScopedNode` 인터페이스
- 상세: `type` 필드가 인터페이스에 선언되어 있으나 `getContainerChain`, `getAncestorsInScope` 내부 어디에서도 분기 조건으로 사용되지 않음. 호출자가 제공해야 할 데이터가 실제 알고리즘 요구보다 넓게 정의되어 있어 인터페이스 분리 원칙(ISP) 위반 소지가 있음. 테스트 헬퍼에서 노드 구분용으로만 사용됨.
- 제안: 미사용이면 인터페이스에서 제거. 향후 컨테이너 타입 판별 로직이 필요하면 `ContainerNode extends ScopedNode` 또는 호출자 주입 predicate으로 분리.

---

**[WARNING]** 모듈 레벨 가변 상태 — 정규식 `lastIndex` 공유
- 위치: `validate-scope.ts:46–49`, `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`
- 상세: `/g` 플래그 정규식을 모듈 상수로 선언하면 `lastIndex` 상태가 호출 간 공유됨. 이는 모듈이 **순수 함수** 인터페이스를 제공하는 것처럼 보이지만 내부에 숨겨진 전역 상태를 갖는 구조 — 아키텍처적으로 함수 시그니처와 실제 동작이 불일치함. 특히 `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 리셋이 `if (!hasItem)` 블록 내부에만 있어 `hasItem: true` 경로에서 `lastIndex`가 누적됨.
- 제안: `/g` 플래그 제거가 근본 해결책. 또는 함수 내부에서 매 호출마다 인스턴스 생성. 모듈 상수는 source string으로만 보관.

---

**[INFO]** 확장성 — 에러 종류 추가 용이
- 위치: `validate-scope.ts:15–19`, `ScopeErrorKind` union
- 상세: TypeScript exhaustive check가 `messageFor` switch의 누락 케이스를 컴파일 타임에 잡아줌. 새 에러 타입 추가 시 두 곳(union + switch)만 수정하면 되는 낮은 확장 비용.
- 제안: `default: return kind satisfies never;` 추가로 런타임 안전성도 확보.

---

**[INFO]** 추상화 수준 — 적절한 선택
- 위치: `validate-scope.ts` 모듈 주석
- 상세: "AST 없이도 충분히 작은 언어"라는 판단 하에 정규식 기반 토큰 매칭 선택이 주석으로 명시됨. 과도한 추상화 없이 문제 규모에 맞는 해법.
- 제안: 현재 수준 유지.

---

**[INFO]** `getContainerChain` — `byId` Map 이중 생성
- 위치: `reachable-nodes.ts:48`, `reachable-nodes.ts:71`
- 상세: `getAncestorsInScope`에서 `byId` Map을 생성한 뒤 `getContainerChain`을 호출하면 내부에서 동일한 nodes 배열로 Map을 재구성함. 모듈 경계가 명확하나 내부 구현 공유 부재로 O(N) 비용 중복 발생.
- 제안: `getContainerChain(nodeId, nodes, byId?)` 시그니처 오버로드 또는 내부 전용 `_getContainerChainWithMap` 분리.

---

### 요약

`reachable-nodes.ts`와 `validate-scope.ts` 두 모듈은 책임 분리, 단방향 의존성, 순환 참조 없음 측면에서 아키텍처적으로 건전하다. 호출자가 두 모듈을 조합하는 구조는 의존성 역전을 자연스럽게 달성하며 테스트 용이성을 확보한다. 주요 아키텍처 위험은 두 가지다: (1) `ScopedNode` 인터페이스가 알고리즘이 실제 사용하지 않는 `type` 필드를 요구해 호출자 부담이 불필요하게 크고, (2) 모듈 레벨 `/g` 정규식이 순수 함수처럼 보이는 모듈에 숨겨진 가변 상태를 도입해 `hasItem: true` 경로에서 실제 오탐 버그를 유발한다. `/g` 플래그 제거 하나로 Critical 버그와 모든 관련 Warning이 동시에 해소된다.

### 위험도

**LOW** — 단, `validate-scope.ts`의 `/g` 정규식 `lastIndex` 미리셋 버그는 `hasItem: true` + 다중 블록 환경에서 실제 오탐을 유발하므로 즉시 수정 필요.