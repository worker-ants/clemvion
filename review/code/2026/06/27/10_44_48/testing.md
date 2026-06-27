# Testing Review

## 발견사항

### [INFO] 신규 회귀 테스트가 실제 `arguments` 객체 대신 plain object 사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.spec.ts` L135-136
- 상세: 회귀 테스트가 `{ 0: "boot", 1: {...}, length: 2 }` 형태의 plain object 로 array-like 를 시뮬레이션한다. 실제 프로덕션에서는 `arguments` 객체(예: `Symbol.iterator` 보유, non-enumerable 인덱스 등 미묘한 차이가 있는 native object)가 생성된다. `Array.prototype.slice.call` 동작상 둘은 동일하게 처리되므로 fix 검증에는 충분하지만, 가장 정확한 reproduction 은 `function capture() { return arguments; }` 를 호출해 실제 `arguments` 객체를 얻는 방법이다. 현재 테스트도 `expect(Array.isArray(stub.q[0])).toBe(false)` 로 핵심 불변조건을 명시해 의도는 명확하다.
- 제안: (선택적) `function captureArgs() { return arguments; }` 패턴으로 실제 `arguments` 객체를 큐 항목으로 사용하면 production 경로를 더 정확히 재현한다. 현재 테스트로도 fix 검증은 충분하므로 필수는 아님.

### [INFO] 기존 첫 번째 replay 테스트가 여전히 rest-parameter Array 를 push
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.spec.ts` L113-114
- 상세: "스니펫이 큐잉한 호출을 순서대로 replay" 테스트의 stub 함수는 `push(a as [string, ...unknown[]])` 로 rest parameter(진짜 Array)를 push 한다. 실제 스니펫 스텁(`QUEUE_STUB_JS`)은 `push(arguments)` 하므로 이 테스트는 production 에서 실제로 발생하지 않는 경로를 검증한다. fix 후 Array 항목도 array-like 조건을 통과하므로 테스트 자체는 통과하나, 이 테스트만으로는 #709 에서 발생한 실제 버그가 드러나지 않는다. 신규 회귀 테스트(L130-147)가 이 갭을 보완한다.
- 제안: 기존 테스트 주석에 "이 스텁은 Array push 를 사용(production 과 상이)하며 Array 경로 회귀 검증 목적" 임을 명시하면 의도의 혼란을 줄일 수 있다.

### [INFO] boot 예외 테스트(Info#16)가 array-like 큐 항목과 결합된 시나리오를 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.spec.ts` L197-219
- 상세: "boot 예외 발생 시 큐 replay 중 오류 흡수" 테스트도 rest-parameter Array push 를 사용한다. array-like 항목 + boot 예외 조합은 별도 테스트가 없다. 두 동작은 독립적(array-like 정규화 후 동일한 `api()` 호출 경로를 따름)이므로 실질적 위험은 낮다.
- 제안: 현재 커버리지 수준으로 허용 가능. 필요 시 Info#16 테스트를 array-like 항목으로 교체해 일관성을 높일 수 있다.

### [INFO] 새 filter 로직의 reject 경로(비-객체·null)에 대한 명시적 음성 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` L106-111
- 상세: `typeof item !== "object" || item === null || typeof item.length !== "number"` 세 가드 각각을 트리거하는 큐 항목(숫자, null, `length` 없는 plain object)이 조용히 skip 되는지를 검증하는 테스트가 없다. 기존 코드 대비 semantics 는 변하지 않으며(이전에도 `!Array.isArray` 로 skip), 실제 stub 은 이 경로를 거치지 않으므로 risk 는 낮다.
- 제안: 방어적으로 추가하려면 `stub.q = [null, 42, {}, { length: "not-a-number" }, bootArgs]` 형태의 혼합 큐 테스트를 추가해 "형식 불량 항목 무시 후 유효 항목 replay" 를 명시할 수 있다.

### [INFO] `GlobalCall` 타입이 tuple(Array)로 선언돼 있으나 런타임 항목은 `arguments` 객체
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` L7, L12
- 상세: `GlobalCall = [method: string, ...args: unknown[]]` 은 TypeScript tuple 타입(=Array). `QueueStub.q?: GlobalCall[]` 로 선언되지만 실제 런타임 항목은 `arguments` 객체다. TypeScript 는 이 불일치를 감지하지 못하고, 테스트에서도 `as unknown as GlobalCall[]` 캐스팅으로 우회한다. `loader.ts` 내 상세 주석이 이를 설명하나, 타입 선언 자체는 "논리적 호출 형태(shape)" 를 나타낼 뿐 Array 임을 보장하지 않음이 명확하지 않다.
- 제안: `GlobalCall` 타입 정의 위 주석에 "런타임 실제 형태는 arguments 객체일 수 있음, 타입은 logical shape" 명시 권장.

---

## 요약

이번 변경은 `installGlobal` replay 루프에서 `Array.isArray` 필터가 실제 스니펫 스텁의 `arguments` 객체를 reject 하여 boot 가 무음으로 누락되던 회귀 버그를 수정하고, 해당 버그를 재현하는 회귀 테스트를 추가한다. 신규 테스트는 `expect(Array.isArray(stub.q[0])).toBe(false)` 로 핵심 전제 조건을 명시하고, 실패 시 동작(`[]`)과 성공 시 동작(`["open"]`)을 구체적으로 검증해 가독성과 의도 표현이 우수하다. `afterEach` 전역 정리, fakeInstance 독립 생성, console.warn spy restore 등 기존 격리 패턴도 신규 테스트에 올바르게 적용됐다. 주요 잔여 갭은 (1) 실제 native `arguments` 객체 대신 plain object 사용(동작 동일하나 재현 충실도 미흡), (2) 첫 번째 기존 replay 테스트가 여전히 Array push 를 사용해 production 스텁 패턴과 불일치하는 점이며, 모두 INFO 등급으로 기능 안전성에 영향을 주지 않는다. plan 문서의 "회귀 가드 실증: fix 임시 되돌림 시 신규 테스트 FAIL" 확인은 테스트 유효성 검증의 좋은 관행이다.

## 위험도

LOW
