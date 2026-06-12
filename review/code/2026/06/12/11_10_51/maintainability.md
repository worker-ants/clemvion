# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: codebase/backend/src/nodes/data/code/code.handler.ts

- **[INFO]** `execute()` 메서드 길이 — 다중 책임 혼재
  - 위치: `execute()` 메서드 전체 (line 364–536, ~172 lines)
  - 상세: 단일 메서드가 (1) 격리 환경 구성, (2) 컨텍스트 데이터 주입, (3) 호스트 콜백 주입, (4) 스크립트 컴파일·실행, (5) 타임아웃 경쟁, (6) `$vars` 동기화, (7) 성공 응답 조립 — 7개의 뚜렷한 단계를 직접 처리한다. 각 단계가 주석 구분자(`--- ... ---`)로 경계를 표시하고 있어 분리 가능한 헬퍼 함수 후보임을 코드 자체가 암시하고 있다.
  - 제안: `injectContextData`, `injectHostCallbacks`, `runWithTimeout` 등의 private 헬퍼로 추출하면 각 단계의 테스트 가능성과 가독성이 향상된다. 현재 구조에서는 비교적 잘 주석 처리되어 있어 즉각적인 회귀 위험은 낮으나, 향후 기능 추가 시 메서드가 더 길어질 수 있다.

- **[INFO]** `execute()` 내 타임아웃 매직 넘버 `+ 1000`
  - 위치: line 477 — `timeoutMs + 1000`
  - 상세: 호스트 wall-clock 타임아웃이 isolate CPU 타임아웃보다 1000ms 늦게 발화하도록 하는 의도적인 여유 값이지만, 상수명 없이 인라인으로 작성되어 있다. 이 값의 의미(격차 허용치)가 코드에서 직접 드러나지 않아 수정 시 맥락 파악이 필요하다.
  - 제안: `const HOST_TIMEOUT_GRACE_MS = 1000;` 으로 추출하고 W15 패턴과 동일하게 설명 주석 부가.

- **[INFO]** `BOOTSTRAP_SOURCE` 상수 — 문자열 내 전역 삭제 목록의 컨텍스트 분산
  - 위치: line 205–225 (BOOTSTRAP_SOURCE 내 `for (const key of [...])` 블록)
  - 상세: 삭제 대상 전역 목록이 런타임 문자열 리터럴 내부에만 존재한다. spec §7.3 의 허용·차단 전역 목록과의 동기화를 수동으로 확인해야 한다. 목록이 늘어날수록 문자열 안에 배열 리터럴이 깊어져 오타나 누락 감지가 어렵다.
  - 제안: 파일 상단에 `const BLOCKED_GLOBALS: readonly string[] = [...]` 상수를 정의하고, BOOTSTRAP_SOURCE 생성 시 `JSON.stringify(BLOCKED_GLOBALS)` 로 주입하면 TypeScript 레벨에서 목록을 관리할 수 있다. (단, 보안 상의 신중한 검토 필요 — 현재 구조가 더 단순할 수 있음.)

- **[INFO]** 모듈 수준 변경 가능 상태 — `syntaxIsolate`
  - 위치: line 256 — `let syntaxIsolate: ivm.Isolate | undefined;`
  - 상세: 모듈 수준 mutable 변수로, 단순 캐시 목적이지만 테스트 환경에서 상태 누출 위험이 잠재한다. 코드 자체에서 "JS is single-threaded so concurrent compiles serialize"라는 근거를 제시하고 있어 현재 사용 패턴에서는 문제 없다. 다만 명시적인 초기화 API 없이 `syntaxIsolate.isDisposed` 체크로만 관리되어 reset 경로가 암묵적이다.
  - 제안: 현재 구조를 유지하되, 테스트 격리 목적으로 `resetSyntaxIsolateForTesting()` 같은 exported 함수를 추가하는 것도 고려할 수 있다 (현재 spec 파일은 정상적으로 이 동작을 behavioral 테스트로 다루고 있어 즉각적인 문제는 없음).

