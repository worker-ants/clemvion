# 부작용(Side Effect) 리뷰

**대상**: `code-node-isolated-vm` — `node:vm` → `isolated-vm` 전환

---

## 발견사항

### **[WARNING]** 모듈 로드 시점 파일시스템 읽기 — `readFileSync` at module load
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L32–35
- 상세: `DAYJS_SOURCE = readFileSync(require.resolve('dayjs/dayjs.min.js'), 'utf-8')` 가 모듈 import 시점에 동기 실행된다. 이전 코드(`import dayjs from 'dayjs'`)는 Node 모듈 캐싱으로 파일 접근이 추상화됐지만, 이제 명시적 `readFileSync`가 프로세스 기동 경로에서 블로킹 I/O를 수행한다. `dayjs/dayjs.min.js`가 설치되지 않은 환경(예: devDependencies only 빌드, 불완전한 npm install)에서 모듈 자체가 로드되지 않아 서버 기동 실패가 되고, 오류 메시지가 `Cannot find module 'dayjs/dayjs.min.js'`처럼 동작 계층보다 로드 계층에서 나타난다.
- 제안: 현재 구조는 의도된 것으로 보이나(주석에 "read once at module load" 명시), 빌드 단계에서 `dayjs` devDependency/dependency 정합성 확인이 필수다. 운영 Dockerfile이 `dependencies`만 설치하는지 확인 필요. `package.json`에 `dayjs`가 `dependencies`(prod)에 있으므로 현재는 문제 없으나, 제거 시 침묵 실패가 아닌 즉각 기동 실패가 발생하는 부작용에 대한 인식이 필요하다.

---

### **[WARNING]** 프로세스 수명 전체를 차지하는 전역 `syntaxIsolate` — `Isolate` 누수 위험
- 위치: `code.handler.ts` L172, L175 (`let syntaxIsolate: ivm.Isolate | undefined`)
- 상세: `syntaxIsolate`는 모듈 스코프 변수로, 한번 생성되면 프로세스 종료까지 유지된다. `isolated-vm`의 `Isolate` 인스턴스는 네이티브 V8 힙을 점유하며, 정상 경로에서는 `dispose()`를 호출하지 않는다. 단일 `Isolate`를 문법 체크 전용으로 재사용한다는 설계 의도는 타당하지만, 두 가지 부작용이 있다:
  1. 서버 재사용이 많은 경우, `syntaxIsolate`가 누적된 스크립트 컴파일 캐시를 내부 힙에 보유할 수 있다(`script.release()`는 호출하나 Isolate 자체의 상태 증가를 막지는 않는다).
  2. 테스트 환경에서 `CodeHandler`를 여러 test suite에서 import할 경우, Jest의 모듈 격리에 따라 `syntaxIsolate` 인스턴스가 test runner 프로세스에 누적될 수 있다.
- 제안: LRU 제한이나 카운터 기반 교체(`N`회 사용 후 `dispose` + 재생성)를 추가하거나, 적어도 서버 종료 시 `syntaxIsolate?.dispose()` 정리를 `process.on('exit', ...)` 훅으로 등록하는 것을 권장한다.

---

### **[WARNING]** `context.variables` 직접 변경 — 성공 경로에서 공유 상태 변경
- 위치: `code.handler.ts` L320–329 (`context.variables = ...`)
- 상세: 성공 종료 시 `context.variables`를 isolate에서 copy-out한 값으로 **직접 교체**한다. `ExecutionContext`가 워크플로우 엔진이 관리하는 공유 객체라면, 이 할당은 핸들러 계약을 벗어난 상태 변경이다. 이전 `node:vm` 구현도 동일한 패턴이었으나, 신규 코드에서도 이 동작이 유지된다. `$vars` copy-out 실패 시 `catch` 블록에서 원래 `varsClone`을 대입하는 것은 추가 방어가 맞지만, catch 블록의 주석 "Keep the mutated clone"은 `varsClone`이 isolate 실행 이전에 deepClone된 것이라 실제 "mutated"가 아닌 점에서 오해의 소지가 있다.
- 제안: 이 패턴이 spec §4.5에 의도된 것으로 명문화되어 있으므로 기능 자체는 문제 없다. 다만 catch 블록의 주석을 "Keep the pre-execution clone (read-back failed; variables not updated)" 정도로 정정하면 의도가 명확해진다.

