# 유지보수성(Maintainability) Review

> 대상: `origin/main`(`ea56ffd62`) → `HEAD`(`160840462`) 웹채팅 세션 컨트롤(새 대화/종료) + 새로고침 히스토리
> 복원 PR. 본 라운드는 라운드1(`18_44_10`)·라운드2(`19_06_55`) maintainability WARNING 3건 + INFO 4건에
> 대한 실제 반영 여부를 코드 레벨에서 재확인하고, 전체 diff(백엔드 `interaction.service.ts`, 프런트
> `use-widget.ts`/`panel.tsx`/`conversation.ts`/`widget-state.ts`/`eia-types.ts` 등)를 다시 훑었다.

## 이전 라운드 반영 확인 (재검증)

다음은 라운드1/2에서 지적됐고 이번 코드에서 **실제로 해소됨을 확인**했다(재발 없음, 재차 지적 불필요):

- WARNING `newChat`/`endConversation` teardown 4줄 중복 → `resetSessionRefs()` 헬퍼로 통합됨 (`use-widget.ts:391-402`).
- WARNING 확인 다이얼로그 확정 버튼 CSS 클래스 결합 → `aria-label` 분리 + `panel.test.tsx` 가 `getByRole(name)` 사용으로 전환됨.
- WARNING `confirming` 3중 삼항 분기 → `CONFIRM_COPY` 조회 테이블로 통합됨 (`panel.tsx:32-46`).
- INFO `USER_TURN_SOURCES: Set<string>` → `Set<TurnSource>` 로 좁혀짐 (`conversation.ts:34`).
- INFO `"user_ended"` 4회 리터럴 반복 → `const reason = "user_ended"` 로 단일화됨 (`use-widget.ts:418`).
- INFO `conversation.ts` 파일 헤더 주석 stale(2-source) → 5-source 매핑으로 갱신됨 (`conversation.ts:1-6`).
- INFO 백엔드 `getStatus()` 조건부 스프레드 반복 → `base` 공통 필드 선조립으로 정리됨 (`interaction.service.ts:290-309`).

## 발견사항 (잔존)

- **[INFO]** `state.pending!.nodeId` 비-null 단언이 2라운드 연속 지적됐음에도 미반영 — 사실은 단언 자체가 불필요
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:427` (`endConversation`)
  - 상세: 라운드1(`18_44_10/maintainability.md`)과 라운드2(`19_06_55/maintainability.md`) 모두 이 non-null
    단언을 INFO로 지적했으나, RESOLUTION의 반영 리스트(양 라운드 모두)에 이 항목 번호가 매칭되지 않아
    실제 코드는 여전히 `nodeId: state.pending!.nodeId` 그대로다. 게다가 `InteractCommand`
    (`eia-types.ts:144`)의 `end_conversation` variant 는 `nodeId?: string` — **필드 자체가 optional** 이라
    단언 없이 `state.pending?.nodeId` 를 그대로 대입해도 타입이 정확히 맞는다. 즉 이 단언은 타입상 필요
    없는 사족이며, 두 차례 리뷰에서 "국소화"를 제안했지만 실은 완전히 제거 가능하다.
  - 제안: `nodeId: state.pending!.nodeId` → `nodeId: state.pending?.nodeId` 로 바꿔 단언을 제거. (또는
    기존 제안대로 `const nodeId = state.pending?.nodeId;` 로 한 번 추출해 `graceful` 계산과 함께 재사용해도
    되지만, 필드가 optional 이므로 굳이 추출하지 않고 옵셔널 체이닝만으로 충분하다.)

- **[INFO]** `teardownSession` / `resetSessionRefs` 두 헬퍼명이 유사해 책임 경계가 이름만으로는 구분되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:136-142`(`teardownSession`), `:391-396`(`resetSessionRefs`)
  - 상세: `teardownSession` 은 SSE·타이머·저장세션(+ start gen 증가)만 정리하고, `resetSessionRefs` 는 그
    위에 `sessionRef`/`startedRef`/큐까지 추가로 리셋하는 상위 래퍼다(라운드1 WARNING #3 반영 결과로 신설).
    두 이름 모두 "session" 을 포함해 어느 것이 "더 넓은" 정리인지 이름만으로 유추하기 어렵고, 실제로
    `handleEiaEvent` 의 종료 이벤트 분기는 여전히 하위 `teardownSession` 만 직접 호출한다(§SSE 종료 시
    `sessionRef` 를 null 로 만들지 않는 것이 의도적 차이인지 이름만으로는 불명확). JSDoc 이 순서 의존을
    설명해 실사용엔 문제가 없으나, 향후 세 번째 정리 경로가 추가되면 어느 헬퍼를 호출해야 하는지 매번
    JSDoc을 다시 읽어야 한다.
  - 제안: 필수는 아님. 이름을 `teardownStreamAndTimer()`/`resetAllSessionState()` 처럼 각자가 정리하는
    범위를 좀 더 드러내는 이름으로 바꾸면 호출부만 보고도 정리 범위를 유추할 수 있다.

## 요약

이번 diff 는 이미 2회의 fresh 리뷰(`18_44_10`, `19_06_55`)를 거치며 WARNING 급 발견사항(teardown 중복,
테스트 CSS 결합, 삼중 삼항 분기)이 전부 구조적으로 해소됐고, 이번 라운드에서 코드를 직접 대조해 그 반영을
재확인했다. 함수 길이·중첩 깊이·네이밍·기존 코드베이스 스타일(hook 분리, JSDoc으로 "왜" 남기기, spec 섹션
SoT 표기) 모두 일관되게 양호하다. 유일하게 눈에 띄는 점은 `state.pending!.nodeId` 비-null 단언이 두
라운드 연속 INFO로 지적됐음에도 실제로는 반영되지 않은 채 남아있다는 것인데, 확인해보니 애초에
`InteractCommand.end_conversation.nodeId` 가 optional 필드라 단언 자체가 불필요했다 — 즉시 조치 필요한
수준은 아니나 다음 접촉 시 함께 정리하면 좋다. 그 외 `teardownSession`/`resetSessionRefs` 네이밍 유사성은
경미한 참고 사항이다.

## 위험도
LOW
