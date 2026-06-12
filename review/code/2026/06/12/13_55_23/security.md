# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `eval` / `Function` 삭제는 `globalThis` 에서만 이루어지며, 이미 캡처된 참조(클로저, 프로토타입 체인)는 삭제되지 않음
  - 위치: `BOOTSTRAP_SOURCE` (코드 274-294 라인, `for (const key of [...]) { delete globalThis[key]; }`)
  - 상세: `delete globalThis.eval` 은 전역 바인딩을 끊지만, 격리된 V8 Isolate 내에서 `({}).__proto__.constructor` 와 같은 프로토타입 체인 경로로 `Function` 에 접근하는 우회 경로가 이론적으로 존재합니다. 다만 `ivm.Isolate` 의 구조적 격리(host realm 없음)로 인해 실질적 탈출은 불가능하며, 이 부분은 이미 코드 주석(`// Naive global access is removed; the reachable %Function% intrinsic stays isolate-confined (no host realm to escape to)`)에서 인지하고 있음이 명시되어 있습니다.
  - 제안: `Object.freeze(Object.prototype)` 또는 `Object.freeze(Function.prototype)` 을 BOOTSTRAP_SOURCE 내에 추가하면 프로토타입 체인 경유 우회를 추가로 막을 수 있습니다. 단, dayjs 등 동적 프로토타입 확장을 사용하는 라이브러리가 있다면 충돌 가능성을 사전 검토해야 합니다.

### 발견사항 2
- **[INFO]** `__host_log` 콜백에서 로그 페이로드를 `String(payload)` 로 강제 변환할 때 길이 제한이 없음
  - 위치: `_buildIsolateContext` (코드 590-595 라인)
  - 상세: 로그 라인 수는 `MAX_CONSOLE_LINES = 100` 으로 제한되어 있지만, 개별 로그 라인의 길이는 제한이 없습니다. 사용자 코드가 `console.log('A'.repeat(10_000_000))` 을 호출하면 단 하나의 로그 항목으로 호스트 힙에 수십 MB 를 할당할 수 있습니다. 이는 격리 메모리 제한을 우회한 호스트 측 메모리 압박을 유발합니다.
  - 제안: `__host_log` 에서 `payload` 를 `String(payload).slice(0, MAX_LOG_LINE_LENGTH)` 와 같이 단일 라인 최대 길이(예: 10,000자)로 자르는 처리를 추가하세요. `MAX_LOG_LINE_LENGTH` 를 모듈 상수로 정의하고 주석으로 근거를 명시하는 것을 권장합니다.

### 발견사항 3
- **[INFO]** `failure()` 메서드에서 스택 트레이스를 `process.env.NODE_ENV !== 'production'` 으로 판단해 클라이언트에 노출
  - 위치: `failure()` (코드 664-678 라인)
  - 상세: `NODE_ENV` 가 명시적으로 설정되지 않거나 `'development'`, `'test'` 인 경우 스택이 `output.error.details.stack` 에 포함되어 클라이언트로 전달됩니다. 스택은 내부 파일 경로, 라이브러리 버전 등을 노출할 수 있습니다. 코드 주석에도 이 사실이 명시되어 있으며(`server-side debugging only`), 의도된 동작임을 인지하고 있습니다.
  - 제안: `details.stack` 이 UI에 렌더링되지 않음을 run-results UI 수준에서 보장(화이트리스트 렌더링 등)하거나, 스택을 클라이언트 응답에서 분리해 서버 측 로그 전용으로만 기록하는 방안을 검토하세요. 현재 코드 구조상 low-risk 이지만, 향후 API 응답을 직접 노출하는 경로가 생기면 위험도가 올라갑니다.

### 발견사항 4
- **[INFO]** `ALLOWED_HASH_ALGORITHMS` 에 `md5` 및 `sha1` 포함
  - 위치: 코드 82-89 라인
  - 상세: MD5 와 SHA-1 은 충돌 저항성이 깨진 알고리즘입니다. 암호화 목적(서명, 인증서) 사용 시 보안 취약점이 됩니다. 그러나 이 함수는 사용자 코드에서 호출하는 `$helpers.crypto.hash` 로, 체크섬이나 캐시 키 등 비암호화 목적 사용도 흔합니다.
  - 제안: 문서 또는 UI hint 에 "MD5 / SHA-1 은 암호화 목적으로 사용하지 말 것" 을 명시하고, 가능하면 알고리즘 선택 시 경고를 추가하는 것을 고려하세요. 현재 코드 문맥에서는 INFO 수준입니다.

### 발견사항 5
- **[INFO]** `syntaxIsolate` 가 모듈 레벨 변경 가능 상태로 유지되며 동시 요청 시 재생성 경쟁
  - 위치: 코드 325-345 라인
  - 상세: `syntaxIsolate` 는 `let` 으로 선언된 모듈 레벨 변수이며, `syntaxCheck` 는 동기 함수입니다. Node.js 는 단일 스레드이므로 실제 경쟁 조건은 발생하지 않습니다. 다만 Worker Thread 환경에서 모듈이 공유된다면 동시 접근이 가능합니다. 현재 아키텍처에서는 문제없으나, 향후 Worker Thread 도입 시 주의가 필요합니다.
  - 제안: 이 리스크를 코드 주석에 명시해 두면 향후 변경 시 참조할 수 있습니다.

---

## 요약

`code.handler.ts` 는 `isolated-vm` 의 V8 Isolate 구조적 격리를 올바르게 활용하고 있으며, host realm 탈출 차단, 메모리 상한 클램핑, 이중 타임아웃(CPU + wall-clock), 해시 알고리즘 허용 목록, 스택 트레이스 환경별 분기 등 보안 설계가 체계적으로 구현되어 있습니다. SQL 인젝션, XSS, 커맨드 인젝션, 하드코딩된 시크릿, 인증/인가 우회 등의 고위험 취약점은 발견되지 않았습니다. 주요 개선 포인트는 개별 로그 라인 길이 제한(호스트 측 메모리 압박 가능성)이며, 나머지는 모두 INFO 수준의 방어 심화 제안입니다.

## 위험도

LOW

---

STATUS: SUCCESS
