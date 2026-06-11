### 발견사항

- **[INFO]** `toEiaEvent` alias 제거 — 테스트 파일 일괄 rename 완료, 회귀 없음
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 전체
  - 상세: `toEiaEvent` → `toChatChannelEvent` 이름 변경이 spec 파일에도 전면 반영됨. 기존 테스트 케이스 구조(buttons/form/ai_conversation/ai_form_render 4종, null 반환 경계, execution.failed back-compat, execution.cancelled error 전파, ai_message presentations, llmCalls 미포함, node.completed 내부 타입 필터 등)가 모두 유지되어 회귀 차단력은 손상 없음.
  - 제안: 없음 (명칭 정렬 완료).

- **[INFO]** `toChatChannelEvent` 에 대한 새 이벤트 타입 분기 커버리지 확인
  - 위치: `chat-channel.dispatcher.spec.ts`
  - 상세: 현재 테스트는 `execution.waiting_for_input`, `execution.failed`, `execution.cancelled`, `execution.ai_message`, `execution.node.completed` 를 커버한다. `chat-channel.dispatcher.ts` 에 이미 존재하지만 테스트가 없는 이벤트 타입(예: `execution.started`, `execution.completed` 등)이 있다면 갭이 존재한다. 단, 이번 PR 변경 범위는 rename 뿐이므로 기존 커버리지 갭을 새로 도입하지는 않는다.
  - 제안: 추후 `toChatChannelEvent` 의 전체 switch/if 분기를 나열해 커버리지 맵 재확인 권장.

- **[WARNING]** `FREEZE_BRANCH_CACHE` 가 `process.env.NODE_ENV` 에 의존 — Jest 환경에서의 동작 조건 명시 필요
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:559` (diff 기준)
  - 상세: `const FREEZE_BRANCH_CACHE = process.env.NODE_ENV !== 'production'` 는 모듈 로드 시점에 평가된다. Jest 기본 환경(`NODE_ENV=test`)에서는 `true` 이므로 freeze 가 정상 동작한다. 그러나 테스트 파일에 이 전제가 주석이나 assertion 으로 명시되어 있지 않아, 만약 Jest 설정이 `NODE_ENV=production` 으로 변경되면 freeze 테스트 2건이 TypeError 를 catch 하지 못하고 `mutationError === null` 로 통과해 **false positive** 가 된다.
  - 제안: `parallel-executor.spec.ts` M-5 describe 블록 상단에 `expect(process.env.NODE_ENV).not.toBe('production')` 또는 `beforeAll(() => { expect(FREEZE_BRANCH_CACHE).toBe(true); })` 형태의 전제 조건 guard assertion 추가.

- **[WARNING]** freeze 테스트의 TypeError catch 구조 — `strict mode` 전제 묵시
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` M-5 첫 번째 it 블록 (diff +397~+412)
  - 상세: `Object.freeze` 된 객체의 내부를 mutate 하면 strict mode 에서만 TypeError 가 throw 된다. non-strict mode 에서는 silently 무시된다. TypeScript 가 strict mode 로 컴파일되므로 런타임도 strict 이 될 가능성이 높으나, 이 전제가 테스트에 명시되지 않았다. 또한 `branchCtx.nodeOutputCache.nodeA.output.count` 를 mutate 하는 시도가 `try/catch` 로 감싸여 있는데, mutationError 가 null 인 채 테스트가 통과하면(non-strict 환경) 테스트 자체가 freeze 가드를 검증하지 못한다.
  - 제안: `try/catch` 대신 `expect(() => { ... }).toThrow(TypeError)` 형태로 변경하거나, 테스트 최상단에 strict mode 전제 검증을 추가. 현재 구조는 non-strict 환경에서 false positive 위험이 있다.

