# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 대상: `spec/4-nodes/7-trigger/providers/`
검토 일시: 2026-05-29

---

## 발견사항

### 1. [INFO] Discord §5.3 — `date` 필드의 modal 수용 판정 vs R-CCA-8 세부 (a) 충돌 여지
- **target 위치**: `discord.md §5.3 Form` 표, 필드 type `date` 행 + 각주 `> modal 수용 타입 제약`
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md § R-CCA-8 세부 (a)` — "Discord 의 경우 select/radio/checkbox/**date** 또는 file 필드가 1개라도 있으면 fields ≤ 5 여도 §4.2 다단계 fallback"
- **상세**:
  Convention R-CCA-8 세부 (a) 는 Discord modal 비수용 타입 열거에 `date` 를 포함시켜 "date 필드가 있으면 §4.2 fallback" 으로 명시하고 있다. 그러나 `discord.md §5.3` 의 필드 표에서 `date` 는 "TEXT_INPUT style 1 + 형식 안내 (`YYYY-MM-DD`)" 로 §4.1 modal 수용 가능 타입으로 취급되고 있고, 각주의 `> modal 수용 타입 제약` 에도 "select/radio/checkbox/file 이 1개라도 있으면 fields ≤ 5 여도 §4.2 다단계" 라고 해 `date` 를 제외하고 있다.

  두 문서 간에 `date` 의 modal 수용 여부가 불일치한다.

  - Convention R-CCA-8 세부 (a): `date` → modal 비수용 → §4.2 fallback
  - discord.md §5.3: `date` → TEXT_INPUT + 형식 안내 → §4.1 modal 수용

  discord.md §3.3 에는 "TEXT_INPUT 전용 제약" 항에 "date 는 TEXT_INPUT + 형식 안내로 degrade 하므로 modal 수용" 이라는 판단이 명시되어 있어, discord.md 내부는 일관된다. Convention 의 `date` 열거가 오기재인지, discord.md 의 date 수용이 Convention 을 암묵적으로 갱신하는 것인지 명확하지 않다.

- **제안**:
  둘 중 하나를 단일 진실로 결정하고 나머지를 정합화해야 한다.
  - (권장) `date` 는 Discord TEXT_INPUT + 형식 안내로 degrade 가능하므로 §4.1 수용이 타당하다면 — Convention R-CCA-8 세부 (a) 의 `date` 를 열거에서 제거하고 괄호 주석 `(date 는 TEXT_INPUT + 형식 안내로 degrade 하므로 modal 수용)` 를 명시.
  - (대안) `date` 를 modal 비수용으로 결정한다면 — discord.md §5.3 표의 `date` 행을 `§4.2 전용` 으로 수정 + §3.3 TEXT_INPUT 전용 제약 항에 `date` 비수용 명시.

---

### 2. [INFO] Slack §5.3 — `file` 필드 modal 비수용이지만 판단 기준이 R-CCA-8 세부 (a) 와 소폭 달리 표현됨
- **target 위치**: `slack.md §5.3 Form` 표 각주 `> modal 수용 타입 제약`
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md § R-CCA-8 세부 (a)` + `slack.md § R-S-6`
- **상세**:
  Convention R-CCA-8 세부 (a) 는 Slack 의 modal 수용 타입을 `plain_text_input / static_select / datepicker / checkboxes` 로 명시하고, Discord 와는 달리 Slack modal 에서는 file 만 제외한다. slack.md §5.3 각주도 동일하게 "file 필드만 §4.1 제외" 로 기술하고 있어 정합한다.

  다만 slack.md §3.3 `views.open` 구체 절에서 trigger_id 3초 제약이 있을 때 "EIA 등 다른 I/O 를 사이에 끼우지 않음" 이라 명시하는데, `ackInteraction` 이 modal open 을 담당한다는 Convention §1.1 의 설계가 이 제약을 처리하는 구체 경로를 담보하고 있다. 이 자체는 R-CCA-8 채택 대안 1 의 "버튼 게이팅" 의도와 정합한다.

  발견된 차이는 표현상의 소폭 차이이며 설계 충돌은 없다. 기록 목적의 INFO.

- **제안**: 현행 유지. 필요 시 slack.md §3.3 에 "trigger_id 확보가 `ackInteraction` 내부에서 이루어지므로 Convention §1.1 의 modal open 게이팅과 정합" 한 줄 주석을 추가해 인과 관계를 명시할 수 있다.

---

