# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-form-native-modal.md`
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] `R-CCA-8` Rationale ID — 기존 번호 체계와 충돌 없음, 단 다음 번호 예약 확인 필요

- target 신규 식별자: `R-CCA-8`
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/conventions/chat-channel-adapter.md` Changelog 및 Rationale 절. 현재 최고 번호는 `R-CCA-7` (renderNode 시그니처 union 확장 — 2026-05-25).
- 상세: `R-CCA-8` 은 아직 미사용이므로 충돌은 없다. 그러나 Changelog 의 최신 항목(2026-05-25)과 연속성을 명확히 하기 위해 신규 Rationale ID 사용 전 Convention 파일 Changelog 를 동반 갱신해야 한다.
- 제안: 충돌 없음. Convention 파일 갱신 시 Changelog 에 `R-CCA-8` 추가 항목 명시 권장.

---

### [WARNING] `formMode` enum 값 확장 — 기존 `"multi_step"` 단일값과 의미적 확장

- target 신규 식별자: `uiMapping.formMode?: "multi_step" | "native_modal" | "auto"` (enum 2 값 추가)
- 기존 사용처:
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig` — `formMode?: "multi_step"` (단일 리터럴 타입, 현재 값).
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/5-system/15-chat-channel.md` §4.1 `uiMapping.formMode` 주석 — `"multi_step"` 만 언급.
- 상세: 기존 spec 에서 `formMode` 의 TypeScript 타입은 `"multi_step"` 단일 리터럴로 선언되어 있다. target 은 `"native_modal"` 과 `"auto"` 두 값을 추가한다. target 자체가 "기존 DB 의 `"multi_step"` 은 의미 동일하므로 마이그레이션 불필요" 라고 설명하고 있어 값 의미 충돌은 없다. 그러나 TypeScript 구현 코드 (`ChatChannelConfig` 인터페이스, DTO validator, UI 등)에서 기존에 `"multi_step"` 만 허용하던 곳들이 새 값을 거부할 수 있다.
- 제안: spec 갱신 자체의 식별자 충돌은 없다. 구현 단계에서 `chatChannelConfig.dto.ts` 등 DTO 의 `formMode` enum validator 를 `"multi_step" | "native_modal" | "auto"` 로 확장해야 함을 impl plan 에 명시 권장.

---

### [WARNING] `form_modal` ChannelMessage kind — 기존 `body.kind` union 에 미등록 값

- target 신규 식별자: `ChannelMessage.body` 의 `{ kind: "form_modal"; openLabel: string; formConfig: unknown }` variant
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/conventions/chat-channel-adapter.md` §2.2 `ChannelMessage.body` union — 기존 5종: `"text"` / `"buttons"` / `"form_prompt"` / `"image"` / `"typing"`.
- 상세: `"form_modal"` 은 기존 union 에 존재하지 않는 신규 kind 값이다. 의미 충돌은 없다. 그러나 Convention 파일의 `ChannelMessage` 인터페이스 선언을 갱신하지 않으면 기존 어댑터 구현체의 `sendMessage` switch/if 분기에서 `"form_modal"` kind 가 unhandled case 로 처리될 수 있다.
- 제안: 충돌 없음. Convention §2.2 의 `ChannelMessage.body` union 에 `form_modal` variant 추가가 target 변경 범위에 명시되어 있으므로 (변경 1-C) 동반 갱신이 이루어지면 문제 없음.

---

### [WARNING] `form_submission` ChannelUpdate command kind — discord.md §4 `type === 5` 행의 기존 예고와 의미 일치 확인 필요

- target 신규 식별자: `ChannelUpdate.command` 의 `{ kind: "form_submission"; fields: Record<string, string> }` variant
- 기존 사용처:
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/conventions/chat-channel-adapter.md` §2.1 `ChannelUpdate.command` union — 기존 6종. `form_submission` 미존재.
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/4-nodes/7-trigger/providers/slack.md` §4.2 Interactivity 표 `"view_submission"` 행 — `v1: 미사용... v2: { kind: "form_submission", fields: payload.view.state.values } 로 확장 예정`.
  - `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/4-nodes/7-trigger/providers/discord.md` §4 표 `type === 5` 행 — `v1: 미사용... v2: { kind: "form_submission", fields: data.components[].components[] } 로 확장`.
- 상세: 기존 slack.md 와 discord.md 에 `form_submission` 이 v2 예고 형태로 이미 기재되어 있다. target 이 도입하는 `fields: Record<string, string>` 타입과 기존 예고의 `payload.view.state.values` (Slack의 경우 중첩 object 구조) 의 매핑 방향이 일치하는지 확인이 필요하다. Slack 의 `view.state.values` 는 `{ [block_id]: { [action_id]: { type, value } } }` 의 중첩 구조이므로 어댑터가 `fieldName → rawValue` 로 flatten 해야 한다. target 의 `fields` 정의는 `{ [fieldName]: rawValue }` 를 명시하고 있어 의미는 일치하지만, 이 normalize 로직의 책임 주체가 `parseUpdate` 라는 점이 Convention §1.1 pure 계약 (side-effect free) 과 정합하는지 추가 확인이 필요하다.
- 제안: `form_submission` 이름 자체의 충돌 없음 (기존 예고와 동일 이름 일치). 단 normalize 책임을 Convention §1.1 의 `parseUpdate` pure 계약 안에서 처리하는 것임을 spec 에서 명확히 할 것 권장.

---

### [INFO] `supportsNativeForm` — 기존 `ChatChannelAdapter` 인터페이스의 신규 readonly 필드

