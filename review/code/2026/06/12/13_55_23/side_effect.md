## 발견사항

### [WARNING] 모듈 로드 시점 동기 부작용 — `ISOLATE_MEMORY_LIMIT_MB`·`DAYJS_SNAPSHOT` 전역 상태 초기화
- 위치: 라인 78, 133–145
- 상세: `resolveMemoryLimitMb()`가 모듈 임포트 시점에 즉시 호출되어(`const ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb()`) 결과를 프로세스-수명 전역 상수에 고정한다. 같은 패턴으로 `DAYJS_SNAPSHOT` IIFE도 모듈 로드 시 synchronous하게 V8 Isolate를 생성·직렬화한다. 두 값 모두 이후 `process.env.CODE_NODE_MEMORY_LIMIT_MB`를 바꿔도 반영되지 않는다. 테스트에서 env 값을 변경한 뒤 모듈을 다시 import하지 않으면 다른 값을 기대하는 테스트들이 서로 오염될 수 있다.
- 제안: 현재 동작이 의도된 설계(spec §7.2 "operator-tunable via env at process start")와 일치한다면 주석에 "프로세스 재시작 없이는 변경 불가"를 명시하고 단위 테스트 격리 주의사항을 추가한다. 런타임 재설정이 필요한 경우 `resolveMemoryLimitMb()`를 execute() 진입 시점에 호출하도록 변경한다.

### [WARNING] `syntaxIsolate` 모듈-수준 가변 전역 변수
- 위치: 라인 325–345
- 상세: `let syntaxIsolate: ivm.Isolate | undefined`는 모듈 수명 동안 유지되는 공유 가변 상태다. JS 단일 스레드 특성 덕분에 동시 기록 레이스는 없으나, 프로세스에서 `code.handler.ts` 모듈을 임포트한 모든 컨텍스트(예: 서버 인스턴스가 여러 파일에서 동일 모듈을 참조하는 경우)가 동일 isolate 인스턴스를 공유한다. OOM 후 재생성 로직(`if (!syntaxIsolate || syntaxIsolate.isDisposed)`)은 있으나, 정상 처리 흐름에서 isolate가 영구 보유되는 구조이므로 프로세스 메모리 기준선이 올라간다.
- 제안: 이 설계가 의도된 것이라면 주석에 "싱글톤 — 프로세스 전역 compile 전용 isolate" 라고 명시하고, 메모리 한도(현재 8 MB)가 충분한지 문서화한다.

### [INFO] `context.variables` 직접 변형 (공유 상태 기록)
- 위치: 라인 478–491
- 상세: `execute()`는 성공 시 `context.variables = (await ctx.global.get('$vars', { copy: true })) ?? {}`로 호출자가 전달한 ExecutionContext의 `variables` 필드를 직접 교체한다. 실패(copy-out 실패) 시에는 `varsClone`으로 복원한다. 이는 `ExecutionContext`가 엔진에서 execution 전반에 걸쳐 공유 참조로 전달된다는 사실을 전제로 한다. 엔진이 이 mutation을 기대하고 있다면 의도된 동작이지만, 인터페이스 문서에는 핸들러가 `variables`를 변형해도 된다는 명시가 없어 계약 위반처럼 읽힌다.
- 제안: `NodeHandler.execute()` 문서 또는 `ExecutionContext.variables` 필드 JSDoc에 "Code 노드처럼 $vars 동기화가 필요한 핸들러는 직접 `context.variables`를 교체할 수 있다"고 명시하여 의도를 문서화한다.

### [INFO] `DAYJS_SNAPSHOT` ArrayBuffer — 프로세스 수명 GC 불가 메모리
- 위치: 라인 133–145 (주석 포함)
- 상세: 주석에 "The snapshot ArrayBuffer lives for the lifetime of the Node.js process; it is not GC'd between requests"라고 스스로 문서화하고 있다. 이 자체는 의도된 트레이드오프이나, 생성 실패 시(`catch` 경로) `console.warn`만 출력하고 `undefined`로 폴백한다. 실패의 원인(예: 플랫폼에서 `createSnapshot` 미지원)이 로그 외에 관측되지 않으므로, 모니터링 없이 fallback 경로로 조용히 전환될 수 있다.
- 제안: 필요하다면 구조화 로그(structured log with error code)로 교체하거나 헬스체크 엔드포인트에서 snapshot 생성 여부를 노출하는 방안을 고려한다.

### [INFO] `readFileSync` 모듈 로드 시 동기 파일시스템 호출
- 위치: 라인 95–98
- 상세: `readFileSync(require.resolve('dayjs/dayjs.min.js'), 'utf-8')`가 모듈 임포트 시 동기적으로 실행된다. 파일이 없거나 권한 문제가 있으면 모듈 임포트 자체가 throw되어 서버 시작이 실패한다.
- 제안: 의도된 fail-fast이므로 별도 조치 불필요하나, 에러 메시지가 `require.resolve`의 원시 스택이기 때문에 운영자가 원인을 파악하기 어렵다. 필요하다면 try-catch로 감싸 "dayjs UMD 파일을 찾을 수 없습니다. `npm install dayjs`를 실행하세요" 같은 명확한 메시지를 제공한다.

### [INFO] `process.env.NODE_ENV` 런타임 읽기 — `failure()` 내 조건 분기
- 위치: 라인 664
- 상세: `const exposeStack = process.env.NODE_ENV !== 'production'`이 `failure()` 호출마다 실행된다. 모듈 로드 시 상수로 고정하지 않으므로 런타임 env 변경에 반응하지만, Node.js에서 `NODE_ENV`를 런타임 변경하는 패턴은 드물며 일관성을 해칠 수 있다. 현재 코드에서 부작용은 없으나 테스트에서 `process.env.NODE_ENV`를 `'production'`으로 변경한 뒤 되돌리지 않으면 이후 테스트에 영향을 줄 수 있다.
- 제안: 모듈 상단에 `const IS_PRODUCTION = process.env.NODE_ENV === 'production'` 상수로 고정하거나, 현재대로 유지하되 테스트 픽스처에서 반드시 restore하도록 주석으로 안내한다.

---

## 요약

`code.handler.ts`의 부작용은 대부분 설계 문서에 명시된 의도된 트레이드오프다. 주요 위험은 두 가지다: (1) `ISOLATE_MEMORY_LIMIT_MB`와 `DAYJS_SNAPSHOT`이 모듈 로드 시점에 고정되어 env 변경에 반응하지 않고, 테스트 격리가 어렵다. (2) `context.variables`를 핸들러가 직접 교체하는 패턴이 `ExecutionContext` 인터페이스 계약에 명시되어 있지 않아 의도를 외부에서 파악하기 어렵다. `syntaxIsolate` 모듈-전역 변수는 단일 프로세스 내에서만 공유되므로 실제 레이스 위험은 없으나, 명시적 문서화가 필요하다. 네트워크 호출, 이벤트 발생, 파일시스템 기록 등의 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
