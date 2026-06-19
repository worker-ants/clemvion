# 테스트(Testing) 리뷰 결과

**대상**: C-1 dev 잔꼬리(작업 1b) — WorkflowForbiddenWorkspaceError 타입화, LlmCallRecord 공유 타입 전환, TurnRagDelta rename
**리뷰 일시**: 2026-06-19

---

## 발견사항

### [INFO] `WorkflowForbiddenWorkspaceError` 클래스 계약 테스트 — 이번 변경 셋에서 이미 보완됨

- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts`
- **상세**: 직전 ai-review(22_49_28) I-4 항목("typed error 계층 전용 단위 테스트 부재")에 대한 대응으로, 이번 changeset 에 `WorkflowForbiddenWorkspaceError` describe 블록이 추가되었다. (a) mismatch 케이스 — `targetWorkspaceId`/`callerWorkspaceId` 필드 캡처 + message prefix 검증, (b) missing-caller 케이스 — `callerWorkspaceId === undefined` + "without caller workspace context" 메시지 확인, (c) `.name === 'WorkflowForbiddenWorkspaceError'`, (d) `instanceof Error` — 4가지 계약을 모두 검증한다. 타 에러 클래스(`workflow-errors.spec.ts` 기존 블록)와 동일한 패턴으로 일관성이 유지된다.
- **제안**: 없음. 충분히 커버됨.

---

### [INFO] `assertSameWorkspace` 테스트에 `instanceof` 단언 추가 — 이번 변경 셋에서 이미 보완됨, 단 동일 메서드 이중 실행 구조 주의

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L1840–1851
- **상세**: 직전 ai-review I-5("regex 기반으로만 검증")에 대한 대응으로 `rejects.toBeInstanceOf(WorkflowForbiddenWorkspaceError)` 단언이 추가되었다. 단, 동일 테스트 내에서 `service.executeSync(...)` 를 두 번 연속 `await expect(...).rejects` 로 호출하는 구조로 구현되었다. 현재 경로는 `assertSameWorkspace` 에서 즉시 throw 하므로 부작용(DB 쓰기·이벤트 발행)이 없어 실질 격리 위험은 낮다. 그러나 동일 검증 의도를 위해 두 번의 실행이 필요한 구조는 테스트 격리 원칙상 불필요한 중복이다.
- **제안**: 단일 `rejects.toThrow(WorkflowForbiddenWorkspaceError)` 호출로 통합 권장 — Jest 의 `toThrow(ErrorClass)` 는 instanceof + message 를 동시에 검증하므로 두 단언을 하나로 병합 가능. 비차단 INFO 수준.

---

### [INFO] `mapSubWorkflowError` 음성 테스트(over-match 방지) 추가 — 이번 변경 셋에서 이미 보완됨

- **위치**: `codebase/backend/src/nodes/flow/workflow/workflow.handler.spec.ts` L333–340
- **상세**: 직전 ai-review I-7("backstop 음성 테스트 누락")에 대한 대응으로, `WORKFLOW_FORBIDDEN_WORKSPACE` prefix 없는 plain Error 가 `SUB_WORKFLOW_FAILED` 로 올바르게 fallback 되는지 검증하는 음성 테스트가 추가되었다. 이로써 총 4가지 케이스(typed mismatch / typed missing-caller / plain Error backstop / 음성 over-match 방지)가 망라된다. 테스트 의도가 주석으로 명시되어 가독성이 양호하다.
- **제안**: 없음. 충분히 커버됨.

---

### [INFO] `LlmCallRecord[]` 전환 후 `durationMs` 런타임 공급 계약 테스트 미보완

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489, L2410 (`llmCalls: LlmCallRecord[]`) + `ai-agent.handler.spec.ts`
- **상세**: 직전 ai-review I-6 항목은 이번 changeset 에서 조치되지 않았다. RESOLUTION.md I-2/I-6 에서 "push site 항상 전 필드 공급 코드 확인 + build tsc 통과 + 기존 테스트 커버"를 근거로 disposition 처리했다. 그러나 `LlmCallRecord` 의 `durationMs?` 가 optional 로 완화된 상태에서 이 계약이 테스트로 고정되지 않으면, 향후 신규 push site 에서 실수로 필드를 누락해도 컴파일 에러가 발생하지 않는다. 또한 `llmCalls` 를 소비하는 frontend `LlmInformationTab` 등이 `durationMs` 를 non-nullable 로 간주할 경우 런타임 `undefined` 를 만날 수 있다.
- **제안**: `ai-agent.handler.spec.ts` 의 LLM 호출 경로 테스트에 `expect(typeof turnDebug[0].llmCalls[0].durationMs).toBe('number')` 단언 추가를 선택적으로 고려. "항상 전 필드 공급" 계약이 코드 주석이 아닌 테스트로 고정되면 장기 유지보수성이 향상된다. 비차단 INFO 수준.

---

### [INFO] `TurnRagDelta` rename 후 shape 명시 테스트 부재

- **위치**: `codebase/frontend/src/components/editor/run-results/output-shape.ts` + 관련 test 파일
- **상세**: `TurnDebugEntry` → `TurnRagDelta` rename 은 단일 파일 4 참조 내에서 완결되었고 빌드 통과로 외부 import 가 없음이 검증되었다. `extractTurnDebug` 기존 테스트가 반환 shape 를 간접적으로 확인하지만, `TurnRagDelta` 타입명과 필드 계약(`turnIndex`, `ragSources`, `ragDiagnostics`)을 명시적으로 연결하는 테스트가 없다. `conversation-utils.ts` 의 file-private `TurnDebugEntry`(llmCalls/toolCalls)와의 의도적 구분이 테스트 레벨에서 문서화되지 않아 향후 혼동 가능성이 있다.
- **제안**: `output-shape.test.ts` 에 `TurnRagDelta` 를 직접 import 해 `{ turnIndex, ragSources, ragDiagnostics }` 필드 존재를 단언하는 테스트 1건 추가를 선택적으로 고려. 비차단 INFO 수준.

---

### [INFO] 신규 테스트 독립 격리·가독성 평가 — 전반적으로 양호

- **위치**: `workflow.handler.spec.ts` L311–340, `workflow-errors.spec.ts` L130–148, `execution-engine.service.spec.ts` L1840–1851
- **상세**: `mapSubWorkflowError` 신규 4건은 순수 함수를 직접 호출하므로 Mock 없이 외부 의존성 없이 격리 실행 가능하다. `workflow-errors.spec.ts` 신규 describe 블록은 각 `it` 이 독립 인스턴스를 생성해 테스트 간 상태 공유가 없다. 테스트 의도가 주석(`// W-6 (dev 1b) — ...`)으로 명확하게 기술되어 가독성이 우수하다. Mock 사용처가 없어 Mock 적절성 관점의 문제가 없다.
- **제안**: 없음.

