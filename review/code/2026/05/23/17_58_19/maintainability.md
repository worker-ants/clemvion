# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

### 파일 1: execution-engine.service.ts

- **[WARNING]** `submitted` 변수의 sentinel 언래핑 로직이 인라인 타입 단언을 중복 사용하여 가독성이 낮음
  - 위치: `waitForAiConversation` 함수 내 `submitted` 언래핑 블록 (diff +188~+193)
  - 상세: `(submitted as { type?: string }).type` 와 `(submitted as { formData?: unknown }).formData` 가 별도 캐스팅으로 분리되어 있어, 동일한 객체에 대해 타입 단언이 두 번 발생한다. 이는 향후 sentinel shape 이 변경될 경우 두 곳을 동시에 수정해야 하는 부담을 만든다.
  - 제안: `type FormSubmittedSentinel = { type: 'form_submitted'; formData?: unknown }` 인터페이스를 정의하고 단일 캐스팅으로 정리. 또는 `isFormSubmittedSentinel(submitted)` 형태의 type guard 헬퍼로 추출하면 재사용성과 가독성 모두 향상된다.

- **[INFO]** `registerContinuationHandlers` 내 `'continue'` 핸들러에 인라인 주석이 4줄로 길다
  - 위치: `registerContinuationHandlers` 함수 내 diff +159~+168
  - 상세: 코드 자체는 간결하나 주석이 wrap 결정 이유·히스토리·spec 참조를 모두 담고 있어 핸들러 본문보다 길다. 향후 spec §10.9 를 읽는 것으로 충분한 정보라면 주석을 축약할 수 있다.
  - 제안: 핵심 이유 한 줄 + spec cross-ref 한 줄로 축약. 상세 배경은 spec 에 위임.

- **[INFO]** `else` 분기(unknown action.type warn log)가 누락된 케이스에 대한 명시적 타입 정의 없음
  - 위치: diff +230~+236 (warn log else 분기)
  - 상세: `action.type` 이 string 으로 처리되나 `action` 자체의 타입이 `unknown` 계열인지 명시되지 않아 추후 타입 체계 확장 시 이 분기가 exhaustiveness check 대상인지 불분명하다.
  - 제안: `action` 의 타입을 discriminated union 으로 정의하면 TypeScript 컴파일러가 새 분기 누락을 정적으로 잡아준다.

---

### 파일 2: execution-engine.service.spec.ts

- **[WARNING]** `pendingContinuations` Map 접근을 위한 타입 단언 블록이 3개 테스트에서 거의 동일하게 반복됨
  - 위치: diff +74~+81 (두 번째 테스트), +109~+117 (세 번째 테스트), 기존 첫 번째 테스트
  - 상세: `(service as unknown as { pendingContinuations: Map<...> }).pendingContinuations` 구문이 3개 it-블록에 복사·붙여넣기 되어 있다. 이 패턴이 반복될 때마다 Map 의 value 타입 정의(`{ nodeId: string; resolve: jest.Mock; reject: jest.Mock }`)도 같이 복사된다. 타입 정의가 달라지면 3곳을 모두 수정해야 한다.
  - 제안: 헬퍼 함수나 `beforeEach` 레벨 변수로 추출. 예:
    ```ts
    function getPendings(svc: ExecutionEngineService) {
      return (svc as unknown as { pendingContinuations: Map<string, ...> })
        .pendingContinuations;
    }
    ```

- **[INFO]** 두 신규 테스트 `it` 제목 안에 기술적 배경 설명이 과도하게 포함되어 있음
  - 위치: diff +62~+65 (세 번째 it), +102~+103 (네 번째 it)
  - 상세: `it('continue 핸들러 — form 필드명이 "type" 인 페이로드도 정확히 wrap (silent drop 회귀 방지)', () => { ... })` 처럼 제목이 길고, 내부 주석도 동일한 내용을 반복 설명한다. 제목 또는 주석 중 하나를 선택하는 것이 읽기 더 편하다.
  - 제안: 제목은 간결하게 행동(what), 주석은 왜(why)만 담는다.

---

### 파일 3: use-execution-interaction-commands.ts

