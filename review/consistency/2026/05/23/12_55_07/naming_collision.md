# 신규 식별자 충돌 검토 — spec-telegram-chat-channel-ui-polish

검토 대상: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 일시: 2026-05-23

---

## 발견사항

### [WARNING] 15-chat-channel.md 내 신규 Rationale ID R10/R11/R12 가 기존 "EIA §R10" 인라인 참조와 혼동 유발

- **target 신규 식별자**: `spec/5-system/15-chat-channel.md` 에 추가될 로컬 Rationale 섹션 `### R10`, `### R11`, `### R12`
- **기존 사용처**: `spec/5-system/15-chat-channel.md` 본문 3곳에서 이미 `R10` 을 교차 참조 형태로 사용 중
  - line 33 (`CCH-AD-05`): `[EIA §R10](./14-external-interaction-api.md#r10-...)`
  - line 138: `[EIA §R10](...) 가 본 spec 의 추가 facade 사용을 명시`
  - line 353: `EIA §R10 의 "엔진 외부 facade 단일 위치" 원칙 유지`
- **상세**: `spec/5-system/14-external-interaction-api.md` 의 로컬 Rationale 도 `### R10`, `### R11`, `### R12` 를 사용한다. 15-chat-channel.md 본문 내 `R10` 언급은 현재 모두 `EIA §R10` (외부 문서 참조) 이지만, 동일 파일 안에 로컬 `### R10` 섹션이 생기면 독자가 "이 R10 은 로컬인가, EIA 문서의 R10 인가"를 맥락 없이 판단해야 하는 모호성이 발생한다. 특히 markdown anchor(`#r10-...`) 와 로컬 헤더 anchor 가 동일 prefix 를 가질 수 있어 IDE/렌더러에서 자동완성 혼동 가능성도 있다.
- **제안**: 15-chat-channel.md 의 신규 Rationale 섹션에는 기존 R1~R9/R-K 와 연속되는 번호 대신 **접두사를 다르게** 두거나 명시적 prefix 를 추가한다. 예: `### R-CC-10 (chatChannel 카드 분리)`, `### R-CC-11 (single-path 정책)`, `### R-CC-12 (Inbound HTTP Contract)` — 또는 기존 관례를 유지한다면 본문 내 "EIA §R10" 교차 참조가 항상 파일 경로를 명시하도록 이미 작성되어 있으므로, `R10`/`R11`/`R12` 로컬 헤더도 허용은 가능하나 명명 지침에 "EIA §R10 과의 구분" 을 Rationale 서두에 짧게 명시하는 것을 권장한다.

---

### [WARNING] `visualNode` enum 값 `"text"` 가 동일 파일 내 `KeyboardHint` 타입과 동명 충돌

- **target 신규 식별자**: `uiMapping.visualNode` 의 새 enum 값 `"text"` (구 `"text_only"` rename)
- **기존 사용처**: `spec/conventions/chat-channel-adapter.md` 내 `KeyboardHint` 타입 (line 121)
  ```typescript
  type KeyboardHint = "text" | "number" | "email" | "phone" | "date" | "file_upload" | "share_contact";
  ```
  동일 파일 `§2.3 ChatChannelConfig.uiMapping.visualNode` 에서 현재 `"photo" | "text_only"` 로 정의되어 있으며, 같은 파일 안에 `KeyboardHint = "text" | ...` 도 공존한다.
- **상세**: TypeScript 타입 수준에서 `visualNode?: "text" | "photo" | "auto"` 와 `KeyboardHint = "text" | ...` 는 서로 다른 타입 alias 이므로 런타임 충돌은 없다. 그러나 이 두 타입이 같은 파일 섹션 근처에 있고 둘 다 `"text"` 를 포함할 경우, 코드 리뷰어나 신규 어댑터 구현자가 `visualNode: "text"` 를 `KeyboardHint` 맥락으로 오독할 가능성이 있다. 실제로 `§5.3 Form` 의 키보드 힌트 표에서 `type=text/textarea → force_reply (기본 입력)` 라고 설명할 때 같은 문자열 `"text"` 가 두 맥락에서 사용된다.
- **제안**: 충돌 자체는 타입 구조상 안전하므로 CRITICAL 은 아니다. 다만 `chat-channel-adapter.md §2.3` 에 `visualNode` enum 설명 주석에 "(KeyboardHint 의 'text' 와 다른 목적 — 시각 렌더 모드)" 한 줄을 추가해 명확화하는 것을 권장한다.

---

### [WARNING] `chat-channel-visual-ssr-png.md` (backlog) 와 `visualNode` enum 의 하위 호환 충돌 가능성

- **target 신규 식별자**: `visualNode` enum 에서 `"text_only"` 를 제거하고 `"text"` 로 rename, `"auto"` 신설
- **기존 사용처**: `plan/in-progress/chat-channel-visual-ssr-png.md` line 93:
  ```
  Trigger.config.chatChannel.uiMapping.visualNode: 'text_only' 설정 시 chart/table/carousel 시각 메시지는 발송하지 않고 inline_keyboard 버튼만 발송. 이미 v1 구현됨.
  ```
  그리고 같은 파일 line 125:
  ```
  (b) visualNode: 'photo' → PNG, 'text' (신설) → 텍스트, 'text_only' → skip
  ```
