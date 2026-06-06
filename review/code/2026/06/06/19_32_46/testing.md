# Testing Review — exec-park B-1 (dispatchResumeTurn registry + PARK_RELEASED 이관)

## 발견사항

### [INFO] 신규 테스트 블록의 전반적 커버리지 수준은 양호
- 위치: `execution-engine.service.spec.ts` L10937~10937+248 (dispatchResumeTurn describe 블록)
- 상세: 라우팅 우선순위(form>buttons>ai) · PARK_RELEASED 전파 · 미지원 interaction throw · handleAiResumeTurn 내부 두 경로(실패/정상)까지 9개 케이스 커버. `resumeTurnRegistry` lazy 캐시 리셋(`_resumeTurnRegistry = undefined`)을 `afterEach` 에서 명시 처리해 테스트 간 상태 누수를 차단한 점이 특히 우수함.

### [WARNING] `driveResumeFrame` (중첩 frame) 에서의 `dispatchResumeTurn` 연결 경로가 단위 테스트에 없음
- 위치: `execution-engine.service.ts` diff 내 `driveResumeFrame` 의 `opts.isInnermost` 분기 (신규 `turnOutcome = await this.dispatchResumeTurn(...)`)
- 상세: 변경 diff 에서 `driveResumeFrame` 의 innermost 분기도 `dispatchResumeTurn` 으로 교체됐다. 새로 추가된 spec 테스트(`dispatchResumeTurn` describe)는 메서드 자체를 spy 대체해 라우팅만 검증하므로, 중첩 재개(driveResumeFrame → dispatchResumeTurn → processButtonResumeTurn 등)가 end-to-end 로 연결되는지 확인하는 통합 레벨 케이스가 없다. 기존 중첩 재개 테스트(`driveCallStackResume` 관련)가 이 경로를 간접 커버할 수 있으나, 파일 컨텍스트에서 그 테스트들이 변경 이후에도 `driveResumeFrame` 내부 분기를 실행하는지 확인이 불가하다.
- 제안: 기존 중첩 재개 통합 테스트(`armSlowPathResume` 패턴 활용)에서 button/form/AI 각각의 중첩 경로가 `dispatchResumeTurn` 통해 여전히 정상 동작함을 검증하는 케이스를 보강하거나, 기존 케이스가 이미 커버하면 주석으로 명시.

### [WARNING] `handleAiResumeTurn` 정상 경로 테스트에서 `processAiResumeTurn` 인자 검증이 부분적
- 위치: `execution-engine.service.spec.ts` L249~282 ("handleAiResumeTurn: 정상 → seed + processAiResumeTurn 결과 전달")
- 상세: `processAiResumeTurn` 이 호출됐는지(`toHaveBeenCalledTimes(1)`)만 확인하고, 실제 전달 인자(`savedExecution`, `executionId`, `node`, `context`, `nodeExec`, `resumeState`, `payload`)는 검증하지 않는다. `ctx.nodeExec` 가 `null` 일 때 그대로 전달되는지, `payload` 가 정확히 연결되는지 등은 인자 수준 검증 없이는 확인 불가.
- 제안: `aiSpy.mock.calls[0]` 또는 `toHaveBeenCalledWith(...)` 로 `resumeState`, `nodeExec`, `payload` 인자를 추가 검증.

### [INFO] `resumeTurnRegistry` lazy 초기화 후 registry 항목 수·순서·`kind` 필드는 별도 테스트 없음
- 위치: `execution-engine.service.ts` L979~1019 (`resumeTurnRegistry` getter)
- 상세: registry 는 순서가 우선순위를 표현하므로(`form → buttons → ai_conversation`) 항목 순서가 중요하다. 현재 테스트는 각 라우팅 결과를 확인하지만, registry 배열 자체(길이=3, kind 순서)를 직접 단언하는 케이스는 없다. `_resumeTurnRegistry` 를 직접 리셋하는 afterEach 패턴이 이미 있으므로 추가 비용이 낮다.
- 제안: registry 항목 수(`length === 3`)와 `kind` 필드 순서(`['form','buttons','ai_conversation']`)를 확인하는 케이스 1개 추가하면 향후 registry 항목 추가/삭제 시 회귀 방어 가능 (저위험, 선택적).

