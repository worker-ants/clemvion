# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**Target 영역**: `spec/4-nodes/7-trigger/providers/` (discord.md, slack.md, telegram.md, _overview.md)
**검토일**: 2026-05-29

---

## 발견사항

### [CRITICAL] Convention §4.1 native modal 경로 및 R-CCA-8 미존재 — 참조 대상 없음

- **target 위치**:
  - `discord.md §3.3` — "Convention §4.1 native modal 경로의 Discord 구현" 명시
  - `discord.md §5.3` — "[Convention §4](../../../conventions/chat-channel-adapter.md#4-form-입력-시퀀스-규약) 의 **formMode 분기** 적용" + "Convention §4.1 (a)"
  - `discord.md R-D-6` — "[Convention §4.1 / R-CCA-8](../../../conventions/chat-channel-adapter.md#r-cca-8-native-form-modal-예외-절--5-fields-이하-single-modal-2026-05-28)" cross-link
  - `slack.md §3.3` — "Convention §4.1 native modal 경로의 Slack 구현"
  - `slack.md §5.3` — "[Convention §4](../../../conventions/chat-channel-adapter.md#4-form-입력-시퀀스-규약) 의 formMode 분기 적용"
  - `slack.md R-S-6` — "[Convention §4.1 / R-CCA-8](../../../conventions/chat-channel-adapter.md#r-cca-8-native-form-modal-예외-절--5-fields-이하-single-modal-2026-05-28)" cross-link
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md §4`
- **상세**: `spec/conventions/chat-channel-adapter.md` 의 §4 는 현재 **"Form 다단계 시퀀스 규약"** 단일 섹션만 존재한다 (`## 4. Form 다단계 시퀀스 규약`). `§4.1 native modal 경로`, `§4.2 다단계 텍스트 시퀀스` 하위 분기, `R-CCA-8` Rationale 은 존재하지 않는다. discord.md 와 slack.md 가 이 섹션들을 anchor 링크로 참조하고 있으나 현재 convention 에 해당 내용이 없으므로 링크가 모두 dangling 이다. 또한 `telegram.md §5.3` 은 `[Convention §4.2 다단계 텍스트 시퀀스](../../../conventions/chat-channel-adapter.md#42-다단계-텍스트-시퀀스)` 를 참조하는데 이 앵커도 현재 파일에 없다. 구현 착수 시 Convention 갱신 없이 provider spec 만 보고 구현하면 어댑터 인터페이스가 정의되지 않은 경로를 구현하게 된다.
- **제안**: `spec/conventions/chat-channel-adapter.md §4` 를 다음 구조로 갱신해야 한다:
  - `§4.1 native modal 경로` — formMode 분기 진입 조건 + 5-step 시퀀스 (버튼 게이팅→modal open→submit→검증→재표시)
  - `§4.2 다단계 텍스트 시퀀스` — 기존 "Form 다단계 시퀀스 규약" 본문을 §4.2 로 이동
  - `R-CCA-8` — native modal 예외 절 도입 근거
  - `ChatChannelConfig.formMode` enum 을 `"multi_step" | "auto" | "native_modal"` 3종으로 확장
  이 Convention 갱신이 provider spec 구현 착수의 전제 조건이다.

---

### [CRITICAL] `ChannelMessage.body` union 에 `form_modal` kind 미정의