### 3. [INFO] `_overview.md` §2 "Spec-defined / impl-pending" — Slack·Discord 의 impl 완료 상태와 §1 지위
- **target 위치**: `_overview.md §1 Supported providers (v1)` 표 — telegram·slack·discord 모두 `supported (v1)` 으로 등재됨
- **과거 결정 출처**: `_overview.md § Rationale "spec-defined / impl-pending 단계 도입 (2026-05-24)"` — 대안 1 (채택) 의 설명에서 "Slack/Discord spec 먼저, impl 은 후속 plan" 으로 단계 구분을 설명
- **상세**:
  Rationale 에서 2026-05-24 시점에는 Slack·Discord 가 §2 "Spec-defined / impl-pending" 단계에 있었다고 설명하면서 그 단계를 도입한 이유를 설명하고 있다. 현재 `_overview.md §1` 에서는 세 provider 모두 `supported (v1)` 으로 되어 있고, slack.md·discord.md frontmatter 도 `status: implemented` 이다.

  Rationale 의 "사용 시나리오" 설명 (`chat-channel-slack-impl / chat-channel-discord-impl plan 으로 진행 상황 추적`) 이 현재 상태와 달리 과거형으로 읽힐 수 있으나, 이는 역사적 근거 기술이므로 설계 충돌은 아니다. 다만 Rationale 을 처음 읽는 사람이 "Slack/Discord 가 아직 §2 단계인가?" 로 오해할 수 있다.

- **제안**: `_overview.md Rationale "spec-defined / impl-pending 단계 도입"` 항에 "(2026-05-24 당시 Slack·Discord 는 §2 단계였으나 이후 impl 완료로 §1 승격됨)" 한 줄 갱신 주석을 추가해 역사적 기술임을 명시.

---

### 4. [INFO] Discord §4 parseUpdate 표 — `__reply__` 버튼 분기에서 `null` 반환 + EIA 명령 아님 처리
- **target 위치**: `discord.md §4 명령 매핑 (parseUpdate)` 표, `type === 3` & `custom_id === "__reply__"` 행
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §1.1` — `parseUpdate` pure 계약, `ackInteraction` 이 modal open 담당 (R-CCA-8)
- **상세**:
  `__reply__` 버튼 클릭 시 parseUpdate 가 `null` 반환 후 ackInteraction 이 `{ type: 9 }` MODAL 응답을 한다는 설계는 Convention §1.1 의 "form_modal 버튼 클릭 interaction → `ackInteraction` 이 modal open" 패턴과 일치한다. 그러나 Convention §2.1 의 `ChannelUpdate.command` union 에 이 경로(`__reply__` 클릭 → null → modal)를 명시하는 variant 가 없어, parseUpdate 의 `null` 반환이 "EIA 명령 없음 + ackInteraction 에게 modal 위임" 을 암묵적으로 전달한다.

  `__open_form__` 버튼도 동일하게 null 반환으로 처리되므로 패턴 자체는 일관되나, `__reply__` 의 경우 form modal 이 아닌 AI reply 목적임을 Convention 레벨에서 구분하는 표현이 없다. R-CCA-8 세부 (b) 의 "함수 개수 6 유지 + ackInteraction 내부 분기" 정신으로 흡수는 되지만, 두 modal 경로(form vs reply)를 ackInteraction 이 어떻게 구분하는지 Convention 에 명시되지 않았다.

- **제안**: 현행 구현 의도를 보존하되, discord.md §5.1 (b) 에 이미 상세히 기술되어 있으므로 Convention 레벨에서 별도 명시는 불필요. 다만 향후 provider 추가 시 동일 패턴을 따를 수 있도록 Convention §4.1 의 "버튼 게이팅" 설명에 "form_modal 외에 AI reply modal 등 다른 modal 경로도 ackInteraction 내부 분기로 흡수 가능" 한 줄을 추가하는 것을 권장.

---

## 종합 평가

`spec/4-nodes/7-trigger/providers/` 의 네 문서 (`_overview.md`, `telegram.md`, `slack.md`, `discord.md`) 는 전반적으로 기존 Rationale 의 결정 방향을 충실히 따르고 있다. 핵심 설계 결정 — (1) Convention R4 의 "native UI 분기는 v2 옵션" 을 R-CCA-8 으로 실현하면서 다단계 fallback 을 보존한 것, (2) `supportsNativeForm` capability + formMode 3값 enum 으로 provider 및 사용자 제어를 분리한 것, (3) Telegram 의 `supportsNativeForm=false` 유지로 R4 일관성 가치를 보존한 것 — 모두 기존 기각 결정을 번복하지 않고 예고된 경로를 활성화한 것으로 정합하다. 명시적으로 기각된 대안의 재도입은 발견되지 않았다. 가장 주목할 충돌 가능성은 Convention R-CCA-8 세부 (a) 에서 `date` 를 Discord modal 비수용 타입으로 열거하는 반면 discord.md §5.3 이 `date` 를 TEXT_INPUT + 형식 안내로 modal 수용 가능으로 취급하는 점이나, 이는 설계 의도가 discord.md 쪽이 더 구체적으로 기술되어 있고 내부 일관성도 있어 Convention 쪽 기술 오류로 보인다. 구현 착수 전에 단일 진실 정합이 권장된다.

---

## 위험도

LOW
