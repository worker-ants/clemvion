# 테스트(Testing) 리뷰

리뷰 대상 중 실질적으로 테스트 관점 분석이 필요한 코드 파일은 파일 1(`websocket.service.spec.ts`)·파일 2(`websocket.service.ts`)뿐이다. 파일 3~12(`plan/**`, `review/consistency/**`)는 계획·리뷰 산출물 markdown/json 이라 "테스트 커버리지" 개념이 적용되지 않아 본 리뷰 범위에서 제외한다.

검증을 위해 `npx jest src/modules/websocket/websocket.service.spec.ts` 를 실행해 32/32 통과를 확인했고, `stripExternalOnlyFields` 를 옛 depth-1 shallow 구현으로 되돌리는 뮤테이션 테스트를 수행해 신규 nested-strip 테스트가 정확히 1건 실패로 반응함을 확인했다(비어있지 않은 실제 회귀 가드임을 실증, 이후 원본으로 복원 완료).

### 발견사항

- **[WARNING]** "동일 객체" 라고 주장하는 테스트가 최상위 envelope 이 아니라 자식 필드 하나만 검사한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:715` (테스트명), 단언은 `:734`
  - 상세: 테스트명이 "fanout payload 가 wire envelope 과 **동일 객체**다 (할당 없음)" 라고 주장하는데, 실제 단언은 `expect(fanout.payload.nodeOutput).toBe(wire.nodeOutput)` 로 자식 필드 하나의 참조 동일성만 검사한다. 이 케이스는 `registerExecutionRouting` 을 호출하지 않으므로 `attachRoutingContext` 가 no-op 이고, `stripDeep` 도 제거할 필드가 없어 모든 레벨에서 원본 참조를 그대로 반환한다 — 즉 실제로는 `fanout.payload === wire` (최상위 객체 자체의 동일성)까지 성립한다. `stripDeep`/`stripExternalOnlyFields` JSDoc 이 명시적으로 주장하는 것도 "returns the original envelope identity"(최상위 반환값 동일성)이다. 지금 단언은 그 주장보다 약해서, 예를 들어 최상위에서만 불필요한 재구성(spread)이 일어나고 하위 참조는 그대로 넘기는 회귀가 생겨도 이 테스트는 계속 통과한다.
  - 제안: `expect(fanout.payload).toBe(wire);` 를 추가(또는 대체)해 테스트명이 실제로 주장하는 "envelope 자체의 참조 동일성"을 직접 검증한다.

- **[WARNING]** 새 nested-strip 테스트가 외부 fanout 만 확인하고, 내부 WS wire envelope 이 여전히 raw `llmCalls` 를 보존하는지는 검증하지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:656`~`708` (특히 `698`~`707` 단언부)
  - 상세: 같은 `describe` 블록의 기존 top-level strip 테스트들(`:589`, `:619`, `:752`)은 모두 "fanout 은 strip / wire(에디터 채널)는 원본 보존"을 짝으로 검증한다 — strip 로직이 실수로 wire envelope 자체를 변형/공유하는 회귀를 잡기 위해서다. 그런데 이번에 추가된 nested 경로 테스트(§4.4 turnDebug 이중 경로)는 `gateway.broadcastToChannel.mock.calls[0][2]` (wire envelope) 쪽은 전혀 확인하지 않고 `fanout.payload` 만 본다. `stripDeep` 은 clone-on-write 라 이론상 wire 를 mutate 하지 않지만, 바로 그 무변형(non-mutation) 속성이 이 새 경로에서는 테스트되지 않은 채 남는다 — 예컨대 `stripDeep` 을 wireEnvelope 자체에도 실수로 적용하는 회귀(에디터 디버그 뷰가 조용히 깨지는 회귀)가 나도 이 테스트는 못 잡는다.
  - 제안: 같은 테스트 안에서 `const wire = gateway.broadcastToChannel.mock.calls[0][2];` 를 확보해 `JSON.stringify(wire)` 가 `'SECRET PROMPT A'`/`'SECRET PROMPT B'` 를 **포함**하는지(에디터 채널은 원본 보존) 대조군으로 함께 단언할 것.

