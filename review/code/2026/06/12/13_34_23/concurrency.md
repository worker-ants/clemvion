# 동시성(Concurrency) 리뷰 결과

## 발견사항

### **[INFO]** `syntaxIsolate` 모듈 수준 공유 변수의 재진입 잠재성

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `syntaxCheck()` 함수 (라인 1676–1688)
- **상세**: `syntaxIsolate`는 모듈 수준 `let` 변수로, `validate()` 호출 간 공유된다. 코드 주석에 "JS is single-threaded so concurrent compiles serialize"라고 명시되어 있어 해당 팀이 이를 인식하고 있다. Node.js 이벤트 루프에서 `compileScriptSync`는 동기 블로킹이므로 실제 경쟁 조건은 발생하지 않는다. 그러나 `syntaxIsolate.isDisposed` 검사와 `new ivm.Isolate(...)` 대입 사이에 이론적 재진입 경로는 없으나, Worker Threads를 사용하는 환경(현재 코드베이스는 미사용)으로 이행할 경우 동기화 없이는 경쟁 조건이 생긴다.
- **제안**: 현재 단일 이벤트 루프 설계에서는 문제없다. 추후 Worker Threads 도입 시 `syntaxCheck`를 per-worker 로컬로 전환하거나 Mutex를 추가할 것.

---

### **[INFO]** `__host_log` 콜백의 `logs` 배열 접근 — 격리된 VM 콜백 경계 공유

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `_buildIsolateContext()` 내 `__host_log` 콜백 (라인 1930–1937)
- **상세**: isolate 내부의 사용자 코드가 `__host_log` 콜백을 통해 호스트 `logs: string[]` 배열에 접근한다. isolated-vm 콜백은 호스트 이벤트 루프 스레드에서 동기 실행되므로, 단일 실행 컨텍스트 내에서는 경쟁 조건이 없다. 배열 길이 체크(`logs.length < MAX_CONSOLE_LINES`)와 `push`가 같은 마이크로태스크 슬롯에서 순차 실행되기 때문에 원자성 보장된다. 이는 이 PR에서 변경 없이 유지된 기존 패턴이다.
- **제안**: 현재 구조에서는 정상. 다만 `MAX_CONSOLE_LINES` 체크와 `push` 사이에 `await` 포인트가 삽입될 경우 경쟁 조건 가능성이 생기므로, 향후 이 콜백에 비동기 로직을 추가하지 않도록 주의할 것.

---

### **[INFO]** `_runWithTimeout`의 `Promise.race` + `setTimeout` 패턴 — late rejection 처리

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `_runWithTimeout()` (라인 1960–1989)
- **상세**: `runPromise.catch(() => undefined)` 로 late rejection을 방어하고, `finally` 블록에서 `clearTimeout(timeoutHandle)`을 통해 타이머를 항상 정리한다. 호스트 레이스가 먼저 이기면 `isolate.dispose()`가 호출된 뒤 `runPromise`가 나중에 reject될 수 있는데, 이 패턴이 그 unhandled rejection을 정확히 방지한다. 이번 PR에서 인라인 코드를 `_runWithTimeout` 메서드로 추출했으나 로직은 동일하다.
- **제안**: 패턴 정확함. `timeoutHandle`이 `let`으로 선언되어 있고 `finally`에서 조건 체크 후 정리하므로 타이머 누수 없음. 현상 유지 적절하다.

---

### **[INFO]** `ISOLATE_MEMORY_LIMIT_MB` 모듈 로드 시 단일 해석 — 의도적 설계

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — 라인 1421
- **상세**: `resolveMemoryLimitMb()`를 모듈 임포트 시 1회 호출하여 상수로 고정한다. 주석("Resolved once at module load — changing it requires an instance restart")에 명시적으로 의도가 표기되어 있다. `process.env`는 런타임 중 변경되는 경우가 거의 없고 설령 변경되더라도 테스트를 위해 `resolveMemoryLimitMb()`를 직접 호출하도록 export되어 있으므로, 이 모듈 수준 캐싱은 의도적이고 올바르다. 테스트에서 `process.env[ENV_KEY]`를 변경 후 `resolveMemoryLimitMb()`를 직접 호출하는 방식은 모듈 상수를 우회하므로 적절하다.
- **제안**: 현재 설계 적절. `ISOLATE_MEMORY_LIMIT_MB`는 `Object.freeze`된 상수처럼 취급되므로 동시성 문제 없음.

---

## 요약

이번 변경에서 동시성 관련 실질적 위험은 발견되지 않는다. 핵심 변경인 `resolveMemoryLimitMb()` 추출, `_buildIsolateContext()` 및 `_runWithTimeout()` 메서드 분리는 기존 동시성 모델을 유지하며 리팩토링한 것이다. Node.js 단일 이벤트 루프 가정 하에 `syntaxIsolate` 공유 변수와 `logs` 배열 접근은 안전하고, `Promise.race`+`clearTimeout` 패턴은 타이머 누수 없이 late rejection을 올바르게 처리한다. 모듈 수준 메모리 한도 캐싱(`ISOLATE_MEMORY_LIMIT_MB`)은 의도된 설계로 재시작 없이는 변경되지 않는다. INFO 수준 사항은 모두 현재 아키텍처 범위 내에서 안전하며, Worker Threads 이행 시 재검토가 필요한 잠재 지점으로만 기록한다.

## 위험도

NONE

STATUS=success ISSUES=0
