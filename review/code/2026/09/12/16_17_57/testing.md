# 테스트(Testing) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강

## 검토 방법 메모

프롬프트 번들이 예산 초과로 `chat-channel-config.dto.ts`·`trigger-dto-validation.spec.ts` 전체
컨텍스트를 싣지 못해 `Read` 로 두 파일을 직접 열어 대조했다. 또한 `chat-channel-input-rules.ts` 의
"전체 파일 컨텍스트" 가 166/348줄에서 잘려 있어 나머지(특히 `assertChatChannelAlreadySetUp`·
`assertInboundSigningPlaintextByProvider`·`translateSetupChannelError`)도 직접 열어 확인했다.
저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 무변경, 확인 완료).

## 발견사항

- **[WARNING]** 두-층 등가성 설계("`null`/`''` 는 DTO 를 통과하고 서비스 층 가드가 거부한다")의
  **서비스 층 절반**이 어떤 테스트로도 실제로 검증되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 함수 `hasField`
    (라인 70) · `chat-channel-rejection-messages.const.ts` 헤더 주석(이번 diff 가 갱신한
    라인 8-10, "`null`/`''` → `@IsEmpty()` 를 통과하고 `chat-channel-input-rules` 의 가드가
    거부")
  - 상세: `hasField` 는 `typeof value !== 'undefined'` 로 존재를 판별하므로 `null` 은 "존재"로
    잡혀 `rejectBlockedField` 가 던진다 — 이것이 두-층 설계가 성립하는 이유다. 그런데 저장소
    전체를 검색(`grep -rn "botToken: null\|botTokenRef: null\|inboundSigningRef: null\|
    inboundSigning: null" codebase/backend/`)해도 `dto/trigger-dto-validation.spec.ts:848`
    한 곳만 나오고, 그 자리는 **DTO 파이프가 통과시킨다는 것**(`toBeNull()`)만 확인한다.
    그 값이 이후 서비스 층(`chat-channel-input-rules.ts` 의 `assertPatchCarriesNoSecrets` /
    `assertChatChannelInputSafe`)에 도달했을 때 실제로 거부되는지는 `chat-channel-input-rules.spec.ts`
    에도, `triggers.service.spec.ts` 의 `BLOCKED_FIELD_CASES`(전부 비어있지 않은 값만 사용,
    `triggers.service.spec.ts:3205-3215`)에도, e2e 에도 없다. `hasField` 의 `!== 'undefined'`
    판별을 falsy 판별(`!value`)로 바꾸는 뮤턴트가 있으면 `null`/`''` 케이스에서 가드가
    조용히 사라지는데, 그 사라짐을 잡을 테스트가 존재하지 않는다 — 정확히 이 PR 이 리팩터링한
    함수가 두-층 설계의 "실제로 거부한다" 절반을 미검증 상태로 남긴 것이다.
  - 제안: `chat-channel-input-rules.spec.ts` 에 `assertPatchCarriesNoSecrets(cfg({ botToken: null }))`
    /`inboundSigningPlaintext: null` 케이스를 하나씩 추가해 두-층 등가성의 "서비스가 실제로
    잡는다" 쪽을 직접 고정할 것. (DTO 쪽은 이미 `trigger-dto-validation.spec.ts:848-855` 가
    "통과한다" 쪽을 고정하고 있다.)

- **[INFO]** `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy 분기가 **이 함수의
  단위 테스트만으로는** 검증되지 않는다 — DTO 층 테스트에 의존
  - 위치: `chat-channel-input-rules.ts:222`의 `if (incoming.provider && incoming.provider !== current.provider)`
    — 신규 주석(라인 215-221)이 "HTTP 경로에서는 도달 불가, `dto/trigger-dto-validation.spec.ts`
    가 그 사실을 고정한다" 고 명시
  - 상세: `chat-channel-input-rules.spec.ts` 안의 `assertChatChannelAlreadySetUp` 관련 4개 테스트는
    전부 `cfg()`(기본값 `provider: 'telegram'`)를 쓰거나 `provider: 'slack'` 을 명시해서 부르며,
    `incoming.provider` 가 falsy 인 케이스(직접 호출자가 DTO 를 우회해 `provider` 를 안 실은 경우)
    를 이 파일 자체에서 부르는 테스트는 없다(`grep -n "assertChatChannelAlreadySetUp" *.spec.ts`
    로 확인 — 3곳 모두 `provider` 가 항상 truthy). 주석이 인용하는 `trigger-dto-validation.spec.ts:814-822`
    는 "HTTP 파이프가 이 경로 진입을 막는다" 만 증명하고, `assertChatChannelAlreadySetUp` 자신이
    provider 가 없을 때 **조용히 통과시킨다**(스킵)는 동작 자체는 이 파일 안에서 직접 단언되지
    않는다. 이 분기를 완전히 지우는 뮤턴트가 "정상적으로 생존"하는 것은 plan 이 사전에 선언한
    바이지만(설계상 도달 불가), 반대로 이 분기의 **동작**(falsy 면 무시)이 바뀌는 뮤턴트
    (예: `incoming.provider !== current.provider` 만 남기고 `&&` 를 빼서 `undefined !== 'slack'`
    이 true 가 되어 DTO 우회 호출자가 이제는 예외 없이 통과하던 자리에서 예외를 받게 되는 경우)
    는 이 파일의 테스트로 검출되지 않는다.
  - 제안: 필수는 아니나, `chat-channel-input-rules.spec.ts` 에 `assertChatChannelAlreadySetUp(existing,
    cfg({ provider: undefined }))` 형태의 직접 호출 케이스를 하나 추가하면 "도달 불가" 주장을
    이 파일 단독으로도 완결시킬 수 있다(현재는 근거가 다른 파일에 있어 두 파일을 함께 읽어야
    완결된다).

- **[INFO]** 신규 `ChatChannelRotateBotTokenDto` (swagger 응답 DTO) 에 런타임 shape 계약 테스트가
  없다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts` (신규
    파일 전체) · `triggers.controller.ts:280-292` (`@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)`
    + 반환 타입 선언)
  - 상세: 컨트롤러 주석 자체가 "반환 타입을 DTO 로 선언하는 이유는 서비스 반환 형태가 바뀌면
    `tsc` 가 잡게 하기 위함" 이라고 명시하는데, 이는 **컴파일 타임**에만 유효하다. 저장소에는
    이미 이런 목적의 런타임 보완 장치(`shared/testing/response-contract.ts` 의 `contractForDto`/
    `assertMatchesContract`, 4개 엔드포인트에 배선됨)가 있지만 `rotateBotToken` 엔드포인트는
    거기 배선돼 있지 않다(`grep -rn "contractForDto\|assertMatchesContract"
    codebase/backend/src/modules/triggers/` → 0건). `triggers.controller.spec.ts` 의 기존
    테스트(`정상 — TriggersService.rotateBotToken 위임 + rotatedAt 반환`)는 `result` 를
    mock 반환값과 구조적으로 `toEqual` 비교할 뿐, DTO 의 `@ApiProperty` 선언(`botId: number` /
    `chatChannelHealth` enum 등)과 실제 반환값이 **일치하는지는 검증하지 않는다** — jest 는
    타입을 지우므로 잘못된 shape 도 통과한다. 이는 이 PR 이 새로 만든 결함이 아니라 저장소
    전역의 기존 부분 배선 패턴(60개 중 4개)과 동일한 수준의 갭이라 CRITICAL/WARNING 으로
    올리지는 않지만, 이번에 신설되는 DTO 인 만큼 언급해 둔다.
  - 제안: 우선순위 낮음. 다음에 `response-contract` 배선을 확장하는 턴에서 같이 묶을 수 있다.

