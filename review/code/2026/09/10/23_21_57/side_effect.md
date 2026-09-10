# 부작용(Side Effect) 리뷰 — chatChannel PATCH 비밀 차단 (D-1/D-2/D-3)

## 발견사항

- **[CRITICAL]** PATCH 로 slack/discord `chatChannel` 을 편집하면 `inboundSigningRef` 가 config 에서 **소리 없이 사라져 인입 웹훅 서명 검증이 skip 된다** — 이 PR 이 처음으로 도달 가능하게 만든 경로다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `setupChatChannel()` — 원인이 되는 신규 라인은 1084~1086 (`storeUserSuppliedSecrets ? chatChannelCfg.inboundSigningPlaintext : undefined`), 증상이 드러나는 자리는 (diff 문맥 라인, 미변경) 1107 과 1132~1139 (`mergedChannel` 의 `...(result.issuedInboundSigning || providerIssuedStored ? { inboundSigningRef } : {})`).
  - 소비 측: `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts:64,93,129` — `if (!config.inboundSigningRef) return;` (검증 skip, "legacy" 주석).
  - 상세:
    1. PATCH 로 slack/discord `chatChannel` 을 편집할 때 이제(D-1) `inboundSigningPlaintext` 를 **보낼 수 없다** (`@IsEmpty()` + `assertPatchCarriesNoSecrets`). 그래서 `storeUserSuppliedSecrets=false` 인 PATCH 경로에서는 항상 `providerIssuedPlaintext=undefined` → `providerIssuedStored=false` 로 고정된다.
    2. Slack/Discord adapter 의 `setupChannel()` 은 `issuedInboundSigning` 을 **항상 비운다** (`slack.adapter.ts` 주석 "Slack 은 provider-issued — 발급한 plaintext 없음", `discord.adapter.ts` 동일). Telegram 만 매 호출마다 재발급한다.
    3. 따라서 slack/discord PATCH 편집에서는 `result.issuedInboundSigning || providerIssuedStored` 가 **항상 false** 가 되어, `mergedChannel` (그리고 그 결과가 그대로 쓰이는 `newConfig.chatChannel`, `triggerRepository.update` 로 영속화되는 그 값)에 `inboundSigningRef` 키 자체가 빠진다. `mergedChannel` 은 `trigger.config.chatChannel` 을 **완전히 대체**하므로(머지 아님), 기존에 저장돼 있던 `inboundSigningRef` 값도 함께 사라진다.
    4. `ChatChannelInboundAuthenticator.verifySlack`/`verifyDiscord` 는 `config.inboundSigningRef` 가 없으면 **"legacy — 검증 skip"** 으로 처리한다. 즉 PATCH 편집 한 번 이후로 그 트리거의 인입 Slack/Discord 웹훅은 **서명 검증 없이 통과**하게 된다 — 조용한 인증 우회.
  - 왜 지금까지 안 드러났는가: 이 PR 이전에는 `assertInboundSigningPlaintextByProvider` 가 create/update 공유였고 slack/discord 는 `inboundSigningPlaintext` 를 **항상 필수**로 요구했다. `ChatChannelCard` 는 이 필드를 보내지 않으므로 PATCH 편집 자체가 **항상 400** 이었다 — 즉 이 코드 경로(“비밀 없이 PATCH 성공”)는 지금까지 프로덕션에서 도달 불가능했다. 이번 PR 이 그 400 버그를 고쳐 PATCH 편집을 **처음으로 성공시키면서**, 동시에 이 잠재 결함을 실사용 경로로 노출시킨다 — 두 CRITICAL 을 닫으면서 세 번째를 새로 연 형태다.
  - 테스트 갭: 신설된 `triggers.service.spec.ts` 의 "chatChannel PATCH 는 사용자 비밀을 쓰지 않는다" suite 는 slack 케이스에서 `expect(secrets.rotate).not.toHaveBeenCalled()` 만 단언한다 — `triggerRepo.update` 로 실제 영속되는 `config.chatChannel.inboundSigningRef` 가 보존되는지는 어떤 케이스도 확인하지 않는다("config 를 통째로 교체해도 botTokenRef 가 재유도돼 살아남는다" 테스트는 telegram 으로만 작성돼 있어 `issuedInboundSigning` 경로를 타고, 그래서 이 결함을 못 잡는다).
  - `botTokenRef` 는 이 문제가 없다 — `internalCfg`/`mergedChannel` 양쪽에서 `storeUserSuppliedSecrets` 와 무관하게 무조건 포함된다 (`buildSecretRef` 로 매번 재유도). 결함은 **`inboundSigningRef` 한 축**에 국한된다.
  - 제안: `mergedChannel` 조립 시 "이번 호출에서 새로 썼는가"(`providerIssuedStored || result.issuedInboundSigning`) 뿐 아니라 "기존에 이미 있었는가"(`(trigger.config as {chatChannel?:{inboundSigningRef?:string}})?.chatChannel?.inboundSigningRef`)도 함께 고려해 기존 값을 보존해야 한다. 즉 `inboundSigningRef` 를 매 호출 재계산이 아니라 "새로 쓴 값 → 없으면 기존 값 → 그래도 없으면 생략" 순으로 결정할 것. 회귀 테스트로 "slack/discord PATCH 편집 후 `inboundSigningRef` 가 유지된다" 케이스를 `triggers.service.spec.ts` 에 추가 (기존 telegram 케이스와 자매 형태로).

