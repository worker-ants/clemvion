# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/4-nodes/7-trigger/providers/` (전체 — `_overview.md`, `discord.md`, `slack.md`, `telegram.md`)
검토 기준: `spec/conventions/chat-channel-adapter.md`, `spec/conventions/spec-impl-evidence.md`, `CLAUDE.md`

---

## 발견사항

### [CRITICAL] Convention §4 에 존재하지 않는 §4.1 / §4.2 하위절을 provider spec 이 참조

- target 위치:
  - `discord.md` §3.3, §4, §5.3, R-D-6 — `[Convention §4.1 native modal 경로](../../../conventions/chat-channel-adapter.md#41-native-modal-경로-2026-05-28-신설)`, `[Convention §4.1 / R-CCA-8]`, `§4.2 다단계` 복수 참조
  - `slack.md` §3.3, §4.2, §5.3, R-S-6 — 동일 패턴으로 `§4.1 native modal 경로`, `§4.2 다단계 텍스트 시퀀스`, `R-CCA-8` 복수 참조
- 위반 규약: `spec/conventions/chat-channel-adapter.md §4` (현행 파일 전체)
- 상세: `spec/conventions/chat-channel-adapter.md` 의 §4 는 제목이 "Form 다단계 시퀀스 규약" 이며 단일 섹션으로만 존재한다. `§4.1 native modal 경로 (2026-05-28 신설)`, `§4.2 다단계 텍스트 시퀀스`, `R-CCA-8` anchor 는 현재 convention 파일에 없다. Slack/Discord provider spec 이 참조하는 링크 대상이 실재하지 않으므로, 구현자가 이 링크를 따라가도 내용을 찾을 수 없다. 이 gap 이 채워지지 않은 채 구현이 진행되면 구현자가 어댑터 contract 상의 단일 규범적 진실(`chat-channel-adapter.md §4`)을 잘못 읽게 되고, native modal 분기 정책이 convention 에 있다고 착각한 채 구현할 위험이 있다.
  - 현행 convention §4 에 명시된 내용: 다단계 텍스트 시퀀스만 (6 step).
  - 현행 convention §2.3 에 명시된 `formMode` 값: `"multi_step"` 단일 — `"auto"`, `"native_modal"` 이 없다.
  - provider spec 이 사용하는 `formMode ∈ {auto, native_modal}` 는 convention 의 `ChatChannelConfig.uiMapping.formMode` type 에 선언된 값이 아니다.
- 제안:
  1. `spec/conventions/chat-channel-adapter.md §4` 를 `§4.1 native modal 경로` / `§4.2 다단계 텍스트 시퀀스` 로 분리·확장하고, `R-CCA-8` Rationale 을 추가. `§4.1 (a)` — provider별 modal 수용 타입 제약 조건(Discord: TEXT_INPUT only, Slack: file 제외 전 타입) 명시.
  2. `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.uiMapping.formMode` 의 type 을 `"multi_step" | "auto" | "native_modal"` 로 확장.
  3. 위 두 갱신 전에는 구현 착수를 차단하는 것이 적절하다 (convention 이 근거 규범 역할을 못 하므로).

---

### [CRITICAL] `ChannelUpdate.command` union 에 `form_submission` kind 누락

- target 위치: `discord.md §4` parseUpdate 표의 MODAL_SUBMIT 행 — `{ kind: "form_submission", fields }` 반환; `slack.md §4.2` view_submission 행 — 동일 형식
- 위반 규약: `spec/conventions/chat-channel-adapter.md §2.1 ChannelUpdate`
- 상세: Convention §2.1 의 `ChannelUpdate.command` union 은 6 variant(`start`, `cancel`, `text_message`, `button_callback`, `file_upload`, `contact_share`)만 정의한다. Provider spec 이 반환하는 `{ kind: "form_submission", fields: Record<string, string> }` 는 이 union 에 없다. 구현자가 convention 을 보고 `form_submission` 을 추가하지 않으면 TypeScript discriminated union 에서 타입 에러가 발생하거나, `HooksService` 가 알 수 없는 `kind` 를 무시하는 버그로 이어진다.
- 제안: `spec/conventions/chat-channel-adapter.md §2.1 ChannelUpdate.command` union 에 `| { kind: "form_submission"; fields: Record<string, string> }` variant 를 추가. Fields 의 value type(`string` vs `string[]` — checkbox 는 복수 선택) 도 명시 필요.

