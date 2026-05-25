# 정식 규약 준수 검토 — convention_compliance

**검토 대상**: `plan/in-progress/chat-channel-template-render-outbound.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-25

---

## 발견사항

### [CRITICAL] plan 문서 파일명 — `spec-draft-` prefix 누락

- **target 위치**: 파일명 `plan/in-progress/chat-channel-template-render-outbound.md`
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §작업 워크플로 step 3`
  - "draft 작성: `plan/in-progress/spec-draft-<name>.md` 에 변경안 작성"
- **상세**: project-planner SKILL.md 는 spec draft 문서를 `spec-draft-<name>.md` 명명 패턴으로 `plan/in-progress/` 에 보관하도록 의무화하고 있다. 현재 파일명 `chat-channel-template-render-outbound.md` 는 `spec-draft-` prefix 를 갖지 않는다. 기존 참조 파일 `plan/in-progress/spec-draft-chat-channel-error-notify.md` 는 해당 패턴을 준수하고 있다. 해당 naming convention 위반은 `plan_coherence` checker (consistency-checker) 가 spec draft 와 in-progress task plan 을 혼동할 수 있는 invariant 파괴다.
- **제안**: 파일명을 `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md` 로 변경한다. 이때 별도 task-tracking plan (`chat-channel-template-render-outbound.md`) 이 함께 필요하면 `chat-channel-error-notify.md` + `spec-draft-chat-channel-error-notify.md` 쌍 패턴처럼 분리 생성한다.

---

### [WARNING] plan frontmatter — `owner` 필드 이외의 비표준 필드 부재 (참고: 표준 필드 충족 여부)

- **target 위치**: 파일 상단 frontmatter (`worktree`, `started`, `owner` 3필드)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  - 필수: `worktree`, `started`, `owner` 3필드
- **상세**: 필수 3필드(`worktree: chat-channel-template-render-outbound-2f8164`, `started: 2026-05-25`, `owner: project-planner`)는 모두 존재하며 형식도 정확하다. 단, `chat-channel-error-notify.md` 처럼 `status: in-progress` 나 `related_specs:` 같은 선택 필드가 spec-draft 역할 문서에 있으면 가독성에 유리하지만 이는 의무가 아니다. **이 자체가 위반은 아님** — 필수 필드는 모두 충족. INFO 성격으로 기록하되 WARNING 으로 분류한 이유는 spec draft 임을 frontmatter 에서 식별할 수 없는 점이 plan 분류에 혼동을 줄 수 있기 때문이다. (`draft_for:` 같은 참조 필드가 없음 — `spec-draft-chat-channel-error-notify.md` 는 `draft_for: chat-channel-error-notify.md` 를 선언함.)
- **제안**: frontmatter 에 `draft_for: chat-channel-template-render-outbound.md` (별도 task-tracking plan 이 있는 경우) 또는 `type: spec-draft` 를 추가해 파일 역할을 명시한다. 규약 자체에는 이 필드가 없으므로 규약 갱신(plan-lifecycle.md §4 에 선택 필드 `type` 추가) 이 더 깔끔할 수 있다.

---

### [WARNING] Spec 갱신안 A — `§1.2 EiaAiMessageEvent` 보강안이 현행 컨벤션 §1.2 의 union 형식 스타일과 불일치

- **target 위치**: 문서 `## Spec 갱신안 / A. spec/conventions/chat-channel-adapter.md / §1.2 EiaEvent union` 코드블록
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §1.2`의 현행 스타일 (각 union 멤버가 한 줄 인라인 주석 형태)
- **상세**: 현행 `chat-channel-adapter.md §1.2` 의 `EiaEvent` union 은 각 멤버를 `| { type: "..."; /* EIA §N */ ...필드... }` 의 인라인 단일 행 패턴으로 정의한다. 제안하는 draft 코드블록은 `execution.ai_message` 멤버를 여러 줄 블록 (`/** AI Agent... */` JSDoc 블록 + 분리 행) 으로 표기하고 있다. 또한 `execution.node.completed` 멤버도 멀티라인이다. 이것이 컨벤션 자체를 위반하는 것은 아니지만(컨벤션은 실제 소스 코드가 아닌 spec 문서), draft 의 표기가 현행 컨벤션 파일의 문체(스타일)와 다른 점은 spec 반영 시 style drift 를 일으킨다.
- **제안**: draft 코드블록을 현행 §1.2 의 인라인 주석 스타일로 맞춘다. 멀티라인 JSDoc 은 인라인 `/* ... */` 로 압축하거나, 컨벤션 파일 자체의 표기 스타일을 갱신할 경우 갱신 의도를 Changelog 에 명시한다.

---

### [WARNING] Spec 갱신안 A — `EiaNodeCompletedEvent` 를 EIA §6.1 "5종 화이트리스트에 없음" 으로 명시하면서도 `EiaEvent` union 에 포함시키는 일관성 모순

- **target 위치**: 문서 `## Spec 갱신안 / A / §1.2` 코드블록 마지막 멤버 (`/** chat-channel-internal — EIA §6.1 outbound 화이트리스트 5종에는 없음 ... */`) 및 §3 매핑 표
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §1.2` 두문 설명 — "EiaEvent 는 EIA §6 outbound notification payload 의 5종 union"
- **상세**: 현행 컨벤션 §1.2 는 `EiaEvent` 를 명시적으로 "EIA §6 outbound notification 의 5종 union" 으로 규정한다. draft 는 이 union 에 `execution.node.completed` 를 6번째로 추가하면서 "chat-channel-internal — EIA §6.1 outbound 화이트리스트 5종에는 없음" 이라는 주석을 달고 있다. 이는 `EiaEvent` 의 정의 자체(5종 union)를 변경하는 것이면서 주석만으로 "EIA 화이트리스트와 다름" 을 설명하는 불완전한 형태다. 컨벤션 도입부 문장("5종 union") 을 동시에 갱신하지 않으면 컨벤션 내부 모순이 된다.
- **제안**: 두 가지 선택지:
  1. `EiaEvent` union 도입부 설명을 "5종 EIA outbound notification union + chat-channel-internal 이벤트" 로 갱신하고, `EiaNodeCompletedEvent` 를 별도 타입(`ChatChannelInternalEvent` 또는 `NodeCompletedInternalEvent`)으로 분리해 `renderNode` 함수 시그니처를 확장하는 방안.
  2. `EiaEvent` 는 5종 그대로 유지하고, chat-channel-internal 이벤트는 별도 `NodeCompletedEvent` 타입으로 정의해 dispatcher 가 별도 메서드 (`renderPresentationNode(event: NodeCompletedEvent)`) 로 처리하는 방안. 어느 쪽이든 §1.2 도입부와 type 정의가 모순 없이 일치해야 한다.

---

### [WARNING] Spec 갱신안 A §3 매핑 표 — `execution.node.completed` 행의 출력 컬럼이 기존 매핑 표 스타일과 불일치

- **target 위치**: 문서 `## Spec 갱신안 / A / §3 매핑 표 신규/갱신 행` 의 두 번째 행 (출력 ChannelMessage 시퀀스 컬럼)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §3` 매핑 표 스타일 — 입력과 출력 컬럼이 간결하게 구분됨
- **상세**: 현행 §3 매핑 표의 출력 컬럼은 1~2문장 수준으로 구조화돼 있다. draft 의 `execution.node.completed` 행의 출력 컬럼은 대폭 길며 굵은 글씨(`**buttons 가 있는 (blocking) 케이스는...**`) 까지 포함해 표 셀 안에 마크다운 강조가 쓰였다. 기존 §3 표 셀들은 볼드 없이 일반 텍스트 + 괄호 메모 패턴을 쓴다.
- **제안**: 굵은 글씨를 제거하고 "(blocking 케이스 제외 — `CCH-MP-02/04` 처리)" 수준으로 간결화한다. 상세 예외 조건은 별도 각주나 인접 단락에 서술한다.