---

## 요약

이번 changeset 의 테스트 전략은 직전 ai-review(22_49_28) 의 INFO 항목 3건(I-4 클래스 계약 테스트, I-5 instanceof 단언, I-7 음성 테스트)을 모두 신규 테스트로 보완하여 전반적으로 충분한 수준이다. `WorkflowForbiddenWorkspaceError` 클래스 계약은 4가지 단언으로, `mapSubWorkflowError` 4가지 분기는 독립 it 블록으로, instanceof 타입 가드는 fail-closed 테스트에 추가되었다. 각 신규 테스트는 외부 의존성 없이 격리 실행 가능하고 의도가 명확히 표현된다. 기존 테스트 7134건도 이번 변경 후 회귀 없이 통과하여 회귀 보호가 유지된다. 잔여 갭은 (1) assertSameWorkspace 에서 동일 메서드를 두 번 호출하는 이중 실행 구조(단일 `toThrow(WorkflowForbiddenWorkspaceError)` 로 병합 권장), (2) `LlmCallRecord.durationMs` 런타임 공급 계약이 테스트로 고정되지 않은 점, (3) `TurnRagDelta` shape 명시 테스트 부재 — 세 항목 모두 즉각적 회귀 위험보다는 중기 유지보수성 문제이며 INFO 등급으로 릴리스를 차단하지 않는다.

## 위험도

LOW