---

### [CRITICAL] `ChannelMessage.body` union 에 `form_modal` kind 누락

- target 위치: `discord.md §3` sendMessage 표의 `form_modal` 행; `slack.md §3` sendMessage 표의 `form_modal` 행
- 위반 규약: `spec/conventions/chat-channel-adapter.md §2.2 ChannelMessage`
- 상세: Convention §2.2 의 `ChannelMessage.body` union 은 `text`, `buttons`, `form_prompt`, `image`, `typing` 5 variant 다. Provider spec 이 언급하는 `{ kind: "form_modal", ... }` 는 이 union 에 없다. `renderNode` 의 출력 타입인 `ChannelMessage[]` 가 `form_modal` 을 포함하지 못하면, `sendMessage` 가 이를 핸들링할 수 없고, dispatch 파이프라인 전체에서 타입 불일치가 발생한다.
- 제안: `spec/conventions/chat-channel-adapter.md §2.2 ChannelMessage.body` 에 `| { kind: "form_modal"; formConfig: unknown; title?: string }` (또는 동등한 형태) 를 추가. 정확한 shape 은 Convention §4.1 신설과 함께 정의.

---

### [WARNING] `discord.md` frontmatter `status: implemented` 이나 `_overview.md §1` 에서도 `supported (v1)` — `telegram.md` 와 불일치

- target 위치: `telegram.md` frontmatter `status: spec-only` + `code: []`; `_overview.md §1` telegram 행 "supported (v1)"
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클`
- 상세: `_overview.md §1 Supported providers (v1)` 표에서 telegram 이 `supported (v1)` 로 표기되어 있으나, `telegram.md` frontmatter 는 `status: spec-only`, `code: []` 다. `spec-impl-evidence.md §3` 에 따르면 `spec-only` 는 "작성됐고 구현 의도 결정됨" 이지 구현 완료가 아니다. `_overview.md §1` 의 "supported" 정의는 "spec 본문 + adapter 구현체 + registry 등록 + e2e 테스트 모두 완료" 인데, 이와 `spec-only` 가 공존하면 catalog 신뢰성이 깨진다. `_overview.md` 는 `_` prefix 로 frontmatter 가드 적용 제외이므로 자동 검증이 없다는 점에서 수동 일관성 유지가 더 중요하다.
- 제안: telegram 이 실제로 아직 미구현이라면 `_overview.md §1` 에서 `§2 Spec-defined / impl-pending` 으로 이동. 이미 구현되어 있다면 `telegram.md` 의 `status: implemented` + `code:` 경로 추가. 둘 중 하나로 정합.

---

### [WARNING] Convention §4 ("Form 다단계 시퀀스 규약") 제목이 native modal 신설로 인해 misleading

- target 위치: `spec/conventions/chat-channel-adapter.md §4` 제목 "Form 다단계 시퀀스 규약"
- 위반 규약: `spec/conventions/chat-channel-adapter.md §7 변경 관리` — "본 인터페이스 변경은 spec 동시 갱신 의무"
- 상세: Slack/Discord 가 native modal 을 채택한 이후, convention §4 의 제목 "Form 다단계 시퀀스 규약" 은 실제 내용(다단계 + native modal 두 경로)과 일치하지 않는다. 제목만 보면 "모든 어댑터는 다단계만 쓴다" 로 오해할 수 있다. Convention §7 에 따르면 interface 변경 시 convention 도 동시 갱신 의무이므로, native modal 채택과 함께 §4 제목과 내용이 갱신됐어야 했다.
- 제안: §4 제목을 "Form 입력 시퀀스 규약" 또는 "Form 입력 시퀀스 규약 (§4.1 native modal / §4.2 다단계)" 로 변경하고, 본문을 §4.1 / §4.2 로 분리.

---

### [WARNING] Convention 의 `ChatChannelConfig.uiMapping.formMode` type 이 provider spec 실제 사용값과 불일치

- target 위치: `discord.md §5.3`, `slack.md §5.3` — `formMode ∈ {auto, native_modal, multi_step}` 사용
- 위반 규약: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig`
- 상세: Convention §2.3 은 `formMode?: "multi_step"` (단일 literal type) 으로 선언하지만, Provider spec 은 `formMode ∈ {auto, native_modal}` 와 `multi_step` 세 값을 모두 사용한다. `auto` 는 default 이므로 미설정 시에도 native modal 분기가 적용되어야 한다. Convention 의 type 이 좁으면 구현자가 `formMode === "native_modal"` 분기를 TypeScript 차원에서 처리할 수 없다.
- 제안: 위 CRITICAL 항목(§4 확장)과 연동하여 `formMode?: "multi_step" | "auto" | "native_modal"` 로 갱신. default 값(`auto`) 도 JSDoc 주석으로 명시.

