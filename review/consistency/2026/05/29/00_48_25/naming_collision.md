# 신규 식별자 충돌 검토 — `spec/4-nodes/7-trigger/providers/`

검토 모드: --impl-prep (구현 착수 전)
검토 대상: `spec/4-nodes/7-trigger/providers/` (_overview.md / discord.md / slack.md / telegram.md)

---

## 발견사항

### [WARNING] `formMode` 열거값 불일치 — trigger-list.md 와 Convention/Chat Channel spec 간 상충

- **target 신규 식별자**: `uiMapping.formMode` 의 새 열거값 `"native_modal"` / `"auto"`  
  도입 위치: `discord.md §5.3`, `slack.md §5.3` (R-D-6 / R-S-6 갱신), Convention `chat-channel-adapter.md §2.3`, `spec/5-system/15-chat-channel.md CCH-MP-03`

- **기존 사용처**:  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/2-navigation/2-trigger-list.md` line 99: `enum: "multi_step" (v1 은 이것만). 향후 "single_page" 추가 가능`  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/codebase/backend/src/modules/chat-channel/types.ts` line 58: `formMode?: 'multi_step';` (단일 리터럴)  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` line 47–48: `@IsIn(['multi_step'])` / `formMode?: 'multi_step';`  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` line 37: `formMode?: "multi_step";`

- **상세**: trigger-list.md 는 "v1 은 `multi_step` 이것만, 향후 `single_page` 추가 가능"이라고 명시하여 다음 확장 후보를 `single_page` 로 예고했다. target 은 그와 다른 이름 `native_modal` / `auto` 를 신설했다. `single_page` 는 spec 에서 사라지지 않았고 "예고된 후보"로 잔존하여 `native_modal` / `auto` 와 어떤 관계인지 정의되지 않았다. 더불어 backend `types.ts` · DTO · frontend 타입 정의 모두 `'multi_step'` 단일 리터럴로 고정되어 있어, spec 이 이미 `native_modal` / `auto` 를 SoT 로 선언했지만 구현 코드는 이를 알지 못한다. 구현 착수 시점에 DTO 의 `@IsIn(['multi_step'])` 이 새 값을 400 으로 거부할 것이다.

- **제안**:  
  1. `spec/2-navigation/2-trigger-list.md` line 99 의 열거값 설명을 `"multi_step" | "native_modal" | "auto"` 로 갱신하고, `single_page` 예고를 삭제하거나 별도 todo 로 분리한다.  
  2. 구현 착수 전에 backend `types.ts` / `chat-channel-config.dto.ts` / frontend 타입 정의의 `formMode` 를 `'multi_step' | 'native_modal' | 'auto'` union 으로 확장한다.

---

### [WARNING] `ChannelCommand.kind = "form_submission"` — codebase 타입 미정의

- **target 신규 식별자**: `ChannelCommand` union 멤버 `{ kind: "form_submission", fields }` — Slack `view_submission` / Discord `MODAL_SUBMIT` 의 일괄 제출 normalize 결과  
  도입 위치: `discord.md §4` parseUpdate 표 / `slack.md §4.2` Interactivity 표, Convention `chat-channel-adapter.md §2.1 Changelog 2026-05-28`

