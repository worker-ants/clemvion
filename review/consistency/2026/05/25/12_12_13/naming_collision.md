# 신규 식별자 충돌 검토 — `spec/5-system/15-chat-channel.md` (chat-channel-error-notify)

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/5-system/15-chat-channel.md` + 연동 문서
기준 코퍼스: `spec/`, `plan/in-progress/`, `spec/conventions/`

---

## 발견사항

### [WARNING] `languageHints.executionFailed` 단일 키 — 구현과 신규 6키 spec 충돌

- **target 신규 식별자**: `languageHints` 객체 내 6개 키 — `executionFailedThirdParty4xx` / `executionFailedThirdParty5xx` / `executionFailedThirdParty` / `executionFailedTimeout` / `executionFailedRateLimit` / `executionFailedInternal`
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:49` — `config.languageHints?.executionFailed` (단일 키)
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts:255` — `config.languageHints?.executionFailed` (단일 키)
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts:240` — `config.languageHints?.executionFailed` (단일 키)
- **상세**: 기존 세 provider renderer 가 `languageHints.executionFailed` 단일 키를 조회하고 있다. 신규 spec 은 이를 6개 분류 키로 교체한다. spec 자체는 `chat-channel-adapter.md` Changelog 에 "breaking change: 기존 renderNode(execution.failed) 구현 갱신 의무" 로 명시하고 있으나, 충돌하는 기존 단일 키 `executionFailed` 가 이미 구현에 존재하며 신규 spec 이 도입하는 키 집합과 의미가 겹친다.
- **제안**: 구현 PR 에서 세 renderer 파일의 `executionFailed` 단일 키 조회를 `classifyExecutionFailure(event)` 결과 기반 6키 조회로 교체해야 한다. spec 의 `§4.1 languageHints` JSONC 예시에 기존 단일 키 `executionFailed` 가 잔재하지 않는지도 확인 필요 (현재 spec 본문에는 없음 — 구현 파일에만 존재).

---

### [WARNING] `R5` Rationale ID — `spec/conventions/chat-channel-adapter.md` 와 `spec/4-nodes/7-trigger/providers/telegram.md` 간 중복

- **target 신규 식별자**: `spec/conventions/chat-channel-adapter.md` 의 `### R5. Execution Failed 분류 helper 를 Convention 에 두는 이유 (2026-05-25)`
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/spec/4-nodes/7-trigger/providers/telegram.md:228` — `### R5. group chat 무한 차단 vs 사용자 선택 (2026-05-21)` (이미 존재하는 R5, 다른 의미)
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/spec/5-system/15-chat-channel.md:512` — `### R5. provider 디렉토리 위치 — 4-nodes/7-trigger/providers/ (2026-05-21)` (이미 존재하는 R5, 또 다른 의미)
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/spec/5-system/14-external-interaction-api.md:833` — `### R5. 외부 WebSocket 채널 신설 — 보류 (2026-05-21)` (이미 존재하는 R5, 또 다른 의미)
- **상세**: Rationale ID `R5` 가 이미 세 개의 다른 spec 파일에서 서로 다른 의미로 사용 중이다. 각 파일 안에서의 ID 충돌은 아니지만, cross-link 시 `[Convention §R5]` 참조가 어느 파일의 R5 를 가리키는지 문맥 없이는 불명확하다. `spec/5-system/15-chat-channel.md §3.1 Rationale ID 컨벤션` 은 신규 Chat Channel 로컬 Rationale 에 `R-CC-N` prefix 사용을 명시했음에도 불구하고 `chat-channel-adapter.md` 의 신규 Rationale 에는 이 prefix 없이 `R5` 를 부여했다.
- **제안**: `chat-channel-adapter.md` 의 신규 Rationale 을 `R5` 대신 `R-CC-A5` 또는 `R-CCA-5` 와 같이 파일 scope 를 나타내는 prefix 를 부여하거나, 컨벤션 파일 고유 prefix (`R-CONV-5` 등) 를 사용하는 것을 권장. 단, 각 파일 내부에서의 기계적 ID 중복은 아니므로 cross-file link 없는 경우 즉각적 혼동은 낮다.

---

### [INFO] `languageLocale` 신규 config 키 — `ChatChannelConfig` 타입 정의 누락

