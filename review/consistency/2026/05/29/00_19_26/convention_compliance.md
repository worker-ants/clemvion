# 정식 규약 준수 검토 — spec-draft-chat-channel-form-native-modal

검토 모드: `--spec`  
대상: `plan/in-progress/spec-draft-chat-channel-form-native-modal.md`  
기준 규약: `spec/conventions/chat-channel-adapter.md`, `spec/conventions/spec-impl-evidence.md`, CLAUDE.md 명명 컨벤션

---

## 발견사항

### [CRITICAL] plan 파일이 실제 존재하지 않음

- target 위치: 문서 전체 (frontmatter `name:` 필드 + 실제 파일 경로)
- 위반 규약: CLAUDE.md `정보 저장 위치 표` — "진행 중 작업: `plan/in-progress/<name>.md`"  
  `.claude/docs/plan-lifecycle.md §1` — "새 plan 은 항상 `plan/in-progress/` 에서 생성"
- 상세: 검토 payload 에서 target 경로가 `plan/in-progress/spec-draft-chat-channel-form-native-modal.md` 로 명시되어 있으나, 실제 파일시스템에 해당 경로의 파일이 존재하지 않는다. `plan/in-progress/` 에는 `chat-channel-form-native-modal.md` (구현 plan) 와 `spec-draft-chat-channel-error-notify.md` 만 존재한다. 이 spec draft 는 **독립된 plan 문서가 아니라 prompt payload 안의 인라인 초안**인 것으로 보이며, 실제 파일로 생성되지 않았다.
- 제안: spec draft 를 `plan/in-progress/spec-draft-chat-channel-form-native-modal.md` 로 파일 생성 후 적절한 frontmatter (`worktree`, `started`, `owner`) 를 추가해야 한다.

---

### [CRITICAL] frontmatter 에 plan-lifecycle 필수 필드 누락

- target 위치: 문서 최상단 frontmatter (`---` 블록)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — `worktree`, `started`, `owner` 세 필드 의무
- 상세: target 문서의 frontmatter 에는 `name:`, `description:`, `target_specs:` 세 필드만 선언되어 있다. plan-lifecycle 이 요구하는 `worktree: <task_name>-<slug>`, `started: <ISO 날짜>`, `owner: <역할/이름>` 세 필드가 모두 누락되어 있다. `worktree` 필드 누락 시 `consistency-checker` 의 `plan_coherence` 검사가 이 plan 을 추적하지 못한다.
- 제안: frontmatter 를 아래 형식으로 갱신한다.
  ```yaml
  ---
  worktree: chat-channel-form-native-modal-c021b9
  started: 2026-05-28
  owner: project-planner
  name: spec-draft-chat-channel-form-native-modal
  description: ...
  target_specs:
    - ...
  ---
  ```

---

### [WARNING] `formConfig: unknown` 타입 — 규약 기반 구체 타입 기대 대비 약한 계약

- target 위치: 변경 1-C `ChannelMessage.body.form_modal` variant — `formConfig: unknown`
- 위반 규약: `spec/conventions/chat-channel-adapter.md §2` 데이터 타입 계약 원칙 — ChannelMessage 의 body variants 는 모두 명확한 필드 타입으로 정의됨 (예: `buttons: ChannelButton[]`, `fieldName: string`)
- 상세: 기존 ChannelMessage body variants 는 모든 필드가 구체 타입으로 선언되어 있으나, `form_modal` variant 의 `formConfig: unknown` 은 어댑터 구현체가 클릭 시 modal 을 열 때 어떤 구조를 기대하는지를 spec 계약으로 표현하지 못한다. EIA `formConfig` 원본이라고 주석으로 설명하지만, EIA spec 의 formConfig shape 이 별 타입 이름 없이 `unknown` 으로 흘러들면 향후 어댑터 구현 시 어느 필드를 읽어야 하는지 알 수 없다.
- 제안: EIA `execution.waiting_for_input` 의 `context.formConfig` shape 을 인용하는 named type (예: `FormConfig`) 을 `spec/conventions/chat-channel-adapter.md §2` 또는 EIA spec 에서 정의하거나, 최소한 `{ fields: Array<{ name: string; label: string; type: string; ... }> }` 수준의 인라인 shape 을 명시한다. 그렇지 않으면 어댑터가 `formConfig` 를 파싱할 때 EIA spec 을 별도로 열람해야 해 계약 drift 위험이 발생한다.

