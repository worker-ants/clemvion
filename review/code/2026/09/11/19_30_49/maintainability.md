# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위 메모

이 diff(`impl-chat-channel-binder-t2`)는 이미 3라운드(`18_04_36` → `18_42_05` →
`19_06_54`)를 거친 리팩터의 최종 스냅샷이다. 프롬프트가 크기 제한으로 diff 를 생략한
파일(1·2·6·7번)은 `Read`/`git diff origin/main --`로 원본을 직접 열어 확인했다. 유지보수성
관점의 실제 대상은 코드 파일 8개
(`chat-channel-binder.service.ts`/`.spec.ts`, `trigger-callback-url.ts`/`.spec.ts`,
`triggers.module.ts`, `triggers.service.ts`/`.spec.ts`, `triggers.web-chat.spec.ts`)이고,
나머지(plan 문서 2개 + 이전 3라운드 review 산출물 40여 개)는 프로세스 산출물이라 함수
길이·중첩·매직넘버 같은 코드 품질 축의 대상이 아니다 — 이전 라운드 3개 전부가 같은 결론을
내렸고 이번에도 동일하게 판단했다.

검증: `npx tsc --noEmit` 로 해당 파일들에 타입 오류가 없음을 확인했고, 저장소에 어떤
뮤테이션도 가하지 않았다(`git status --short` 는 이 세션 출력 디렉터리만 추가로 보임 —
읽기·`tsc` 실행만 수행).

## 이전 라운드 지적의 해소 여부 재확인

세 라운드에 걸쳐 지적된 항목이 이번 최종 상태에 실제로 반영돼 있는지 직접 대조했다.

- **1라운드 W1(콜백 URL 인자 순서)** — `trigger-callback-url.ts:46-53` 이 `{ baseUrl,
  endpointPath }` 이름 인자를 받는다. 두 호출부
  (`chat-channel-binder.service.ts:112-115`, `triggers.service.ts:1061-1064`) 모두 이름
  인자로 호출 — **해소 확인**.
- **1라운드 W2(teardown adapter 경로 미검증)** — `chat-channel-binder.service.spec.ts` 의
  `it('provider 가 등록돼 있으면 그 config 로 adapter.teardownChannel 을 부른다', …)`
  (line 107) 와 catch 케이스(line 124)가 각각 호출 인자와 `warn` 메시지 내용까지
  단언한다 — **해소 확인**.
- **2라운드 INFO 7(테스트 헬퍼 위치 인자)** — `chat-channel-binder.service.spec.ts:35-42`
  `makeBinder({ adapter, providerRegistered })` 로 이름 인자화됨 — **해소 확인**.
- **2라운드 INFO 8(spy 복원이 단언 뒤에 있어 실패 시 전역 오염)** — 같은 파일 line 75-77
  `afterEach(() => jest.restoreAllMocks())` 로 옮겨짐 — **해소 확인**.
- **2라운드 W1(`rotateBotToken` 의 `ConfigService` mock 이 키를 무시)** —
  `triggers.service.spec.ts` 의 `rotateBotToken — 6단계 오케스트레이션` describe 안
  `get: jest.fn((key) => key === 'app.url' ? … : undefined)` 로 키 인식형이 됐고, 바로
  아래 `expect(mockAdapter.setupChannel).toHaveBeenCalledWith(expect.anything(),
  'http://localhost:3000/api/hooks/hook-abc')` 로 URL 값까지 단언 — **해소 확인**.
- **2라운드 W2(`@param` 태그가 구조분해 인자를 가리켜 존재하지 않는 대상을 참조)** —
  `trigger-callback-url.ts:50,52` 프로퍼티별 인라인 JSDoc 으로 교체됨, `@param` 태그
  잔존 없음(grep 0건) — **해소 확인**.

## 발견사항

