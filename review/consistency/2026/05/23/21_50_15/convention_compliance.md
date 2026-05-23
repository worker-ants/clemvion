# 정식 규약 준수 검토 — `plan/in-progress/ai-presentation-form-inline.md`

검토 모드: spec draft (`--spec`)
검토 일시: 2026-05-23

---

## 발견사항

### 1. [WARNING] frontmatter `owner` 값이 식별자가 아닌 task slug 와 동일
- target 위치: frontmatter `owner: ai-presentation-form-inline`
- 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  - 스키마 설명: `owner: <역할/이름>` — 예시 값이 `planner / developer / 사용자 본인 등`
- 상세: `owner` 필드는 역할명(예: `project-planner`, `developer`)이나 사용자 이름을 기대한다. 현재 값 `ai-presentation-form-inline` 은 파일명·task slug 와 동일해 worktree 충돌 검출이나 담당자 추적 목적을 충족하지 못한다. 비교: 같은 날 작성된 `multiturn-error-preserve.md` 는 `owner: project-planner` 으로 올바르게 기재되어 있음.
- 제안: `owner: project-planner` 로 변경.

---

### 2. [WARNING] `interaction-type-registry.md §1.2` 매트릭스 갱신 누락 — `ai_form_render` 처리 분기 변경
- target 위치: §4.4 프론트엔드 구현 전반 (resumeFromAiRenderForm, result-detail.tsx, executions/[id]/page.tsx 등)
- 위반 규약: `spec/conventions/interaction-type-registry.md §1.2 값 → 처리 분기 매트릭스`
  - 규칙: "신규 enum 값은 본 문서 매트릭스에 반드시 등록" + "표의 모든 위치를 한 PR 안에서 동시 갱신"
- 상세: target 문서의 §4.4 가 `ai_form_render` 에 대한 처리 분기를 대대적으로 변경한다 — `result-detail.tsx` 의 `formPreview` stack 제거, `executions/[id]/page.tsx` 의 `DynamicFormUI` 분기 제거, `resumeFromAiRenderForm` 신규 action. interaction-type-registry.md §1.2 의 `ai_form_render` 행 비고 컬럼은 현재 "form input UI overlay" 와 기존 분기 목록만 열거하는데, 이 변경으로 해당 행의 Frontend 처리 분기 목록이 달라진다. 작업 단위 §4.1 Spec 갱신 목록에 `spec/conventions/interaction-type-registry.md` 가 포함되어 있지 않다.
- 제안: §4.1 Spec 갱신 목록에 `spec/conventions/interaction-type-registry.md §1.2` — `ai_form_render` 행 Frontend 처리 분기 목록 갱신을 추가한다.

---

### 3. [WARNING] `interaction-type-registry.md §3.2` Presentation type 매트릭스 갱신 누락 — `form` 행 분기 변경
- target 위치: §4.4 `assistant-presentations-block.tsx` case "form" active 분기 신설
- 위반 규약: `spec/conventions/interaction-type-registry.md §3.2 처리 분기 매트릭스`
  - `form` 행: "Frontend 렌더: `FormSubmittedContent` (interactive blocking 흐름은 별 경로)"
- 상세: target 문서는 `AssistantPresentationsBlock` 의 `case "form":` 을 `isActiveFormCall(toolCallId)` predicate 로 분기해 active 시 `DynamicFormUI`, 비활성 시 `FormSubmittedContent` 로 변경한다. 이는 현재 §3.2 `form` 행에 적힌 "interactive blocking 흐름은 별 경로" 정의와 직접 충돌한다 — 별 경로였던 interactive 경로가 `AssistantPresentationsBlock` 안으로 통합된다. §4.1 Spec 갱신 목록에 `spec/conventions/interaction-type-registry.md §3.2` 갱신이 없다.
- 제안: §4.1 Spec 갱신 목록에 `spec/conventions/interaction-type-registry.md §3.2` — `form` 행 Frontend 렌더 설명 갱신을 추가한다. (`"FormSubmittedContent (interactive blocking 흐름은 별 경로)" → "`isActiveFormCall` predicate 분기: active → DynamicFormUI / 비활성 → FormSubmittedContent"`)

---

### 4. [INFO] 문서 구조 — 3섹션 권장 (Overview / 본문 / Rationale) 중 Overview 섹션 부재
- target 위치: 문서 전체 구조
- 위반 규약: CLAUDE.md `## 정보 저장 위치` — "제품 정의·요구사항: 진입 문서의 `## Overview`" + SKILL.md 권장 3섹션
- 상세: plan 문서는 §1 배경, §2 결정사항, §3 기각된 대안, §4 작업 단위, §5 영향 받는 SoT, §6 완료 조건 구조이며 별도 `## Overview` 섹션이 없다. plan 문서가 spec 문서는 아니므로 3섹션 의무 대상이 아니지만, 도입부 blockquote ("사용자 합의 …") 가 Overview 역할을 대신하고 있다. 완전한 위반은 아님 — INFO 수준.
- 제안: 필요하다면 `## Overview` 또는 `## 배경 및 목표` 로 서두를 정식 섹션으로 격상. 그대로 유지도 수용 가능.

---

### 5. [INFO] §4.1 Spec 갱신 대상 파일에 `spec/conventions/conversation-thread.md §9.10` 회귀 시나리오 번호가 CT-S12~CT-S14 로 하드코딩됨
- target 위치: §4.1 마지막 bullet — `spec/conventions/conversation-thread.md §9.10 CT-S12, CT-S13, CT-S14 신설`
- 위반 규약: 직접 위반 규약 없음 (INFO)
- 상세: conversation-thread.md §9.10 의 기존 시나리오 번호 체계를 확인하지 않은 채 CT-S12~S14 를 하드코딩했다. 실제 §9.10 의 마지막 번호가 S11 이 아닐 경우 충돌 또는 건너뜀이 생길 수 있다. spec 갱신 시점에 기존 번호 확인 후 연속 번호로 조정 필요.
- 제안: spec 갱신 실행 시 `spec/conventions/conversation-thread.md §9.10` 실제 마지막 번호를 확인 후 연번 부여.

---

## 요약

plan 문서 자체의 내용과 구조는 대체로 `plan-lifecycle.md` 규약을 준수하며, frontmatter 3개 필수 필드(worktree/started/owner) 도 모두 존재한다. 단, `owner` 값이 역할명이 아닌 task slug 와 동일해 담당자 추적 목적이 약화된다. 더 중요한 점은, 본 작업이 `spec/conventions/interaction-type-registry.md` §1.2(`ai_form_render` 처리 분기)와 §3.2(`form` Presentation type 렌더 분기) 두 군데를 실질적으로 변경하는데, §4.1 Spec 갱신 목록에 해당 규약 파일이 누락되어 있다. interaction-type-registry 는 "신규 enum 값은 본 문서 매트릭스에 반드시 등록" + "표의 모든 위치를 한 PR 안에서 동시 갱신" 을 강제하는 규약이므로, 구현 PR 에서 interaction-type-registry.md 를 빠뜨리면 AST 가드·exhaustiveness 테스트 관점에서 누락 회귀 위험이 발생한다.

---

## 위험도

MEDIUM
