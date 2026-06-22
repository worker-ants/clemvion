# Plan 정합성 검토 결과

## 검토 컨텍스트

- **검토 모드**: `--impl-done`, `scope=spec/3-workflow-editor`, `diff-base=origin/main`
- **Target 문서**: `spec/3-workflow-editor/` 전체 (0-canvas, 1-node-common, 2-edge, 3-execution, 4-ai-assistant)
- **실제 변경 범위**: `plan/in-progress/refactor/02-architecture.md` M-3 항목 진행 상태 갱신 + `codebase/backend/src/modules/workflow-assistant/` 코드 리팩터 (spec 파일 자체는 변경 없음)

## 발견사항

### **[INFO]** spec/3-workflow-editor 변경 없음 — plan 정합성 충돌 대상 없음

- target 위치: `spec/3-workflow-editor/` 전체 (`0-canvas.md` ~ `4-ai-assistant.md`)
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` §M-3
- 상세: 이 worktree가 변경한 파일은 plan 진행 상태와 codebase 코드뿐이다. `spec/3-workflow-editor/` 하위 파일은 단 하나도 변경되지 않았으므로, plan의 미해결 결정과 spec 사이에 새로운 충돌이 발생하지 않는다.
- 제안: 추적 메모 수준. spec 변경이 없으므로 plan 갱신 불요.

### **[INFO]** `0-canvas.md` · `2-edge.md` pending_plans — 미해결 결정과 교차 없음

- target 위치: `spec/3-workflow-editor/0-canvas.md` §12 (AI Agent Tool Area "재작성 예정"), `spec/3-workflow-editor/2-edge.md` §7 (Tool Area 연결 규칙)
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 (도구 등록 모델·시그니처·실행 컨텍스트·결과 라우팅·ND-AG-21 유지 여부 5개 항목 전부 TBD)
- 상세: `0-canvas.md`와 `2-edge.md`의 `pending_plans`에 `ai-agent-tool-connection-rewrite.md`가 등록되어 있고, 해당 plan의 §결정 기록은 모두 TBD 상태다. 이 worktree의 M-3 리팩터는 `WorkflowAssistantStreamService`의 내부 분해(explore dispatch registry 추출)이며, AI Agent Tool Area 설계·엣지 연결 모델과 직교한다. 두 plan 사이의 교차점이 없다.
- 제안: 현재 추적 상태 유지. 이 worktree가 Tool Area/edge 관련 spec을 건드리지 않으므로 추가 조치 불요.

### **[INFO]** M-3 후속 단계(Guard·Persistence)와 `4-ai-assistant.md §10` 선행 조건 확인

- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §10 (Workflow self-review 가드 — `reviewRoundCount`, `verifyFiredOnce` 등)
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` §M-3 2단계·3단계 (미착수)
- 상세: M-3 권장안 A는 "Router → Guard → Persistence" 순 단계 PR로 분할이 허용된다고 명시하며, spec 대조 판정이 B("행위 계약만 규정, 내부 분해 무언급")다. 2단계(`AssistantFinishGuard`/`AssistantReviewGuard`)와 3단계(`AssistantTurnPersistenceService`)는 spec §10의 상태 필드(`reviewRoundCount`, `verifyFiredOnce`)를 Guard 객체로 캡슐화할 예정이지만, spec 행위 계약 자체를 변경하지 않으므로 spec 갱신 불요가 이미 명시되어 있다. 1단계 완료가 2단계의 선행 조건을 충족하며, spec이 gate를 걸지 않는다.
- 제안: 현재 계획대로 진행 가능. spec 선행 개정 없이 2단계 착수 가능.

## 요약

이 worktree(M-3 1단계 — `AssistantToolRouter` 추출)는 `spec/3-workflow-editor/` 파일을 변경하지 않았다. target spec 영역의 미해결 결정(`ai-agent-tool-connection-rewrite.md`의 Tool Area 5개 TBD 항목)은 M-3 리팩터와 직교하며 어떠한 충돌도 없다. `4-ai-assistant.md`는 `pending_plans` 없이 `status: implemented` 상태이고, M-3은 spec의 행위 계약(도구 정의·SSE·가드 §10)이 아닌 내부 서비스 분해를 다루므로 선행 plan 미해소나 후속 항목 무효화에 해당하는 사항이 없다.

## 위험도

NONE
