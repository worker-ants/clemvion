# Rationale 연속성 검토 — spec-draft-telegram-signing-carveout

## 발견사항

- **[WARNING]** 「값이 바뀌는가」 원칙의 재해석이 spec 본문 자체에는 명시적으로 반영되지 않을 위험
  - target 위치: `plan/in-progress/spec-draft-telegram-signing-carveout.md` D-B / D-B' 및 변경안 A4
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1 (line ~380) — *"차단의 기준은 필드명이 아니라 「토큰 값이 바뀌는가」다"*
  - 상세: target 은 이 문장을 인용하며 *"그 원칙은 '사용자가 rotate 경로를 우회해 자기 비밀을 갈아끼우는가' 를 묻는다"* 로 **주어(주체)를 좁혀 재해석**한다. telegram 의 `issuedInboundSigning` 은 매 `setupChannel()` 호출마다 실제로 값이 바뀌므로, 원문 그대로 ("값이 바뀌는가") 를 문자적으로 적용하면 telegram 도 차단 대상이어야 한다는 결론이 나온다. target 의 재해석("사용자 주도 교체인가")은 R-CC-10 이 원래 열거한 구체적 피해(외부 등록 mismatch·grace 일관성·audit mixing) 로 되짚어 telegram 에는 그 피해들이 없거나 반대 방향임을 보여 **근거 자체는 견고**하지만, 변경안 A4 는 이 재해석을 *"한 줄 추가"* 수준으로만 계획하고 있어 실제 edit 후에도 §5.4.1 본문의 "값이 바뀌는가" 문장이 **문자 그대로는 여전히 telegram 축과 충돌하는 것처럼 읽힐 위험**이 남는다. 이는 "결정을 뒤집으면서 새 Rationale 을 충분히 명시적으로 쓰지 않는" 패턴에 해당할 수 있다(점검관점 3).
  - 제안: A4 편집 시 「값이 바뀌는가」 문장 자체에 *"(PATCH 요청자가 자신의 비밀로 교체하는가 — provider 가 강제하는 재발급은 별도)"* 같은 명시적 qualifier 를 **그 문장 옆에 직접** 붙여, "회전 주체" 축을 별도 문단으로 덧붙이는 것에 그치지 않도록 한다. 그래야 원 문장을 문자 그대로 읽는 향후 독자가 telegram 예외를 "원칙 위반" 으로 오판하지 않는다.

- **[INFO]** `#### 기각한 대안` 신규 3행의 출처가 이 문서 자신의 리뷰 라운드(3R)로, 과거 spec 이력이 아님 — 정당하나 표기 유지 권고
  - target 위치: `plan/in-progress/spec-draft-telegram-signing-carveout.md` 95~104줄, 적용 대상은 `spec/5-system/15-chat-channel.md:767` 기존 `#### 기각한 대안` 소절
  - 과거 결정 출처: 해당 소절 자체(R-CC-21 하위) 및 이번 트래커의 `--spec` 3R (`22_14_27`)
  - 상세: `feedback_rationale_rejected_alternatives_need_history` 교훈상 "기각된 대안" 은 실제 이력이 있어야 하며 지어내면 안 된다. 신규 3행 중 2행은 명시적으로 "(3R INFO)" 를 인용해 실제 이번 트래커의 리뷰 이력에서 나온 근거임을 밝히고 있어 **지어낸 이력이 아니다** — 문제 없음. 다만 이 3행은 "이 turn 이 새로 검토해 기각한 대안"이지 "R-CC-21 작성 당시 이미 기각됐던 대안"이 아니므로, 소절에 이어붙일 때 시제·문맥이 R-CC-21 원문 시점의 기각처럼 오독되지 않게 짧은 도입구(예: "본 carve-out 검토 중 추가로 기각:")를 넣는 편이 안전하다.
  - 제안: A13 적용 시 3행 앞에 위 도입구 한 줄을 넣어 시점을 명확히 한다.

