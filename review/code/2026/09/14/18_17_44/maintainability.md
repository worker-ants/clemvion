# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `buildFallbackChannel` / `buildMergedChannel` 클로저가 거의 동일한 스프레드 패턴을 반복한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:213-218`, `:243-252`
  - 상세: 두 클로저 모두 `...internalCfg` 를 스프레드한 뒤 `survivesWithFresh(freshConfig)` 조건으로 `inboundSigningRef` 를 붙이는 동일한 형태다. 차이는 `buildMergedChannel` 이 `result.configUpdates` 를 추가로 스프레드하고 조건에 `result.issuedInboundSigning ||` 를 더 얹는 것뿐이다. 두 함수를 나란히 두고 "짝"이라는 사실을 주석으로만 설명하고 있어, 한쪽만 고치고 다른 쪽을 놓치는 drift 위험이 있다(실제로 이 PR 자체가 `inboundSigningRefSurvives`→`survivesWithFresh` 로 두 자리를 함께 바꿔야 했던 사례).
  - 제안: `buildFallbackChannel` 을 `buildMergedChannel` 의 `extra` 파라미터가 비어 있는 특수 케이스로 흡수하거나(`buildChannel(freshConfig, { configUpdates, forceSurvive })`), 최소한 두 함수 정의를 서로 옆에 붙여 두고 "이 둘이 같은 술어를 공유한다" 는 사실이 코드 구조에서 드러나게 한다.

- **[INFO]** `setupChatChannel` 메서드가 여전히 매우 길고 이번 PR 로 로컬 클로저가 3개 더 늘었다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:84`~`306` (`setupChatChannel`)
  - 상세: 이 메서드는 원래도 secret 3중 쓰기·plaintext 제거·ref 보존 게이트·adapter 호출·config 조립·에러 처리를 한 함수에 담고 있었다. 이번 변경이 `survivesWithFresh`·`buildFallbackChannel`·`buildMergedChannel` 세 클로저를 그 안에 추가로 정의해 함수 하나가 책임지는 로컬 심볼 수가 늘었다. 함수 자체를 새로 크게 만든 것은 아니라 이번 PR 의 신규 결함은 아니지만, 다음에 이 함수를 또 확장할 때 인지 부하가 누적되는 방향이다.
  - 제안: presence-gate 재계산 + config 조립 로직(`survivesWithFresh`/`buildFallbackChannel`/`buildMergedChannel`)을 이 메서드 밖의 모듈 레벨 순수 함수(또는 별도 파일)로 뽑아 `internalCfg`/`inboundSigningRef` 등을 명시적 인자로 받게 하면, 메서드 본문의 스캔 범위를 줄일 수 있다.

- **[INFO]** 같은 익명 타입 shape 가 두 파일에 독립적으로 중복 선언되어 있다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:209` (`survivesWithFresh` 내부 캐스트) vs `codebase/backend/src/modules/triggers/triggers.service.ts:505` (`previousInboundSigningRef` 계산, 이 PR 이전부터 있던 코드)
  - 상세: 둘 다 `{ chatChannel?: { inboundSigningRef?: string } }` 라는 동일한 부분 shape 를 각자 인라인으로 정의한다. `ChatChannelConfig` 의 부분집합이므로 한쪽이 필드명을 바꾸면 다른 쪽이 조용히 어긋날 수 있는 타입 중복이다. 이번 PR 이 새로 만든 결함은 아니지만(505 는 기존 코드), 새 코드(209)가 같은 패턴을 한 벌 더 늘렸다.
  - 제안: `chat-channel/types.ts` 에 `Pick<ChatChannelConfig, 'inboundSigningRef'>` 류의 공유 타입 alias 를 두고 두 곳에서 재사용.

- **[INFO]** 테스트 mock 위임에 인라인 함수 타입 캐스트가 반복된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `withTransactionMock` 내부 (diff 게이트 61-80, `findOne`/`update` 위임부)
  - 상세: `as ((o: unknown) => unknown) | undefined` 형태의 캐스트가 `findOne`/`update` 위임에 각각 한 번씩 등장한다. 다만 이 헬퍼 자체는 8개 호출부에 흩어져 있던 `manager` mock 배선을 한 곳으로 모아 중복을 크게 줄인 긍정적인 리팩터라, 이 지적은 그 안의 타입 표현을 조금 더 다듬을 수 있다는 수준의 사소한 지적이다.
  - 제안: 필요하면 `type RepoMockShape = { findOne?: (o: unknown) => unknown; update?: (w: unknown, p: unknown) => unknown; ... }` 정도의 named type 을 하나 두어 캐스트를 단순화할 수 있다. 급하지 않음.

## 긍정적으로 확인한 점 (참고)

- `rewriteTriggerConfigLocked` 로의 추출은 기존에 세 자리(성공 경로·실패 경로·`rotateBotToken`)에 흩어져 있던 "락 없는 스냅샷 통째 쓰기" 패턴을 하나의 공용 유틸로 통합해 중복을 오히려 줄였다. 트랜잭션 콜백 파라미터명 `m` 도 `execution-engine.service.ts` 의 선례(`manager.transaction(async (m) => …)`)와 일치해 컨벤션 일관성이 있다.
- 매직 넘버 없음 — e2e 테스트의 `RATE_LIMIT_FROM_A/B`, `SETTLE_MS`, `POLL_TIMEOUT_MS`, `POLL_INTERVAL_MS` 모두 의미가 드러나는 이름의 상수로 선언되고 각각 존재 이유가 주석에 있다.
- 네이밍은 목적을 잘 드러낸다 (`survivesWithFresh`, `buildFallbackChannel`, `buildMergedChannel`, `triggerConfigLockKey`, `rewriteTriggerConfigLocked`).

## 요약

이번 변경은 세 지점(chat-channel 성공/실패 경로, bot token 회전)에 흩어져 있던 "락 없이 스냅샷을 통째로 되쓰는" 패턴을 `trigger-config-lock.ts` 의 공용 함수 하나로 통합해 오히려 전체 중복을 줄이는 방향이며, 네이밍과 주석 밀도는 기존 코드베이스 컨벤션과 일관된다. 다만 `chat-channel-binder.service.ts` 안에서 새로 추가된 두 클로저(`buildFallbackChannel`/`buildMergedChannel`)가 거의 동일한 스프레드-조건 패턴을 반복하고 있어 향후 한쪽만 고치는 drift 위험이 있고, 이미 길었던 `setupChatChannel` 메서드가 이번 PR 로 로컬 클로저 3개만큼 더 무거워졌다는 점, 그리고 같은 익명 타입 shape 가 두 파일에 독립적으로 존재한다는 점은 소규모 리팩터로 해소할 수 있는 여지다. 모두 차단 사유는 아니다.

## 위험도

LOW
