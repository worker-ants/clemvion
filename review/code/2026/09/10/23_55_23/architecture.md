# 아키텍처(Architecture) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3)

## 발견사항

- **[WARNING]** `mode: 'create' | 'update'` 문자열 판별자가 실제 DTO 타입과 컴파일 타임에 상관되지 않는다 (correlated-but-untyped flag argument)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:73`(`type ChatChannelInputMode`), `:632-635`(`assertChatChannelInputSafe(chatChannel: ChatChannelInput | undefined, mode: ChatChannelInputMode)`), 호출부 `:430`(`'create'`)·`:513`(`'update'`)
  - 상세: `assertChatChannelInputSafe` 는 `chatChannel: ChatChannelInput`(= `ChatChannelConfigDto | ChatChannelUpdateConfigDto` 유니온)와 별개 문자열 `mode` 를 받아 `mode === 'update'` 분기에서 `assertPatchCarriesNoSecrets` 로, 그 외에는 생성 전용 `assertInboundSigningPlaintextByProvider(chatChannel as ChatChannelConfigDto)` 로 강제 캐스팅해 위임한다(`:672-674`). 타입 시스템은 "`mode==='create'` 이면 `chatChannel` 이 실제로 `ChatChannelConfigDto` 다"라는 불변식을 전혀 검증하지 않는다 — 두 값은 순수 문자열 리터럴로만 짝지어져 있고, 이 짝짓기가 깨져도(예: 리팩터링 중 두 호출부 중 하나만 인자 순서·값을 바꾸는 실수) 컴파일러가 잡지 못하고 `as ChatChannelConfigDto` 캐스팅이 조용히 통과한다. 현재는 호출부가 2곳뿐이고 각각 `CreateTriggerDto.chatChannel`(`ChatChannelConfigDto`)·`UpdateTriggerDto.chatChannel`(`ChatChannelUpdateConfigDto`)에서 온 값을 정확히 대응하는 리터럴과 함께 넘기고 있어 **현재 동작은 올바르다.** 다만 이 함수가 지키는 것이 바로 이번 PR 이 닫은 보안 결함(R-CC-10/R-CC-21 우회)이라, mode·타입 불일치가 미래에 조용히 재발하면 같은 클래스의 결함이 검출 없이 되살아나는 지점이다.
  - 제안: 함수 오버로드로 상관관계를 타입에 새긴다 — `assertChatChannelInputSafe(chatChannel: ChatChannelConfigDto | undefined, mode: 'create'): void` / `assertChatChannelInputSafe(chatChannel: ChatChannelUpdateConfigDto | undefined, mode: 'update'): void` 두 시그니처를 선언하면 `as ChatChannelConfigDto` 캐스팅이 사라지고 컴파일러가 짝을 검증한다. 최소한으로는 이 상관관계를 함수 JSDoc 에 "호출부가 어긋나면 무엇이 깨지는지"로 명시.

- **[INFO]** `ChatChannelInput`/`ChatChannelInputMode` 유니온 타입이 DTO 모듈이 아니라 서비스 파일에 선언돼 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:60`(`type ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto;`), `:73`(`type ChatChannelInputMode`)
  - 상세: 이 두 타입은 `ChatChannelConfigDto`·`ChatChannelUpdateConfigDto` 두 DTO 클래스만을 조합한 순수 타입-레벨 개념이라, 논리적 소속은 그 두 클래스가 정의된 `dto/chat-channel-config.dto.ts` 다. 그런데 서비스 파일(`triggers.service.ts`)에 정의돼 있어, DTO 계층의 "두 write-model 이 하나의 합집합을 이룬다"는 사실을 알려면 서비스 파일을 봐야 한다 — 모듈 경계가 DTO 정의 위치와 어긋난다. 두 타입을 참조하는 4개 private 메서드(`assertChatChannelInputSafe`·`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·`stripChatChannelPlaintext`·`mergeExternalConfig`·`setupChatChannel`)가 모두 같은 서비스 안에 있어 지금 당장 응집도 문제로 드러나지는 않지만, 다른 모듈이 이 유니온을 재사용하려면(예: 별도 chat-channel 검증 유틸) import 대상이 "DTO 파일이 아니라 서비스 파일"이 되어 부자연스럽다.
  - 제안: `ChatChannelInput`(과 필요하면 `ChatChannelInputMode`)를 `chat-channel-config.dto.ts` 로 옮겨 두 DTO 클래스 옆에 export 하고, 서비스는 그것을 import.

- **[INFO]** 느슨한 JSONB `Trigger.config` 를 가리키는 인라인 구조적 캐스팅이 이 diff 로 두 곳 더 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:526-528`(`update()` 의 `previousInboundSigningRef`), `:714-715`(`assertChatChannelAlreadySetUp` 의 `current`)
  - 상세: 두 자리 모두 `trigger.config as { chatChannel?: { ... } }` 형태의 그 자리 한정 구조적 타입 단언으로 `chatChannel` 하위 필드 하나씩을 꺼낸다. 같은 파일에 이미 `teardownChatChannel`(`trigger.config as { chatChannel?: ChatChannelConfig }`)이 동일 패턴을 쓰고 있어, `Trigger.config` 안의 `chatChannel` 을 읽는 방식이 파일 전체에 최소 3가지 서로 다른 인라인 캐스팅 표현으로 흩어져 있다. `chatChannel` JSONB 형태가 나중에 바뀌면(필드 추가/이름 변경) 이 캐스팅 지점을 전부 찾아 손대야 하고, 하나라도 놓치면 타입은 통과하지만 런타임에 `undefined` 를 반환한다 — 지금 이 PR 이 고친 `inboundSigningRef` 유실 CRITICAL 도 정확히 이 계열(설정 필드가 조용히 사라지는 패턴)이었다.
  - 제안: `private readTriggerChatChannelConfig(trigger: Trigger): Partial<ChatChannelConfig> | undefined` 류의 단일 접근자를 두고 이 세 자리(및 향후 추가될 자리)가 그것을 공유하도록 정리하면, 형태 변경 시 손댈 자리가 하나로 준다. 이번 PR 범위를 막을 사안은 아님.

- **[INFO]** `ChatChannelUpdateConfigDto` 가 이 모듈에서 처음으로 `@nestjs/swagger` 의 `OmitType` 매핑 타입을 쓴다 — `UpdateTriggerDto` 자신은 여전히 손으로 다시 쓴 필드들이다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:372`(`export class ChatChannelUpdateConfigDto extends OmitType(...)`) vs `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:16`(`export class UpdateTriggerDto { ... }` — `CreateTriggerDto` 로부터 파생하지 않고 전 필드를 독립 선언)
  - 상세: 저장소 전체에서 `OmitType`/`PartialType`/`PickType` 매핑 타입 사용은 이 파일이 유일하다(`grep` 확인). `UpdateTriggerDto` 를 비롯해 이 모듈의 다른 Update 계열 DTO 는 전부 생성용 DTO 와 독립적으로 손으로 다시 선언하는 관례를 따른다. `OmitType` 채택 이유(부모 `@IsString()` 필수와 자식 `@IsEmpty()` 금지의 데코레이터 충돌 회피)는 JSDoc(`:357-360`)에 근거와 함께 잘 남아 있어 **이 자리의 선택 자체는 타당하다.** 다만 같은 모듈 안에 "손으로 다시 쓰는" 관례와 "매핑 타입으로 파생" 관례가 공존하게 돼, 다음 사람이 새 Update DTO 를 만들 때 어느 쪽이 관례인지 판단할 기준이 이 diff 만으로는 명확하지 않다.
  - 제안: 조치 불요 — 다만 이 판단(왜 이 자리만 매핑 타입인가)을 모듈 레벨 컨벤션 문서(`spec/conventions/` 또는 모듈 README)에 한 줄 남겨 두면, 다음 신규 DTO 작성자가 "매핑 타입 vs 손으로 재선언"을 매번 재판단하지 않아도 된다.

## 확인된 것 — 위반 없음 / 긍정적 설계

- **LSP 관점**: `ChatChannelUpdateConfigDto` 는 `botToken`(필수→금지)처럼 구조적으로 `ChatChannelConfigDto` 를 대체할 수 없는 타입인데, 상속 다형성으로 쓰지 않고 `ChatChannelInput = A | B` 명시적 합집합으로 두 형태를 다뤄 "가짜 is-a" 함정을 피했다. 두 형태가 필요한 자리(`assertChatChannelInputSafe`·`stripChatChannelPlaintext`·`mergeExternalConfig`·`setupChatChannel`)는 전부 유니온을 받고, 생성 전용 검증(`assertInboundSigningPlaintextByProvider`)은 좁은 타입 그대로 남겨 "PATCH 에서 부르면 안 된다"를 타입 시그니처가 말하게 했다.
- **관심사 분리**: write-model 을 오퍼레이션(POST/PATCH)별로 분리한 것(`ChatChannelConfigDto` vs `ChatChannelUpdateConfigDto`)은 하나의 DTO 에 조건부 검증을 욱여넣는 대신 각 오퍼레이션의 계약을 독립적으로 진화시킬 수 있게 한다 — 향후 세 번째 오퍼레이션(예: bulk import)이 생겨도 기존 두 DTO 를 건드리지 않고 세 번째를 추가하면 된다(OCP).
- **플래그 인자 개선**: `setupChatChannel` 의 신규 옵션이 `boolean` 하나가 아니라 `{ storeUserSuppliedSecrets, preservedInboundSigningRef }` 객체이고, 플래그 이름 자체가 "무엇을 게이팅하는가"(`writeSecrets` 아님)를 말하도록 지어졌다(JSDoc 에 그 이유 명시, `:1046-1058`). secret 쓰기 3곳 중 두 곳(사용자 입력)만 게이팅하고 세 번째(telegram server-issued)는 이 플래그와 무관하게 무조건 유지한 것은, 게이팅 축이 "provider 종류"가 아니라 "누가 발급한 비밀인가"라는 올바른 축을 잡은 설계다 — 기존 `ChannelAdapterRegistry` 어댑터 패턴에 이 로직을 억지로 끼워 넣지 않고 orchestration 레벨(서비스)에 남긴 것도 타당하다(어댑터별 관심사가 아니라 cross-provider 정책이므로).
- **테스트 경계 준수**: `triggers.service.spec.ts` 신규 테스트는 private 메서드에 직접 접근(`as any` 캐스팅 등)하지 않고 공개 `create`/`update` 를 통해서만 검증한다. `trigger-dto-validation.spec.ts` 는 컨트롤러/서비스를 거치지 않고 `CustomValidationPipe` 를 직접 통과시켜 DTO+파이프 계층의 경계에 정확히 스코프를 맞췄다.
- **순환 의존성 없음**: 신규 import(`ChatChannelUpdateConfigDto`)는 기존 `dto/chat-channel-config.dto.ts` → `triggers.service.ts` 단방향 의존을 그대로 유지하며 역방향 참조를 만들지 않는다.

## 요약

이번 diff 는 PATCH 전용 DTO(`ChatChannelUpdateConfigDto`)와 서비스 레이어의 3단 가드(`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·`setupChatChannel` 의 `storeUserSuppliedSecrets` 게이팅)로 R-CC-10/R-CC-21 우회 CRITICAL 을 닫는다. 유니온 타입으로 두 write-model 을 명시적으로 다뤄 LSP 함정을 피했고, "누가 발급한 비밀인가" 축으로 secret 쓰기 게이팅을 올바르게 나눈 점, 테스트가 캡슐화 경계를 지킨 점은 구조적으로 견고하다. 남은 것은 전부 INFO/경계성 WARNING 이다 — 가장 눈에 띄는 것은 `assertChatChannelInputSafe` 의 `mode` 문자열 판별자가 실제 DTO 타입과 컴파일 타임에 상관되지 않는 점(현재 두 호출부는 정확하지만, 이 함수가 지키는 것이 바로 이번에 닫은 보안 결함 클래스라 향후 어긋나면 같은 결함이 조용히 재발할 수 있는 자리)이다. 나머지(유니온 타입의 모듈 소속·JSONB 캐스팅 산재·DTO 파생 패턴 비일관)는 낮은 우선순위의 응집도 개선 여지이며 이번 PR 을 막을 사안은 아니다.

## 위험도

LOW
