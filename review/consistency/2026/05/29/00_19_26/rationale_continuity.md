# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-form-native-modal.md`
검토 기준 Rationale 출처:
- `spec/conventions/chat-channel-adapter.md` §Rationale (R1~R4, R-CCA-5~R-CCA-7)
- `spec/4-nodes/7-trigger/providers/slack.md` §Rationale (R-S-6)
- `spec/4-nodes/7-trigger/providers/discord.md` §Rationale (R-D-6, R-D-7, R-D-9)
- `spec/5-system/15-chat-channel.md` §Rationale (R-CC-17)

---

## 발견사항

### 1. 정합 — R4 번복이 아닌 v2 실현 선언

- **등급**: INFO
- **target 위치**: "R4 번복 정당화 (rationale-continuity 핵심)" 절
- **과거 결정 출처**: `chat-channel-adapter.md` §R4 "Form 다단계 시퀀스를 컨벤션 차원에서 강제"
- **상세**: target 은 R4 원문의 "native UI 분기는 v2 옵션" 구절을 직접 인용하며 이번 draft 가 해당 v2 실현이라 명시한다. R4 자체도 cross-ref 주석 한 줄 추가 + R-CCA-8 신규 기록으로 결정 이력을 보존하는 방식을 채택해 R4 의 "기각된 대안" 재도입 패턴에 해당하지 않는다. Rationale 연속성 관점에서 정상 처리.
- **제안**: 현재 기술 방식 유지 가능. 다만 R4 원문 갱신 내용 ("(2026-05-28 갱신) 본 R4 의 v2 옵션이 R-CCA-8 로 실현됨") 과 R-CCA-8 본문 대안 4종이 target draft 에 모두 포함되어 있어 향후 spec 갱신 시 draft 내용 그대로 작성하면 된다.

---

### 2. 정합 — R-S-6 / R-D-6 번복 처리

- **등급**: INFO
- **target 위치**: "변경 2 — slack.md" / "변경 3 — discord.md" 절
- **과거 결정 출처**: `slack.md` §R-S-6 "v1 Form = 다단계 텍스트 시퀀스, modal 은 v2"; `discord.md` §R-D-6 "v1 Form = 다단계 시퀀스, modal 은 v2"
- **상세**: target 은 두 Rationale 모두 "v2 채택" 으로 갱신하는 것으로 명시한다 ("R-S-6 갱신 ... v2 채택", "R-D-6 갱신 ... v2 채택"). 기각 대안(historical 유지 표현)도 삭제하지 않고 보존한다고 기술하여 결정 이력 연속성을 유지한다. 과거 결정을 단순 폐기가 아닌 graduated 업데이트로 처리하고 있어 Rationale 연속성 원칙에 부합.
- **제안**: spec 작성 시 R-S-6 / R-D-6 의 기존 "기각" 대안 목록 위에 "(v2 채택)" 전환 주석을 보존하도록 유의.

---

### 3. WARNING — Discord modal 제약(select/checkbox/date → fallback) 과 R-D-6 의 "fields ≤ 5" 단순 조건 불일치

- **등급**: WARNING
- **target 위치**: "변경 3 — discord.md" 의 §5.3 Form 기술: "select/radio/checkbox/date 가 포함된 form 은 modal 부적합 → 다단계 fallback (modal 은 전 필드가 text 계열일 때만)"
- **과거 결정 출처**: `discord.md` §R-D-6 — "Discord 의 native MODAL_SUBMIT (TEXT_INPUT components, 최대 5) 은 v2 옵션. 단, Discord 의 modal 은 trigger 흐름에 자연 — 단일 modal 안에 ≤5 fields 가 들어가면 v2 우선 격상 후보 (Slack `views.open` 보다 implementation 부담 낮음)"
- **상세**: R-D-6 는 "≤5 fields → v2 격상 후보" 라고 단순 기술하였고 "전 필드가 text 계열이어야 한다" 는 조건을 명시하지 않았다. target 은 선택/체크박스/날짜 필드를 포함한 form 에 다단계 fallback 을 추가 요구하는 새로운 제약을 도입한다. 이 제약은 Discord modal 의 TEXT_INPUT only 한계에서 비롯된 기술적 근거가 충분하지만, R-D-6 에서 예고했던 "≤5 fields = modal 대상" 조건이 실제로는 "≤5 fields AND 전 필드 text 계열" 로 좁아졌음이 R-D-6 갱신 내용이나 신규 R-CCA-8 대안 목록에 충분히 명시되지 않은 채 §5.3 본문에만 등장한다.
- **제안**: R-CCA-8 대안 목록(변경 1-G) 또는 갱신된 R-D-6 에 "Discord modal 은 TEXT_INPUT only → select/checkbox/date 포함 form 은 fields ≤ 5 조건이 충족되어도 다단계 fallback" 을 명시. `discord.md` §5.3 의 제약과 Rationale 기술 간 정합성 확보.

