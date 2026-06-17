# Testing Review — C-1 step3: FormInteractionService + ButtonInteractionService 추출

## 발견사항

### [INFO] 테스트 존재 여부 — 전반적으로 양호
- 위치: `form-interaction.service.spec.ts` (499줄), `button-interaction.service.spec.ts` (466줄)
- 상세: 신규 추출 서비스 2개 모두 전용 spec 파일이 신설됐다. 엔진 god-class 에서 분리된 4개 핵심 메서드(`waitForFormSubmission`, `processFormResumeTurn`, `waitForButtonInteraction`, `processButtonResumeTurn`)가 각각 서비스 spec 에서 직접 테스트된다. 기존 엔진 spec 에서는 이관 완료된 단위 테스트(`processFormResumeTurn — 4 branches`, `§5.5` 블록)가 정리됐고, 통합 park/resume 테스트(위임 경유)는 엔진 spec 에 잔류했다. 중복 제거와 이관이 명시적으로 수행됐다.
- 제안: 현 구조 유지.

### [WARNING] `FormInteractionService` spec — `processFormResumeTurn` 의 `emitNode` / `EXECUTION_RESUMED` 어서션 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/form-interaction.service.spec.ts` — `processFormResumeTurn — 4 branches` 블록 전체
- 상세: `processFormResumeTurn` 은 NodeExecution COMPLETED 후 `emitNode(NODE_COMPLETED)` 와 `emitExecution(EXECUTION_RESUMED)` 를 emit 한다. 그런데 form spec 의 4개 branch 케이스 어느 곳에도 `mockEventEmitter.emitNode` 또는 `mockEventEmitter.emitExecution`(EXECUTION_RESUMED) 에 대한 `expect` 호출이 없다. 반면 `button-interaction.service.spec.ts` 의 첫 번째 케이스(`button_click(port)`)는 `emitNode`, `emitExecution(EXECUTION_RESUMED)` 를 명시적으로 검증한다. form 쪽은 emit 부작용 검증이 누락돼 이벤트 버스 연결이 끊겨도 테스트가 통과한다.
- 제안: form spec 의 `(a) sentinel form_submitted` 케이스(또는 별도 케이스)에 다음 어서션 추가: `expect(mockEventEmitter.emitNode).toHaveBeenCalledWith(execId, nodeId, 'execution.node.completed', expect.objectContaining({ status: NodeExecutionStatus.COMPLETED }))` 및 `expect(mockEventEmitter.emitExecution).toHaveBeenCalledWith(execId, 'execution.resumed', expect.anything())`.

### [WARNING] `FormInteractionService` spec — `appendPresentationInteraction` (ConversationThread) 어서션 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/form-interaction.service.spec.ts` 전체
- 상세: `processFormResumeTurn` 은 `conversationThreadService.appendPresentationInteraction` 을 호출해 ConversationThread 에 폼 제출 이벤트를 기록한다. form spec 에는 `conversationThreadService` 인스턴스 변수가 선언돼 주입되지만, 어떤 테스트 케이스에도 `appendPresentationInteraction` 에 대한 spy/expect 가 없다. button spec 에서는 `appendSpy` 로 이 호출을 명시 검증한다. form 에서의 누락은 스펙 §2.1(단일 mutation entrypoint) 위반을 감지하지 못할 수 있다.
- 제안: `(a) sentinel form_submitted` 케이스에 `jest.spyOn(conversationThreadService, 'appendPresentationInteraction')` 추가 후 `expect(appendSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ interaction: expect.objectContaining({ type: 'form_submitted' }) }))` 어서션 추가.

### [WARNING] `FormInteractionService` spec — 필드 화이트리스트(WARN #8 Security) 테스트 미존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/form-interaction.service.spec.ts`
- 상세: `processFormResumeTurn` 에는 WARN #8 보안 방어 로직이 있다: `node.config.fields` 에 정의된 필드명만 통과시키는 화이트리스트 필터. 이 경로는 XSS payload 나 외부 통합 키 주입을 방어하는 중요 코드이지만, 현 spec 에서 이를 테스트하는 케이스가 없다. 모든 테스트는 `formData: { answer: 'yes' }` 처럼 허용된 필드만 전달하며, 미허용 키가 걸러지는지, `allowedFieldNames.size === 0` 패스스루 경로(`fieldDefs` 가 빈 배열일 때)가 올바르게 동작하는지를 검증하지 않는다.
- 제안: 케이스 추가 — (1) 미허용 필드 포함 formData 제출 시 interactionData 에서 제거됨을 검증, (2) `config.fields = []` 일 때 모든 키가 통과(allowedFieldNames.size === 0 분기)되는지 검증.

