---
title: _product-overview.md §10.4 ED-AI-19 — 미구현 표기를 상세 spec 과 맞춘다
status: complete
owner: project-planner
worktree: assistant-e2e-contract-gaps
spec_impact:
  - spec/3-workflow-editor/_product-overview.md
started: 2026-09-26
---

# spec draft — ED-AI-19 의 구현 상태 표기

구현 plan `plan/complete/assistant-e2e-contract-gaps.md` 의 `--impl-prep`(`review/consistency/2026/09/26/16_14_14`)이 **BLOCK: YES** 를
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
- **`4-ai-assistant.md` 규약 위생 네 칸** — 같은 `--impl-prep` 의 `convention_compliance.md` WARNING 넷: ① frontmatter
  `status: implemented` 인데 본문 «(계획)» 이 §7 · §10 · §12.2 세 곳(`partial` + `pending_plans` 가 필요 — `spec-impl-evidence.md` §3),
  ② Assistant 에러 코드가 중앙 카탈로그 밖, ③ SSE `event: error` 봉투 예외 근거 부재, ④ 도구 호출 배지 영문 고정의 i18n 예외 미등재.
  이 PR 의 작업과 무관해 트래커 한 항목으로 등재한다.
- **다른 두 문서의 «전체 구현 완료» 서술** — `spec/0-overview.md` §6.1 표의 Workflow AI Assistant 행과 `spec/4-nodes/3-ai/_product-overview.md`
  의 «구현 상태: 구현 완료(✅)» 두 곳(`--spec` W2). 기능 단위 표기라 요구사항 하나의 미구현을 어떻게 싣을지는 별 결정이다 — 같은
  트래커 항목의 다섯째 칸으로 등재한다.

## Rationale

- **왜 PRD 쪽을 고치는가**: 두 문서가 어긋날 때 정본은 실측이다. 코드에 가드가 없으니 «미구현» 이 사실이고, 상세 spec 은 이미 그렇게
  적는다. PRD 만 표기가 없어 «필수 · 구현됨» 으로 읽힌다.
- **왜 요구사항을 지우거나 우선순위를 내리지 않는가**: 실행 중 편집 거부는 여전히 제품이 원하는 동작이다(상세 spec «향후 추가 예정»).
  바꾸는 것은 구현 상태 표기뿐이다.
- **왜 이 PR 에 싣는가**: `--impl-prep` 이 이 모순을 이유로 BLOCK 을 냈고, 게이트는 BLOCK: NO 만 센다. 우회(검사 범위에서 이 문서를
  빼기)는 결함을 알고 피하는 것이라 하지 않는다. 한 행 사실 정정이라 별 PR 로 먼저 머지하는 왕복보다 싸다 — PR 본문 첫머리에 두 plan
  임을 적는다.

### `--spec` 경고 처리 (`review/consistency/2026/09/26/16_27_26`, BLOCK: NO)

- **W1 — 발단 세션의 나머지 WARNING 이 트래커에 없다**: 사실(grep 0건). «안 하는 것» 에 넷을 명시하고 트래커 `spec-draft-nullable-notation-followups.md`
  에 한 항목으로 등재했다. INFO3 대로 «WARNING 3» 이라는 부정확한 인용을 파일 · 항목 인용으로 바꿨다.
- **W2 — `0-overview.md` §6.1 · `4-nodes/3-ai/_product-overview.md` 도 «전체 구현 완료»**: 사실(두 문서 5 · 138행 확인). 원 Critical 은
  §10.4 ↔ §12.2 쌍이라 이 PR 은 그 쌍만 닫는다 — 같은 트래커 항목의 다섯째 칸.
- **INFO2 — 기울임 표기**: 반영에서 ED-DB-05 행과 같은 밑줄 기울임으로 적는다.
- **INFO4 — «로드맵» vs «계획» 두 어휘가 한 표에 공존**: 의도된 구분이다. ED-DB-05 는 로드맵 백로그이고, ED-AI-19 는 상세 spec 이 이미
  «(계획) … 향후 추가 예정» 으로 적는 추적 중인 갭이라 상세 spec 의 낱말을 그대로 쓴다.
