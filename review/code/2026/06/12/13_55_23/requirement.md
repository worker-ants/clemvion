# 요구사항(Requirement) Review — code.handler.ts

## 발견사항

---

### **[CRITICAL]** `$helpers.base64.encode/decode` — 비문자열 `TypeError` 계약이 실제 파일에 미반영
- **위치**: 실제 디스크 파일 `/codebase/backend/src/nodes/data/code/code.handler.ts` 398~408행 (현재 커밋 기준)
- **상세**: spec §2.2 및 §Rationale "base64 비문자열 TypeError 정렬(2026-06-12)"은 `$helpers.base64.encode/decode` 의 비문자열 인자에 대해 `TypeError` 를 throw 해야 한다고 명시한다. 리뷰 페이로드에 제시된 코드(신규 버전)는 `hostB64Encode`/`hostB64Decode` 함수를 추가해 이 계약을 구현한다. 그러나 현재 디스크에 있는 실제 파일은 여전히 `Buffer.from(String(data), 'utf-8')` 와 `Buffer.from(String(data), 'base64')` 로 silent 강제변환을 수행하여 spec §2.2 의 "비문자열 입력은 TypeError" 요구를 위반한다.
  - 리뷰 대상이 페이로드에 제시된 신버전이라면 구현 정확, 디스크 파일(구버전)이 대상이라면 spec 위반.
  - 리뷰 시스템이 페이로드와 실제 파일이 다른 두 버전을 참조하고 있어, **어느 것을 배포하는지 명확히 해야 한다**.
- **제안**: 페이로드(신버전)가 배포 대상임을 확인 후 진행한다. 디스크의 구버전이 배포 대상이라면, `hostB64Encode`/`hostB64Decode` 의 `TypeError` 가드를 즉시 추가해야 한다.

---

### **[WARNING]** `EXECUTION_MEMORY_EXCEEDED` 오류 메시지 — spec §5.3.3 prescriptive 예시와 불일치 가능
- **위치**: `execute()` 내 catch 블록 / `failure()` 메서드 (리뷰 페이로드 코드 기준)
- **상세**: spec §5.3.3 은 메모리 초과 케이스의 `output.error.message` 를 `"Isolate was disposed during execution due to memory limit"` 로 예시한다. 코드는 `EXECUTION_TIMEOUT` 에만 `overrideMessage` (`'Code execution timed out'`)를 설정하고, `EXECUTION_MEMORY_EXCEEDED` 에는 overrideMessage 없이 raw `err.message` 를 그대로 사용한다.
  - Priority 2 경로(isolate.isDisposed — 가장 신뢰도 높은 경로): isolated-vm 이 throw 한 실제 메시지가 spec 예시 문자열과 다를 경우 계약 불일치.
  - Priority 3 경로(regex fallback): isolate 가 살아있는 상태에서 메시지 패턴으로 분류되면 동일 문제.
  - spec 예시가 실제 isolated-vm 오류 메시지와 일치한다면 문제없으나, isolated-vm 버전 업그레이드 시 메시지 변경으로 회귀될 수 있다.
- **제안**: 타임아웃과 동일하게 `errorCode === 'EXECUTION_MEMORY_EXCEEDED'` 에도 overrideMessage 를 설정한다:
  ```ts
  errorCode === 'EXECUTION_TIMEOUT'
    ? 'Code execution timed out'
    : errorCode === 'EXECUTION_MEMORY_EXCEEDED'
      ? 'Isolate was disposed during execution due to memory limit'
      : undefined
  ```
  이렇게 하면 isolated-vm 내부 메시지에 의존하지 않고 spec §5.3.3 의 계약을 안정적으로 유지한다.

---

### **[WARNING]** `resolveMemoryLimitMb` — `parseInt` 가 "abc" prefix 문자열을 0으로 파싱하지 않고 숫자로 파싱하는 엣지케이스
- **위치**: `resolveMemoryLimitMb()` 함수 (리뷰 페이로드 기준 58~75행)
- **상세**: spec §7.2 는 "비수치·≤0 시 fallback" 을 명시한다. `Number.parseInt("64abc", 10)` 는 `64` 를 반환하며 `isFinite(64) && 64 > 0` 이므로 유효한 값으로 처리된다. 즉 `CODE_NODE_MEMORY_LIMIT_MB=64abc` 는 경고 없이 `64` 로 설정된다. 이는 운영자 오타를 조용히 수락하는 동작으로, spec §7.2 의 "비수치 fallback" 의도와 부분적으로 어긋난다.
  - 단순 숫자 문자열(예: `"128"`, `"256"`)에는 영향 없음.
  - 현재 코드의 warn 조건은 `!Number.isFinite(parsed) || parsed <= 0` — `parseInt("64abc")` 는 경고를 내지 않는다.
- **제안**: `Number(raw.trim())` 또는 `Number.isNaN(Number(raw.trim()))` 체크로 순수 숫자 여부를 검증하거나, 현재 동작이 허용 범위라면 JSDoc 에 "prefix 숫자 파싱은 의도적" 임을 명시한다.

---

