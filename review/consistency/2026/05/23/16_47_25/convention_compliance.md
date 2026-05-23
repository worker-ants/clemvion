# Convention Compliance Review

**Target**: `plan/in-progress/multiturn-error-preserve.md`
**Mode**: `--spec` (spec draft 검토)
**Date**: 2026-05-23

---

## 발견사항

### [INFO] Plan 문서 자체는 conventions 파일이 아님 — 직접 적용 제한

- target 위치: 문서 전체
- 위반 규약: 해당 없음 (배경 정보)
- 상세: `plan/in-progress/*.md` 는 `spec/conventions/**` 포맷 규약의 직접 적용 대상이 아니다. 본 검토는 plan 이 제안하는 spec 변경 내용이 기존 정식 규약과 충돌하거나, plan 자체의 문서 구조·명명이 CLAUDE.md 규칙을 위반하는지를 점검한다.

---

### [INFO] Plan frontmatter — 정합

- target 위치: 문서 최상단 frontmatter
- 위반 규약: `.claude/docs/plan-lifecycle.md` §4 frontmatter 스키마
- 상세: `worktree: multiturn-error-preserve`, `started: 2026-05-23`, `owner: project-planner` 세 필드가 모두 정의되어 있고 스키마 요건과 일치한다. 문제 없음.

---

### [INFO] Plan 문서 구조 — Rationale 절 있음

- target 위치: `## Rationale` 섹션
- 위반 규약: CLAUDE.md "정보 저장 위치 > 결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: plan 에 `## Rationale` 절이 포함되어 있다. plan 은 spec 문서가 아니므로 Rationale 위치 규칙의 직접 대상은 아니지만, 내용 측면에서 plan 본문 안에 Rationale 을 포함하는 것은 허용된 관행이다. 실제 정식 spec 에 반영 시 각 spec 파일 말미의 `## Rationale` 에 위치해야 한다는 점을 영향 spec 표가 명시하고 있어 준수 의도가 보인다. 문제 없음.

---

### [WARNING] `system_error` source 신설 — 기존 §1.1 표에 없는 값이나 규약 갱신 절차 명시 필요

- target 위치: plan §B "ConversationTurnSource 에 새 source `system_error` 추가"
- 위반 규약: `spec/conventions/conversation-thread.md §1.1` ConversationTurnSource 표 (현행 5값 enum: `presentation_user` / `ai_user` / `ai_assistant` / `ai_tool` / `system`)
- 상세: 현행 규약에 `system_error` 는 존재하지 않는다. plan 은 `spec/conventions/conversation-thread.md §1.1` 표에 신규 행 추가를 명시하고 있으므로 규약 갱신 의도는 명확하다. 단, plan 이 "구현 의도" 를 기술하는 수준을 넘어 구체적인 spec 변경 섹션을 지목(§1.1, §1.2, §9.1, §9.2, §9.6, §9.7, §9.9, §9.10, §10)하고 있기 때문에, 해당 spec 을 실제 갱신하기 전까지는 규약 위반 상태다. 구현 turn 착수 전 spec 갱신이 선행되어야 한다.
- 제안: project-planner 가 `spec/conventions/conversation-thread.md` §1.1, §1.2, §9.1, §9.2, §9.6, §9.7, §9.9, §9.10, §10 을 plan 의 영향 spec 표 대로 갱신한 뒤 developer 에게 위임. plan 에 "spec 갱신 완료" 체크박스가 없으므로 추가를 권장.

---

### [WARNING] `output.error.details.retryable` / `retryAfterSec` 신규 필드 — Principle 3.2 현행 규약에 없음

- target 위치: plan §C "output.error.details 에 두 신규 표준 필드"
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 `output.error` 표준 형태 — 현행 `details` 는 "선택적, 노드별 스키마"로만 기술되어 있으며 `retryable` / `retryAfterSec` 필드가 정의되지 않음
- 상세: 현행 Principle 3.2 는 `details` 를 완전히 자유 노드별 스키마로 정의한다. plan 은 이를 2계층(LLM 계열 한정 필수 sub-section 신설)으로 분리하겠다고 명시하고 있어, 구현 전 spec 갱신이 필수다. 또한 `retryAfterSec` 는 `retryable=false` 일 때 set 하면 "spec 위반"이라고 plan 스스로 기술하는데, 그 위반 판정 기준이 현재 spec 에 존재하지 않는다 — 즉 checker 가 아직 검사할 근거가 없다.
- 제안: `spec/conventions/node-output.md` Principle 3.2 를 plan §C 기술대로 갱신한 뒤 개발 착수. `retryAfterSec` set 조건(`retryable=true` 일 때만) 을 spec 에 invariant 로 명시.

