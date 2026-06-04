# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

검토 일시: 2026-06-03
매트릭스 SSOT: `.claude/config/doc-sync-matrix.json` (rows 19개)

---

## 변경 파일 식별

prompt 에 포함된 파일(`review/consistency/2026/06/03/21_38_47/`)은 일관성 검토 산출물(`.md`/`.json`)이지만, 이 검토가 트리거된 실제 소스 변경은 git diff 로 보강해 확인했다.

`git diff HEAD~3 HEAD --name-only` 기준 실제 변경 파일 (매트릭스 trigger 관련):

- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — 신규 `memoryStrategy`·`memoryTokenBudget`·`memoryKey`·`memoryTopK`·`memoryThreshold` 필드 추가
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 실행 흐름 변경
- `codebase/backend/src/modules/agent-memory/` (신규) — AgentMemory 모듈
- `codebase/frontend/src/content/docs/02-nodes/ai.mdx` — 갱신됨
- `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` — 갱신됨
- `codebase/frontend/src/lib/i18n/backend-labels.ts` — 갱신됨 (LABEL_KO, HINT_KO, GROUP_KO, OPTION_LABEL_KO)
- `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/17-agent-memory.md`, `spec/conventions/conversation-thread.md`

---

## Trigger 매칭 결과

| 매트릭스 행 | 매칭 여부 | 근거 |
|---|---|---|
| `new-node` (codebase/backend/src/nodes/**) | 부분 — 기존 노드 확장 | ai-agent.schema.ts 변경 (신규 노드는 아님) |
| `node-schema-change` (codebase/backend/src/nodes/**) | **매칭** | ai-agent.schema.ts 에 5개 신규 필드 추가 |
| `new-ui-string` (TSX) | 미매칭 | TSX 파일 변경 없음 |
| `new-backend-ui-zod-value` (semantic) | **매칭** | 신규 zod ui.label/hint/group/option 값 다수 추가 |
| `new-warning-code` (semantic) | 미매칭 | warningRules 변경 없음 |
| `new-error-code` (error-codes.ts) | 미매칭 | error-codes.ts 변경 없음 |
| `spec-major-change` (spec/4-*/** 등) | **매칭** | spec/4-nodes/3-ai/, spec/5-system/17-agent-memory.md 변경 |
| `run-debug-flow-change` (semantic) | 미매칭 — INFO | ai-agent.handler.ts 실행 흐름 변경이나 메모리 주입 로직이 추가된 수준 (실행 엔진 자체 변경 아님) |

---

## 발견사항

### [PASS] `node-schema-change` — docs MDX 동반 갱신 완료

- 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`
- 매트릭스 항목: `node-schema-change` — "codebase/frontend/src/content/docs/02-nodes/<cat>.mdx 의 FieldTable + dict/{ko,en}/<section>.ts + backend-labels.ts"
- 확인:
  - `codebase/frontend/src/content/docs/02-nodes/ai.mdx` — 5개 신규 필드(`memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`) FieldTable 항목 추가 완료 (KO)
  - `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` — 동일 5개 필드 FieldTable + Memory 절 설명 추가 완료 (EN)
  - `codebase/frontend/src/lib/i18n/backend-labels.ts` — LABEL_KO(`Memory Key`, `Memory Strategy`, `Memory Threshold`, `Memory Top-K`, `Token Budget`), HINT_KO(5개 hint 문자열), GROUP_KO(`Memory`), OPTION_LABEL_KO(3개 옵션 라벨) 모두 추가 완료

### [PASS] `new-backend-ui-zod-value` — backend-labels.ts 동반 갱신 완료

- 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` (신규 zod ui.label/hint/group/options 값)
- 매트릭스 항목: `new-backend-ui-zod-value` — "codebase/frontend/src/lib/i18n/backend-labels.ts 의 LABEL_KO / HINT_KO / GROUP_KO / ITEM_LABEL_KO / OPTION_LABEL_KO 중 적절한 매핑에 동일 PR 안에서 한국어 등록"
- 확인: backend-labels.ts 에 신규 값 모두 한국어 등록 완료. i18n parity 충족.

### [INFO] `spec-major-change` — frontmatter 정합 점검

- 변경 파일: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/17-agent-memory.md`
- 매트릭스 항목: `spec-major-change` — "frontmatter code: / status: / pending_plans: 정합 갱신, status: partial 이면 pending_plans: 의 plan 신설, status: implemented 이면 code: 글로브 ≥1 매치 보장"
- 확인:
  - `0-common.md`: `status: partial`, `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` — 해당 파일 디스크에 존재 확인. 정합.
  - `1-ai-agent.md`: `status: partial`, `pending_plans: [plan/in-progress/ai-agent-tool-connection-rewrite.md]` — 해당 파일 디스크에 존재 확인. 정합.
  - `17-agent-memory.md`: `status: partial`, `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` + `code: codebase/backend/src/modules/agent-memory/**` — 파일 실존 확인. 정합.
- 상세: 모두 `spec-pending-plan-existence.test.ts` 가드를 통과할 상태. 추가 조치 불필요.

### [INFO] `run-debug-flow-change` — 회색 지대

- 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, `codebase/backend/src/modules/agent-memory/`
- 매트릭스 항목: `run-debug-flow-change` (semantic) — "codebase/frontend/src/content/docs/05-run-and-debug/ 갱신"
- 평가: 실행 엔진 자체(`execution-engine.service.ts`)가 아닌 AI Agent 핸들러 내부에서 메모리 주입 로직이 추가된 수준이다. `05-run-and-debug/` 는 실행·디버깅 흐름 문서이며, 메모리 전략은 AI Agent 노드 설정 변경(사용자 가이드 `02-nodes/ai.mdx`)으로 이미 커버됐다. 실행 흐름 전반에 영향을 주는 변경이 아니므로 `05-run-and-debug/` 갱신 의무 없음.

---

## 요약

매트릭스 19개 trigger 중 실제 매칭된 trigger: `node-schema-change`, `new-backend-ui-zod-value`, `spec-major-change` 3건. 3건 모두 동반 갱신이 같은 변경 set 안에서 완료됐다 — `02-nodes/ai.mdx` + `02-nodes/ai.en.mdx` (KO/EN 동시 갱신), `backend-labels.ts` (LABEL/HINT/GROUP/OPTION 전부 한국어 등록). i18n parity 충족, spec frontmatter 정합, warningCode/errorCode 신규 발행 없음. 누락된 동반 갱신 0건.

## 위험도

NONE

STATUS=success ISSUES=0
