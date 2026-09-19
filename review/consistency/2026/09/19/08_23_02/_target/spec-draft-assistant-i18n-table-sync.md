---
title: AI 어시스턴트 spec §13 i18n 키 표를 실제 사전에 맞춘다 (13행 + divider 서술 둘 + 키 하나)
status: in-progress
owner: project-planner
worktree: entity-index-drift-4c8e21
started: 2026-09-19
spec_impact:
  - spec/3-workflow-editor/4-ai-assistant.md
---

# AI 어시스턴트 §13 i18n 키 표 ↔ 실제 사전

## 왜 지금

`entity-schema-declaration-drift`(developer)의 `--impl-prep spec/3-workflow-editor/`
(`review/consistency/2026/09/19/08_07_50`)가 **BLOCK: YES** 였다. Critical 은 그 작업이 아니라 scope 안에 원래
있던 결함이다 — `spec/3-workflow-editor/4-ai-assistant.md` §13 표의 `assistant.edgeAdded` · `edgeRemoved` 가 글로서리
금지어 «엣지» 를 쓰고, 실제 사전(`dict/ko/assistant.ts`)은 이미 «연결선» 이다. spec 은 developer 권한 밖이라 이 planner
턴이 고친다(consistency-checker SKILL §4 «planner 로 즉시 인계»).

## 방법 — 체커가 짚은 행만이 아니라 표 전체

체커는 아홉 행(Critical 2 · WARNING 1 의 보간 문법 6 · «워크플로» 1)을 짚었다. 같은 클래스(«표 값 ≠ 사전 값»)를 표 전체로
훑었다: §13 표의 41행을 `codebase/frontend/src/lib/i18n/dict/{ko,en}/*.ts` 의 `<파일명>.<키>` 값과 한 행씩 비교(ko · en 둘 다).
**13행**이 다르다 — 체커가 짚은 아홉 + 네 행 더.

사전 쪽이 맞다고 보는 근거: 사전이 실제로 화면에 나가는 문자열이고, 다른 13행 모두 규약 쪽으로 옮겨 간 것이다(아래 각 행의 «근거»).

## 변경 — `spec/3-workflow-editor/4-ai-assistant.md`

### A. §13 표 13행 (값만 바꾼다, 키 · 순서 그대로)

| 행 | 키 | 현재 (ko / en) | 바꿀 값 (ko / en) | 근거 |
|---|---|---|---|---|
| 746 | `assistant.planQuestionsHint` | 아래 메시지 입력창에 답변을 적어 보내 주세요. / (같음) | 아래 메시지 입력창에 답변을 적어 보내요. / (en 그대로) | 글로서리 §5 «넣어주세요 류» 지양 → 해요체 |
| 749 | `assistant.autoResumedHint` | 🔄 자동으로 이어서 진행했어요 ({{attempt}}/{{max}}) / 🔄 Auto-resumed ({{attempt}}/{{max}}) | 자동으로 이어서 진행했어요 ({{attempt}}/{{max}}) / Auto-resumed ({{attempt}}/{{max}}) | 🔄 는 문자열이 아니라 아이콘이다 — `assistant-message.tsx` 가 `RotateCw` 아이콘(`aria-hidden`) 옆에 문구를 둔다 |
| 762 | `assistant.errorNoLlmConfig` | LLM 설정을 먼저 등록해 주세요. / (같음) | LLM 설정을 먼저 등록해요. / (en 그대로) | 글로서리 §5 |
| 763 | `assistant.errorRateLimit` | 잠시 후 다시 시도해 주세요. / (같음) | 잠시 후 다시 시도해요. / (en 그대로) | 글로서리 §5 |
| 765 | `assistant.opAdded` | 노드 추가: {label} / Added node: {label} | 노드 추가: {{label}} / Added node: {{label}} | i18n-userguide Principle 3-C — `interpolate()` 의 이중 중괄호. 단일 중괄호는 보간되지 않고 그대로 보인다 |
| 766 | `assistant.opUpdated` | 노드 수정: {label} / Updated node: {label} | 노드 수정: {{label}} / Updated node: {{label}} | 같음 |
| 767 | `assistant.opRemoved` | 노드 삭제: {label} / Removed node: {label} | 노드 삭제: {{label}} / Removed node: {{label}} | 같음 |
| 768 | `assistant.edgeAdded` | 엣지 추가 / Edge added | 연결선 추가 / (en 그대로) | Principle 6 · 글로서리 §2 «Edge → 연결선, "엣지" 금지» |
| 769 | `assistant.edgeRemoved` | 엣지 삭제 / Edge removed | 연결선 삭제 / (en 그대로) | 같음 |
| 770 | `assistant.exploreLookup` | {count}건 조회됨 / {count} found | {{count}}건 조회됨 / {{count}} found | Principle 3-C |
| 771 | `assistant.exploreExecutionsList` | 실행 이력 {count}건 조회 / {count} executions found | 실행 이력 {{count}}건 조회 / {{count}} executions found | 같음 |
| 772 | `assistant.exploreExecutionDetails` | 실행 상세 조회 — {nodeCount}개 노드 / Execution detail — {nodeCount} nodes | 실행 상세 조회 — {{nodeCount}}개 노드 / Execution detail — {{nodeCount}} nodes | 같음 |
| 773 | `assistant.executionNotInScope` | 이 실행은 현재 워크플로의 것이 아니에요. / (en 그대로) | 이 실행은 현재 워크플로우의 것이 아니에요. / (en 그대로) | 글로서리 §2 «Workflow → 워크플로우» |

