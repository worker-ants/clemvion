# Testing Review

## 발견사항

### **[INFO]** `output.error.details` 필드 어설션 부재
- 위치: `code.handler.spec.ts` — `execute — basic` / `execute — timeouts` / `execute — memory limit` 섹션 전반
- 상세: `failure()` 메서드는 `output.error.details.legacyCode` 와 (non-production 환경에서) `output.error.details.stack` 을 반환한다. 그러나 spec 파일 어디에도 `output.error.details` 객체 자체를 어설션하는 테스트가 없다. `legacyCode` 가 올바른 내부 코드(`EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED`, `CODE_RUNTIME_ERROR`)로 채워지는지, 그리고 `stack` 이 non-production 에서만 포함되는지 검증되지 않는다.
- 제안:
  ```ts
  // error path 테스트에 추가
  expect(result.output.error.details).toMatchObject({ legacyCode: 'CODE_RUNTIME_ERROR' });
  // NODE_ENV=production 환경에서 stack 이 없음을 검증
  ```

### **[INFO]** `rawConfig` (context.rawConfig) 분기 미검증
- 위치: `code.handler.ts` 라인 377 (`const rawConfigForEcho = context.rawConfig ?? config`)
- 상세: `context.rawConfig` 가 설정된 경우 config echo 가 `context.rawConfig` 에서 나와야 한다. 현재 모든 spec 테스트는 `context.rawConfig` 를 세팅하지 않아서 항상 fallback(`config`) 경로만 실행된다. `rawConfig` 에 다른 값이 있을 때 `config` echo 가 `rawConfig` 를 우선하는지 검증하지 않는다.
- 제안:
  ```ts
  it('should echo rawConfig fields when context.rawConfig is set', async () => {
    context.rawConfig = { code: 'return 1;', language: 'javascript', timeout: 60 };
    const result = await handler.execute(null, { code: 'return 2;' }, context);
    expect((result as any).config.code).toBe('return 1;');
  });
  ```

### **[INFO]** config echo 에서 `timeout` 필드 어설션 부재
- 위치: `code.handler.spec.ts` 라인 204–237 (`execute — basic` config echo 테스트)
- 상세: `result.config.language` 와 `result.config.code` 는 어설션되지만 `result.config.timeout` 은 검증되지 않는다. `failure()` 와 success path 모두 `timeout` 을 config echo 에 포함하므로 그 값이 올바르게 전달되는지 확인이 필요하다.
- 제안: 기존 config echo 테스트에 `expect(result.config.timeout).toBe(30)` 추가.

### **[INFO]** `exposeStack` 분기 (NODE_ENV=production) 미검증
- 위치: `code.handler.ts` 라인 553–567
- 상세: `process.env.NODE_ENV !== 'production'` 조건에 따라 `output.error.details.stack` 포함 여부가 결정된다. 테스트 환경(`NODE_ENV=test`)에서는 항상 stack 이 포함되는 경로만 실행되고, production 경로(stack 제거)는 커버되지 않는다.
- 제안: `process.env.NODE_ENV = 'production'` 을 임시로 설정하고 `output.error.details.stack` 이 없음을 검증하는 테스트 추가. `afterEach` 에서 restore.

### **[INFO]** `deepClone` 의 null/undefined 입력 경계값 미검증
- 위치: `code.handler.ts` 라인 113–116 (`deepClone` 함수)
- 상세: `deepClone(undefined)` 와 `deepClone(null)` 은 early-return 경로가 있으나 직접 단위 테스트가 없다. 대신 `execute()` 통합 경로에서 `context.variables = {}` 로 간접 검증된다. 함수가 `export` 되지 않아 직접 단위 테스트는 어렵지만, `context.variables = undefined as any` 를 전달하는 통합 케이스로 커버할 수 있다.
- 제안: 현재 코드 구조상 내보내기 없이 통합 검증이 현실적이므로 낮은 우선순위이나, 추후 export 시 단위 테스트 추가 권장.