- **[INFO]** `trigger-callback-url.ts` 클래스 상단 JSDoc 블록에 내용 없는 빈 줄이 닫는
  `*/` 바로 앞에 남아 있다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:44` (`*` 만 있는
    빈 줄, 다음 줄 45가 `*/`)
  - 상세: `19_06_54` 라운드가 이미 지적한 항목이고 그 라운드 스스로 "급하지 않음, blocking
    사유 아님"으로 처분했다. 이번 라운드에서도 그대로 남아 있어 재확인만 한다 — `@param`
    태그 두 줄을 프로퍼티별 인라인 JSDoc 으로 옮기면서 생긴 빈 줄로 보이며, 기능에는
    영향이 없는 순수 스타일 트리비아다.
  - 제안: 다음에 이 파일을 편집할 때 빈 줄 한 줄 제거. 이 PR 을 막을 사유는 아니다.

- **[INFO]** `setupChatChannel` 한 함수가 레지스트리 조회 → 가드 → callback URL 조립 →
  secret ref 생성 → 3종 secret 쓰기 게이팅 → adapter 호출 → 성공/실패 양쪽 config 병합·
  컬럼 갱신까지 담당해 189줄(83~271행)에 이른다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:83-271`
  - 상세: 세 라운드 전부가 이미 같은 지점을 지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md:2246`
    (`- [ ] setupChatChannel 이 6~8가지 관심사를…`)에 developer 항목으로 등재돼 있다. 이번
    diff 도 이 함수를 손대지 않았다 — 새 결함이 아니라 이관된 기존 결함의 재확인이다. 중첩
    깊이 자체는 얕다(최대 `try`→`if` 2단) — 문제는 길이·책임 수이지 제어흐름 복잡도가
    아니다.
  - 제안: 조치 불요(이미 트래커 등재). 급하지 않다면 secret-ref 생성·쓰기 3종을
    `resolveChatChannelSecrets()`, config 병합을 `mergeSetupResult()` 같은 헬퍼로 나누는
    것을 고려할 수 있다.

- **[INFO]** `buildSecretRef({ scope: 'triggers', resourceId, name })` 호출 패턴과
  `trigger.config as { chatChannel?: ChatChannelConfig }` 캐스팅이 이동 이후 두 파일에
  걸쳐 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:118-127`
    (`botTokenRef`/`inboundSigningRef` 생성), `:278-280`(`teardownChatChannel` 상단
    캐스팅) 대 `codebase/backend/src/modules/triggers/triggers.service.ts:705-` 부근
    (`rotateBotToken` 안의 동일 패턴 3종 생성).
  - 상세: 이동 전에는 같은 파일 내부 중복이었던 것이 서비스 경계를 넘는 두 파일 간 중복이
    되면서 한쪽만 보면 다른 쪽의 존재를 알아채기 어려워졌다(발견 가능성의 미세한 후퇴).
    `name` 문자열(`'bot-token'`/`'inbound-signing'`)이 바뀌면 두 파일을 동시에 고쳐야
    하는데 그 연결고리를 code 상에서 강제하는 공유 헬퍼가 없다. 세 라운드 전부가 이미
    같은 지점을 지적했고 트래커에 등재돼 있다.
  - 제안: 조치 불요(기존 관찰 유지). 후속으로 `buildChatChannelSecretRefs(triggerId)` 같은
    작은 공유 헬퍼를 고려할 수 있으나 급하지 않다.

