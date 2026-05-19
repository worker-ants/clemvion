# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `sanitizeLastErrorMessage` 크로스 모듈 직접 import
- 위치: diff 라인 +35 (`import { sanitizeLastErrorMessage } from '../integrations/integration-oauth.service'`)
- 상세: `execution-engine.service.ts` 가 `integration-oauth.service` 에서 내부 헬퍼를 직접 import 하고 있다. 이 함수는 OAuth 도메인 서비스 내에서 정의된 것으로, OAuth 관련 변경 시 signature 나 동작이 바뀌면 execution-engine 전체 경로에 의도치 않은 부작용이 발생한다. 두 모듈 사이에 명시적인 의존 관계가 없었으므로 이 변경으로 새로운 교차 모듈 결합이 생겼다.
- 제안: `sanitizeLastErrorMessage` 를 `shared/utils/sanitize.ts` 등 공유 레이어로 이동시키거나, `execution-engine` 자체에 로컬 sanitize 함수를 정의해 OAuth 모듈 의존성을 제거.

### [WARNING] `finalizeAiNode` 시그니처 변경 — 기존 호출자 영향
- 위치: diff 라인 +273 (`finalStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED'`)
- 상세: `finalizeAiNode` 에 `finalStatus` 파라미터가 추가됐다. 기본값 `'COMPLETED'` 가 있어 기존 호출자는 컴파일 에러가 나지 않지만, `waitForAiConversation` 만 이 파라미터를 전달하는 유일한 호출 경로다. 다른 경로에서 `finalizeAiNode` 를 호출할 경우 기본값 `'COMPLETED'` 로 처리된다. 현재 코드베이스에 다른 호출자가 없다면 안전하지만, 파라미터 추가가 private 메서드라 리플렉션·테스트 stub 에 영향을 줄 수 있다.
- 제안: 위험도는 낮으나, 파라미터가 선택적이라는 점을 JSDoc 에 명시하고, 기존 테스트 suite 에서 `finalizeAiNode` 를 직접 spy/stub 하는 경우 시그니처 업데이트 여부를 확인.

### [WARNING] `handleAiTurnError` 에서 `nodeExec.outputData` 를 직접 mutate
- 위치: diff 라인 +187 (`nodeExec.outputData = safe`)
- 상세: `nodeExec` 는 `NodeExecution` 엔티티 참조다. `handleAiTurnError` 가 `outputData` 를 직접 할당한 후 `finalizeAiNode` 의 FAILED 분기에서 `this.nodeExecutionRepository.save(nodeExec)` 를 호출한다. 이는 의도된 흐름이지만, `handleAiTurnError` → `finalizeAiNode` 사이에 다른 코드가 `nodeExec.outputData` 를 다시 덮어쓸 경우 경쟁 상태가 발생할 수 있다. 현재는 단일 경로라 안전하나, 향후 확장 시 공유 엔티티 참조 mutate 패턴이 의도치 않은 상태 변경을 일으킬 수 있다.
- 제안: `nodeExec.outputData` 를 직접 할당하는 위치를 `finalizeAiNode` 의 FAILED 분기 한 곳으로 통일하거나, 주석으로 "이 시점 이후 outputData 재할당 금지" 가드를 명시.

### [WARNING] FAILED 분기에서 `throw new Error(errorMessage)` — `waitForAiConversation` 호출자 전파
- 위치: diff 라인 +350-352 (`throw new Error(errorMessage)`)
- 상세: `finalizeAiNode` 의 FAILED 분기가 `NODE_FAILED` 이벤트를 emit 한 뒤 sentinel error 를 throw 한다. 주석에 "`runExecution` catch 로 흐른다"고 명시돼 있으나, `waitForAiConversation` 가 `finalizeAiNode` 를 직접 await 하므로 throw 는 `waitForAiConversation` → 호출자 체인 전체를 통해 전파된다. `executeInline` 의 `while` 루프도 같은 `waitForAiConversation` 를 호출하므로(라인 1378), sub-workflow 내 AI conversation FAILED 시 `executeInline` 의 try/catch 가 이 sentinel error 를 받아 상위 실행 전체를 FAILED 처리할 수 있다. 이는 의도된 동작으로 보이나, sentinel error 가 일반 Error 로 throw 되기 때문에 `runExecution` catch 이외의 catch 에서 구분이 불가능하다.
- 제안: sentinel error 를 식별 가능한 전용 클래스(`AiTurnFinalizedError` 등)로 분리해, 중간 catch 블록이 오류를 오분류하거나 삼키는 위험을 차단.

