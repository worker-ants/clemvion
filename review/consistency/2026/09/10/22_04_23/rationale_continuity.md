# Rationale 연속성 검토 — telegram signing carve-out draft (2R)

## 발견사항

- **[WARNING]** carve-out 의 판별 기준(D-B)이 §5.4.1 이 명시한 「값이 바뀌는가」 원칙을 직접 인용·재조정하지 않는다
  - target 위치: `plan/in-progress/spec-draft-telegram-signing-carveout.md` `## 결정` D-A/D-B, `### 기각한 대안` 표, 변경안 **B**
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1 본문(줄 380) — *"**차단의 기준은 필드명이 아니라 「토큰 값이 바뀌는가」다.**"* (같은 문단이 R-CC-21 을 근거로 인용). 그리고 `2-trigger-list.md:176` / `data-flow/14-chat-channel.md:151` 의 *"bot token·inbound signing 값은 요청 전후로 동일하다"* — 세 자리 모두 **어제 PR #1311 (`df1962e25`) 이 신설한 문장**이며, provider 예외를 두지 않은 **범용** 서술이다.
  - 상세: target 의 D-B 는 새 판별 기준을 *"사용자가 PATCH body 로 보낸 비밀인가"* 로 제시한다. 그러나 §5.4.1 이 명시한 기존 판별 기준은 그것이 아니라 **"값이 실제로 바뀌는가"** 다 — 그리고 telegram 의 `issuedInboundSigning` 은 `chatChannel` 이 실린 PATCH 가 `setupChannel()` 을 재호출할 때마다 `randomBytes(24)` 로 **실제로 새 값이 발급되어 저장**된다(어댑터 코드 주석 자기 확인). 즉 telegram 의 사례는 **"값이 바뀌는가" 기준으로는 정확히 R-CC-21 이 막으려던 그 형태** (PATCH 경유 secret 값 교체, grace 없음, 전용 audit action 없음, `chatChannelRotatedAt` 미갱신) 다. target 은 "이미 그어져 있던 경계" 로 §5.4.1.1 제목·`R-12`·§4.1 데이터 모델을 인용하지만, 이 세 자리는 모두 **생성 시점 입력 출처** (사용자 입력 vs server-issued) 를 구분하는 자리이지, **"PATCH 가 저장된 값을 바꾸는가"** 를 규정하는 §5.4.1 본문 문장과는 다른 질문에 답한다. 두 기준(값-불변 vs 입력-출처)이 다른 결론을 낼 수 있는 지점에서 target 은 후자만 근거로 채택하고 전자의 문장을 인용·반박하지 않는다.
  - 추가로, §5.4.1 의 같은 문단은 "이 확장(필드명→값)은 §5.4.1.1 의 botToken↔inboundSigning **자원-성격 대조**(외부 provider 등록 여부)를 바꾸지 않는다 — 두 축은 직교" 라고 명시적으로 축을 두 개로 분리해 둔다. 그런데 그 축을 telegram 에 적용하면: telegram `issuedInboundSigning` 도 **외부 provider(Telegram)에 등록되는 값**(`setWebhook` 의 `secret_token`)이라는 점에서 bot token 과 같은 편에 선다 — 그 축의 논리를 그대로 따르면 "외부 provider 등록 값은 PATCH 로 안 바뀌고 전용 rotate 경로만 허용" 이라는 **bot token 취급**을 예상하게 되는데, target 이 채택한 결론은 정반대(매 PATCH 마다 무한 재발급)다. target 의 「기각한 대안」 첫 행("회전 주체가 우리가 아니라 Telegram 등록 행위다")이 이 반론에 대한 답이 될 수 있는 재료를 이미 갖고 있으나, 그 논거가 R-CC-21 본문의 "직교 축" 서술과 명시적으로 연결되어 있지 않다.
  - 제안: 변경안 **B** (R-CC-21 갱신)에서 (1) §5.4.1 줄 380 의 "값이 바뀌는가" 문장을 직접 인용하고 telegram 사례가 왜 그 기준의 예외인지(또는 그 기준 자체가 "PATCH body 로 유입되는 값" 한정이었음을 명시적으로 좁히는지) 밝힐 것. (2) §5.4.1 의 "직교 축(외부 provider 등록 여부)" 서술을 인용해 telegram 이 그 축에서 bot-token 편이 아니라 별도 취급을 받는 이유(= 회전을 트리거하는 것이 우리 rotate 결정이 아니라 Telegram 자신의 `setWebhook` 등록 행위라는 점)를 명시할 것. (3) R-CC-21 말미의 "재검토 신호" 문단("bot token 축" / "signing 축" 2분법)을 "bot token 축 / slack·discord signing 축(v1 차단) / telegram signing 축(server-issued, 계속 갱신)" 3분법으로 갱신해 이번 carve-out 을 반영할 것.

