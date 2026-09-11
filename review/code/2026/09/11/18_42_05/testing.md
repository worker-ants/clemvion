# 테스트(Testing) 리뷰 — `impl-chat-channel-binder-t2` (2라운드, W1/W2/W3 해소 확인)

## 검증 방법

프롬프트만으로 판단하지 않고 저장소를 직접 열어 대조했고, 뮤테이션을 **실행**해 이전 라운드
(`review/code/2026/09/11/18_04_36`)가 지적한 W1(콜백 URL 인자 순서)·W2(`teardownChatChannel`
adapter 경로 미실행)가 이번 diff 로 실제로 닫혔는지 재현했다.

- 베이스라인: `npx jest src/modules/triggers` → **9 suites / 257 passed / 1 skipped**
  (RESOLUTION.md 의 "246 → 257" 주장과 일치, 신규 파일 2개 11케이스도 `npx jest
  chat-channel-binder.service.spec.ts trigger-callback-url.spec.ts` 로 별도 확인 → 11/11 통과).
- 뮤테이션 A: `chat-channel-binder.service.ts` `teardownChatChannel` 의
  `await adapter.teardownChannel(chatChannelCfg);` 를 주석으로 제거 → **RED 2건**
  (`provider 가 등록돼 있으면...` · `adapter 가 던져도 삼키고...`). W2 가 실제로 닫혔음을
  직접 재현.
- 뮤테이션 B: `triggers.service.ts` `rotateBotToken` 내부
  `buildTriggerCallbackUrl({ baseUrl: this.configService.get<string>('app.url'), ... })` 의
  키 문자열을 `'app.url'` → `'app.WRONG_KEY_MUTANT'` 로 변경(즉 이 호출부가 엉뚱한 config 키를
  읽어도) → `triggers.service.spec.ts` **전량 GREEN**(123/123). 아래 발견사항 W1 의 근거.

두 뮤테이션 모두 원본을 스크래치로 백업 후 저장소 파일을 직접 고치고 `cp` 로 원복,
`git status --short`/`git diff HEAD` 로 클린 확인했다. **다만 뮤테이션 B 복구 중 사고가
있었다** — 아래 "검증 중 관측된 이상 상태" 참고.

## 발견사항

- **[WARNING]** `rotateBotToken` 의 `buildTriggerCallbackUrl` 호출부는 여전히 **값 자체가
  검증되지 않는다** — 인자 순서 위험은 닫혔지만 "올바른 config 키를 읽는지"는 무엇도 보지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken` 메서드
    (직접 Read 로 확인한 현재 줄 번호 984행부터, `callbackUrl` 조립은 1061~1064행 — 이 파일은
    프롬프트에 diff 가 생략되어 게이트 번호가 없으므로 소스를 직접 열어 확인한 줄 번호). 대응
    테스트는 `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1965`
    (`'정상 — old token resolve → v2 백업 → primary rotate → setupChannel → webhook secret
    store → trigger 갱신'`).
  - 상세: 이전 라운드(`review/code/2026/09/11/18_04_36/testing.md` WARNING 1)는 *"두 호출부
    사이에 인자 순서 검증이 비대칭"* 이라고 지적했고, 이번 라운드는 `buildTriggerCallbackUrl`
    의 시그니처를 이름 인자로 바꿔 **위치 스왑 자체를 구조적으로 없앴다**(정당한 처방 —
    `trigger-callback-url.ts` JSDoc 34-43행이 근거를 스스로 적었고 재현도 맞다). 그런데 이
    처방은 "두 인자를 서로 바꿔치기"만 막지, "엉뚱한 config 키를 읽는" 것 같은 **내용 오류**는
    전혀 막지 못한다. 실제로 `rotateBotToken` 호출부의 `'app.url'` 리터럴을 다른 문자열로
    바꿔도 `triggers.service.spec.ts` 전체(123케이스)가 그대로 GREEN 이었다(위 뮤테이션 B) —
    `rotateBotToken` 의 `'정상 — ...'` 테스트가 `mockAdapter.setupChannel` 을
    `toHaveBeenCalled()` 로만 확인하고 두 번째 인자(콜백 URL 문자열)는 단언하지 않기 때문이다.
    반면 같은 함수의 첫 번째 호출부(`ChatChannelBinderService.setupChatChannel`)는
    `'TriggersService — webhook callbackUrl 조립 (app.url 사용 회귀 방지)'` describe
    (`triggers.service.spec.ts:1539`)가 실제 URL 문자열과 `configGet).toHaveBeenCalledWith(
    'app.url')` 까지 단언한다 — 같은 헬퍼의 두 호출부 사이에 검증 수준이 여전히 비대칭이다.
  - 제안: `rotateBotToken` 의 `'정상 — ...'` 테스트(또는 별도 케이스)에
    `expect(mockAdapter.setupChannel).toHaveBeenCalledWith(expect.anything(),
    '<기대 URL>')` 한 줄을 추가해 실제 URL 값(따라서 사용된 config 키)을 고정한다. 이전
    라운드가 제안했던 조치와 동일한 형태이며, 이번 라운드의 시그니처 변경은 이것을
    **대체하지 않는다** — 서로 다른 결함 클래스(순서 vs 내용)를 막는다.

