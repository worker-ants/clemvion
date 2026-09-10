# 보안(Security) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1/D-2/D-3)

## 발견사항

- **[CRITICAL]** `chatChannel` PATCH 편집이 Slack/Discord `inboundSigningRef` 를 config 에서 지워, 인바운드 웹훅 서명 검증이 **fail-open 으로 영구히 꺼진다** (인증 우회)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `private async setupChatChannel(...)`
    - 근본 원인: `1084-1086` (`providerIssuedPlaintext = storeUserSuppliedSecrets ? … : undefined` — 이번 diff 로 신설된 게이팅)
    - 증상이 드러나는 자리: `1104-1108` (`internalCfg` 의 `...(providerIssuedStored ? { inboundSigningRef } : {})`), `1132-1139` (`mergedChannel` 의 동일 조건), `1169-1173`(setupChannel 실패 catch 블록의 `fallbackConfig` 도 `internalCfg` 를 그대로 써 같은 결함을 재생산)
    - 호출부: `576-582` (`update()` 가 `storeUserSuppliedSecrets: false` 로 호출)
    - 소비부: `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts:64,93,129` (`if (!config.inboundSigningRef) return;` — ref 부재 시 서명 검증 자체를 **skip**), 무조건 호출 지점: `codebase/backend/src/modules/hooks/hooks.service.ts:291-296`(`handleChatChannelWebhook` 최상단, `trigger.isActive` 체크보다 먼저)
  - 상세: 이번 PR 의 D-2 는 `setupChatChannel` 에 `storeUserSuppliedSecrets` 플래그를 추가해 PATCH 에서 "사용자가 보낸" 두 비밀(bot token, provider-issued inbound signing)을 쓰지 않도록 게이팅했다. 그런데 `inboundSigningRef` 를 **재유도(re-derive)해서 계속 보존**하는 `botTokenRef` (`internalCfg`/`mergedChannel` 양쪽에서 무조건 포함)와 달리, `inboundSigningRef` 는 **이번 호출에서 실제로 값을 새로 썼을 때만**(`providerIssuedStored` 가 true 이거나 telegram 의 `result.issuedInboundSigning` 이 있을 때만) config 에 포함된다. Slack/Discord 는 PATCH 에서 `inboundSigningPlaintext` 를 아예 받지 않으므로(D-1) `providerIssuedStored` 는 **항상 false** 이고, 두 provider 의 실제 어댑터(`slack.adapter.ts:92`, `discord.adapter.ts:141-152`)가 반환하는 `configUpdates` 에도 `inboundSigningRef` 가 없다. 즉 `ChatChannelCard` 가 실제로 보내는 몸체(`{provider, uiMapping, rateLimitPerMinute, languageLocale}` — plan 문서 자신이 실측한 값)로 **정상적인 chatChannel 편집 PATCH 를 한 번만 성공시켜도**, 그 트리거의 `config.chatChannel` 에서 `inboundSigningRef` 가 통째로 사라진 채 `triggerRepository.update()` 로 영구 저장된다.
    이 상태에서 다음 Slack/Discord 인바운드 웹훅이 도착하면 `ChatChannelInboundAuthenticator.verify()` 가 `config.inboundSigningRef` 부재를 "legacy — 검증 skip" 케이스로 처리해 **서명 검증을 건너뛴다** — 즉 누구나 그 트리거의 `endpointPath` 만 알면 위조된 Slack/Discord 이벤트를 서명 없이 주입해 워크플로우 실행을 유발할 수 있다. `verify()` 는 `trigger.isActive` 체크보다 먼저, `chatChannelHealth` 와 무관하게 항상 호출되므로 이 우회는 트리거가 활성 상태인 한 그대로 유효하다.
    이 PR 이 정확히 방지하려던 것(“R-CC-21 이 경고한 실패가 보이는 형태에서 조용한 형태로 바뀐다”)과 같은 클래스의 결함을, telegram 축(server-issued signing)에서는 명시적으로 막아 두고도(코멘트·전용 회귀 테스트 존재) **Slack/Discord 의 기존 `inboundSigningRef` 보존은 어디에서도 다루지 않았다** — `botTokenRef` 는 `buildSecretRef(trigger.id)` 로 매번 재유도돼 무조건 살아남는데, `inboundSigningRef` 도 같은 방식(`buildSecretRef` 로 재유도된 로컬 변수)이 이미 있음에도 그 값을 config 에 반영하는 조건이 "이번 호출에서 새로 썼는가" 로 좁게 걸려 있는 것이 근본 원인이다.
    실측(외부 scratch, 저장소 밖 — `node` 로 동일 객체-스프레드 로직만 재현): `storeUserSuppliedSecrets:false`, slack adapter 의 실제 `configUpdates`(botIdentity 만) 를 넣고 `mergedChannel` 을 계산하면 결과 객체에 `inboundSigningRef` 키 자체가 존재하지 않음을 확인했다(`hasOwnProperty` → `false`). 저장소 파일은 건드리지 않았다(`git status --short` 로 재확인, 이 리뷰가 만든 변경 없음).
    테스트 갭도 이 결함을 놓친 이유를 설명한다 — 신설된 `triggers.service.spec.ts` 의 *"slack — 카드 편집 PATCH 가 두 비밀 중 어느 것도 쓰지 않는다"* 케이스는 `secrets.rotate` 가 호출되지 않았음만 단언하고, `triggerRepo.update` 에 실제로 저장되는 `config.chatChannel.inboundSigningRef` 값은 단언하지 않는다(반면 telegram 의 botTokenRef 생존은 별도 D-3 테스트가 명시적으로 단언한다). 이 비대칭이 회귀를 가렸다.
  - 제안: `botTokenRef` 와 동일한 패턴으로 처리한다 — `inboundSigningRef` 를 "이번 호출에서 새로 썼을 때만" 조건부로 넣지 말고, **기존 trigger.config.chatChannel.inboundSigningRef 가 있으면(또는 provider 가 provider-issued 축이면 재유도된 값으로) 항상 보존**하도록 바꾼다. 구체적으로 `internalCfg`/`mergedChannel` 조립 시 `providerIssuedStored || (기존 ref 존재)` 조건을 쓰거나, 아예 `botTokenRef` 처럼 무조건 포함시키되 "새 값을 쓴 게 아니라 참조만 유지" 임을 주석으로 남긴다. 카드 편집(PATCH, 비밀 미포함) 한 번으로 인증이 fail-open 되는 경로를 막는 회귀 테스트(“slack/discord PATCH 편집 후 config.chatChannel.inboundSigningRef 가 보존된다”)를 `botTokenRef` D-3 테스트와 대칭으로 추가한다. `setupChannel` 실패 catch 블록(`1169-1173`)도 같은 수정이 필요하다.