- **상세**: target plan 은 `"text_only"` 를 `"text"` 로 rename 하고 `"text_only"` 를 enum 에서 제거한다. 그러나 `chat-channel-visual-ssr-png.md` 는 여전히 `'text_only'` 를 valid value 로 언급하고, `"text"` 를 "(신설)" 로 표현한다. target plan 이 머지되면 backlog plan 의 `text_only` 참조와 ` "text" (신설)` 표현이 spec 과 불일치 상태가 된다. target plan 은 후속 follow-up (§후속 plan 항목 3) 에서 `chat-channel-visual-ssr-png.md` 를 1 commit 으로 갱신하도록 명시하고 있으나, 갱신 전까지는 plan 문서 간 식별자 불일치가 존재한다.
- **제안**: target plan 의 spec PR 과 동일 commit 또는 즉시 후속 commit 에 `chat-channel-visual-ssr-png.md` 의 `text_only` 참조를 `text` 로 일괄 치환한다. 또한 `'text_only' → skip` 의미가 사라지므로 해당 옵션 (b) 의 표에서 `text_only` 행을 삭제하거나 "deprecated, spec 에서 제거됨" 으로 주석 처리한다.

---

### [INFO] 결정 2의 `hasBotToken` 파생 필드 — 기존 `autoRefresh` 패턴과 동일하나 canonical 위치 명시 필요

- **target 신규 식별자**: `chatChannel.hasBotToken: boolean` — DTO 전용 derived 필드 (`botTokenRef IS NOT NULL → hasBotToken: true`)
- **기존 사용처**: `spec/1-data-model.md §2.10` — Integration 엔티티에 동일 패턴의 파생 필드 `autoRefresh: boolean` 이 선례로 존재 ("응답 DTO 전용 derived 필드"). canonical 위치는 `spec/5-system/15-chat-channel.md §5.4` 로 정의된다고 target plan 에 명시되어 있다.
- **상세**: 패턴은 기존과 일치하고 canonical 위치도 명시되어 있어 충돌은 아니다. 다만 `spec/1-data-model.md §2.8 Trigger` 컬럼 목록에는 `hasBotToken` 이 포함되지 않으므로, 해당 섹션 주석에 "DTO 파생 필드는 [Spec Chat Channel §5.4] 참조" 한 줄 cross-link 를 추가하면 이후 독자가 컬럼을 찾다가 혼선을 겪지 않는다.
- **제안**: `spec/1-data-model.md §2.8` 의 `config` JSONB 설명 하단에 "`hasBotToken` 는 DB 컬럼이 아닌 응답 DTO 파생 필드 — [Spec Chat Channel §5.4]" 한 줄 추가를 권장.

---

### [INFO] `spec/2-navigation/2-trigger-list.md` 신규 Rationale ID `R-8` 는 현재 R-7 다음으로 순차적이며 충돌 없음

- **target 신규 식별자**: `spec/2-navigation/2-trigger-list.md` 에 `R-8` ("chatChannel 카드 분리" 정당화) 신설
- **기존 사용처**: 현재 해당 파일의 로컬 Rationale 는 R-1 ~ R-7 까지 존재 (R-8 은 미사용). 충돌 없음.
- **상세**: 단순 순서 확인 — 충돌 없음. INFO 로만 기록.

---

### [INFO] `§5.5 Inbound HTTP Contract` 섹션 번호 — 기존 §5.4 이후로 순차 배치 가능

- **target 신규 식별자**: `spec/5-system/15-chat-channel.md` 에 `### 5.5` 섹션 신설
- **기존 사용처**: 현재 `15-chat-channel.md` 의 `## 5. Identity / 보안` 하위에 5.1~5.4 가 존재. 5.5 는 미사용. 충돌 없음.
- **제안**: 없음 — 정상 연속 번호.

---

### [INFO] `VALIDATION_ERROR` 에러 코드 재사용 — 기존 정의와 의미 일치

- **target 신규 식별자**: PATCH body 의 `config.chatChannel.botTokenRef` 변경 차단 시 `400 VALIDATION_ERROR, details.field='botTokenRef'`
- **기존 사용처**: `spec/5-system/3-error-handling.md` — `VALIDATION_ERROR` 는 "요청 데이터 유효성 실패 (400)" 으로 정의된 공통 에러 코드. `spec/2-navigation/2-trigger-list.md` 에서도 Schedule PATCH 차단에 동일 코드 사용 중.
- **상세**: 기존 코드와 의미가 동일하므로 충돌 없음. 신규 사용이 기존 에러 카탈로그와 완전히 정합한다.

---

## 요약

6건 발견 중 CRITICAL 은 없다. 가장 주의가 필요한 항목은 두 가지다. 첫째, `15-chat-channel.md` 에 로컬 Rationale `R10/R11/R12` 를 추가할 경우 동일 파일 본문에서 이미 3회 교차 참조되는 `EIA §R10` (14-external-interaction-api.md 의 외부 rationale) 과 이름 충돌 혼동이 발생할 수 있어 명확화가 권장된다. 둘째, `visualNode: "text"` (신규) 와 `KeyboardHint: "text"` (기존) 가 동일 파일에 공존하므로 주석 보강이 필요하다. 셋째, backlog plan `chat-channel-visual-ssr-png.md` 가 `"text_only"` enum 값을 참조하고 있어 target plan 머지 직후 해당 plan 문서의 갱신이 지연되면 plan-spec 간 식별자 불일치 상태가 일정 기간 남는다 — target plan 은 이를 후속 follow-up 으로 계획했지만 commit 타임라인을 구체화하면 안전하다.

## 위험도

MEDIUM
