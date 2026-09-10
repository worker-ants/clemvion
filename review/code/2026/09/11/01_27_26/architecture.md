# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `TriggersService` 가 여러 바운디드 컨텍스트(트리거 CRUD·notification·schedule 동기화·audit·chat-channel secret 라이프사이클)를 한 클래스에 계속 누적시키고 있다 — 이번 PR 로 1642줄 → 1855줄(+213)까지 커졌다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:259` (`class TriggersService`), `codebase/backend/src/modules/triggers/triggers.service.ts:485` (`async update(...)`, ~120줄 단일 메서드)
  - 상세: 이번 PR 이 추가한 `assertChatChannelInputSafe`(오버로드 3개) · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` 과, `update()`/`create()`/`setupChatChannel()` 에 인라인된 chat-channel 전용 검증·ref 보존 로직이 전부 `TriggersService` 안에 있다. `update()` 한 메서드가 (1) schedule-type 필드 화이트리스트, (2) notification URL 검증, (3) chat-channel 입력 안전성 검증 + "이미 설정됐는가" 검증, (4) `inboundSigningRef` 사전 보존, (5) authConfig 검증, (6) config 병합·저장, (7) audit 기록, (8) schedule 역동기화, (9) notification secret 정규화, (10) chat-channel setup + 재조회를 순차 오케스트레이션한다. 단일 책임 원칙(SRP) 관점에서 이 클래스/메서드는 이미 임계치를 넘었고, 실제로 이 정확한 영역(chat-channel 비밀 쓰기)에서 이번 PR 이전에 두 개의 CRITICAL 결함(R-CC-10 single-path 우회, inboundSigningRef fail-open)이 발견된 것도 관련 로직이 범용 CRUD 오케스트레이션 메서드 안에 섞여 있어 "이 필드가 실리면 무슨 부수효과가 함께 일어나는가"를 한눈에 보기 어려웠던 사정과 무관하지 않다.
  - 제안: chat-channel 관련 검증·secret 쓰기·ref 보존 로직(`assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`stripChatChannelPlaintext`/`setupChatChannel`/`teardownChatChannel`)을 `chat-channel` 모듈 쪽의 별도 협력자(예: `ChatChannelTriggerBinder` 같은 도메인 서비스)로 추출하고 `TriggersService.create/update` 는 그 협력자를 좁은 인터페이스로 호출하는 형태로 옮기는 리팩터를 다음 스코프에서 고려할 것. 지금 당장 이 PR 을 막을 정도는 아니지만(기존 패턴을 그대로 따른 증분 변경), 같은 클래스가 계속 커지면 다음 보안 결함도 같은 방식(넓은 메서드 속에 숨은 분기)으로 재발할 위험이 있다.

- **[INFO]** `setupChatChannel` 의 동작 분기가 `storeUserSuppliedSecrets: boolean` 옵션 플래그로 표현되어 있다 — 현재는 create/update 두 상태만 있어 문제가 없지만, 개방-폐쇄 원칙(OCP) 관점에서 새로운 호출 컨텍스트(예: admin override, 관리자 강제 rotate 등)가 추가되면 이 불리언이 계속 늘어나는(boolean-trap) 방향으로 확장될 소지가 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1075` (`private async setupChatChannel(trigger, chatChannelCfg, { storeUserSuppliedSecrets, preservedInboundSigningRef })`), 호출부 `:472`(create, `true`) / `:588`(update, `false`)
  - 상세: 이름을 `writeSecrets` 가 아니라 `storeUserSuppliedSecrets` 로 지어 의도를 명확히 한 점, 옵션을 이름 있는 object literal 로 호출부에서 읽히게 한 점은 boolean-trap 의 가장 흔한 문제(호출부에서 `true`/`false` 만 덜렁 보이는 것)를 이미 완화하고 있어 지금 형태 자체는 합리적이다. 다만 그 아래 함수 본문의 `if (storeUserSuppliedSecrets) {...}` 분기와, 세 번째 쓰기(server-issued signing)는 이 플래그와 **무관하게** 항상 실행된다는 비대칭(문서화된 "쓰기 3개 중 2개만 막는다" 표)이 한 함수 안에 조건문으로 얽혀 있어, 향후 축이 하나 더 늘면 (예: 조건이 2개인 3-way 매트릭스) 가독성이 급격히 떨어질 수 있다.
  - 제안: 지금 당장 변경할 필요는 없음(2-state 로 유지되는 한 과설계 위험이 더 크다). 세 번째 상태가 추가되는 시점에 정책 객체(예: `{ botToken: 'skip'|'write', inboundSigningPlaintext: 'skip'|'write', serverIssuedSigning: 'always-write' }`)로 승격을 검토할 것.

- **[INFO]** DTO 상속 관계(`ChatChannelUpdateConfigDto extends OmitType(ChatChannelConfigDto, [...])`)가 `botToken`/`inboundSigningPlaintext` 두 필드의 계약을 "필수"에서 "금지"로 **반전**시킨다 — 명목상 서브타입이지만 행위적으로는 상위 타입과 치환 불가능하다(LSP 관점의 잠재적 함정).
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:378` (`export class ChatChannelUpdateConfigDto extends OmitType(...)`)
  - 상세: 실제 위험은 낮다 — 코드 전체가 `instanceof ChatChannelConfigDto` 로 다형적으로 다루지 않고, `TriggersService` 쪽에서 `ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto` 판별 유니온 + 오버로드로 명시적으로 갈라 처리한다(`triggers.service.ts:636-687`). 이 설계 자체가 "부모-자식 다형성으로 두 DTO 를 섞어 쓰지 않겠다"는 의도적 선택이고, 그 이유(부모 상속만으로는 `@IsString()`/`@IsEmpty()` 충돌)도 클래스 상단 주석에 명시돼 있다. 다만 앞으로 누군가 `ChatChannelUpdateConfigDto` 인스턴스를 `ChatChannelConfigDto` 타입 자리에 구조적으로 대입하는 코드를 추가하면(TS 구조적 타이핑 특성상 컴파일러가 막아주지 않을 수 있음 — `botToken?: string` 은 `botToken: string` 이 필요한 자리에 대입 시 타입 에러가 나지만, optional 초과 필드가 없는 다른 형태로는 오탐지 없이 통과할 조합이 생길 수 있다) 계약이 조용히 깨질 수 있다.
  - 제안: 문서화 수준으로 이미 충분히 방어되어 있음. 신규 코드 리뷰 시 "두 DTO 를 하나의 변수에 담아 provider별 분기 없이 그대로 넘기는" 패턴이 등장하면 재검토할 것.

