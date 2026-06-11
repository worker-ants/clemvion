# 요구사항(Requirement) 리뷰 — code-node isolated-vm 전환

**대상 커밋**: code 노드 `node:vm` → `isolated-vm` 전환 (refactor 04 C-2·M-2 흡수)
**리뷰 시각**: 2026-06-11
**spec SoT**: `spec/4-nodes/5-data/2-code.md`

---

## 발견사항

### **[INFO]** 기능 완전성 — 전반적으로 양호
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` 전체
- 상세: spec §4 실행 로직 6단계 — (1) `$input`/`$vars` 바인딩, (2) `compileScript` 컴파일, (3) `isolate.run(promise:true, timeout)`, (4) success 반환, (5) 런타임 throw/타임아웃 → `error` 포트, (6) `$vars` 원자적 교체 — 모두 구현 확인. `ivm.Isolate({ memoryLimit: 128 })`, `ExternalCopy` 주입, `ivm.Callback` 브리지, 부트스트랩 하드닝 모두 spec §7.1·§7.3 에 일치.

---

### **[WARNING]** spec §5.3 공통 필드 표 — `output.error.code` 열거 불완전
- 위치: `spec/4-nodes/5-data/2-code.md` §5.3 공통 필드 표 (`output.error.code` 행), line 298
- 상세: 공통 필드 표의 `output.error.code` 설명은 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` 만 열거하고 `CODE_MEMORY_LIMIT` 를 생략한다. §5.3.3 케이스와 §7.2 에는 `CODE_MEMORY_LIMIT` 가 정식 코드로 기술돼 있어 내부 불일치다. 구현 코드는 세 가지를 모두 올바르게 정규화(`classifyError` → `normalizedCode` 분기)하므로 **코드는 옳고 spec 표 행이 낡았다**.
- 제안: `[SPEC-DRIFT]` — 코드 유지 + spec §5.3 공통 필드 표 `output.error.code` 설명을 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 로 갱신.

---

### **[INFO]** `classifyError` 메시지 패턴 — isolated-vm 6.x 메시지 의존성
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line 435
- 상세: `classifyError` 는 `/memory limit/i` 와 `/Isolate was disposed/i` 두 정규식으로 메모리 초과를 감지한다. isolated-vm 6.x 의 실제 에러 메시지가 이 패턴에 부합한다면 정상 동작하나, 패치 버전에서 메시지가 바뀌면 조용히 `CODE_EXECUTION_FAILED` 로 오분류된다. spec §5.3.3 은 "> isolate 가 `memoryLimit: 128`(MB) 를 초과하면 V8 이 isolate 를 즉시 폐기한다" 고 기술하나 구체 메시지 패턴을 명시하지 않는다. 메모리 테스트(`should route an isolate memory-limit breach to CODE_MEMORY_LIMIT`)가 있어 회귀 탐지 가능.
- 제안: 선택적 — isolated-vm 6.x 공식 에러 메시지 확인 후, `RangeError: Array buffer allocation failed` 같은 추가 패턴이 있으면 보강. 단, 테스트 게이트가 존재하므로 즉시 필수는 아님.

---

### **[INFO]** `$vars` copy-back 실패 fallback — spec §4.5 와 미묘한 차이
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line 325-329
- 상세: spec §4.5 는 "throw 시 원본 보존(롤백)" 을 명시한다. 그런데 copy-back 실패 시 fallback 은 `varsClone` (실행 전 복사본) 을 `context.variables` 에 씀으로써 사실상 원본을 **교체**한다. `context.variables` 가 실행 전과 같은 값이라면 동일하나, 만약 엔진이 `context.variables` 를 직접 수정했을 경우 그 변경을 덮어쓴다. 실제 엔진이 핸들러 실행 중 `context.variables` 를 변경하지 않는 가정 하에 무해하나, spec §4.5 의 "원본 보존" 의도와 표면적으로 다르다. 기능 정상, 에러 시나리오의 경계 케이스.
- 제안: 주석에 "fallback 시 varsClone(실행 전 스냅샷) 을 쓰는 것이 원본 보존과 동치" 임을 명시하거나, `context.variables = context.variables` (no-op) 로 명확히 표현 고려.

---