### [INFO] `ButtonInteractionService` spec — `previousOutput` 무한 체인 방지 로직 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/button-interaction.service.spec.ts`
- 상세: `processButtonResumeTurn` 은 `rawPrevOutput` 에서 `previousOutput` 키를 제거해 반복 resume 시 `previousOutput.previousOutput.…` 체인이 무한 성장하는 것을 방지하는 코드가 있다. button spec 에 이 방어 로직을 검증하는 케이스가 없다. 기능이 실제로 동작하는지 회귀 보호가 없는 상태다.
- 제안: `seedButtonContext` 로 기존 `structuredOutputCache` 에 `previousOutput` 을 가진 output 을 설정한 후 resume 결과의 `previousOutput` 이 nested 되지 않음을 검증하는 케이스 추가.

### [INFO] 두 spec 파일 — `afterEach` / `jest.restoreAllMocks()` 미설정
- 위치: `form-interaction.service.spec.ts`, `button-interaction.service.spec.ts` — `beforeEach` 블록
- 상세: 두 spec 파일 모두 `afterEach` 가 없다. `form-interaction.service.spec.ts` 의 `runFormResume` 헬퍼 내에서 `jest.spyOn(contextService, 'setStructuredOutput')` 을 반복 생성하고, button spec 에서도 여러 테스트에서 `setNodeSpy = jest.spyOn(...)` 을 반복 생성한다. spy 가 자동 복원되지 않으면 중복 등록이 발생해 특히 `form-interaction.service.spec.ts` 의 `runFormResume` 헬퍼 반복 호출 시 spy call count 가 누적될 수 있다. `warnSpy.mockRestore()` 는 form spec에서 명시적으로 호출되지만, `setStructuredOutput` spy 는 아니다.
- 제안: `describe('FormInteractionService')` 및 `describe('ButtonInteractionService')` 블록에 `afterEach(() => { jest.restoreAllMocks(); })` 추가.

### [INFO] `ButtonInteractionService` spec — `waitForButtonInteraction` 에 `nodeExec null` 케이스 미존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/button-interaction.service.spec.ts` — `waitForButtonInteraction` describe 블록
- 상세: `waitForButtonInteraction` 은 `nodeExec` 가 `null` 일 때 `updateExecutionStatus` 에 `undefined` 를 전달하는 분기가 있다(`nodeExec ?? undefined`). form spec 에는 이 케이스를 검증하는 `'nodeExec 부재 시에도 WAITING 전이 + emit'` 케이스가 있지만, button spec 에는 동일 케이스가 없다. button 경로에서 null nodeExec 대응이 동일하게 동작하는지 회귀 보호가 없다.
- 제안: button spec `waitForButtonInteraction` describe 블록에 `findOne.mockResolvedValueOnce(null)` 케이스 추가.

### [INFO] 엔진 spec — 이관된 테스트의 통합 경로(위임 경유) 검증 구조 적절
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: 엔진 spec 의 `dispatchResumeTurn` 테스트들은 `formInteraction`/`buttonInteraction` 인스턴스를 모듈에서 직접 얻어 spy 한다. `conversationThreadService` 를 싱글톤으로 얻어 위임 너머 부작용을 검증하는 패턴도 `AiTurnOrchestrator` 선례를 따라 일관되게 적용됐다. 이 부분은 리팩터링 후에도 통합 검증 구조가 올바르게 유지됐다.
- 제안: 현 구조 유지.

### [INFO] Mock 적절성 — EngineDriver mock 방식 양호
- 위치: `form-interaction.service.spec.ts`, `button-interaction.service.spec.ts` — `mockDriver` 설정
- 상세: 두 spec 모두 `EngineDriver` 를 mock 으로 주입하고, `contextKeyOf` 는 `(ctx) => ctx.executionId` 의 실제 동작과 동일하게 구현했다. `stageDurableResumeSnapshot` 과 `updateExecutionStatus` 는 mock 이며 call count/인자로 검증한다. `ExecutionContextService` 와 `ConversationThreadService` 는 실제 인스턴스를 사용해 stateless 메서드의 실제 동작을 보장한다. 이 조합은 단위 격리와 실제 동작 검증의 균형이 적절하다.
- 제안: 현 구조 유지.

---

## 요약

신규 추출된 `FormInteractionService` 와 `ButtonInteractionService` 에 대한 전용 spec 파일이 신설됐으며, 기존 엔진 spec 에서 이관된 테스트들이 적절히 배치됐다. 엔진 spec 의 통합 테스트는 위임 인스턴스를 직접 spy 하는 방식으로 올바르게 전환됐다. 그러나 `FormInteractionService` spec 에는 `processFormResumeTurn` 의 `emitNode`/`EXECUTION_RESUMED` 이벤트 emit 검증, `appendPresentationInteraction` ConversationThread 검증, WARN #8 보안 whitelist 필터 검증이 모두 누락돼 있다. button spec 에서는 이 중 emit 과 thread append 는 검증하나, form 쪽 gap 이 더 크다. `previousOutput` 무한 체인 방지 로직 회귀 보호도 button spec 에 없다. `afterEach` 미설정으로 인한 spy 누적 위험도 존재한다.

---

## 위험도

MEDIUM
