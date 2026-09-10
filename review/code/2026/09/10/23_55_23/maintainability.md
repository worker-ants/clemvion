# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `setupChatChannel` 이 이번 라운드(CRITICAL #1 수정 `771801fca`)에서 133줄 → 186줄(+40%)로 늘었고, 서로 다른 성격의 결정 5~6가지를 한 함수가 계속 떠맡고 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1063`~`:1248` (`private async setupChatChannel`)
  - 상세: 이 함수는 이제 (1) adapter 등록 확인, (2) endpoint 존재 검증, (3) `storeUserSuppliedSecrets` 게이팅에 따른 bot-token rotate 여부, (4) 같은 플래그에 따른 provider-issued signing rotate 여부, (5) `providerIssuedStored || Boolean(preservedInboundSigningRef)` 로 계산하는 `inboundSigningRefSurvives` 판정, (6) `internalCfg`/`mergedChannel`/`fallbackConfig` 세 갈래 config 조립, (7) 성공 경로의 DB 반영 + listener 등록, (8) 실패 경로의 degraded 반영까지 순차 처리한다. 새 옵션 인자(`storeUserSuppliedSecrets`, `preservedInboundSigningRef`)가 추가되면서 조건 분기가 실질적으로 2개 더 생겼고, 그 결과 함수 하나의 순환 복잡도가 눈에 띄게 올라갔다. 다만 인접 secret-write 셋을 표로 명시한 JSDoc과 각 분기 옆의 근거 주석, 대칭 회귀 테스트(`triggers.service.spec.ts` 신설 `describe` 블록)가 실질적인 유지보수 리스크를 크게 낮추고 있어 즉시 차단할 사안은 아니다.
  - 제안: 당장 쪼갤 필요는 없지만, 다음에 이 함수를 다시 건드릴 일이 생기면 "secret 쓰기 게이팅 + ref 생존 판정"(현재 몸통의 앞쪽 절반, 약 60줄)을 `resolveChatChannelSecretWrites(...)` 류의 private 헬퍼로 뽑아 반환값(`{ botTokenRef, inboundSigningRef, sanitizedCfg, inboundSigningRefSurvives }`)을 나머지 절반(adapter 호출 + 영속화)이 소비하는 형태로 나누는 것을 고려. 두 절반은 이미 논리적으로 분리 가능한 경계를 갖고 있다(주석의 "[쓰기 ①②③]" 앵커가 그 경계를 이미 드러낸다).

- **[INFO]** `update()` 가 이번 라운드에서도 3줄이 더 늘었다 (115줄 → 123줄) — 이전 라운드 INFO 의 연장
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:485`~`:607` (`async update`), 신규 라인은 `:521`(`this.assertChatChannelAlreadySetUp(trigger, chatChannel);`)과 `:526`-`:528`(`previousInboundSigningRef` 캡처)
  - 상세: 이전 라운드 리뷰(`review/code/2026/09/10/23_21_57/maintainability.md`)가 이미 "8가지 관심사를 순차 처리하는 함수에 분기가 계속 누적된다"고 지적했고, 이번 diff 는 그 추세를 그대로 이어 3줄을 더 얹었다. 신규 로직 자체는 한 줄짜리 가드 호출과 한 줄짜리 변수 캡처라 diff 단독으로는 새 결함이 아니다.
  - 제안: 이전 라운드 제안(단계 함수로의 분리)을 그대로 유지 — 당장 착수를 요구하지 않음.

## 확인한 것 — 이전 라운드 WARNING 이 실제로 해소됨

- **[해소 확인]** 이전 라운드(`23_21_57/maintainability.md`)가 WARNING 으로 지적한 "타입 선언 두 개가 import 블록 한가운데 끼어 있다"(`ChatChannelInput`/`ChatChannelInputMode`)는 실측 결과 이번 diff 에서 실제로 고쳐졌다. 두 `type` 선언은 이제 `triggers.service.ts:47`~`:70` — 마지막 import(`SLACK_SIGNING_SECRET_REGEX, DISCORD_PUBLIC_KEY_REGEX`, `:44`-`:46`) 뒤, `export type TriggerDetail`(`:72`) 앞 — 로 옮겨져 import 블록이 다시 한 덩어리로 붙어 있다. 재발 없음.

## 확인한 것 — 문제 없음 (긍정적 관찰)

- `ChatChannelInput`(`ChatChannelConfigDto | ChatChannelUpdateConfigDto`) 유니언과 `ChatChannelInputMode`(`'create' | 'update'`)를 도입해, "생성과 PATCH 의 요구가 정반대라 공유 검증 함수를 못 쓴다"는 설계 근거를 코드 레벨에서도 드러낸 것은 좋은 선택이다. 새로 분리된 `assertPatchCarriesNoSecrets` / `assertChatChannelAlreadySetUp` 은 각각 단일 책임의 짧은 private 메서드로, 기존 `assertChatChannelInputSafe` / `assertInboundSigningPlaintextByProvider` 와 이름 축이 일관된다(`assert*` 접두 + 술어형 이름).
- `inboundSigningRefSurvives` 판정을 한 곳에서만 계산해 `internalCfg` 조립과 `mergedChannel` 조립 두 자리가 그 값을 공유하도록 한 것은, CRITICAL #1 이 지적했던 "두 ref 가 대칭이어야 하는데 한쪽만 조건이 다르게 짜여 있던" 비대칭을 구조적으로 재발하기 어렵게 만든다.
- `stripChatChannelPlaintext` 가 `ChatChannelInput` 유니언 도입 후 불필요해진 `as ChatChannelConfigDto & {...}` 캐스팅을 제거하고 그 이유를 주석으로 남긴 것도 좋은 정리다.
- 테스트 쪽 `existing()`/`setup()`/`persistedChannel()` 헬퍼가 신설 `describe` 블록 안에서 반복되는 mock 조립·조회 로직을 잘 추출해, 8개 케이스 각각이 "무엇이 다른가"에만 집중하게 한다.

## 요약

이번 diff 는 이전 코드 리뷰 라운드가 잡아낸 CRITICAL(`inboundSigningRef` fail-open)을 닫는 수정으로, 새 타입 유니언·게이팅 플래그·검증 메서드 분리를 통해 설계 의도를 코드와 주석 양쪽에 잘 남겼고, 이전 WARNING(import 블록 분절)도 실제로 해소했다. 유일하게 새로 부각되는 항목은 `setupChatChannel` 함수가 이 수정으로 상당히 더 커지고 분기가 늘었다는 점인데, 두꺼운 근거 주석과 대칭 회귀 테스트가 위험을 상쇄하고 있어 즉시 리팩터링을 요구할 수준은 아니다. `update()` 길이 증가·캐스팅/메시지/fixture 중복 등 이전 라운드에서 이미 INFO 로 분류되고 수렴 예외 처리된 항목들은 이번 diff 로 성격이 바뀌지 않았다.

## 위험도

LOW