---

### [WARNING] `ChannelUpdate.command.form_submission.fields` 에서 빈 입력 처리 규약이 모호

- target 위치: 변경 1-B `ChannelUpdate.command.form_submission` variant — "빈 입력은 key 자체 생략"
- 위반 규약: `spec/conventions/chat-channel-adapter.md §4 Form 다단계 시퀀스 규약` — 기존 다단계 시퀀스는 빈 입력 처리를 명시하지 않으나, 새 variant 는 key-생략 정책을 도입함
- 상세: "빈 입력은 key 자체 생략(modal optional 필드)" 정책은 EIA `submit_form` 호출 시 `fields` 에 absent key 가 있는 경우의 서버 처리 방식과 직결된다. 그런데 이 정책이 기존 `spec/conventions/chat-channel-adapter.md §4` 다단계 시퀀스 규약의 빈 입력 처리 정책과 일관된지 — 다단계에서는 사용자가 빈 응답을 보내면 현재 어떻게 처리되는지 — 가 이 draft 에서 명시되지 않는다.
- 제안: spec-draft 에 기존 다단계 경로의 optional field 처리 정책과 native modal 경로의 key-생략 정책이 동일한지, 혹은 의도적으로 다른지를 명시한다. 다른 경우 EIA `submit_form` 계약에도 cross-ref 가 필요하다.

---

### [WARNING] `R-CCA-8` Rationale ID 선점 — 규약 파일 갱신 전 draft 에서 사용

- target 위치: `## R4 번복 정당화` 절 및 `### 1-G. Rationale — R4 갱신 + R-CCA-8 신설`
- 위반 규약: `spec/conventions/chat-channel-adapter.md ## Rationale` — "신규 Rationale 은 R-CCA-N prefix 사용"이라고 명시하며, Rationale 은 해당 spec 문서 끝의 `## Rationale` 에 위치한다. CLAUDE.md `정보 저장 위치 표` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- 상세: `R-CCA-8` 이라는 ID 를 draft plan 문서 안에서 self-reference 하며 사용 중이다. 이 ID 는 실제 `spec/conventions/chat-channel-adapter.md` 에 아직 존재하지 않으므로, draft 가 참조하는 동안 규약 파일의 Rationale 과 ID 가 일치하지 않는 상태다. 문제는 없으나, spec 편집 시 번호 충돌 없이 삽입되어야 한다 (현재 최신 ID 는 R-CCA-7). R-CCA-8 은 사용 가능하지만, spec 갱신 PR 에서 순서대로 추가되어야 한다.
- 제안: spec 갱신 PR 에서 `R-CCA-8` 이 누락 없이 `## Rationale` 절 끝에 추가되는지 체크리스트 항목으로 명시한다. draft 에서 self-reference 는 허용되나, 실제 spec 파일의 Rationale 절이 R-CCA-7 에서 끊겨 있음을 인지해야 한다.

---

### [WARNING] `supportsNativeForm` 플래그의 SoT 가 불분명 — Adapter Registry 수준에서 정의되지 않음

- target 위치: 변경 1-A `ChatChannelAdapter.supportsNativeForm: boolean` 필드
- 위반 규약: `spec/conventions/chat-channel-adapter.md §5 Adapter Registry` — provider 문자열이 lower-case kebab-case 이며, 어댑터 추가 시 `spec/4-nodes/7-trigger/providers/<name>.md` 가 single source of truth
- 상세: `supportsNativeForm: boolean` 의 값을 "Telegram=false, Slack/Discord=true" 로 드래프트 본문에서 직접 서술하지만, 어느 spec 문서가 이 값의 SoT 인지가 명확하지 않다. Convention §5 의 신규 어댑터 등록 절차에 `supportsNativeForm` 값 선언이 포함되어야 하는지, 혹은 각 `providers/<name>.md` 에 명시하는지가 지정되지 않았다.
- 제안: `spec/conventions/chat-channel-adapter.md §5 Adapter Registry` 의 신규 어댑터 추가 절차 (4단계 목록) 에 `supportsNativeForm` 값 선언 위치 (Convention §1 interface vs providers/<name>.md §5.3) 를 명시한다.

---

### [WARNING] Discord modal 제약 (TEXT_INPUT 전용) 이 Convention 에 올라가야 하는지 검토 필요

