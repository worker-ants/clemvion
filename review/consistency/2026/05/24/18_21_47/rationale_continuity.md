# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/trigger-create-multi-provider-ui.md`
검토 모드: `--impl-prep` (구현 착수 전 검토)
범위 spec: `spec/5-system/15-chat-channel.md`, `spec/2-navigation/2-trigger-list.md`, `spec/4-nodes/7-trigger/providers/slack.md`, `spec/4-nodes/7-trigger/providers/discord.md`

---

## 발견사항

### [INFO] R-S-1 inboundSigning 단일 슬롯 — plan 과 spec 정합 확인 (이상 없음)

- **target 위치**: plan §Commit 1, Commit 2 (`inboundSigning` 단일 필드 통일 설명)
- **과거 결정 출처**: `spec/4-nodes/7-trigger/providers/slack.md` Rationale R-S-1 (2026-05-24) + `spec/4-nodes/7-trigger/providers/discord.md` Rationale R-D-1 (2026-05-24)
- **상세**: plan 의 Commit 2 payload 설명 ("모두 `inboundSigning` 단일 필드로 통일") 과 Commit 1 의 service 단 분기 채택 권장 (b) 는 R-S-1 의 결정 — "단일 슬롯 공유, provider 별 의미·검증 알고리즘은 backend 분기" — 과 완전히 정합한다. `SetupResult.issuedInboundSigning` 을 server-issued 한정으로 두고 slack/discord 는 plaintext 직접 `SecretResolver.store` 하는 흐름도 R-S-1 §3.1·§6 의 normative 기술과 일치한다.
- **제안**: 이상 없음. 추가 조치 불필요.

---

### [INFO] R-CC-13 Discord v1 한계 — plan 의 반영 충분하나 GUI 흐름 callout 강도 점검 권고

- **target 위치**: plan §리스크 / 완화 표 — "Discord 의 v1 한계 (R-CC-13) — 자유 텍스트 DM 미수신" 행 + Commit 4 Discord 가이드 callout 안내
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` Rationale R-CC-13 (2026-05-24) — "Discord v1 은 CCH-MP-01 inbound 부분 유예, 자연 대화 미지원"
- **상세**: plan 은 리스크 행에서 R-CC-13 을 명시적으로 참조하고, user-guide callout 으로 한계를 명시한다고 기술하고 있다. 이는 R-CC-13 이 요구한 "provider 한계는 provider spec Rationale + 사용자 안내" 접근과 정합하며, 시스템 spec CCH-MP-01 본문을 변경하지 않는 방침도 동일하다. 다만 plan 의 "본 plan 의 GUI 는 한계를 반영하지 않음 (provider 선택 후 사용자가 의식적으로 결정)" 표현이 다소 약하다 — R-CC-13 의 의도는 Discord v1 을 선택한 사용자에게 "자유 텍스트 reply 불가, slash command 또는 modal 만 가능" 이 Commit 4 user-guide callout 에서 충분히 전달되어야 한다는 점이다.
- **제안**: 이상 없음 (규약 위반 없음). Commit 4 user-guide Discord 페이지 callout 에 "(b) Modal 'Reply' 버튼 기반 입력만 가능, 일반 DM 텍스트 미수신" 수준의 구체적 안내를 포함하여 R-CC-13 의 "부분 유예 normative 기술" 의도를 충족하도록 구현 단계에서 점검 권고.

---

### [INFO] R8 NotificationDispatcher 분리 trigger 조건 — plan 의 서술 정합 확인

- **target 위치**: plan §의식적 boundary 마지막 항 — "`chat-channel-dispatcher-split` plan 진입 검토" 기술
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` Rationale R8 (2026-05-22) — "Chat Channel provider 가 2개 이상으로 늘어남 OR 새 in-process subscriber 유형 추가 시 분리 권장"
- **상세**: plan 은 "본 plan 완료 시점에 사용자 GUI 관점에서 실질 충족 (이미 backend 적으로는 PR #300 시점 충족)" 이라고 서술하며 별 plan 으로의 진입 결정 권고를 표명한다. R8 은 provider ≥ 2 를 "권장" trigger 조건으로 정의했고 강제 의무가 아니다. plan 은 이 조건이 이미 충족됐음을 인지하고 dispatcher-split plan 을 후속 plan 목록에 명시하고 있어 R8 의 의도에 부합한다. 단, plan 본문에서 "trigger 조건 미충족 상태 (R8 표현)" 와 "본 plan 완료 시점 충족" 의 전환 사실을 commit 1 착수 전 `chat-channel-dispatcher-split` plan stub 상태를 확인·갱신하는 것이 바람직하다.
- **제안**: 이상 없음 (규약 위반 없음). Commit 1 착수 전 `plan/in-progress/chat-channel-dispatcher-split.md` (stub 상태) 의 trigger 조건 항목을 "GUI 관점 충족" 으로 갱신하거나, 본 plan 의 후속 plan 항목에 해당 stub 경로를 명시하면 추적 일관성이 높아진다.

---

### [WARNING] R-CC-10 Bot Token single-path — slack/discord inboundSigning rotate 정책 부재가 결정 번복인지 여부