- **[INFO]** telegram 축의 신규 규범이 "회전 주체" 축을 하나 더 만드는 것이므로, `conventions/chat-channel-adapter.md` §2.4 `SetupResult.issuedInboundSigning` 주석과의 3자 정합(코드 주석·컨벤션·본 spec) 재확인 권고
  - target 위치: D-A, D-B'
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md` §2.4 (`issuedInboundSigning` 필드 설명, "setupChannel 직후 1회만 노출되는 inbound-signing 자료의 plaintext (server-issued 한정)") 및 `spec/conventions/secret-store.md` §5.5 ("`inbound-signing` 자원은 provider 별로 두 가지 초기화 경로가 있다 — setupChannel 의 결과(server-issued, Telegram) 와 사용자 입력(provider-issued)")
  - 상세: 실측 결과 두 컨벤션 문서가 이미 telegram=server-issued / slack·discord=provider-issued 축을 문서화하고 있어 target 의 D-A/D-C ("이 carve-out 은 신설이 아니라 명시다") 주장과 **정합한다**. 다만 이 대조축이 "회전 주체가 누구인가"(D-B') 라는 **새 표현**으로 §5.4.1/§5.4.1.1 에 처음 등장하므로, 기존 컨벤션 문서의 "server-issued vs provider-issued" 라는 기존 어휘와 새 "회전 주체" 어휘가 같은 대조를 가리킴을 한 곳에서라도 명시적으로 연결해 두면 이후 검토자가 두 표현을 별개 축으로 오인하는 것을 막는다.
  - 제안: A4 또는 A8 편집 시 "회전 주체 = server-issued(telegram) vs provider-issued(slack/discord)" 대응을 한 문장으로 명시.

## 검증한 사실관계 (참고)

- `spec/5-system/15-chat-channel.md` §5.4.1(:372-382)·§5.4.1.1(:384-407) 실측 결과, target 문서가 인용한 현재 문면(“값이 바뀌는가”, “직교 축”, inboundSigning 표가 slack/discord 로 이미 스코프됨 등)은 정확히 일치했다.
- `spec/2-navigation/2-trigger-list.md:176` 의 "bot token·inbound signing 값은 요청 전후로 동일하고" 블랭킷 서술도 실측 확인됨 — target B1 항목이 좁혀야 할 대상이 실재한다.
- `spec/conventions/secret-store.md` §5.5, `spec/conventions/chat-channel-adapter.md` §2.3/§2.4 는 이미 telegram(server-issued)과 slack/discord(provider-issued)를 별도 초기화 경로로 명시하고 있어, target 이 주장하는 "신설이 아니라 명시" 근거는 실측과 부합한다.
- `spec/5-system/15-chat-channel.md` 의 R-CC-10·R-CC-21 원문을 대조한 결과, target D-C(“R-CC-21 을 번복하지 않는다 — 정본 표 스코프를 산문에 맞춰 좁힌다”)의 전제 — §5.4.1.1 표 자체가 처음부터 "slack/discord 한정" 자원으로 정의돼 있었다는 것 — 은 사실이다. 즉 telegram 을 표에 추가(A8)하는 것은 표의 확장이 아니라 별도 행 신설이며, R-CC-21 이 만든 "PATCH 는 비밀을 쓰지 않는다"는 산문 블랭킷만 원래 표 스코프에 맞춰 좁아지는 구조다.
- target 의 `#### 기각한 대안` 신규 행들은 R-CC-21 이 실제로 기각한 두 대안(“optional 로 두고 무시”·“빈 값 가드만 추가”)과 다른 대안을 다루고 있어, R-CC-21 이 이미 기각한 대안을 다시 채택하는 형태는 아니다.

## 요약

target 은 `R-CC-21`(“PATCH 는 어떤 비밀도 쓰지 않는다”)의 블랭킷 문장을 telegram 의 server-issued signing 축에서 좁히는 결정이지만, `R-CC-10`을 번복하지 않는다고 명시하고, 새 근거(D-A/D-B/D-B')를 R-CC-10 이 열거한 구체적 피해 목록에 되짚어 검증했으며, 기존 `#### 기각한 대안` 소절에 새 H4 를 만들지 않고 이어붙이는 방식으로 앵커 파손도 피했다. 실측 결과 §5.4.1.1 표 자체가 애초부터 slack/discord 로 스코프돼 있었고, `secret-store.md §5.5`·`chat-channel-adapter.md §2.3/2.4` 가 이미 telegram=server-issued 축을 문서화하고 있어 "신설이 아니라 명시"라는 target 의 핵심 주장은 사실과 부합한다. R-CC-21 이 명시적으로 기각한 두 대안(옵션 처리 후 무시 / 빈 값 가드만 추가) 을 재도입하는 정황도 없다. 유일한 잔여 리스크는 「값이 바뀌는가」 원칙의 재해석(주어를 "사용자 주도 교체"로 좁힘)이 실제 spec edit 에서 원문 문장 옆에 명시적으로 반영되지 않고 "한 줄 추가" 수준에 그칠 경우, 문자 그대로 읽는 독자에게 원칙과 telegram 예외가 충돌하는 것처럼 보일 수 있다는 점이다 — 이는 WARNING 수준으로, 구현 반영이 아니라 A4 편집 문구의 정밀도 문제다.

## 위험도

LOW
