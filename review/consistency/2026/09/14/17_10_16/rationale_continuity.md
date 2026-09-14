# Rationale 연속성 검토 — trigger-config-lost-update

검토 대상: `plan/in-progress/trigger-config-lost-update.md` (§B 설계 — "락은 쓰되 외부 호출을 락 안에 두지 않는다" / "config 를 지금 다시 읽는다 → 이번 결과를 머지 → UPDATE") vs `spec/5-system/15-chat-channel.md` · `spec/5-system/14-external-interaction-api.md` · `spec/2-navigation/4-integration.md` 의 `## Rationale`.

## 발견사항

- **[WARNING]** 재읽기+머지 recipe 가 `chatChannel` 서브키의 ref-presence 게이팅(R-CC-21)을 그대로 통과시키는지 불명
  - target 위치: `plan/in-progress/trigger-config-lost-update.md` §B ("config 를 **지금** 다시 읽는다 ← 스냅샷을 버린다 / 그 위에 이번 결과를 머지") 및 §A 「착수 시 확인할 것」 체크리스트 (재읽기 비-대상 필드를 `chatChannelHealth`/`chatChannelSetupAt`/`chatChannelLastError` 셋만 열거)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `### R-CC-21. PATCH 는 비밀을 쓰지 않는다` (특히 line 802-874) + 구현 JSDoc `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:92-95`("이 PATCH **이전에** config 에 있던 `inboundSigningRef`. 호출자가 병합 전에 집어 준다 — 병합 후에는 사라져 있어 이 함수가 스스로 알 수 없다"), `:167-186`("**`trigger.config` 에서 읽으면 안 된다** — … 그래서 호출자가 **병합 전에** 집어 인자로 넘긴다")
  - 상세: 이 플랜이 고치려는 실측 결함(§A "무엇이 실제로 사라지나")의 실제 메커니즘은 `TriggersService.update()` 가 `mergeExternalConfig` 호출 **전**에 캡처하는 `previousInboundSigningRef`(`triggers.service.ts:503-505`)가 `ChatChannelBinderService.setupChatChannel` 로 넘어가 `inboundSigningRefSurvives = providerIssuedStored || Boolean(preservedInboundSigningRef)` (`chat-channel-binder.service.ts:185-186`) 라는 **presence 게이트**를 거쳐 `mergedChannel`(=`chatChannel` 서브키 전체를 대체하는 값, whole-key-replace)에 반영되는 구조다. 두 PATCH 가 겹치면 나중에 커밋되는 쪽의 `preservedInboundSigningRef` 가 (자신의 `findById` 시점 기준) stale 할 수 있어 `mergedChannel` 에서 `inboundSigningRef` 필드 자체가 빠진 채로 최종 `newConfig = {...trigger.config, chatChannel: mergedChannel}` (`chat-channel-binder.service.ts:226-229`)이 쓰인다.
    플랜의 §B recipe 는 "config 를 락 안에서 다시 읽어 그 위에 이번 결과를 머지"라고 **최상위 config 병합**만 명시한다. 이 recipe 를 문자 그대로 (top-level 재읽기만) 적용하면, `mergedChannel` 자체는 여전히 (재호출 전에) 미리 계산된 값 그대로 쓰이므로 — `chatChannel` 은 whole-key-replace 대상이라 top-level 재읽기가 `chatChannel.inboundSigningRef` 유실을 구조적으로 못 고친다. 즉 **이 플랜이 표적으로 삼은 정확히 그 결함(인입 서명 fail-open)이 recipe 를 그대로 적용해도 재발할 수 있다** — R-CC-21 이 명시한 "`trigger.config` 에서 읽으면 안 된다"(당시는 "요청 바디로 이미 갈아치워진 시점"을 가리켰다)와 지금 §B 가 도입하려는 "락 안에서 다시 읽는다"가 **같은 필드를 놓고 반대 방향으로 말하고 있어**, 구현자가 이 둘을 조율하지 않으면 어느 한쪽이 조용히 깨진다.
  - 제안: §B recipe 를 `chatChannel` 서브키에 적용할 때는 top-level `config` 재읽기와 별도로, **재읽은 `chatChannel.inboundSigningRef`(또는 그 presence)를 `preservedInboundSigningRef` 대신 사용해 `inboundSigningRefSurvives` 를 락 안에서 재계산**하도록 §A 체크리스트에 명시할 것. `rotateBotToken`(3번 쓰기, `triggers.service.ts:1064-1088`)도 동일 패턴(`chatChannelCfg` 를 함수 시작 시점에 읽어 `mergedChannel` 을 미리 구성)이라 같은 재조율이 필요 — 세 쓰기 지점의 "이번 결과"가 정확히 어느 필드(들)인지 함수별로 명시하지 않으면 recipe 가 균일하게 적용되지 않는다.