- **target 위치**:
  - `discord.md §3` API 매핑 표 — `sendMessage (form_modal)` 행에 "§4.1 native modal 게이팅 — 버튼 발송 + `__open_form__` 클릭 시 MODAL"
  - `slack.md §3` API 매핑 표 — `sendMessage (form_modal)` 행에 "`views.open` (§3.3)"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md §2.2 ChannelMessage`
- **상세**: Convention `§2.2 ChannelMessage.body` union 은 `text / buttons / form_prompt / image / typing` 5종만 정의한다. `form_modal` kind 는 없다. provider spec 은 `sendMessage(form_modal)` 시그니처로 native modal 게이팅 버튼을 발송하는 경로를 기술하지만, 이 메시지 shape 이 `ChannelMessage` 인터페이스에 반영되어 있지 않다. 구현 시 어댑터가 Convention 에 없는 body kind 를 사용하게 된다.
- **제안**: Convention `§2.2 ChannelMessage.body` union 에 `{ kind: "form_modal"; formConfig: ...; triggerLabel?: string }` (또는 `buttons` kind 의 특수 case 로 흡수) 를 추가해야 한다. `form_modal` 이 단순히 특정 `custom_id` 를 가진 버튼 메시지라면 `buttons` kind 에 `isFormGate: true` 플래그로 표현하는 방법도 있으나, discord/slack 이 동일 개념을 사용하므로 Convention 차원에서 명시적으로 정의하는 것이 안전하다.

---

### [CRITICAL] `ChatChannelConfig.formMode` 타입이 Convention 과 target 간 불일치

- **target 위치**:
  - `discord.md §5.3` — `formMode ∈ {auto, native_modal}` && `fields.length <= 5` 조건
  - `discord.md R-D-6` — `formMode ∈ {auto, native_modal}` 분기 설명
  - `slack.md §5.3` — `formMode ∈ {auto, native_modal}` && `fields.length <= 5` 조건
  - `slack.md R-S-6` — `formMode ∈ {auto, native_modal, multi_step}` 3종 분기
- **충돌 대상**:
  - `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md §2.3` — `formMode?: "multi_step"` (단일 literal)
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md §4.1` — 예시 JSON: `"formMode": "multi_step"`, 주석: "현재 v1 은 multi_step 만 (다단계 시퀀스)"
- **상세**: Convention `§2.3 ChatChannelConfig` 에서 `formMode` 의 타입은 `"multi_step"` 단일 literal union 이다. `spec/5-system/15-chat-channel.md §4.1` 예시도 `multi_step` 만 기재하고 주석으로 "현재 v1 은 multi_step 만" 이라고 명시한다. 그러나 discord.md 와 slack.md 는 `auto` / `native_modal` 을 유효한 값으로 사용한다. 구현 시 DTO validation 에서 `auto` / `native_modal` 이 거부되거나 DB 에 저장되지 않아 native modal 분기가 작동하지 않는 장애가 발생한다.
- **제안**: 세 파일을 동시에 갱신해야 한다:
  1. `spec/conventions/chat-channel-adapter.md §2.3` — `formMode?: "multi_step" | "auto" | "native_modal"` (default `"auto"`)
  2. `spec/5-system/15-chat-channel.md §4.1` — formMode 예시를 `auto` 로 변경, 주석에서 "v1 은 multi_step 만" 제한 문구 제거 및 3종 enum 설명 추가

---

### [WARNING] `ChatChannelConfig.botIdentity.botId` 타입이 `number` — Discord snowflake 수용 불가

- **target 위치**: `discord.md §3.1` setupChannel 구체 — `config.chatChannel.botIdentity = { botId: id, username: name, publicKey: public_key }`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md §2.3` — `botIdentity?: { botId: number; username: string; teamId?: string }`
- **상세**: Convention 은 `botId: number` 로 정의한다. Telegram 의 bot ID 는 정수 (JavaScript safe integer 범위 내) 이므로 문제 없다. 그러나 Discord 의 application ID (snowflake) 는 64-bit 정수로 JavaScript `Number.MAX_SAFE_INTEGER` (2^53 - 1) 를 초과할 수 있다. Discord API 는 이 값을 문자열로 반환한다. discord.md 의 `setupChannel` 구체가 `botId: id` (Discord API 응답의 `id` 문자열) 를 그대로 저장한다면 `number` 타입과 충돌한다. 또한 discord.md 는 `publicKey` 를 `botIdentity` 에 추가로 저장하는데 (`{ botId: id, username: name, publicKey: public_key }`), Convention 의 `botIdentity` 형식에 `publicKey` 필드가 없다.
- **제안**: Convention `§2.3 botIdentity` 를 `{ botId: number | string; username: string; teamId?: string }` 으로 확장하거나, Discord 어댑터가 snowflake 를 안전하게 처리하는 방법을 명시해야 한다. `publicKey` 캐시 필요성도 검토 후 Convention 에 반영하거나 provider-specific 메타데이터로 처리 방침을 결정해야 한다.

---

### [WARNING] Convention §3 매핑 표의 `execution.waiting_for_input (form)` 출력이 native modal 경로를 반영하지 않음

- **target 위치**: `discord.md §5.3`, `slack.md §5.3` — native modal 진입 시 `form_modal` 버튼 + modal 응답 시퀀스
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md §3` 매핑 표 — `execution.waiting_for_input (interactionType=form)` 행의 출력: "다단계 — 첫 필드의 `form_prompt` 1건. 이후 응답마다 다음 필드 (§4)"
- **상세**: Convention §3 매핑 표는 form interactionType 에 대해 무조건 다단계 시퀀스만 기술한다. native modal 경로가 도입되면 이 행의 출력이 `formMode` + provider 의 `supportsNativeForm` + `fields.length` 에 따라 분기되어야 한다. 구현자가 Convention §3 표만 보고 구현하면 native modal 경로를 누락한다.
- **제안**: Convention §3 매핑 표의 form 행을 "provider 가 `supportsNativeForm=true` 이고 `formMode ∈ {auto, native_modal}` 이고 진입 조건 충족 시 → `form_modal` 버튼 1건 (§4.1). 그 외 → 다단계 `form_prompt` 1건 (§4.2)" 으로 갱신해야 한다.

