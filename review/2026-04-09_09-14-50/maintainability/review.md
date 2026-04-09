### 발견사항

---

**[WARNING] 매직 문자열 `__item_`이 여러 파일에 하드코딩됨**
- 위치: `carousel.handler.ts` (execute 메서드), `execution-engine.service.ts` L1602, `custom-node.tsx` L85
- 상세: 아이템 버튼 ID 프로토콜(`${btn.id}__item_${itemIdx}`)이 세 파일에 걸쳐 문자열 리터럴로 반복됨. 구분자를 바꾸거나 포맷이 변경되면 세 곳을 모두 수정해야 하며, 파악이 쉽지 않음.
- 제안:
  ```ts
  // shared constants 파일에
  export const ITEM_BUTTON_SEPARATOR = '__item_';
  export function makeItemButtonId(defId: string, idx: number) { ... }
  export function parseItemButtonId(id: string) { ... }
  ```

---

**[WARNING] `outputItems` 할당의 불필요한 이중 조회**
- 위치: `execution-engine.service.ts` ~L1581
- 상세: `const outputItems = (nodeOutput.items ?? cleanNodeOutput.items)` — `cleanNodeOutput`은 `{ ...nodeOutput }`의 얕은 복사이므로 `cleanNodeOutput.items === nodeOutput.items`가 항상 성립. 오른쪽 항은 도달 불가능하며 코드 읽는 사람에게 혼동을 줌.
- 제안: `const outputItems = nodeOutput.items as unknown[] | undefined;`

---

**[WARNING] `hasAnyLink` 조건이 단일 표현식에 지나치게 많은 로직을 담음**
- 위치: `custom-node.tsx` ~L98-102
- 상세: 세 갈래의 `||` 조건이 한 줄에 이어지며 각각 중첩 옵셔널 체이닝과 타입 캐스팅을 포함. 새 버튼 소스 추가 시 이 블록을 확장해야 하는 구조임.
- 제안: 헬퍼 함수로 분리
  ```ts
  function hasLinkButton(config: Record<string, unknown>, type: string): boolean { ... }
  const hasAnyLink = hasLinkButton(data.config, data.type);
  ```

---

**[WARNING] `execution-status.ts`가 `ExecutionStatus` 타입을 활용하지 않음**
- 위치: `frontend/src/lib/utils/execution-status.ts` L1-28
- 상세: `ExecutionStatus` 타입이 `executions.ts`에 정의되어 있음에도, `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`은 모두 `Record<string, T>`를 사용. 새 상태값 추가 시 컴파일러가 누락을 잡아주지 못함.
- 제안:
  ```ts
  import type { ExecutionStatus } from "@/lib/api/executions";
  export const STATUS_ICON: Record<ExecutionStatus, string> = { ... };
  ```

---

**[WARNING] `carousel.handler.ts`의 `execute` 메서드가 지나치게 많은 책임을 담당**
- 위치: `carousel.handler.ts` L116-215
- 상세: 이번 변경으로 단일 메서드가 (1) 소스 데이터 resolve, (2) static/dynamic 아이템 매핑, (3) 글로벌 버튼 집계, (4) 아이템별 버튼 ID 생성, (5) `buttonItemMap` 구성까지 처리. 약 100줄 분량으로 변경 사항을 추적하기 어려움.
- 제안: `buildItemsFromStatic`, `buildItemsFromDynamic`, `aggregateButtons` 등의 private 메서드로 분리.

---

**[WARNING] `unwrap` 함수가 `any` 타입 + 휴리스틱 조건에 의존**
- 위치: `frontend/src/lib/api/executions.ts` L43-47
- 상세: `data?.data !== undefined && typeof data.data === "object" && !Array.isArray(data.data)` 조건은 `{ data: [] }` 형태 응답을 unwrap하지 않고, 그 외 구조를 예측하기 어려움. 조건이 틀리면 런타임 오류 대신 잘못된 데이터가 조용히 반환됨.
- 제안: 정규화는 axios response interceptor에서 일원화하고, API 함수는 타입이 보장된 데이터만 반환하도록 설계. `unwrap`이 반드시 필요하다면 명시적 타입 가드 또는 zod 스키마 사용 권장.

---

**[INFO] `llm-config.service.spec.ts`에서 `eslint-disable` 주석만 제거, `any` 타입 유지**
- 위치: `llm-config.service.spec.ts` L13
- 상세: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석을 제거했지만 `Record<string, any>` 타입은 그대로임. lint 설정에 따라 CI에서 경고가 발생할 수 있음.
- 제안: 주석 제거 + 타입 구체화, 또는 주석 유지 중 하나로 일관성 있게 처리.

---

**[INFO] `conversation-inspector.tsx`의 동적 태그 패턴이 타입 추론을 어렵게 함**
- 위치: `conversation-inspector.tsx` L422-424
- 상세: `const Wrapper = isClickable ? "button" : "div"` 후 `<Wrapper type={...}>` 사용. `"button"`과 `"div"`의 props 타입이 달라 TypeScript가 `type` prop에 대해 경고를 낼 수 있으며, 렌더링 로직이 JSX 바깥 변수에 분산됨.
- 제안: 조건부 렌더링으로 명시적 분기 또는 별도 `ClickableWrapper` 컴포넌트 추출.

---

**[INFO] `carousel-buttons.handler.spec.ts`에 `source` 추가는 기존 테스트의 의도를 변경함**
- 위치: `carousel-buttons.handler.spec.ts` L18, L27, L37
- 상세: 기존 테스트("should pass with valid buttons config")는 `source` 없이도 동작해야 함을 검증했으나, 이번 수정으로 `source`가 항상 포함되어 하위 호환성 검증이 별도 케이스(`carousel.handler.spec.ts`의 "without source" 케이스)로 분리됨. 테스트 의도가 흩어짐.
- 제안: buttons 전용 spec에서도 `source` 없는 케이스를 유지하거나, 두 파일 간 역할 분담을 주석으로 명시.

---

### 요약

이번 변경에서 가장 큰 유지보수성 부채는 **`__item_`이라는 암묵적 프로토콜 문자열이 세 파일에 분산**된 점이다. 이 단일 변경이 carousel 핸들러, 실행 엔진, 에디터 캔버스에 각각 중복 파편화되어 있어 프로토콜 변경 시 전파 비용이 높다. `carousel.handler.ts`의 `execute` 메서드는 이번 기능 추가로 책임 범위가 과도하게 커졌으며 분리가 필요하다. 프론트엔드에서는 `execution-status.ts`의 상수 추출이 올바른 방향이지만 `ExecutionStatus` 타입을 활용하지 않아 타입 안전성을 일부 손실하고 있고, `unwrap` 헬퍼의 휴리스틱 조건은 장기적으로 API 계약이 변경될 때 조용한 오작동의 원인이 될 수 있다.

### 위험도
**MEDIUM**