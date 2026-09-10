# 아키텍처(Architecture) 코드 리뷰

## 개요

리뷰 대상은 `ChatChannelUpdateConfigDto` 신설(D-1, `OmitType` 기반 PATCH 전용 DTO) · `TriggersService` 의
secret 쓰기 3축 게이팅(D-2, `storeUserSuppliedSecrets` / `preservedInboundSigningRef`) · 신규 검증
메서드(`assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`) · `assertChatChannelInputSafe` 의
mode-DTO 오버로드 결속이다. 이 PR 은 이미 3라운드의 코드 리뷰(`23_21_57`, `23_55_23`, `00_21_55`)를 거쳐
두 CRITICAL(R-CC-10 single-path 우회, `inboundSigningRef` fail-open)이 닫힌 상태이며, `dependency.md`
(NONE)·`maintainability.md`(LOW)가 이미 이 diff 를 검토했다. 본 리뷰는 그 결과와 겹치지 않는 SOLID·모듈
경계·레이어 책임 관점에 집중한다.

## 발견사항

- **[WARNING]** Chat-Channel 도메인 규칙이 계속 `TriggersService`(제네릭 트리거 CRUD 모듈) 안에 축적되고 있다 — 모듈 경계 흐림
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:60`(`type ChatChannelInput`), `:73`(`type ChatChannelInputMode`), `:636`~`:687`(`assertChatChannelInputSafe` 오버로드 3개), `:695`~`:713`(`assertPatchCarriesNoSecrets`), `:722`~`:747`(`assertChatChannelAlreadySetUp`), `:1075`~(`setupChatChannel`)
  - 상세: `TriggersService` 는 이제 1855줄이고, 이번 diff 가 그중 chat-channel 전용 타입 별칭 2개·검증 메서드 2개(신규)·오버로드 3개·`setupChatChannel` 옵션 파라미터 확장을 추가로 얹었다. "trigger" 는 webhook/schedule/chat_channel 세 타입을 아우르는 제네릭 리소스인데, 정작 이 서비스가 가장 많이 아는 도메인 지식은 세 타입 중 하나(chat_channel)의 세부 규칙(single-path bot token, PATCH secret 금지, provider 전환 금지, 3-쓰기 게이팅)이다. `chat-channel/` 아래에는 이미 `ChannelAdapterRegistry`·`ChannelListenerRegistry`·provider adapter 들이 별도 모듈로 분리돼 있는데, 그 경계 반대편의 "chat channel 설정 검증·병합·secret 게이팅" 책임은 여전히 `TriggersService` 사적 메서드로 남아 바운디드 컨텍스트가 정확히 모듈 경계와 일치하지 않는다. 이는 이 PR 이 만든 것이 아니라 기존 설계(이미 `setupChatChannel`·`assertInboundSigningPlaintextByProvider` 등이 이 파일에 있었다)의 연장이지만, 이번 diff 가 그 축적에 타입 2개 + 메서드 2개를 추가로 더했다.
  - 제안: 당장 이 PR 에서 분리를 요구할 사안은 아니다(그 리팩터는 이 PR 의 두 CRITICAL 수정 범위를 넘는다 — `maintainability.md` WARNING #6/RESOLUTION.md 수렴 예외와 같은 근거). 다만 그 항목이 가리키는 근본 원인이 "함수 길이" 뿐 아니라 "모듈 경계"이기도 하다는 점을 같은 백로그 항목(중앙 트래커)에 추가해 두는 것을 제안 — 다음에 3번째 secret-write 축이나 4번째 provider 가 추가될 때는 `ChatChannel*` 관련 타입·검증·병합 로직을 `chat-channel` 모듈 쪽의 협력 클래스(예: `ChatChannelConfigAssembler`)로 옮기는 안을 함께 검토할 근거가 된다.

- **[WARNING]** 같은 비즈니스 규칙의 에러 메시지 리터럴이 DTO 데코레이터·서비스 메서드 두 곳에 축약 없이 문자 그대로 중복된다 — SSOT 위반, 레이어 간 결합
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:390`~`:393`(`botToken` `@IsEmpty()` message), `:404`~`:407`(`inboundSigningPlaintext` `@IsEmpty()` message) ↔ `codebase/backend/src/modules/triggers/triggers.service.ts:697`~`:703`, `:705`~`:711`(`assertPatchCarriesNoSecrets` 의 동일 문자열)
  - 상세: `ChatChannelUpdateConfigDto.botToken` 의 `@IsEmpty()` 메시지("botToken 은 PATCH 로 바꿀 수 없어요. 토큰 변경은 POST /api/triggers/:id/chat-channel/rotate-bot-token 을 사용해 주세요.")와 `assertPatchCarriesNoSecrets` 가 던지는 `BadRequestException.message` 가 글자 하나까지 동일하다. `inboundSigningPlaintext` 짝도 마찬가지다. 두 갈래(빈 값 vs 비어있지 않은 값)가 서로 다른 레이어(`CustomValidationPipe` vs 서비스)에서 걸리는 것은 이미 `RESOLUTION.md`/`api_contract` 라인에서 실측·테스트·문서화된 **의도된 설계**이므로 그 자체는 재론하지 않는다. 다만 그 두 레이어가 사용자에게 노출하는 **문구**까지 공유 상수 없이 복붙돼 있어, 나중에 한쪽 문구만 수정(오탈자 수정·톤 변경 등)되면 같은 논리적 오류가 값의 형태에 따라 다른 문구를 반환하게 된다. 이 패턴은 사실 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 세 필드에서 이미 존재하던 pre-existing 컨벤션이고(`chat-channel-config.dto.ts:206`~`:209` ↔ `triggers.service.ts:651`~`:656` 등), 이번 PR 은 그 컨벤션을 두 필드에 **일관되게 확장**했을 뿐이라 새로 도입한 결함은 아니다 — 다만 중복 지점이 3곳에서 5곳으로 늘었다.
  - 제안: 이번 PR 을 막을 사안은 아니다(기존 컨벤션과의 일관성이 오히려 장점). 다음에 이 파일을 다시 손댈 때, DTO 와 서비스가 공유하는 실패 메시지 5종(`botTokenRef`/`inboundSigningRef`/`inboundSigning`/`botToken`/`inboundSigningPlaintext`)을 `chat-channel-config.dto.ts` 안의 `export const` 상수 맵으로 뽑아 두 레이어가 같은 리터럴을 import 해 쓰도록 하면, 두 레이어 중 하나만 고치는 회귀를 컴파일 타임에 원천 차단할 수 있다.

