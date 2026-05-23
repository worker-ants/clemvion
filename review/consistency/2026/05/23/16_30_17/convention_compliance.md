# 정식 규약 준수 검토 — plan/in-progress/multiturn-error-preserve.md

검토 모드: spec draft (--spec)
검토 일자: 2026-05-23

---

## 발견사항

### [WARNING] frontmatter `owner` 필드가 worktree 이름과 동일 — 역할/이름 미기재
- target 위치: plan 문서 상단 frontmatter (라인 4)
- 위반 규약: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마
- 상세: 스키마에서 `owner` 는 `<역할/이름>` (예: `planner` / `developer` / 사용자 본인 등) 을 요구한다. 현재 값 `multiturn-error-preserve` 는 `worktree` 필드 값과 동일 — 역할·담당자 식별 기능이 전혀 없다. CLAUDE.md 도 동일하게 "역할/이름" 을 명시한다.
- 제안: `owner: project-planner` 또는 실제 담당자 이름/역할로 교체.

---

### [WARNING] `system_error` 신규 source 추가 계획이 §9.1 의 `source` 순서 규칙과 상충될 수 있음
- target 위치: 작업 축 B (라인 53~57) + 영향 spec 표 §9.1 행
- 위반 규약: `spec/conventions/conversation-thread.md` §9.1 — 현행 표에 `system_error` 행이 없으며, §1.1 `ConversationTurnSource` 열거에도 없음
- 상세: plan 이 `system_error` 를 신규 source 로 추가한다고 명시하면서, §1.1 표·§9.1 표·§9.2 3중 신호 매핑을 모두 갱신한다고 기술한다. 그 자체는 올바른 절차이나, §9.2 의 3중 시각 구분 신호 (아이콘 / 컨테이너 / chip) 적용이 `system_error` 에 어떻게 달라지는지 plan 본문에는 아이콘만 언급(`❌`)되어 있고 컨테이너 형식("에러 라인") 과 chip 적용 여부가 불명확하다. 규약은 3중을 동시 의무화하므로, 단 하나라도 누락·미정의 상태로 spec 을 갱신하면 §9.2 위반이 된다.
- 제안: 영향 spec 표의 §9.1 행 변경 내용에 3중 신호를 모두 명시할 것. 예: "컨테이너 형식: 가운데 정렬 얇은 빨간 라인 (full-width card 아님), chip: `<nodeLabel> · <code>` 노출, 아이콘: ❌".

---

### [WARNING] `spec/conventions/node-output.md` Principle 3.2 신규 필드 추가 계획이 현행 `details` 설명과 충돌
- target 위치: 작업 축 C (라인 61~63) + 영향 spec 표 Principle 3.2 행
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — 현행 텍스트: "`details` 는 선택적, 노드별 스키마". `retryable` 을 "필수" 로 추가하면 "노드별(선택적)" 의미가 아닌 cross-node 표준 필수 필드가 된다.
- 상세: plan 은 `retryable: boolean` 을 "필수 — 핸들러가 분류해서 set" 으로 지정한다. 그런데 현행 규약은 `details` 를 "노드별 선택적 스키마" 로만 기술한다. plan 이 이를 "표준 필드" 로 격상하려면 Principle 3.2 본문 자체의 표 구조를 "선택적 노드별 필드" 와 "LLM 계열 공통 표준 필드" 로 분리해야 한다. 이를 명시하지 않으면 `details.retryable` 이 있는 노드와 없는 노드가 Principle 3.2 의 "노드별" 허용 하에 혼재하게 되어 consumer 가 필드 보장 여부를 알 수 없다.
- 제안: plan 의 "영향 spec" §node-output.md Principle 3.2 행에서 "표준 필드 계층" 도입 방식을 명시. 예: "Principle 3.2 를 `output.error.details` 선택 공통 표준 필드(LLM 계열 한정) vs 노드별 필드 2계층으로 구분하는 sub-section 추가. `retryable` (필수, LLM 계열) 와 `retryAfterSec?` (선택, LLM 계열) 을 상단 표에 열거".

---

