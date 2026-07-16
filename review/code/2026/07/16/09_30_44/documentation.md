### 발견사항

- **[INFO]** `status: implemented` 승격 시점에 `pending_plans` 가 가리키던 plan 파일이 아직 `plan/in-progress/` 에 남아 있음
  - 위치: frontmatter `status`(6행) / `pending_plans` 삭제(48-49행 diff)
  - 상세: 제거된 `pending_plans: [plan/in-progress/ai-agent-tool-payload-budget-followups.md]` 의 대상 파일을 확인한 결과, 해당 plan 은 아직 `plan/complete/` 로 이동되지 않고 `plan/in-progress/` 에 남아 있다(항목 A 체크리스트는 완료, 항목 B "resume 턴 timeoutMs+signal" 은 미완, PR 체크박스도 미완). `spec/conventions/spec-impl-evidence.md` §3.1 은 "`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격" 이라고 명시한다. 이 spec 의 `pending_plans` 는 plan 문서 전체가 아니라 그 plan 이 담고 있는 항목 A(본 rule 의 config-time 저장 경고, 이미 완료 확인됨)만을 지시하고, 항목 B 는 별개 무관 작업이라 실질적으로 문제는 아니다. 또한 `spec/4-nodes/3-ai/1-ai-agent.md` 는 여전히 `status: partial` 이고 `pending_plans` 에는 이 followups plan 이 아닌 다른 plan(`ai-agent-tool-connection-rewrite.md`)만 남아 있어 두 spec 간 정합성도 확인됨(교차 확인 완료).
  - 제안: 현재 상태로도 자동 가드(`spec-status-lifecycle.test.ts`/`spec-pending-plan-existence.test.ts`)는 통과하나(필드 자체가 제거됐으므로), 향후 유사 사례에서 "부분 완료된 항목만 다른 spec 에서 참조를 끊고, 전체 plan 은 계속 in-progress" 패턴이 반복되면 spec→plan 추적성이 흐려질 수 있다. 여러 무관 항목을 한 plan 파일에 묶는 대신, 완료된 항목을 별도 plan 으로 분리해 `plan/complete/` 로 이동시키는 편이 §3.1 규약과 더 깔끔히 정합한다(참고용 제안, 이번 diff 자체를 막을 사유는 아님).

- **[INFO]** 표(§8) 서술과 실제 구현의 일치 확인 — 문제 없음
  - 위치: §8 테이블 AI Agent 행(diff 57-58행)
  - 상세: "`WorkflowsService` 가 `getGraphWarnings`(조회) 결과에 append 하고 `saveCanvas`(저장) 가 severity `error` 시 차단한다" 라는 신규 서술을 `codebase/backend/src/modules/workflows/workflows.service.ts` 의 `getGraphWarnings`/`saveCanvas`/`evaluateToolPayloadWarningsAndThrow` 구현과 대조한 결과 정확히 일치한다(라인 443-455, 565-608, 645-680 대역). `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 환경변수도 `codebase/backend/.env.example` 에 이미 문서화되어 있고, `ai_agent:tool-payload-budget` ruleId 의 KO 매핑(`backend-labels.ts`)·backend-only 목록 등록(`backend-labels.test.ts`)도 실존한다. "⚠ 구현 예정(Planned)" 문구 제거가 정당함을 뒷받침한다.

### 요약

이 변경은 코드(diff) 자체가 아니라 이미 완료된 구현(AI Agent 도구 payload 예산 config-time 경고, `tool-payload-save-warning.ts` + `WorkflowsService.getGraphWarnings`/`saveCanvas` 배선)을 spec 컨벤션 문서 `cross-node-warning-rules.md` 에 사후 반영하는 documentation-only PR이다. `status: partial→implemented` 승격, `code:` 경로 추가, `pending_plans` 제거, §8 테이블의 "구현 예정" 문구를 실제 동작 서술로 교체하는 4가지 변경 모두 실제 코드(`workflows.service.ts`, `tool-payload-save-warning.ts`, `.env.example`, `backend-labels.ts`)와 대조 검증한 결과 정확하며, 관련 spec(`1-ai-agent.md`)과의 교차 정합성도 유지된다. 유일한 미세한 관찰 사항은 `pending_plans` 가 가리키던 plan 파일이 아직 `plan/in-progress/` 에 남아 있다는 점인데, 이는 그 plan 이 무관한 항목(B)을 함께 담고 있어서이며 이 spec 이 실제로 책임지는 항목(A)은 완료가 확인되어 실질적 문제는 아니다.

### 위험도
NONE