---

### **[INFO]** `process.env.NODE_ENV` 읽기 — 런타임 환경 변수 접근
- 위치: `code.handler.ts` L387 (`process.env.NODE_ENV !== 'production'`)
- 상세: 이전 코드와 동일한 패턴이 유지된다. 환경 변수 읽기는 의도된 동작이며 기존 계약의 일부다. 부작용 관점에서 새로운 변경은 없으나, `failure()` 메서드가 `NODE_ENV`를 매 호출마다 읽는다(캐시 없음). 성능 임계 경로가 아니므로 실제 문제는 없다.
- 제안: 변경 불필요.

---

### **[INFO]** 매 `execute()` 호출마다 새 `Isolate` + `Context` 생성
- 위치: `code.handler.ts` L226, L230
- 상세: `syntaxIsolate`와 달리 실행용 `Isolate`는 매 요청마다 생성되고 `finally`에서 `dispose()`된다. 이는 의도된 설계(요청 간 상태 격리)이나, 네이티브 V8 Isolate 생성/해제는 non-trivial한 비용을 수반한다. plan 문서에서도 "per-exec dayjs 컴파일 — 후속 snapshot 최적화 여지"로 인식하고 있다. 현재 부작용은 없으나, 고부하 환경에서 GC 압력과 네이티브 힙 단편화가 잠재적 성능 부작용이 될 수 있다.
- 제안: 현재 단계에서는 명시적으로 인식된 트레이드오프이므로 변경 불필요. 후속 최적화 시 Isolate pool 또는 snapshot 재사용을 검토한다.

---

### **[INFO]** `ivm.Callback` 클로저 — 호스트 참조 유지
- 위치: `code.handler.ts` L252–278
- 상세: `__host_log` 콜백은 `logs` 배열 참조를 클로저로 캡처하고, 콜백이 isolate context에 주입된다. isolate이 실행 중(`script.run()`이 pending)인 동안 호스트의 `logs` 배열이 콜백을 통해 비동기적으로 변경될 수 있다. `ivm.Callback`의 호출은 동기(synchronous applier) 방식이므로 race condition은 없지만, 이 클로저 연결이 isolate dispose 전까지 살아있음을 인식해야 한다. `finally`에서 `isolate.dispose()`를 호출하면 콜백도 무효화된다.
- 제안: 현재 구현은 안전하다. 문서화 관점에서 `__host_log` 콜백이 synchronous이고 isolate dispose로 수명이 바인딩된다는 점을 주석에 명시하면 유지보수성이 향상된다.

---

### **[INFO]** `runPromise.catch(() => undefined)` — 의도적 예외 억제
- 위치: `code.handler.ts` L305
- 상세: `Promise.race`의 wall-clock 타임아웃이 먼저 resolve되면, 이후 `runPromise`가 reject되어도 unhandled rejection이 되지 않도록 no-op catch를 부착한다. 이는 의도된 패턴이며, `finally`에서 `isolate.dispose()`가 pending run을 중단시켜 late rejection을 유발하는 흐름을 커버한다. 새로운 부작용은 없다.
- 제안: 변경 불필요. 주석이 이미 이유를 설명하고 있다.

---

## 요약

이번 변경의 핵심 부작용은 세 가지다. (1) `readFileSync`가 모듈 로드 경로로 이동하여 `dayjs/dayjs.min.js` 부재 시 서버 기동 실패로 이어지는 파일시스템 의존성이 도입됐다 — 의도된 설계이나 운영/배포 팀이 인지해야 한다. (2) 모듈 스코프 `syntaxIsolate`가 프로세스 수명 전체에 걸쳐 네이티브 V8 힙을 점유하며 정리 없이 유지된다 — 장기 운영 시 메모리 증가 가능성이 있다. (3) `context.variables` 직접 교체는 spec §4.5에 명문화된 계약이므로 의도된 동작이나, catch 경로 주석의 정확성 개선이 권장된다. 나머지 발견사항(환경변수 읽기, isolate per-request 생성, 콜백 클로저)은 모두 의도된 설계이거나 선재 패턴의 유지로 새로운 위험을 도입하지 않는다. 전역 상태 변경·네트워크 호출·예상 외 이벤트 발생·공개 API 시그니처 변경은 없다.

## 위험도

LOW
