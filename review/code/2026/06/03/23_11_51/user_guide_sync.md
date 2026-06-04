# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음 — 동반 갱신 누락 없음.

변경 코드 전체를 매트릭스 `rows[]` 와 대조한 결과, 매칭된 모든 trigger 에 대해 동반 갱신이 PR 변경 set 안에 이미 포함돼 있습니다.

### 매칭 trigger 별 검토 결과

**trigger: `node-schema-change` (id)**
- 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`
- 신규 필드: `memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold` (5개) + `visibleWhen` 조건 추가
- 필수 동반 갱신:
  - `codebase/frontend/src/content/docs/02-nodes/ai.mdx` — 신규 5개 필드 FieldTable 항목 추가됨 (PASS)
  - `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` — 동일 5개 필드 영문 FieldTable + Memory 섹션 추가됨 (PASS)
  - `codebase/frontend/src/lib/i18n/backend-labels.ts` — 아래 `new-backend-ui-zod-value` 항목에서 확인 (PASS)

**trigger: `new-backend-ui-zod-value` (id)**
- 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`
- 신규 zod `ui.label` 값: `Memory Strategy`, `Token Budget`, `Memory Key`, `Memory Top-K`, `Memory Threshold`
- 신규 `ui.group` 값: `Memory`
- 신규 `ui.hint` 값: 5개
- 신규 `ui.options[].label` 값: `Manual — use Conversation Context fields`, `Summary Buffer — rolling token-budget summary`, `Persistent — summary buffer + cross-session memory`
- `codebase/frontend/src/lib/i18n/backend-labels.ts` 확인:
  - `LABEL_KO`: `Memory Key`, `Memory Strategy`, `Memory Threshold`, `Memory Top-K`, `Token Budget` 모두 추가됨 (PASS)
  - `GROUP_KO`: `Memory` 추가됨 (PASS)
  - `HINT_KO`: 5개 hint 모두 추가됨 (PASS)
  - `OPTION_LABEL_KO`: 3개 option 라벨 모두 추가됨 (PASS)

**trigger: `spec-major-change` (id)**
- 변경 파일: `spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`
- frontmatter 갱신 내용: `pending_plans` 의 `ai-context-memory-auto.md` → `ai-context-memory-followup-v2.md` 로 교체
- `plan/in-progress/ai-context-memory-followup-v2.md` 실존 확인됨 (PASS)
- `status: partial` → `pending_plans` 항목 유효 (PASS)

**trigger: `new-node` (id) — 비해당**
- `codebase/backend/src/modules/agent-memory/` 는 노드가 아닌 서비스 모듈 (no `<cat>/<name>/handler.ts` 구조). `new-node` trigger 비매칭.

**trigger: `run-debug-flow-change` (semantic) — 비해당**
- AI Agent 메모리 전략은 실행·디버깅 흐름 UI 자체의 변경이 아닌 노드 설정 변경. `05-run-and-debug/` 갱신 대상 아님.

**trigger: `expression-language-change` (semantic) — 비해당**
- `codebase/packages/expression-engine/**` 변경 없음.

---

## 요약

매트릭스 총 18개 trigger 중 이 PR 에 매칭되는 trigger 는 3개 (`node-schema-change`, `new-backend-ui-zod-value`, `spec-major-change`). 매칭된 3개 trigger 에 대해 유저 가이드 MDX (ko/en 양쪽), `backend-labels.ts` LABEL/HINT/GROUP/OPTION_LABEL 매핑, spec frontmatter 갱신이 동일 변경 set 안에 모두 포함돼 있어 동반 갱신 누락은 0건.

## 위험도

NONE
