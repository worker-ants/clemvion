# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`  
검토 대상: `spec/4-nodes/7-trigger/providers/slack.md`  
검토 기준 Rationale 출처: `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/4-nodes/7-trigger/providers/_overview.md`

---

## 발견사항

### 1. [INFO] R-S-8: `202 Accepted` 예외 처리 — 시스템 spec 표와의 정합 확인됨, Rationale 보강 권고

- **target 위치**: `slack.md §6` (Slack 특이 예외 2번) + `Rationale R-S-8`
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` R-CC-12 및 §5.5.1 Provider-specific 응답 예외 정책
- **상세**: `slack.md §6` 는 Interactivity 3초 ack 에 `200 OK` 를 사용하고 R-S-8 에서 근거를 기술한다. `chat-channel.md §5.5` 의 케이스 매트릭스(line 320)가 이미 "Slack Interactivity ack → 200 OK (§5.5.1)" 로 등재되어 있고, §5.5.1 의 2조건(provider 가 특정 응답 형식만 success 인정 + provider spec 본문에 명시)도 충족한다. 따라서 기각된 대안 재도입이나 invariant 위반은 없다.

  다만 R-S-8 본문 마지막 문장("Spec Chat Channel §5.5 의 후속 갱신 (case 표에 … 행 추가) 은 본 plan §Phase 4 의 시스템 spec 점검 대상")은 이미 `chat-channel.md §5.5` 케이스 매트릭스에 반영되어 있는데도 "후속 갱신 대상"으로 남아 있어 완료 여부를 오해하게 한다.

- **제안**: R-S-8 의 마지막 문장을 "갱신 완료 — `chat-channel.md §5.5` 케이스 매트릭스에 반영됨" 으로 수정.

---

### 2. [INFO] R-S-1 채택 결정과 Convention changelog 간 시제 정합성

- **target 위치**: `slack.md Rationale R-S-1` 대안 목록 중 3번 "(기각) `webhookSecretRef` (Telegram 만 generic 이름) + Slack/Discord 별 필드 — 본 plan 시작 직전 상태"
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md` Changelog 2026-05-24 두 번째 항 — 3 필드 (`secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?`) 를 단일 `inboundSigningRef?` 로 통합
- **상세**: 컨벤션 changelog 에서 "본 plan 시작 직전 상태"는 `secretTokenRef?` (Telegram only generic) 였고, 그 다음 상태가 3-필드 안(`signingSecretRef?` / `publicKeyRef?` 신설)이었다. R-S-1 기각 3번의 기술이 "본 plan 시작 직전 상태"를 정확히 가리키는지 모호하다 — Telegram 의 `secretTokenRef` 가 아니라 `webhookSecretRef` 라는 명칭은 changelog 에 등장하지 않는다.

  이는 기각된 대안의 재도입이나 invariant 위반은 아니지만, 과거 결정의 이력이 R-S-1 기각 3번의 표현과 정확히 대응하지 않아 추후 검토자에게 혼동을 줄 수 있다.

- **제안**: R-S-1 기각 3번 표현을 "본 plan 시작 직전 상태" 대신 "spec-slack-discord-chat-channel plan 진입 직전 상태 (`secretTokenRef?` 만 존재)" 로 명확화하거나, changelog 의 1차 갱신(5-24 첫 번째 항)의 용어와 맞춤.

---

### 3. [INFO] Convention R4 (Form 다단계 시퀀스 컨벤션 차원 강제) 와의 정합 — 명시적 참조 확인

- **target 위치**: `slack.md §5.3` 및 `Rationale R-S-6`
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md` Rationale R4 "Form 다단계 시퀀스를 컨벤션 차원에서 강제 (2026-05-21)"
- **상세**: R-S-6 기각 2번은 "컨벤션 §4 위반" 을 명시하고 있으며 Convention R4 와 정합한다. 채택 결정(v1 다단계 텍스트 시퀀스)도 Convention §4 를 따른다. 기각된 대안의 재도입 없음.

  확인 사항: R-S-6 기각 2번("v1 부터 `views.open` modal native")은 Convention R4 에서 명시적으로 거부된 "native form UI 분기"를 v1 에 도입하는 안으로, slack.md 가 이를 올바르게 기각한다.

- **제안**: 없음 (정합).

---

### 4. [INFO] Chat Channel R3 (v1 single-user DM 만 지원) 원칙 — group chat 거부 명시

- **target 위치**: `slack.md §4.1` 및 `Rationale R-S-4`
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` R3 "v1 single-user DM 만 지원 (2026-05-21)" + CCH-CV-05
- **상세**: slack.md §4.1 에서 `channel_type ∈ ('channel', 'group', 'mpim')` 은 `null` 반환(groupChatRefusal), `app_mention` 도 DM 외 채널은 거부. R-S-4 가 CCH-CV-05 를 명시 인용하여 정합한다.

- **제안**: 없음 (정합).

---

### 5. [INFO] Chat Channel R-CC-12 (`202 Accepted` 고정) — `parseUpdate` 의 `null` 반환 케이스 응답 코드

- **target 위치**: `slack.md §6` HTTP 응답 코드 정책 ("Spec Chat Channel §5.5 Inbound HTTP Contract 가 단일 진실. 본 파일은 케이스 매트릭스 사본을 두지 않음")
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` R-CC-12 + §5.5 케이스 매트릭스
- **상세**: slack.md §6 가 케이스 매트릭스 사본을 두지 않고 §5.5 를 SoT 로 위임하는 것은 drift 회피 원칙과 완전히 정합한다. §5.5 케이스 매트릭스 자체가 Slack 의 두 200 예외(URL Verification + Interactivity ack)를 이미 포함한다.

- **제안**: 없음 (정합).

---

## 요약

`spec/4-nodes/7-trigger/providers/slack.md` 는 기존 Rationale 에서 명시적으로 기각·폐기된 대안을 재도입하거나 합의된 invariant 를 위반하는 항목이 발견되지 않는다. 핵심 설계 원칙(Convention §4 Form 다단계 시퀀스 강제 / Chat Channel R3 v1 DM 한정 / R-CC-12 `202 Accepted` 고정 + provider-specific `200` 예외 허용 조건 / R-CC-10 bot token single-path rotate / `inboundSigningRef` 단일 슬롯 통합)에 대해 모두 명시적 Rationale 참조 또는 자기 완결 근거를 포함한다. 발견된 3건의 INFO 항목은 R-S-8 의 "후속 갱신 대상" 표현이 이미 완료된 상태를 미완으로 오인하게 하는 설명 상의 불일치와, R-S-1 기각 3번의 이력 표현 모호성, 그리고 Convention R4 정합 재확인이다. 모두 결정 번복이나 invariant 충돌이 아닌 문서 표현 보강 수준이다.

## 위험도

NONE
