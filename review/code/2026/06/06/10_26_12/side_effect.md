# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `finalizeAiNode` 의 RUNNING 상태 바이패스가 `segmentStartMs` 누산을 건너뜀

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 6369–6380
- **상세**: `processAiResumeTurn` → `finalizeAiNode('COMPLETED')` 경로에서 `savedExecution.status === RUNNING` 이면 `updateExecutionStatus(RUNNING)`을 건너뛰고 `nodeExecutionRepository.save(nodeExec)` 만 호출한다. `updateExecutionStatus` 가 `segmentStartMs` 의 단일 choke-point 이므로, 이 바이패스 경로에서는 세그먼트 종료 시점의 `activeRunningMs` 합산이 발생하지 않는다. 코드 주석에는 "누적은 driveResumeDetached 의 RUNNING 진입 시 시작됐고 다음 그래프 종결/park 에서 닫힌다"고 서술돼 있으며, 정상 그래프 순회(노드 완료 후 다음 blocking 노드 park 또는 COMPLETED 종결)에서 `updateExecutionStatus(WAITING_FOR_INPUT|COMPLETED|FAILED)` 가 반드시 호출되어 `segmentStartMs` 가 flush 된다. 그러나 `ai_end_conversation` 처리 후 그래프 순회 중 예외가 발생하거나, 종결이 또 다른 RUNNING 바이패스 경로(`finalizeAiNode` FAILED 분기도 조건 확인 필요)를 타는 경우 `segmentStartMs` 엔트리가 Map 에 잔류해 과다 누산 혹은 누락이 생길 수 있다. 지금 구조에서 FAILED 분기는 `updateExecutionStatus(FAILED)` 를 정상 호출(RUNNING→FAILED)하므로 flush 된다. 실제 위험 범위는 "정상 대화 종료 후 다음 노드에서 예외 발생 시 segmentStartMs 잔류" 로 한정되며 이는 새 코드가 아닌 기존 예외 경로에도 동일하게 존재한다. 의도적 설계로 보이나 주석에 명시된 "다음 상태 전이에서 flush" 가 바이패스 경로에서 보장되는지 테스트 커버리지가 없다.
- **제안**: `finalizeAiNode` 의 RUNNING 바이패스 블록에서 `segmentStartMs` flush 를 별도로 수행하거나, 해당 경로의 단위 테스트에서 `activeRunningMs` 누산 여부를 명시적으로 어설션한다.

---

### [WARNING] `waitForAiConversation` 시그니처 변경 — 반환 타입이 `void` 에서 `void | ParkSignal` 로 확장

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 4968–4986
- **상세**: `parkMode` 파라미터 추가(기본값 `'await'`)와 동시에 반환 타입이 `Promise<void>` 에서 `Promise<void | ParkSignal>` 로 변경됐다. 메서드가 `private` 이므로 외부 공개 API 계약은 변경되지 않는다. 그러나 `waitForAiConversation` 을 `await` 하면서 반환값을 무시하는 내부 호출 지점(line 2968 — `executeInline` 경로)이 여전히 존재한다. 이 호출은 `parkMode='await'`(기본)이므로 `PARK_RELEASED` 를 반환하지 않아 실제 버그는 없다. 다만 TypeScript 컴파일러가 `void | ParkSignal` 반환을 `await` 한 뒤 묵시적으로 무시하도록 허용하므로, 미래에 해당 호출 지점의 `parkMode` 가 `'release'` 로 변경될 경우 반환값 미처리가 silent miss 된다.
- **제안**: `executeInline` 의 `waitForAiConversation` 호출(line 2968)에 `parkMode='await'` 를 명시적 인자로 전달해 의도를 코드에 고정시키거나, 해당 호출을 `waitForAiConversation(…, 'await')` 로 명기한다.

---

### [INFO] `reparkAiResumeTurn` 에서 `emitAiWaitingForInput` 미호출 — `EXECUTION_WAITING_FOR_INPUT` 이벤트 미발행

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 5387–5398
- **상세**: `reparkAiResumeTurn` 은 `stageDurableResumeSnapshot` + `updateExecutionStatus(WAITING_FOR_INPUT)` 만 수행하며 `emitAiWaitingForInput` 를 호출하지 않는다. 주석에 "재호출하지 않는 이유: systemPrompt/llmConfigId credential 유출 방지"라고 명시돼 있다. 이로 인해 계속 turn 에서 `EXECUTION_WAITING_FOR_INPUT` WebSocket 이벤트가 발행되지 않는다(첫 turn 의 `emitAiWaitingForInput` 에서만 발행됨). 채널 어댑터가 이 이벤트로 "AI 응답 완료, 다음 입력 대기 중" UI 상태를 갱신한다면 후속 turn 에서 상태 갱신이 누락된다. 의도적 설계(AI_MESSAGE 이벤트만으로 클라이언트 상태 갱신)인지, 아니면 채널 어댑터가 이를 보완하는 별도 메커니즘이 있는지 spec 에서 확인이 필요하다.
- **제안**: 채널 어댑터가 `AI_MESSAGE` 이벤트를 수신한 뒤 다음 입력 대기 상태로 전환하는지 확인한다. 필요하다면 re-park 시 credential 을 포함하지 않는 최소 `EXECUTION_WAITING_FOR_INPUT` 이벤트(노드 output 제외)를 별도로 발행하도록 한다.

