# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-form-native-modal.md`
검토 일시: 2026-05-29
검토 범위: 변경 1(Convention) / 변경 2(slack.md) / 변경 3(discord.md) / 변경 4(15-chat-channel.md)

---

## 발견사항

### [WARNING] `ChatChannelConfig.uiMapping.formMode` enum 확장과 기존 DB JSONB 값 정합

- **target 위치**: 변경 1-D. `ChatChannelConfig.uiMapping.formMode?: "multi_step" | "native_modal" | "auto"`
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — 현행 `formMode?: "multi_step"` (값 1종 리터럴), `spec/5-system/15-chat-channel.md §4.1` — `"formMode": "multi_step"` 예시 주석 "현재 v1 은 multi_step 만"
- **상세**: draft 는 "legacy 값 호환: 기존 DB 의 `multi_step` 은 의미 동일하므로 마이그레이션 불필요" 라고 명시하지만, 현행 `ChatChannelConfig` TypeScript 인터페이스의 `formMode` 필드 타입이 `"multi_step"` 단일 리터럴로 선언되어 있어 런타임이 아니라 **타입 시스템 차원**의 갱신이 필요하다. 또한 `15-chat-channel.md §4.1` 예시 JSON 주석에 "현재 v1 은 multi_step 만" 이 남아 있으면 새 enum 값이 추가됐음에도 해당 주석이 오해를 유발할 수 있다. draft 변경 4가 주석 갱신을 명시했으나, `chat-channel-adapter.md §2.3` 의 타입 선언 자체(단일 리터럴 `"multi_step"`) 도 변경 1-D와 함께 동시 갱신이 필요하다.
- **제안**: 변경 1-D 적용 시 `chat-channel-adapter.md §2.3` 의 `formMode?: "multi_step"` 선언을 `formMode?: "multi_step" | "native_modal" | "auto"` 로 함께 갱신. 단일 진실 위치가 Convention 이므로 15-chat-channel.md 의 주석은 Convention cross-ref 로 대체.

---

### [WARNING] Discord modal 필드 타입 제약(select/checkbox/date → 다단계 fallback)이 Convention §4.1 흐름에 미반영

- **target 위치**: 변경 3 — "Discord modal 제약 명시: select/radio/checkbox/date 가 포함된 form 은 modal 부적합 → 다단계 fallback (modal 은 전 필드가 text 계열일 때만)"
- **충돌 대상**: 변경 1-F `§4.1 native modal 경로` 분기 조건 — `supportsNativeForm === true && fields.length <= 5 && formMode !== "multi_step"` 만 열거; `spec/4-nodes/6-presentation/4-form.md §1` FormField.type enum(`select` / `checkbox` / `radio` / `date` / `file` 포함)
- **상세**: Convention §4.1 의 native modal 진입 조건은 `supportsNativeForm && fields <= 5 && formMode !== multi_step` 3가지만 나열한다. 그러나 Discord 는 modal 안에 TEXT_INPUT 만 지원하므로 `select`/`radio`/`checkbox`/`date` 필드가 있으면 modal 이 아니라 다단계 fallback 으로 전환되어야 한다. 이 Discord 특이 제약이 Convention §4.1 진입 조건에 반영되지 않으면, 두 스펙의 분기 로직이 다르게 기술된 상태가 된다. Convention §4.1 은 "provider 가 지원하면 5 이하면 modal" 이라고 기술하는데, Discord provider 는 `supportsNativeForm = true` 이면서도 필드 타입에 따라 modal 을 열지 못하는 케이스가 생긴다.
- **제안**: Convention §4.1 진입 조건에 "(d) provider 의 modal native 지원 field type 범위 안에 모든 fields 가 포함될 것 — provider 별 지원 타입 표는 §provider 5.3 SoT" 조건을 추가하거나, `supportsNativeForm` flag 의 의미를 "무조건 지원" 이 아니라 "runtime 에 field type 목록을 받아 지원 여부를 boolean 으로 반환하는 메서드" 로 격상하는 방안을 검토한다. 현행 단순 boolean 으로 유지할 경우 Discord §5.3 에 명시한 fallback 로직을 어댑터 내부 구현에서만 처리하게 되므로, Convention 레벨 계약 문서와 구현 의도 사이의 암묵적 불일치가 발생한다.

---

### [WARNING] `ChannelMessage.body` 에 `form_modal` variant 추가 시 `chat-channel-adapter.md §1.1` 함수 책임 표와의 정합

