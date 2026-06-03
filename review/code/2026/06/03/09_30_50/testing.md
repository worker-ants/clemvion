# Testing Review — code-node sandbox API 갭 보강

## 발견사항

### **[INFO]** $helpers.crypto.hash — 지원 알고리즘 실패 케이스 미검증
- 위치: `code.handler.spec.ts` — `execute — $helpers` describe 블록
- 상세: `$helpers.crypto.hash`는 `createHash(algorithm)`에 임의 문자열을 그대로 전달한다. 유효하지 않은 알고리즘(예: `"md9"`)을 전달하면 Node.js `crypto` 모듈이 `Error: Unknown message digest` 예외를 던지는데, 이 예외가 sandbox 실행 경로에서 어떻게 처리되는지(error 포트로 라우팅되는지, `CODE_EXECUTION_FAILED`로 정규화되는지) 검증하는 테스트가 없다.
- 제안: 아래 케이스를 `$helpers` describe 블록에 추가한다.
  ```ts
  it('should route to error port when crypto.hash receives an unknown algorithm', async () => {
    const result = await handler.execute(null, { code: 'return $helpers.crypto.hash("md9", "x");' }, context);
    expect((result as any).port).toBe('error');
    expect((result as any).output.error.code).toBe('CODE_EXECUTION_FAILED');
  });
  ```

### **[INFO]** $helpers.base64.decode — 잘못된 Base64 입력 처리 미검증
- 위치: `code.handler.spec.ts` — `$helpers.base64` 테스트
- 상세: `Buffer.from(data, 'base64').toString('utf-8')`는 잘못된 Base64 문자열을 받아도 예외를 던지지 않고 빈 문자열이나 부분 결과를 반환한다. 이 silent-failure 동작이 계약상 허용된 것인지 검증하는 테스트가 없어, 향후 구현이 변경될 때 회귀를 탐지하지 못한다.
- 제안: 유효하지 않은 Base64 입력(`"not-base64!!"`)에 대한 `decode` 동작을 명시하는 테스트를 추가한다.

### **[INFO]** $helpers.date — invalid date 처리 미검증
- 위치: `code.handler.spec.ts` — `$helpers.date` 테스트
- 상세: `dayjs("not-a-date")`는 예외를 던지지 않고 `isValid() === false`인 dayjs 객체를 반환한다. 이 객체의 `.format()`은 `"Invalid Date"` 문자열을 반환한다. 이 동작이 sandbox 사용자에게 명시적으로 계약된 것인지 검증 테스트가 없다.
- 제안: `$helpers.date("invalid")` 시 `d.isValid()` 가 `false` 임을 확인하는 테스트를 추가한다.

### **[INFO]** $node 테스트 — context 공유로 인한 상태 오염 가능성
- 위치: `code.handler.spec.ts` L71-79 (`should expose $node with empty-string fallbacks`)
- 상세: 이 테스트는 `beforeEach`가 `nodeId`/`nodeLabel`을 설정하지 않는다는 전제에 의존한다. 현재는 `beforeEach`가 이 필드를 설정하지 않으므로 정상 통과하지만, `beforeEach`에 이 필드가 추가될 경우 테스트가 조용히 다른 동작을 검증하게 된다. 테스트 내부에서 명시적으로 `delete (context as any).nodeId`를 호출하거나 주석으로 의도를 명확히 하면 더 안전하다.
- 제안: 테스트 내부에서 `context`에 `nodeId`/`nodeLabel`이 없음을 단언하는 guard 문 또는 명시적 제거 코드를 추가한다.

### **[INFO]** timeout 경계값 테스트 — `DEFAULT_TIMEOUT_SEC` 상수 미노출로 인한 매직 넘버 의존
- 위치: `code.schema.spec.ts` L67 (default 30 테스트)
- 상세: 스키마 테스트에서 `30`이라는 값을 하드코딩한다. `DEFAULT_TIMEOUT_SEC`가 `code.handler.ts` 내 모듈-비공개 상수이고 `codeNodeConfigSchema.shape.timeout._def.defaultValue()`로 확인 가능하지만, 스키마와 핸들러 상수가 독립적으로 변경될 경우 불일치를 포착하는 테스트가 없다.
- 제안: 기존 테스트 범위로 충분하지만, 가능하다면 `codeNodeConfigSchema` 에서 파생되는 default 값과 핸들러가 실제 사용하는 `DEFAULT_TIMEOUT_SEC` 간 일치 여부를 검증하는 통합 테스트를 추가하는 것이 이상적이다.

