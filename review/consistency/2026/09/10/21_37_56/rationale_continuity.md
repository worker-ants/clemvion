# Rationale 연속성 검토 보고서

검토 대상: `spec/5-system` (`--impl-prep`, 초점 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1/R-CC-10/R-CC-21 및 대응 구현 계획 `plan/in-progress/impl-chat-channel-patch-token.md`)

## 발견사항

- **[WARNING] R-CC-21 요약 문장 "PATCH 는 어떤 비밀도 쓰지 않는다"가 같은 문서·자매 spec 이 그은 telegram server-issued 서명 경계보다 넓다**
  - target 위치: `spec/5-system/15-chat-channel.md` `## Rationale` → `### R-CC-21. PATCH 는 비밀을 쓰지 않는다 — 차단이 필드명 층에만 걸려 있었다` (특히 "PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다" 문장), 그리고 `§5.4.1.1` 의 "(2026-09-10 정합화)" 콜아웃
  - 과거 결정 출처: 같은 문서 `§4.1` 데이터 모델("Telegram: server-issued shared secret (setupChannel 의 randomBytes 발급)") + `spec/5-system/15-chat-channel.md §5.4.1.1` 자체 표(제목이 "slack / discord 한정") + 자매 spec `spec/2-navigation/2-trigger-list.md` `## Rationale` → `R-12`("telegram 은 server-issued 라 본 필드 미사용" — PATCH 차단은 slack/discord `inboundSigning` 에만 적용됨을 명시)
  - 상세: R-CC-21 은 §5.4.1(bot token)·§5.4.1.1(slack/discord 한정 `inboundSigningPlaintext`) 두 정본 표를 근거로 우회를 막지만, 그 결론을 한 문장으로 요약하며 "어떤 비밀도 쓰지 않는다"로 두 표보다 넓게 일반화했다. 그런데 실제 코드(`codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts:72-94` 주석 "매 setupChannel 마다 새 inbound-signing 자료 발급 … 재사용하지 않는다" + `codebase/backend/src/modules/triggers/triggers.service.ts:981-993`)는 `setupChannel()` 이 호출될 때마다(= `chatChannel` 이 실린 PATCH 때마다, §5.4.1 표의 해당 행) telegram 용 signing 값을 **새로 발급해 무조건 저장**해야 인바운드 서명 검증이 유지되는 구조다. 이 값은 "PATCH 로 받은 비밀"이 아니라 "어댑터가 내부적으로 발급·저장하는" 값이라 R-CC-21 이 실제로 막으려는 대상(사용자 입력 비밀의 PATCH 유입)과 자원 성격이 다르다. 두 정본 표(§5.4.1, §5.4.1.1)와 자매 spec R-12 는 이 경계를 정확히 좁혀 유지하고 있으나, R-CC-21 의 요약 문장 자체는 이 예외를 명시하지 않아 "표는 좁고 산문은 넓다"는 내부 불일치가 남아 있다. 이 간극은 이번 구현 계획(`plan/in-progress/impl-chat-channel-patch-token.md` "발견한 경계 — R-CC-21 산문이 구현보다 넓다" 절)에서 developer 스스로 인지했고, 자기-반증형 소정정 조건 1(문장을 developer 자신이 쓰지 않았음 — planner PR #1311/`df1962e25`)이 성립하지 않으므로 이번 턴에 spec 을 직접 고치지 않기로 판단한 것은 governance 상 올바르다. 다만 그 판단이 아직 실제 planner 후속 항목으로 등재되지 않은 채(plan 체크리스트에 미체크 항목으로만 존재) 구현이 시작되려는 상태다.
  - 제안: 구현 착수와 별개로, R-CC-21 문장을 "(§5.4.1·§5.4.1.1 두 표가 정의하는 범위 안에서 — telegram 의 server-issued signing 재발급·재저장은 예외)" 식으로 한정하는 planner 후속 PR 을 지금 백로그에 등재할 것. 그 전까지는 구현 PR 설명·커밋 메시지에 "§5.4.1/§5.4.1.1 두 표만 SoT 로 따르며, R-CC-21 요약 문장의 문자 그대로("어떤 비밀도 쓰지 않는다")는 telegram 의 server-issued 서명 발급에는 적용하지 않는다"는 점을 명시해, 이후 리뷰어나 다른 구현자가 그 문장만 보고 telegram 의 무조건적 서명 재저장 로직(`triggers.service.ts:987-993`)을 "위반"으로 오판해 제거하는 회귀(=인바운드 서명 검증 전면 파손)를 막을 것.

- **[INFO] D-1/D-2 설계는 R-CC-21 이 명시적으로 기각한 두 대안을 재도입하지 않음 (정합 확인)**
  - target 위치: `spec/5-system/15-chat-channel.md` R-CC-21 `#### 기각한 대안` 절
  - 과거 결정 출처: 동일 (R-CC-21)
  - 상세: `plan/in-progress/impl-chat-channel-patch-token.md` 의 D-1(`ChatChannelPatchConfigDto` 에 `@IsEmpty()` 로 `botToken`/`inboundSigningPlaintext` 자체를 거부 — 값이 오면 400)과 D-2(`setupChatChannel` 에 "비밀 쓰기 여부" 인자를 추가해 PATCH 경로가 rotate/providerIssued 저장을 건너뜀)는 R-CC-21 이 기각한 두 대안 — "① `botToken` optional 로 두고 값이 오면 무시(침묵 폐기)" · "② `SecretResolver.rotate` 에 빈 값 가드만 추가(증상만 가림)" — 어느 쪽도 재도입하지 않는다. 오히려 R-CC-21 본문이 제시한 "D-1/D-2" 라벨을 그대로 채택해 결정과 설계가 1:1 대응하며, R-CC-10(bot token single-path)도 번복 없이 그대로 존중한다.
  - 제안: 없음 — 현재 설계 유지 권장.

## 요약

target(`spec/5-system/15-chat-channel.md`)에 직전 커밋(`df1962e25`)으로 추가된 R-CC-21 은 R-CC-10 을 번복하지 않고 PATCH 비밀 우회 경로를 올바르게 좁히며, 이를 근거로 한 구현 계획(D-1/D-2)도 R-CC-21 이 명시적으로 기각한 두 대안을 재도입하지 않아 핵심 결정 경로의 연속성은 지켜지고 있다. 다만 R-CC-21 의 요약 문장("PATCH 는 어떤 비밀도 쓰지 않는다")이 같은 spec 의 §4.1·§5.4.1.1 및 자매 spec(`2-trigger-list.md` R-12)이 이미 정확히 그어 둔 경계 — telegram 의 server-issued 서명은 `setupChannel()` 호출(=chatChannel PATCH)마다 새로 발급·저장돼야 한다는 invariant — 보다 넓게 서술되어 있고, 이 간극은 developer 의 plan 도 "발견한 경계"로 스스로 인지했으나 아직 planner 후속 항목으로 정식 등재되지 않았다. 문자 그대로 넓은 문장만 근거로 후속 구현·리뷰가 telegram 의 무조건적 서명 재저장 로직까지 "비밀 쓰기 금지" 대상으로 취급해 제거하면 인바운드 서명 검증이 조용히 깨지는 회귀가 재발할 수 있으므로, 착수와 병행해 그 경계를 planner 트랙으로 명시화할 것을 권고한다.

## 위험도

MEDIUM