- **target 위치**: 변경 1-C. `ChannelMessage.body` 에 `{ kind: "form_modal"; openLabel: string; formConfig: unknown }` variant 신설
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.1` `sendMessage` 행 — "외부 API 호출. 재시도·rate limit 책임"; `spec/conventions/chat-channel-adapter.md §2.2 ChannelMessage` 정의
- **상세**: `form_modal` ChannelMessage 는 단순히 버튼 메시지를 발송하는 용도로 쓰이지만, 이후 사용자가 버튼을 클릭하면 어댑터가 `views.open`(Slack) / MODAL(`{ type: 9 }`, Discord)을 트리거해야 한다. 이 "버튼 클릭 → modal open" 단계의 API 호출은 `sendMessage` 범주가 아니라 `ackInteraction` 흐름 안에서 발생하는 side-effect 이다. Convention §1.1 의 `sendMessage` / `ackInteraction` 책임 표에는 이 흐름이 언급되지 않는다. `form_modal` variant 가 어떤 함수에서 modal open 을 수행하는지 명시되지 않으면, 어댑터 구현자가 책임 소재를 잘못 파악할 수 있다.
- **제안**: Convention §1.1 표의 `ackInteraction` 행 또는 `sendMessage` 행에 "`form_modal` 수신 후 클릭 interaction 도착 시 modal open 호출은 `ackInteraction` 안에서 수행 (trigger_id/interaction token 이 필요하므로 반드시 interaction 수신 시점에 처리)" 사항을 명시한다.

---

### [WARNING] `ChannelUpdate.command` 에 `form_submission` 신설 시 `discord.md §4` 기존 MODAL_SUBMIT 중의성

- **target 위치**: 변경 1-B. `ChannelUpdate.command` 에 `{ kind: "form_submission"; fields: Record<string, string> }` variant 추가; 변경 3 — "Discord §4 표: `type === 5` (MODAL_SUBMIT) row 갱신 … AI reply 의 modal 은 기존대로 `text_message` normalize 유지 — custom_id 로 구분: `__form__:<fieldName>` prefix 면 form_submission, 아니면 reply text_message"
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/discord.md §5.1` — "Modal TEXT_INPUT 의 `{ kind: 'text_message' }` normalize" (Discord AI Multi Turn reply 경로); `discord.md §4` parseUpdate 표의 `type === 5 (MODAL_SUBMIT)` 행 현재 정의 "v1: 미사용 (Convention §4 다단계 시퀀스 채택 — R-D-6)"
- **상세**: v2 격상 후 Discord 의 MODAL_SUBMIT(`type === 5`) 는 두 가지 의미가 된다: (a) AI Multi Turn reply 용 modal submit → `text_message` normalize, (b) form native modal submit → `form_submission` normalize. 변경 3 은 `__form__:<fieldName>` prefix 로 구분한다고 기술하나, 해당 prefix 규칙이 §5.1(AI Multi Turn)의 Reply modal custom_id 규칙과 명시적으로 대조되지 않는다. AI Multi Turn reply modal 의 custom_id 형식이 `discord.md §5.1` 에 구체 정의되어 있지 않아 구현자가 두 경로를 명확히 분리할 수 있는 근거가 부족하다.
- **제안**: `discord.md §5.1` 의 AI Multi Turn reply modal 에서 `custom_id` 형식을 명확히 정의하고("form 전용이 아닌 일반 reply 에는 `__reply__` prefix 또는 prefix 없는 고정 문자열 사용"), `discord.md §4` parseUpdate 표에 두 경로의 custom_id 분기 기준을 단일 표로 정리한다.

---

### [INFO] `discord.md §3.1 botIdentity` 캐시에 `publicKey` 필드가 존재하나 Convention `ChatChannelConfig.botIdentity` 에는 미정의