- **[INFO]** `failure()` 메서드 내 config 조립 중복
  - 위치: `execute()` 성공 리턴 (line 501–510)과 `failure()` (line 571–589)
  - 상세: `{ code: ..., language: ... ?? 'javascript', timeout: ... }` 패턴이 두 곳에서 동일하게 작성된다. 현재는 2곳에 불과하고 구조가 단순하나, config 필드가 추가될 경우 두 곳을 모두 수정해야 한다.
  - 제안: `buildConfigEcho(rawConfig: Readonly<Record<string, unknown>>)` 헬퍼로 추출.

- **[INFO]** `deepClone` 함수 단순성과 명명
  - 위치: line 113–116
  - 상세: `JSON.parse(JSON.stringify(value))` 방식의 deep clone으로, `undefined`/`null` 처리만 추가된 간단한 구현이다. 함수명 자체는 적절하나, JSON 직렬화 한계(함수·순환참조·`Date` 객체 타입 손실 등)에 대한 주석이 없어 미래 사용자가 범위를 오해할 수 있다.
  - 제안: JSDoc에 "JSON-safe values only" 제약 명시.

---

### 파일 2: codebase/backend/src/nodes/data/code/code.handler.spec.ts

- **[INFO]** 테스트 컨텍스트 객체 중복 — fallback 테스트용 인라인 `ctx`
  - 위치: line 1394–1403 (W-D describe 블록 내부)
  - 상세: `beforeEach`에서 이미 정의한 `context` 객체와 동일한 필드를 갖는 `ctx` 객체가 인라인으로 재정의된다. `jest.isolateModules()` 의 module 격리 요건 때문에 불가피한 측면이 있으나, 필드가 달라질 경우 두 곳을 모두 수정해야 한다.
  - 제안: 공용 컨텍스트 팩토리 함수 `makeExecutionContext(overrides?)` 를 파일 상단에 정의하고 양 쪽에서 호출.

- **[INFO]** 테스트 타입 캐스팅 패턴 반복
  - 위치: 다수 it 블록 (예: line 706–714, 726–727, 732–738 등)
  - 상세: `as unknown as { output: ...; meta: ...; port?: string }` 형태의 캐스팅이 모든 `execute()` 호출 결과에 반복된다. 이는 `NodeHandlerOutput`의 `output` 필드가 `unknown` 타입이기 때문에 구조상 불가피하나, 매 테스트마다 중복 타입 선언으로 인해 반환 형태 변경 시 수정 포인트가 많다.
  - 제안: 자주 쓰이는 결과 타입(`SuccessResult`, `ErrorResult`)을 테스트 파일 상단에 타입 별칭으로 정의하여 재사용.

- **[INFO]** `checkIndices` Set 사용의 가독성
  - 위치: line 1263–1277 (snapshot reuse 테스트)
  - 상세: `new Set([0, 12, 24])` 를 루프 바깥에 선언하고 `checkIndices.has(i)` 로 확인하는 패턴은 의도는 명확하나, 직접 조건 `(i === 0 || i === 12 || i === 24)` 또는 배열 기반 `includes`와 비교했을 때 과도하게 정형적이다. 단, 성능보다 의도 명시성을 위한 선택으로 볼 수 있다.
  - 제안: 미미한 수준. 현재 유지 또는 배열 `const CHECK_INDICES = [0, 12, 24];`로 단순화.

---

## 요약

`code.handler.ts`는 전반적으로 주석 품질이 높고 명명 일관성이 양호하다. 모듈 상수(`ISOLATE_MEMORY_LIMIT_MB`, `MAX_CONSOLE_LINES`, `LEGACY_TO_NORMALIZED` 등)가 목적에 맞게 정의되어 있으며 매직 넘버는 대체로 잘 처리되었다. 주요 유지보수 리스크는 `execute()` 메서드의 길이(~172 lines, 7단계 혼재)로, 향후 기능 추가 시 복잡도가 집중될 수 있다. 성공/에러 경로의 config 조립 코드 중복과 타임아웃 grace 상수 미명명이 경미한 개선 여지로 남아 있다. 테스트 파일은 커버리지 범위와 서술 품질이 우수하나, 컨텍스트 객체·결과 타입 캐스팅 중복이 반복 수정 포인트를 만들고 있다. 전체적으로 즉각적인 차단 이슈는 없으며 낮은 수준의 구조적 개선 사항들이다.

## 위험도

LOW
