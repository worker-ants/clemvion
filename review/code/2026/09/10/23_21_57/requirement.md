# 요구사항(Requirement) 리뷰 — chatChannel PATCH 비밀 차단 (D-1/D-2/D-3)

## 발견사항

- **[CRITICAL]** `chatChannel` 이 실린 PATCH 가 slack/discord 의 `inboundSigningRef` 를 **매번 config 에서 지운다** — 인입 웹훅 서명 검증이 조용히 무력화된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1107`(`internalCfg` 구성 — `...(providerIssuedStored ? { inboundSigningRef } : {})`), `:1136-1138`(`mergedChannel` 구성 — `...(result.issuedInboundSigning || providerIssuedStored ? { inboundSigningRef } : {})`), 실패 경로 `:1169-1171`(`fallbackConfig.chatChannel = internalCfg`)
  - 상세: D-2 는 PATCH 에서 `storeUserSuppliedSecrets: false` 를 넘겨 slack/discord 의 `inboundSigningPlaintext` rotate 를 건너뛴다(의도된 동작, R-CC-21/§5.4.1.1 과 정합). 문제는 **rotate 를 건너뛴 것과 별개로, `inboundSigningRef` 자체가 병합된 config 에서 완전히 사라진다는 것**이다. `internalCfg`/`mergedChannel` 모두 `inboundSigningRef` 를 "이번 호출에서 실제로 값을 썼는가"(`providerIssuedStored` 또는 `result.issuedInboundSigning`)로만 포함시키는데, PATCH 에서는 그 조건이 slack/discord 에 한해 **항상 거짓**이 되도록 이번 PR 이 방금 바꿨다(D-1 이 `inboundSigningPlaintext` 를 막고 D-2 가 저장을 건너뛰므로). 반면 `botTokenRef` 는 같은 함수에서 이번 호출 여부와 무관하게 **무조건** `internalCfg`/`mergedChannel` 에 재기입된다(D-3 가 명시한 "재유도로 살아남는다" 설계) — `inboundSigningRef` 만 이 설계에서 빠졌다.
    실제로 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `mergeExternalConfig`(`:1008` `next.chatChannel = chatChannel`)와 `setupChatChannel` 의 `newConfig`(`:1140-1143` `chatChannel: mergedChannel`)는 **`chatChannel` 서브객체를 부분 병합이 아니라 통째로 교체**하므로, 이전 DB 값에 남아 있던 `inboundSigningRef` 는 새 값에 안 실리면 그대로 유실된다.
    소비 측 회귀: `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts:64,93,129` 는 `config.inboundSigningRef` 가 없으면 서명 검증을 **명시적으로 skip**한다(주석: *"legacy / setupChannel 전 trigger"* 를 위한 fallback인데, 이번 PR 이후로는 **정상 운영 중인 트리거가 매 편집 PATCH 마다 이 legacy 상태로 강등**된다). 즉 사용자가 `ChatChannelCard` 로 uiMapping/rateLimit 등 아무 필드나 한 번만 저장해도, 그 이후 그 슬랙/디스코드 트리거의 인입 웹훅은 서명 검증 없이 통과한다 — 이 PR 이 고치려는 바로 그 사용 시나리오(카드 편집 저장)에서 매번 재현된다.
  - **실측** (뮤테이션 규약 준수 — 원본을 scratch 에 백업 후 `triggers.service.spec.ts` 의 기존 "slack — 카드 편집 PATCH 가 두 비밀 중 어느 것도 쓰지 않는다" 테스트에 `triggerRepo.update` 호출 인자를 로깅하는 임시 `console.log` 한 줄만 추가해 실행, 종료 즉시 `cp` 로 원복 — `git status --short` 로 원복 확인 완료):
    ```
    PROBE chatChannel configs written: [{"provider":"slack","uiMapping":{...},"rateLimitPerMinute":30,
      "languageLocale":"ko","botTokenRef":"secret://triggers/trig-p/bot-token","botIdentity":{...}}]
    ```
    fixture `existing('slack')` 는 `inboundSigningRef: SIGNING_REF`(`secret://triggers/trig-p/inbound-signing`)를 갖고 시작했는데, PATCH 이후 DB 에 쓰이는 `chatChannel` 에는 `botTokenRef` 는 살아 있고 **`inboundSigningRef` 는 완전히 빠져 있다.** 가설이 실측으로 확인됐다.
  - plan 자신의 D-3 설계 의도와도 어긋난다 — `plan/in-progress/impl-chat-channel-patch-token.md` "## 설계" 절: *"D-3 — `botTokenRef`/`inboundSigningRef` 는 config 보존이 아니라 `buildSecretRef(trigger.id)` 재유도로 살아남는다. **이미 그렇게 구현돼 있으므로** 회귀 테스트로 고정한다."* — `inboundSigningRef` 도 재유도로 살아남는다고 전제했지만 실제 구현은 `botTokenRef` 에만 그 설계를 적용했다. 이어서 추가된 회귀 테스트(`triggers.service.spec.ts` "config 를 통째로 교체해도 botTokenRef 가 재유도돼 살아남는다")도 **`botTokenRef` 만** 단언해 이 갭을 못 잡았다.
  - 제안: `inboundSigningRef` 도 `botTokenRef` 와 동일하게 — slack/discord 는 `assertChatChannelAlreadySetUp` 통과 시점에 이미 생성 시 필수로 저장돼 있으므로 — `internalCfg`/`mergedChannel`(및 실패 시 `fallbackConfig`) 구성에서 **무조건 포함**시키거나, 최소한 `storeUserSuppliedSecrets === false` 이고 provider 가 slack/discord 인 경우 기존 `trigger.config.chatChannel.inboundSigningRef` 를 그대로 이어받도록 명시적으로 보존한다. 수정 후 위와 같은 "config 를 통째로 교체해도 **inboundSigningRef** 가 살아남는다" 회귀 테스트를 D-3 테스트 옆에 반드시 추가한다(현재는 `botTokenRef` 전용이라 이 클래스의 결함을 구조적으로 못 잡는다).

