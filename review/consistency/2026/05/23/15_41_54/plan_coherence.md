# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (`--impl-prep`)
Target: `spec/5-system/15-chat-channel.md`
검토 일시: 2026-05-23

---

## 발견사항

### 1. [INFO] `spec-telegram-chat-channel-ui-polish.md` plan 이 target spec 을 직접 갱신 대상으로 명시하고 있음

- target 위치: `spec/5-system/15-chat-channel.md` 전반 (§4.1, §5.4, §5.5, Rationale R-CC-10/R-CC-11/R-CC-12)
- 관련 plan: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree: `telegram-chat-channel-spec-polish-49c49b`)
- 상세: `spec-telegram-chat-channel-ui-polish.md` 는 결정 2 (bot token single-path + `hasBotToken`), 결정 3 (`uiMapping.visualNode` enum 교체), 결정 4 (Inbound HTTP Contract) 를 각각 `15-chat-channel.md` 에 기록한다고 명시하고 있다. 현재 target spec 을 읽어보면 해당 결정들 (§5.4 `hasBotToken`, §5.4.1 single-path, §5.5 Inbound HTTP Contract, Rationale R-CC-10, R-CC-11, R-CC-12, Rationale ID 컨벤션 절) 이 이미 target spec 에 반영되어 있다. 즉 `spec-telegram-chat-channel-ui-polish.md` plan 의 spec 작업은 이미 완료된 것으로 보인다.
- 제안: `spec-telegram-chat-channel-ui-polish.md` 가 실제로 완료(머지)된 상태라면 `plan/complete/` 로 이동이 필요한지 확인. 이 plan 의 worktree 가 아직 열려 있다면 같은 spec 파일에 접근하는 worktree 경합 가능성을 점검할 것. (본 target 의 구현 착수가 해당 spec PR 머지 후인지 확인 권장.)

---

### 2. [INFO] `chat-channel-secret-store-infra.md` 의 미해결 결정과 target spec 의 `CCH-SE-03` 관계

- target 위치: `spec/5-system/15-chat-channel.md` §3.4 CCH-SE-03, §4.1 `botTokenRef`/`secretTokenRef`
- 관련 plan: `plan/in-progress/chat-channel-secret-store-infra.md` (status: backlog, 인프라 결정 사용자 escalate 대기)
- 상세: target spec 의 CCH-SE-03 는 `SecretResolver` + `secret://` URI scheme 기반의 AES-256-GCM 암호화 저장을 "필수"로 정의하고 있다. 그러나 `chat-channel-secret-store-infra.md` 는 실제 secret store 인프라 선택 (AWS Secrets Manager / HashiCorp Vault / DB pgcrypto) 이 아직 사용자 결정 대기 중인 backlog 상태임을 명시한다. 같은 plan 은 "v1 단계에서 config JSONB 평문 stub 으로 출발" 이라고 기술하여 v1 구현과 spec 요구사항 사이에 의도된 간극이 있음을 인지하고 있다.
- 제안: 이 점은 이미 plan 문서가 명시적으로 "의도된 stub" 으로 처리하고 있어 충돌은 아니다. 다만 구현 착수 시 `CCH-SE-03` 의 full 구현이 아니라 stub 범위임을 developer plan 에 명확히 기재할 것.

---

### 3. [INFO] `chat-channel-visual-ssr-png.md` 의 backlog 결정 항목 #1 (SSR 라이브러리 선정) 이 target spec 과 미충돌

