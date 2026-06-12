# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] syntaxIsolate 모듈 레벨 가변 상태 — 단일 스레드 가정 명시 필요
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `let syntaxIsolate: ivm.Isolate | undefined` (L1315)
- **상세**: `syntaxIsolate` 는 모듈 레벨 가변 변수이며 `syntaxCheck()` 내부에서 lazily 초기화·재사용된다. 코드 주석에 "JS is single-threaded so concurrent compiles serialize" 라고 명시돼 있어 의도적 설계임을 알 수 있다. Node.js 단일 스레드 이벤트 루프 환경에서는 실제로 경쟁 조건이 발생하지 않는다. 그러나 `compileScriptSync` 는 동기 호출이므로 이벤트 루프를 블로킹하는 점, 그리고 Worker Thread 환경으로 이전될 경우 모듈 레벨 상태가 공유될 수 있다는 잠재적 위험이 존재한다.
- **제안**: 현 Node.js 단일 스레드 전제 하에서는 문제없음. 단, `syntaxCheck()` 함수 상단에 Worker Threads와 함께 사용하지 말 것을 명시하는 JSDoc 경고를 추가하는 것을 고려.

### [INFO] DAYJS_SNAPSHOT — 모듈 레벨 공유 읽기 전용 상수, 동시성 안전
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `const DAYJS_SNAPSHOT` (L1044/L1158)
- **상세**: `DAYJS_SNAPSHOT` 은 IIFE 로 모듈 로드 시 1회 초기화되는 `const` 로, `ivm.ExternalCopy<ArrayBuffer>` 타입이다. isolated-vm 의 `ExternalCopy` 는 불변 직렬화 버퍼로, 각 `new ivm.Isolate({ snapshot })` 호출은 이 버퍼를 읽어 새 isolate 힙을 독립적으로 복원한다. 스냅샷 자체에는 실행 상태가 포함되지 않으므로 동시 실행 간 상태 공유나 경쟁 조건이 발생하지 않는다. 이 점은 테스트 "does NOT capture in-isolate dayjs mutations across executions" 에서도 검증되고 있다.
- **제안**: 현재 설계가 올바름. 추가 조치 불필요.

### [INFO] __host_log 콜백의 logs 배열 — 클로저 캡처, 교차 실행 누적 없음
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `execute()` 내 `const logs: string[] = []` + `__host_log` Callback (L1433, L1489)
- **상세**: `logs` 배열은 `execute()` 호출마다 새로 생성되는 지역 변수이며, `new ivm.Callback(...)` 으로 해당 실행 전용 클로저로 캡처된다. isolate 가 per-exec 로 매번 새로 생성되므로 병렬 실행 간 `logs` 참조가 교차될 가능성이 없다. 테스트 "keeps logs / $input per-execution" 에서 이 격리를 직접 검증한다.
- **제안**: 현재 설계가 올바름. 추가 조치 불필요.

### [INFO] Promise.race + setTimeout 조합의 미결 Promise 처리
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — L1525–L1534
- **상세**: `Promise.race([runPromise, timeoutRace])` 패턴 사용 시, 타임아웃이 먼저 resolve/reject 되면 `runPromise` 는 미결 상태로 남는다. 코드는 이를 인지하고 `runPromise.catch(() => undefined)` (L1523) 로 unhandled rejection 을 흡수하며, `finally` 블록에서 `isolate.dispose()` 를 호출해 isolate 를 강제 종료하도록 설계되어 있다. 이 패턴은 이미 올바르게 처리되어 있다.
- **제안**: 현재 설계가 올바름. 추가 조치 불필요.

## 요약

이번 변경의 핵심은 `DAYJS_SNAPSHOT` 모듈 상수를 도입해 per-exec dayjs 재컴파일 비용을 제거한 성능 개선이다. 동시성 관점에서 설계가 견고하다: `DAYJS_SNAPSHOT` 은 불변 읽기 전용 `ExternalCopy` 버퍼이므로 동시 실행 간 공유해도 경쟁 조건이 없고, `execute()` 는 매 호출마다 fresh isolate + fresh context + 새 `logs` 배열을 생성해 상태 격리를 완전히 유지한다. `syntaxIsolate` 는 모듈 레벨 가변 상태이나 Node.js 단일 스레드 이벤트 루프 환경에서는 동시 접근이 없으므로 실질적 위험이 없으며, 코드 주석에 이 전제가 명시되어 있다. 신규 테스트 5건이 교차 실행 격리, dayjs 프로토타입 오염 비전파, logs 비누적을 행동으로 검증하고 있어 회귀 보호도 충분하다.

## 위험도

NONE

---

STATUS=success ISSUES=0