---

### [WARNING] `_retryState` internal 필드 — Principle 4.2 현행 strip 정책과 상충

- target 위치: plan §C "_resumeState 보존 정책 — R1 확정" 및 영향 spec 표의 `spec/conventions/node-output.md` Principle 4.2 항목
- 위반 규약: `spec/conventions/node-output.md` Principle 4.2 폐기/internal 필드 목록 — 현행은 `_resumeState` strip 을 무조건 적용
- 상세: 현행 Principle 4.2 는 `_resumeState` 를 "폐기할 필드" 중 하나로 열거하며 strip 정책을 명시한다. plan 은 retryable error 종결 시 `_retryState` 를 strip 예외로 보존하겠다고 기술하고, 영향 spec 표에서 Principle 4.2 갱신을 명시한다. R1 결정이 확정된 상태이므로 방향성은 결정됐지만, spec 갱신이 이루어지기 전까지는 현행 규약과 plan 의 설계가 충돌한다.
- 제안: `spec/conventions/node-output.md` Principle 4.2 에 `_retryState` 의 strip 예외 조건을 명시한 뒤 개발 착수. plan 은 해당 spec 변경이 선행임을 체크박스로 표시할 것.

---

### [WARNING] `execution.retry_last_turn` WS 명령 — §4.2 현행 규약에 없음

- target 위치: plan §C "새 WS 명령 `execution.retry_last_turn`" 및 영향 spec 표 `spec/5-system/6-websocket-protocol.md §4.2`
- 위반 규약: `spec/conventions/` 직접 파일은 아니나 plan 이 "ack 패턴은 기존 `execution.<cmd>.ack` 패턴 준수"를 명시 — 이 ack 패턴은 규약화된 표준임
- 상세: plan 의 ack payload 설계 자체는 기존 `execution.click_button.ack` (`resumed` flag) + `execution.submit_form` reject (`error` 객체) 패턴을 조합하여 규약 정신을 따른다. 그러나 현행 `spec/5-system/6-websocket-protocol.md §4.2` 표에 해당 명령이 부재하므로, 구현 착수 전 spec 갱신이 선행되어야 한다.
- 제안: `spec/5-system/6-websocket-protocol.md §4.2` 에 `execution.retry_last_turn` 행을 plan 기술대로 추가 후 개발 착수.

---

### [INFO] `data.nodeId` 타입 — UUID 명시

- target 위치: plan §B `ConversationTurn.data` payload — `nodeId: UUID`
- 위반 규약: `spec/conventions/conversation-thread.md §1.2` — `nodeId` 필드는 `UUID` 타입
- 상세: 기존 `ConversationTurn.nodeId` 필드가 UUID 타입으로 정의되어 있고, plan 의 `system_error` payload 내 `nodeId` 도 UUID 로 일치한다. 형식 정합.

---

### [INFO] `code` 값 `UPPER_SNAKE_CASE` 준수

