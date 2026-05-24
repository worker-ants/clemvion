# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-slack-discord-chat-channel.md`
검토 기준: 기존 spec `## Rationale` 의 기각·합의 결정과의 연속성

---

## 발견사항

### [WARNING] Slack §5.3 — modal 단일 step Form 표현이 컨벤션 R4 기각 대안을 조건부 재도입

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` Phase 2 §5.3, D-1 절
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §4 Form 다단계 시퀀스 규약 + Rationale R4` (2026-05-21)
- **상세**:
  R4 는 "v1 은 다단계 텍스트 시퀀스로 통일 — native UI 분기는 v2 옵션" 을 **컨벤션 차원 강제**로 명시했다. 기각 대안: Telegram Mini App, Slack Block Kit 등의 native form UI. 그러나 target 문서 Phase 2 §5.3 은 Slack modal (`views.open` + `view_submission`) 을 "단일 step UI" 로 **v1 draft 안**에 포함하면서 "consistency-check 가 결정 ⚠️" 로 위임한다. D-1 절은 (A) 컨벤션 준수 / (B) 컨벤션 §4 예외 절 추가 / (C) 결정 보류 3종 옵션을 열어두고 잠정적으로 (C) + draft 는 (A) 를 채택한다. "잠정 채택" 방향 자체는 컨벤션을 따르지만, spec draft 에 modal 을 1차 안으로 기술한 뒤 checker 결과로 번복 가능하도록 열어두는 구조가 Rationale R4 기각 의도와 거리가 있다.
  - Discord §5.3 도 동일 패턴 (Modal TEXT_INPUT을 v1 안에 언급, 동일 ⚠️ 위임).
- **제안**:
  Phase 2/3 spec draft 본문의 §5.3 은 처음부터 다단계 텍스트 시퀀스만 서술하고 modal 은 명시적으로 "v2 옵션 — Rationale R4 에 의해 v1 범위 외" 로 표기. Rationale 절에 "Slack modal 은 native 표현이지만 Convention R4 에 따라 v2 로 분리" 문장을 포함. consistency-check 에 "modal v1 채택 가능 여부" 를 묻는 것이 아니라 "다단계 시퀀스 구현이 컨벤션을 준수하는지" 로 검토 범위를 좁혀야 한다.

---

### [WARNING] Discord D-3 — AI Multi Turn 자유 텍스트 미지원이 CCH-MP-01 요구사항과의 정합 근거 미비

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` Phase 3 §5.1 + D-3 절
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md §3.3 CCH-MP-01` + `R3 v1 single-user DM 만 지원` (2026-05-21)
- **상세**:
  CCH-MP-01 은 "AI Multi Turn 의 `execution.ai_message` → 채널 텍스트 메시지 변환" 을 **필수** 요구사항으로 정의한다. Discord v1 은 Interactions webhook only — 일반 DM 메시지(`MESSAGE_CREATE`)를 받지 못해 AI Multi Turn 에서 사용자의 자유 텍스트 reply 가 불가능하다. 이 사실은 D-3 에 솔직하게 기술되어 있으나, CCH-MP-01 예외 근거를 spec Rationale 로 명문화하지 않고 "Rationale 에 명시" 계획만 남긴다. CCH-MP-01 은 R3 와 같이 provider-agnostic 필수 요구사항으로 설계되었고, 기각된 대안(v1 Gateway 도입)은 단순 v1 범위 초과 이유로 제외했다. Discord spec 이 CCH-MP-01 적용 예외임을 선언하려면 15-chat-channel.md Rationale 에 "Discord v1 은 Interactions webhook only 로 CCH-MP-01 의 자유 텍스트 input 부분을 v2 Gateway plan 으로 유예" 를 명시해야 한다. 현재 target 문서는 그 Rationale 갱신을 draft 단계로 미루고 있다.
- **제안**:
  Phase 3 §5.1 의 Discord AI Multi Turn 설명에서 "자유 텍스트 채팅 미지원" 이 CCH-MP-01 의 무엇을 충족하고 무엇을 유예하는지 명시. `spec/5-system/15-chat-channel.md` Rationale 에 "Discord v1 CCH-MP-01 부분 유예 (text_message input channel — v2 Gateway plan)" 항 추가를 Phase 4 또는 Phase 2 산출물로 포함할 것. Phase 6 의 commit 전에 갱신이 이루어져야 Rationale 연속성이 확보된다.

---

### [INFO] 새 트리거 유형 미신설 원칙 (R1) — 명시적 확인 필요

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` §0 배경 및 §2
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md Rationale R1 새 트리거 유형 신설하지 않음` (2026-05-21)
- **상세**:
  R1 은 "Webhook 트리거 `config.chatChannel` 한 옵션으로 동작, Chat Channel Trigger 신규 노드 신설 기각" 을 명시했다. target 문서는 이 원칙을 따르고 있으나 (§0 에서 Telegram 과 동일 패턴 언급, spec 신설 위치도 `providers/` 디렉토리로 일치), Slack/Discord spec draft 에서 `setupChannel` 이 Events API subscription 또는 slash command bulk overwrite 방식을 쓰는 점이 R1 채택 결정과 근본적으로 부합함을 Rationale 에서 한 번 더 확인하는 것이 좋다. 충돌은 없으나 언급이 없다.
