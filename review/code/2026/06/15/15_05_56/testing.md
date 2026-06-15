# Testing Review — execution §1.3 single-node execution

리뷰 대상: `POST /api/workflows/:id/nodes/:nodeId/execute` (단일 노드 실행 §1.3)
변경 파일: V098 마이그레이션, execution-engine.service.ts, workflows.controller.ts, execute-node.dto.ts, workflow-canvas.tsx, node-settings-panel.tsx, workflows.ts (API client), i18n, e2e spec, unit spec

---

## 발견사항

### [WARNING] engine 단위 테스트에 `outputData` 최종값 검증 없음
- 위치: `execution-engine.service.spec.ts` 라인 2725–2797, 신규 `describe('runExecution — 단일 노드 실행 (§1.3)')`
- 상세: `runExecution` 은 `singleNodeId` 가 세팅된 경우 `resultNodeId = singleNodeId` 로 대체해 `savedExecution.outputData`를 대상 노드 출력으로 마감한다(`execution-engine.service.ts` 라인 3744–3351 신규 분기). 두 엔진 테스트 케이스 모두 `mockHandler.execute` 호출 횟수와 `seenInputs[0]` 값만 검증하고, `savedExecution.outputData`가 `node-2` (또는 `node-1`)의 출력으로 세팅됐는지는 어설션하지 않는다. `resultNodeId` 계산 로직이 회귀해도 기존 테스트는 통과한다.
- 제안: 두 케이스 모두에 `expect(mockExecutionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ outputData: expect.objectContaining({...}) }))` 형태의 `outputData` 어설션을 추가한다.

### [WARNING] `seedSingleNodePredecessorOutputs` — non-canonical(bare/legacy) outputData 분기 미테스트
- 위치: `execution-engine.service.ts` 라인 7793–7414, `seedSingleNodePredecessorOutputs` 내 `isCanonical` 분기
- 상세: `seedSingleNodePredecessorOutputs`는 DB에서 조회한 `outputData`가 canonical 형태(`{config, output}`)인지 판별해 non-canonical이면 `wrapBareAsNodeHandlerOutput`으로 폴백한다. 엔진 스펙 테스트의 신규 케이스는 `mockOutput({ seeded: 42 })`(= `{config:{}, output:{seeded:42}}`)를 사용해 canonical 경로만 커버한다. 배포 이전 row(output이 bare object)를 처리하는 폴백 경로는 단위 테스트에 전혀 없다. 비-canonical 입력이 들어오면 `wrapBareAsNodeHandlerOutput`의 wrapping 결과가 `gatherNodeInput`에 올바르게 전달되는지 알 수 없다.
- 제안: 세 번째 케이스로 `outputData`가 bare object(`{ seeded: 42 }`, config/output 키 없음)인 `NodeExecution` row를 `mockNodeExecutionRepo.find.mockResolvedValueOnce`로 세팅하고, `seenInputs[0]`이 여전히 올바른 flat 값을 받는지 검증한다.

### [WARNING] e2e 테스트 F가 predecessor seeding 경로를 커버하지 않음
- 위치: `test/workflow-execution.e2e-spec.ts` 라인 2245–2258 (케이스 F)
- 상세: 케이스 F는 `manual_trigger` 타입 노드(그래프의 최초 진입 노드이므로 incoming edge 없음)를 대상으로 하고 `previousExecutionId` 없이 호출한다. 이는 수동 입력 fallback 경로만 e2e에서 검증한다. `previousExecutionId`를 실제로 제공해 `getLatestPredecessorOutputs` → `seedSingleNodePredecessorOutputs`가 실행되는 경로는 e2e 레벨에서 전혀 커버되지 않는다. predecessor seeding의 DB 쿼리(`nodeExecutionRepository.find`), `nodeOutputCache` 세팅, 대상 노드로의 입력 전달이 실제 DB 환경에서 올바르게 동작하는지 검증되지 않는다.
- 제안: (선택적이나 권장) 케이스 F 다음에 케이스 F2를 추가한다: 워크플로우를 먼저 전체 실행해 executionId를 얻고, 그 executionId를 `previousExecutionId`로 전달해 내부 노드를 대상으로 단일 노드 실행한다. 폴링 후 terminal 상태 도달과 `output_data`가 존재함을 검증한다.

### [WARNING] controller 테스트에 workflow 404 케이스 없음
- 위치: `workflows.controller.spec.ts` 신규 `describe('WorkflowsController (executeNode endpoint, §1.3)')`
- 상세: 5개 케이스 중 `workflowsService.findById`가 `NotFoundException`을 던지는 시나리오(존재하지 않는 workflowId)가 없다. `executeNode` 구현은 `findById` → `nodeRepository.findOneBy` 순서로 실행되므로, `findById`가 reject되면 node/execution 조회가 일어나지 않아야 한다는 불변식을 테스트가 보장하지 않는다.
- 제안: `workflowsService.findById`가 `NotFoundException`을 throw하도록 설정하고 `engine.execute`가 호출되지 않음을 검증하는 케이스를 추가한다.