## 그 외 확인 — 문제 없음 (참고용)

- **DTO 설계(D-1)**: `ChatChannelUpdateConfigDto`(`chat-channel-config.dto.ts:372-404`)가 `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])` + `@IsEmpty()` 재선언으로 두 필드를 PATCH 에서 차단한다. `trigger-dto-validation.spec.ts`(74개 전부 GREEN, 직접 실행 확인) 의 `[실측]` 케이스가 `details.field` 가 5필드 전부 `chatChannel.<field>` 중첩 경로임을 실측하고, 이는 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 의 "미확정 — 후속 e2e 확인 대기" placeholder 를 채우는 근거로 정확히 부합한다.
- **서비스 레이어(D-1 이중 방어 + D-2)**: `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·`storeUserSuppliedSecrets` 게이팅(`triggers.service.ts:426-706`, `:1034-1180`) 모두 spec §5.4.1/§5.4.1.1/R-CC-21 의 표·carve-out 문구와 line-level 로 일치한다 — telegram server-issued 축은 게이팅 대상에서 명시적으로 제외돼 있고(쓰기 ③, `:1113-1126`), 이는 spec 이 이미 반영한 telegram carve-out(§5.4.1 표 3행, R-CC-21 경고문)과 정합한다.
- **프런트엔드 정합성**: `chat-channel-card.tsx:340-364` 가 실제로 보내는 PATCH 바디(`{provider, uiMapping, rateLimitPerMinute, languageLocale, languageHints?}`, 비밀 필드 미포함)가 신규 테스트의 `cardBody()` 픽스처와 정확히 일치 — 이 PR 이 고치려던 "카드 편집 저장이 항상 400" 결함이 실제로 닫힌다는 근거가 코드 레벨로 확인된다.
- **회귀 없음 확인**: `CreateTriggerDto`/`assertInboundSigningPlaintextByProvider` 는 그대로 남아 생성 경로에서 slack/discord `inboundSigningPlaintext` 필수 요구가 유지된다(`trigger-dto-validation.spec.ts` "CreateTriggerDto 는 여전히 botToken 을 요구한다" 케이스로 캐너리 확보).
- **테스트 실행 결과**: `trigger-dto-validation.spec.ts` 74/74 PASS, `triggers.service.spec.ts` 97/98 PASS(1 skip 은 이 PR 과 무관한 기존 `it.skip('structural anchor', …)`). `tsc -p tsconfig.build.json --noEmit` 무오류. `tsc -p tsconfig.json --noEmit` 전체는 기존 baseline 오류 다수가 있으나 이번 diff 가 건드린 6개 파일명으로는 오류 0건(사전 존재 노이즈와 무관함을 grep 으로 확인).
- **spec 정합**: `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1/R-CC-21 은 이미 telegram carve-out 문구가 반영된 최신 상태(`review/consistency/2026/09/10/22_45_26/SUMMARY.md` BLOCK: NO, Critical 0 확인)이며, 이번 developer 세션의 diff 는 그 spec 문면과 필드명·에러 코드(`VALIDATION_ERROR`)·`details.field` 값·차단 대상(두 필드 한정, telegram 예외)이 전부 일치한다. `SecretResolver.store()` vs `.rotate()` 명명 불일치는 기존 발견된 WARNING(spec 쪽 오기)으로 이미 planner 후속 등재 대상이며 이번 코드 변경의 결함이 아니다.
- **TODO/FIXME**: 변경된 6개 코드 파일에서 TODO/FIXME/HACK/XXX 없음.
- (사소, INFO) `triggers.service.ts:48-64` 에 `type ChatChannelInput`/`type ChatChannelInputMode` 두 타입 선언이 import 구문 사이(`import { ChannelAdapterRegistry } ...` 앞)에 끼어 있다 — 컴파일에는 문제 없으나 가독성상 이례적 배치.

## 요약

DTO 분리(D-1)·서비스 레이어 이중 방어·"최초 setup 은 POST 한정" 가드는 spec(§5.4.1·§5.4.1.1·R-CC-21)과 정확히 line-level 로 일치하고, 프런트엔드가 실제로 보내는 바디와도 정합해 원래 목표(ChatChannelCard 편집-저장 400 결함 해소)를 달성한다. 그러나 D-2(비밀 쓰기 게이팅)를 구현하며 `botTokenRef` 에만 "재유도로 항상 보존" 패턴을 적용하고 `inboundSigningRef` 에는 적용하지 않아, slack/discord 트리거를 PATCH 로 한 번만 편집해도 `inboundSigningRef` 가 config 에서 통째로 사라지는 것을 실측으로 확인했다 — 그 직후 인입 웹훅 서명 검증이 조용히 skip 된다(보안 회귀). 이는 plan 자신이 명시한 D-3 설계 의도(두 ref 모두 재유도로 생존)에도 못 미치는 구현 누락이며, 현재 테스트 스위트는 `botTokenRef` 생존만 단언해 이 결함을 검출하지 못한다. 병합 전 수정 필요.

## 위험도

CRITICAL