- **[INFO]** 인접 도메인의 "PostgreSQL advisory lock" 기각 사례와의 구분을 플랜에 명시하면 좋음
  - target 위치: `plan/in-progress/trigger-config-lost-update.md` §B ("선례가 이 저장소에 있다… `pg_advisory_xact_lock`")
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → `### BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소` → 「검토 후 배제한 대안」 1번째 항목: *"PostgreSQL advisory lock (`pg_advisory_xact_lock(hashtext(integrationId))`): 코드 단순하지만 **lock 보유 중 HTTP 요청(Cafe24 endpoint)을 transaction 안에 묶어야 해** DB 커넥션 점유 시간이 늘고…"*
  - 상세: 다른 도메인(Cafe24 통합 토큰 refresh)에서는 "advisory lock 을 쓰면 외부 HTTP 를 트랜잭션 안에 가둬야 한다"는 이유로 advisory lock 자체를 기각하고 BullMQ jobId dedup 을 택했다. 이 플랜은 정확히 같은 우려("provider 가 느리거나 멈추면 DB 커넥션과 락을 그동안 붙잡는다")를 §B 본문에서 스스로 짚고, **외부 호출을 락 밖으로 빼는 설계**로 그 objection 을 피해간다 — 그래서 두 결정은 실제로 상충하지 않는다(오히려 cafe24 사례가 지적한 위험을 이 플랜이 정확히 회피하는 형태). 다만 이 두 선례를 나란히 읽지 않으면 "이 저장소는 advisory lock 을 이미 한 번 기각했다"는 오해가 생길 수 있어, 플랜 본문(§B)에 "cafe24 사례는 **외부 호출을 락 안에 두는** 설계였기 때문에 기각됐고, 본 설계는 그 축을 애초에 분리했다"는 한 문장을 남겨 두면 향후 리뷰어의 재조사 비용을 줄인다.
  - 제안: §B에 위 구분 문장 추가 (필수 아님, 연속성 명료화 목적).

- **[INFO]** `SecretResolver.rotate` 빈 값 가드 유예는 기존 Rationale 과 정합
  - target 위치: `plan/in-progress/trigger-config-lost-update.md` 「하지 않는 것」 — `SecretResolver.rotate` 빈 값 가드(별 항목, 호출부 전수 선행)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-21 「기각한 대안」 2번째 항목: *"`SecretResolver.rotate` 에 빈 값 가드를 넣어 이 경로만 막기 — 증상을 가리고 원인을 남긴다. 그 가드 자체는 **다른 호출부를 위해 별도로** 검토한다."*
  - 상세: 이 플랜이 해당 가드를 범위 밖으로 명시적으로 미룬 것은 R-CC-21 이 이미 "별도로 검토"라고 못 박아 둔 방향과 정확히 일치한다. 번복이 아니라 계승 — 문제 없음.
  - 제안: 조치 불요. 기록 목적.

## 요약

플랜의 핵심 설계 원칙("외부 호출은 락 밖, 짧은 재읽기+머지 구간만 락 안") 자체는 기존 spec 의 어떤 Rationale 도 위반하지 않으며, 오히려 인접 도메인(Cafe24 refresh)이 advisory lock 을 기각한 이유(HTTP-in-transaction)를 정확히 피해가는 설계라 원칙 수준에서는 정합적이다. 다만 이 결함의 진짜 진원지인 `chatChannel` 서브키의 `inboundSigningRef` presence 는 R-CC-21 이 세운 "병합 **전**에 캡처해 넘긴다 / `trigger.config` 에서 다시 읽으면 안 된다"는 아주 구체적인 메커니즘에 묶여 있는데, 플랜의 "config 를 락 안에서 다시 읽는다"는 top-level 일반화 recipe 가 이 메커니즘과 정면으로 재조율되지 않으면 — 정확히 이 플랜이 닫으려는 fail-open 결함을 재현한 채로 "고쳤다"고 착각할 위험이 있다. §A 체크리스트에 이 항목을 추가해 구현 착수 전에 명시적으로 다루는 것을 권한다.

## 위험도

MEDIUM
