# Testing 리뷰 — code-node-isolated-vm

## 발견사항

### [INFO] classifyError 스포핑 방지 테스트의 설명-동작 불일치
- **위치**: `code.handler.spec.ts` 라인 71–84 (`should NOT classify user-thrown "Isolate was disposed" as memory when isolate is alive`)
- **상세**: 테스트 이름과 주석은 "isDisposed priority-2 가 NOT triggered" 임을 강조하지만, 실제 결과(`EXECUTION_MEMORY_EXCEEDED`)는 priority-3 regex가 메시지를 잡아서 나온 것이다. 즉 이 테스트는 "spoofing이 차단된다"는 것을 검증하는 것이 아니라, "regex fallback도 같은 코드를 반환한다"를 검증한다. 진짜 spoofing 방지 의도(priority-2는 사용자 코드가 아니라 isolate.isDisposed 플래그로만 진입 가능)를 직접 검증하려면, `err.message = 'Isolate was disposed'` + `isDisposed: false` 케이스에서 priority-1(code) 체크도 없고 priority-2(isDisposed flag)도 false이므로 regex로 여전히 `EXECUTION_MEMORY_EXCEEDED`가 나온다는 점을 설명과 별개로, "isDisposed false인데도 EXECUTION_MEMORY_EXCEEDED가 반환되는" 상황이 오해를 유발한다. 메시지를 "spoofing 불가능 케이스: user-thrown message는 regex fallback을 통해 동일 코드가 나오지만 isDisposed flag(priority-2)를 우회할 수 없음"으로 보완하거나, 별도로 `err.message = '일반 에러'` + `isDisposed: false` 케이스를 추가해 priority-2가 false이면 `CODE_RUNTIME_ERROR`로 분류됨을 보여주면 의도가 명확해진다.
- **제안**: 기존 테스트는 유효하지만 명칭이 실제 검증 내용보다 과도하게 주장한다. 테스트 명칭을 "should fall through to regex when isDisposed is false (priority-2 not taken)"로 수정하거나, 보완 테스트 추가를 권장.

### [INFO] classifyError 에 null/undefined Error 객체 케이스 커버 불완전
- **위치**: `code.handler.spec.ts` 라인 112–114 (`should handle null/undefined-like error gracefully`)
- **상세**: 현재 테스트는 빈 객체(`{}`)를 전달해 `CODE_RUNTIME_ERROR`를 확인한다. 그러나 `classifyError(null as any)`, `classifyError(undefined as any)` 케이스는 별도로 검증되지 않는다. 구현은 `err?.code`, `err?.message` 로 optional chaining을 사용하므로 null/undefined도 안전하게 처리되지만, 테스트로 명시적으로 확인되지 않는다. production 환경에서 isolated-vm 이 null/undefined를 throw하는 경우를 방어할 수 있다.
- **제안**: `classifyError(null as any)`, `classifyError(undefined as any)` 케이스를 기존 테스트에 추가하거나 별도 it 블록으로 추가.

### [INFO] syntaxIsolate isDisposed 재생성 경로에 대한 테스트 없음
- **위치**: `code.handler.ts` 라인 1131–1133 (`if (!syntaxIsolate || syntaxIsolate.isDisposed)`)
- **상세**: W4/INFO#3 주석으로 "OOM 후 재생성" 경로를 추가했으나, 이 경로를 직접 검증하는 테스트가 없다. syntaxIsolate는 모듈-레벨 변수이므로 테스트 간 상태 공유가 발생할 수 있다. 현재 validate 테스트들은 syntaxIsolate의 초기화/재생성 경로를 직접 검증하지 않는다.
- **제안**: syntaxIsolate가 disposed 상태일 때 재생성 후 정상 작동하는지 확인하는 테스트가 있으면 더 강건하다. 다만 classifyError와 달리 내부 구현 상세를 직접 노출하기 어렵기 때문에 필수는 아니고 권고 수준.