- **target 신규 식별자**: `config.chatChannel.languageLocale` — `"ko" | "en"` enum 필드
- **기존 사용처**: 해당 없음 (충돌 없음)
- **상세**: `spec/5-system/15-chat-channel.md §4.1` 의 JSONC 예시와 `§3.5 CCH-ERR-01`, `§4.1.1` 에 `languageLocale` 이 명시되어 있다. `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` TypeScript 인터페이스에는 `languageLocale?: "ko" | "en"` 필드가 아직 포함되어 있지 않다 — `languageHints?: Record<string, string>` 만 존재. Convention §3.1 의 helper 가 locale 분기 책임을 어댑터에 위임할 때 어댑터가 `config.chatChannel.languageLocale` 에 접근하므로, 타입 정의와 실제 JSONC schema 간 불일치가 구현 시 혼선을 일으킬 수 있다.
- **제안**: `chat-channel-adapter.md §2.3 ChatChannelConfig` 에 `languageLocale?: "ko" | "en"` 필드를 추가해 spec 본문과 Convention 타입 정의를 동기화. Changelog 한 줄 추가. 구현 PR 의 DTO 검증 대상이기도 하므로 누락 시 타입 안전성 gap 이 생긴다.

---

### [INFO] `UNKNOWN_PLACEHOLDER` 에러 코드 — `spec/5-system/3-error-handling.md` 미등재

- **target 신규 식별자**: `code='UNKNOWN_PLACEHOLDER'` — `languageHints` 의 미허용 placeholder 발견 시 반환하는 400 에러 코드
- **기존 사용처**: 해당 없음 (기존에 사용되지 않음)
- **상세**: `spec/5-system/3-error-handling.md §1.3` 의 유효성 검증 에러 목록에 `UNKNOWN_PLACEHOLDER` 가 등재되어 있지 않다. `VALIDATION_ERROR` 의 하위 `details.code` 로 운영되는 방식이라면 별도 등재가 불필요하지만, `§1.3` 의 목록이 "모든 유효성 검증 코드" 를 망라한다는 정책이 있다면 등재 gap 이 된다.
- **제안**: 본 코드가 `VALIDATION_ERROR` 의 `details.code` 로만 사용되고 단독 `error.code` 가 아님을 spec 본문에서 명시하거나, `3-error-handling.md §1.3` 에 `UNKNOWN_PLACEHOLDER` 를 `VALIDATION_ERROR` 의 하위 세부 코드로 각주 추가. 현재 spec 기술(`400 VALIDATION_ERROR ... code='UNKNOWN_PLACEHOLDER'`)은 중첩 코드 구조를 암시하므로 혼동 소지 있음.

---

### [INFO] `executionCancelled` — spec 미정의 languageHints 키가 구현에 이미 사용 중

- **target 신규 식별자**: 6개 `executionFailed*` 키
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:54` — `config.languageHints?.executionCancelled`
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts:54` — `config.languageHints?.executionCancelled`
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts:44` — `config.languageHints?.executionCancelled`
- **상세**: 본 target spec 이 도입하는 식별자는 아니지만, 구현 코드에 `executionCancelled` 키가 이미 존재하는데 `spec/5-system/15-chat-channel.md §4.1` 의 `languageHints` JSONC 정의에 해당 키가 등재되어 있지 않다. 이는 spec-impl drift 의 기존 상태이며, 신규 6키와 함께 `languageHints` 를 확장하는 이번 PR 에서 `executionCancelled` 도 spec 에 등재 또는 구현에서 제거하는 정리 기회다.
- **제안**: 이번 PR scope 에서 `executionCancelled` 도 `§4.1 languageHints` 에 추가하거나, 구현 코드의 해당 키 조회가 의도적(구현 선행)임을 plan 에 명시. 직접적인 신규 식별자 충돌은 아니지만 `languageHints` 스키마의 불완전한 문서화를 보완하는 시점으로 적합.

---

## 요약

`spec/5-system/15-chat-channel.md` (및 연동 `spec/conventions/chat-channel-adapter.md`) 가 도입하는 신규 식별자는 다른 영역의 기존 식별자와 의미론적으로 충돌하는 케이스는 없다. 다만 두 가지 운영상 주의가 필요하다. 첫째, 기존 구현 코드(세 provider renderer)가 `languageHints.executionFailed` 단일 키를 이미 사용 중이어서 spec 의 6키 분류 체계와 불일치한다 — 구현 PR 에서 반드시 함께 교체해야 하는 breaking change 이며 spec 의 Changelog 도 이를 명시하고 있다. 둘째, `chat-channel-adapter.md` 에 신규 Rationale `R5` 를 도입했는데, 동일 ID 가 이미 `telegram.md`, `15-chat-channel.md`, `14-external-interaction-api.md` 에 각각 다른 의미로 존재하여 cross-file 참조 시 혼동 가능성이 있다. `ChatChannelConfig` 타입에 `languageLocale` 필드가 누락된 점과 `executionCancelled` 키의 spec-impl drift 도 이번 PR 에서 정리 가능한 사항이다.

---

## 위험도

MEDIUM