### **[INFO]** `$helpers.crypto.hash` 의 나머지 허용 알고리즘 미검증
- 위치: `code.handler.spec.ts` — `execute — $helpers` 섹션
- 상세: `ALLOWED_HASH_ALGORITHMS` 는 `sha256`, `sha384`, `sha512`, `sha1`, `md5` 5개를 허용한다. 테스트는 `sha256` 만 검증하며 나머지 4개(sha1, md5, sha384, sha512)는 실제 동작을 확인하지 않는다. 알고리즘이 allowlist 에서 제거되거나 이름이 바뀌면 테스트가 이를 잡지 못한다.
- 제안: `it.each` 로 나머지 허용 알고리즘도 성공 경로 검증 추가.

### **[INFO]** 삭제 대상 전역 중 일부만 security 테스트에서 검증됨
- 위치: `code.handler.spec.ts` 라인 841–863 (`execute — security restrictions`)
- 상세: `BOOTSTRAP_SOURCE` 의 삭제 목록(`Symbol`, `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl`, `queueMicrotask`)은 security 테스트의 `it.each` 에 포함되어 있지 않다. `typeof undefined` 체크를 검증하는 snapshot 테스트(라인 738)가 일부를 커버하지만, 모든 삭제 대상 전역이 포함되지는 않는다.
- 제안: 라인 738 의 snapshot hardening 테스트에 `Symbol`, `WeakMap`, `Atomics`, `Intl` 등 추가 포함. 혹은 `it.each` 에 `['Symbol', 'return typeof Symbol;']` 형태로 추가.

### **[INFO]** `afterEach` 없는 `jest.isolateModules` + spy 잔여 여부
- 위치: `code.handler.spec.ts` 라인 1366–1416 (`execute — DAYJS_SNAPSHOT=undefined fallback path`)
- 상세: `jest.isolateModules` 내부에서 `jest.spyOn(ivmMod.Isolate, 'createSnapshot').mockImplementationOnce(...)` 를 사용한다. `mockImplementationOnce` 이므로 자동 해제되지만, `afterEach(() => jest.restoreAllMocks())` 훅이 없어 다른 spy 가 추가될 경우 정리가 보장되지 않는다. 현재는 단일 spy 만 사용하므로 실질적 위험은 낮지만 방어적 cleanup 부재.
- 제안: describe 블록에 `afterEach(() => jest.restoreAllMocks())` 추가.

### **[INFO]** 동시 실행(concurrency) 케이스 미검증
- 위치: `code.handler.spec.ts` 전체
- 상세: 핸들러의 핵심 설계 의도 중 하나는 "각 exec 가 독립적인 신규 isolate 를 사용"하여 동시 실행 안전성을 보장하는 것이다. 그러나 `Promise.all` 을 사용해 여러 execute() 를 동시에 실행하면서 출력 간 상태 누출이 없음을 검증하는 동시성 테스트가 없다. `module-level syntaxIsolate` 는 `JS is single-threaded so concurrent compiles serialize` 라는 주석이 있으나, 해당 속성을 검증하는 테스트도 없다.
- 제안 (낮은 우선순위): `Promise.all` 로 10개 이상의 execute() 를 동시에 실행하고, 각 결과가 독립적임을 확인하는 테스트 추가.

## 요약

`code.handler.spec.ts` 는 전반적으로 매우 잘 작성되어 있다. validate 전 경로, execute 기본 경로, 보안 제한, timeout, $vars 원자 교체, $helpers 전체 API, dayjs 스냅샷 경로, DAYJS_SNAPSHOT 미지원 fallback 경로, 메모리 제한, `classifyCodeNodeError` 단위 테스트가 모두 커버된다. 주요 갭은 `output.error.details` 필드(legacyCode/stack) 어설션 부재, `context.rawConfig` 분기 미검증, `config.timeout` echo 미검증, NODE_ENV=production 스택 제거 분기 미검증으로, 이들은 기능 회귀를 잡지 못할 수 있는 INFO 수준 누락이다. 보안·격리·타임아웃 등 핵심 계약은 충실히 검증되고 있다.

## 위험도

LOW