- **[INFO]** `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp` 내부에서 `chatChannel as unknown as Record<string, unknown>` / `trigger.config as { chatChannel?: {...} }` 형태의 이중 캐스팅이 반복된다 — 오버로드로 얻은 컴파일타임 안전성을 함수 본문에서 다시 풀어버리는 형태다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:649`(`assertChatChannelInputSafe` 내부 `blocked`), `:696`(`assertPatchCarriesNoSecrets` 내부 `carried`), `:526-528`·`:723-724`(`trigger.config as {...}`)
  - 상세: `OmitType` 으로 타입에서 제거된 필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`/`botToken`/`inboundSigningPlaintext`)의 "존재 여부"를 런타임에 확인하려면 어차피 타입을 벗어나야 하므로 이 캐스팅 자체는 불가피한 면이 있다. 다만 이런 이스케이프 해치가 세 곳에 개별적으로 반복되고 있어, 하나라도 철자를 틀리거나(`botTokenRef` vs `botToken_ref` 등) 필드명이 리팩터로 바뀌었을 때 컴파일러가 잡아주지 못하는 지점이 늘어난다. `trigger.config` 를 향한 임시 인라인 타입 단언도 같은 패턴이 이미 이 서비스 전반(예: `sanitizeForResponse`, `mergeExternalConfig` 주변)에 퍼져 있는 기존 관행의 연장이다.
  - 제안: 급하지 않음. 후속 정리 시 `readOptionalField<T>(obj: unknown, key: string): T | undefined` 같은 단일 헬퍼로 이 이스케이프 해치를 모아 "타입을 벗어나는 자리"를 한 곳으로 좁히는 것을 고려.

- **[INFO]** `chat-channel` 모듈과 `triggers` 모듈 사이에 양방향 참조가 존재한다 — 이번 PR 이 만든 것은 아니고 사전부터 있던 구조다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:5`, `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:9` (둘 다 `import { Trigger } from '../triggers/entities/trigger.entity'`) ↔ `codebase/backend/src/modules/triggers/triggers.service.ts` (`ChannelAdapterRegistry`/`ChannelListenerRegistry` 를 `../chat-channel/...` 에서 import)
  - 상세: TypeScript 모듈 레벨에서 순환 import 는 아니다(엔티티 파일과 서비스 파일이 서로 다른 대상을 가리켜 실제 순환 그래프는 아님을 확인) — 다만 두 도메인 모듈이 서로의 내부(엔티티/레지스트리)를 직접 참조하는 경계 흐림은 존재한다. 이번 PR 은 이 경계를 넓히지도 좁히지도 않았으므로 이번 변경의 결함은 아니다.
  - 제안: 이번 PR 범위 밖. 별도 트래킹 항목으로만 남길 것(이미 알려진 구조).

## 요약

이번 PR 은 이미 3+ 라운드의 리뷰를 거쳐 CRITICAL 급 보안 결함(단일 DTO 공유로 인한 R-CC-10 우회, PATCH 필드 차단만으로 인한 시크릿 파괴, inboundSigningRef 소실에 의한 인증 fail-open)을 닫은 상태다. 그 해법 자체 — `OmitType` 기반 PATCH 전용 DTO, `mode`/DTO 타입을 컴파일타임에 묶는 오버로드, 이름 있는 옵션 객체로 표현한 `storeUserSuppliedSecrets` 게이팅, 호출 전 `inboundSigningRef` 명시적 보존 — 는 계층 분리(DTO=형식 검증, Service=비즈니스 규칙)와 방어적 타이핑을 잘 지킨 신중한 설계이며 새로운 순환 의존성이나 안티패턴을 도입하지 않았다. 남은 아키텍처 부채는 새로 만든 것이 아니라 기존 패턴을 그대로 밟아 더 키운 것 — `TriggersService` 가 여러 도메인 관심사를 계속 흡수하는 God Object/God Method 경향이 이번에도 이어져 `update()` 한 메서드가 열 가지 이상의 책임을 순차 오케스트레이션한다는 점이 가장 눈에 띈다. 이 영역이 반복적으로 보안 결함의 발생지였다는 점을 고려하면, 다음 변경 전에 chat-channel 전용 로직을 별도 협력자로 뽑아내는 리팩터를 백로그에 올릴 가치가 있다. 이번 PR 자체를 막을 CRITICAL 아키텍처 결함은 없다.

## 위험도

LOW