- **[WARNING]** PATCH 로 chatChannel 의 `provider` 를 다른 provider 로 바꿔도 막히지 않는다 (기존 이미 설정된 채널이면 통과)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `assertChatChannelAlreadySetUp` (약 `696-706`)
  - 상세: 이 가드는 `trigger.config.chatChannel?.provider` 가 **존재하는지만** 확인하고, PATCH 로 들어온 `chatChannel.provider` 가 **기존과 같은 provider 인지**는 비교하지 않는다. 예컨대 telegram 으로 설정된 트리거에 `chatChannel: {provider: 'slack', uiMapping: …}` 를 PATCH 로 보내면 이 가드는 통과하고, `setupChatChannel` 은 telegram 용으로 만들어진 `botTokenRef`(같은 트리거 id 로 재유도되는 동일 경로)를 그대로 Slack adapter 에 넘겨 `secrets.resolve` 로 잘못된 형식의 토큰을 읽게 된다. 이 자체는 위 CRITICAL 처럼 인증을 완전히 꺼뜨리지는 않지만(오히려 adapter 호출이 실패해 `degraded` 로 떨어질 개연성이 높다), 위 CRITICAL 과 결합하면 provider 전환 직후 `inboundSigningRef` 가 없는 상태로 "새 provider" 설정이 저장되어 같은 fail-open 결과에 더 빨리 도달하는 경로가 된다.
  - 제안: `assertChatChannelAlreadySetUp` 를 `assertChatChannelSameProvider` 로 넓혀 "PATCH 의 provider 가 기존 provider 와 다르면 400" 을 추가하거나(§5.4.1 이 provider 변경을 지원 대상으로 명시하지 않는 한), 최소한 이 케이스를 커버하는 테스트를 추가해 의도된 동작인지 명시한다.