- target 위치: `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-04 (`v2 정책 (SSR PNG)` 항목)
- 관련 plan: `plan/in-progress/chat-channel-visual-ssr-png.md` (status: backlog, 결정 항목 #1 SSR 라이브러리 선정 사용자 escalate 대기)
- 상세: target spec 의 CCH-MP-04 는 v2 SSR PNG 격상을 "별 plan `chat-channel-visual-ssr-png` 추적" 으로 위임하고 있어 구조적으로 분리되어 있다. v1 구현 착수는 MarkdownV2 텍스트 fallback 범위이므로 해당 결정 미해소와 충돌하지 않는다.
- 제안: 추적만 필요. 구현 착수 시 CCH-MP-04 의 v1 범위만 구현하면 된다.

---

### 4. [INFO] `chat-channel-dispatcher-split.md` 의 backlog 조건 (2nd provider 도입) 이 target spec 과 정합

- target 위치: `spec/5-system/15-chat-channel.md` Rationale R8 (NotificationDispatcher 분리 — provider 증가 시점 재검토)
- 관련 plan: `plan/in-progress/chat-channel-dispatcher-split.md` (status: backlog, trigger 조건 미충족)
- 상세: target spec 의 R8 이 v1 현 구조에서 listener dedup 정책 미적용을 명시적으로 허용하고 있고, `chat-channel-dispatcher-split.md` 가 그 조건(2nd provider 도입 시)을 trigger 로 명시하고 있다. 정합.
- 제안: 추적만 필요.

---

### 5. [INFO] `spec-fix-isactive-drawer-toggle.md` 의 미결정이 target 과 동일 spec 파일 (`spec/2-navigation/2-trigger-list.md`) 을 건드리지만 target 범위는 다름

- target 위치: `spec/5-system/15-chat-channel.md` (본 spec)
- 관련 plan: `plan/in-progress/spec-fix-isactive-drawer-toggle.md` (worktree: `trigger-drawer-cleanup-f6a707`) — `spec/2-navigation/2-trigger-list.md §2.3.1` 대상
- 상세: target 인 `15-chat-channel.md` 와 `spec-fix-isactive-drawer-toggle.md` 의 대상 (`2-trigger-list.md §2.3.1`) 은 다른 파일이다. 그러나 `spec-telegram-chat-channel-ui-polish.md` 가 `spec/2-navigation/2-trigger-list.md` §2.3.1 에 9 row 추가 작업을 포함하여, `spec-fix-isactive-drawer-toggle.md` 와의 머지 순서 합의(어느 쪽 먼저 머지되어도 충돌 없음)를 이미 명시하고 있다. target `15-chat-channel.md` 와의 직접 충돌은 없다.
- 제안: `spec-telegram-chat-channel-ui-polish.md` 의 `2-trigger-list.md` 변경이 머지된 후 `spec-fix-isactive-drawer-toggle.md` 진행 시 rebase sweep 필요 — 이미 plan 에 명시되어 있어 별 조치 불필요.

---

### 6. [INFO] `ai-presentation-tools.md` 의 `spec/conventions/conversation-thread.md` 갱신이 target spec 의 cross-ref 와 간접 연관

- target 위치: `spec/5-system/15-chat-channel.md` header의 관련 문서 (Convention Chat Channel Adapter, Conversation Thread 참조)
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`) — `spec/conventions/conversation-thread.md §1.2` 갱신 미완료 (체크박스 미완)
- 상세: `ai-presentation-tools.md` 가 `spec/conventions/conversation-thread.md §1.2` 에 `presentations[]` 필드 추가를 진행 중이다. target spec `15-chat-channel.md` 는 동 convention 파일을 관련 문서로 참조하지만, `15-chat-channel.md` 내에서 `ConversationTurn.presentations` 를 직접 의존하는 요구사항은 보이지 않는다. 간접 연관이며 충돌은 없다.
- 제안: 별도 조치 불필요.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 `plan/in-progress/` 의 다른 plan들과 정합성 면에서 양호하다. `spec-telegram-chat-channel-ui-polish.md` 가 target spec 을 갱신 대상으로 명시하고 있으나, 현재 target spec 을 읽어보면 해당 결정사항들(R-CC-10/R-CC-11/R-CC-12, §5.4, §5.5 등)이 이미 spec 에 반영되어 있어 해당 plan 의 spec 작업이 완료(또는 거의 완료)된 상태로 보인다. 미해결 결정으로는 secret store 인프라 선택(`chat-channel-secret-store-infra.md` backlog)과 SSR 라이브러리 선정(`chat-channel-visual-ssr-png.md` backlog) 이 있지만, 두 결정 모두 v1 구현 착수 범위 밖으로 명확히 위임되어 있어 target spec 의 구현 착수와 충돌하지 않는다. 미해결 결정을 일방적으로 우회하거나 worktree 간 동일 파일 경합 위험은 발견되지 않았다.

## 위험도

LOW