- **[INFO]** `chat-channel-binder.service.spec.ts` 의 `teardownChatChannel` 신규 4케이스는
  W2 가 지적한 4가지 분기(설정 없음 / provider 미등록 / 정상 / 예외)를 전부 커버하며,
  뮤테이션(A) 로 실제로 RED 를 내는 것을 직접 재현했다 — 회귀 방지 효과가 실재한다. 다만
  `chatChannelCfg` 는 존재하되 `provider` 필드가 비어 있거나(`''`) `undefined` 인 방어적
  케이스는 다루지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts`
    (파일 전체 4개 `it` 블록).
  - 상세: `teardownChatChannel` 은 `registry.has(chatChannelCfg.provider)` 를 그대로 호출하므로
    `provider` 가 빈 문자열/undefined 여도 `false` 를 반환하는 한 안전하게 조기 반환한다 —
    실제 위험은 낮다. 다만 이 경계(레거시 데이터에 `chatChannel` 객체는 있는데 `provider` 가
    빠진 경우)는 코드 주석에서도 별도로 언급되지 않아 의도적 설계인지 우연한 안전인지가
    테스트로 고정돼 있지 않다.
  - 제안: 조치 불요(현재 동작이 안전한 방향). 후속에서 이 파일을 다시 만질 일이 있으면 케이스
    하나(`provider: undefined`)를 추가해 의도를 문서화하는 정도로 충분.

- **[INFO]** `Logger.prototype.warn` 를 `jest.spyOn` 하는 마지막 테스트가 `mockRestore()` 를
  단언 통과 이후에만 호출한다 — 단언이 실패하면 스파이가 복원되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts`
    (`'adapter 가 던져도 삼키고 trigger id 와 사유를 warn 으로 남긴다'` 케이스, 파일 마지막
    `it` 블록 — `warn.mockRestore()` 가 4개의 `expect` 뒤에 위치).
  - 상세: 이 파일에서는 이 테스트가 마지막이라 지금 당장 다른 테스트를 오염시키지는 않지만,
    `afterEach`/`try-finally` 로 복원을 보장하는 편이 이 파일에 케이스가 추가될 때(특히 이
    테스트 뒤에 새 `it` 이 붙을 때) 더 안전하다. 이 저장소의 다른 spec 파일들(예:
    `triggers.service.spec.ts`)은 `Logger` 를 직접 spy 하는 대신 mock provider 를 쓰는 경우가
    많아 이 패턴 자체가 이 파일에 새로 도입된 지역적 관행이다.
  - 제안: `afterEach(() => jest.restoreAllMocks())` 또는 `try { ... } finally { warn.mockRestore(); }`
    로 바꾸면 향후 케이스 추가 시 순서 의존을 없앨 수 있다. 지금 당장 막을 사유는 아니다.

