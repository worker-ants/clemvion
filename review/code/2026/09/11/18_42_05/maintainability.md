# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위 메모

이 라운드의 diff 는 코드 파일 8개(`codebase/backend/src/modules/triggers/` 하위)와
plan 문서 2개, 그리고 직전 라운드(`review/code/2026/09/11/18_04_36/*`)의 리뷰
산출물이 커밋된 것으로 구성된다. 유지보수성 관점의 대상은 코드 파일 8개로 좁혔다
(plan/review 문서는 함수 길이·중첩·매직넘버 같은 코드 품질 축의 대상이 아니다).
프롬프트가 크기 제한으로 diff 를 생략한 `chat-channel-binder.service.ts` /
`triggers.service.ts` 는 `Read` 로 원본을 직접 열어 확인했다. `git status --short`
로 확인한 결과 저장소에 미커밋 뮤테이션은 없었고(`review/code/2026/09/11/18_42_05/`
자체 출력 디렉터리만 untracked), 이번 리뷰는 어떤 파일도 수정하지 않았다.

직전 라운드(`18_04_36`)에서 이미 동일 코드 대부분을 정밀 검토했고, 그 라운드가 지적한
W1(콜백 URL 인자 순서)·W2(teardown adapter 경로 미검증)는 이번 diff 에서 해소된 상태로
확인된다 — 아래 "확인된 해소 사항" 참조. 신규로 검토가 필요한 부분은 그 해소로 새로
추가된 스펙 파일 2개(`chat-channel-binder.service.spec.ts`,
`trigger-callback-url.spec.ts`)다.

## 확인된 해소 사항 (긍정 관찰)

- **W1(인자 순서) 해소 확인**: `trigger-callback-url.ts:48-53` 이 `{ baseUrl, endpointPath }`
  이름 인자 객체를 받도록 시그니처를 바꿔, 호출부 인자 스왑이 애초에 형태로 불가능해졌다.
  두 호출부(`chat-channel-binder.service.ts:112-115`, `triggers.service.ts:1061-1064`)
  모두 이름 인자로 호출한다 — 순서에 의존하는 코드가 이 함수 주변에 더 이상 없다.
- **W2(teardown adapter 경로 미검증) 해소 확인**: 신규
  `chat-channel-binder.service.spec.ts` 의 3번째·4번째 `it` 가 `adapter.teardownChannel`
  호출과 그 인자, 그리고 실패 시 best-effort catch 의 `Logger.warn` 호출 내용(trigger id ·
  사유)까지 단언한다. `resolves` 만 보지 않고 warn 메시지 내용까지 검증해 "조용히 삼킨다"
  회귀를 실제로 잡을 수 있는 형태다.

## 발견사항

- **[INFO]** `setupChatChannel` 한 함수가 여전히 레지스트리 조회 → 가드 → callback URL 조립
  → secret ref 생성 → 3종 secret 쓰기 게이팅 → adapter 호출 → 성공/실패 양쪽 config 병합·
  컬럼 갱신까지 담당해 189줄(생성자 이후 로직 기준 83~271행)에 이른다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:83-271`
  - 상세: 이 diff 는 이 함수를 그대로 옮겼을 뿐 새로 작성하지 않았다. 같은 함수 길이·응집도
    지적이 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(`/ai-review
    2026-09-10 23_55_23` maintainability W6, "133 → 186줄")에 등재돼 있고, 직전 라운드
    (`review/code/2026/09/11/18_04_36/maintainability.md`)도 같은 결론으로 처분했다.
    새로운 결함이 아니라 이관된 기존 결함이 그대로 남아 있다는 재확인이다. 다만 중첩 깊이
    자체는 얕다(최대 2단, `try`→`if`) — 문제는 길이·책임 수이지 제어흐름 복잡도가 아니다.
  - 제안: 조치 불요(이미 트래커에 등재, 대상 파일 경로만 갱신하면 됨). 급하지 않다면
    secret-ref 생성/쓰기 3종을 `resolveChatChannelSecrets()` 같은 헬퍼로, config 병합을
    `mergeSetupResult()` 같은 헬퍼로 나누는 것을 고려할 수 있다.

- **[INFO]** `botTokenRef`/`inboundSigningRef` 를 만드는 `buildSecretRef({ scope: 'triggers',
  resourceId, name })` 호출 패턴이 이동 이후 두 파일에 걸쳐 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:118-127`
    (`setupChatChannel`) vs `codebase/backend/src/modules/triggers/triggers.service.ts:1019-1037`
    (`rotateBotToken`, `botTokenRef`/`v2Ref`/`inboundSigningRef` 3개 생성) — 실측으로
    두 위치 모두 확인.
  - 상세: 이 중복은 새로 생긴 게 아니라 이동 전에도 같은 파일 안에서 `setupChatChannel`과
    `rotateBotToken`이 각자 이 호출을 반복하던 것이다. 다만 이동으로 "같은 파일 내부 중복"이
    "서로 다른 두 파일 간 중복"이 되면서, 한쪽만 보고 있으면 `name: 'bot-token'` /
    `'inbound-signing'` 문자열 리터럴이 다른 쪽에도 있다는 사실을 알아채기 더 어려워졌다
    (발견 가능성이 낮아진 것이 유지보수성 관점의 실질적 변화다). 리터럴 자체가 스킴 상수라
    한쪽만 바꾸면 조용히 어긋난다.
  - 제안: `buildChatChannelSecretRefs(triggerId): { botTokenRef, inboundSigningRef }` 같은
    작은 공유 헬퍼로 뽑으면 두 파일이 같은 함수를 호출하게 돼, 다음에 ref 스킴이 바뀔 때
    grep 없이도 타입 체크로 갱신 지점이 드러난다. 이번 PR 을 막을 사유는 아니다.

