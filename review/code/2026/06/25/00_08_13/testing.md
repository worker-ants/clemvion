# Testing Review — web-chat-preview EIA race fix

## 발견사항

### [INFO] ExecRepoMocks 타입을 nodeRepo 에 재사용 — 타입 표현력 약함
- 위치: `interaction.service.spec.ts` L38–45
- 상세: `nodeRepo`가 `NodeExecution` 레포지토리를 흉내내지만, 타입은 Execution 레포용 `ExecRepoMocks`(findOne 하나)를 그대로 재사용한다. 현재 `getStatus` 로직이 `findOne` 만 호출하므로 기능적 문제는 없으나, 의도가 불분명해진다.
- 제안: `NodeExecRepoMocks` 별도 인터페이스를 만들거나, 인라인 타입(`{ findOne: Mock }`)으로 구분하면 가독성이 개선된다.

### [INFO] `nodeExec` 를 찾았으나 `.node` relation 이 없는 경우 미테스트
- 위치: `interaction.service.spec.ts`, `interaction.service.ts` L238
- 상세: 서비스 코드는 `if (nodeExec?.node)` 로 guard 하나, 스펙에는 `nodeRepo.findOne.mockResolvedValue(null)` (nodeExec 자체 없음) 케이스만 있고, `nodeExec`는 존재하지만 `.node` 관계가 `null/undefined`인 케이스(relations 로딩 실패 등) 테스트가 없다. 두 경우의 결과는 동일(currentNode=null)이지만, 독립 경로로 분기가 있으므로 커버리지 gap이다.
- 제안: `nodeRepo.findOne.mockResolvedValue({ nodeId: 'n1', node: null, outputData: {} })` 케이스를 추가해 `currentNode/context null` 을 확인.

### [INFO] `interactionType`이 buttons 이지만 `bc` (buttonConfig) 가 없는 경우 미테스트
- 위치: `interaction.service.spec.ts`, `interaction.service.ts` L257
- 상세: 서비스는 `interactionType === 'buttons' && bc` 조건으로 분기한다. 테스트는 `config.buttonConfig` 가 정상적으로 있는 경우만 커버한다. `buttons` 타입인데 `bc`가 누락된 경우 `context`가 null로 남는 경로가 미테스트다.
- 제안: `outputData: { meta: { interactionType: 'buttons' } }` (buttonConfig 없음) 케이스 추가.

### [INFO] legacy flat `buttonConfig` fallback 경로 미테스트
- 위치: `interaction.service.spec.ts`, `interaction.service.ts` L256 (`structured.config?.buttonConfig ?? structured.buttonConfig`)
- 상세: 서비스는 `config.buttonConfig`(structured) 우선, `buttonConfig`(legacy flat) fallback 을 구현하나, 스펙에는 structured 경로만 검증한다. legacy flat 경로는 전혀 커버되지 않는다.
- 제안: `outputData: { meta: { interactionType: 'buttons' }, buttonConfig: { buttons: [...] } }` (flat 형태, `config.buttonConfig` 없음) 케이스를 별도 it 블록으로 추가.

### [INFO] `interactionType` 이 `form`/`ai_conversation` 인 getStatus 경로 미테스트
- 위치: `interaction.service.spec.ts`, `interaction.service.ts` L264–271
- 상세: 서비스의 `else if (interactionType)` 분기(form/ai_conversation의 경우 `nodeOutput`만 동봉)가 테스트되지 않는다. buttons 이 아닌 interaction 타입에서도 context 가 올바르게 구성되는지 미검증.
- 제안: `interactionType: 'form'` 케이스를 추가해 `context.nodeOutput` 이 올바르게 반환되는지 확인.

### [INFO] 알 수 없는 `interactionType` (예: `'unknown'`) 에서 context null 반환 미테스트
- 위치: `interaction.service.spec.ts`, `interaction.service.ts` L272–275
- 상세: `interactionType` 이 `form|buttons|ai_conversation` 이 아닌 경우 `interactionType = null` 이 되어 `currentNode.interactionType = null`, `context = null`로 남는다. 이 방어 경로가 테스트되지 않는다.
- 제안: `outputData: { meta: { interactionType: 'unknown_type' } }` 케이스를 추가해 currentNode.interactionType=null, context=null 확인.