### [WARNING] `handleRunThisNode` (frontend) — 단위/컴포넌트 테스트 전무
- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` 라인 267–218 (신규 `handleRunThisNode` callback)
- 상세: `workflow-canvas.tsx`의 `handleRunThisNode`는 (1) `isDirty` 시 `saveWorkflow` 먼저 호출, (2) `execState.status === 'running'` 시 early return, (3) `workflowsApi.executeNode` 호출 → `startExecution`, (4) 에러 시 `console.error`로만 흡수하는 로직을 가진다. 이 네 가지 분기 중 어느 것도 프론트엔드 테스트에서 검증되지 않는다. `node-settings-panel.tsx`의 `InfoTab` `latestResult` 표시 로직도 마찬가지로 테스트가 없다. `codebase/frontend/src/components/editor/settings-panel/__tests__/node-settings-panel-error-handling.test.tsx`는 error handling 전용이며 `latestResult` 렌더링은 포함하지 않는다.
- 제안: `handleRunThisNode`는 `workflowsApi`를 mock한 RTL(React Testing Library) 또는 Jest 단위 테스트로 커버한다. 최소한 (a) `status === 'running'` 시 API 미호출, (b) `isDirty=true`에서 `saveWorkflow` 선행 호출, (c) API 성공 시 `startExecution` 호출 세 케이스를 검증한다. `InfoTab`의 `latestResult` 표시도 스냅샷 또는 `getByText` 단언으로 커버한다.

### [INFO] 두 번 `await flushPromises()` 호출의 의도 미문서화
- 위치: `execution-engine.service.spec.ts` 라인 2758–2760, 2793–2795
- 상세: 두 케이스 모두 `await flushPromises(); await flushPromises();`를 연속 두 번 호출한다. 동일 파일의 기존 케이스 대부분은 한 번만 호출한다. 이중 flush가 왜 필요한지(비동기 체인 깊이, background execution 이벤트 루프 등) 주석이 없어 코드 읽는 사람이 의도를 추론해야 한다. 실제로는 충분하지 않아 간헐적으로 어설션이 빈 상태를 보는 경우도 배제할 수 없다.
- 제안: 두 번 flush가 필요한 이유를 인라인 주석으로 설명한다(예: "background setStatus → save 비동기 체인 2단계 flush"). 또는 `jest.runAllTimers()` + `flushPromises()` 조합으로 더 견고하게 처리한다.

### [INFO] `ExecuteNodeDto` 단위 테스트 없음
- 위치: `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts` (신규)
- 상세: `@IsUUID()` 검증이 실제로 동작하는지(예: 비-UUID 문자열 거부), `@IsObject()` 가 배열/string 등을 거부하는지 DTO 레벨 단위 테스트가 없다. 다른 DTO들(`ExecuteWorkflowDto` 등)도 유사하게 DTO 단위 테스트가 없는 패턴이라면 프로젝트 전체적으로 INFO지만, 새 DTO는 UUID 유효성이 보안(IDOR 방지)에 직결되므로 검증 가드 동작 확인이 권장된다.
- 제안: `class-validator`의 `validate()`를 사용해 `previousExecutionId`에 비-UUID(예: `'not-a-uuid'`)를 넘겼을 때 validation error가 반환됨을 검증하는 테스트를 추가한다.

### [INFO] 마이그레이션 V098에 대한 별도 SQL 통합 테스트 없음
- 위치: `codebase/backend/migrations/V098__execution_single_node.sql`
- 상세: 마이그레이션 자체의 적용 가능성(컬럼 추가, COMMENT 적용)은 e2e 환경에서 Flyway를 통해 간접 검증된다. 그러나 DOWN 스크립트(주석으로만 존재)는 테스트되지 않는다. 프로젝트 선례(`re_run_of`, `chain_id`)와 동일하게 이는 info 수준이다.
- 제안: DOWN 스크립트를 실행 불가능한 주석이 아닌 별도 `V098__rollback` 파일로 관리하거나, 현 패턴을 유지한다면 e2e 스펙에 마이그레이션 다운/업 검증을 추가하는 것을 중장기적으로 검토한다.

---

## 요약

이번 변경은 backend unit(controller 5케이스 + engine 2케이스)과 e2e 3케이스(F/G/H)로 핵심 해피패스와 주요 400/503 오류 경로를 커버하고 있어 기본 테스트 골격은 갖춰져 있다. 그러나 engine 레벨에서 `outputData` 최종값 검증이 빠져 있고, `seedSingleNodePredecessorOutputs`의 non-canonical(legacy) 출력 처리 경로가 단위 테스트로 검증되지 않는다. e2e 케이스 F는 predecessor seeding을 실제로 실행하지 않는 first-node만 대상으로 하므로 DB 기반 seed 흐름은 e2e 수준에서 공백이다. 프론트엔드 `handleRunThisNode`와 `InfoTab` latestResult 표시는 테스트가 전무하며 runtime 회귀 위험이 있다. controller의 workflow 404 케이스도 누락되어 있다. 이 중 engine outputData 어설션 누락과 legacy seed 경로 미테스트가 가장 영향이 크며 테스트를 추가해 회귀 안전망을 보완해야 한다.

---

## 위험도

MEDIUM

주요 근거: 핵심 동작(단일 노드 1개만 실행 + seed 입력 주입)의 양방향 검증에서 `outputData` 최종값이 빠져 있고, legacy 출력 처리 경로가 미검증 상태다. 프론트엔드 단위 테스트 공백도 실사용 시 조용한 실패(console.error 흡수)로 이어질 수 있다. 단, 핵심 400/503 오류 경로와 동작 횟수 검증은 존재하며, e2e F/G/H가 HTTP 레이어 회귀를 부분적으로 방어하므로 CRITICAL이 아닌 MEDIUM으로 판정한다.