- **제안**:
  Slack/Discord spec 의 Rationale 절에 "Webhook 트리거 `config.chatChannel.provider: 'slack'/'discord'` 옵션으로 통합 — R1 채택 결정 준수, 별 트리거 유형 신설 없음" 한 문장 추가 권장 (INFO 수준).

---

### [INFO] HTTP round-trip 회피 원칙 (R2) — Interactions webhook ack 3초 시한 처리 경로 확인

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` Phase 2 §5.2, Phase 3 §3
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md Rationale R2 Chat Channel 을 EIA 의 consumer 로만 위치` (2026-05-21) + `CCH-AD-06`
- **상세**:
  R2 는 "어댑터도 EIA HTTP endpoint 를 호출하는 것은 의미 없는 round-trip + 토큰 사이클 부담으로 기각" 을 확립했다. Slack / Discord 는 Interactions (button tap / modal submit) 에 대해 **3초 이내 ack** 를 provider API 에 직접 반환해야 한다 (Slack interactivity ack, Discord deferred interaction type=5). target 문서가 이 ack 를 CCH-AD-06 의 in-process `InteractionService.interact()` 직접 호출 경로 안에서 처리하는지, 아니면 별도 HTTP 경로를 거치는지 명시가 없다. ack 가 in-process 경로 전에 provider 에게 먼저 반환되는 패턴이라면 R2 와 정합하지만, 그 흐름이 spec draft 에 설명되어야 한다.
- **제안**:
  Slack §6 / Discord §6 보안 절 또는 §3 호출 매핑 절에 "3초 ack → provider 선반환 후 in-process `InteractionService.interact()` 비동기 처리" 흐름을 명시하고, 이것이 R2 / CCH-AD-06 의 round-trip 회피 원칙과 어떻게 정합하는지 한 문장 기술 권장.

---

### [INFO] Group/채널 차단 원칙 (R3 / CCH-CV-05) — Slack 채널 메시지, Discord 길드 채널 처리 명시

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` Phase 2 §4 + Phase 3 §4
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md Rationale R3 v1 single-user DM 만 지원` + `CCH-CV-05` (2026-05-21) + `telegram.md Rationale R5`
- **상세**:
  R3 와 telegram.md R5 는 "v1 1:1 DM 만, group chat 은 명시적 거부" 를 확립했다. target 문서 Phase 2 §4 에 "DM 외 채널 (`channel` / `group` / `mpim`) → `null` 반환 + `groupChatRefusal` 안내", Phase 3 §4 에 "DM 외 채널 (`channel.type !== 1`) → `null` + `groupChatRefusal` 안내" 가 명시되어 있어 원칙 준수 확인됨. 단, CCH-CV-05 의 "parseUpdate 는 side-effect free — 안내 발송 책임은 호출자(HooksService)" 규약을 Slack/Discord spec Rationale 에서 명시적으로 재확인하는 것이 좋다. 충돌은 없다.
- **제안**:
  INFO 수준 보완. Slack/Discord spec §4 또는 §6 에 "그룹 차단은 CCH-CV-05 / R3 준수 — parseUpdate 는 null 반환만, 안내 발송은 HooksService" 주석 한 줄 추가 권장.

---

## 요약

target 문서(`plan/in-progress/spec-slack-discord-chat-channel.md`)는 전반적으로 기존 Rationale 결정과 정합한다. 새 트리거 유형 미신설(R1), EIA in-process 소비자 구조(R2), v1 DM 전용 group 차단(R3), 6함수 인터페이스 준수 계획이 모두 유지된다. 그러나 두 가지 WARNING 이 존재한다. 첫째, Slack/Discord §5.3 의 modal Form 표현이 컨벤션 R4 에서 "v1 기각" 된 native form UI 대안과 동일한 패턴이며, draft 안에 modal 을 포함한 채 checker 결과로 번복 가능하도록 열어두는 구조는 R4 의 컨벤션 차원 강제 취지와 충돌한다. spec draft 자체는 (A) 다단계 시퀀스로 작성한다고 명시하고 있으므로 spec 본문 작성 시 이 방향이 실제 반영되는지 확인이 필요하다. 둘째, Discord v1 이 Interactions webhook only 로 AI Multi Turn 자유 텍스트 reply 를 지원하지 않는 점은 CCH-MP-01 (필수 요구사항) 과 부분 충돌하며, 이 유예의 Rationale 을 `spec/5-system/15-chat-channel.md` 에 명시하는 작업이 spec draft commit 전에 이루어져야 한다. 나머지 발견사항(INFO)은 연속성 보완 권장 수준이다.

---

## 위험도

MEDIUM