- **[WARNING]** `submitForm` 콜백 내부에서 `useExecutionStore.getState()` 를 직접 호출하는 패턴이 `sendMessage` 와 다름
  - 위치: diff +688~+695 (submitForm 내 `useExecutionStore.getState()` 호출)
  - 상세: `sendMessage` 는 `const { conversationMessages } = useExecutionStore.getState()` 한 필드만 구조 분해하는 반면, `submitForm` 은 `conversationMessages`, `waitingNodeId`, `nodeResults` 3개를 구조 분해한다. 패턴은 유사하나 코드량 차이로 미래 독자가 의도적 차이인지 실수인지 판단하기 어렵다.
  - 제안: 두 콜백 모두 `useExecutionStore.getState()` 호출 위치와 구조 분해 스타일을 통일. `submitForm` 이 추가로 필요한 필드들은 `sendMessage` 와 비교하여 주석 한 줄로 차이를 명시한다.

- **[WARNING]** `turnIndex` 계산 로직에 `m.type === "user" || m.type === "presentation"` 필터가 매직 판단 기준으로 인라인 삽입됨
  - 위치: diff +705~+709 (turnIndex 계산)
  - 상세: `sendMessage` 의 turnIndex 계산은 `m.type === "user"` 만 필터하는 반면 `submitForm` 은 `"user" || "presentation"` 으로 필터한다. 두 계산 방식의 차이가 의도적인지, 그리고 미래에 새 `type` 이 추가될 경우 이 필터도 업데이트해야 하는지 코드만으로는 불분명하다.
  - 제안: `isUserInitiatedTurn(m: ConversationMessage): boolean` 형태의 헬퍼로 분리하여 양쪽에서 재사용하면 일관성이 보장되고 변경 시 한 곳만 수정하면 된다.

- **[INFO]** `submitForm` 콜백 내 인라인 주석이 7줄로 함수의 실제 로직보다 길다
  - 위치: diff +679~+688
  - 상세: 주석 내용은 배경 설명과 spec 참조로 가치 있지만, 독자가 구현 로직을 파악하기 위해 주석을 먼저 전부 읽어야 하는 부담이 있다.
  - 제안: 주석을 함수 상단 JSDoc 또는 `// spec/4-nodes/6-presentation/0-common.md §10.9 — optimistic UI pattern` 한 줄 + spec 위임으로 축약한다.

- **[INFO]** `waitingNode?.nodeLabel ?? "Form"` 과 `waitingNode?.nodeType ?? "form"` 의 fallback 리터럴이 하드코딩됨
  - 위치: diff +700~+703
  - 상세: `"Form"` 과 `"form"` 은 의미는 있지만 상수나 enum 으로 관리되지 않는다. 향후 기본값이 변경되거나 다국어 처리가 필요할 경우 이 위치만 수정되어야 하는지 불분명하다.
  - 제안: `DEFAULT_FORM_NODE_LABEL = "Form"` / `DEFAULT_FORM_NODE_TYPE = "form"` 형태의 상수로 추출하거나, 이미 존재하는 enum 값이 있다면 그것을 참조한다.

---

### 파일 4: use-execution-interaction-commands.test.ts

- **[INFO]** `onceMock.mock.calls.find(([event]) => event === "execution.form_submitted")` 패턴이 2개 테스트에서 동일하게 반복됨
  - 위치: diff +325~+329, +348~+350
  - 상세: ack 핸들러를 찾는 로직이 복사 반복된다. `sendMessage` 관련 테스트에서도 유사 패턴이 이미 존재하며 점차 확산 중이다.
  - 제안: `findAckHandler(mock: typeof onceMock, event: string)` 헬퍼 함수로 추출하면 테스트 가독성과 일관성이 개선된다.

---

## 요약

이번 변경은 `form submission` 흐름의 silent failure 를 sentinel wrap 패턴으로 명시화하는 버그 수정으로 방향성은 옳고 테스트 커버리지도 충분하다. 유지보수성 관점의 주요 우려는 두 가지다. 첫째, `pendingContinuations` Map 에 대한 타입 단언 블록과 `turnIndex` 계산 필터가 복수 위치에서 거의 동일하게 반복되어 DRY 원칙에서 벗어나 있다. 둘째, `submitted` 언래핑 로직의 인라인 이중 타입 단언과 `waitingNode` fallback 리터럴이 타입 시스템 활용 부족으로 이어지며, sentinel shape 변경 시 실수를 유발할 수 있다. 나머지 발견사항은 주석 길이와 코드 스타일 통일성에 관한 INFO 수준으로, 기능적 위험은 없다.

## 위험도

LOW
