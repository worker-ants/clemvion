### 발견사항

---

**[WARNING] `validateItemButtons` 함수의 단일 책임 원칙 위반 및 중복 검증 로직**
- 위치: `carousel.handler.ts` — `validateItemButtons` 함수
- 상세: `validateItemButtons`는 길이 제한, ID 유일성, label 필수, type 필수, URL 조건부 필수를 모두 단일 함수에서 처리. `validateButtons` (전역 버튼 검증) 와 동일한 검증 규칙을 공유하지 않고 별도 구현됨.
- 제안: 공통 버튼 검증 로직을 단일 헬퍼로 통합하고, 최대 개수 제한만 파라미터로 분리.

---

**[WARNING] `__item_` 문자열 리터럴이 여러 파일에 분산**
- 위치: `carousel.handler.ts` L162 (`${btn.id}__item_${itemIdx}`), `execution-engine.service.ts` (`buttonId.includes('__item_')`, `buttonId.split('__item_')[0]`)
- 상세: ID 생성 규칙과 파싱 로직이 물리적으로 분리된 두 파일에 하드코딩됨. 구분자가 변경될 경우 양쪽을 동시에 수정해야 하며, 현재 코드만으로는 이 의존성을 추적하기 어려움.
- 제안: 공유 상수 또는 유틸 함수(`buildItemButtonId(defId, idx)`, `parseItemButtonId(id)`)로 추출.

---

**[WARNING] `custom-node.tsx`의 출력 포트 계산 로직 복잡도 과다**
- 위치: `custom-node.tsx` — carousel 조건부 포트 계산 블록
- 상세: static/dynamic 모드 분기 + globalButtons 처리 + `hasAnyLink` 3중 OR 조건이 한 블록에 중첩됨. `hasAnyLink` 계산식은 한 줄로 쓰기엔 너무 복잡하며 중간에 `(data.config.itemButtons as BtnEntry[])` 캐스팅이 반복적으로 등장함.
- 제안: 포트 계산을 별도 함수 `getCarouselOutputPorts(config)`로 추출하고, `hasAnyLink` 조건도 내부 헬퍼로 분리.

---

**[WARNING] `unwrap` 헬퍼의 타입 안전성 미흡**
- 위치: `executions.ts` — `unwrap<T>` 함수
- 상세: `any` 파라미터와 `typeof data.data === "object" && !Array.isArray(data.data)` 조건은 배열 응답을 `getById`에서 잘못 처리하는 것을 막지만, `PaginatedExecutions`의 `getByWorkflow`는 `unwrap`을 사용하지 않고 `data as PaginatedExecutions`로 직접 캐스팅함. 두 메서드 간 응답 정규화 방식이 불일치.
- 제안: `getByWorkflow`도 동일한 정규화 패턴을 적용하거나, 별도 `unwrapPaginated` 함수를 만들어 의도를 명확히.

---

**[INFO] `SummaryView`의 동적 엘리먼트 타입 선택 패턴 가독성**
- 위치: `conversation-inspector.tsx` — `SummaryView` 내 `const Wrapper = isClickable ? "button" : "div"`
- 상세: JSX에서 동적 태그를 변수로 할당하는 패턴은 동작하지만, `type={isClickable ? "button" : undefined}`를 조건부로 전달하는 방식이 TypeScript에서 타입 오류를 유발하거나 향후 유지보수 시 혼란을 줄 수 있음.
- 제안: 조건부 렌더링(`isClickable ? <button>...</button> : <div>...</div>`)으로 분기하여 타입 안전성과 가독성을 개선.

---

**[INFO] `GenericRenderer` prop 확장 방식**
- 위치: `generic-renderer.tsx` — `previewOnly` prop 추가
- 상세: 기존 컴포넌트에 `previewOnly` boolean prop을 추가하는 방식은 컴포넌트가 두 가지 렌더링 모드를 가지게 됨. prop 이름과 의미가 다소 모호함 (`previewOnly`가 output을 숨긴다는 것이 prop 이름만으로 자명하지 않음).
- 제안: prop 이름을 `hideOutput`으로 명시하거나 주석으로 의도를 보강.

---

**[INFO] `eslint-disable` 주석 제거 후 빈 줄만 남음**
- 위치: `llm-config.service.spec.ts` — L13
- 상세: `eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석을 제거한 후 빈 줄이 하나 추가됨. `let mockRepo: Record<string, any>` 선언에 `any`가 여전히 존재하는데 ESLint 억제가 제거되어 일관성이 없음. 실제로 ESLint가 경고하지 않는다면 제거가 맞지만, 그렇지 않다면 억제 주석이 필요.
- 제안: `mockRepo`의 타입을 더 구체적으로 정의하거나, ESLint 통과 여부를 확인 후 주석 제거 판단.

---

### 요약

전반적으로 이번 변경은 기능적으로 잘 구조화되어 있고, `execution-status.ts` 공통 유틸 추출, `executionsApi` 레이어 타입 정의 강화, 테스트 mock 정규화 등 유지보수성 개선이 적절히 이루어졌다. 그러나 캐러셀 아이템 버튼의 ID 생성/파싱 규칙(`__item_` 구분자)이 `carousel.handler.ts`와 `execution-engine.service.ts` 두 파일에 하드코딩으로 분산된 점이 가장 큰 유지보수 위험 요소다. `custom-node.tsx`의 포트 계산 로직도 중첩 복잡도가 높아 향후 carousel 기능 확장 시 수정 오류 가능성이 높다. 백엔드 서비스의 `validateItemButtons`와 전역 버튼 검증 로직의 중복도 제거가 권장된다.

### 위험도

**MEDIUM**