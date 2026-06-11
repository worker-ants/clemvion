# 동시성(Concurrency) 리뷰

대상: `codebase/backend/src/nodes/data/code/code.handler.ts` (isolated-vm 전환)

---

## 발견사항

### **[WARNING]** `syntaxIsolate` 모듈 레벨 변수 — 다수 동시 validate() 호출 시 재진입 가능성
- **위치**: `code.handler.ts` L172–184 (`syntaxIsolate`, `syntaxCheck`)
- **상세**: `syntaxIsolate`는 모듈 레벨(`let syntaxIsolate: ivm.Isolate | undefined`)에 선언된 공유 상태다. Node.js 이벤트 루프는 단일 스레드이므로 동기 `compileScriptSync` 중에는 다른 코드가 끼어들 수 없고, 코드 내 주석도 "JS is single-threaded so concurrent compiles serialize"라고 명시했다. 이 분석은 Node.js worker_threads가 없는 단일 스레드 실행 모델을 가정할 때 정확하다. 그러나 만약 향후 worker_threads / cluster 방식으로 scale-out할 경우, 각 워커가 별도 V8 인스턴스를 갖기 때문에 실제로는 공유되지 않는다(각 워커가 독립적인 `syntaxIsolate`를 보유). 이 점은 안전하나, isolate가 disposed 상태로 변할 경우(`syntaxIsolate.isDisposed === true`) lazy 재생성 로직이 없어 이후 모든 validate() 호출이 disposed isolate로 `compileScriptSync`를 호출하게 된다. isolated-vm은 disposed isolate에 대한 호출을 에러로 처리한다.
- **제안**: `syntaxCheck` 내에서 `syntaxIsolate`의 disposed 여부를 확인하고, disposed 상태이면 재생성하는 방어 코드를 추가한다.
  ```typescript
  if (!syntaxIsolate || syntaxIsolate.isDisposed) {
    syntaxIsolate = new ivm.Isolate({ memoryLimit: 8 });
  }
  ```

---

### **[WARNING]** `ivm.Callback` 호출 시 `logs` 배열에 대한 비동기 접근 — 격리 경계 간 공유 상태
- **위치**: `code.handler.ts` L271–278 (`__host_log` Callback)
- **상세**: `__host_log` Callback은 isolate 내부에서 호출되며, 클로저로 capture된 `logs` 배열(`string[]`)을 수정한다. isolated-vm의 `ivm.Callback`은 isolate에서 호스트 함수를 동기적으로 호출한다(`applySyncPromise` 기반). 이 호출은 Node.js 이벤트 루프 관점에서 단일 틱 내에 처리되므로 일반적으로 안전하다. 그러나 `logs` 배열은 execute() 의 try/finally 흐름 내에서 `finally` 이후 `return`값에도 참조되므로, `runPromise.catch(() => undefined)` 처리 후 isolate disposal(`isolate.dispose()`) 이후에도 pending callback이 이론적으로 `logs`를 수정하려 시도할 위험이 있다. isolate가 dispose되면 callback은 더 이상 호출될 수 없어 실제로는 안전하지만, dispose 시점과 runPromise 내 잔여 작업 간의 순서가 명시적으로 보장되지 않는 코드 구조다.
- **제안**: 현재 구현의 `runPromise.catch(() => undefined)` + `finally { isolate.dispose() }` 패턴은 isolate disposal로 callback 호출을 사실상 차단하므로 위험은 낮다. 코드 주석에 "dispose 이후 __host_log 호출 불가 — logs 배열 접근 안전"을 명시하면 명확성이 높아진다.

---