- **[INFO]** `setupChatChannel` 의 create/update 분기가 boolean flag(`storeUserSuppliedSecrets`) 하나로 함수 내부 여러 지점에 걸쳐 산개돼 있다 — OCP/전략 패턴 관점 보강
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1075`~`:1089`(파라미터 선언), `:1122`(`if (storeUserSuppliedSecrets)` — 쓰기①), `:1135`(`storeUserSuppliedSecrets ? ... : undefined` — 쓰기②), `:1190`(쓰기③은 의도적으로 이 플래그로 게이팅하지 않는다는 주석)
  - 상세: `maintainability.md` 가 이미 이 함수의 길이(186줄)와 관심사 6~8개를 WARNING(LOW 위험, 즉시 조치 불요)으로 지적했다. 아키텍처 관점에서 보완하면, 이 함수가 커진 근본 축 하나는 *"어느 진입점에서 왔는가"* 를 나타내는 boolean flag 가 함수 몸통 여러 곳에서 반복 검사된다는 점이다(Boolean Blindness 유사 패턴 — 플래그 이름 자체는 신중하게 지어져 의미가 분명하지만, 검사 지점이 여러 곳으로 흩어져 있다). "쓰기③은 이 플래그로 게이팅하지 **않는다**"는 코드 주석이 명시적으로 존재한다는 사실 자체가, 이 함수를 다시 읽는 사람이 "플래그가 통제하는 범위"를 매번 주석으로 재확인해야 함을 보여준다. 세 번째 secret-write 축이 추가되면(예: 향후 provider 가 하나 더 늘어 write 정책이 세분화되면) 이 boolean 은 3-state 이상으로 넓어져야 하고, 그 순간 이 함수의 분기는 다시 한 단계 복잡해진다.
  - 제안: 이번 PR 에서 즉시 리팩터를 요구하지 않는다(`maintainability.md` 판정과 동일). 다음에 손댈 기회가 생기면, "이번 호출에서 사용자 비밀을 쓸지"를 판단하는 앞쪽 절반을 순수 함수(`resolveSecretWritePolicy(mode): { writeBotToken, writeProviderIssuedSigning }` 류)로 뽑아, 이후 코드는 그 정책 객체의 필드만 읽도록 하면 "이 플래그가 어디까지 영향을 미치는가"를 함수 하나에서 한 번에 볼 수 있다. `maintainability.md` 제안(비밀 게이팅 절반을 헬퍼로 추출)과 방향이 같다.

- **[INFO]** `ChatChannelUpdateConfigDto` 가 상속(`OmitType`)을 쓰면서도 LSP 위반을 피하도록 설계됨 — 긍정적 관찰
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:378`~`:410`
  - 상세: `ChatChannelUpdateConfigDto extends OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])` 는 상속으로 Swagger 메타데이터를 재사용하지만, `botToken`/`inboundSigningPlaintext` 를 부모와 반대 의미(필수→금지)로 재선언한다. 구조적으로 이 두 타입은 서로 대입 불가능해 리스코프 치환이 성립하지 않는데, 코드는 이를 감추지 않고 `ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto` 유니언 + `mode` 파라미터 기반 오버로드(`triggers.service.ts:636`~`:643`)로 "이 값은 둘 중 하나이고, 어느 쪽인지는 호출부가 안다"는 것을 타입 레벨에 명시했다. 상속을 코드 재사용에만 쓰고, 다형적 치환이 필요한 자리에서는 명시적 유니언 + 컴파일타임 모드 결속으로 우회한 것은 이 필드 집합의 실제 의미론(생성과 수정의 요구가 정반대)을 정확히 반영한 설계다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** mode-DTO 오버로드 결속은 호출부가 문자열 리터럴을 쓸 때만 안전 — 이미 주석으로 인지된 한계
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:421`~`:430`, `:485`~`:513`(호출부, `'create'`/`'update'` 리터럴), `:632`~`:635`(오버로드 설계 의도 주석)
  - 상세: `assertChatChannelInputSafe(chatChannel, 'create')` / `(chatChannel, 'update')` 두 호출부가 리터럴 문자열을 직접 넘기기 때문에 TS 오버로드 해석이 올바른 DTO 타입과 짝을 강제한다. 이 안전장치는 향후 누군가 `mode` 를 변수(`ChatChannelInputMode` 타입)로 계산해 넘기려 하면 컴파일 에러가 나야 정상 동작하는데, 그 순간 우회하기 가장 쉬운 해법이 `as` 캐스팅이고, 그 캐스팅이 바로 이 함수가 막으려는 보안 결함 클래스를 조용히 되살릴 수 있다는 점을 주석(`:632`~`:635`)이 이미 정확히 지적하고 있다.
  - 제안: 조치 불요 — 코드 작성자가 이미 이 취약 지점을 인지하고 문서화했다. 다음에 이 함수를 다시 손댈 사람을 위해 남기는 관찰로 기록.

## 확인한 것 — 문제 없음

- 순환 의존 없음 — `chat-channel-config.dto.ts` 내부의 `OmitType` 파생(DTO→DTO)과 `triggers.service.ts` 의 유니언 타입 확장은 기존 의존 방향(서비스→DTO)을 유지한다. `dependency.md` 의 결론과 일치.
- `ChatChannelInput` 유니언을 관통하는 헬퍼(`assertChatChannelInputSafe`, `stripChatChannelPlaintext`, `mergeExternalConfig`, `setupChatChannel`)들은 실제로 두 DTO 가 공유하는 필드 집합에서만 동작해 인터페이스 분리 원칙을 크게 해치지 않는다.
- `setupChatChannel` 의 옵션 인자를 `{ storeUserSuppliedSecrets, preservedInboundSigningRef }` named object 로 받은 것은 boolean 여러 개를 위치 인자로 늘어놓는 안티패턴을 피한 좋은 선택이다.
- `SlackAdapter.setupChannel` JSDoc 갱신(`slack.adapter.ts:64`~`:67`)은 `secrets.rotate`(UPSERT)를 쓰는 이유를 "생성·활성화·PATCH 세 갈래에서 재호출되는 멱등 함수"라는 어댑터의 멱등성 계약에 정확히 근거시킨다 — 어댑터 인터페이스의 재호출 안전성을 문서화한 좋은 사례.

## 요약

이번 diff 는 PATCH 전용 DTO(`ChatChannelUpdateConfigDto`, `OmitType` 기반) 신설과 서비스 계층의 secret 쓰기
3축 게이팅으로 두 CRITICAL(R-CC-10 우회, `inboundSigningRef` fail-open)을 닫는다. 상속을 코드 재사용에만
쓰고 리스코프 치환이 필요한 지점은 명시적 유니언 + 컴파일타임 mode 오버로드로 우회한 설계는 이 필드
집합의 실제 의미론(생성/수정 요구가 정반대)을 정확히 반영해 SOLID 관점에서 견고하다. 순환 의존이나 새
안티패턴은 발견되지 않았다. 두 가지는 WARNING 으로 남긴다 — (1) chat-channel 도메인 규칙이 계속
`TriggersService`(제네릭 트리거 CRUD 모듈) 안에 축적되며 모듈 경계가 흐려지고 있고(이 PR 은 그 축적을
늘렸을 뿐 새로 만들지 않았다), (2) DTO 데코레이터와 서비스 메서드가 같은 실패 메시지 리터럴을 공유
상수 없이 복붙해, 두 레이어 중 하나만 수정되면 같은 논리적 오류가 값의 형태에 따라 다른 문구를
반환하는 드리프트 위험이 있다(기존 3필드 패턴을 5필드로 일관되게 확장한 것이라 이 PR 이 새로 만든
결함은 아니다). 둘 다 이 PR 을 막을 사유는 아니며, 이미 `maintainability.md`/`RESOLUTION.md` 가 합의한
백로그 항목(setupChatChannel 분리)과 근본 원인을 공유하므로 같은 트래커 항목에 관점만 추가하는 것을
제안한다.

## 위험도

LOW
