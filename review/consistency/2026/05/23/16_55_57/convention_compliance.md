# 정식 규약 준수 검토 — plan/in-progress/multiturn-error-preserve.md

검토 모드: spec draft (--spec)  
검토일: 2026-05-23  
대상: `plan/in-progress/multiturn-error-preserve.md`

---

## 발견사항

### [WARNING] `spec/conventions/conversation-thread.md §1.1` — `system_error` source 등록 없이 참조
- **target 위치**: 작업 축 B ("에러를 conversation thread 의 system_error item 으로 인라인 표시"), 영향 spec 표의 `conversation-thread.md §1.1` 행
- **위반 규약**: `spec/conventions/interaction-type-registry.md §2 ConversationTurnSource — 처리 분기 매트릭스`
- **상세**: target 문서는 `system_error` 를 `ConversationTurnSource` 신규 값으로 추가하겠다고 명시한다. `interaction-type-registry.md §2.1` 은 enum 값 5개 (`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`) 만 등재하며, 신규 값은 반드시 본 매트릭스에 행이 추가돼야 한다("등록되지 않은 값을 코드에 추가하면 `interaction-type-exhaustiveness.test.ts` 가 hard fail"). target 문서는 `interaction-type-registry.md §2.1` 에 `system_error` 행을 추가하겠다고 영향 spec 표(`spec/conventions/interaction-type-registry.md §2.1` 행)에서 명시하고 있으므로 의도 자체는 규약을 인식하고 있다. 그러나 `§2.1` 에 등재할 **처리 분기 위치 3종** 이 `conversation-thread.md §1.1` 행만 언급되고, 실제로 `spec/conventions/interaction-type-registry.md §2.1` 갱신 대상으로 독립 행을 영향 spec 표에 포함시켜야 한다는 점이 명시돼 있음에도, 영향 spec 표에서 `interaction-type-registry.md §2.1` 의 `system_error` 행 추가 내용을 기술하는 표 행 자체가 존재하지 않는다 — `spec/conventions/interaction-type-registry.md §2.1` 항목이 영향 spec 표에 누락돼 있다.
- **제안**: 영향 spec 표에 `spec/conventions/interaction-type-registry.md §2.1` 행을 추가하고 `system_error` 의 분기 위치 3종 (`threadTurnsToConversationItems` switch / `ConversationTimelineItem` 렌더 분기 / `conversation-thread.md §9.1` 매핑표) 을 그 행의 변경 내용으로 기술한다. (현재 target 문서 본문 작업 축 B 마지막 bullet 에 이 세 위치가 서술돼 있으나, 영향 spec 표와 분리된 채 plan 본문에만 존재한다.)

---

### [WARNING] `spec/conventions/data-hydration-surfaces.md §1` — 신규 `output.error` hydration surface 행의 영향 spec 표 기재 방식이 충분하지 않음
- **target 위치**: 영향 spec 표 `spec/conventions/data-hydration-surfaces.md §1` 행
- **위반 규약**: `spec/conventions/data-hydration-surfaces.md §3 신규 field 추가 절차` — "본 매트릭스 §1 에 행 추가 — backend echo 위치 + frontend hydration 함수 N개 모두 나열"
- **상세**: target 문서는 `data-hydration-surfaces.md §1` 에 `output.error` (multi-turn error 종결) 행을 추가하겠다고 기술하고, surface 4종 (`parseHistoryMessages`, `threadTurnsToConversationItems`, `applyExecutionSnapshot`, WS 이벤트 APPEND) 을 나열한다. 그러나 `data-hydration-surfaces.md §3` 이 요구하는 "backend echo 위치" (handler 의 어느 종결 분기에서 emit 하는지) 가 이 행에 명시돼 있지 않다. `data-hydration-surfaces.md §1.1` 기존 행 패턴은 "Backend echo 위치" 컬럼에 구체적인 핸들러 종결 분기(예: "single-turn out · multi-turn user_ended / max_turns / condition / error")를 요구한다.
- **제안**: `output.error` hydration surface 행에 backend echo 위치로 "multi-turn error 종결 시 `buildMultiTurnFinalOutput` 의 `errorPayload` 경로" 를 명시한다.