- **[INFO]** `UpdateTriggerDto.chatChannel` 타입이 `ChatChannelConfigDto` → `ChatChannelUpdateConfigDto` 로 바뀌어 PATCH 의 실제 계약이 변경된다 (의도된 변경, side-effect 관점 기록).
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` (import 및 `chatChannel` 필드 타입).
  - 상세: 종전에는 `botToken` 이 PATCH 에서도 필수였고, 이제는 `@IsEmpty()` 로 **금지**된다. 이는 이 PR 의 목적 그 자체(R-CC-21)이며 새 DTO 도입으로 컴파일 타임에 강제되므로 버그는 아니다. 다만 PATCH body 에 `botToken` 을 싣던 **모든 기존 외부 호출자**(문서화되지 않은 스크립트·직접 API 호출 등, 프런트 `ChatChannelCard` 는 이미 안전함이 plan 에서 실측됨)는 이 변경 이후 200→400 으로 응답이 바뀐다. 이미 spec R-CC-21 / plan D-1 로 사전 승인된 breaking change 라 조치 불요 — 기록만 남긴다.

- **[INFO]** `update()` 에 새로 추가된 `assertChatChannelAlreadySetUp` 가드로, PATCH 로 `chatChannel` 을 처음 붙이는 요청이 이제 (이전엔 `chatChannelHealth=degraded` 로 조용히 실패하던 것이) 명시적 400 `VALIDATION_ERROR` 로 바뀐다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 의 `if (chatChannel) { this.assertChatChannelAlreadySetUp(trigger); }` 및 `assertChatChannelAlreadySetUp` 정의.
  - 상세: 실패 모드가 "조용한 degraded" → "즉시 400" 으로 바뀌는 의도된 동작 변경이며, plan 문서가 이 트레이드오프를 명시적으로 근거를 들어 정당화한다. 부작용이라기보단 사용자 관측 가능성이 개선된 변경이라 조치 불요 — 참고용 기록.

- **[INFO]** 이번 diff 에 포함된 `review/consistency/2026/09/10/{21_37_56,22_45_26}/**` (SUMMARY.md, `_retry_state.json`, `meta.json`, 5개 checker `.md`) 는 `/consistency-check` 워크플로가 정상적으로 산출한 리뷰 아티팩트로, 컨벤션(`review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 맞게 생성됐다. 예상치 못한 파일시스템 부작용이 아니라 harness 가 의도적으로 남기는 산출물이다 — side-effect 관점에서는 이상 없음.

## 검증 절차 메모

이번 리뷰는 저장소 파일을 뮤테이션하지 않고 `Read`/`grep` 만으로 진행했다. `git status --short` 로 확인한 결과 리뷰 도중 어떤 파일도 건드리지 않았다(원복 불필요).

## 요약

가장 중요한 발견은 `setupChatChannel()` 의 `mergedChannel` 조립 로직이 "이번 PATCH 호출에서 새로 비밀을 썼는가"만 보고 `inboundSigningRef` 포함 여부를 결정한다는 점이다. D-1(“PATCH 는 값 필드를 받지 않는다”)이 적용되면 slack/discord PATCH 편집은 구조적으로 "새로 쓰지 않는" 경로만 타게 되므로, 기존에 저장돼 있던 `inboundSigningRef` 가 매 편집마다 config 에서 탈락한다. 이 값이 없으면 `ChatChannelInboundAuthenticator` 는 "legacy — 검증 skip" 으로 처리하므로, 이 PR 이 배포되면 slack/discord 챗봇을 한 번이라도 PATCH 로 편집(예: rate limit 변경)하는 순간 그 트리거의 인입 웹훅 서명 검증이 조용히 무력화된다. 이 결함은 이 PR 이전엔 다른 CRITICAL(카드 편집이 항상 400)에 가려 도달 불가능했고, 이번 PR 이 그 400 을 없애면서 처음으로 실사용 경로가 된다 — 즉 이 PR 이 "만든" 결함이라기보다 "열어젖힌" 결함이며, 같은 PR 안에서 반드시 함께 닫아야 한다. 그 외 DTO 타입 변경·신규 400 가드는 모두 spec 이 사전 승인한 의도된 breaking change/동작 개선으로, side-effect 관점의 추가 조치는 불요하다. 새로 생성된 `plan/`·`review/consistency/**` 파일들은 workflow 컨벤션에 맞는 정상 산출물이다.

## 위험도

CRITICAL