---

### [INFO] `processAiResumeTurn` 에서 `payload as ContinuationPayload` 캐스트 — 타입 검증 없음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 5293
- **상세**: `opts.payload: unknown` 을 `payload as ContinuationPayload` 로 타입 단언한 뒤 `action.type` 을 분기한다. 알 수 없는 `action.type` 에 대한 fallthrough 경로(warn + re-park)가 있어 런타임 안전성은 확보돼 있다. 다만 `payload` 가 `null` 이거나 원시 타입일 경우 `action.type` 접근 시 런타임 TypeError 가 발생하고 상위 `driveResumeDetached` catch 블록이 이를 `finalizeResumedExecutionOutcome` 으로 처리해 Execution 이 FAILED/CANCELLED 된다. 기존 `runAiConversationLoop` 도 동일한 캐스트를 사용하므로 새로운 위험은 아니나, 새 진입 경로(`driveResumeDetached`가 `opts.payload` 를 직접 주입)에서는 null guard 가 추가되면 방어 코드로서 유용하다.
- **제안**: `if (!payload || typeof payload !== 'object')` 가드를 `processAiResumeTurn` 첫 줄에 추가해 null/primitive 입력 시 warn + re-park 처리한다.

---

### [INFO] 테스트에서 비공개 메서드 직접 스파이(`svcAny.processAiResumeTurn`) — 리팩터링 취약성

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` line 10279, 10389, 10806
- **상세**: `svcAny` 캐스트로 `private` 메서드 `processAiResumeTurn` 에 직접 `jest.spyOn`/대체 주입한다. 이는 이전 `waitForAiConversation` 스파이와 동일한 패턴으로, 내부 구현 메서드명 변경 시 테스트가 묵시적으로 기존 동작을 테스트하지 못하게 된다(TypeScript 타입 오류가 없으므로 컴파일타임 가드 없음). 부작용 관점에서 테스트 격리 자체에는 문제 없다.
- **제안**: 메서드명 변경 시 `svcAny` 참조를 빠짐없이 갱신하도록 주석으로 명기하거나, 가능하다면 공개 진입점(`rehydrateAndResume`) 경유 통합 테스트로 대체한다.

---

### [INFO] 문서/리뷰 파일(파일 3-9)의 파일시스템 부작용 — 의도적

- **위치**: `review/consistency/2026/06/06/03_22_15/` 하위 파일들
- **상세**: RESOLUTION.md, SUMMARY.md, cross_spec.md, convention_compliance.md, naming_collision.md, meta.json, _retry_state.json 이 모두 신규 생성된다. 프로젝트 규약(`CLAUDE.md §정보 저장 위치`)에 따른 일관성 검토 산출물 경로(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 올바르게 위치한다. 의도된 파일시스템 부작용이므로 위험 없음.

---

## 요약

이번 변경의 핵심은 top-level 멀티턴 AI 를 기존 장수 루프(`runAiConversationLoop`) 에서 turn 단위 park-release 모델(`processAiResumeTurn`)로 전환한 것이다. 전역 변수 도입, 외부 API 변경, 환경 변수 읽기/쓰기, 네트워크 직접 호출은 없다. `waitForAiConversation` 은 `private` 메서드이므로 시그니처 변경의 외부 영향도 없다. 가장 주목할 부작용 위험은 두 가지다. 첫째, `finalizeAiNode` RUNNING 바이패스 경로에서 `segmentStartMs` 를 직접 flush 하지 않아 다음 상태 전이가 실패하면 타이머 엔트리가 잔류할 수 있는 내부 상태 변경 누락 가능성(WARNING). 둘째, `waitForAiConversation` 의 반환 타입 확장(`void | ParkSignal`)으로 인해 `executeInline` 호출 지점이 반환값을 묵시적으로 무시하는 잠재적 미래 위험(WARNING). `reparkAiResumeTurn` 에서 `EXECUTION_WAITING_FOR_INPUT` 이벤트를 발행하지 않는 설계는 의도적으로 명문화돼 있으나 채널 어댑터의 보완 메커니즘을 명시적으로 확인할 필요가 있다. 리뷰 산출물(파일 3-9)의 파일시스템 부작용은 프로젝트 규약에 부합한다.

## 위험도

LOW

STATUS: OK
