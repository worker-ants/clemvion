# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] WorkflowForbiddenWorkspaceError — 에러 타입 변경으로 인한 catch 블록 영향 가능성
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (assertSameWorkspace), `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` (mapSubWorkflowError)
- 상세: 기존에 `throw new Error('WORKFLOW_FORBIDDEN_WORKSPACE: ...')` 로 던지던 것을 `throw new WorkflowForbiddenWorkspaceError(...)` 로 교체했다. `mapSubWorkflowError` 에서 `instanceof WorkflowForbiddenWorkspaceError` 분기를 추가했으므로 이 핸들러를 통과하는 경로는 의도대로 동작한다. 그러나 `assertSameWorkspace` 를 직접 호출하고 catch 에서 `error.message.includes('WORKFLOW_FORBIDDEN_WORKSPACE')` 또는 `error instanceof Error` 에 의존하는 추가 catch 블록이 코드베이스 내 다른 위치에 존재할 경우, 타입 변경이 해당 catch 로직의 분기를 바꿀 수 있다. 단, `WorkflowForbiddenWorkspaceError extends Error` 이고 메시지 포맷이 동일하게 보존되므로 message-based catch 에는 영향이 없다. `instanceof Error` check 역시 영향 없다. 실질 위험은 거의 없으나 완전성 차원에서 기록한다.
- 제안: 이미 `workflow.handler.ts` 의 defensive backstop (`lower.includes('workflow_forbidden_workspace')`) 이 추가돼 있어 외부 executor 가 plain Error 로 던지는 경우도 커버된다. 추가 대응 불필요.

### [INFO] LlmCallRecord[] 타입 치환으로 인한 정적 타입 loosen
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (L1488, L2413)
- 상세: 기존 inline 타입은 `durationMs: number` (non-optional)이었으나, shared `LlmCallRecord` 는 `durationMs?: number` (optional) 인 all-optional superset 이다. push site 에서 항상 전 필드를 공급하므로 런타임 데이터 손실은 없다. 그러나 타입 시스템 관점에서는 `LlmCallRecord[]` 배열을 소비하는 읽기 코드가 `durationMs` 를 non-nullable 로 간주하면 컴파일 에러 없이 런타임에서 `undefined` 를 만날 수 있다. 단, 이 배열은 push 즉시 로컬에서 사용(trace/debug 목적)되고 외부에 직접 노출되지 않으므로 실제 부작용 가능성은 매우 낮다.
- 제안: 소비 측에서 `durationMs` 를 optional 로 처리하거나, LlmCallRecord 내 push-guaranteed 필드에 대해 narrowing 타입 혹은 문서화로 의도를 명확히 하면 미래 유지보수성이 향상된다.

### [INFO] TurnRagDelta 인터페이스 rename — 외부 export 변경
- 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
- 상세: `TurnDebugEntry` -> `TurnRagDelta` 로 exported 인터페이스 이름을 변경했다. diff 내 언급대로 동일 파일 내 4개 참조만 변경되었고 "외부 type import 0" 으로 기술되어 있다. 그러나 외부 파일이 `TurnDebugEntry` 를 import 하고 있을 경우 컴파일 타임 에러가 발생한다(런타임 부작용 아님). 빌드 통과 사실(plan 기록 `unit(frontend 213 files) PASS · build PASS`)이 이를 검증한다.
- 제안: 추가 조치 불필요. 빌드가 이미 외부 참조 0건을 증명한다.

### [INFO] 신규 ErrorCode enum 항목 추가 — ErrorCode 열거형 상태 변경
- 위치: `codebase/backend/src/nodes/core/error-codes.ts`
- 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` 가 `ErrorCode` 객체(enum-like const)에 추가되었다. 이는 런타임에 `ErrorCode` 를 순회하거나 `Object.keys(ErrorCode)` 를 사용하는 코드에 새 항목이 노출됨을 의미한다. 그러나 에러코드는 소비(비교/switch)용이며 열거 자체에 의존하는 프로덕션 로직이 있을 경우 예상치 못한 분기 추가가 가능하다. 관행상 에러코드 추가는 안전한 확장(additive)이다.
- 제안: 에러코드를 순회해 동적으로 처리하는 로직이 있다면 새 항목 포함 여부를 확인할 것. 해당 패턴이 없다면 추가 조치 불필요.

### [INFO] plan/complete 이동 파일들 — 파일시스템 신규 생성
- 위치: `plan/complete/c1-engine-split.md`, `plan/complete/c1-pr2-aiturn-blueprint.md`
- 상세: 새 파일이 `plan/complete/` 에 생성되었다. CLAUDE.md 규약에 따라 완료된 작업은 `plan/complete/` 에 이동하는 것이 정책이며, 이 변경은 의도된 파일시스템 부작용이다. `plan-stale-audit.sh` 등 도구가 `plan/in-progress/` 를 스캔할 때 이 파일들이 더 이상 나타나지 않으므로 stale worktree 경고가 제거된다.
- 제안: 의도된 동작. 추가 조치 불필요.

### [INFO] review/ 산출물 파일 신규 생성 — consistency check 결과 지속
- 위치: `review/consistency/2026/06/19/21_40_43/` 하위 여러 파일
- 상세: consistency check 실행 결과가 `review/` 에 기록된다. `_retry_state.json` 에서 `agents_pending` 에 5개 checker 가 모두 잔류하고 `agents_success: []` 로 기록된 것은 이 파일이 세션 초기화 시점의 스냅샷임을 나타낸다(실제 check 결과는 각 체커 파일에 분리 기록). 이 JSON 은 오케스트레이터의 재시도 상태 파일로, 코드 실행 부작용은 아니다.
- 제안: 의도된 관찰 가능 부작용(산출물 기록). 추가 조치 불필요.

## 요약

이번 변경셋의 핵심은 (1) `assertSameWorkspace` 의 inline `Error` throw를 typed `WorkflowForbiddenWorkspaceError` 로 교체하고 `mapSubWorkflowError` 에 `instanceof` 분기를 추가한 것, (2) `ai-agent.handler.ts` 의 inline llmCalls 타입을 shared `LlmCallRecord[]` 로 치환한 것, (3) `TurnDebugEntry` -> `TurnRagDelta` 로 frontend export 명 변경한 것이다. 세 변경 모두 의도치 않은 전역 상태 변경·파일시스템 부작용·네트워크 호출·이벤트 발생 변경을 유발하지 않는다. 에러 타입 변경은 `WorkflowForbiddenWorkspaceError extends Error` 계층과 메시지 포맷 보존으로 기존 catch 코드 호환성이 유지되며, `mapSubWorkflowError` 의 defensive backstop 이 plain Error 경로도 커버한다. 타입 치환(LlmCallRecord)은 정적 타입 loosen 이 있으나 push-site 가 항상 전 필드를 공급하고 빌드가 통과함으로써 런타임 부작용이 없음이 검증되었다. 인터페이스 rename (TurnRagDelta)은 외부 import가 0건임이 빌드로 확인되었다. 파일시스템 레벨에서는 `plan/complete/` 이동과 `review/` 산출물 기록이 전부이며 모두 의도된 정책 준수 행위다.

## 위험도

LOW
