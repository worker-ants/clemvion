# 동시성(Concurrency) 리뷰

## 발견사항

### [INFO] Promise.race 타임아웃 패턴 — clearTimeout finally 처리 정상
- 위치: `code.handler.ts` execute() — `Promise.race` + `timeoutHandle` 처리 블록
- 상세: `timeoutHandle`이 `finally { if (timeoutHandle) clearTimeout(timeoutHandle) }` 로 항상 정리됨. 성공·오류 양 경로에서 타이머 누수 없음. 비동기 타임아웃을 단일 Promise.race로 통합한 구조가 명확하고 안전함.
- 제안: 현행 유지.

### [INFO] $vars 원자적 교체 — 에러 경로 롤백 보장
- 위치: `code.handler.ts` execute() L938 `context.variables = varsClone`
- 상세: `varsClone`은 `deepClone`으로 실행 전 복사되고, `context.variables` 교체는 `Promise.race` 성공 경로에서만 수행됨. catch 블록은 `context.variables`를 건드리지 않으므로 에러 시 원본이 보존됨. 단일 할당 연산이므로 원자성 문제 없음.
- 제안: 현행 유지.

### [INFO] buildHelpers() — 상태 없는 순수 클로저, 공유 가변 상태 없음
- 위치: `code.handler.ts` `buildHelpers()` 함수
- 상세: `createHash`, `randomUUID`, `Buffer.from`, `dayjs` 는 모두 무상태 호출로, 각 sandbox 실행마다 새 클로저 객체가 생성됨. 전역 가변 상태를 공유하지 않으므로 다수 요청 병렬 실행 시 경쟁 조건 없음.
- 제안: 현행 유지.

### [INFO] logs 배열 — execute() 호출마다 독립 생성
- 위치: `code.handler.ts` execute() `const logs: string[] = []`
- 상세: 로그 버퍼가 인스턴스 필드가 아닌 호출 스코프 지역 변수로 선언됨. `CodeHandler` 인스턴스를 여러 요청이 공유하더라도 각 실행의 로그가 격리됨.
- 제안: 현행 유지.

### [INFO] timer 셰도잉 (setTimeout/setInterval/setImmediate = undefined)
- 위치: `code.handler.ts` `buildSandbox()` 반환 객체 끝 부분
- 상세: sandbox 내에서 타이머 API를 명시적으로 undefined로 덮어씌워 비결정적 스케줄링을 차단함. 이로써 async 타임아웃의 단일 경로(Promise.race)가 보장됨. spec §7.3 계약을 코드 수준에서 강제하는 올바른 접근.
- 제안: 현행 유지.

### [INFO] vm.Script runInContext timeout 옵션 — 동기 루프 전용, 비동기 별도 처리 이중화
- 위치: `code.handler.ts` execute() `script.runInContext(ctx, { timeout: timeoutMs, breakOnSigint: true })`
- 상세: vm의 `timeout` 옵션은 동기 CPU-bound 루프만 잡고 비동기 코드(await/Promise)를 잡지 못한다. 비동기 타임아웃은 Promise.race로 별도 처리됨. 이 이중화는 의도적이며 에러 코드도 ERR_SCRIPT_EXECUTION_TIMEOUT / EXECUTION_TIMEOUT으로 양 경로를 동일하게 정규화함. 설계상 빈틈 없음.
- 제안: 현행 유지.

## 요약

변경 범위(code.handler.ts의 buildHelpers/$node 주입 + timer 셰도잉, schema timeout 선언, spec 파일들)에서 동시성 위험 요소는 발견되지 않았다. $vars 원자적 교체는 성공 경로에서만 단일 할당으로 이루어지고, logs 배열은 호출 스코프에 격리되며, buildHelpers()는 무상태 클로저만 생성한다. Promise.race 타임아웃 패턴은 finally 블록에서 타이머를 정리하며, vm timeout 옵션(동기)과 Promise.race 타임아웃(비동기)의 이중화는 양 경로를 올바르게 처리한다. 전반적으로 동시성 설계가 견고하다.

## 위험도

NONE
