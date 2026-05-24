# 신규 식별자 충돌 검토 보고서

검토 대상: `plan/in-progress/spec-chat-channel-inbound-signing-rename.md`
검토 일시: 2026-05-24

---

## 발견사항

### 1. 엔티티/타입명 충돌 없음 — `inboundSigningRef` 신규 필드

- **[INFO]** `inboundSigningRef` 신규 도입 — 기존 다른 의미 사용 없음
  - target 신규 식별자: `inboundSigningRef?: string` (ChatChannelConfig 인터페이스 필드)
  - 기존 사용처: spec 코퍼스 전체에서 `inboundSigningRef` 는 해당 plan 이전에 존재하지 않았음. 현재 spec 파일 (`spec/conventions/chat-channel-adapter.md §2.3`, `spec/5-system/15-chat-channel.md §4.1`, `spec/4-nodes/7-trigger/providers/slack.md §6`, `spec/4-nodes/7-trigger/providers/discord.md §6`, `spec/4-nodes/7-trigger/providers/telegram.md §6`, `spec/conventions/secret-store.md §1`, `spec/1-data-model.md §2.21.1`) 에서 이미 신규 이름 `inboundSigningRef` 로 일관되게 반영 완료.
  - 상세: plan 이 완료한 spec 갱신 결과, 모든 spec 파일이 단일 슬롯 `inboundSigningRef` 를 사용하며, 기존의 `secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?` 3종은 Changelog 와 Rationale 의 기각 안 기재 외에는 현재 본문에 남아 있지 않아 spec 내 충돌 없음.

---

### 2. 비밀 저장소 URI 충돌 없음 — `inbound-signing` 슬롯

- **[INFO]** `secret://triggers/{id}/inbound-signing` 단일화 — 기존 spec URI 와 충돌 없음
  - target 신규 식별자: `secret://triggers/{triggerId}/inbound-signing` (secret store ref name)
  - 기존 사용처: `spec/conventions/secret-store.md §1` 예시 표에 이미 `inbound-signing` 단일 행으로 업데이트 완료. 이전 3종 (`webhook-secret`, `slack-signing-secret`, `discord-public-key`) 은 Changelog 행에만 역사 기록으로 남아 있으며 본문 예시 표에서는 삭제됨.
  - 상세: `secret://triggers/{id}/notification-signing` (EIA 서명) 과 `secret://triggers/{id}/bot-token` (봇 토큰) 과는 `name` 세그먼트가 다르므로 URI 충돌 없음. `inbound-signing.v2` 접미사 슬롯은 현재 spec 에 정의되지 않았으나 `.v2` 관례 (`bot-token.v2`, `notification-signing.v2`) 와 일관하며 향후 rotation grace 도입 시 예약 가능.

---

### 3. SetupResult 필드명 충돌 없음 — `issuedInboundSigning`

- **[INFO]** `SetupResult.issuedInboundSigning` 신규 도입 — spec 내 충돌 없음
  - target 신규 식별자: `issuedInboundSigning?: string` (SetupResult 인터페이스 필드)
  - 기존 사용처: `spec/conventions/chat-channel-adapter.md §2.4` 에서 이미 `issuedInboundSigning` 으로 rename 완료. Changelog 기록에 이전 이름 `issuedSecretToken` 이 명시되어 있으나 현재 본문에는 잔존하지 않음.
  - 상세: spec 내에서 `issuedSecretToken` 이름이 본문에 남은 곳 없음. 충돌 없음.

---

### 4. [WARNING] 구현 코드와 spec 명 사이의 미해소 불일치 — 후속 impl plan 미연결