---

### [WARNING] discord.md 의 200 OK 예외가 `spec/5-system/15-chat-channel.md §5.5` 에 미반영 상태

- **target 위치**: `discord.md §6` HTTP 응답 코드 정책 — "Discord 특이 예외 1: PING → 200 OK + { type: 1 } / 예외 2: Interactivity ack → 200 OK + { type: 5|6 }"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md §5.5` (inbound HTTP contract — 내용 미열람이나 discord.md §6 및 R-D-8 에서 "§5.5 의 202 Accepted 정책에 대한 명시적 예외" 라고 명시)
- **상세**: discord.md R-D-8 이 "§5.5 의 후속 갱신은 본 plan §Phase 4 시스템 spec 점검 대상" 이라고 명시한다. 즉 현재 discord.md 와 `spec/5-system/15-chat-channel.md §5.5` 사이에 의도된 차이가 존재하며, 시스템 spec 갱신이 미완료인 상태다. slack.md R-S-8 도 동일하게 §5.5 갱신이 "plan §Phase 4" 대상으로 기록되어 있다. 구현 착수 전에 이 갱신이 이루어지지 않으면 HooksController 의 응답 코드 정책이 모호해진다.
- **제안**: `spec/5-system/15-chat-channel.md §5.5` 의 inbound HTTP contract 표에 "Slack url_verification: 200 + challenge / Slack interactivity ack: 200 / Discord PING: 200 + { type: 1 } / Discord interactivity ack: 200 + { type: 5|6 }" 예외 행을 추가해야 한다. 이는 discord.md R-D-8 과 slack.md R-S-8 이 명시한 미완료 갱신이다.

---

### [INFO] discord.md `botIdentity` 캐시에 `publicKey` 필드 추가 — Convention `§2.3` 미반영

- **target 위치**: `discord.md §3.1` setupChannel 구체 — `config.chatChannel.botIdentity = { botId: id, username: name, publicKey: public_key }`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md §2.3` — `botIdentity?: { botId: number; username: string; teamId?: string }` (`publicKey` 필드 없음)
- **상세**: Discord 어댑터가 `setupChannel` 시 application public key 를 `botIdentity.publicKey` 로 캐시하려 하지만 Convention 의 `botIdentity` 타입에 해당 필드가 없다. public key 는 이미 `inboundSigningRef` (secret store) 로 별도 관리되므로 `botIdentity` 캐시 중복이 설계 의도인지 명확하지 않다. 구현 시 두 곳에 동일 값이 저장될 수 있으나 sync 정책이 정의되지 않았다.
- **제안**: discord.md §3.1 의 `botIdentity` 저장 내용에서 `publicKey` 를 제거하거나 (이미 `inboundSigningRef` 로 관리되므로 중복), Convention `§2.3 botIdentity` 에 `publicKey?: string` 을 추가하고 그 목적을 명시해야 한다. 전자가 더 단순하다.

