# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `escapePromptText` 와 `escapeMarkdownV2` 의 정규식 중복
- 위치: `telegram.adapter.ts` L3145 / `telegram-message.renderer.ts` L821
- 상세: `escapePromptText` 함수 내부에 `/([_*[\]()~`>#+\-=|{}.!])/g` 정규식이 하드코딩되어 있으며, 이는 renderer의 `MD_V2_ESCAPE_REGEX` 상수와 완전히 동일하다. adapter가 renderer의 `escapeMarkdownV2`를 import하지 않고 독립적으로 복제한 상태라 향후 escape 규칙 변경 시 두 곳을 동시에 수정해야 한다.
- 제안: `escapeMarkdownV2`를 renderer에서 export하고 adapter에서 import해 사용하거나, 공유 유틸 모듈로 추출한다. 이미 renderer는 이를 export하고 있으므로 adapter에서 import만 추가하면 된다.

### [INFO] `ackInteraction` 내 `messageId` → `numericId` 이중 검증
- 위치: `telegram.adapter.ts` L3014~3018
- 상세: `messageId`가 `string` 타입으로 선언되어 파싱 시 `Number(messageId)`를 통해 다시 숫자로 변환하고, `Number.isInteger()` 가드를 추가한다. parser에서 이미 `typeof messageId === 'number'`로 검증 후 `String()`으로 변환한 값이기 때문에, adapter에서의 `Number.isInteger` 가드는 방어적이지만 타입 설계와 실제 데이터 흐름이 일치하지 않아 약간의 혼동을 준다.
- 제안: 타입 정의를 `messageId?: number`로 유지해 숫자 변환 없이 직접 사용하거나, 현재처럼 `string`을 유지한다면 adapter의 변환 로직에 이유를 설명하는 주석을 추가한다(현재 주석은 spec 참조뿐이라 변환 이유가 불명확하다).

### [INFO] `renderAiMessage` 내 `conversationKey: ''` 매직 리터럴
- 위치: `telegram-message.renderer.ts` L900
- 상세: typing 메시지 생성 시 `{ conversationKey: '', body: { kind: 'typing' } }` 처럼 빈 문자열이 하드코딩되어 있으며, 같은 파일의 `renderText`, `chunkRichText`에서도 동일하게 반복된다. "dispatcher 가 보정"이라는 주석은 `renderText`에만 있고, 새로 추가된 typing 메시지에는 없다.
- 제안: 명시적 상수(`const CONVERSATION_KEY_PLACEHOLDER = ''`)로 추출하거나, typing 메시지 생성 지점에도 "dispatcher 가 보정" 주석을 추가해 의도를 일관되게 표현한다.

### [INFO] `renderButtons` 함수의 과도한 길이와 책임 혼재
- 위치: `telegram-message.renderer.ts` L1153~1251
- 상세: `renderButtons`는 약 100줄에 달하며, (1) buttonConfig 추출, (2) 버튼 필터링/매핑, (3) promptText 결정, (4) visualNode 정규화, (5) 시각형 노드별 분기 렌더링, (6) buttons 메시지 생성 등 6가지 독립적 책임을 수행한다. 이 PR에서 변경이 없어 기존 문제지만, 유지보수 위험이 있다.
- 제안: visualNode 렌더링 부분을 별도 헬퍼(`renderVisualNode`)로 추출한다.

### [INFO] `normalizePresentationNodeOutput`의 내부 함수 `hasArrayKey` 인라인 정의
- 위치: `telegram-message.renderer.ts` L1002~1006
- 상세: `hasArrayKey` 함수가 `normalizePresentationNodeOutput` 내부에 정의되어 있어, 호출될 때마다 함수 객체가 재생성된다. 기능상 독립적인 순수 함수임에도 스코프 안에 중첩되어 있어 테스트나 재사용이 어렵다.
- 제안: 모듈 스코프의 private 헬퍼 함수로 격상한다.

### [INFO] `TelegramEditMessageReplyMarkupParams.reply_markup` 타입의 `unknown[][]` 사용
- 위치: `telegram-client.ts` L39
- 상세: `reply_markup?: { inline_keyboard: unknown[][] }` 에서 `unknown[][]`는 사용 측에서 타입 안전성을 포기하게 만든다. 실제로 adapter에서는 항상 `{ inline_keyboard: [] }` 또는 `{ inline_keyboard: Array<Array<{text:string; callback_data?:string; url?:string}>> }` 형태를 넘긴다.
- 제안: `unknown[][]` 대신 구체적인 union 타입이나 최소한 `Record<string, unknown>[][]`로 좁혀 호출 측 실수를 방지한다. 이미 `TelegramSendMessageParams.reply_markup`도 `unknown`이므로 클라이언트 레이어 전반에 걸친 타입 설계 방향이 일관성 있게 `unknown`이라면 INFO 수준이다.

### [INFO] 테스트 파일(`telegram-update.parser.spec.ts`)의 `update_id` 숫자 선택 일관성
- 위치: `telegram-update.parser.spec.ts` L1729
- 상세: 새로 추가된 테스트는 `update_id: 1051`을 사용한다. 기존 테스트들이 `100~112` 범위를 순차적으로 사용하는 패턴인데, 신규 케이스가 `1051`이라 패턴이 깨진다. 기능상 문제없지만 일관성이 아쉽다. `update_id`가 중복되지 않도록 `113` 또는 비어있는 순번을 쓰는 것이 더 자연스럽다.
- 제안: `update_id: 113`으로 변경해 기존 패턴을 유지한다.

---

## 요약

이번 변경(§5.1 typing indicator 선행 발송, §5.2(3) 버튼 클릭 후 inline_keyboard 제거, `messageId` 파싱 전달)은 전반적으로 유지보수 관점에서 양호하다. 새 기능들이 기존 패턴(순수 함수, best-effort try/catch, conversationKey 보정)을 잘 따르고 있으며, 코드 의도가 주석과 스펙 참조로 명확하게 표현되어 있다. 주요 개선 여지는 `escapeMarkdownV2` 정규식 중복(adapter가 renderer의 export된 함수 대신 동일 정규식을 재복제), `messageId`의 string/number 경계 이중 변환, `renderButtons`의 복잡도(기존 누적 문제)이며 모두 INFO 수준이다. 블로킹 이슈는 없다.

## 위험도

LOW
