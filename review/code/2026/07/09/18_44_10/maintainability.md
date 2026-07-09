# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `newChat()`과 `endConversation()`이 세션 정리 시퀀스를 그대로 중복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:382-391`(`newChat`), `:399-426`(`endConversation`)
  - 상세: 두 콜백 모두 `teardownSession(); sessionRef.current = null; startedRef.current = false; clearQueue();` 4줄을 동일하게 반복한 뒤 각자 다른 `dispatch`(`NEW_CHAT` vs `ENDED`)와 후속 동작(`start()` vs `bridgeRef.current?.sendEvent("conversationEnded", ...)`)으로 갈라진다. 이 파일은 이미 `teardownSession`/`seedWaitingFromStatus`처럼 반복 로직을 캡슐화하는 관례가 있는데, 이번 추가분(`endConversation`)만 그 패턴을 따르지 않고 인라인 복제했다.
  - 제안: `resetSessionRefs()` 같은 작은 헬퍼로 공통 4줄을 추출하거나, `endConversation`이 `newChat`처럼 "teardown → 콜백 인자로 후속 dispatch/사이드이펙트 실행" 구조를 공유하도록 정리. 향후 세 번째 종료 경로가 추가되면 4곳에 동일 시퀀스가 늘어날 위험.

- **[WARNING]** 확인 다이얼로그의 확정 버튼을 CSS 클래스 선택자로만 구분(접근성 이름 충돌)
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:1211-1226`(헤더 "대화 종료" 버튼), `:1251`(확인바 확정 버튼, `confirming === "end"`일 때 라벨도 동일하게 "대화 종료") / `codebase/channel-web-chat/src/widget/components/panel.test.tsx:864, 879, 884`
  - 상세: 헤더의 "대화 종료" 버튼과 확인바 확정 버튼이 같은 접근성 이름("대화 종료")을 가져 `getByRole("button", { name: "대화 종료" })`로는 둘을 구분할 수 없다. 그 결과 테스트가 `dialog.querySelector(".wc-confirm-yes")` / `".wc-confirm-no")`처럼 구현 세부사항인 CSS 클래스에 결합됐다(`styles.ts`의 스타일링용 클래스를 테스트 selector로 재사용). 스타일 리팩터링 시 클래스명이 바뀌면 테스트가 조용히 깨지거나(오탐 없이 selector가 null이 되어 다른 이유로 실패) 오래 방치될 수 있다.
  - 제안: 확인바 버튼에 더 구체적인 `aria-label`(예: `aria-label="대화 종료 확정"`) 을 부여해 헤더 버튼과 접근성 이름을 분리하고, 테스트도 `within(dialog).getByRole("button", { name: ... })`로 전환. 클래스 선택자 의존을 제거하면 스타일 변경에 강해진다.

- **[WARNING]** `confirming` 값 기반 3중 삼항 분기 — 매핑 테이블로 통합 가능
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:1237-1239`(안내 문구), `:1246-1247`(액션 분기), `:1251`(버튼 라벨)
  - 상세: `confirming === "new" ? A : B` 형태의 삼항 연산이 같은 함수 안에서 3회 반복된다(문구, 실행할 액션, 버튼 라벨). 현재는 상태값이 `"new" | "end"` 2개뿐이라 읽기 어렵지 않지만, 세 곳 모두 `confirming` 하나에 종속된 로직이라 한 곳만 수정하고 다른 곳을 놓치는 회귀 위험이 있다(예: 문구만 바꾸고 라벨은 깜빡).
  - 제안: `const CONFIRM_COPY: Record<"new" | "end", { message: string; confirmLabel: string; action: () => void }>` 형태의 조회 테이블을 만들어 세 삼항을 하나의 데이터 소스로 합치면 향후 세 번째 확인 유형 추가 시에도 변경 지점이 1곳으로 준다.

- **[INFO]** `USER_TURN_SOURCES`가 `Set<string>`으로 선언되어 `TurnSource` 리터럴 타입의 오탈자 방지 이점을 놓침
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts:485`
  - 상세: 같은 커밋에서 `TurnSource`가 7개 리터럴 유니온으로 확장되고 JSDoc으로 SoT까지 명시했는데(`eia-types.ts:599-606`), 정작 `USER_TURN_SOURCES = new Set<string>([...])`는 느슨한 `string` 타입이라 원소를 오타(예: `"ai_uesr"`)로 적어도 컴파일 타임에 잡히지 않는다.
  - 제안: `new Set<TurnSource>([...])`로 좁혀 타입 체커가 유효한 5개 wire source + 하위호환 2개(`live`/`user`) 범위 밖 값을 즉시 거부하도록 한다.

- **[INFO]** `getStatus()` 두 분기에서 `conversationThread` 스프레드 로직이 1줄 중복
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:290-307`
  - 상세: `interactionType === 'buttons'` 분기와 `else if (interactionType)` 분기 모두 `...(conversationThread ? { conversationThread } : {})`를 동일하게 포함한다. 기존에도 `interactionType`/`waitingNodeId`가 두 분기에 중복돼 있던 구조를 그대로 확장한 것이라 새로 심각해진 것은 아니지만, `context` 조립 로직이 커지고 있어 공통 필드(`interactionType`, `waitingNodeId`, `conversationThread`)를 먼저 조립하고 `buttonConfig`/`nodeOutput`만 분기별로 합치는 형태로 정리하면 향후 필드 추가 시 중복이 늘지 않는다.
  - 제안: (선택) `const common = { interactionType, waitingNodeId, ...(conversationThread ? { conversationThread } : {}) };`로 추출 후 `context = { ...common, buttonConfig: ... }` / `{ ...common, nodeOutput: ... }`로 분기.

- **[INFO]** `endConversation`의 `state.pending!.nodeId` 비-null 단언이 앞선 옵셔널 체이닝 검사와 별도 변수를 거쳐 성립
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:403-408`
  - 상세: `graceful` 계산 시 `!!state.pending?.nodeId`로 이미 존재를 확인했지만, TS 제어 흐름 분석이 `graceful` 불리언을 거쳐서는 `state.pending!.nodeId`를 자동으로 좁혀주지 못해 별도 non-null 단언이 필요하다. 현재는 같은 스코프 내 안전하지만, 두 표현식이 갈라져 있어 향후 리팩터링(조건 로직 이동 등) 시 단언만 남고 보장이 깨질 수 있다.
  - 제안: `const nodeId = state.pending?.nodeId;`로 한 번만 추출해 `graceful` 계산과 `command` 조립 모두에서 재사용하면 단언이 국소화되고 의도가 더 명확해진다.

## 요약

이번 변경은 전반적으로 가독성이 높다 — 특히 EIA §R17 재조정 배경, wire shape 매핑, graceful vs cancel 분기 이유 등을 함수/필드 단위 JSDoc으로 촘촘히 남겨 "왜"가 코드에 남아있는 점이 인상적이며, 백엔드·프론트엔드·타입 정의·테스트 간 SoT 표기(spec 섹션 참조)도 일관적이다. 다만 `use-widget.ts`의 `newChat`/`endConversation` 간 teardown 시퀀스 중복, `panel.tsx` 확인 다이얼로그의 CSS 클래스 기반 테스트 결합, `confirming` 값을 둘러싼 반복 삼항 분기는 소규모지만 전형적인 "복붙 후 분기" 패턴으로 향후 세 번째 케이스가 추가될 때 변경 지점이 늘어날 소지가 있다. 나머지(타입 좁히기, 백엔드 스프레드 중복, non-null 단언)는 경미한 개선 여지 수준이며 즉시 조치가 필요한 수준은 아니다.

## 위험도
LOW