---

### [INFO] `spec/4-nodes/7-trigger/providers/_overview.md §1` 표의 discord/slack `status` 가 `supported (v1)` 이지만 실제 구현 범위 확인 필요

- **target 위치**: `_overview.md §1 Supported providers (v1)` 표 — telegram/slack/discord 모두 `supported (v1)`
- **충돌 대상**: `discord.md` frontmatter `status: implemented`, `slack.md` frontmatter `status: implemented`
- **상세**: discord.md 와 slack.md 의 frontmatter `status: implemented` 는 "spec 본문 + adapter 구현체 + registry 등록 + e2e 테스트 모두 완료" 를 의미한다. 그러나 본 target 은 2026-05-28 native modal 채택으로 두 파일이 새로 갱신된 draft 이다. native modal 관련 구현 (§3.3, §5.3 의 native modal 분기, `ackInteraction` 의 type 9 응답 등) 이 실제로 완료됐는지 확인이 필요하다. worktree 이름 `chat-channel-form-native-modal-c021b9` 로 보아 이 plan 이 현재 진행 중인 것으로 보이므로 `status: implemented` 는 과도하게 선언된 것일 수 있다.
- **제안**: impl 완료 전까지 discord.md 와 slack.md 의 frontmatter `status` 를 `partial` 로 유지하고 native modal 관련 코드 경로가 `code:` 에 등재된 파일에 구현된 이후에 `implemented` 로 격상하는 것이 spec-impl-evidence 규약과 정합한다.

---

### [INFO] discord.md §5.5 "typing" 절 번호가 CCH-MP-04 로 기술 — Slack/Telegram 과 절 번호 정렬은 의도적

- **target 위치**: `discord.md §5.5 Typing (CCH-MP-04 - typing 등가)`
- **충돌 대상**: `telegram.md §5` 구조 — §5.5 는 없고 §5.4 가 Carousel/Chart/Table. `slack.md §5.5 Typing`
- **상세**: Slack/Discord 는 §5.5 에 typing 을 두고 telegram.md 는 typing 이 §5.1 AI Multi Turn 안의 `sendChatAction` 로 처리되어 별도 절이 없다. `telegram.md §5.6 Execution Failed` 의 주석("본 §5.6 의 절 번호는 Slack/Discord 의 §5.6 과 정렬")이 이 의도적 정렬을 설명한다. 충돌 아닌 명명 비일관이지만 향후 새 provider 추가 시 혼동을 줄이기 위해 provider 간 절 구조를 Convention 에 기록하면 좋다. 심각도는 낮다.
- **제안**: 해소 불필요. 현재 provider spec 의 §5.x 절 번호 정렬 의도는 telegram.md §5.6 주석으로 충분히 문서화되어 있다.

---

## 요약

target 영역 (`spec/4-nodes/7-trigger/providers/`) 의 discord.md 와 slack.md 는 2026-05-28 native form modal 채택으로 대폭 갱신되었으나, 이 변경이 의존하는 Convention (`spec/conventions/chat-channel-adapter.md`) 의 §4.1 native modal 경로, R-CCA-8, `formMode` enum 확장, `ChannelMessage.body` 의 `form_modal` kind 가 **아직 Convention 에 반영되어 있지 않다**. 세 가지 CRITICAL 발견은 모두 "provider spec 이 Convention 에 없는 구조를 참조"하는 same 패턴이다. 또한 `spec/5-system/15-chat-channel.md §5.5` 의 200/202 응답 코드 예외와 `ChatChannelConfig.formMode` DTO 검증도 아직 갱신이 필요하다. Convention 갱신 없이 구현에 착수하면 Slack/Discord 의 native modal 경로 전체가 인터페이스 없이 구현되어 향후 어댑터 교체·신규 provider 추가 시 정합이 깨진다. 구현 착수 전 Convention + 시스템 spec 동시 갱신이 필수다.

---

## 위험도

**CRITICAL**

---

## 참조 파일

- `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md`
- `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/_overview.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/discord.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/slack.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/telegram.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md`
