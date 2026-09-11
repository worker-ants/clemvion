# Rationale 연속성 검토 — `impl-chat-channel-binder` (scope: `spec/5-system/`)

## 검토 범위에 대한 메모

이번 호출의 "target" 은 `spec/5-system/` 번들 자체이며 diff 가 아니다(`--impl-prep`,
`plan/in-progress/impl-chat-channel-binder.md` 의 `spec_impact: none`). 즉 이 턴은 **spec 을
바꾸지 않는 순수 코드 리팩터**(`TriggersService` 의 chat-channel 도메인 로직 744줄을 T1 순수
함수 모듈 + T2 `ChatChannelBinderService` provider 로 분리, 위치는 `triggers/` 내부 유지)를
착수하기 전 점검이다. 번들에서 컨텍스트 예산으로 생략된 `spec/5-system/15-chat-channel.md`
(가장 관련도 높은 파일)는 직접 `Read` 로 전문을 열어 대조했다.

## 사실관계 검증 (plan 의 근거 주장 대조)

plan 이 인용한 세 가지 사실 주장을 코드로 직접 대조했다 — 전부 일치:

- `TriggersService` 총 1,881줄 — `wc -l` 실측 일치.
- "`chat-channel/`↔`triggers/` 양쪽에 잔존 `forwardRef` 0건" — `forwardRef(` 호출 실측 0건.
  grep 히트 3건은 전부 그 순환을 없앤 `C-2` 리팩터를 설명하는 **주석**(`triggers.module.ts:35-37`,
  `triggers.controller.ts:253`, `triggers.controller.spec.ts:9`)이지 실제 `forwardRef()` 잔존이
  아니다.
- `[쓰기 ①/②/③]` 앵커 주석·`inboundSigningRefSurvives`·`assertChatChannelInputSafe`·
  `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·`stripChatChannelPlaintext`·
  `assertInboundSigningPlaintextByProvider`·`setupChatChannel`/`teardownChatChannel`/
  `rotateBotToken`/`translateSetupChannelError` — 전부 `triggers.service.ts` 에 plan 이 서술한
  그대로 존재한다.

## Rationale 대조

### spec/5-system/15-chat-channel.md §7 (구현 파일 구조) — C-2 이력과 정합

§7 은 `triggers.controller.ts` 주석에 "C-2: rotateBotToken 엔드포인트 이전 (chat-channel→triggers
forwardRef 순환 해소)" 를, `chat-channel-token-rotator.service.ts` 에 "C-2: chat-channel 에서
이전" 을 명시한다 — 즉 **spec 자체가 이미 "chat-channel 도메인 일부는 순환 해소를 위해
triggers/ 에 거주한다" 는 선례를 문서화**해 두었다. plan 이 T1/T2 를 `chat-channel/` 로 되돌리지
않고 `triggers/` 안에 두기로 한 결정은 이 선례와 **정합**이며, 오히려 원 `/ai-review` 지적
(chat-channel/ 로 옮기라는 표면적 해석)을 그대로 따랐다면 `#676`(`e827ed2a7`)이 끊은 순환을
되살릴 뻔했다는 점까지 plan 이 스스로 짚어 두었다. 이것은 "과거에 기각된 대안(순환 의존을
만드는 배치)을 사전에 걸러낸" 사례로, 오히려 Rationale 연속성 관점에서 **모범적**이다.

### R-CC-21 "PATCH 는 비밀을 쓰지 않는다" 및 그 「기각한 대안」 3건 — plan 이 재도입하지 않음

`15-chat-channel.md` 의 R-CC-21 은 명시적으로 세 대안을 기각했다: (1) telegram 전용
`rotate-inbound-signing` API 분리, (2) adapter 가 기존 서명을 재사용해 "값 불변"을 참으로 만듦,
(3) `chatChannel` 이 실린 PATCH 에서 `setupChannel` 호출 자체를 생략. plan 은 `setupChatChannel`/
`teardownChatChannel` 의 **호출 지점과 로직을 변경 없이 그대로 이동**한다고만 선언하므로 세 대안
중 어느 것도 재도입하지 않는다. 또한 plan §"위험" 절이 `#1314` CRITICAL(`inboundSigningRef`
포함 조건이 구조적으로 항상 거짓이 되는 D-2 게이팅 버그)을 명시적으로 인지하고 "주석까지
그대로 옮긴다"고 선언한 것은, Rationale 이 기록한 사고 이력을 정리 충동으로 지우지 말라는
자기 규율이다 — 이는 결정 번복이 아니라 **결정 보존**의 올바른 형태다.