- **target 위치**: plan §의식적 boundary — "slack/discord 의 `inboundSigning` rotate UI 는 별 spec 필요 → 본 plan 범위 밖" 및 plan §Commit 2 "의식적 boundary" — "detail drawer edit 모드 확장 없음. slack/discord 의 inboundSigning rotate API 가 필요하다면 별 spec 작업"
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` Rationale R-CC-10 (2026-05-23) — "Bot Token 변경 single-path (rotate API only)". `spec/5-system/15-chat-channel.md §5.4.1` — single-path 정책 표 (최초 생성 시만 plaintext 입력 허용, 이후 rotate API 전용)
- **상세**: R-CC-10 과 §5.4.1 은 botToken 에 대한 single-path 를 명시적으로 결정했다. inboundSigning 에 대한 동등한 single-path 정책은 spec 상 명시적으로 결정되지 않은 상태이며, plan 은 이를 "별 spec 필요" 로 미뤘다. 이 자체는 R-CC-10 을 번복하는 것이 아니라 (botToken single-path 는 그대로), inboundSigning 의 rotate 경로가 v1 미정의 상태임을 인정하는 것이다.

  그러나 plan §Commit 1 의 "slack/discord → 사용자 입력 plaintext 를 `SecretResolver.store(inboundSigningRef, plaintext)` 로 저장" 기술은 생성 시 plaintext 직접 입력을 명시적으로 허용한다. 이 패턴 자체는 §5.4.1 의 "최초 트리거 생성 시 plaintext 입력 → store 후 ref 로 교체" 와 정합한다. 

  다만 주의해야 할 지점: §5.4.1 의 테이블은 "토큰 변경 (rotation) 은 항상 rotate API 만" 이라고 명시하고, PATCH body 의 `botTokenRef` 변경은 400 으로 차단한다. inboundSigning 에 대한 같은 수준의 차단 정책이 spec 에 없다는 사실은, Commit 1 의 PATCH 경로에서 `inboundSigning` 을 재입력할 수 있는 경로가 의도치 않게 열릴 위험이 있다. R-CC-10 의 근거 (외부 provider 측 등록 vs server-side 보유) 를 inboundSigning 에 적용하면:

  - **Telegram**: server-issued — rotate 시 `setupChannel` 재호출 필요 (provider 측 연동 있음)
  - **Slack**: provider-issued signing secret — Slack 앱 manifest 와의 동기화 문제 없음 (Slack 이 secret 를 보유하고 우리가 복사하는 구조). PATCH 직접 교체가 즉각 수신 단절을 유발하지 않는다.
  - **Discord**: provider-issued public key — 마찬가지로 Discord Developer Portal 과의 동기화 불필요.

  따라서 slack/discord 의 `inboundSigning` 은 R-CC-10 의 "외부 provider 측 등록 토큰" 과 성격이 다르며, PATCH 를 허용할 근거가 존재한다. 그러나 현재 spec 에는 이 허용 여부가 명시되지 않았다. plan 이 이 결정을 구현 단계에서 암묵적으로 해소하려는 구조이다.
- **제안**: 구현 착수 전 다음 중 하나를 선택하고 spec 또는 plan 에 명시할 것:
  1. **PATCH 허용 (권장)**: Commit 1 에서 `inboundSigning` 에 대한 PATCH 허용을 명시적으로 결정하고, plan Rationale 에 "R-CC-10 은 botToken (external provider 등록 token) 한정, slack/discord inboundSigning 은 provider-issued but server-stored 로 PATCH 허용" 근거를 기록. 이후 spec `15-chat-channel.md §5.4.1` 에 `inboundSigning` 에 대한 single-path 정책 부재를 명시적으로 확인하는 주석 추가 (spec 변경이 아닌 본문 표에 비고 1줄 추가 수준).
  2. **명시적 spec 갱신 위임**: Commit 1 착수 전 project-planner 가 `15-chat-channel.md §5.4.1` 에 "inboundSigning 의 PATCH 허용 여부" 를 결정하는 spec 변경을 선행.
  
  현재 상태에서 Commit 1 을 진행하면 구현이 암묵적으로 결정을 내리게 되므로 **WARNING** 등급 부여. 명시적 번복 없이 구현이 정책을 앞지르는 구조.

---

## 요약

Rationale 연속성 관점에서 본 plan 은 전반적으로 기존 spec 결정을 잘 추적하고 있다. R-S-1 (inboundSigningRef 단일 슬롯), R-CC-13 (Discord v1 CCH-MP-01 부분 유예), R8 (NotificationDispatcher 분리 trigger 조건) 모두 plan 이 해당 결정을 인지·참조하고 있으며 결정을 번복하거나 기각된 대안을 재도입하는 사례는 발견되지 않는다. 유일한 주의 사항은 R-CC-10 의 Bot Token single-path 정책이 `inboundSigning` 에도 적용될 것인지 여부를 spec 이 명시하지 않은 상태에서, plan 이 구현 단계에서 암묵적으로 PATCH 허용 여부를 결정하게 되는 구조이다. slack/discord 의 `inboundSigning` 자원 성격이 R-CC-10 의 근거 (외부 provider 측 등록 토큰) 와 다르므로 PATCH 허용이 정당하나, 그 결정이 plan Rationale 또는 spec 에 기록되지 않은 점이 번복 근거 부재 WARNING 에 해당한다.

## 위험도

LOW

STATUS: OK
