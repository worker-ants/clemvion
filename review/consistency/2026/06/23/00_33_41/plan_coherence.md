# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (scope=`spec/3-workflow-editor`)
검토 대상 worktree: `refactor-m3-assistant-tool-router`

---

## 검토 맥락 정리

이 worktree 의 실제 변경사항은 `spec/3-workflow-editor` 전체가 아니라 다음 두 파일 추가다:

- `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts`
- `codebase/backend/src/modules/workflow-assistant/tools/coerce.ts`

이는 `plan/in-progress/refactor/02-architecture.md` M-3 ("WorkflowAssistantStreamService — streamMessage 혼재") 의 1단계 구현으로, `explore` 도구 dispatch 를 `AssistantToolRouter` 로 추출하는 순수 내부 리팩토링이다. 관련 spec 은 `spec/3-workflow-editor/4-ai-assistant.md` (status: implemented, no pending_plans)이며, M-3 plan 자체도 "spec 갱신: 불요" 로 명시하고 있다.

---

## 발견사항

### [INFO] `ai-agent-tool-connection-rewrite.md` 의 미해결 결정이 target spec 일부에 존재하지만 구현 범위와 무관

- **target 위치**: `spec/3-workflow-editor/0-canvas.md` §12 AI Agent Tool Area (재작성 예정 박스), `spec/3-workflow-editor/2-edge.md` §7 Tool Area 연결 규칙 — 각 파일 frontmatter 의 `pending_plans: [ai-agent-tool-connection-rewrite.md]`
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 디자인 결정 — 도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅 등 5개 항목이 전부 TBD
- **상세**: `ai-agent-tool-connection-rewrite.md` 의 TBD 결정들은 AI Agent 의 일반 도구 연결 재설계(canvas Tool Area, `toolNodeIds`/`toolOverrides` 복원)에 관한 것이다. 이번 M-3 구현(`AssistantToolRouter`)은 **Workflow AI Assistant 의 explore/plan/edit/finish 도구 라우팅**을 분리하는 작업으로, AI Agent 노드 도구 연결과는 완전히 다른 레이어다. `AssistantToolRouter` 의 종류 분류(`TOOL_KIND_BY_NAME`)·explore 도구 dispatch 는 canvas §12 나 edge §7 의 Tool Area 모델과 상호작용하지 않는다.
- **제안**: 별도 조치 불필요. 기록 목적으로만 남긴다.

### [INFO] M-3 plan 의 "후속 단계" 항목이 코드 주석에만 언급되고 plan 에 명시적으로 체크되지 않음

- **target 위치**: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` 주석 (line 58-60): "plan/edit/finish dispatch 와 §10 finish/review 가드는 … 현재는 streamMessage 에 잔류한다 (M-3 후속 단계에서 가드 객체·persistence 로 분리 예정)"
- **관련 plan**: `plan/in-progress/refactor/02-architecture.md` M-3 개선 방안 2 (`AssistantFinishGuard`/`AssistantReviewGuard`) · 3 (`AssistantTurnPersistenceService`)
- **상세**: M-3 plan 의 옵션 A (전체 3분해) 중 1단계(ToolRouter) 만 구현됐고, 나머지 Guard/Persistence 분해는 "단계 분할 가능"으로 plan 에서 허용한 패턴이다. 코드 주석이 이 잔여 의도를 명시하고 있으므로 정합성은 유지된다. 단, plan 파일 M-3 항목의 체크박스(`- [ ] 미착수`)가 여전히 미착수 표시인 채로 남아 있어, 이 단계(ToolRouter) 가 완료된 후 plan 이 갱신(단계 완료 표시)되어야 한다.
- **제안**: 커밋 후 `plan/in-progress/refactor/02-architecture.md` M-3 항목에 "1단계(AssistantToolRouter) 완료 — Guard/Persistence 는 후속 PR" 식의 진행 상태를 주석으로 추가하는 것을 권장.

---

## 요약

이번 `--impl-prep` 검토 범위(`spec/3-workflow-editor`)에서 M-3 구현(`AssistantToolRouter`, `coerce.ts`)이 미해결 결정을 일방적으로 우회하거나 선행 plan 이 미해소인 채로 전제하거나 다른 plan 의 후속 항목을 무효화하는 충돌은 발견되지 않았다. `ai-agent-tool-connection-rewrite.md` 의 TBD 결정들은 target 범위 내 spec 파일에 pending_plans 로 연결되어 있으나, M-3 구현은 그 결정이 필요한 AI Agent 도구 연결 레이어와 직교하는 Workflow AI Assistant 내부 구조 분리 작업이다. `spec/3-workflow-editor/4-ai-assistant.md` 는 status: implemented, no pending_plans 이며 M-3 plan 역시 spec 갱신 불요를 명시한다.

## 위험도

NONE

---

STATUS: OK