### [INFO] `ConversationTurn.data?` 확장 계획에서 §1.2 SoT 지정 방식 미명시
- target 위치: 영향 spec 표 `spec/conventions/conversation-thread.md §1.2` 행 (라인 83)
- 위반 규약: `spec/conventions/conversation-thread.md` §1.2 — `data?` 필드 비고에 "shape 은 node-output §4.5 의 단일 정의를 따른다 (drift 회피 위해 본 표에 재열거하지 않음)"
- 상세: §1.2 는 `data?` shape 을 node-output §4.5 단일 정의에 위임한다. 그런데 plan 은 `system_error` source 의 `data?` shape (`{ code, message, retryable, retryAfterSec?, nodeId, nodeLabel }`) 을 §1.2 비고에 직접 cross-ref 로 기재할 것을 제안한다. node-output §4.5 는 presentation 노드용 interaction payload 정의이므로 system_error 용 shape 은 §4.5 범위 밖이다. 이를 §1.2 에만 cross-ref 로 두면 §4.5 위임 규칙과 어긋나지는 않으나, SoT 가 어디(§1.2 비고 인라인인지 node-output §4.5 신규 항목인지)인지 plan 에서 명확히 하지 않는다.
- 제안: plan 의 §1.2 변경 설명에 "system_error payload shape 의 SoT 는 §1.2 비고 인라인으로 직접 정의 (§4.5 는 presentation interaction 전용이라 scope 외)" 임을 한 줄 명시. drift 방지를 위해 §1.2 와 §1.1 간 상호 링크도 함께 기재.

---

### [INFO] `§9.7` 변경을 동일 셀에 두 개 별도 행으로 중복 기술
- target 위치: 영향 spec 표 라인 85~86 (두 개의 `spec/conventions/conversation-thread.md §9.7` 행)
- 위반 규약: 정식 규약 중 직접 위반은 아니나, CLAUDE.md 정보 저장 위치 "단일 진실 원칙" 의 정신 위반
- 상세: 영향 spec 표에서 `spec/conventions/conversation-thread.md §9.7` 이 두 개의 별도 행으로 나뉜다. 표의 `파일` 컬럼이 동일한 두 행이 존재하면 향후 갱신 시 한 행만 수정하는 실수가 생길 수 있다.
- 제안: §9.7 관련 변경 내용을 단일 행으로 합쳐 기술.

---

### [INFO] `Open Questions` 중 "본 PR 범위 안"으로 기재된 OQ3 가 실제로 결정됐는지 불분명
- target 위치: Open Questions OQ3 (라인 137)
- 위반 규약: `.claude/docs/plan-lifecycle.md` §2 — "결정 필요 항목이 하나라도 있으면 in-progress"
- 상세: OQ3 본문이 "본 PR 범위 안" 이라고 하면서도 구체적인 구현 내용이 미확정인 상태로 기술된다. `parseHistoryMessages` 변경이 범위 안에 포함된다면 영향 codebase 표 및 TDD 순서에 해당 항목이 누락된다. plan 의 Open Questions 섹션에 OQ3 가 여전히 미결인지 결정 완료인지 구분하는 표식이 없다.
- 제안: OQ3 를 "결정 완료 — parseHistoryMessages 수정 포함" 또는 "미결 — OQ3 escalate 후보" 로 명확히 표시. 포함 결정 시 영향 codebase 표와 TDD 순서에 해당 항목 추가.

---

## 요약

`plan/in-progress/multiturn-error-preserve.md` 는 정식 규약(`plan-lifecycle.md`, `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`) 과의 정합성을 전반적으로 잘 의식하고 작성되었다. 특히 spec 변경 목록을 세밀하게 열거하고 Rationale 을 풍부하게 서술하는 점은 규약 준수에 긍정적이다. 다만 세 가지 WARNING 이 발견된다: (1) frontmatter `owner` 필드가 역할/이름을 전혀 특정하지 않고 worktree 이름을 그대로 복사했다는 점, (2) 신규 `system_error` source 에 대한 §9.2 3중 시각 신호 전체 정의가 plan 본문에서 누락되어 spec 갱신 후에도 규약 위반 상태가 될 가능성이 있다는 점, (3) `node-output.md` Principle 3.2 의 "노드별 선택적" 성격이 "LLM 계열 공통 필수 필드" 신설과 충돌할 수 있다는 점이다. 이 세 항목은 실제 spec 문서 작성 단계에서 반드시 반영해야 한다.

---

## 위험도

MEDIUM
