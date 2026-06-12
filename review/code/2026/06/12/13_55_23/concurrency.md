# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] 모듈 수준 `syntaxIsolate` 공유 변수 — 비동기 동시 호출 시 경쟁 조건
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` 라인 328–348
- **상세**: `let syntaxIsolate: ivm.Isolate | undefined` 는 모듈 수준 변수다. `validate()` 는 async 가 아니므로 Node.js 단일 이벤트 루프에서 동기 실행되어 직접적인 동시 쓰기는 없다. 그러나 만약 향후 `validate()` 가 async 로 전환되거나 worker thread 환경으로 이식될 경우, 두 호출이 동시에 `syntaxIsolate.isDisposed` 를 `true` 로 읽고 각각 새 `ivm.Isolate` 를 생성한 뒤 하나를 덮어쓰는 TOCTOU(Time-Of-Check-Time-Of-Use) 경쟁 조건이 생긴다. 현재 동기 단일스레드 컨텍스트에서는 안전하지만, 코드 자체에 "JS is single-threaded so concurrent compiles serialize" 라는 주석이 그 전제를 명시하지 않으면 유지보수자가 놓칠 수 있다.
- **제안**: 현 상태는 단일 이벤트 루프 내에서 안전하다. 코드 주석(라인 327)에 이미 "JS is single-threaded so concurrent compiles serialize" 설명이 있으므로 현행 유지가 타당하다. 단, worker_threads 이식 시 재검토 필요 사항을 주석에 명시하면 충분하다.

### [INFO] `_runWithTimeout` 내 Promise 레이스 — 고아 타이머 처리
- **위치**: 라인 621–650, `_runWithTimeout` 메서드
- **상세**: `finally` 블록에서 `clearTimeout(timeoutHandle)` 을 호출하므로 정상 경로의 타이머 누수는 없다. 다만 `runPromise.catch(() => undefined)` 로 late rejection 을 삼키는 패턴은 올바르게 처리되어 있다. 이벤트 루프를 블로킹하는 코드도 없다.
- **제안**: 현행 구현 양호.

### [INFO] `execute()` 의 `context.variables` 비원자적 갱신
- **위치**: 라인 481–495
- **상세**: `context.variables` 는 `await ctx.global.get(...)` 이후 덮어쓰기된다. Node.js 단일 이벤트 루프 기준으로 두 `execute()` 호출이 동일한 `context` 객체를 공유한다면(동일 컨텍스트를 병렬 실행), 한 쪽의 성공 경로가 쓰기를 완료하기 전에 다른 쪽의 fallback(`context.variables = varsClone`)이 이전 값으로 덮어쓸 수 있다. 설계상 `ExecutionContext` 는 단일 실행 단위에 귀속되어 공유되지 않는다면 문제없다.
- **제안**: `ExecutionContext` 가 한 번에 하나의 `execute()` 에만 전달된다는 계약이 호출자 수준에서 보장되어 있다면 무해. spec 또는 `ExecutionContext` 타입 정의에 "단일 실행 단위 전용(not shared across parallel executes)" 주석을 추가하면 코드 의도가 명확해진다.

### [INFO] 모듈 초기화 시 `DAYJS_SNAPSHOT` IIFE — 동기 블로킹
- **위치**: 라인 136–148
- **상세**: 모듈 임포트 시점에 동기 IIFE 로 `ivm.Isolate.createSnapshot()` 을 호출한다. 주석에 "~4 ms one-time" 이라고 명시되어 있으며, 이는 서버 콜드 스타트 / Jest 로드 시 단 한 번 발생하는 블로킹이다. 서버리스 함수나 worker_threads 환경에서는 각 인스턴스 초기화마다 이 비용이 반복될 수 있다. 현재 Express/NestJS 기반 단일 프로세스 환경이라면 허용 가능한 트레이드오프다.
- **제안**: 현행 주석으로 충분히 문서화됨. 현행 유지.

## 요약

`code.handler.ts` 는 isolated-vm 을 활용한 샌드박스 실행 구조로, 각 `execute()` 호출이 전용 `ivm.Isolate` 를 생성·소멸시켜 실행 상태의 교차 오염을 차단한다. 진정한 멀티스레드 공유 메모리 위험은 없다. 주요 동시성 주의사항은 모듈 수준 `syntaxIsolate` 변수가 단일 이벤트 루프 직렬화에 의존한다는 전제인데, 현 코드는 이를 주석으로 명시하고 있다. `_runWithTimeout` 의 dual-timeout(CPU + wall-clock) 패턴과 타이머 정리(`finally` 내 `clearTimeout`)는 올바르게 구현되어 있다. `context.variables` 의 비원자적 갱신은 `ExecutionContext` 가 단일 실행 단위에 귀속된다는 계약 하에 안전하다. 전반적으로 async/await 누락, 데드락, 심각한 경쟁 조건은 발견되지 않았다.

## 위험도

LOW
