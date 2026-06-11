# 성능(Performance) 코드 리뷰

대상: `isolated-vm` 전환 — `codebase/backend/src/nodes/data/code/code.handler.ts` 및 관련 파일

---

### 발견사항

- **[WARNING]** 실행마다 dayjs UMD + bootstrap 스크립트를 재컴파일·재실행
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L280-286
  - 상세: `execute()` 가 호출될 때마다 새 `ivm.Isolate`와 `Context`를 생성하고, dayjs UMD 소스(수십 kB)와 bootstrap IIFE를 `compileScript` + `run`으로 매번 실행한다. 특히 `isolate.compileScript(dayjs + bootstrap)` 두 호출은 V8 파싱·컴파일 비용을 per-execution으로 부담한다. 동시 워크플로우 실행이 많을수록 컴파일 오버헤드가 선형으로 누적된다.
  - 제안: isolated-vm의 `Snapshot` API(`ivm.Isolate.createSnapshot(scripts)`)를 활용하면 dayjs + bootstrap이 적용된 힙 스냅샷을 프로세스 시작 시 1회 생성하고, 이후 `new ivm.Isolate({ snapshot, memoryLimit })` 으로 컴파일 없이 instantiate 할 수 있다. 이 최적화는 plan 문서(`plan/in-progress/code-node-isolated-vm.md`)도 "per-exec dayjs 컴파일 — 후속 snapshot 최적화 여지"로 인지하고 있다. 현재 상태는 올바르게 동작하지만 고빈도 실행 시 latency 단축 여지가 크다.

- **[WARNING]** 이중 타임아웃 구조에서 host wall-clock race 쪽의 `timeoutMs + 1000ms` 오버슈팅
  - 위치: L307-316 (`Promise.race` + `setTimeout`)
  - 상세: isolate-level timeout(`script.run(..., { timeout: timeoutMs })`)이 primary로 동작하지만, host-side `setTimeout`은 `timeoutMs + 1000ms`(최대 121초)로 설정된다. isolate CPU timeout이 먼저 발동하는 경우 host timer는 clearTimeout으로 정리되지만, 만약 async hang(I/O를 기다리는 형태)이나 isolate timeout 미발동 상황에서는 1초 추가 대기가 발생한다. 정확한 타임아웃 보장이 필요한 고빈도 실행 환경에서는 +1000ms가 tail latency에 영향을 준다. 또한 Promise.race에서 timeout이 이기면 isolate는 finally에서 dispose되는데, runPromise의 pending rejection은 `.catch(() => undefined)`로 swallowed되므로 메모리 누수는 없다.
  - 제안: isolate CPU timeout이 주 메커니즘으로 작동하는 이상, host-side 추가 마진은 합리적이다. 다만 `timeoutMs + 1000`을 하드코딩하는 대신 `Math.max(timeoutMs * 1.1, timeoutMs + 200)` 같이 더 짧은 마진으로 줄이거나, 1000ms 추가 마진의 설계 의도를 상수로 명시하면 의도가 명확해진다.

- **[WARNING]** `syntaxCheck`의 공유 `syntaxIsolate`는 장기 실행 시 힙 증가 가능성
  - 위치: L172-184
  - 상세: `syntaxIsolate`는 모듈 레벨 싱글톤으로 8MB memoryLimit으로 생성된다. `compileScriptSync` 후 `script.release()`를 호출하므로 Script 참조는 해제되지만, isolated-vm의 Isolate 힙 자체는 GC 타이밍에 따라 누적될 수 있다. 짧은 코드는 8MB 안에서 수렴하겠지만, 극단적으로 큰 코드를 반복 검증할 경우 힙 증가 후 OOM이 발생하고 다음 호출에서 disposed 상태 오류가 날 수 있다. `syntaxIsolate.isDisposed` 체크가 없다.
  - 제안: `syntaxCheck` 함수에 `syntaxIsolate?.isDisposed` 체크를 추가하여 disposed 상태이면 새로 생성하는 방어 코드 추가. 예: `if (!syntaxIsolate || syntaxIsolate.isDisposed) { syntaxIsolate = new ivm.Isolate({ memoryLimit: 8 }); }`