- target 신규 식별자: `ChatChannelAdapter.supportsNativeForm: boolean` (readonly)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/conventions/chat-channel-adapter.md` §1 `interface ChatChannelAdapter` — 기존 `provider: string` (readonly) + 6함수 + `revokeBotToken?`. `supportsNativeForm` 미존재.
- 상세: 신규 readonly 필드이며 기존 필드명과 충돌 없다. Convention §1 의 "6함수 인터페이스" 원칙에 대해 target 은 "함수 추가 없음, R-CCA-5/R-CCA-7 정신 보존" 이라고 설명하고 있다. 새 필드는 함수가 아닌 capability 플래그이므로 R-CCA-5 의 "함수 개수 증가" 기각 논거와는 다른 카테고리이며, 인터페이스 계약 확장에 해당한다. 기존 구현 어댑터 (Telegram/Slack/Discord) 에 모두 이 필드가 추가되어야 하므로 impl plan 에 명시 필요.
- 제안: 충돌 없음. 모든 기존 어댑터 구현체에 `supportsNativeForm` 추가가 필요함을 impl plan 에 명시 권장.

---

### [INFO] `CCH-MP-03` 요구사항 ID — 기존 ID 재사용 (갱신)

- target 신규 식별자: `CCH-MP-03` (갱신 정의: "formMode 분기 — native modal 지원 provider + ≤5 fields...")
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/5-system/15-chat-channel.md` §3.3 CCH-MP-03 — "Form 의 `execution.waiting_for_input` (interactionType=form) → 다단계 prompt 시퀀스 (필드별 한 줄 질문). 검증 실패 시 그 필드만 재질문".
- 상세: target 은 CCH-MP-03 을 새 ID 로 신설하는 것이 아니라 기존 요구사항을 갱신하는 것으로 기술하고 있다. 같은 ID 를 다른 의미로 덮어쓰는 경우가 아니라 동일 영역의 요구사항을 확장·격상하는 것이므로 충돌이 아니다. 그러나 기존 CCH-MP-03 텍스트는 "다단계 prompt 시퀀스" 만 언급하므로, spec 갱신 후 해당 ID 를 참조하는 다른 문서들 (Convention §3 매핑 표의 `execution.waiting_for_input (interactionType=form)` 행 등)도 함께 갱신되어야 한다.
- 제안: ID 충돌 없음. CCH-MP-03 을 cross-reference 하는 문서들의 동반 갱신 체크리스트 확인 권장.

---

### [INFO] `R-CCA-8` 과 `R-CC-N` 네임스페이스 구분 — 이미 확립된 규약 준수

- target 신규 식별자: `R-CCA-8`
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/conventions/chat-channel-adapter.md` Rationale 절 도입부 — "Convention 파일의 신규 Rationale 은 `R-CCA-N` prefix 사용. cross-file 인용 시에는 `[CCA §R-CCA-N]` 형태. 이는 [Spec Chat Channel §3.1 Rationale ID 컨벤션] 의 `R-CC-N` 패턴과 충돌 방지".
- 상세: target 이 도입하는 `R-CCA-8` 은 Convention 파일(`chat-channel-adapter.md`) 의 Rationale 로서 `R-CCA-N` 체계를 따르고 있다. 시스템 spec(`15-chat-channel.md`)의 `R-CC-N` 체계와 prefix 가 다르므로 충돌 없다.
- 제안: 이상 없음.

---

### [INFO] `§4.1 native modal 경로` — Convention 내부 섹션 번호 신설

- target 신규 식별자: `§4.1` (Convention `chat-channel-adapter.md` 의 하위 섹션)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-form-native-modal-c021b9/spec/conventions/chat-channel-adapter.md` §4 "Form 다단계 시퀀스 규약" — 현재 하위 섹션 없음 (단일 블록). `§4.1` 은 존재하지 않는다.
- 상세: 기존 §4 는 하위 섹션 없이 단일 코드 블록으로 기술되어 있다. target 이 §4.1 을 신설하면 §4 기존 본문은 §4.2 로 재번호 매김이 되어야 한다. 이 재번호 매김이 기존 cross-reference 를 깨지 않는지 확인이 필요하다. 현재 §4 를 참조하는 곳은 slack.md §5.3, discord.md §5.3, 15-chat-channel.md CCH-MP-03 등이다.
- 제안: §4 를 §4 (도입 분기) + §4.1 (modal) + §4.2 (다단계) 로 분리할 때 기존 `Convention §4` cross-link 들을 모두 `§4.2` 로 갱신하는 작업을 변경 목록에 포함 권장.

---

## 요약

target 문서가 도입하는 신규 식별자 — `R-CCA-8`, `supportsNativeForm`, `form_modal`(kind), `form_submission`(kind), `formMode` enum 확장, `CCH-MP-03` 갱신, `§4.1` 신설 — 은 기존 사용처와 직접적인 의미 충돌을 일으키지 않는다. `form_submission` 은 slack.md / discord.md 에서 v2 예고로 기재된 이름과 동일하게 일치하고, `formMode: "multi_step"` 기존 값의 의미도 그대로 보존된다. 주요 주의사항은 (1) Convention §2.3 의 `formMode` 타입이 단일 리터럴에서 union 으로 확장되므로 기존 DTO validator 및 구현 코드 갱신 의무, (2) Convention §4 가 §4.2 로 재번호 매김될 때 기존 cross-link 를 모두 업데이트해야 하는 부수 작업, (3) `supportsNativeForm` 신규 필드로 인해 모든 기존 어댑터 구현체에 추가가 필요한 점이다.

## 위험도

LOW

---

STATUS: SUCCESS