### **[INFO]** `syntaxIsolate` — 전역 변수 생명주기
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line 172
- 상세: `syntaxIsolate` 는 모듈 레벨 전역 변수로, 8MB 메모리 한계 isolate 를 프로세스 전체에서 공유한다. spec §6 은 `isolate compileScriptSync` 로 pre-flight 구문 체크를 명시한다. 기능 동작은 올바르나, 해당 isolate 가 `memoryLimit: 8` 초과 시 — 비현실적이나 이론상 가능 — 이후 `compileScriptSync` 호출이 실패할 수 있다. 또한 프로세스 종료 시 GC 없이 해제된다.
- 제안: INFO 수준. 필요 시 `try/catch` 에서 `syntaxIsolate` 를 재생성하는 방어 코드 추가 고려.

---

### **[INFO]** `wrapUserCode` — JSON.stringify 내부 직렬화 경계
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line 165
- 상세: 사용자 코드가 `return` 하는 값이 `JSON.stringify` 를 통해 문자열로 직렬화된 후 host 에서 `JSON.parse` 된다. 순환 참조 객체를 반환하면 isolate 내부에서 `JSON.stringify` 가 throw 하고 이것이 `CODE_EXECUTION_FAILED` 로 라우팅된다. spec §5.1 은 "primitive / object / array / `undefined` 모두 가능" 이라 하지만 순환 참조는 명시하지 않는다. 동작은 예측 가능(에러 포트), spec 침묵 영역. INFO 수준.

---

### **[INFO]** `queueMicrotask` — 부트스트랩 삭제 목록에 있으나 spec §7.3 표에 미등록
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line 144 vs `spec/4-nodes/5-data/2-code.md` §7.3 차단 API 표
- 상세: 코드의 부트스트랩은 `queueMicrotask` 를 삭제 목록에 포함한다. spec §7.3 의 "차단" API 표에는 `queueMicrotask` 가 없다 (표는 `setTimeout`/`setInterval`/`setImmediate` 만 열거). `queueMicrotask` 는 비결정적 스케줄링 목록에 합리적으로 포함되므로 **코드가 스펙보다 더 정밀하게 구현된 케이스**다.
- 제안: `[SPEC-DRIFT]` — 코드 유지 + spec §7.3 차단 API 표에 `queueMicrotask` 행 추가.

---

### **[INFO]** `$helpers.date()` — `undefined` 인자 처리
- 위치: `BOOTSTRAP_SOURCE` 내 `date: (value) => __dayjs(value)`
- 상세: 구 구현의 `HelpersApi.date` 는 `(value?: unknown)` 으로 optional 표기했다. 신규 구현은 타입 선언 없이 `(value) => __dayjs(value)` 로 위임한다. `value` 가 `undefined` 이면 `dayjs(undefined)` → 현재 날짜를 반환하는 dayjs 기본 동작. spec §2.2 는 `$helpers.date(value)` 로만 기술하며 optional 여부를 명시하지 않는다. 동작 변화 없음, spec 침묵 영역.

---

## 요약

`isolated-vm` 전환의 핵심 기능(V8 Isolate 격리, 128MB 메모리 하드 리밋, `CODE_MEMORY_LIMIT` 에러 코드, 이중 타임아웃, `$helpers` host 콜백 브리지, `$vars` 원자적 교체, 부트스트랩 하드닝)은 spec §4·§7.1·§7.2·§7.3 에 line-level 로 일치한다. 에러 코드 정규화 경로(`classifyError` → `normalizedCode`)도 spec §5.3 매핑 표와 일치한다. 발견된 WARNING 1건은 spec §5.3 공통 필드 표에서 `CODE_MEMORY_LIMIT` 가 `output.error.code` 행 설명에 누락된 spec 텍스트 드리프트(코드가 옳고 spec 표만 낡음)이며, 나머지는 모두 INFO 수준의 경계 케이스 또는 spec 침묵 영역이다. `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` / `EXECUTION_MEMORY_EXCEEDED` 세 내부 코드가 각각 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 로 정규화되는 흐름과 `legacyCode` echo 가 spec §5.3.1·§5.3.2·§5.3.3 예시와 일치하는 것을 확인했다. 요구사항 충족 관점에서 전반적으로 안전하다.

---

## 위험도

LOW