- **[INFO]** `top-level 키 추가 격리` 테스트 — freeze 가 적용되지 않는 경로 검증
  - 위치: `parallel-executor.spec.ts` M-5 두 번째 it 블록 (diff +415~+433)
  - 상세: `branchCtx.nodeOutputCache.nodeB = { output: { v: 2 } }` 가 원본 `ctxWithCache.nodeOutputCache` 에 누출되지 않음을 검증한다. 이는 shallow copy 격리(freeze 와 독립)를 검증하는 것으로 적절하다. 단, 이 테스트는 `FREEZE_BRANCH_CACHE` 가 true/false 어느 쪽이든 동일하게 동작해야 한다 — 의미 있는 M-5 전용 테스트이기보다 기존 shallow copy 격리 테스트와 중복될 수 있다.
  - 제안: 주석에 "이 테스트는 freeze ON/OFF 무관하게 shallow copy 격리를 검증" 을 명시해 의도 명확화.

- **[INFO]** `ContinuationBusService.on()` 테스트 제거 — dead code 제거와 동반 완료
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` (diff -228~-235)
  - 상세: `on()` no-op 테스트 1건이 메서드 삭제와 함께 제거됨. 나머지 publish/seq/lock 테스트는 영향 없이 유지. 제거된 테스트가 실제 동작을 커버하던 것이 아니라 no-op 임을 확인하는 것이었으므로 삭제는 적절하다.
  - 제안: 없음.

- **[INFO]** `registerContinuationHandlers` 호출 제거 — 테스트 setup 정리
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (diff -491~-498, -14436~-14438)
  - 상세: no-op stub 이었던 `registerContinuationHandlers()` 의 직접 호출 2곳이 제거됨. 이는 Phase 2 BullMQ 전환 후 해당 메서드가 실제로 아무것도 하지 않았기 때문에 테스트 의미가 없었다. 삭제 자체는 올바르나, continuation resume 시나리오(form/AI 재개)에 대한 단위 테스트가 남아 있는지 별도 확인 필요.
  - 제안: 제거 후 `execution-engine.service.spec.ts` 에 `applyContinuation` / `applyCancellation` 경로를 직접 호출하는 테스트가 충분히 존재하는지 확인.

- **[INFO]** `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 상수 제거 — 테스트 영향 없음 확인 필요
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (diff -1586~-1589)
  - 상세: `@deprecated` 상수 2건이 제거됨. getter 함수(`getFailedDegradedThreshold`, `getDelayedDegradedThreshold`)는 유지. 만약 다른 테스트 파일이 이 상수를 직접 import 해서 사용 중이면 컴파일 오류가 발생한다. PR diff 에 포함된 파일에서는 직접 참조가 없으나, 테스트 전체 범위 확인이 필요하다.
  - 제안: `grep -r "FAILED_DEGRADED_THRESHOLD\|DELAYED_DEGRADED_THRESHOLD"` 로 잔여 참조 없음을 확인.

- **[INFO]** `websocket.service.spec.ts` 주석 rename — 테스트 로직 무변경
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` (diff +1729~+1731)
  - 상세: 주석 한 줄만 `toEiaEvent` → `toChatChannelEvent` 로 변경. 테스트 동작에 영향 없음.
  - 제안: 없음.

---

### 요약

이번 변경의 핵심은 세 가지다: (1) `toEiaEvent` alias 완전 제거에 따른 spec 파일 전체 rename, (2) `registerContinuationHandlers`/`on()` dead code 제거에 따른 테스트 setup 정리, (3) `parallel-executor` M-5 freeze 가드 추가 및 회귀 테스트 2건 신설. 전반적으로 테스트 변경이 프로덕션 코드 변경을 정확히 동반하고 있으며, 기존 회귀 차단력은 유지된다. 주요 우려는 freeze 테스트의 `try/catch` 구조다 — `process.env.NODE_ENV !== 'production'` 전제와 strict mode 전제가 테스트에 명시적으로 잠기지 않아, Jest 환경 설정이 달라지면 freeze 가드가 검증되지 않은 채 테스트가 통과할 수 있다. 이 구조를 `expect(...).toThrow(TypeError)` 형태로 개선하거나 전제 조건 assertion 을 추가하면 테스트 신뢰도가 높아진다.

---

### 위험도

LOW

STATUS: SUCCESS