---

### [INFO] 절차 섹션 — `/consistency-check --spec` 체크박스가 미완으로 남아있음 (정상이나 명시적 확인)

- **target 위치**: 문서 `## 절차` 의 두 번째 항목 `[ ] /consistency-check --spec 호출 → BLOCK:NO 확인`
- **위반 규약**: 해당 없음 (이 파일 자체가 그 선행 단계이므로 미완이 정상)
- **상세**: `[ ]` 상태는 이 review 의 입력임을 감안할 때 정상 상태다. 다만 파일이 `in-progress/` 에 위치하는 것은 plan-lifecycle §2 기준과 일치 (미체크 항목 존재 = in-progress 유지).
- **제안**: 본 review 완료 후 체크박스를 `[x]` 로 갱신하는 것을 잊지 않는다.

---

### [INFO] 문서 제목 — 3섹션 구조 (Overview / 본문 / Rationale) 미적용

- **target 위치**: 문서 전체 구조 — `## 회귀 원인`, `## 진단`, `## 결정`, `## Spec 갱신안`, `## 영향 평가`, `## 절차`, `## 담당` 섹션
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — `## Overview (제품 정의)` / 본문 / `## Rationale` 권장
- **상세**: SKILL.md 는 spec 문서에 Overview / 본문 / Rationale 3섹션을 권장한다. 그러나 이 파일은 `plan/in-progress/` 의 spec-draft plan 이며, `spec/` 에 적재되는 최종 spec 문서가 아니다. plan draft 파일의 섹션 구조는 컨벤션이 강제하지 않는다. 현재 `## Spec 갱신안` 안에 Rationale 상당의 결정 근거(`## 결정 / 근거:` 및 `기각 대안:`)가 포함돼 있어 내용은 갖춰져 있다.
- **제안**: plan draft 문서라서 이 자체는 규약 위반이 아니므로 조치 불필요. 다만 spec 반영 단계(`spec/conventions/chat-channel-adapter.md` 갱신 시)에서는 `## Rationale` 섹션에 결정 근거를 이동하는 것을 확인한다.

---

## 요약

`plan/in-progress/chat-channel-template-render-outbound.md` 는 정식 규약 준수 관점에서 **CRITICAL 1건, WARNING 4건, INFO 2건** 이 발견됐다. 가장 중요한 위반은 파일명의 `spec-draft-` prefix 누락으로, project-planner SKILL.md 가 의무화한 spec draft 명명 컨벤션(`spec-draft-<name>.md`)을 따르지 않아 consistency-checker 의 `plan_coherence` 분류가 이 파일을 task-tracking plan 으로 오인할 수 있다. 내용 측면에서는 `EiaEvent` union 에 chat-channel-internal 이벤트(`execution.node.completed`)를 포함시키면서 도입부 5종 정의 문장을 함께 갱신하지 않아 컨벤션 내부 모순이 발생하는 WARNING 도 주의를 요한다. 나머지 WARNING 들은 코드 스타일 일관성과 표 표기 방식에 관한 것으로, spec 반영 단계에서 함께 정리하면 된다.

## 위험도

**MEDIUM**

(CRITICAL 1건은 naming convention 위반이나 내용 품질에 영향을 미치지 않음. 단 plan 분류 invariant 오염 가능성이 있어 MEDIUM 유지.)
