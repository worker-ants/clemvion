# Architecture Review — code.handler.ts

## 발견사항

### [WARNING] CodeHandler 클래스의 다중 책임 (SRP 위반 경계)
- 위치: `CodeHandler` 클래스 전체 (`code.handler.ts` lines 407–702)
- 상세: `CodeHandler` 는 현재 (1) 유효성 검사 (`validate`), (2) 격리된 VM 컨텍스트 구축 (`_buildIsolateContext`), (3) 타임아웃 관리가 포함된 스크립트 실행 (`_runWithTimeout`), (4) 에러 분류 및 응답 형성 (`failure`) 을 모두 단일 클래스에서 수행한다. `_buildIsolateContext` 와 `_runWithTimeout` 은 private 메서드로 분리되어 있어 내부 응집도는 수용 가능한 수준이나, VM 격리 생명주기 관리(isolate 생성 → 컨텍스트 빌드 → 실행 → 폐기)가 모두 `execute()` 메서드 안에 위치하여 VM 샌드박스 인프라와 노드 핸들러 비즈니스 로직의 경계가 흐릿하다. 이 구조는 현재 기능 범위에서는 관리 가능하지만, 향후 다른 언어(Python 등) 추가 시 handler 클래스 자체를 수정해야 하는 개방-폐쇄 원칙(OCP) 위반으로 이어질 수 있다.
- 제안: 즉각적 리팩터링 필수는 아니나, 향후 언어 확장 계획이 있다면 `IsolateExecutor` 인터페이스(컨텍스트 빌드 + 실행 + 타임아웃)를 추출하고 `CodeHandler` 는 이를 의존성 주입으로 사용하는 구조를 고려한다. 현 단계에서는 WARNING 수준.

### [INFO] 모듈-레벨 부수효과 — 스냅샷 생성 및 메모리 상수 해결
- 위치: `code.handler.ts` lines 78, 133–145
- 상세: `ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb()` 와 `DAYJS_SNAPSHOT` 는 모듈 임포트 시점에 동기적으로 평가된다. `DAYJS_SNAPSHOT` 의 경우 `createSnapshot()` 이 실패하면 `console.warn` 만 발행하고 `undefined` 로 fallback하는 방어적 설계이며, 주석에서 비용(~4ms, 일회성)을 명시하고 있어 의도적 트레이드오프임이 문서화되어 있다. 그러나 이 설계는 모듈 수준 side-effect 를 갖는 Singleton 패턴으로, DI 컨테이너나 테스트 환경에서 isolate 팩토리를 교체하는 것이 불가능하다. 테스트에서는 `resolveMemoryLimitMb()` 를 직접 export 하여 단위 테스트 가능성을 확보했지만, `DAYJS_SNAPSHOT` 자체는 테스트에서 제어할 수 없다.
- 제안: 현 설계는 성능 요구(per-exec dayjs 재컴파일 제거)와 복잡성 사이의 합리적 트레이드오프다. 다만 `DAYJS_SNAPSHOT` 생성 로직을 팩토리 함수로 export 하면 향후 테스트 픽스처에서 snapshot 재현 가능성이 높아진다. 현재는 INFO 수준.

### [INFO] 모듈-레벨 공유 상태 (`syntaxIsolate` lazy singleton)
- 위치: `code.handler.ts` lines 325–345
- 상세: `syntaxIsolate` 는 `let` 으로 선언된 모듈-스코프 mutable 변수로, `validate()` 호출 간에 공유된다. 주석에서 "JS is single-threaded so concurrent compiles serialize" 라고 설명하나, Node.js의 async I/O 환경에서 `compileScriptSync` 는 동기이므로 race condition 은 없다. 그러나 이는 전역 mutable 상태로, 모듈 간 격리가 요구되는 테스트 병렬 실행 환경(jest `--runInBand` 이 아닌 경우)에서 문제가 될 수 있다. OOM으로 disposed 된 경우 재생성 로직(`W4/INFO#3`)이 있어 회복성은 갖춰져 있다.
- 제안: `CodeHandler` 인스턴스 필드로 이동하면 인스턴스별 격리가 가능해진다. 현재 단일 핸들러 인스턴스만 등록되는 구조라면 동작상 동일하나, 테스트 격리성은 개선된다. 현재는 INFO 수준.