## 긍정적으로 확인한 부분

- `chat-channel-input-rules.spec.ts` 의 신규 `it.each` 두 블록은 **비-vacuous** 하다: (1) `update`
  모드 내부 필드 3종 테스트(`chat-channel-input-rules.spec.ts:120-130`)는 `assertChatChannelInputSafe`
  안에서 `mode==='update'` 조기 분기가 내부 필드 체크보다 앞으로 이동하는 순서 버그를 직접
  검출할 수 있다(직접 코드 추적으로 확인). (2) provider label 스왑 검출 테스트(`:195-211`)는
  `expect(res?.message).not.toContain(otherVendor)` 로 두 provider 의 메시지가 맞바뀌는 뮤테이션을
  잡는다 — 과거 리뷰(`review/code/2026/09/11/15_57_42`)가 지적한 실제 커버리지 미달을 정확히
  메운다.
- `as never` 캐스트 제거(주석이 `tsc --noEmit` 진단 197건 불변을 근거로 든다)는 실측 근거가
  코드에 남아 있어 "타입이 막아준다" 류의 미검증 주장이 아니다.
- `rejectBlockedField`/`hasField`/`throwInvalidField` 추출은 기존 11개 호출부의 봉투 형태
  (`code`/`message`/`details.field`/`details.code`)를 한 글자도 바꾸지 않았다 — 직접 대조로
  확인. 기존 `triggers.service.spec.ts`·`triggers.controller.spec.ts`·`chat-channel-input-rules.spec.ts`
  가 무편집으로 계속 통과할 근거가 있다(순수 이동/추출, 로직 변경 없음).
  `triggers.controller.ts` 의 반환 타입 변경(`Awaited<ReturnType<...>>` → `ChatChannelRotateBotTokenDto`)도
  런타임 무관 변경이라 기존 `triggers.controller.spec.ts` 의 `toEqual` 단언에 영향 없음.
- 순수 함수 설계(외부 협력자 0) 덕분에 테스트가 mock 없이 직접 호출만으로 구성돼 있다 —
  이 PR 자체가 "테스트 용이성" 관점의 모범 사례(서비스에 묶여 있던 로직을 협력자-zero 함수로
  추출해 mock 없는 단위 테스트를 가능케 함).
- 테스트 격리: 각 테스트가 `cfg()`/`thrown()` 헬퍼로 매번 새 객체를 만들고 공유 mutable 상태가
  없어 순서 의존성이 없다.

## 요약

이번 PR 의 테스트 보강분(`chat-channel-input-rules.spec.ts` 의 update-모드 내부 필드 순서 테스트,
provider label 스왑 검출 테스트, `trigger-dto-validation.spec.ts` 의 provider 필수 테스트)은 모두
과거 리뷰가 지적한 실제 커버리지 갭을 정확히 겨냥한 비-vacuous 테스트이며, 프로덕션 리팩터
(`throwInvalidField`/`hasField`/`rejectBlockedField` 추출)는 기존 테스트를 깨지 않는 순수 이동이다.
다만 이 리팩터가 정확히 건드린 `hasField` 의 핵심 설계 근거("`null`/`''` 는 서비스 층이 잡는다")는
서비스 층에서 실제로 거부되는지를 확인하는 테스트가 어디에도 없어 — DTO 층의 "통과시킨다" 절반만
고정돼 있고 "그 다음 거부된다" 절반은 문서 주장으로만 남아 있다(WARNING). 그 외 falsy-guard
직접 호출 테스트 부재와 신규 swagger DTO 의 런타임 계약 테스트 부재는 이 PR 의 범위 밖에 가까운
낮은 우선순위 개선 여지다.

## 위험도

LOW