### [INFO] `seedWaitingFromStatus` 실패(소프트-fail) 케이스 미테스트 — 위젯 측
- 위치: `use-widget-eager-start.test.ts`, `use-widget.ts` L199–204
- 상세: `seedWaitingFromStatus` 가 `console.warn` 후 계속 진행하는 소프트-fail 경로(fetch 예외)가 테스트되지 않는다. 실패 시 위젯이 정상적으로 다음 단계(openStream)로 진행하는지 미검증이다.
- 제안: getStatus fetch 가 reject 되는 fetchMock 을 구성해 위젯이 에러 없이 `openStream` 을 호출하는지 확인하는 테스트 추가.

### [INFO] 세션 복원(RESTORED) 경로의 getStatus 시드 + lastEventId=0 미테스트
- 위치: `use-widget-eager-start.test.ts`, `use-widget.ts` L446–448
- 상세: 기존 "저장 세션 복원 시 open() 은 새 execution 을 시작하지 않음" 테스트는 `installFetch`(getStatus 모킹 없음)를 사용해, 복원 경로의 `seedWaitingFromStatus` 호출이나 `openStream(saved, "0")` 의 lastEventId=0 이 실제로 실행되는지 검증하지 않는다.
- 제안: 복원 세션 시나리오에서 getStatus가 `waiting_for_input` context 를 반환하는 fetchMock 을 구성해, 복원 후에도 buttons 표면이 시드되는지 확인하는 it 블록 추가.

### [INFO] `subscribe(lastEventId=0)` — seq≥1 전부 replay 케이스가 sse-adapter.spec 에 없음
- 위치: `sse-adapter.service.spec.ts`
- 상세: 기존 스펙은 `subscribe(sub, 1)` (seq≥2 replay), `subscribe(sub, 100)` (초과→replay 없음) 케이스만 있다. `subscribe(sub, 0)` (lastEventId=0, seq≥1 전부 replay)가 위젯의 실제 사용 패턴이나 전용 단위 테스트가 없다. `subscribe(lastEventId=1)` 의 기존 테스트는 의미적으로 유사하나 `0`이 seq 1 전부를 포함하는지 명시적으로 검증하지 않는다.
- 제안: `subscribe(sub, 0)` 호출 후 buffer 내 seq≥1 이벤트 전부가 push 되는지 단언하는 케이스 추가.

### [INFO] `getStatus` 응답의 `context`/`currentNode` 필드를 eia-client.test.ts 에서 미검증
- 위치: `codebase/channel-web-chat/src/lib/eia-client.test.ts` L180–216
- 상세: `getStatus` 테스트는 `status`, `seq` 필드만 검증한다. 이번 변경으로 `currentNode`/`context`가 추가됐으나 클라이언트 단 테스트에는 해당 필드가 포함되지 않는다. 기능적 문제보다는 회귀 가이드로서의 가치가 있다.
- 제안: `getStatus` 성공 테스트에 `context: { interactionType: 'buttons', ... }` 가 포함된 응답을 추가해 클라이언트가 필드를 그대로 전달하는지 확인.

---

## 요약

이번 변경은 race fix 핵심 경로(buttons waiting_for_input 표면 복원·null fallback, lastEventId=0 SSE replay)에 대한 직접 단위 테스트가 추가되어 테스트 커버리지의 기본 요건은 충족한다. 기존 mock 패턴을 재사용하고 테스트 간 격리도 유지된다. 그러나 서비스 측에서는 form/ai_conversation/unknown interactionType 분기, legacy flat buttonConfig fallback, nodeExec-without-node 케이스가 미테스트이며, 위젯 측에서는 seedWaitingFromStatus 소프트-fail, 복원(RESTORED) 경로의 getStatus 시드, sse-adapter의 lastEventId=0 명시 케이스가 누락되어 있다. 모두 하위 경계값·예외 경로에 해당하므로 운영 회귀 위험은 낮지만, 이후 리팩터링 시 조용히 깨질 수 있는 경로들이다.

## 위험도

LOW