- **[INFO]** per-execution `ExternalCopy` 객체 생성이 GC 압력을 가중
  - 위치: L234-248 (jail.set 6개 호출)
  - 상세: 매 실행마다 `new ivm.ExternalCopy(input)`, `new ivm.ExternalCopy(varsClone)`, `$execution`, `$node`에 대해 각각 `ExternalCopy` 인스턴스를 생성한다. 대용량 `$input` 또는 `$vars`가 전달될 경우 직렬화·역직렬화 비용이 증가한다. 현재 구조에서 피할 수 없는 비용이나, `deepClone(context.variables)`(L223)에서 이미 JSON round-trip이 발생하고 `ExternalCopy` 내부에서 다시 직렬화가 발생하는 이중 직렬화가 있다.
  - 제안: `varsClone`의 경우 `deepClone`에서 이미 `JSON.parse(JSON.stringify(...))`을 수행하므로, `ExternalCopy`에 plain object를 넘기면 내부에서 다시 serialize된다. `JSON.stringify` 1회를 공유할 수 있는지 isolated-vm API 확인. 단, 현재 스펙의 설계 의도(변수 변이 격리)를 깨지 않아야 한다.

- **[INFO]** `DAYJS_SOURCE`를 모듈 로드 시 동기 파일 읽기(`readFileSync`)로 적재
  - 위치: L32-35
  - 상세: 모듈이 `require`될 때(서버 시작 시) `readFileSync`로 dayjs UMD 파일을 동기적으로 읽는다. 서버 시작 시 수행되는 1회 동기 I/O로, 블로킹은 무의미한 수준이다. 파일 크기는 약 7kB(min.js)이므로 실제 문제는 없다.
  - 제안: 현재 구조로도 충분하다. 다만 future snapshot 최적화 적용 시 이 상수는 스냅샷 생성에 재활용될 수 있으므로 위치를 유지한다.

- **[INFO]** `classifyError`의 정규식 매칭이 per-execution으로 새로 평가됨
  - 위치: L431-439
  - 상세: `classifyError`의 `/timed out/i`, `/memory limit/i`, `/Isolate was disposed/i` 정규식이 함수 본문에 인라인으로 선언되어 호출할 때마다 정규식 객체가 새로 생성된다. 고빈도 실행에서 미미한 GC 압력을 유발한다.
  - 제안: 정규식을 모듈 레벨 상수로 추출: `const RE_TIMEOUT = /timed out/i;`, `const RE_MEMORY = /memory limit|Isolate was disposed/i;`

---

### 요약

이번 변경의 핵심은 `node:vm`에서 `isolated-vm`(V8 Isolate)으로의 전환으로, 보안 목적의 구조적 격리를 달성한다. 성능 관점에서 가장 주목할 포인트는 **per-execution 컴파일 오버헤드**다. 매 실행마다 dayjs UMD + bootstrap 스크립트를 `compileScript` + `run`으로 처리하는 비용이 있으며, `isolated-vm`의 Snapshot API를 통한 힙 스냅샷 재사용으로 해소할 수 있다(plan에서도 후속 최적화 여지로 인지됨). 이중 타임아웃 구조의 +1000ms 마진은 기능상 문제는 없으나 tail latency에 영향을 줄 수 있다. `syntaxIsolate` 싱글톤의 disposed 상태 방어 코드 부재는 장기 실행 안정성 측면에서 보완이 필요하다. 나머지는 INFO 수준의 미세 최적화 여지이며, 현재 구현은 기능적 정확성과 격리 보안을 우선한 합리적 선택으로 보인다.

### 위험도

MEDIUM

STATUS: SUCCESS