### [INFO] CODE_MEMORY_LIMIT 메모리 한도 하드코딩 값이 i18n 문자열에만 존재
- **위치**: `backend-labels.ts` 라인 2044 (`"코드 실행 중 메모리 한도(128MB)를 초과했어요."`)
- **상세**: i18n 메시지에 `128MB`를 하드코딩했다. `ISOLATE_MEMORY_LIMIT_MB = 128` 상수가 `code.handler.ts`에 있고 W15 주석으로 "env var로 추출 가능"하다고 명시돼 있다. 실제로 메모리 한도가 바뀌면 i18n 문자열도 함께 수동으로 변경해야 하는 동기화 갭이 발생한다. 현재는 테스트가 이 동기화를 강제하지 않는다.
- **제안**: i18n 단위 테스트(예: `backend-labels.test.ts`)가 이미 존재한다면, `ERROR_KO.CODE_MEMORY_LIMIT` 값에 숫자 `128`이 포함되어야 한다는 단언을 추가하거나, 메모리 한도를 상수로 export해 두 파일이 같은 소스에서 참조하도록 개선하는 것을 고려.

### [INFO] LEGACY_TO_NORMALIZED 테이블의 누락 키에 대한 fallback 경로 테스트 없음
- **위치**: `code.handler.ts` 라인 1354 (`LEGACY_TO_NORMALIZED[errorCode] ?? errorCode`)
- **상세**: `classifyError`가 반환할 수 없는 새 내부 코드가 `LEGACY_TO_NORMALIZED`에 누락된 경우 `errorCode`가 그대로 `output.error.code`로 노출된다(`?? errorCode` fallback). 이 경로는 현재 테스트에서 커버되지 않는다. 보안/인터페이스 관점에서 내부 코드가 그대로 외부에 노출되는 케이스다.
- **제안**: 향후 새 분류 코드 추가 시 LEGACY_TO_NORMALIZED 누락을 잡는 단위 테스트를 추가하거나, 매핑 누락 시 경고 로그를 남기는 방어 코드를 추가.

### [INFO] 메모리 초과 테스트의 CI 플래키니스 노트는 유효하나 환경 분리 전략 없음
- **위치**: `code.handler.spec.ts` 라인 41–45, 685–707
- **상세**: W10 주석으로 "CI 환경에서 CODE_TIMEOUT이 CODE_MEMORY_LIMIT 대신 발생할 수 있다"는 플래키니스를 문서화했다. 이는 현실적인 위험인데, 현재 이를 완화하는 코드 수준 조치(예: `jest.retryTimes`, 환경별 skip 조건, 또는 별도 `describe.skip` 가드)가 테스트에 없다. 주석만으로는 CI 레드 빌드를 방지하지 못한다.
- **제안**: 환경 변수(예: `CI=true`)에서 이 테스트를 skip하거나 `jest.retryTimes(2)`를 이 describe 블록에만 적용하는 것을 검토. 또는 classifyError 단위 테스트(이미 추가된)가 이 통합 테스트의 의도를 충분히 커버하므로, 통합 테스트는 `@slow` 또는 별도 suite로 분리 고려.

### [INFO] console.warn / console.error 캡처 테스트 없음
- **위치**: `code.handler.spec.ts` (execute — security restrictions, 라인 419–426)
- **상세**: `console.log` 캡처는 테스트되어 있지만 `console.warn`, `console.error`에 대한 캡처 테스트가 없다. BOOTSTRAP_SOURCE에서 세 레벨 모두 `__host_log`로 라우팅되지만 `warn`/`error` 레벨 로그의 `[warn]`/`[error]` prefix 포맷이 검증되지 않는다.
- **제안**: `console.warn("test")` → `meta.logs`에 `"[warn] test"` 포함 여부를 확인하는 테스트 추가.

---

## 요약

이번 변경의 핵심인 `classifyError` 함수의 단위 테스트(W9) 추가는 테스트 설계 관점에서 올바른 방향이다. 3개의 우선순위 분기(trusted code, isDisposed flag, regex fallback)를 각각 별도 케이스로 검증하고, 함수를 `export`로 노출해 화이트박스 테스트를 가능하게 한 구조는 테스트 용이성을 높였다. `LEGACY_TO_NORMALIZED` 테이블 도입과 `syntaxIsolate` 재생성 경로 추가도 각각의 의도가 명확하다. 다만 spoofing 방지 테스트 케이스의 명칭이 실제 검증 내용보다 강한 주장을 담고 있어 독해 시 혼란을 줄 수 있고, 메모리 초과 통합 테스트의 CI 플래키니스에 대한 코드 수준 완화 전략이 없다는 점, console.warn/error 캡처 검증 누락 등 소규모 커버리지 갭이 존재한다. 전반적으로 전체 테스트 커버리지 수준은 양호하며 위험도는 낮다.

## 위험도

LOW
