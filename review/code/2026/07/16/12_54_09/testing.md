# Testing 리뷰 — 항목 B 마지막 커밋 (`03e02389e`) `llm.service.spec.ts` open-handle fix

> 대상: `git show 03e02389e -- codebase/backend/src/modules/llm/llm.service.spec.ts`
> (`spec/4-nodes/3-ai/1-ai-agent.md` §12.16 문구 정정 부분은 지시대로 범위 제외 — 이미 검토됨)

## 검증 방법

정적 리딩에 더해, 수정 전/후 동작을 실제로 재현·검증했다.

- `npx jest src/modules/llm/llm.service.spec.ts -t "merges opts.signal" --detectOpenHandles` → 0.56s, open handle 경고 없음.
- `npx jest src/modules/llm/llm.service.spec.ts --detectOpenHandles` (전체 55개) → 3.446s, open handle 경고 없음. 커밋 메시지가 주장한 "3.93s 종료" 와 일치(환경 편차 범위).
- `codebase/backend/src/modules/llm/utils/with-timeout.util.ts` 대조: `finally { if (timer) clearTimeout(timer) }` 는 `Promise.race([inner, timeoutPromise])` 가 **settle 되어야만** 실행된다. 수정 전 mock(`new Promise<never>(() => {})`, abort 비반응)은 `inner` 가 영원히 pending 이라 race 를 settle 시킬 유일한 경로가 `ms=60000` 내부 타이머의 자연 발화뿐이었다 — 이것이 커밋이 보고한 "프로세스 60.69s 종료" 의 정확한 메커니즘이다. `jest.config.ts` 는 명시적으로 `forceExit` 를 쓰지 않는 "zero open handle" 불변식을 채택하고 있어(34-50행 주석), 이 누수는 실제로 CI 전체 suite 실행 시간에 영향을 주는 실질적 결함이었다.
- `llm.service.ts:172-191` 대조: `captured` 인자는 `AbortSignal.any([opts.signal, timeoutSignal])` 로 병합된 signal이며, `service.chat()` → `withTimeout()` → `run(controller.signal)` → mock 호출까지는 `withTimeout` 내부의 첫 `await Promise.race(...)` 이전이라 **전부 동기 실행**된다. 즉 `captured` 는 `service.chat(...)` 호출문이 반환되는 시점(첫 await 지점)에 이미 set 되어 있다.

## 발견사항

- **[INFO]** `await new Promise((r) => setImmediate(r));` 의 주석("client.chat 이 호출돼 captured 가 set 될 때까지 한 tick 양보")이 실제 실행 순서와 어긋남
  - 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts:192-193`
  - 상세: 위 "검증 방법"에서 추적한 대로, `mockClient.chat` 호출(`captured = signal` 대입 및 `addEventListener('abort', ...)` 등록)은 `service.chat(...)` 을 호출하는 그 한 줄(187행) 안에서 **완전히 동기적으로** 끝난다 — `withTimeout` 이 첫 `await Promise.race(...)` 에 도달하기 전까지 콜백 체인이 전부 동기이기 때문이다. 따라서 이 tick 을 기다리지 않고 바로 `controller.abort()` 를 호출해도 `addEventListener` 는 이미 등록된 상태다. 코드 자체는 안전(불필요한 매크로태스크 tick 을 하나 더 소비할 뿐 flaky 하지 않음)하지만, 주석이 "필요해서 기다린다"고 서술해 향후 유지보수자가 이 tick 을 실제 요구사항으로 오인하고 다른 테스트에도 안전하지 않은 패턴("비동기라고 가정하고 얕은 tick 한 번이면 충분하다")을 복제할 소지가 있다.
  - 제안: 주석을 "captured 설정은 동기적으로 끝나지만, 향후 withTimeout/mock 구현이 비동기 경계를 추가하더라도 안전하도록 방어적으로 한 tick 양보" 정도로 정정하거나, 굳이 필요 없다면 이 줄을 제거해도 테스트는 동일하게 통과한다(로컬 재현 완료). 둘 다 CRITICAL 은 아니며 가독성/정확성 차원의 nit.

- **[없음]** (a) execution abort 병합 전파 실제 검증 여부 — 검증됨, 오히려 강화됨
  - 상세: 이 테스트는 여전히 `captured!.aborted === true` (병합된 signal 자체의 상태)를 단언하는 동시에, 이번 diff 로 `await expect(call).rejects.toThrow()` 라는 **새 단언**이 추가됐다 — 수정 전에는 `void call.catch(() => undefined)` 로 반환 promise 를 그냥 버리기만 했고 그 promise 가 실제로 reject 하는지는 전혀 검증하지 않았다. 이제는 "병합 signal 이 abort 상태가 된다" 뿐 아니라 "그 결과 `service.chat()` 자체가 실제로 실패로 귀결된다"는, execution abort 전파의 end-to-end 결과까지 검증 범위에 들어왔다. 회귀 테스트로서 순수하게 더 강해졌다.

- **[없음]** (b) open handle 미누수 — 로직·실측 모두 확인됨 (위 "검증 방법" 참고)

- **[없음]** (c) 앞선 `'aborts the signal ... timeoutMs fires'` (135-159행) 테스트와의 중복/공백 — 없음
  - 상세: 두 테스트는 `withTimeout` 내부 `Promise.race` 의 **서로 다른 분기**를 고정한다. 135행 테스트는 "내부 timeoutMs 타이머가 먼저 fire" 케이스(`timeoutMs: 10`, `opts.signal` 미전달, `/timed out/i` 메시지 단언). 163행 테스트는 "execution abort(`opts.signal`)가 내부 타이머(`timeoutMs: 60000`)보다 먼저 fire" 케이스로, 메시지가 아니라 병합 signal 상태(`captured!.aborted`)와 reject 여부만 단언한다(메시지가 mock 이 만든 임의의 "aborted" 문자열이라 특정 문구를 단언하지 않는 것은 적절 — 실제 provider 마다 abort 에러 메시지가 다르므로). 시나리오가 명확히 분리돼 있어 중복이 아니고, 두 분기 모두 커버되어 공백도 없다.

## 요약

`03e02389e` 의 테스트 변경은 실측(로컬 jest 실행, `--detectOpenHandles` 포함)으로 open handle 누수 해소가 확인됐고, 그 메커니즘(`withTimeout` 의 `finally` clearTimeout 이 `Promise.race` settle 에 의존 → mock 이 abort 시 reject 해야 즉시 settle)도 `with-timeout.util.ts` 코드와 정확히 부합한다. 부수적으로 이전에는 검증하지 않던 `service.chat()` 반환 promise 의 실제 reject 여부까지 단언에 포함시켜, execution-abort 병합 전파를 더 엄밀하게(state 뿐 아니라 end-to-end 결과까지) 고정하는 순개선이다. 앞선 타임아웃-우선 테스트와도 겹치는 시나리오 없이 `Promise.race` 의 두 분기를 분담해 커버한다. 유일한 흠은 `setImmediate` tick 대기의 주석이 실제로는 불필요한(동기적으로 이미 끝나는) 대기를 "필요하다"고 서술한 점으로, 기능적 결함은 아니고 주석 정확성 차원의 INFO 다.

## 위험도
NONE