- **기존 사용처**:  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/codebase/backend/src/modules/chat-channel/types.ts` line 111–117: `ChannelCommand` union 에 `form_submission` 없음 (`start` / `cancel` / `text_message` / `button_callback` / `file_upload` / `contact_share` 6종만 존재)  
  - `render-tool-provider.ts` line 691: `pending: 'form_submission'` 은 tool content 문자열 literal 이며 ChannelCommand kind 와 별개의 사용처라 직접 충돌은 아니지만, 동일 단어가 다른 문맥에서 사용되고 있어 혼동 여지가 있다.

- **상세**: Convention `chat-channel-adapter.md` Changelog(2026-05-28)는 `ChannelUpdate.command` 에 `form_submission` variant 를 신설했다고 선언하지만, 실제 `codebase/backend/src/modules/chat-channel/types.ts` 의 `ChannelCommand` union 에는 해당 variant 가 없다. 구현 착수 시 Slack adapter 의 `view_submission` 파싱 또는 Discord adapter 의 `MODAL_SUBMIT` 파싱 코드가 `'form_submission'` kind 를 반환하면 타입 에러가 발생한다. 기존 Slack dispatcher `chat-channel.dispatcher.ts` 의 command 분기 switch/if 도 이를 처리하지 못한다.

- **제안**: 구현 착수 전에 `codebase/backend/src/modules/chat-channel/types.ts` 의 `ChannelCommand` union 에 `{ kind: 'form_submission'; fields: Record<string, string> }` 를 추가한다. dispatcher / conversation state machine 에서의 분기 처리도 함께 구현해야 한다.

---

### [WARNING] `ChannelMessageBody.kind = "form_modal"` — codebase 타입 미정의

- **target 신규 식별자**: `ChannelMessage.body` 의 새 variant `{ kind: "form_modal"; openLabel: string; formConfig: unknown }`  
  도입 위치: Convention `chat-channel-adapter.md §2.2 / §4.1` 및 Changelog 2026-05-28, `discord.md §3`, `slack.md §3.3`

- **기존 사용처**:  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/codebase/backend/src/modules/chat-channel/types.ts` line 127–137: `ChannelMessageBody` union 에 `form_modal` 없음 (`text` / `buttons` / `form_prompt` / `image` / `typing` 5종만 존재)

- **상세**: spec 과 convention 은 `form_modal` variant 를 §4.1 native modal 경로의 핵심 메시지 타입으로 정의했으나, codebase 의 `ChannelMessageBody` union 에는 아직 존재하지 않는다. Slack adapter 의 `renderNode` 가 `form_modal` ChannelMessage 를 생성하거나, Discord adapter 가 이를 처리하려 할 때 타입 에러가 발생한다.

- **제안**: 구현 착수 전에 `codebase/backend/src/modules/chat-channel/types.ts` 의 `ChannelMessageBody` union 에 `{ kind: 'form_modal'; openLabel: string; formConfig: unknown }` 를 추가한다. 각 provider adapter 의 `sendMessage` switch 에 `form_modal` case 를 추가한다.

---

### [INFO] `supportsNativeForm` 플래그 — codebase 인터페이스 미선언

- **target 신규 식별자**: `ChatChannelAdapter` 인터페이스의 `readonly supportsNativeForm: boolean` capability 플래그  
  도입 위치: Convention `chat-channel-adapter.md §1 / Changelog 2026-05-28`