- target 위치: plan §C 에러 코드 3종 (`INVALID_RESUME_TOKEN`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`)
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — "`code` 는 `UPPER_SNAKE_CASE`"
- 상세: 세 에러 코드 모두 UPPER_SNAKE_CASE 를 준수한다. 기존 에러 코드 패턴(`LLM_RATE_LIMITED`, `LLM_CALL_FAILED`, `LLM_RESPONSE_INVALID`)과 형식 일치. 문제 없음.

---

### [INFO] `retryAfterSec` 필드명 — camelCase 일관성

- target 위치: plan §C `retryAfterSec?: number` 필드명
- 위반 규약: `spec/conventions/node-output.md` 전반 — 필드명은 camelCase
- 상세: 기존 `output.error.details` 예시 필드들이 camelCase 를 사용하고 있으며 `retryAfterSec` 도 camelCase 준수. 문제 없음.

---

### [INFO] 상수명 spec 본문 비노출 — 규약 정신 부합

- target 위치: plan `## Rationale` "상수명을 spec 본문에 노출하지 않는 이유"
- 위반 규약: CLAUDE.md "단일 진실 원칙"
- 상세: plan 이 `CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT` 상수명을 spec 에 노출하지 않고 구현 세부로 분류한 근거를 명시한다. 이는 spec-코드 drift 회피를 위한 올바른 판단으로, CLAUDE.md 의 단일 진실 원칙 정신과 부합한다. 정보성 확인.

---

### [INFO] `spec/conventions/conversation-thread.md §9.7` SoT 위치 선언 — 규약 갱신 스코프 명확

- target 위치: plan §A "이 정책은 `spec/conventions/conversation-thread.md §9.7` 에 단일 정의된다"
- 위반 규약: CLAUDE.md "정보 저장 위치 > 정식 규약 → `spec/conventions/<name>.md`"
- 상세: store reset 정책의 단일 진실을 `spec/conventions/` 파일에 두는 선택은 CLAUDE.md 규칙과 정합한다. 정보성 확인.

---

### [WARNING] `spec/conventions/conversation-thread.md §9.9` Inv-6 신설 — 현행 invariant 체계에 없음

- target 위치: 영향 spec 표 `spec/conventions/conversation-thread.md §9.9` 항목
- 위반 규약: `spec/conventions/conversation-thread.md §9.9` — 현행 invariant 는 Inv-1~Inv-5 까지만 정의됨
- 상세: plan 은 Inv-6 을 신설하겠다고 기술하고 있다. Inv-6 내용("실패 시 store `conversationMessages` 는 비워지지 않는다")은 현행 invariant 체계와 상충하지 않으며 추가 확장이지만, 규약 문서 변경이 선행되어야 한다. 영향 spec 표에 명시되어 있어 의도는 명확하다.
- 제안: spec 갱신 완료 전 구현 착수 방지. 현행 §9.9 서두 스코프("§9 변경 / 구현 변경 시") 확장도 동반해야 함.

---

### [INFO] `noodeExecution` 오탈자 (plan 내부 표기)

- target 위치: plan §TDD 순서 10번 항목 — "noodeExecution" (n 이중 입력)
- 위반 규약: 해당 없음 (plan 내부 텍스트, 규약 위반 아님)
- 상세: "noodeExecution" 는 "nodeExecution" 의 오탈자. plan 본문의 가독성 문제이며 spec 규약 위반은 아니다. 향후 spec 이나 코드에 복사될 경우 오기 위험이 있어 정보성으로 기록.
- 제안: plan 파일에서 "noodeExecution" → "nodeExecution" 으로 수정.

---

## 요약

`plan/in-progress/multiturn-error-preserve.md` 는 plan 문서 형식(frontmatter 스키마, Rationale 절, 에러 코드 UPPER_SNAKE_CASE, 필드명 camelCase) 측면에서 현행 규약을 잘 따르고 있다. 그러나 plan 이 제안하는 spec 변경들 — `system_error` ConversationTurnSource 신설, `output.error.details.retryable`/`retryAfterSec` 필드 도입, `_retryState` strip 예외 정책, `execution.retry_last_turn` WS 명령 추가, Inv-6 신설 — 은 모두 현행 `spec/conventions/` 규약에 아직 반영되지 않은 상태다. plan 자체가 이를 "영향 spec 표"로 인식하고 갱신 필요성을 명시하고 있으므로, 발견사항은 규약 위반이 아닌 "spec 갱신 선행 의무"로 분류된다. 특히 developer 착수 전 `spec/conventions/conversation-thread.md` 및 `spec/conventions/node-output.md` 를 plan 기술 내용대로 갱신하지 않으면, consistency-checker 의 impl-prep 체크에서 차단될 수 있다.

---

## 위험도

**LOW** — plan 문서의 규약 직접 위반 사항은 없다. 발견된 WARNING 4건은 모두 "spec 갱신이 선행되어야 한다"는 절차 준수 권고이며, plan 이 이를 영향 spec 표로 이미 인식하고 있다. 오탈자 1건은 가독성 문제에 한정된다.