- **[INFO]** 옮겨온 로그 경고 4곳이 여전히 `` `TriggersService: …` `` 리터럴로 시작해
  logger 컨텍스트(`ChatChannelBinderService`)와 메시지 본문의 클래스명이 불일치한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:100`,
    `:250`, `:253`, `:288`
  - 상세: 클래스 상단 JSDoc(43-46행)에 "의도적으로 남겼다 — 바꾸면 관측 가능한 출력이
    달라져 순수 이동 주장이 약해진다"는 근거가 명시돼 있고,
    `plan/in-progress/spec-draft-nullable-notation-followups.md:2349`에 정정 항목으로
    등재돼 있다. 실제 운영 로그를 보는 사람 입장에서는 존재하지 않는 클래스 이름이 찍혀
    혼동을 줄 수 있는 실질적 이슈이지만, 의도된 트레이드오프이고 후속이 트래커에 걸려 있다.
  - 제안: 없음(이미 계획됨) — 다음에 이 파일을 손댈 때 리터럴만 갱신.

## 긍정적으로 확인된 사항

- 새 클래스 `ChatChannelBinderService`(`chat-channel-binder.service.ts`)는 같은 폴더
  선례(`chat-channel-token-rotator.service.ts`)와 네이밍·구조·`new` 직접 주입 테스트
  관례가 일치한다. 왜 provider 인지, 왜 `chat-channel/` 이 아니라 `triggers/` 에 있는지,
  왜 로그 리터럴을 안 바꿨는지를 근거와 함께 docstring 에 남겨 다음 사람이 되돌리지 않도록
  방어하고 있다.
- `trigger-callback-url.ts` 는 순수 함수로 분리되며 이름 인자화로 인자 순서 실수를 형태로
  없앴고, `getAppBaseUrl()` 과의 알려진 중복을 지금 통합하지 않는 이유(DI 경유 차이, 14개
  테스트 블록의 mock 통제권 상실)를 실측 근거와 함께 문서화해 향후 재조사 비용을 줄였다.
- `trigger-callback-url.spec.ts` 는 fallback·후행 슬래시·선행 슬래시 세 분기를 개별
  케이스 + 조합 케이스로 나누고 각 케이스가 "왜 이 동작이 맞는지"를 주석으로 남겨, 다음
  사람이 실수로 `??` 를 `||` 로 바꾸는 것을 방지한다.
- 테스트 provider 등록(`triggers.service.spec.ts`/`triggers.web-chat.spec.ts`, 14개
  describe 블록에 `ChatChannelBinderService` 추가)이 `createBaseProviders()`/
  `otherProviders()` 헬퍼 재사용 덕에 diff 10줄 안팎으로 억제됐다 — 테스트 보일러플레이트
  중복을 낮게 유지한 좋은 사례다.
- `triggers.service.ts` 에서 두 메서드(`setupChatChannel`/`teardownChatChannel`)와
  `buildCallbackUrl` 헬퍼를 제거한 diff 가 호출부만 `this.chatChannelBinder.xxx(...)` 로
  바꾸고 인접 주석("3-쓰기 표는 `chat-channel-binder.service.ts` 의 JSDoc 에 있다")까지
  갱신해, 이동 후 주석 stale 화가 없음을 직접 대조로 확인했다.

## 요약

이 최종 diff 는 3라운드에 걸쳐 지적된 유지보수성 관련 항목(콜백 URL 인자 순서, teardown
경로 미검증, 테스트 헬퍼 위치 인자, spy 복원 시점, mock 판별력, stale `@param` 태그)이 전부
실제 코드에 반영되어 해소돼 있음을 직접 재확인했다 — 새로운 회귀는 없다. 남은 관찰은 전부
INFO 수준이며 그중 셋(`setupChatChannel` 189줄·6~8개 관심사, secret-ref 생성 패턴의
파일 간 중복, 로그 리터럴의 의도적 클래스명 불일치)은 이동 전부터 있던 기존 결함이 근거와
함께 트래커에 등재된 채로 그대로 이관된 것이고, 하나(JSDoc 빈 줄)는 순수 스타일 트리비아다.
새로 도입된 매직 넘버·깊은 중첩·불명확한 네이밍·중복 로직은 없으며, 신규 코드(순수 함수·
테스트 스펙 2건)는 저장소 기존 관례를 정확히 따른다. 이번 PR 을 막을 유지보수성 사유는
없다.

## 위험도

NONE