### [INFO] `process-turn-result.ts` 신규 모듈에 대한 단독 단위 테스트 없음
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts`
- 상세: `PARK_RELEASED` 가 Symbol 인지(`typeof PARK_RELEASED === 'symbol'`) · `ProcessTurnResult` 타입이 올바르게 내보내지는지는 컴파일 레벨에서 보장되지만, Symbol 동일성(`PARK_RELEASED === PARK_RELEASED`)과 import 경로 정확성은 기존 `execution-engine.service.spec.ts` 의 import 에 의존한다. 34줄짜리 순수 상수 파일이라 별도 spec 파일 필요성은 낮으나, import 경로 변경 시 캐치 포인트가 없다.
- 제안: 기존 spec 파일 상단의 `PARK_RELEASED` import 테스트(`expect(PARK_RELEASED).toEqual(expect.any(Symbol))`) 1줄로 충분히 smoke-level 보호 가능 (현재 미존재).

### [INFO] `ai_form_render` interactionType 이 AI selector 에서 누락
- 위치: `execution-engine.service.spec.ts` 신규 describe 내 AI 라우팅 케이스 (L128~148, L150~167)
- 상세: `ResumeTurnSelector.isAiConversation` 는 `ai_conversation / ai_form_render` 를 모두 포함한다고 JSDoc 에 명시돼 있으나, 테스트는 `persistedInteractionType: 'ai_conversation'` 케이스만 커버하고 `ai_form_render` + `isAiConversation: true` 조합은 없다.
- 제안: `ai_form_render` 타입 케이스를 기존 AI 라우팅 케이스 중 하나에 `it.each` 또는 파라미터화로 추가해 두 interactionType 이 모두 handleAiResumeTurn 으로 라우팅됨을 보장.

### [INFO] `isCheckpointEligibleNodeType` 게이팅 — 미적격 node type 에서 AI selector 가 false 반환하는 케이스 없음
- 위치: `execution-engine.service.ts` L1013~1016 (ai_conversation selector 의 `this.isCheckpointEligibleNodeType(sel.node.type)`)
- 상세: AI selector 는 `isAiConversation && hasResumeCheckpoint && isCheckpointEligibleNodeType(nodeType)` 세 조건의 AND 다. 현재 테스트는 세 조건이 모두 true 인 케이스와 `hasResumeCheckpoint: false` 케이스만 있고, `isCheckpointEligibleNodeType` 이 false 인 node type (예: 'webhook')에서 AI selector 가 매칭하지 않고 RESUME_CHECKPOINT_MISSING 로 떨어지는 케이스가 없다.
- 제안: `isAiConversation: true`, `resumeCheckpoint: { schemaVersion: 1 }`, `node.type: 'webhook'`(미적격) 조합 케이스를 추가해 세 번째 조건의 게이팅을 명시적으로 검증.

## 요약

이번 변경의 핵심은 `driveResumeAwaited`·`driveResumeFrame` 두 곳에 하드코딩된 form/buttons/AI 3분기를 `resumeTurnRegistry` 의 `dispatchResumeTurn` 으로 일원화하고, `PARK_RELEASED`/`ProcessTurnResult` 타입을 공유 모듈로 추출한 것이다. 새로 추가된 9개 케이스는 라우팅 우선순위·PARK_RELEASED 전파·throw 경로·handleAiResumeTurn 내부 두 분기를 직접 검증하며, `afterEach` 에서 registry lazy 캐시 리셋까지 처리해 테스트 격리 품질이 높다. 다만 변경의 두 번째 적용 지점인 `driveResumeFrame` 중첩 경로가 신규 단위 테스트에서 미검증 상태이고, `processAiResumeTurn` 인자 수준 검증·`ai_form_render` 타입 케이스·`isCheckpointEligibleNodeType` false 케이스가 부재해 커버리지 갭이 남아 있다. 이 중 중첩 경로 연결 확인과 `processAiResumeTurn` 인자 검증은 회귀 방어 실효성에서 WARNING 수준이며, 나머지는 INFO 수준이다.

## 위험도

LOW