- **[INFO]** `stripDeep` 에는 형제 함수(`sanitizeInner`)와 달리 재귀 깊이 상한이 없고, 그에 대응하는 테스트도 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349`(`stripDeep` 정의)
  - 상세: 같은 파일의 `sanitizeInner`(credential 마스킹, 이 diff 범위 밖의 기존 코드)는 `MAX_SANITIZE_DEPTH` 초과 시 `'[REDACTED_DEPTH]'` 로 강제 대체하는 명시적 깊이 가드를 갖고, 그 경계 동작을 검증하는 전용 테스트(`websocket.service.spec.ts:199` `redacts the whole subtree when sanitize depth exceeds MAX_SANITIZE_DEPTH`)도 있다. 반면 이번에 새로 추가된 `stripDeep` 은 순환 참조만 "다루지 않는다" 고 JSDoc 에 명시했을 뿐, 일반적인(비순환) 깊은 중첩에 대한 재귀 깊이 상한이 전혀 없다 — 형제 함수 한쪽만 방어가 있고 한쪽은 없는 비대칭 구조다. 현재 payload 출처가 엔진 내부 값이라 공격자가 임의로 깊이를 조작하긴 어렵지만(우선순위를 낮게 잡는 이유), 대화 턴 수가 매우 많은 장기 AI 대화 등 정상 경로에서도 이론상 스택 오버플로 가능성이 테스트로 배제되지 않는다.
  - 제안: 이번 PR 범위에서 반드시 고칠 필요는 없으나, 백로그로 남기거나 최소한 "왜 깊이 가드가 필요 없는지"(예: 실제 payload 최대 깊이 상한이 이미 다른 곳에서 보장됨)를 주석에 근거로 남길 것.

- **[INFO]** 신규 테스트 안에서 `wire` 변수명이 기존 관례와 다른 의미로 재사용된다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:702`
  - 상세: 같은 `describe('llmCalls strip — 외부 fanout 수신자 보호')` 블록 내 다른 모든 테스트(`:595`, `:627`, `:729`, `:768`)에서 `wire` 는 일관되게 "`gateway.broadcastToChannel` 로 나간 내부 WS envelope 객체" 를 가리킨다. 그런데 신규 테스트(`:702`)는 `const wire = JSON.stringify(fanout.payload);` 로 **외부 fanout payload 의 직렬화 문자열**을 같은 이름에 담는다 — 같은 블록을 훑는 독자가 헷갈리기 쉽다.
  - 제안: `wireJson` / `serializedFanout` 등으로 이름을 바꿔 기존 `wire` 관례와 충돌하지 않게 할 것.

- **[INFO]** 라우팅 컨텍스트(`registerExecutionRouting`)와 nested strip 을 함께 검증하는 테스트가 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:573`~`776` (`describe('llmCalls strip …')` 블록 전체)
  - 상세: `emitExecutionEvent` 구현은 `stripExternalOnlyFields` → `attachRoutingContext` 순서로 처리한다(`websocket.service.ts:524`~`528`). 코드 리딩으로는 `attachRoutingContext` 가 최상위 shallow spread 만 하므로 하위에서 이미 strip 된 `llmCalls` 를 되살릴 수 없어 안전해 보이지만, 이 상호작용(등록된 triggerId/chatChannel + nested `llmCalls` payload 동시 존재)을 직접 검증하는 테스트는 없다 — `describe('execution routing context …')` 블록(`:341`~`565`)과 `describe('llmCalls strip …')` 블록(`:569`~`776`)이 서로 교차하지 않는다.
  - 제안: 필수는 아니지만, 두 기능이 같은 emit 경로를 공유하는 만큼 최소 1건은 두 관심사를 함께 태우는 통합 테스트를 추가하면 향후 `attachRoutingContext` 리팩터링(예: deep merge 로 변경) 시 이 조합을 놓치는 회귀를 방지할 수 있다.

### 요약

이번 diff 의 핵심(“strip 이 depth-1 shallow 라 `turnDebug` 중첩 경로로 raw LLM 프롬프트가 외부 fanout 에 샜다”)에 대해 실제 두 누출 경로(top-level `turnDebug.llmCalls.llmCalls[]` / `nodeOutput.meta.turnDebug[].llmCalls[]`)를 정확한 실제 emit shape 그대로 재현해 검증하는 테스트가 추가됐고, 뮤테이션 검증으로 이 테스트가 실제로 회귀를 잡는 유효한 가드임을 직접 확인했다(옛 shallow 구현으로 되돌리면 정확히 1건 실패). clone-on-write 성능 주장에 대한 별도 identity 테스트도 있다는 점은 긍정적이나, 그 테스트가 스스로의 이름이 주장하는 최상위 참조 동일성 대신 자식 필드 하나만 검사해 주장보다 약하고, 새 nested-strip 테스트는 "wire(내부 채널)는 원본 보존" 대조군을 빠뜨려 기존 top-level 테스트들과 비대칭이다. `stripDeep` 에 형제 함수(`sanitizeInner`) 수준의 깊이 가드/테스트가 없는 점도 이 저장소에서 반복돼 온 "형제 함수 중 한쪽만 방어" 패턴과 유사하니 백로그로 남길 가치가 있다. 전반적으로 테스트 격리·가독성·기존 테스트 유효성(32/32 green, 회귀 없음)은 양호하다.

### 위험도
LOW