---

### 4. WARNING — R-CC-17 (d) "v2 native modal 진입 시" 교차 참조 갱신 기술 불완전

- **등급**: WARNING
- **target 위치**: "변경 4 — 15-chat-channel.md" 의 "R-CC-17 (d) v2 native modal 진입 시 절: 본 plan 활성화로 v1 임시 텍스트 fallback 이 modal 미지원/포기 경로의 fallback 으로 잔존함을 cross-ref 갱신"
- **과거 결정 출처**: `15-chat-channel.md` §R-CC-17 (d) — "v2 native modal 진입 시: `chat-channel-form-native-modal` plan v2 가 활성화되면 본 v1 임시 fallback 은 plan 의 entry point 가 됨 (deprecated 하지 않고 fallback 으로 잔존 — 사용자가 modal 거부 시 fallback)"
- **상세**: R-CC-17 (d) 는 v2 plan 활성화 후 v1 fallback 의 역할이 "modal 미지원/포기 경로의 fallback" 으로 전환된다고 이미 예고하고 있다. target 은 이 절을 "cross-ref 갱신" 한다고만 기술하고, 구체적으로 어떤 내용을 어떻게 바꾸는지 draft 에 명시하지 않는다. 특히 R-CC-17 (a) 의 "v1 form fallback 시각(텍스트 템플릿)" 이 modal 이 존재하는 provider 에서는 더 이상 primary 경로가 아닌 fallback 으로 분기됨을 명확히 기술해야 하지만, 구체 갱신 텍스트가 target 에 누락되어 있다.
- **제안**: target draft 의 "변경 4" 절에 R-CC-17 (d) 에 추가할 구체 문장을 포함시킬 것. 최소한 "본 plan 활성화 후 (a) 의 v1 임시 fallback 은 (i) supportsNativeForm=false provider (Telegram), (ii) formMode=multi_step opt-out, (iii) fields > 5, (iv) modal 미오픈/포기(view_closed/dismiss) 경로에서만 발화됨" 을 명시.

---

### 5. INFO — R-CCA-5 (함수 개수 6 유지) 와 form_modal 내부 분기 흡수 정합성

- **등급**: INFO
- **target 위치**: "변경 1-A §1 interface 에 capability 추가" 의 주석 "modal open 은 어댑터 *내부* sendMessage 분기로 흡수 — 새 함수 추가 없음, R-CCA-5/R-CCA-7 정신 보존"
- **과거 결정 출처**: `chat-channel-adapter.md` §R-CCA-5 "6함수 인터페이스 최소화 원칙" + §R-CCA-7 "renderNode 시그니처 union 확장"
- **상세**: target 은 modal open 로직을 `sendMessage(form_modal, ...)` 분기 내부로 흡수해 인터페이스 함수 개수 6을 유지한다고 명시한다. R-CCA-5 의 "새 함수 추가 = 인터페이스 drift" 기각 사유와 정합하며, `form_modal` body variant 를 `ChannelMessage.body` union 에 추가하는 접근은 R-CCA-7 의 "union 확장" 패턴과 동일하다. 원칙 위반 없음.
- **제안**: 별도 조치 불필요. 향후 어댑터 구현 PR 에서 이 흡수 패턴이 실제로 `sendMessage` 안에 trigger_id 가용 여부 분기와 views.open 호출을 포함하도록 구현되는지 code-review 시 확인.

