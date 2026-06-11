# Testing Review — code-node-isolated-vm

## 발견사항

### [WARNING] `classifyError` 의 메모리 초과 탐지 패턴이 테스트로 검증되지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` — `classifyError` 함수 (line 431–439)
- 상세: `CODE_MEMORY_LIMIT` 라우팅은 `classifyError` 가 `/memory limit/i` 또는 `/Isolate was disposed/i` 메시지 패턴을 매칭해야 성립한다. 실제 `isolated-vm` 이 메모리 초과 시 어떤 메시지를 던지는지 — 예: `"Array buffer allocation failed"`, `"Execution terminated"`, 또는 custom 문자열 — 에 따라 이 regex 가 매칭되지 않고 `CODE_RUNTIME_ERROR` fallback 으로 흡수될 수 있다. 현재 메모리 초과 테스트(`should route an isolate memory-limit breach to CODE_MEMORY_LIMIT`)는 end-to-end 경로를 실행하므로 실제 동작을 검증하지만, regex 패턴 자체에 대한 단위 테스트가 없다. `isolated-vm` 버전 업그레이드 시 에러 메시지 문자열이 변경되어 조용히 fallback 으로 빠질 위험이 있다.
- 제안: `classifyError` 를 모듈 외부에 export 하거나 별도 단위 테스트 파일에서 직접 호출할 수 있도록 해서 `{ message: 'memory limit reached' }`, `{ message: 'Isolate was disposed' }`, `{ message: 'Array buffer allocation failed' }` 등 다양한 메시지 패턴에 대한 단위 테스트를 추가한다. 또는 `isolated-vm` 실제 에러 메시지를 문서화하고 regex 가 그것을 확실히 커버하는지 확인하는 regression 주석을 추가한다.

---

### [WARNING] `syntaxIsolate` 공유 인스턴스가 테스트 간 상태를 공유함 — 격리 위반 가능성
- 위치: `code.handler.ts` line 172 — `let syntaxIsolate: ivm.Isolate | undefined;` (모듈 레벨 변수)
- 상세: `syntaxIsolate` 는 모듈 레벨 lazy singleton 이다. ts-jest 환경에서 모듈 캐시가 테스트 간에 공유되면 `syntaxIsolate` 가 첫 번째 `validate()` 호출 이후 계속 재사용된다. 일반 동작에서는 문제가 없지만 (1) `syntaxIsolate` 가 `disposed` 상태가 되는 조건(예: OOM) 이 발생하면 이후 모든 테스트의 `validate()` 가 실패하고, (2) 테스트 간 격리를 완전히 보장하지 못한다. 현재 테스트에는 이 상태의 격리를 검증하는 케이스가 없다.
- 제안: `syntaxIsolate` 가 이미 disposed 되었을 때 재생성하는 방어 코드(현재 없음)를 추가하고, 그 분기에 대한 테스트를 작성하거나 주석으로 `dispose` 케이스를 명시한다.

---

### [WARNING] `$vars` copy-out 실패 시 fallback(`varsClone` 유지)이 테스트되지 않음
- 위치: `code.handler.ts` line 318–330 — `$vars` 동기화 블록의 `catch` 분기
- 상세: 성공 실행 후 `$vars` 를 copy-out 할 때 `catch` 블록이 있어 직렬화 불가 값이 들어간 경우 `varsClone` 으로 fallback 하도록 구현되어 있다. 이 분기는 spec §4.5 의 "throw 시 롤백" 계약과 다른 동작(성공 경로에서 롤백)이며, 현재 `code.handler.spec.ts` 에는 이 경로를 커버하는 테스트가 없다.
- 제안: `$vars` 에 JSON 직렬화 불가 값(예: 함수, `undefined` 포함 객체)을 할당한 뒤 성공 반환하는 케이스를 추가해 `context.variables` 가 `varsClone` 과 동일한지 확인하는 테스트를 작성한다.

---

### [WARNING] 메모리 초과 테스트의 타임아웃 설정이 실제 isolate 한도(128MB)에 도달하기 전에 CPU 타임아웃이 발동될 수 있음
- 위치: `code.handler.spec.ts` line 564–581 — `should route an isolate memory-limit breach to CODE_MEMORY_LIMIT`
- 상세: 테스트는 `timeout: 30`(초)과 Jest timeout `30_000`(ms)을 동일하게 설정했다. `code.handler.ts` 에서 host-side wall-clock 타임아웃은 `timeoutMs + 1000` = 31초이고, isolate CPU timeout 은 30초이다. 빠른 메모리 할당 루프에서 실제로 128MB 에 먼저 도달할 것인지, 30초 CPU 타임아웃이 먼저 발동될 것인지는 환경(CI의 OOM killer, GC 타이밍)에 따라 달라질 수 있다. 메모리 초과가 먼저 도달하지 않으면 테스트는 `CODE_TIMEOUT` 을 반환하여 실패한다.
- 제안: 메모리 할당 속도를 더 공격적으로 설정(예: `new Array(1e7).fill(0)`)하거나, `timeout` 을 더 크게(예: 120초) 설정하여 메모리 초과가 타임아웃보다 먼저 발생하도록 보장한다. 또는 CI 환경에서 이 테스트의 flakiness 를 모니터링하는 주석을 추가한다.

---