- **[INFO]** 옮겨온 로그 경고 4곳이 여전히 `` `TriggersService: …` `` 리터럴로 시작해,
  logger 컨텍스트(`ChatChannelBinderService`)와 메시지 본문의 클래스명이 불일치한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:100`,
    `:250`, `:253`, `:288`
  - 상세: 클래스 상단 JSDoc(43-46행)이 "로그 메시지의 `TriggersService:` 접두는 의도적으로
    남겼다 — 바꾸면 관측 가능한 출력이 달라져 순수 이동 주장이 약해진다"고 명시적으로
    근거를 남겨 두었다. 운영자가 로그를 볼 때 존재하지 않는 클래스 이름이 찍혀 혼동을 줄 수
    있는 실질적 이슈이지만, 의도된 트레이드오프이고 정정 항목이 이미 트래커에 걸려 있다.
  - 제안: 없음(이미 계획됨) — 다음에 이 파일을 손댈 때 리터럴만 `ChatChannelBinderService:`
    로 갱신.

- **[INFO]** 신규 테스트 헬퍼 `makeBinder(adapter, has: boolean)` 의 두 번째 인자가 위치
  기반 boolean 이라, 호출부만 보면 그 의미를 바로 알기 어렵다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts:28`
    (선언), 호출부 `:59`(`makeBinder(adapter, true)`) · `:69`(`makeBinder(adapter, false)`)
  - 상세: 같은 PR 이 프로덕션 코드(`trigger-callback-url.ts`)에서 "인자를 이름으로 받는 이유
    — 순서 실수를 형태로 없앤다"는 원칙을 명시적으로 채택했는데, 신규로 추가된 이 테스트
    헬퍼에는 같은 원칙이 적용되지 않았다. 매개변수 이름(`has`)이 어느 정도 self-documenting
    하고 호출부가 2곳뿐이라 실질적 위험은 낮지만, 원칙의 일관성이라는 점에서 사소한 흠이다.
  - 제안: 조치 불요 수준(테스트 헬퍼, 호출부 2곳). 다음에 세 번째 케이스가 추가돼 인자가
    늘어나면 `makeBinder(adapter, { has })` 형태의 옵션 객체로 바꾸는 것을 고려.

## 긍정적으로 확인된 사항

- 신규 `chat-channel-binder.service.spec.ts` 는 같은 폴더 선례
  (`chat-channel-token-rotator.service.spec.ts`)와 동일한 `makeXxx()` 팩토리 + `new` 직접
  주입 관례를 따른다 — 직접 대조로 확인. `describe`/`it` 제목이 한국어로 검증 대상과 이유를
  명확히 서술하고, 각 테스트가 단일 책임(등록 없음/미등록/성공 호출/best-effort catch)만
  담당해 함수 길이·복잡도 문제가 없다.
- 신규 `trigger-callback-url.spec.ts` 는 순수 함수의 세 분기(fallback · 후행 슬래시 ·
  선행 슬래시)를 개별 케이스 + 조합 케이스로 총 7개 `it` 로 나누고, 각 케이스가 "왜 이
  동작이 맞는지"를 주석으로 남겨 다음 사람이 실수로 `?? `를 `||`로 바꾸는 것을 방지한다.
  매직 넘버·깊은 중첩이 없고 테스트 하나당 책임이 명확하다.
- `triggers.module.ts`(파일 5)의 이동 관련 주석과 `triggers.service.ts`(파일 7)의 잔류
  주석("3-쓰기 표는 `chat-channel-binder.service.ts` 의 JSDoc 에 있다")이 실제 코드 구조와
  정확히 일치함을 직접 대조로 확인했다 — 이동 후 주석 stale 화가 없다.
- 테스트 provider 등록(파일 6·8, `ChatChannelBinderService` 14개 describe 추가)이
  `createBaseProviders()`/`otherProviders()` 헬퍼 재사용 덕에 diff 10줄로 억제됐다 — 테스트
  보일러플레이트 중복을 낮게 유지한 좋은 사례다.

## 요약

이번 diff 는 `TriggersService`(1855→1351줄)에서 `setupChatChannel`/`teardownChatChannel`/
`buildCallbackUrl`을 `ChatChannelBinderService`와 순수 함수 `buildTriggerCallbackUrl`로
뽑아낸 동작 보존 리팩터링이며, 직전 라운드가 지적한 두 결함(콜백 URL 인자 순서 · teardown
adapter 경로 미검증)이 이번 diff 에서 실제로 해소됐음을 코드·신규 테스트로 직접 확인했다.
신규로 추가된 두 스펙 파일은 이 저장소의 기존 관례를 정확히 따르고 단일 책임·명확한 이름
·풍부한 근거 주석을 갖춰 유지보수성 관점에서 흠이 없다. 남은 관찰은 전부 INFO 수준이고
이미 이동 전부터 있던 기존 결함(setupChatChannel 189줄·6~8개 관심사, secret-ref 생성 패턴이
두 파일로 갈라진 중복, 로그 리터럴의 의도적 클래스명 불일치)이 그대로 이관된 것이며 모두
근거와 함께 문서화·트래커 등재돼 있다. 새로 발견한 것은 신규 테스트 헬퍼의 위치 기반
boolean 인자 하나뿐이고 이 역시 매우 경미하다. 이번 PR 을 막을 유지보수성 사유는 없다.

## 위험도

LOW