### **[INFO]** `buildHelpers`가 매 실행마다 새 객체 생성 — 성능 관련 테스트 부재
- 위치: `code.handler.ts` L728 `buildHelpers()`
- 상세: `buildHelpers()`가 `buildSandbox()` 호출마다 새 클로저 객체를 생성한다. 단위 테스트 범위 밖이지만, 고빈도 실행 시나리오에서 GC 압력을 유발할 수 있다. 현재 테스트 스위트에는 이 패턴에 대한 성능 회귀 테스트가 없다. 이 정도 규모에서는 허용 가능하나, 모듈 레벨 싱글톤으로 분리할 것을 고려할 수 있다.
- 제안: 현재 단계에서는 필수 아님. 추후 성능 프로파일링 시 고려.

### **[WARNING]** `$helpers` sandbox 내 host realm 참조 — 보안 격리 테스트 부재
- 위치: `code.handler.ts` `buildHelpers()` + `code.handler.spec.ts`
- 상세: `$helpers` 함수들은 host realm 클로저이므로 `Buffer`, `node:crypto`, `dayjs`에 접근한다. 이는 의도된 설계이지만, sandbox 코드가 `$helpers.date` 반환값(dayjs 객체)을 통해 host realm 프로토타입 체인에 접근하거나 `$helpers` 객체 자체를 변이할 가능성이 있다. 구체적으로:
  1. `$helpers.date("x").constructor` → dayjs 생성자 노출 여부
  2. `Object.assign($helpers.crypto, { uuid: () => "hacked" })` → $helpers 변이 후 재사용 여부 (현재 매 실행마다 새로 생성되므로 실질적 위험은 낮지만, 단일 실행 내 변이는 가능)
- 제안: 아래 케이스를 `execute — security restrictions` describe에 추가한다.
  ```ts
  it('should not expose dayjs constructor via $helpers.date return value', async () => {
    const result = await handler.execute(null, { code: 'const d = $helpers.date("2020-01-01"); return typeof d.constructor;' }, context);
    // dayjs 생성자가 sandbox에서 함수로 노출되지 않아야 하거나, 노출되더라도 host 객체 탐색에 사용될 수 없어야 함
    // 최소한 성공 경로임을 확인하고 반환 타입을 문서화
    expect((result as any).port).toBeDefined();
  });
  ```

### **[INFO]** `$helpers.crypto.hash` — `data` 파라미터 타입 경계 미검증
- 위치: `code.handler.spec.ts` — `$helpers.crypto.hash` 테스트
- 상세: `hash(algorithm, data)`의 `data`가 `string` 타입으로 선언되어 있으나, sandbox 내에서 숫자나 객체를 전달했을 때의 동작(TypeScript 타입 가드 없음, runtime은 `.update()` 호출)이 검증되지 않는다.
- 제안: `$helpers.crypto.hash("sha256", 42)` 등 비문자열 입력에 대한 동작을 명세하는 테스트를 추가한다.

## 요약

전반적으로 테스트 품질이 우수하다. 새로 추가된 `$node`(spec §2.1)와 `$helpers`(spec §2.2) 기능 모두 happy-path 테스트와 fallback 케이스가 작성되어 있으며, 기존 security restriction, timeout, $vars atomic replace 테스트와의 구조적 일관성도 유지되고 있다. 커버리지 갭은 주로 `$helpers` 함수의 error-path(잘못된 알고리즘, 유효하지 않은 입력)와 host realm 보안 격리 경계 검증에 집중되어 있다. `buildHelpers()`의 host-realm 클로저 설계는 sandbox 내 dangerous global 차단 정책과 의도적으로 분리된 것으로 이해되나, dayjs 반환 객체를 통한 host prototype 접근 가능성에 대한 보안 테스트 추가가 권고된다.

## 위험도

LOW