- **기존 사용처**:  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/codebase/backend/src/modules/chat-channel/types.ts` 에는 `ChatChannelAdapter` 인터페이스가 없거나 (파일 범위 확인 결과 유추), 있더라도 `supportsNativeForm` 이 없다. Discord / Slack / Telegram adapter 클래스에도 해당 프로퍼티가 없다.

- **상세**: 신규 플래그 자체는 다른 의미로 사용 중인 식별자와 충돌하지 않는다. 다만 구현 착수 전에 인터페이스에 추가하지 않으면 `formMode` 분기 로직 구현 시 런타임 에러가 발생한다.

- **제안**: 구현 착수 시 `ChatChannelAdapter` 인터페이스(또는 해당 추상 클래스) 에 `readonly supportsNativeForm: boolean` 을 추가하고, Telegram = `false`, Slack/Discord = `true` 로 각 구현체가 선언하도록 한다.

---

### [INFO] Discord custom_id `"clemvion_form"` / `"clemvion_reply"` — codebase 미정의 (충돌 없음)

- **target 신규 식별자**: Discord MODAL custom_id 리터럴 `"clemvion_form"` (form native modal MODAL_SUBMIT 분기) / `"clemvion_reply"` (AI reply modal MODAL_SUBMIT 분기)  
  도입 위치: `discord.md §3.3 / §4 / §5.1`

- **기존 사용처**: 전체 spec / codebase 검색 결과 기존에 다른 의미로 사용된 사례 없음.

- **상세**: 신규 custom_id 값이므로 충돌은 없다. 다만 구현 코드에 상수로 정의되어야 한다 (Discord adapter 의 `parseUpdate` 분기 조건).

- **제안**: Discord adapter 파일에 `const DISCORD_FORM_MODAL_CUSTOM_ID = 'clemvion_form'` / `const DISCORD_REPLY_MODAL_CUSTOM_ID = 'clemvion_reply'` 상수를 정의하고 magic string 직접 삽입을 피하도록 한다.

---

### [INFO] Slack `action_id = "__open_form__"` / Discord `custom_id = "__open_form__"` — codebase 미정의 (충돌 없음)

- **target 신규 식별자**: "양식 작성하기" 버튼의 action_id / custom_id 리터럴 `"__open_form__"`, Discord AI reply 버튼 `"__reply__"`  
  도입 위치: `slack.md §3.3 / §4.2`, `discord.md §3.3 / §4 / §5.1`

- **기존 사용처**: spec / codebase 전체 검색 결과 기존에 다른 의미로 사용된 사례 없음. Slack adapter 의 `block_actions` 분기 조건으로만 사용될 예정.

- **상세**: 충돌 없음. 구현 시 상수화 권장.

- **제안**: `"__open_form__"` / `"__reply__"` 를 각 adapter 파일에 상수로 정의한다.

---

### [INFO] `telegram.md` frontmatter `status: spec-only` — `_overview.md §1` supported 표와 불일치 가능성 점검

- **target 식별자**: provider 식별자 `"telegram"`, `"slack"`, `"discord"`  
  도입 위치: `_overview.md §1 supported 표`

- **기존 사용처**:  
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` line 37: `CHAT_CHANNEL_PROVIDERS = ['telegram', 'slack', 'discord']`

- **상세**: `_overview.md §1` 의 supported 표는 `telegram` / `slack` / `discord` 를 모두 `supported (v1)` 로 기재했으나, `telegram.md` frontmatter 는 `status: spec-only` 다. backend `CHAT_CHANNEL_PROVIDERS` 배열에는 `telegram` 이 포함되어 있어, 실제로는 구현체가 존재한다(`codebase/backend/src/modules/chat-channel/providers/telegram/`). frontmatter `status` 값과 catalog 상태가 불일치하는 것은 기존 문서 문제로, target 이 새로 도입한 충돌은 아니다. 그러나 이번 검토 범위 내에서 같이 발견되었으므로 INFO 로 기록한다.

- **제안**: `telegram.md` frontmatter 의 `status: spec-only` 를 `status: implemented` 로 수정하고, `code:` 필드에 구현 경로를 채운다 (별 plan 에서 처리하거나 본 구현 plan 에 포함).

---

## 요약

target (`spec/4-nodes/7-trigger/providers/`) 이 도입하는 신규 식별자 중 의미가 다른 기존 식별자와 충돌하는 경우는 없다. 그러나 구현 착수에 직접 영향을 주는 **누락형 불일치**가 세 건 발견되었다. (1) `formMode` 열거값이 spec 에서는 `"native_modal"` / `"auto"` 를 포함하지만 backend DTO (`@IsIn(['multi_step'])`)와 frontend 타입 정의는 단일 리터럴 `'multi_step'` 에 고정되어 있어, 새 값을 전달하면 400 validation error 가 발생한다. (2) `ChannelCommand.kind = "form_submission"` 과 `ChannelMessageBody.kind = "form_modal"` 이 convention 에 선언됐으나 codebase 의 union 타입에 없어 타입 에러가 발생할 것이다. (3) `spec/2-navigation/2-trigger-list.md` 가 예고한 미래 값 `single_page` 는 target 이 채택한 `native_modal` / `auto` 와 관계가 명시되지 않았다. 구현 착수 전에 이 세 항목을 해소해야 한다.

---

## 위험도

MEDIUM