---

### [WARNING] `spec/conventions/node-output.md Principle 3.2` — 신규 2계층 sub-section 위치 명명이 규약과 불일치 가능성
- **target 위치**: 영향 spec 표 `spec/conventions/node-output.md Principle 3.2` 행 — "선택 공통 표준 필드 (LLM 계열 노드 한정 필수)" sub-section 신설
- **위반 규약**: `spec/conventions/node-output.md Principle 3.2` 현재 본문 (`details` 는 선택적, 노드별 스키마) 및 규약 문서 일관성
- **상세**: 현재 `node-output.md Principle 3.2` 는 `details` 필드에 대해 "선택적, 노드별 스키마" 라고 단일 레이어로 정의한다. target 문서는 이를 "선택 공통 표준 필드 (LLM 계열 한정 필수)" sub-section + "노드별 선택 스키마" 두 계층으로 분리하겠다고 한다. 분리 자체는 규약 갱신 범위이므로 전혀 금지된 것이 아니나, 새 sub-section 이름("선택 공통 표준 필드")이 기존 Principle 명명 체계(`Principle 3.1`, `3.2`, `3.3` 형태)와 달리 번호 없는 소제목 형태로 기술되고 있다. `node-output.md` 내 기존 sub-section은 모두 `### 3.N.<숫자>` 형태 (예: `3.1`, `3.2`, `3.3`) 를 사용하므로, 신설 sub-section에 `### 3.2.1`(LLM 계열 한정 필수 표준 필드) / `### 3.2.2`(노드별 선택 스키마) 같은 번호가 적절하다.
- **제안**: 영향 spec 표에서 sub-section 명칭에 `3.2.1` / `3.2.2` 형태의 번호 체계를 명시해 기존 `node-output.md` 절 번호 패턴과 일관성을 유지한다.

---

### [WARNING] `retryAfterSec` 와 `retryable=false` 동시 set 금지 — 검사 주체 지정이 모호
- **target 위치**: 작업 축 C, `output.error.details` 표준 필드 정의 bullet — "`retryable=true` 일 때만 set 가능 (false 와 함께 set 시 spec 위반 — `convention-compliance` checker 가 발견)"
- **위반 규약**: `spec/conventions/node-output.md Principle 3.2` (output.error 표준 형태) — 현재 규약에는 `retryAfterSec` + `retryable=false` 동시 set 금지 규칙이 존재하지 않음
- **상세**: target 문서는 "`retryable=false` 와 `retryAfterSec` 동시 set 시 spec 위반이며 `convention-compliance` checker 가 발견한다" 고 명시한다. 그러나 현재 `spec/conventions/node-output.md` 에는 이 invariant 가 정의되지 않았고, `spec/conventions/conversation-thread.md §1.6` 의 consistency-checker 책임 목록에도 이 항목이 없다. checker 가 발견하려면 먼저 **어느 spec 문서 어느 절에 이 invariant 가 단일 진실로 정의되는지** 가 명시돼야 한다. checker 가 검사할 규약의 SoT 가 누락된 채 "checker 가 발견한다"고만 기술되어 있다.
- **제안**: 영향 spec 표의 `node-output.md Principle 3.2` 갱신 내용에 "retryable=false 와 retryAfterSec 동시 set 금지" invariant 를 명문화하거나, 또는 `conversation-thread.md §1.6` 의 consistency-checker 책임 목록에 이 항목을 추가하는 별 행을 영향 spec 표에 포함시킨다.

---