### B. 표에 한 행 추가 — 749 바로 아래

| 키 | 한국어 | 영어 |
|----|--------|------|
| `assistant.autoResumedHintShort` | 자동으로 이어서 진행했어요 ({{attempt}}번째) | Auto-resumed (attempt {{attempt}}) |

`autoResumedHint` 의 짝이다. `max` 는 실시간 SSE 경로에만 있어(재수화 때는 서버 상수가 바뀌었을 수 있어 싣지 않는다)
`assistant-message.tsx` 가 `max` 가 없으면 이 키로 순번만 보인다. C 의 divider 서술이 이 둘을 가르므로 표에도 있어야 한다.

### C. divider 서술 두 곳 — 같은 사실(🔄 가 문자열의 일부)

- **§3.2 표 «Auto-resume divider» 행 (154행)**: «`assistant.autoResumedHint` i18n 문구로 "🔄 자동으로 이어서 진행했어요"
  divider 를 렌더한다. `attempt` 번호를 함께 표시해 복구 시도 순번(1/2, 2/2 등)을 사용자에게 알린다.» →
  «회전 아이콘과 `assistant.autoResumedHint` 문구("자동으로 이어서 진행했어요 (1/2)")로 divider 를 렌더한다. 실시간 경로는
  `attempt/max` 로 진행도(1/2, 2/2 등)를, `max` 가 없는 재수화 경로는 `assistant.autoResumedHintShort` 로 순번("(1번째)")만
  보인다.» (행의 나머지 문장은 그대로)
- **Rationale «프론트 변경» (1346행)**: «렌더 ("🔄 자동으로 이어서 진행했어요 (N/M)"). i18n `assistant.autoResumedHint`.» →
  «렌더 (회전 아이콘 + "자동으로 이어서 진행했어요 (N/M)"). i18n `assistant.autoResumedHint` (재수화는
  `assistant.autoResumedHintShort`).» — 결정 서술이 아니라 렌더 모양의 사실 정정이다.

## 비대상 — 트래커에 올린다

- **§13 표에 없는 사전 키 셋**: `assistant.continueAfterBudget` · `assistant.continueAfterBudgetButton`(«이어서 진행» 버튼과
  그 버튼이 보내는 문구) · `assistant.exampleArrange`(예시 프롬프트). 앞의 둘은 본문에 **버튼 자체의 서술이 없다**
  (151 · 627 · 682행은 사용자가 «이어서 진행해줘» 를 **직접 입력**하는 안내만 적는다) — 키만 넣으면 기능 정의 없이 문자열만
  생긴다. 기능 서술부터 쓰는 별도 planner 턴의 일이다. 표 머리말은 전수를 약속하지 않는다.
- **`spec/3-workflow-editor/0-canvas.md` §8.1 «자동 생성된 `change_summary` (예: "노드 3개 추가, 엣지 2개 수정")»**:
  체커 WARNING 2 는 금지어만 짚었지만, 그 문장이 말하는 **자동 생성이 코드에 없다** — 서버가 스스로 채우는 곳은
  버전 복원의 `Restored from v${version}`(`workflows.service.ts`) 하나다. 저장 API 는 요청의 `changeSummary` 를 그대로
  저장하지만 프론트는 그 필드를 보내지 않는다(`codebase/frontend/src` grep — 응답 타입과 표시 컴포넌트뿐). 금지어만
  고치면 틀린 문장을 다듬는 셈이다.
- WARNING 3(`5-version-history.md` Rationale 부재) · WARNING 4 · 5(`pending_plans` 누락, 기존 등재 항목) · INFO 4(`id`
  명명) — 이 표와 무관한 기존 상태. 4 · 5 는 이미 트래커 · 해당 plan 에 있다.

## Rationale

- **방향(spec 을 사전에 맞춘다)**: 13행 모두 사전 쪽이 규약(Principle 3-C 보간 · Principle 6 금지어 · 글로서리 §5 해요체)을
  따르고 spec 쪽이 규약 이전 표기다. 표는 사전의 거울이라 거울을 고친다. 반대 방향(사전을 spec 에 맞춤)은 금지어를
  되살리고 보간을 깨뜨린다(단일 중괄호는 `interpolate()` 가 치환하지 않아 `{label}` 이 화면에 그대로 나간다).
- **체커가 짚은 아홉에서 멈추지 않은 이유**: 같은 표 안의 같은 클래스라 아홉만 고치면 네 행이 다음 검토에서 다시 나온다.
  표 전체를 사전과 한 번에 비교하는 쪽이 판정이 닫힌다.
- **🔄 를 표 밖 두 곳에서도 지우는 이유**: 표 행(749)을 고치면 같은 문서의 두 곳이 여전히 «문자열에 🔄 가 있다» 고
  말한다 — 한 사실을 세 곳이 적고 있어 한 곳만 고치면 문서 안에서 모순이 생긴다.