### **[INFO]** 이중 타임아웃(dual timeout) 구조 — Promise.race 경쟁 조건 분석
- **위치**: `code.handler.ts` L297–316
- **상세**: isolate CPU 타임아웃(`timeout: timeoutMs`)과 호스트 wall-clock 타임아웃(`timeoutMs + 1000ms`)을 `Promise.race`로 경쟁시키는 구조다. CPU 타임아웃이 먼저 발동하면 isolate가 에러를 던지고 `runPromise`가 reject된다. 호스트 타이머가 먼저 발동하면 `reject(e)`를 호출하며 `Promise.race`가 resolve된다. 이 경우 `runPromise`는 여전히 pending 상태로 남을 수 있으나 `runPromise.catch(() => undefined)` 로 swallow 처리되고, `finally`에서 `isolate.dispose()`가 호출되어 isolate 내 작업이 강제 중단된다. 이 패턴은 올바르다. 단, 호스트 타임아웃(`timeoutMs + 1000`)이 항상 isolate 타임아웃보다 1초 늦게 설정되어 있어, 실제로는 isolate CPU 타임아웃이 거의 항상 먼저 발동한다. async 무한 대기(await new Promise(() => {})) 패턴은 CPU를 소비하지 않아 isolate CPU 타임아웃에 걸리지 않을 수 있으므로, 이 경우 호스트 타임아웃이 필수 안전망이다. 이 설계는 의도적이며 타당하다.
- **제안**: 현재 구현 적절. 호스트 타임아웃이 `+1000ms` 고정 버퍼를 사용하는 이유("async hang 대비 wall-clock 안전망")를 코드 주석에 명시하면 가독성이 높아진다.

---

### **[INFO]** execute() 호출 당 신규 Isolate 생성 — 리소스 풀링 없음
- **위치**: `code.handler.ts` L226 (`new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_LIMIT_MB })`)
- **상세**: 매 execute() 호출마다 새 `ivm.Isolate` 인스턴스를 생성하고 finally에서 `dispose()`한다. 이는 격리 강도를 최대화하는 설계로, 실행 간 상태 누출이 없다. 그러나 Isolate 생성 비용(V8 힙 초기화 + 컨텍스트 생성 + dayjs 컴파일)이 매 실행마다 발생한다. 고빈도 code 노드 실행 환경에서는 latency 및 GC 압력이 누적될 수 있다. 이는 현재 설계 트레이드오프로 plan에도 "per-exec dayjs 컴파일 — 후속 snapshot 최적화 여지"로 명시되어 있어 인식된 사항이다. 동시성 관점에서는 각 실행이 독립 Isolate를 사용하므로 실행 간 경쟁 조건이 발생하지 않는다는 장점이 있다.
- **제안**: 현재 설계 적절. snapshot API를 통한 dayjs 사전 컴파일 최적화는 후속 작업으로 남기는 것이 타당하다.

---

### **[INFO]** `__host_log` Callback — `logs.length` 체크의 비원자성
- **위치**: `code.handler.ts` L272–278
- **상세**: `if (logs.length < MAX_CONSOLE_LINES) { logs.push(...) }` 패턴은 check-then-act이다. Node.js 단일 스레드 모델에서는 이 사이에 다른 코드가 끼어들 수 없으므로 원자성 문제가 없다. isolated-vm Callback은 동기 실행이라 더욱 안전하다.
- **제안**: 현재 구현 적절. 변경 불필요.

---

## 요약

이번 변경의 핵심인 `node:vm → isolated-vm` 전환은 동시성 관점에서 전반적으로 안전하게 설계되었다. 매 실행마다 독립 V8 Isolate를 생성/폐기하므로 실행 간 공유 상태가 없고, `ivm.Callback`을 통한 호스트 브리지는 Node.js 단일 이벤트 루프 내에서 동기적으로 처리된다. 주요 동시성 주의 사항은 두 가지다: (1) `syntaxIsolate` 모듈 레벨 공유 변수가 disposed 상태로 전환될 경우 재생성 방어가 없어 이후 validate() 호출이 실패할 수 있고(WARNING), (2) `ivm.Callback`이 close된 isolate context 내 `logs` 배열에 접근하는 경로가 이론상 존재하나 isolate dispose 순서로 실제로는 안전하다(WARNING). 이중 타임아웃(CPU + wall-clock) 설계는 동기 무한루프와 async 무한대기를 모두 올바르게 처리한다. async/await 사용에 누락은 없고, Promise.race 패턴도 적절하다.

## 위험도

LOW