- **[INFO]** `assertPatchCarriesNoSecrets`/`ChatChannelUpdateConfigDto.@IsEmpty()` 의 이중 방어는 견고함을 확인 — 별도 조치 불필요
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:372-404`, `codebase/backend/src/modules/triggers/triggers.service.ts:663-687`
  - 상세: `botToken`/`inboundSigningPlaintext` 를 PATCH body 에 `''`, `null`, 객체/배열 등 어떤 형태로 실어도 (a) DTO 의 `@IsEmpty()` 가 비어있지 않은 값·의미있는 값 대부분을 걸러내고, (b) 설령 DTO 를 우회해 서비스가 직접 호출돼도 `assertPatchCarriesNoSecrets` 가 `typeof x !== 'undefined'` 로 `null`/`''` 까지 포함해 재차 차단한다(서비스 직접 호출 경로 대비 이중 방어라는 설계 의도가 코드와 일치). `OmitType` 사용으로 부모의 `@IsString()` 필수 요구와 자식의 `@IsEmpty()` 가 충돌하지 않도록 한 설계도 타당하다. 신규 CRITICAL/WARNING 아님 — 확인 사항으로만 기록.

## 요약

이번 변경은 표면적으로 R-CC-10 single-path 우회(비교 없이 `secrets.rotate()` 로 bot token 을 덮어써 24h grace 백업·전용 audit·`chatChannelRotatedAt` 갱신을 건너뛰는 문제)를 제대로 닫았고, DTO(`ChatChannelUpdateConfigDto`)·서비스 이중 검증(`assertPatchCarriesNoSecrets`)·플레인텍스트 strip 경로 모두 견고하다. 그러나 그 수정 과정에서 **새로운, 더 심각한 인증 우회를 만들었다**: `setupChatChannel` 이 `botTokenRef` 는 매 호출 재유도해 무조건 보존하면서 `inboundSigningRef` 는 "이번 호출에서 새로 썼을 때만" 보존하도록 짜여 있어, Slack/Discord 트리거에 대해 비밀을 싣지 않는 정상적인 chatChannel 편집 PATCH(정확히 이 PR 이 가능하게 만들려던 그 요청)를 한 번만 성공시켜도 `inboundSigningRef` 가 config 에서 사라진다. `ChatChannelInboundAuthenticator` 는 `inboundSigningRef` 부재를 legacy fail-open 케이스로 취급해 서명 검증을 완전히 skip 하므로, 이 상태의 트리거는 이후 어떤 서명도 없이 위조된 웹훅을 받아들여 워크플로우를 실행하게 된다. 외부 scratch 에서의 로직 재현으로 이 결과를 확인했고 저장소는 건드리지 않았다. 이 결함은 신규 테스트가 `secrets.rotate` 호출 여부만 단언하고 최종 persisted config 의 `inboundSigningRef` 존재를 단언하지 않아 현재 테스트 스위트를 통과한다 — 병합 전에 반드시 닫아야 하는 CRITICAL 이다.

## 위험도

CRITICAL
