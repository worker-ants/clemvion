# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위 메모

이번 라운드(`19_06_54`)는 직전 라운드(`18_04_36` → `18_42_05`)의 리뷰 지적(W1: 인자 순서/키
스왑, W2: JSDoc `@param` 태그 stale화, INFO 7·8: 테스트 헬퍼 위치 인자·spy 복원 시점)을
닫는 **fix-only** 커밋 2건(`92f4b0607`, `8f43b1f56`)이 누적된 상태다. 프롬프트가 diff 를
생략한 파일(1·2·7·9·10·12·13번)은 `Read` 로 원본을 직접 열어 확인했고, `git show 8f43b1f56`
으로 이번 라운드에서 실제로 바뀐 부분(직전 라운드 이후의 순증분)을 별도로 대조했다. 저장소에
어떤 뮤테이션도 가하지 않았다(`git status --short` 결과 `review/code/2026/09/11/19_06_54/`
디렉터리 신규 생성 외 변경 없음 — 읽기만 수행).

## 발견사항

- **[INFO]** 이번 라운드의 실제 변경분(`chat-channel-binder.service.spec.ts` 의 `makeBinder`
  이름 인자화·`afterEach(jest.restoreAllMocks)`, `trigger-callback-url.ts` 의 `@param` →
  프로퍼티 인라인 JSDoc, `triggers.service.spec.ts` 의 키 인식형 `ConfigService` mock +
  URL 값 단언)은 모두 직전 라운드가 지적한 항목을 정확한 범위로 좁혀 수정했고, 새로운 매직
  넘버·깊은 중첩·불명확한 네이밍을 도입하지 않았다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts`
    (`makeBinder` 정의부, `describe('ChatChannelBinderService.teardownChatChannel'` 블록의
    `afterEach`), `codebase/backend/src/modules/triggers/trigger-callback-url.ts:46-54`
    (함수 시그니처 프로퍼티별 JSDoc), `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
    (`describe('TriggersService.rotateBotToken — 6단계 오케스트레이션'` 블록의
    `ConfigService` provider 정의부 및 그 아래 `mockAdapter.setupChannel` 단언)
  - 상세: 조치 불요 — 정보성 확인.

- **[INFO]** `setupChatChannel` 이 여전히 한 함수에서 레지스트리 조회 → 가드 → callback URL
  조립 → secret ref 생성 → 3종 secret 쓰기 게이팅 → adapter 호출 → 성공/실패 양쪽의 config
  병합·컬럼 갱신까지 담당한다(약 189줄, 함수 시작부터 종료 중괄호까지).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
    (`async setupChatChannel(...)` 정의부 전체)
  - 상세: 이 함수 자체는 이번 라운드에서 변경되지 않았다(직전 라운드 리뷰가 이미 같은 지점을
    지적했고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 항목으로
    등재돼 있다). 새 결함이 아니라 기존 추적 항목의 재확인이다.
  - 제안: 없음 — 기존 트래커 항목 유지.

- **[INFO]** `buildSecretRef` 호출 패턴(`scope: 'triggers', resourceId: trigger.id, name: '...'`)
  과 `trigger.config as { chatChannel?: ChatChannelConfig }` 캐스팅이 `chat-channel-binder.service.ts`
  와 `triggers.service.ts` (`rotateBotToken`) 두 파일에 걸쳐 계속 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
    (`botTokenRef`/`inboundSigningRef` 생성부, `teardownChatChannel` 상단의 캐스팅) 대
    `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`rotateBotToken` 상단 `chatChannelCfg` 캐스팅 및 `botTokenRef`/`v2Ref`/`inboundSigningRef`
    생성부)
  - 상세: 이 중복은 이번 라운드가 만든 것이 아니라 이전 라운드(`18_04_36`)에서 이미 관측·기록된
    사전 존재 패턴이며 변경되지 않았다. `name` 문자열(`'bot-token'`/`'inbound-signing'`)이 바뀌면
    두 파일을 동시에 고쳐야 하는데 그 사실을 알려주는 공유 헬퍼가 없다는 점은 여전하다.
  - 제안: 조치 불요(이번 PR 범위 밖, 기존 관찰 유지). 후속으로 `buildChatChannelSecretRefs` 류의
    작은 공유 헬퍼를 고려할 수 있으나 급하지 않다.

- **[INFO]** `trigger-callback-url.ts` 클래스 상단 JSDoc 블록에 내용 없는 빈 줄이 닫는
  `*/` 바로 앞에 남아 있다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:44` (`@param` 태그 두 줄을
    제거하면서 생긴 빈 줄, 그다음 줄 `*/`)
  - 상세: 기능에 영향 없는 순수 스타일 트리비아. 직전 라운드에서 `@param` 태그를 프로퍼티별
    인라인 JSDoc 으로 옮기며 생긴 것으로 보인다.
  - 제안: 다음에 이 파일을 편집할 때 빈 줄 제거(급하지 않음, blocking 사유 아님).

## 요약

이번 라운드는 새 로직을 추가하지 않고 직전 두 라운드(`18_04_36`, `18_42_05`)의 리뷰 지적을
정확한 범위로 닫는 fix 커밋 2건만 반영한다 — 테스트 헬퍼 인자를 이름 기반으로 통일하고, mock
을 키 인식형으로 강화해 판별력을 높였으며, 구조분해 인자에 남아있던 stale `@param` 태그를
정리했다. 세 조치 모두 대상이 명확하고 부작용이 없으며, 새로운 가독성·네이밍·중첩·매직넘버
문제를 만들지 않았다. 유일하게 남은 관찰은 이전 라운드에서 이미 INFO 로 기록·수용된 사전 존재
항목(`setupChatChannel` 함수 길이, secret-ref 생성 패턴의 파일 간 중복)의 재확인이며, 이번
diff 가 그 상태를 악화시키지 않았다. 유지보수성 관점에서 이번 라운드를 막을 사유는 없다.

## 위험도

NONE
