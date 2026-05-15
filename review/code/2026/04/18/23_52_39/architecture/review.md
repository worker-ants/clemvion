## 아키텍처 코드 리뷰

### 발견사항

---

**[INFO]** 단일 책임 원칙 — 두 모듈의 책임이 명확히 분리되어 있음
- 위치: `reachable-nodes.ts`, `validate-scope.ts`
- 상세: 그래프 도달 가능성 계산과 표현식 스코프 검증이 완전히 독립된 파일로 분리되어 있고, 각각 하나의 명확한 책임을 가짐. `reachable-nodes.ts`는 순수 그래프 알고리즘, `validate-scope.ts`는 토큰 매칭 및 에러 생성만 담당.
- 제안: 현재 구조 유지.

---

**[INFO]** 의존성 방향 — 올바른 단방향 의존성
- 위치: `validate-scope.ts`
- 상세: `validate-scope.ts`는 `reachable-nodes.ts`를 직접 import하지 않고 컨텍스트 객체(`availableKeys`, `allNodeKeys`)를 파라미터로 받음. 호출자가 두 모듈을 조합하는 구조로, 의존성 역전이 자연스럽게 달성되어 있음. 순환 참조 없음.

---

**[WARNING]** 모듈 경계 — 노드 `type` 필드가 `ScopedNode`에 포함되어 있으나 알고리즘에서 사용되지 않음
- 위치: `reachable-nodes.ts:22`, `ScopedNode.type`
- 상세: `type` 필드는 인터페이스에 선언되었지만 `getAncestorsInScope`, `getContainerChain` 어디에서도 사용되지 않음. 불필요한 컨텍스트 결합이며, 호출자가 제공해야 할 데이터 양이 늘어남. 추후 "컨테이너 타입 판별"에 사용할 의도일 수 있으나, 현재는 dead field.
- 제안: 사용하지 않으면 제거. 필요 시 별도 인터페이스(`ContainerNode extends ScopedNode`)로 분리하거나, 컨테이너 판별 로직을 호출자에서 주입하는 predicate 형태로 추상화.

---

**[WARNING]** 모듈 레벨 정규식 전역 상태 — 재진입 위험
- 위치: `validate-scope.ts:46–51`, `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`
- 상세: `/g` 플래그 정규식을 모듈 레벨 상수로 선언하면 `lastIndex` 상태가 호출 간에 공유됨. 코드에서 `.lastIndex = 0` 리셋을 직접 수행하고 있으나, `.test()` 후 `matchAll()`을 사용하는 다른 패턴들(`NODE_REF_RE`, `VAR_REF_RE`)과 일관성이 없고 실수에 취약함. 특히 `LOOP_ROOT_RE`는 `!hasLoop` 조건 내에서만 리셋되어, `hasLoop=true`인 경우 `lastIndex`가 리셋되지 않은 채로 남음.
- 제안: 정규식을 함수 내부에서 매번 생성하거나, `String.prototype.match` 대신 `new RegExp(...).test()`로 인스턴스를 분리. 또는 `matchAll` 패턴으로 통일하여 `lastIndex` 수동 관리 제거.

```ts
// Before (위험)
if (!context.containerScope.hasLoop && LOOP_ROOT_RE.test(block)) { ... }
LOOP_ROOT_RE.lastIndex = 0; // hasLoop=true면 이 줄에 도달하지만, test()가 호출 안 됨 → 정상

// 실제 위험 시나리오: hasLoop=false인 블록 처리 중 예외 발생 시 lastIndex 미리셋
```

---

**[INFO]** 확장성 — 에러 종류 추가가 용이한 구조
- 위치: `validate-scope.ts:15–19`, `ScopeErrorKind`
- 상세: `ScopeErrorKind` union type과 `messageFor` switch는 새 에러 종류 추가 시 두 곳을 동시에 수정해야 하지만, TypeScript exhaustive check가 누락된 switch 케이스를 컴파일 타임에 잡아줌. 확장 비용이 낮고 구조 자체는 건전함.

---

**[INFO]** 테스트 설계 — 경계 케이스 커버리지 우수
- 위치: `reachable-nodes.test.ts`
- 상세: 사이클 안전성, 컨테이너 경계 누출 방지, 중첩 컨테이너, 병렬 브랜치 격리 등 알고리즘의 핵심 불변식을 모두 명시적 테스트로 문서화함. 특히 사이클 테스트의 결과 검증이 구체적(`fromA.has("B")`)으로 되어 있어 회귀 탐지가 명확함.

---

**[INFO]** 추상화 수준 — 적절함
- 상세: 정규식 기반 토큰 매칭 선택이 주석으로 명시적으로 정당화되어 있음("AST 없이도 충분히 작은 언어"). 과도한 추상화 없이 문제 크기에 맞는 해법을 선택한 판단이 타당함.

---

### 요약

두 모듈(`reachable-nodes.ts`, `validate-scope.ts`)은 책임 분리, 단방향 의존성, 순환 참조 없음 측면에서 아키텍처적으로 건전하다. 그래프 알고리즘과 표현식 검증이 명확히 분리되어 있고, 호출자가 두 결과를 조합하는 구조는 테스트 용이성과 재사용성을 모두 확보한다. 주요 위험은 두 가지다: (1) `ScopedNode.type`이 현재 알고리즘에서 사용되지 않아 인터페이스 계약이 실제보다 넓게 선언되어 있고, (2) 모듈 레벨 `/g` 정규식의 `lastIndex` 수동 관리가 `hasLoop=false` 코드 경로에서만 실행되므로 예외 경로나 향후 수정 시 상태 누출 위험이 있다. 두 이슈 모두 즉각적인 버그 가능성은 낮으나 유지보수 부채로 누적될 수 있다.

### 위험도

**LOW**