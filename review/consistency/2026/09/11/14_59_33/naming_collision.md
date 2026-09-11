# 신규 식별자 충돌 검토 — `plan/in-progress/impl-chat-channel-binder.md`

> 검토 대상 실체: `spec/5-system/` bundle 자체는 이번 target 이 아니다. 번들 말미에 포함된
> `plan/in-progress/impl-chat-channel-binder.md` (chat-channel 도메인 규칙을 `TriggersService`
> 에서 `chat-channel-input-rules.ts`(T1, 순수 함수) + `ChatChannelBinderService`(T2, Nest
> provider, `triggers/` 안) 로 추출하는 순수 리팩터, `spec_impact: none`)가 실제 target 이다.
> 신규 API·엔티티·이벤트·ENV 는 도입되지 않으므로 관점 1/3/4/5(요구사항 ID·endpoint·이벤트명·
> 환경변수)는 해당 사항 없음(NONE). 발견은 관점 2(엔티티/타입명)·6(파일 경로) 에 집중된다.

## 발견사항

- **[WARNING]** `ChatChannelBinderService` 도입이 기존 spec 이 못박은 `setupChatChannel` 의
  클래스 귀속(`TriggersService`)과 어긋난다
  - target 신규 식별자: `ChatChannelBinderService`(신설 Nest provider, `triggers/` 안) —
    `setupChatChannel` / `teardownChatChannel` 을 `TriggersService` 로부터 흡수
  - 기존 사용처:
    - `spec/conventions/chat-channel-adapter.md:369` — `"caller (`TriggersService.setupChatChannel`) 가 즉시 SecretResolver.rotate(...)"`
    - `spec/data-flow/14-chat-channel.md:29` — 코드 진입점 목록: `` `triggers.service.ts` — `setupChatChannel` / `rotateBotToken` / `cleanupRotatedChatChannelTokens` ``
  - 상세: 두 SoT 문서가 `setupChatChannel` 을 **`TriggersService`(정확히는 `triggers.service.ts`
    파일) 소속 메서드**로 못박아 인용한다. plan 의 T2 대로 이동하면 이 메서드는
    `ChatChannelBinderService`(다른 파일)로 옮겨가는데, plan 은 `spec_impact: none` 이라 이
    두 인용은 갱신 대상이 아니다. 결과적으로 "문서가 말하는 소속"과 "코드의 실제 소속"이
    갈라진 상태로 남아, 이 문서를 따라 코드를 찾는 사람이 `TriggersService.setupChatChannel`
    을 못 찾고 헤매게 된다. 같은 문서(`14-chat-channel.md:27`)가 과거 `chat-channel-token-
    rotator.service.ts` 이전(C-2) 때는 "cleanup 로직 `TriggersService` 와 co-location" 이라고
    이동 사실을 **그 자리에서 즉시 반영**한 전례가 있어, 이번에도 동일 수준의 갱신이 기대되는
    지점이다.
  - 제안: T2 커밋에서 위 두 인용을 `ChatChannelBinderService.setupChatChannel` 로 정정한다.
    (`spec_impact: none` 을 유지하려면, 이 정도의 "소속 클래스명" 서술은 spec 계약이 아니라는
    판단 근거를 plan 에 명시할 것 — CLAUDE.md 자기-반증형 소정정 조항의 "예고·트리거" 요건에도
    해당하지 않아 이 정정은 `project-planner` 턴 없이 developer 가 직접 고칠 수 있는 성격에
    가깝다: 제품 정의·API 계약이 아니라 순수 파일/클래스 소속 서술이기 때문.)

