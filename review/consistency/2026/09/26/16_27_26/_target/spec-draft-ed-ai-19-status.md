---
title: _product-overview.md §10.4 ED-AI-19 — 미구현 표기를 상세 spec 과 맞춘다
status: in-progress
owner: project-planner
worktree: assistant-e2e-contract-gaps
spec_impact:
  - spec/3-workflow-editor/_product-overview.md
started: 2026-09-26
---

# spec draft — ED-AI-19 의 구현 상태 표기

구현 plan `plan/in-progress/assistant-e2e-contract-gaps.md` 의 `--impl-prep`(`review/consistency/2026/09/26/16_14_14`)이 **BLOCK: YES** 를
냈다. Critical 1건은 그 작업(테스트 한 파일)과 무관한 **기존 spec 모순**이다:

- `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 는 «워크플로우 실행 중(Run 상태)에는 편집 도구가 거부되고 사용자에게
  안내» 를 표기 없이 적는다 — 구현된 필수 요구사항으로 읽힌다.
- `spec/3-workflow-editor/4-ai-assistant.md` §12.2 는 같은 가드를 «**(계획)** … 아직 미구현이다 — 현재 코드에는 해당 에러코드 · 차단
  로직이 없어 실행 중에도 편집 도구가 호출될 수 있다» 로, §4.1.1 표도 «(현재 미구현, 계획)» 으로 적는다.

**실측 (2026-09-26)**: 상세 spec 쪽이 맞다.
- `ASSISTANT_WORKFLOW_RUNNING` 은 `codebase/backend/src` · `codebase/frontend/src` 어디에도 없다(grep 0건).
- 프론트엔드 assistant 패널(`components/editor/assistant-panel/`)에도 실행 상태로 편집 도구를 막는 분기가 없다.

## 변경안

`spec/3-workflow-editor/_product-overview.md` §10.4 표의 ED-AI-19 행 — 요구사항 문장 끝에 같은 PRD 의 미구현 표기를 붙인다.
형식은 같은 문서 ED-DB-05 행의 선례를 따른다: 밑줄 기울임으로 «미구현 — 계획» 을 적고, 상세 spec 의 해당 절로 가는 상대 링크를 단다.
요구사항 자체와 우선순위(`필수`)는 그대로 둔다.

- 덧붙일 표기: `(미구현 — 계획, §4-ai-assistant §12.2)` — 링크 텍스트는 «§4-ai-assistant §12.2», 대상은 같은 폴더의
  `4-ai-assistant.md` 의 `§12.2 실행/디버깅` 헤딩 앵커(`122-실행디버깅`).

같은 문서의 두 인용(§10.9 도입부 «§10.4 ED-AI-19 유지» · ED-AI-38 «편집 도구의 "실행 중 거부" 정책은 read 에는 적용되지 않음»)은
정책을 가리키는 문장이라 구현 상태와 무관하게 참이다 — 고치지 않는다.

## 안 하는 것

- **가드 구현** — 제품 결정 · 구현 작업이다. 이 draft 는 두 문서가 **같은 현재 상태**를 가리키게 할 뿐이다.
- **`4-ai-assistant.md` frontmatter `status: implemented` → `partial`** — 본문의 «(계획)» 이 §7 · §10 · §12.2 세 곳이라 `pending_plans`
  를 함께 세워야 한다(`spec-impl-evidence.md` §3). `--impl-prep` WARNING 3 으로 트래커에 등재한다.

## Rationale

- **왜 PRD 쪽을 고치는가**: 두 문서가 어긋날 때 정본은 실측이다. 코드에 가드가 없으니 «미구현» 이 사실이고, 상세 spec 은 이미 그렇게
  적는다. PRD 만 표기가 없어 «필수 · 구현됨» 으로 읽힌다.
- **왜 요구사항을 지우거나 우선순위를 내리지 않는가**: 실행 중 편집 거부는 여전히 제품이 원하는 동작이다(상세 spec «향후 추가 예정»).
  바꾸는 것은 구현 상태 표기뿐이다.
- **왜 이 PR 에 싣는가**: `--impl-prep` 이 이 모순을 이유로 BLOCK 을 냈고, 게이트는 BLOCK: NO 만 센다. 우회(검사 범위에서 이 문서를
  빼기)는 결함을 알고 피하는 것이라 하지 않는다. 한 행 사실 정정이라 별 PR 로 먼저 머지하는 왕복보다 싸다 — PR 본문 첫머리에 두 plan
  임을 적는다.