---

### 6. INFO — R-D-7 / R-D-9 (file 필드 v1 미지원) 와 modal file 필드 fallback 일관성

- **등급**: INFO
- **target 위치**: "변경 3 — discord.md" 의 "file 필드(R-D-7/R-D-9): modal 에서도 file 미지원 → file 포함 form 은 다단계 fallback (기존 v1 한계 유지)"
- **과거 결정 출처**: `discord.md` §R-D-7 "v1 file 필드 사실상 미지원" + §R-D-9 "Form spec 미변경 + Discord provider 의 v1 한계로 fallback"
- **상세**: target 이 file 포함 form → 다단계 fallback 으로 명시하는 것은 R-D-7 / R-D-9 의 "v1 한계 유지, Form spec 미변경" 원칙과 완전히 정합한다. 새로운 Rationale 추가 없이도 기존 원칙 하에 자연스럽게 커버된다.
- **제안**: R-CCA-8 대안 목록에 "file 필드 포함 form 은 Discord 에서 다단계 fallback (R-D-7 / R-D-9 v1 한계 유지)" 를 참조 한 줄 추가하면 검토자가 교차 확인하기 쉬워진다.

---

### 7. INFO — `formMode: "auto"` default 와 기존 DB 의 `formMode: "multi_step"` 마이그레이션 주장 검증

- **등급**: INFO
- **target 위치**: "변경 1-D §2.3 ChatChannelConfig.uiMapping.formMode enum 확장" 의 "(legacy 값 호환: 기존 DB 의 `multi_step` 은 의미 동일하므로 마이그레이션 불필요. production data 없음)"
- **과거 결정 출처**: `chat-channel-adapter.md` §2.3 `ChatChannelConfig.uiMapping.formMode?: "multi_step"` (현재 enum 단일값)
- **상세**: 기존 convention 에서 `formMode` 는 `"multi_step"` 단일 optional 값이었고, 미설정(undefined) 이 사실상 기본값이었다. target 은 default 를 `"auto"` 로 변경한다. `production data 없음` 이라 마이그레이션 불필요라고 주장하나, 이 주장이 사실이라면 이슈 없다. 단, 해당 주장이 사실인지는 검토 범위 밖이므로 INFO 로 기록한다.
- **제안**: spec 작성 시 "production data 없음" 근거를 Rationale 에 명시(예: 파일 frontmatter 의 `status: partial` 과 pending_plans 참조). 만약 production 배포 이후 `formMode: "multi_step"` 이 저장된 row 가 있다면, undefined → "auto" default 변경은 동작 변화를 유발하지 않으나 `"multi_step"` → 명시값 보존이므로 실질적 운영 영향 없다. 안전하나 Rationale 에 명시 권장.

---

## 요약

target draft 는 `chat-channel-adapter.md` §R4, `slack.md` §R-S-6, `discord.md` §R-D-6 각각이 이미 "native UI 는 v2 옵션" 으로 예고한 경로를 실현하는 것이며, 기각된 대안(modal 즉시 강제, fields > 5 modal 등)을 R-CCA-8 의 신규 대안 목록에 명시적으로 기각 처리하고 있다. Rationale 연속성 관점에서 구조적 결함은 없다. 다만 두 가지 보완이 필요하다: (1) Discord 의 "select/checkbox/date 포함 form → 다단계 fallback" 제약이 R-D-6 갱신 내용에 충분히 반영되지 않아 §5.3 본문과 Rationale 간 기술 불일치가 발생하며 (WARNING), (2) R-CC-17 (d) 의 v1 임시 fallback 역할 전환 내용을 구체 문장으로 갱신하지 않아 결정 연속성이 단절될 수 있다 (WARNING). 두 WARNING 을 해소한 후 spec 갱신을 진행하면 기존 Rationale 과의 완전한 정합이 확보된다.

---

## 위험도

MEDIUM