- **target 위치**: 직접 변경 없음 (기존 discord.md §3.1 상태)
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/discord.md §3.1` — `config.chatChannel.botIdentity = { botId: id, username: name, publicKey: public_key }`; `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.botIdentity` — `{ botId: number; username: string; teamId?: string }` (publicKey 필드 없음)
- **상세**: draft 는 이 충돌에 영향을 주지 않지만 draft 리뷰 과정에서 발견된 기존 drift 이다. discord.md 가 botIdentity 에 `publicKey` 를 기록하나 Convention 의 공식 타입에는 없다. native modal 코드 구현 시 botIdentity 의 type 불일치가 TypeScript 오류를 유발할 수 있다.
- **제안**: Convention §2.3 `botIdentity` 에 `publicKey?: string` optional 필드를 추가(Discord 전용)하거나, discord.md §3.1 의 캐시 필드를 Convention 과 일치시키는 방향으로 정리한다. draft 범위와 직접 관련은 없으나 변경 3 적용 시 함께 처리하면 효율적이다.

---

### [INFO] `CCH-MP-03` 요구사항 ID 의 의미 범위 확장 — "다단계 prompt 시퀀스" → "formMode 분기"

- **target 위치**: 변경 4 — `15-chat-channel.md` `CCH-MP-03` 갱신: "다단계 prompt 시퀀스" → "formMode 분기 — native modal 지원 provider… 이면 단일 modal, 그 외 다단계"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.3 CCH-MP-03` 현행 정의 — "Form 의 `execution.waiting_for_input` → 다단계 prompt 시퀀스 (필드별 한 줄 질문). 검증 실패 시 그 필드만 재질문"
- **상세**: CCH-MP-03 은 의미 변경이므로 cross-reference 하는 문서들(Convention §4 다단계 시퀀스 규약에서 "§4 CCH-MP-03" 을 참조하는 표현들)이 모두 새로운 의미를 담게 된다. 이는 사실상 요구사항 정의의 갱신이지 ID 충돌은 아니므로 CRITICAL 은 아니다. 단 변경 사실이 Convention §3 매핑 표의 `execution.waiting_for_input (interactionType=form)` 행 설명과 일치해야 한다.
- **제안**: `chat-channel-adapter.md §3` 매핑 표의 `execution.waiting_for_input (interactionType=form)` 행도 변경 1-E 의 내용을 반영해 갱신한다. 현재 draft 는 §3 매핑 표 갱신을 변경 1-E 에서 다루고 있으나, Convention §3 본문의 해당 행 설명이 단순히 "§4" 를 cross-ref 하는 구조인지 확인이 필요하다.

---

### [INFO] `R-S-6 갱신` 과 `R-D-6 갱신` — 기존 "v2 옵션" 상태를 "v2 채택" 으로 전환

- **target 위치**: 변경 2 — "R-S-6 갱신: v2 채택"; 변경 3 — "R-D-6 갱신: v2 채택"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md Rationale R4` — "native UI 분기는 v2 옵션" 과 "R-CCA-8 로 실현됨" 을 cross-ref 하는 갱신 (변경 1-G)
- **상세**: R-S-6 / R-D-6 가 각각 "v1 다단계, modal v2 옵션" 에서 "v2 채택" 으로 갱신될 때, Convention Rationale R4 의 cross-ref (변경 1-G 에서 추가하는 "(2026-05-28 갱신) 본 R4 의 v2 옵션이 R-CCA-8 로 실현됨") 과 세 문서가 동시에 일관되게 갱신되어야 한다. 현재 draft 는 세 문서 모두 갱신 대상으로 명시하고 있으므로 내용 일관성 자체에 문제는 없다. 단 R-S-6 / R-D-6 의 "기각 대안은 historical 로 유지" 라는 표현은 삭제가 아닌 보존으로, Convention R4 의 "기각된 대안" 서술과 계층 일관성 측면에서 정렬되어야 한다.
- **제안**: 특별한 수정이 필요하지 않으나, 세 문서의 Rationale 갱신을 원자적(atomic)으로 적용하여 임시 불일치 상태가 생기지 않도록 단일 커밋 단위로 처리한다.

---

## 요약

전반적으로 이 draft 는 R4 의 "v2 옵션" 이라는 명시적 미래 경로를 실현하는 것으로, 기존 spec 과의 직접 모순(CRITICAL)은 없다. 가장 중요한 주의사항은 두 가지다. 첫째, Discord modal 이 TEXT_INPUT 만 지원한다는 제약이 Convention §4.1 의 진입 조건에 반영되지 않아 `supportsNativeForm: boolean` 단순 플래그와 Discord 어댑터 내부 로직 사이에 암묵적 불일치가 생기는 점(WARNING). 둘째, Discord 의 MODAL_SUBMIT(`type === 5`)이 AI Multi Turn reply modal 과 form native modal 두 경로를 공유하게 되므로 custom_id 분기 기준을 discord.md §5.1 / §4 에 명확히 명시해야 하는 점(WARNING)이다. 또한 `ChatChannelConfig.uiMapping.formMode` TypeScript 타입 선언(`chat-channel-adapter.md §2.3`)이 단일 리터럴 `"multi_step"` 에서 3종 union 으로 확장되어야 하며, `ackInteraction` 에서의 modal open 책임이 Convention §1.1 에 명시되어야 한다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