### R8 (per-trigger listener 정책) / R4 (단일 sink) — 영향 없음 확인

T2 로 옮겨지는 `setupChatChannel`/`teardownChatChannel` 은 `channelListenerRegistry.register`/
`unregister` 를 호출하는 지점을 그대로 유지한다(현재도 `triggers.service.ts` 가
`ChannelListenerRegistry`/`ChannelAdapterRegistry` 를 `chat-channel/` 모듈에서 주입받아 쓰고
있음을 실측 확인). 협력자 주입 방식이 그대로이므로 R8 의 per-trigger dedup/teardown 불변식,
R4 의 단일 sink 구조 어느 것도 이 리팩터로 우회되지 않는다.

### T1 을 순수 함수(비-DI)로 분리하는 것 — 기존 합의 원칙과 충돌 없음

의존 0개인 검증 로직을 Nest provider 가 아닌 `export function` 으로 뽑는 결정은, `spec/
conventions/chat-channel-adapter.md` 를 포함해 검토한 관련 spec 어디에도 "모든 도메인 로직은
DI provider 여야 한다" 는 형태의 명시적 invariant 가 없어 위반 대상이 없다. T2(협력자 5~6개
필요)만 provider 로 만드는 비대칭은 plan 이 근거(의존 개수)와 함께 명시했고 이 저장소의 기존
`chat-channel/` 모듈도 provider 기반이라는 관례와 상충하지 않는다(T1 은 애초에 그 관례가
겨냥하는 "협력자가 있는 서비스"가 아니다).

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 충돌을 발견하지 못했다.

- **[INFO]** §7 파일 구조 다이어그램의 낙후 가능성
  - target 위치: `spec/5-system/15-chat-channel.md` §7 "구현 파일 구조" (`triggers/` 항목)
  - 과거 결정 출처: 같은 절의 C-2 주석 및 R8
  - 상세: 이번 리팩터로 `triggers/` 아래 새 파일(예: `chat-channel-input-rules.ts`,
    `chat-channel-binder.service.ts` 류)이 영구적으로 생기면 §7 다이어그램에는 반영되지 않는다.
    다만 현재도 `assertChatChannelInputSafe` 등 private 메서드들은 §7 에 개별 열거되어 있지 않아
    (파일 단위 다이어그램이지 메서드 단위가 아님) 이번 분리가 기존 문서화 수준을 갑자기
    깨뜨리는 것은 아니다 — 새 **파일**이 생긴다는 점만 §7 과의 정합 격차다.
  - 제안: `spec_impact: none` 자체는 타당(동작·계약 무변경)하나, `plan/complete/` 이동 전 §7
    다이어그램에 신규 파일 2개를 한 줄씩 추가하는 후속(같은 PR 또는 별도 후속 등재)을 권장.
    Rationale 재작성은 불필요 — 순수 구조 갱신이다.

## 요약

`impl-chat-channel-binder` plan 은 대상 리팩터 범위 안에서 인용한 과거 결정(C-2 순환 해소,
`#1314` CRITICAL, R-CC-21 의 기각된 3대안)을 모두 정확히 재현하고 있으며, 코드 실측 대조로도
plan 의 사실 근거(줄 수·`forwardRef` 잔존·앵커 주석 존재)가 전부 확인됐다. 표면적으로는 원
리뷰 지적(`chat-channel/` 로 이전하라)을 따르는 것이 자연스러워 보이지만, plan 은 그것이
`#676` 이 끊은 순환을 되살린다는 점을 실측으로 먼저 반증하고 대신 spec §7 이 이미 문서화한
"C-2 로 인한 triggers/ 거주" 선례를 따르는 방향으로 스스로 교정했다 — 이는 기각된 대안의
재도입이 아니라 그 반대(재도입을 사전에 걸러낸) 사례다. `setupChatChannel`/`teardownChatChannel`
의 로직·주석을 무변경으로 이동한다는 선언 역시 R-CC-21 이 기록한 사고 이력과 그 결정을
번복 없이 보존하는 올바른 태도다. CRITICAL/WARNING 급 Rationale 충돌은 없다.

## 위험도

NONE