### [INFO] `_retryState` 관련 `spec/conventions/node-output.md Principle 4.2` 갱신 표현 — strip 예외 목록과 4.2 현재 본문의 정합
- **target 위치**: 영향 spec 표 `spec/conventions/node-output.md Principle 4.2` 행
- **위반 규약**: `spec/conventions/node-output.md Principle 4.2` 현재 본문 — "`_multiTurnState` → `_resumeState`로 통일" 및 internal 필드 목록 정의
- **상세**: target 문서는 Principle 4.2 에 `_retryState` 의 strip 예외를 추가하겠다고 한다. 현재 Principle 4.2 는 "폐기할 필드 / 구조" 를 열거하며 `_resumeState` 가 내부 비노출 필드임을 기술한다. target 에서 제안하는 갱신 내용("stripControlFields() 가 `_resumeState` 는 제거하지만 `_retryState` 는 보존")은 Principle 4.2 의 원래 취지(폐기·internal 필드 목록)와 다소 이질적으로, "보존 예외" 는 별도 sub-item 또는 주석 형태로 명시해야 기존 독자가 혼동하지 않는다. 현재 영향 spec 표 서술만으로는 Principle 4.2 본문에서 어느 위치(문단 어디)에 예외를 삽입할지 불분명하다.
- **제안**: 영향 spec 표 Principle 4.2 행 변경 내용에 "폐기 필드 목록 뒤 별도 sub-item `**보존 예외**:` 으로 `_retryState`를 strip 예외로 명시" 형태의 삽입 위치를 구체화한다.

---

### [INFO] `spec/conventions/conversation-thread.md §9.7` SoT 기술 — 상수명 spec 비노출 정책 준수 여부
- **target 위치**: 영향 spec 표 `conversation-thread.md §9.7` 행 및 Rationale "상수명을 spec 본문에 노출하지 않는 이유"
- **위반 규약**: 특정 금지 규약은 없으나 CLAUDE.md "단일 진실 원칙" 및 spec-코드 drift 회피 관행
- **상세**: target 문서의 Rationale 절에 `CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT` 상수명을 spec 본문에 노출하지 않겠다고 명시하고 있으며, 영향 spec 표 `§9.7` 행도 "본 SoT 의 의미는 'store reset 정책' 으로 명세하고 상수명은 구현 세부사항" 이라고 기술한다. 이는 spec 규약의 취지와 일치한다. 단, plan 본문 작업 축 A에서는 두 상수명을 명시적으로 기술하고 있는데, 이는 plan 문서(구현 가이드) 레벨이라 spec 규약과 무관하다. 추가 조치 불필요하나, 규약 준수 의도가 정확히 반영되었음을 확인 차 기록한다.
- **제안**: 현재 기술 그대로 유지. INFO 수준이며 수정 불필요.

---

### [INFO] 문서 구조 — plan 문서의 3섹션 구성 준수
- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 단, plan 문서는 spec 문서가 아님
- **상세**: plan 문서는 spec 문서의 3섹션 (Overview / 본문 / Rationale) 규칙 적용 대상이 아니다. `plan/in-progress/` 문서 구조에 대한 별도 형식 규약은 `plan-lifecycle.md` 에 frontmatter 스키마만 명시되어 있으며, target 문서는 `worktree`, `started`, `owner` frontmatter 를 모두 포함하고 있다. 규약 준수 상태 양호.
- **제안**: 현재 기술 그대로 유지. INFO 수준이며 수정 불필요.

---

## 요약

`plan/in-progress/multiturn-error-preserve.md` 는 전반적으로 정식 규약(`spec/conventions/`) 의 구조·참조 방식을 충실히 따르고 있다. `interaction-type-registry.md §2.1` 에 `system_error` 행 추가가 필요하다는 점을 plan 본문 작업 축 B 에서는 인식하고 있으나, 영향 spec 표에 해당 파일 갱신 행이 독립적으로 빠져 있다는 점이 WARNING 수준의 누락이다. `data-hydration-surfaces.md §3` 이 요구하는 backend echo 위치 기술이 해당 행에 불충분하고, `node-output.md Principle 3.2` 신설 sub-section 의 번호 체계가 기존 패턴과 불일치하며, `retryAfterSec+retryable=false` 동시 set 금지 invariant 의 spec SoT 가 누락된 상태로 "checker 가 발견한다" 고만 기재된 점도 WARNING 이다. CRITICAL 급 규약 위반 (직접적인 기존 invariant 파괴·명시 금지 패턴 채택) 은 발견되지 않았다.

## 위험도

LOW