### [INFO] `wrapUserCode` 의 중첩 async IIFE → inner async arrow 구조 변경에 대한 회귀 테스트 범위 확인 필요
- 위치: `code.handler.ts` line 158–167 — `wrapUserCode`
- 상세: 이전 구현은 `(async () => { "use strict";\n${code}\n })()` 였고, 새 구현은 inner `__user` async 함수를 추가한 이중 래핑이다. 이 변경은 `return` 문의 scope 를 변경하지 않지만, `async/await` 동작, 예외 전파, `return`-less 코드의 `undefined` 처리 등에 영향을 줄 수 있다. 기존 `code.handler.spec.ts` 의 `execute — $helpers`, `execute — basics` 등 테스트들이 이를 간접적으로 커버하고 있으나, `wrapUserCode` 자체의 단위 테스트가 없어 래핑 로직 변경 시 어떤 영향이 생기는지 추적하기 어렵다.
- 제안: `wrapUserCode` 를 export 하여 `return` 있는 경우, `return` 없는 경우, top-level `await` 사용 케이스에 대한 단위 테스트를 추가하거나, 기존 통합 테스트 커버리지로 충분하다면 주석으로 테스트 의도를 명시한다.

---

### [INFO] `dayjs` in-isolate 동작 — `extend()` / locale 플러그인 체인의 테스트 범위
- 위치: `code.handler.ts` line 27–35 — `DAYJS_SOURCE` 로드; `code.handler.spec.ts` — `$helpers.date` 관련 테스트
- 상세: `DAYJS_SOURCE` 는 `dayjs/dayjs.min.js` UMD 번들을 읽어 isolate 내에서 실행한다. 현재 테스트는 `d.isValid()`, `d.format("YYYY")` 등 core dayjs API 를 검증하지만, `dayjs.extend()` 나 locale 설정이 isolate 안에서 동작하지 않음을 명시하거나 테스트하지 않는다. 사용자가 `$helpers.date(x).extend(plugin)` 류를 호출하면 UMD 번들에 포함된 플러그인 부재로 동작이 다를 수 있다.
- 제안: spec §2.2 이 dayjs 의 어떤 API surface 를 보장하는지 명시하고, `dayjs.extend` 호출 시의 동작(에러 또는 무시)을 테스트에 추가한다.

---

### [INFO] `$helpers.crypto.hash` 의 unsupported algorithm 에러가 isolate 내부 throw 로 전파되는 경로 테스트 미흡
- 위치: `code.handler.ts` line 52–67 — `hostHash`; `code.handler.spec.ts` — `$helpers` 관련 테스트
- 상세: `hostHash` 는 허용되지 않은 알고리즘이나 비문자열 `data` 를 받으면 host realm 에서 throw 한다. `ivm.Callback` 을 통한 host 에러 전파는 `isolated-vm` 이 에러 메시지를 isolate 로 복사해 사용자 코드에서 catch 할 수 있게 하는 메커니즘이다. 현재 spec.ts 에 unsupported algorithm 케이스 테스트가 있는지 명확하지 않으며, 있다면 에러가 `port: 'error'` + `CODE_EXECUTION_FAILED` 로 정상 라우팅되는지 검증이 필요하다.
- 제안: `$helpers.crypto.hash('md2', 'data')` (allowlist 외 알고리즘) 호출 시 `port: 'error'` + `output.error.code: 'CODE_EXECUTION_FAILED'` 가 반환되는지 확인하는 테스트를 추가(없다면)한다.

---

### [INFO] 결과 반환 경로에서 `JSON.parse(result as string)` 가 JSON 파싱 실패 시의 동작 미테스트
- 위치: `code.handler.ts` line 341 — `output: result === undefined ? undefined : JSON.parse(result as string)`
- 상세: `wrapUserCode` 는 사용자 반환값을 `JSON.stringify` 로 직렬화한 뒤, 호스트에서 `JSON.parse` 로 역직렬화한다. `copy: true` + `JSON.stringify` 내부 직렬화 설계로 인해 일반적으로 파싱 실패는 발생하지 않지만, `JSON.parse` 가 실패하면 uncaught 예외로 `catch` 블록에 도달하여 `CODE_EXECUTION_FAILED` 로 라우팅된다. 이 경로에 대한 명시적 테스트가 없다.
- 제안: 설계상 파싱 실패 경로가 존재할 수 없다면 주석으로 그 이유를 명시한다. 존재할 수 있다면 해당 경로 테스트를 추가한다.

---

## 요약

핵심 보안 기능 변경(node:vm → isolated-vm)에 대해 두 가지 핵심 회귀 테스트(host process 접근 차단, 메모리 초과 → CODE_MEMORY_LIMIT 라우팅)가 추가되었고, 기존 $helpers / console / $vars / 타임아웃 테스트는 새 구현 하에서도 유효하게 유지된다. 그러나 테스트 관점에서 세 가지 유의미한 위험이 남아 있다: (1) `classifyError` 의 에러 메시지 패턴 매칭이 직접 단위 테스트되지 않아 isolated-vm 버전 업 시 조용한 fallback 위험, (2) 메모리 초과 테스트의 타임아웃/메모리 경쟁 조건으로 인한 flakiness 가능성, (3) `syntaxIsolate` 모듈 레벨 singleton 의 disposed 재진입 경로 미테스트. 이외 `$vars` copy-out 실패 fallback, `wrapUserCode` 래핑 변경, dayjs API surface 범위, host callback 에러 전파 경로 등은 INFO 수준의 커버리지 갭이다.

## 위험도

MEDIUM