- **[INFO]** 「기각한 대안」 두 번째 행의 논거가 §5.4.1.1 의 실제 스코프(제목상 slack/discord 한정)를 넘어 telegram 에 유추 적용되고 있음을 더 명시적으로 표시할 필요
  - target 위치: `### 기각한 대안` 표 2행 ("adapter 가 기존 서명을 재사용하도록...")
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1.1 제목 *"(slack / discord 한정 — v1 차단)"* 및 그 v2 후보 목록(A/B/C)
  - 상세: §5.4.1.1 의 "v1 차단 → v2 후속 결정" 유예 정책은 문면상 slack/discord 전용이다. target 은 "adapter 가 기존 서명을 재사용하면 §5.4.1.1 이 유예한 v2 결정을 telegram 축에서 미리 집행하는 셈" 이라고 기각 사유를 적는데, 이는 §5.4.1.1 의 문면을 telegram 까지 유추 확장한 **새로운 정책적 판단**이지 §5.4.1.1 자체가 telegram 을 이미 포함해서 하는 말이 아니다. 논거 자체는 합리적이나(같은 패턴을 다른 provider 축에 사전 집행하는 것을 피한다는 취지), 사실 서술처럼 읽히지 않도록 "유추 적용" 이라는 점을 한 구절 명시하면 이후 검토자가 §5.4.1.1 의 실제 스코프와 혼동하지 않는다.
  - 제안: 표 문구를 "§5.4.1.1 의 slack/discord 전용 v2 유예 **패턴을 telegram 에 유추 적용하면** 사전 집행이 되므로 기각" 정도로 한 단어 보강.

## 요약

target 은 R-CC-21 을 명시적으로 번복하지 않는다고 선언하고 실제로 새 Rationale(변경안 B)을 함께 계획하는 등, 이 checker 가 요구하는 "결정을 뒤집을 땐 새 근거를 남겨라" 원칙을 형식적으로는 준수하고 있다. 다만 그 새 근거의 판별 기준("PATCH body 로 온 비밀인가")이 어제 신설된 §5.4.1 의 명시적 기존 기준("토큰 값이 바뀌는가")과 정면으로 다른 잣대를 쓰면서도, 그 문장 자체를 인용·반박하지 않고 우회하는 인접 문서(§5.4.1.1 제목·R-12·§4.1 데이터 모델)만 근거로 삼는다는 점에서 원칙 정합성에 거리감이 있다. 또한 §5.4.1 이 스스로 명시한 "외부 provider 등록 여부" 축을 일관되게 적용하면 telegram 의 `issuedInboundSigning` 은 오히려 bot-token 과 같은 "PATCH 로 안 바뀌는" 편에 속해야 한다는 반론이 성립하는데, target 은 이를 정면으로 다루지 않는다. 이 결함은 치명적이지 않다 — target 의 「기각한 대안」 표가 이미 반론에 대응할 수 있는 논거(회전 주체가 Telegram 자신의 등록 행위)를 갖고 있으므로, 변경안 B 를 작성할 때 그 논거를 §5.4.1 의 "값이 바뀌는가" 문장 및 "직교 축" 서술에 명시적으로 연결하기만 하면 해소된다.

## 위험도

MEDIUM