### [INFO] 에러 분류의 두 레이어 추상화
- 위치: `code.handler.ts` lines 354–405
- 상세: 내부 `CodeNodeInternalErrorCode` 타입과 `LEGACY_TO_NORMALIZED` 매핑 테이블의 이중 추상화 레이어는 설계 의도(exhaustive compile-time 검증 + 단일 매핑 테이블)가 명확히 문서화되어 있고, `ErrorCode` 공개 열거형과의 분리도 적절하다. `Record<CodeNodeInternalErrorCode, ErrorCodeValue>` 로 타입이 강제되어 신규 내부 코드 추가 시 컴파일 에러가 발생하는 exhaustive 패턴은 아키텍처적으로 좋은 실천이다.
- 제안: 현재 구조 유지. 다만 `CodeNodeInternalErrorCode` 의 "legacy" 명칭이 실제로는 현행 내부 코드임을 코드 주석이 설명하고 있어 혼란 소지가 있으나, 이는 명명 문제이지 아키텍처 문제가 아니다.

### [INFO] 레이어 책임 분리 — 설계 준수
- 위치: 파일 전체
- 상세: `code.handler.ts` 는 비즈니스(노드 실행) 레이어에 속하며, 데이터 레이어(`ExecutionContext.variables` 읽기/쓰기)와 인프라 레이어(isolated-vm API) 에 직접 접근한다. `NodeHandler` 인터페이스를 통한 추상화가 있어 엔진-핸들러 경계는 명확하다. `deepClone`, `hostHash`, `hostB64Encode`, `hostB64Decode` 같은 순수 함수들은 private 범위에 적절히 위치해 있다.
- 제안: 현재 레이어 책임 분리는 `NodeHandler` 인터페이스 기반 설계로 적절히 구현되어 있다.

### [INFO] 확장성 — 언어/런타임 지원 추가 시 OCP 고려
- 위치: `CodeHandler.execute()` 및 `_buildIsolateContext()`
- 상세: 현재 `language` 설정 필드가 존재하나 `z.enum(['javascript'])` 로 제한되어 있다. 향후 Python/TypeScript 등 추가 시 `CodeHandler` 내부에 언어별 분기 로직이 추가될 위험이 있다. `_buildIsolateContext` 는 isolated-vm 에 강하게 결합되어 있어 다른 런타임(예: Pyodide, WASM)으로 교체하려면 핸들러 내부 대규모 수정이 필요하다.
- 제안: 언어 지원 확장 계획이 있다면 `LanguageRuntime` 인터페이스(컨텍스트 빌드 + 실행 + 결과 파싱)를 정의하고 `JavaScriptIsolateRuntime` 구현체를 분리하는 전략 패턴 적용을 장기 로드맵으로 고려한다.

## 요약

`code.handler.ts` 는 `NodeHandler` 인터페이스를 통한 명확한 계약 기반 설계를 따르며, 에러 코드 매핑의 exhaustive type-safety, 이중 타임아웃(isolate CPU + 호스트 wall-clock) 방어, dayjs 스냅샷 최적화 등 여러 아키텍처적 의사결정이 주석과 명세 참조로 잘 문서화되어 있다. 가장 주목할 아키텍처 위험은 `CodeHandler` 가 VM 샌드박스 인프라(isolate 생명주기)와 노드 핸들러 비즈니스 로직을 단일 클래스에 통합한 SRP 경계 문제로, 현재 JavaScript 단일 언어 지원 하에서는 수용 가능하나 향후 다른 런타임 지원 확장 시 OCP 위반으로 발전할 수 있다. 모듈-레벨 mutable singleton(`syntaxIsolate`) 과 module-load-time side-effect(`DAYJS_SNAPSHOT`)는 테스트 격리성에 잠재적 영향을 주나, 현재 설계 의도가 명시적으로 문서화되어 있고 단위 테스트 가능성을 위한 export 전략도 갖추고 있어 즉각적 수정이 필요한 수준은 아니다.

## 위험도

LOW