- **[WARNING]** codebase 에 구 식별자 (`secretTokenRef`, `issuedSecretToken`, `webhook-secret` ref) 가 현행 spec 과 다른 이름으로 남아 있음
  - target 신규 식별자: spec 에서 `inboundSigningRef` / `inbound-signing` / `issuedInboundSigning` 으로 정의
  - 기존 사용처 (구현 코드):
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-slack-discord-chat-channel-bb4d35/codebase/backend/src/modules/chat-channel/types.ts` — `secretTokenRef?: string` 필드, `issuedSecretToken?: string` 필드, `secret://triggers/{id}/webhook-secret` ref 문자열 (주석)
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-slack-discord-chat-channel-bb4d35/codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts` — `config.secretTokenRef` 접근, `secretTokenRef` 변수/파라미터
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-slack-discord-chat-channel-bb4d35/codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.spec.ts` — `secretTokenRef: 'secret://triggers/t1/webhook-secret'` 픽스처
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-slack-discord-chat-channel-bb4d35/codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` — `issuedSecretToken` 변수명
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-slack-discord-chat-channel-bb4d35/codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts` — `issuedSecretToken` 단언
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-slack-discord-chat-channel-bb4d35/codebase/backend/src/modules/triggers/triggers.service.ts` — `secretTokenRef` 참조
    - `/Volumes/project/private/clemvion/.claude/worktrees/spec-slack-discord-chat-channel-bb4d35/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `botTokenRef/secretTokenRef` 주석
  - 상세: plan §2 에서 명시적으로 "codebase read-only — 후속 impl plan (`chat-channel-telegram-inbound-signing-rename-impl.md`) 에서 rename" 으로 책임을 분리함. 따라서 이것은 plan 의도 범위 내이며 spec-impl 간 단기 불일치로 수용됨. 단, 후속 impl plan 의 존재 여부 및 연결이 plan §4 에 기재되어 있으나 아직 `plan/in-progress/` 에 파일이 생성되지 않았으므로 누락 추적 위험이 있음.
  - 제안: 후속 impl plan 파일 (`plan/in-progress/chat-channel-telegram-inbound-signing-rename-impl.md`) 을 본 spec plan 완료 직후 생성하거나, 현재 plan §4 에 `status: backlog (optional)` 로 기재된 impl plan 을 `status: backlog (required)` 로 승격해 추적 강화. spec-impl 불일치가 시스템 동작에 즉각 영향을 주지 않는 이유는 Slack/Discord 가 구현 미시작이고 Telegram 의 경우 `secretTokenRef` 이름으로 기존 동작이 유지되기 때문임. 그러나 spec 가 `inboundSigningRef` 라고 쓰고 코드가 `secretTokenRef` 를 읽는 상태가 장기화되면 개발자 혼선을 유발한다.

---

### 5. Rationale ID 충돌 없음

- **[INFO]** 신규 Rationale 섹션 ID (`R1`/`R-S-1`/`R-D-1`) 는 각 파일 내 기존 ID 와 충돌 없음
  - target 신규 식별자: Telegram `R1` (기존 R1 내용 업데이트), Slack `R-S-1`, Discord `R-D-1`
  - 기존 사용처: `providers/telegram.md` 의 `R1` 은 기존부터 존재하던 Rationale 섹션이며 이번 plan 에서 내용을 보강하는 방식이므로 ID 재사용이 의도적. `R-S-1`, `R-D-1` 은 각각 Slack/Discord spec 의 다른 Rationale 번호 (`R-S-2`~`R-S-9`, `R-D-2`~`R-D-9`) 와 중복 없음.

---

### 6. 파일 경로 충돌 없음

- **[INFO]** target plan 이 수정 대상으로 나열한 파일 경로가 모두 기존 파일과 일치하며 신규 파일 생성 없음
  - `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md`, `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/4-nodes/7-trigger/providers/slack.md`, `spec/4-nodes/7-trigger/providers/discord.md`, `spec/1-data-model.md` 모두 이미 존재하는 파일. 신규 파일 신설 없으므로 파일 경로 충돌 없음.

---

## 요약

target plan 이 도입하는 신규 식별자 — `inboundSigningRef` (ChatChannelConfig 필드), `inbound-signing` (secret store URI name), `issuedInboundSigning` (SetupResult 필드) — 는 기존 spec 코퍼스 내에서 다른 의미로 사용 중인 동일 이름이 없으며 API endpoint, 이벤트 이름, 환경변수, 파일 경로 측면에서도 충돌이 발견되지 않는다. 모든 spec 파일이 이미 신규 이름으로 일관되게 반영 완료된 상태이다. 유일한 주목 사항은 구현 코드 (`codebase/backend` 의 `types.ts`, `chat-channel-inbound-authenticator.ts`, `telegram.adapter.ts` 등) 가 구 식별자 (`secretTokenRef`, `issuedSecretToken`) 를 사용하고 있으나, 이는 plan §2 에서 명시적으로 후속 impl plan 의 책임으로 위임한 의도적 단기 불일치다. 해당 impl plan 의 생성·추적이 지연되면 혼선이 생길 수 있으므로 조기 생성을 권장한다.

---

## 위험도

LOW