- **[WARNING]** `assertInboundSigningPlaintextByProvider` 가 클래스 메서드에서 module-level
  함수로 바뀌며 provider spec 2곳의 `TriggersService.` 귀속이 구조적으로 성립 불가해진다
  - target 신규 식별자: T1 순수 함수 모듈 `chat-channel-input-rules.ts` 로 이동하는
    `assertInboundSigningPlaintextByProvider` (클래스 메서드 → `export function`, DI 없음)
  - 기존 사용처:
    - `spec/4-nodes/7-trigger/providers/discord.md:297` — `"Backend 의 `TriggersService.assertInboundSigningPlaintextByProvider` 가 trigger 생성 시점에 정규식 검증"`
    - `spec/4-nodes/7-trigger/providers/slack.md:275` — 동일 문면 (Slack 버전)
  - 상세: 위 두 provider spec 은 이 검증을 **`TriggersService` 의 메서드**로 명시한다. plan 의
    T1 설계는 "Nest provider 로 만들 이유가 없다. `export function` 로 빼고 `TriggersService`
    가 import 해 호출한다" — 즉 이 함수는 **어떤 클래스에도 속하지 않는 module-level 함수**가
    된다. `TriggersService.assertInboundSigningPlaintextByProvider` 라는 표현 자체가 이동 후엔
    문법적으로도 성립하지 않으므로(클래스 소속이 아예 사라짐), 두 provider 문서가 즉시 stale
    해진다. `TriggersService` 가 여전히 이 함수를 **호출**은 하므로 동작 서술("trigger 생성
    시점에 정규식 검증")은 참이지만, 호출자와 정의처를 구분하지 않는 현재 문면은 오독을 유발한다.
  - 제안: 이동 시 두 provider spec 의 표현을 `chat-channel-input-rules.assertInboundSigningPlaintextByProvider`
    (또는 "`TriggersService` 가 `chat-channel-input-rules` 의 `assertInboundSigningPlaintextByProvider`
    를 호출" 처럼 호출자/정의처를 분리한 문장)로 정정. plan 체크리스트에 "인접 provider spec
    귀속 표기 갱신"을 한 줄 추가하는 것을 권한다.

- **[INFO]** 신규 파일이 `spec/5-system/15-chat-channel.md` §7 "구현 파일 구조" 다이어그램에
  반영되지 않음 + 기존 공유 패키지 `chat-channel-validation` 과 이름이 인접
  - target 신규 식별자: `chat-channel-input-rules.ts`(T1, `triggers/` 신설), T2 의 파일명은
    plan 에 명시되지 않았으나 이 저장소의 명명 관례(`chat-channel-token-rotator.service.ts` ↔
    `ChatChannelTokenRotatorService`, `notification-secret-rotator.service.ts` ↔
    `NotificationSecretRotatorService`)를 따르면 `chat-channel-binder.service.ts` 로 추정된다
  - 기존 사용처:
    - `spec/5-system/15-chat-channel.md:508-533` §7 구현 파일 구조 — `triggers/` 하위 파일
      목록에 `chat-channel-token-rotator.service.ts` 는 `"C-2: chat-channel 에서 이전"` 주석과
      함께 등재돼 있으나, 신설되는 두 파일은 목록에 없음
    - `codebase/packages/chat-channel-validation/src/index.ts` — 이미 존재하는 공유 패키지.
      provider 입력(Slack/Discord signing) 의 **정규식** 을 단일 진실로 export
  - 상세: 이 저장소는 `triggers/` 에 chat-channel 관련 파일이 새로 생길 때마다(예:
    `chat-channel-token-rotator.service.ts`) §7 다이어그램에 이유 주석과 함께 등재해 온 전례가
    있다. `spec_impact: none` 인 이번 plan 은 이 다이어그램을 갱신할 계획이 없어, 구현 후
    실제 파일 구조와 SoT 다이어그램이 어긋난다(파일 경로 컨벤션 자체를 깨는 것은 아니고,
    "완전성"의 문제). 이름 자체는 직접 충돌하지 않지만 `chat-channel-input-rules`(신규,
    backend 내부 assert/throw 오케스트레이션)와 `chat-channel-validation`(기존, 공유 정규식)
    이 "chat-channel 입력 검증"이라는 같은 문제 공간을 가리켜 향후 리더가 두 모듈의 역할
    경계를 헷갈릴 여지가 있다.
  - 제안: §7 다이어그램에 두 신규 파일을 추가하거나(다른 이전 사례와 동일 처리), plan 에
    "이 다이어그램은 개별 helper 파일까지는 추적하지 않는다"는 명시적 스코프 결정을 남긴다.
    `chat-channel-input-rules.ts` 상단 docstring 에 `@workflow/chat-channel-validation` 과의
    역할 차이(순수 정규식 vs 도메인 assert/throw)를 한 줄 남기면 혼동을 예방할 수 있다.

## 비대상 확인 (충돌 없음)

- `ChatChannelBinderService` 문자열은 저장소 전체에서 plan 문서 자신 외 등장하지 않음 —
  기존 클래스명과 충돌 없음. `Binder` 라는 단어 자체도 backend 소스에 선례 없음.
- `chat-channel-input-rules.ts` 파일 경로는 저장소에 존재하지 않음 — 경로 충돌 없음.
- T1 대상 함수명(`assertChatChannelInputSafe` · `assertPatchCarriesNoSecrets` ·
  `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` · `translateSetupChannelError`)
  과 T2 대상 함수명(`setupChatChannel` 자체 · `teardownChatChannel`)은 `TriggersService.X`
  형태로 spec 에 qualified 인용된 자리가 (`setupChatChannel` 을 제외하면) 없음 — 이동해도
  다른 spec 문서의 귀속 서술을 깨지 않는다.
- 새 API endpoint·요구사항 ID·webhook/큐 이벤트명·ENV 변수는 도입되지 않는다(순수 내부
  구조 리팩터, `channelAdapterRegistry`/`channelListenerRegistry`/`secrets`/`triggerRepository`
  등 기존 협력자 재사용). 관점 1·3·4·5 는 해당 사항 없음.
- 코드 주석 수준에서도 `chat-channel-rejection-messages.const.ts:8` 의 `` `TriggersService`
  가드 `` 표현이 이동 후 stale 해지지만, 이는 spec 이 아닌 코드 내부 주석이라 통상적인 리팩터
  작업 중 자연히 갱신될 항목으로 판단해 별도 항목화하지 않았다.

## 요약

이번 target(`plan/in-progress/impl-chat-channel-binder.md`)이 신설하는 두 식별자
(`ChatChannelBinderService`, `chat-channel-input-rules.ts`) 자체는 기존 코드베이스·spec
어디와도 이름이 겹치지 않아 정면 충돌은 없다. 다만 `setupChatChannel` /
`assertInboundSigningPlaintextByProvider` 를 `TriggersService` 밖으로 옮기는 과정에서, 그
정확한 소속을 `TriggersService.X` 형태로 못박아 온 기존 SoT 문서 3곳(`spec/conventions/
chat-channel-adapter.md`, `spec/data-flow/14-chat-channel.md`, `spec/4-nodes/7-trigger/
providers/{discord,slack}.md`)의 서술이 구현과 동시에 사실과 어긋나게 된다 — 이 저장소가
과거 유사 이동(`chat-channel-token-rotator.service.ts`)때 즉시 갱신했던 전례에 비추면
`spec_impact: none` 판단을 유지할지 재검토할 가치가 있다. §7 구현 파일 구조 다이어그램의
완전성 갭은 부수적 INFO 수준이다.

## 위험도

LOW–MEDIUM (기능적 모호성은 없으나, 구현 시 3개 SoT 문서의 qualified 식별자 서술이 즉시
stale 해지므로 같은 PR 안에서 정정하는 것을 권한다)