### **[WARNING]** `deepClone` 의 JSON.stringify — 순환 참조/비직렬화 `context.variables` 처리
- **위치**: `deepClone` 함수 (리뷰 페이로드 기준 152~155행), `execute()` 내 `const varsClone = deepClone(context.variables) ?? {};`
- **상세**: `deepClone` 은 `JSON.parse(JSON.stringify(value))` 를 사용한다. `context.variables` 에 순환 참조 또는 `undefined` 값을 가진 키가 있으면 `JSON.stringify` 가 throw 한다 (`TypeError: Converting circular structure to JSON`). 이 경우 `execute()` 의 outer try-catch 가 잡아 syntax error 여부를 체크 후 `failure()` 로 라우팅하는데, 이는 `CODE_RUNTIME_ERROR`(fallback) 코드로 분류되고 메시지가 "Converting circular structure to JSON"이 되어 사용자 코드가 아닌 엔진 내부 문제처럼 노출된다.
  - spec §4.5 및 §4 step 1 은 "deep clone 하여 $vars 로 주입" 을 명시하나 비직렬화 변수 처리는 미명시.
  - 실제 사용에서 `context.variables` 에 순환 참조가 들어올 가능성은 낮으나, 방어적 처리가 없다.
- **제안**: `deepClone` 내부에 try/catch 를 추가하거나, `varsClone` 에서 발생하는 직렬화 오류를 조기에 catch 해 더 명확한 오류 메시지를 제공한다.

---

### **[INFO]** `syntaxCheck` — `syntaxIsolate` 가 모듈 수준 싱글턴 — 진단 isolate 를 명시적으로 dispose 하지 않음
- **위치**: `syntaxCheck` 함수, `syntaxIsolate` 모듈 변수 (리뷰 페이로드 기준 326~346행)
- **상세**: `syntaxIsolate` 는 프로세스 생애 동안 유지되며 OOM/dispose 시 재생성된다. 이 isolate 는 script compile 후 `script.release()` 하지만 isolate 자체를 dispose 하지 않는다. 장시간 실행 프로세스에서 소량의 메모리 누수 가능성이 있다. 그러나 validate() 에서만 컴파일하고 실행하지 않으므로 실질적 위험은 낮다.
- **제안**: 현 상태 수용 가능. 명시적 dispose 없는 이유를 주석으로 기술하면 충분.

---

### **[INFO]** spec §5.1 에 `meta.durationMs` 필드가 명시돼 있으나 handler 가 반환하지 않음
- **위치**: `execute()` 성공 경로 반환값 (리뷰 페이로드 기준 498~507행)
- **상세**: spec §5.1 의 JSON 예시에는 `meta.durationMs` 가 포함돼 있고, 공통 필드 표(§5.1·§5.3)에서 "engine inject" 출처로 명시된다. 코드가 `meta: { success: true, logs }` 만 반환하는 것은 spec 의 의도("핸들러는 `meta: { success, logs }` 만 반환하고 엔진이 실행 시간을 덧붙인다")에 부합한다 — 엔진이 `durationMs` 를 주입하는 구조이므로 코드 결함이 아님.
- **제안**: 현 구현 정확. INFO 수준 메모.

---

### **[INFO]** [SPEC-DRIFT] `CODE_NODE_MEMORY_LIMIT_MB` 환경변수화 — spec 이미 §7.2 에 기술됨, 디스크 파일의 W15 주석이 stale
- **위치**: 실제 디스크 파일 15~20행의 W15 주석 (`Can be extracted to CODE_NODE_MEMORY_LIMIT_MB env var if runtime tuning is needed`)
- **상세**: 리뷰 페이로드(신버전)는 `resolveMemoryLimitMb()`를 통해 `CODE_NODE_MEMORY_LIMIT_MB` env를 구현한다. spec §7.2 는 이미 해당 env var 와 clamp 동작을 명시한다(Rationale "메모리 한도 환경변수화 2026-06-12"). 구현이 spec 을 반영하였으므로 코드 버그는 아님; 디스크 파일의 W15 TODO 주석이 낡았다 (신버전 배포 시 자동 해소).
- **제안**: 코드 유지. 디스크 파일 W15 주석은 신버전 배포 시 사라지므로 별도 조치 불필요.

---

## 요약

리뷰 페이로드(신버전)는 spec §2.2 의 `$helpers.base64` TypeError 계약, spec §7.2 의 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수화, spec §7.1 의 dayjs 힙 스냅샷 최적화, spec §7.3 의 전역 하드닝, spec §4.5 의 `$vars` deep clone + 원자적 동기화, spec §4 의 +3 라인 오프셋 래퍼, spec §5.1/§5.3 의 출력 봉투(port/config echo/meta)를 전반적으로 올바르게 구현한다. 주요 위험은 두 가지다: (1) 현재 디스크 파일과 리뷰 페이로드 간 버전 불일치 — 어느 버전이 실제 배포 대상인지 명확히 해야 하며, 디스크 구버전이 배포되면 `$helpers.base64` TypeError 계약 위반이 발생한다. (2) 메모리 초과 오류 메시지를 overrideMessage 로 고정하지 않아 spec §5.3.3 예시와 실제 메시지가 isolated-vm 내부 변경 시 달라질 수 있다.

## 위험도

**HIGH** — 버전 불일치 확인 전까지는 spec §2.2 TypeError 계약 위반 가능성이 있으며 (CRITICAL 항목), 메모리 초과 메시지 불안정 위험이 병존한다.