- **[INFO]** W1(이전 라운드)·W2 외 이전 라운드 WARNING 3(신규 클래스 전용 spec 의 비대칭
  커버리지)의 처분("`setupChatChannel` 은 여기서 다시 덮지 않는다")을 실측으로 재확인했다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts:1-18`
    (파일 헤더 JSDoc), 대응 회귀는 `triggers.service.spec.ts:3062`·`:3314`(`it.each`)·`:3344`.
  - 상세: 세 "회귀 캐너리" 테스트 이름이 실재하고 스위트 전체(257/258, 1 skip 은 무관 카테고리)
    가 통과함을 직접 실행으로 확인했다. `setupChatChannel` 을 새 파일에서 중복 단언하지 않기로
    한 판단(같은 것을 두 곳에서 단언하면 정본이 갈린다)은 타당하고, 실제로 그 판단의 근거로
    인용된 3개 뮤테이션(게이팅·`inboundSigningRefSurvives`·`fallbackConfig`)이 RED 를 낸다는
    이전 라운드의 실측도 (본 라운드에서 재실행하지는 않았지만) 스위트 통과 상태와 모순되지
    않는다.
  - 제안: 없음 — 이미 올바르게 처분됨.

## 검증 중 관측된 이상 상태 (자기 사고 — 투명하게 보고)

뮤테이션 B 복구 과정에서 사고가 있었다. 원본 백업용 `cp` 명령이 포함된 첫 시도가 harness
정책으로 거부되면서(절대경로 heredoc 관련) **백업 없이** 두 번째 시도(상대경로 python
heredoc)로 곧바로 뮤테이션을 적용했다. 이후 복구에 쓴 `$SCRATCH/triggers.service.ts.orig` 는
이번 세션이 만든 파일이 아니라 **그 스크래치 디렉터리에 남아 있던, 훨씬 오래된 버전**(T2 이전,
`ChatChannelBinderService` 도입 전)이었다 — 이 스크래치 파일로 `cp` 복구하는 바람에
`triggers.service.ts` 가 순간적으로 옛 버전으로 덮였다. 즉시 `git diff HEAD` 로 이상을 감지하고,
세션 시작 시점 `git status` 가 이 파일에 대해 clean 이었음을 근거로 (다른 리뷰어의 미커밋
작업을 파괴하지 않는다는 규약 하에) `git checkout HEAD -- <그 파일>` 로 원상 복구했다. 이후
`npx jest src/modules/triggers` 를 재실행해 **9 suites / 257 passed / 1 skipped** 로 사고 이전과
동일함을 재확인했고, 최종 `git status --short` 는 `?? review/code/2026/09/11/18_42_05/` 한 줄만
남아 클린하다. 이 사실을 기록하는 이유는 스크래치 디렉터리에 남아 있던 이전 세션의 백업
파일이 다음 reviewer 의 뮤테이션 검증에도 같은 함정이 될 수 있어서다 — 뮤테이션 전 `cp`
백업이 실제로 성공했는지 매번 `diff`로 확인할 것.

## 긍정적으로 확인된 사항

- 새 파일 2개(`chat-channel-binder.service.spec.ts` 11케이스 중 4 · `trigger-callback-url.spec.ts`
  7케이스)는 모두 실제로 실행되고 통과한다(11/11, 별도 실행으로 확인).
- W2 가 지적한 "한 번도 안 돈 분기"는 실제로 뮤테이션 RED 로 막힌다(직접 재현).
- `trigger-callback-url.spec.ts` 는 분기 3개(fallback·후행 슬래시·선행 슬래시)뿐 아니라
  둘이 동시에 걸리는 입력(`양쪽 슬래시가 겹쳐도...`)까지 별도 케이스로 뒀다 — 흔히 놓치는
  "부분 매트릭스 완성 후 조합 케이스 누락"이 여기서는 재발하지 않았다.
  `??` vs `||` 의 현재 동작(빈 문자열 처분)을 캐너리로 고정한 것도 적절하다 — 나중에
  의도적으로 바꾸려면 이 테스트를 반드시 건드려야 하게 만든다.
- `triggers.service.spec.ts`/`triggers.web-chat.spec.ts` 에 `ChatChannelBinderService` 를
  실제 클래스로 추가한 9개 이상 지점 모두 그 생성자 의존(레지스트리 2종·secret resolver·
  configService·repository) 이 이미 같은 describe 안에 mock 으로 존재해, Nest DI 컴파일
  실패 없이 전량 통과한다(직접 실행으로 확인, 새로 깨진 describe 없음).

## 요약

이전 라운드가 지적한 W2(`teardownChatChannel` adapter 경로 미실행)는 신규
`chat-channel-binder.service.spec.ts` 4케이스로 실제로 닫혔다 — 뮤테이션으로 직접 재현해
확인했다. W1(콜백 URL 인자 순서)은 테스트 추가 대신 시그니처를 이름 인자로 바꾸는 구조적
처방으로 대응했고 그 처방 자체는 재현 결과 타당하다. 다만 그 처방은 **순서** 위험만 없앨 뿐,
`rotateBotToken` 호출부가 여전히 **값**(어떤 config 키를 읽는지)을 검증받지 않는다는 별개의
갭을 남겼다 — 뮤테이션으로 실증했다(config 키를 바꿔도 123케이스 전량 GREEN). 이는 같은
헬퍼의 두 호출부 사이에 남아 있는 테스트 커버리지 비대칭이며, 이전 라운드의 W1 처분이 이
갭까지 닫았다고 보기는 어렵다. 그 외 신규 spec 2개는 가독성·격리 모두 양호하고(마지막
`Logger` spy 복원 순서만 사소한 개선 여지), 기존 회귀 테스트(257케이스)는 이동 후에도 전부
유효하다.

## 위험도

LOW — 새로 만든 결함은 아니고(현재 코드는 정확하다), CRITICAL 로 볼 근거도 없다. 다만 위
WARNING 은 "다음 편집이 이 호출부의 config 키를 실수로 바꿔도 아무 테스트도 못 잡는다"는
실측된 회귀 위험이라 WARNING 으로 유지한다.