- target 위치: 변경 3 `discord.md` — "select/radio/checkbox/date 가 포함된 form 은 modal 부적합 → 다단계 fallback (modal 은 전 필드가 text 계열일 때만)"
- 위반 규약: `spec/conventions/chat-channel-adapter.md §4 Form 입력 시퀀스 규약` (draft 의 §4.1 native modal 경로) — Convention §4.1 은 "5 fields 이하"만 조건으로 명시하며, 필드 타입 제약은 언급 없음
- 상세: 변경 3 에서 Discord modal 의 TEXT_INPUT 전용 제약으로 인해 "전 필드가 text 계열일 때만" modal 적합 조건이 추가된다. 그런데 이 조건이 Convention §4.1 (채널 공통 규약) 에 반영되지 않고 `discord.md` 에만 있으면, Convention 을 읽는 사람은 "5 fields 이하면 무조건 modal"로 오해할 수 있다. 또한 Slack 은 이 제약이 없으므로 분기가 생긴다.
- 제안: Convention §4.1 native modal 조건에 "(단, provider 에 따라 지원하는 input type 한계가 있을 수 있음 — 각 providers/<name>.md §5.3 의 SoT)" 를 cross-ref 로 추가하거나, `supportsNativeForm` 을 단순 boolean 이 아닌 `{ supported: boolean; maxFields: number; allowedTypes?: string[] }` 같은 capability 객체로 확장하는 방향을 검토한다.

---

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 중 Overview 절 없음

- target 위치: 문서 최상단 (H1 이후)
- 위반 규약: CLAUDE.md `Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)` 권장
- 상세: target 은 plan 문서이므로 spec 3섹션 구성이 strict 의무는 아니다. 그러나 이 문서는 spec draft 역할을 하므로, spec 변경 내용의 "왜 이 변경을 하는가" (Overview 역할) 를 "핵심 설계 결정" 으로 담고 있으나, Overview 섹션 레이블이 없다. spec 으로 편입 시 Overview 절이 누락된 채 이전될 위험이 있다.
- 제안: `## Overview` 절을 추가하거나, spec 편집 시 Overview 절에 해당 내용이 배치되도록 체크리스트에 명시한다.

---

### [INFO] `side-effect 점검 대상` 절의 `_overview.md` 경로가 불완전

- target 위치: `## side-effect 점검 대상` — "`_overview.md` provider catalog — form modal capability column 없으면 추가 검토"
- 위반 규약: CLAUDE.md `정보 저장 위치 표` — `spec/<영역>/_product-overview.md` 또는 `spec/0-overview.md` 등 경로 특정 권장
- 상세: `_overview.md` 만 적혀 있어 어느 경로의 파일인지 (`spec/4-nodes/7-trigger/providers/_overview.md` 추정) 명시되지 않아 검토 담당자가 확인해야 할 파일을 찾는 데 모호성이 생긴다.
- 제안: `spec/4-nodes/7-trigger/providers/_overview.md` 로 전체 경로를 명시한다.

---

## 요약

target 문서(`spec-draft-chat-channel-form-native-modal`)는 설계 결정과 spec 변경 내용 자체의 논리적 완성도는 높으며, R-CCA-8 Rationale 의 대안 검토·Discord 제약·Discord fallback 정책 등 충분한 근거를 갖추고 있다. 그러나 정식 규약 준수 관점에서 두 가지 CRITICAL 위반이 있다: (1) plan 파일이 실제 `plan/in-progress/` 에 존재하지 않아 plan-lifecycle §1 을 충족하지 못하고, (2) plan-lifecycle §4 가 요구하는 `worktree`·`started`·`owner` frontmatter 세 필드가 모두 누락되어 있다. 이 두 가지는 채택 시 `consistency-checker` 의 `plan_coherence` 검사와 `spec-pending-plan-existence.test.ts` 가드가 plan 을 추적하지 못하는 invariant 손상을 유발한다. WARNING 항목들은 Convention 계약 완성도 및 cross-provider 일관성과 관련된 것으로, spec 편집 PR 에서 함께 해결하도록 권장한다.

## 위험도

**HIGH**

> CRITICAL 2건은 파일 생성 및 frontmatter 추가로 해소 가능하나, 해소 전까지 plan lifecycle 추적이 불가능한 상태다.