---

### [INFO] `discord.md §5` 의 절 번호 체계 — §5.5 "Typing" 뒤 §5.6 "Execution Failed" 로 비어 있는 §5.5 다음 번호

- target 위치: `discord.md §5.5` 제목 "Typing (CCH-MP-04 - typing 등가)" 과 `telegram.md §5.6 Execution Failed` 가 모두 §5.6 번호를 사용
- 위반 규약: 문서 구조 규약 (CLAUDE.md — "문서 구조 규약: Overview / 본문 / Rationale 3섹션 권장")
- 상세: Provider spec 3종의 절 번호가 서로 정렬되어 있다. `telegram.md` 에는 §5.5 Typing 절이 없고 §5.6 으로 바로 넘어간다 (파일 내 주석에 이유 설명됨). 이 자체는 의도된 결정이며 규약 위반이 아니다. 다만 `telegram.md §5.6` 의 인라인 설명("§5.5 typing 절이 없다 — Telegram §5 는")이 독자에게 혼란을 줄 수 있다. INFO 수준으로 기록하되 수정 의무 없음.
- 제안: 필요시 `telegram.md §5.6` 의 설명 괄호를 Rationale 참조 형식으로 정리. 필수 아님.

---

### [INFO] `_overview.md` 에 `spec/conventions/spec-impl-evidence.md` 의 제외 규칙이 적용됐지만 `_overview.md` 는 CLAUDE.md 에 `_product-overview.md` 패턴 예시로만 언급

- target 위치: `spec/4-nodes/7-trigger/providers/_overview.md` (frontmatter 없음)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1 적용 대상 — 제외` 항목
- 상세: `spec-impl-evidence.md §1` 제외 목록에 `spec/<영역>/_*.md` 패턴이 명시되어 있으므로, `providers/_overview.md` 는 frontmatter 불필요 (올바름). 위반 없음. INFO 로 기록.
- 제안: 없음. 현행 상태 올바름.

---

## 요약

`spec/4-nodes/7-trigger/providers/` 대상 문서들은 전반적으로 명명 규약(파일명 lower-case kebab-case, provider 식별자 컨벤션), 문서 구조 규약(Overview / 본문 / Rationale 3섹션), frontmatter 스키마(spec-impl-evidence.md §2), 보안 규약(SecretResolver ref, plaintext 금지)을 준수하고 있다. 그러나 **`chat-channel-form-native-modal` v2 채택(2026-05-28)으로 도입된 native modal 경로가 convention 파일에 반영되지 않은 채로 provider spec 에만 먼저 기재된 상태**라는 구조적 gap 이 존재한다. 구체적으로 (1) `spec/conventions/chat-channel-adapter.md §4` 에 `§4.1 native modal 경로`, `§4.2`, `R-CCA-8` 가 없고, (2) `ChannelUpdate.command` union 에 `form_submission` kind 가 없으며, (3) `ChannelMessage.body` union 에 `form_modal` kind 가 없다. 이 세 항목은 CRITICAL 등급이며 구현자가 convention 만 보고 작업할 경우 런타임 타입 불일치 또는 누락 분기로 이어질 수 있어 구현 착수 전 convention 갱신이 선행되어야 한다.

## 위험도

**HIGH**

(CRITICAL 항목 3건이 모두 convention 의 핵심 타입 계약 누락에 해당하므로 구현 착수 전 반드시 해소 필요. 단, provider spec 본문 자체의 동작 기술은 내부 정합성이 높고, convention 갱신만으로 gap 을 닫을 수 있으므로 CRITICAL 로는 분류하지 않음.)
