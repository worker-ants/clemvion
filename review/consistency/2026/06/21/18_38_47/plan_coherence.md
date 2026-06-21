# Plan 정합성 검토 결과

검토 범위: `spec/4-nodes/3-ai` (구현 완료 후 검토, diff-base=origin/main)
실제 변경 범위: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (신설),
`ai-agent.handler.ts` (ConditionDef·ConditionClassification·condToolName·sanitizeId 제거, AiConditionEvaluator 위임),
`plan/in-progress/refactor/02-architecture.md` (M-2 항목 완료 → 미착수 복원)

---

## 발견사항

### [WARNING] M-1 계획 체크박스가 1단계 구현 완료 후에도 미착수 상태로 방치됨

- **target 위치**: `plan/in-progress/refactor/02-architecture.md` §M-1 (L124) — `- [ ] 미착수 — nodes/ai/ai-agent/ai-agent.handler.ts`
- **관련 plan**: `plan/in-progress/refactor/02-architecture.md` §M-1 "개선 방안" 1번 (`AiConditionEvaluator` 먼저)
- **상세**: 본 worktree 커밋(`ff72c57d`)이 M-1 1단계(`AiConditionEvaluator` 추출)를 완료했으나 plan 체크박스는 여전히 `[ ] 미착수`로 남아있다. plan 라이프사이클 규칙 상 구현 완료 후 체크박스를 업데이트하고 커밋에 포함해야 한다(`.claude/docs/plan-lifecycle.md` + MEMORY: "plan 체크박스 = 실제 상태"). M-1 은 3단계 로드맵이므로 단계 1 완료를 `[~]` 또는 sub-체크박스로 기록해야 후속 단계 착수 시 맥락이 보존된다.
- **제안**: plan `02-architecture.md` M-1 항목을 `[~] 진행 중 (1단계 AiConditionEvaluator 추출 완료)` 으로 갱신하고, 완료된 사항(파일 위치, 테스트 파일 신설 등)을 1~2줄로 기록. 이 변경을 현 커밋 또는 후속 커밋에 포함.

---

### [WARNING] M-2 완료 상태가 이 worktree 에서 미착수로 역전됨 — origin/main 과 plan 불일치

- **target 위치**: `plan/in-progress/refactor/02-architecture.md` §M-2 (L151) — `- [ ] 미착수 — integrations/integration-oauth.service.ts`
- **관련 plan**: `plan/in-progress/refactor/02-architecture.md` §M-2 (origin/main 에서는 `[x] 완료`)
- **상세**: origin/main 에서 M-2 는 `[x] 완료` 로 기록되어 있고 `oauth-providers/` 5개 strategy 파일이 존재한다. 이 worktree 의 diff 는 해당 파일들을 전부 제거(`cafe24-oauth.strategy.ts`, `oauth-provider-strategy.ts` 등 11개 파일 삭제 + `integration-oauth.service.ts` 487줄 반환)하고 plan 을 `미착수`로 되돌렸다. 이는 본 refactor-m1-condition-evaluator 작업의 의도적 베이스라인 리셋(다른 worktree 의 M-2 커밋이 포함되지 않은 base)인 것으로 보이나, 현재 plan 파일에는 이 역전의 근거가 없고 `review/consistency/2026/06/21/17_49_11/SUMMARY.md`(M-2 impl-done) 등도 삭제되어 history 가 소실되어있다. 머지 시 origin/main 의 M-2 완료 커밋이 정상 합산되더라도 plan 파일의 역행 표기가 혼란을 야기할 수 있다.
- **제안**: 이 worktree 가 origin/main 기반이 아닌 다른 base 에서 시작했는지, 혹은 M-2 작업을 의도적으로 배제한 것인지 확인 후 plan 표기를 정합화. 만약 M-2 변경이 별도 브랜치에서 이미 main 에 머지됐다면 이 plan diff 는 rebase 시 자동 해소될 것이나, review 파일 삭제분은 별도 확인 필요.

---

### [INFO] ai-agent-tool-connection-rewrite.md 의 `cond_*` 도구 이름 규칙 참조 — 영향 없음 확인

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `condToolName()` 함수가 핸들러 로컬에서 `ai-condition-evaluator.ts` 모듈로 이동, `export` 됨
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` (미착수) — "`cond_* → kb_* → mcp_* → render_* → tool_*` dispatcher 분류 순서 표를 갱신해야 한다" (L13)
- **상세**: tool-connection-rewrite plan 이 spec `1-ai-agent.md §6.1 step 3a` 의 dispatcher 표 갱신을 참조하는데, `condToolName` 함수가 `ai-condition-evaluator.ts` 로 이동함으로써 물리 위치가 바뀌었다. 단 spec 표의 `cond_*` 도구 이름 규칙 및 행동 계약 자체는 변경되지 않았으므로 tool-connection-rewrite plan 과의 충돌은 없다. tool-connection-rewrite 가 착수될 때 `condToolName` import 경로만 업데이트하면 된다.
- **제안**: tool-connection-rewrite plan 에 "condToolName 이 `ai-condition-evaluator.ts` 로 이동됨" 추적 메모를 추가하면 해당 작업 착수 시 빠른 위치 파악 가능. 비차단.

---

### [INFO] ai-context-memory-followup-v2.md pending 백로그 — AiConditionEvaluator 와 무관

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (신설)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — `information_extractor §5.4/§5.5 meta 표에 contextInjection 행(waiting/resumed)` A2 backlog (미완료)
- **상세**: ai-context-memory-followup-v2.md 는 ai-agent.handler.ts 의 contextScope/memoryStrategy 관련 표면을 추적한다. AiConditionEvaluator 는 그와 직교하는 condition 평가 로직만 분리한 것이라 해당 plan 의 미해결 항목과 충돌하지 않는다. 다만 `spec/4-nodes/3-ai` 가 본 plan 의 `pending_plans:`(`0-common.md`, `1-ai-agent.md`)에 등재되어 있으며 spec 에는 변경이 없으므로 pending_plans 관계는 유효하게 유지된다.
- **제안**: 추적 필요 없음.

---

## 요약

본 변경(`AiConditionEvaluator` 추출, refactor M-1 1단계)은 `spec/4-nodes/3-ai` 의 미해결 결정이나 선행 plan 가정과 충돌하지 않는다. spec 파일 자체는 변경되지 않았고, `1-ai-agent.md` 에 `pending_plans`로 등록된 `ai-agent-tool-connection-rewrite.md`, `ai-context-memory-followup-v2.md`, `exec-park-durable-resume.md` 와의 정합도 유지된다. 단 plan 상태 관리에 두 가지 WARNING 이 있다: ① M-1 체크박스가 1단계 구현 후에도 미착수로 남아 추적 불능이고, ② M-2 완료 상태가 이 worktree 에서 미착수로 역전되어 origin/main plan 과 불일치한다. 두 항목 모두 코드 자체의 정합성 문제는 아니나 plan 신뢰도 저하와 머지 후 혼란의 원인이 될 수 있어 plan 갱신이 권장된다.

## 위험도

LOW
