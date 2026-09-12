# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `throwInvalidField` 의 `field` 매개변수가 `string` 이라, `rejectBlockedField` 경유가 아닌 직접 호출부는 오타 방지 혜택을 못 받는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56`(함수 시그니처), 직접 호출부 `:205-208`(`'chatChannel'`), `:223-226`(`'provider'`), `:270-273`·`:284-287`·`:294-297`·`:301-304`(`'inboundSigningPlaintext'` 리터럴 반복)
  - 상세: `rejectBlockedField` 의 docstring(`:77-84`)은 "인자를 `ChatChannelBlockedField` 로 받으면 오타가 컴파일 에러" 라고 정확히 그 함수 한정으로 설명한다. 하지만 저수준 헬퍼 `throwInvalidField` 자체는 `field: string` 이라 `assertChatChannelAlreadySetUp`·`assertInboundSigningPlaintextByProvider` 처럼 리터럴 문자열을 직접 넘기는 6곳은 그 보호를 못 받는다. `'inboundSigningPlaintext'` 문자열이 4번 반복되는데 오타가 나면 컴파일은 통과하고 `details.field` 값만 틀린 채 400 응답이 나간다.
  - 제안: 급하지 않음(현재 각 호출부는 `it.each`/`toMatchObject` 로 `details.field` 를 단언하는 테스트가 있어 오타는 즉시 RED 로 드러난다). 재발이 반복되면 `throwInvalidField<F extends string>(field: F, ...)` 대신 그 4개 리터럴을 별도 as-const 배열/유니언 타입으로 좁혀 타이핑하는 것을 고려.

- **[INFO]** `assertChatChannelInputSafe` 의 내부 필드 3종 차단이 개별 호출 3줄로 풀려 있다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:161-163`
  - 상세: `rejectBlockedField(chatChannel, 'botTokenRef')` / `'inboundSigningRef'` / `'inboundSigning'` 세 줄이 순차 호출된다. 배열 순회(`(['botTokenRef','inboundSigningRef','inboundSigning'] as const).forEach(...)`)로 줄일 수 있으나, 항목이 3개뿐이고 각 필드가 무엇을 막는지 한눈에 보이는 현재 형태가 오히려 읽기 쉬울 수 있어 결함으로 보진 않는다.
  - 제안: 그대로 두거나, 항목이 늘어날 경우에만 배열화 검토.

- **[INFO]** `chat-channel-input-rules.ts` 가 입력 검증(`assertChatChannelInputSafe` 등)과 출력 에러 변환(`translateSetupChannelError`)이라는 서로 다른 책임을 한 파일에 갖는다 — 이번 diff 가 새로 만든 상태는 아니고, 헤더 주석이 그 사실과 분리 보류 사유를 명시적으로 넓혔을 뿐이다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:34-39`(헤더 주석), `:329-348`(`translateSetupChannelError`)
  - 상세: 파일명 `chat-channel-input-rules.ts` 만 보면 `translateSetupChannelError` 같은 출력측 함수가 여기 있을 것이라 예상하기 어렵다. 이미 `plan/in-progress/chat-channel-rules-cleanup.md` §설계 판단 (2)와 `review/consistency/.../SUMMARY.md` INFO#3 이 "분리는 planner 축 결정" 으로 명시적으로 유보해 둔 항목이라 이번 PR 의 새 결함은 아니다.
  - 제안: 조치 불요 — 이미 트래커에 등재된 planner 항목을 통해 처리 예정.

- **[INFO]** `review/consistency/2026/09/12/15_53_35/**` (파일 9~16) 및 `plan/in-progress/chat-channel-rules-cleanup.md` (파일 8)는 자동 산출물/추적 문서로, 실제 애플리케이션 코드가 아니라 유지보수성 관점(가독성·네이밍·함수 길이 등)의 통상적 코드 결함 대상에 해당하지 않는다. 별도 지적 사항 없음.

## 요약

`chat-channel-input-rules.ts`/`.spec.ts` 리팩터는 11곳의 반복되던 `VALIDATION_ERROR` 봉투 생성을 `throwInvalidField` 로, 2곳의 중복 캐스팅을 `hasField`/`rejectBlockedField` 로 정확히 추출했고, 각 헬퍼의 존재 이유·트레이드오프(3번째 인자를 안 두는 이유, `never` 반환형 선택 이유, falsy-guard 를 남기는 이유)를 코드 주석과 `plan/` 문서에 함께 남겨 다음 사람이 판단 근거를 재구성할 필요가 없다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 네이밍은 기존 컨벤션(`throwIfAny` 같은 `throwXxx` 패턴)과 일치한다. 테스트 보강(`update` 모드 내부 필드 3종, provider label 스왑 검출, DTO 층 provider 필수 고정)도 실제 판별 가능한 fixture 로 구성되어 있다. 발견된 사항은 모두 INFO 수준의 사소한 관찰(저수준 헬퍼의 타이핑 범위, 3줄 반복의 배열화 여부, 이미 트래커에 등재된 파일 응집도 이슈)이며 즉각적인 수정을 요하지 않는다.

## 위험도
LOW