### [INFO] `handleAiMessageTurn` 반환 타입 확장 — 기존 디스트럭처링 호환성
- 위치: diff 라인 +81-92 (반환 타입에 `finalStatus?: 'FAILED'` 추가)
- 상세: 반환 타입에 선택적 필드 `finalStatus` 가 추가됐다. 기존 호출자(`waitForAiConversation`)는 `turn.finalStatus` 를 명시적으로 체크하도록 업데이트됐다. TypeScript 구조적 타이핑 특성상 다른 위치에서 반환 타입을 디스트럭처링하거나 `as` 캐스팅하는 코드가 있다면 런타임에는 문제가 없지만 새 필드를 무시하게 된다. 현재 이 메서드는 `private` 이므로 외부 영향은 없다.
- 위치: 해당 없음 (정보 제공용)

### [INFO] `details` 직렬화/역직렬화 왕복 (`JSON.stringify` → `sanitize` → `JSON.parse`)
- 위치: diff 라인 +247-250
- 상세: `rawDetails` 를 `JSON.stringify` 한 뒤 `sanitizeLastErrorMessage` 로 sanitize 하고 다시 `JSON.parse` 한다. `rawDetails` 가 직렬화 불가 값(순환 참조, `BigInt`, `undefined` 포함 객체)이면 `JSON.stringify` 가 throw 하거나 `undefined` 반환해 `sanitizeLastErrorMessage('undefined')` 가 호출될 수 있다. 현재 LLM 에러 객체는 표준 JSON-safe 구조일 가능성이 높으나, 방어적으로 try/catch 가 필요하다.
- 제안: `JSON.stringify(rawDetails)` 를 try/catch 로 감싸거나, 직렬화 실패 시 `details` 를 `String(rawDetails)` 로 대체.

### [INFO] `eventEmitter.emitNode` — FAILED 분기에서 NODE_FAILED 단발 보장
- 위치: diff 라인 +331-349
- 상세: FAILED 분기에서 `NODE_FAILED` 이벤트를 emit 한 뒤 throw 하므로, `runExecution` catch 에서 다시 FAILED 이벤트를 emit 하지 않는지 확인이 필요하다. 이중 emit 은 프론트엔드 UI 에서 상태 모순을 유발한다. 주석에 "단일 발사" 라고 명시돼 있어 의도는 명확하나, `runExecution` catch 로직에서 `ExecutionCancelledError` 와 일반 Error 를 구분하지 않는다면 EXECUTION_FAILED 이벤트가 추가 발사될 수 있다.
- 제안: `runExecution` 의 catch 블록에서 sentinel AI turn error 를 식별해 EXECUTION_FAILED 이중 emit 을 방지하는 guard 추가 여부를 검토.

---

## 요약

이번 변경은 AI Agent multi-turn 중 handler throw(LLM 429 등) 시 `NodeExecution` 이 `WAITING_FOR_INPUT` 상태로 영구 잔류하는 회귀를 수정한다. 핵심 패턴(try/catch → `handleAiTurnError` → `{ ended: true, finalStatus: 'FAILED' }` 반환 → `finalizeAiNode('FAILED')` → sentinel throw → `runExecution` catch)은 논리적으로 올바르며 상태 전이 단일 진입 원칙을 준수하려 노력했다. 그러나 세 가지 주요 부작용 위험이 있다: (1) `integration-oauth.service` 에서 내부 헬퍼를 직접 import 해 크로스 모듈 결합이 신설됐고, (2) FAILED 분기가 sentinel error 를 일반 `Error` 로 throw 해 중간 catch 블록에서 오분류될 수 있으며, (3) `nodeExec.outputData` 를 두 지점(handleAiTurnError, finalizeAiNode)에서 단계적으로 mutate 하는 패턴이 향후 확장 시 경쟁 상태를 유발할 수 있다.

## 위험도

MEDIUM
