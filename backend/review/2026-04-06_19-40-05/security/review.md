### 발견사항

- **[WARNING]** 에러 메시지에 사용자 입력값 직접 포함 (OWASP A05: Security Misconfiguration / Information Exposure)
  - 위치: `switch.handler.ts:77`
  - 상세: `throw new Error(\`No matching case found for value "${String(actualValue)}" and no default case configured\`)` — `actualValue`가 민감 데이터(비밀번호, 토큰, 개인정보 등)일 경우 에러 메시지를 통해 외부로 노출됨. 로그, 모니터링 시스템, 클라이언트 응답에서 해당 값이 유출될 수 있음.
  - 제안: 에러 메시지에서 실제 값 제거 → `throw new Error('No matching case found and no default case configured')`

- **[WARNING]** `getNestedValue`가 `__proto__` 등 프로토타입 키를 차단하지 않음
  - 위치: `nested-value.util.ts:16`, `switch.handler.ts:63`
  - 상세: `(current as Record<string, unknown>)[key]` 접근 시 `key`가 `__proto__`, `constructor`, `prototype`이어도 실제로 프로토타입 체인을 탐색함. 예: `getNestedValue({}, '__proto__')` → `Object.prototype` 반환. 테스트의 `should not traverse prototype properties`는 통과하지만 이는 `Object.prototype.constructor`가 문자열 `'Function'`과 `===` 불일치하기 때문이며, 프로토타입 접근 자체를 차단하지는 않음. 공격자가 케이스 값을 내부 prototype 객체와 일치하도록 설계하거나, 에러 메시지를 통해 내부 값을 추출할 수 있음.
  - 제안:
    ```ts
    const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    for (const key of keys) {
      if (BLOCKED_KEYS.has(key)) return undefined;
      // ...
    }
    ```

- **[WARNING]** `setNestedValue`에서 프로토타입 오염(Prototype Pollution) 가능
  - 위치: `nested-value.util.ts:22-43`
  - 상세: `setNestedValue(obj, '__proto__.polluted', true)` 호출 시 `Object.prototype.polluted = true`로 전역 오염이 발생함. 현재 `switch.handler.ts`에서 직접 사용되지 않으나, 동일 파일에 export되어 있어 다른 핸들러에서 오염된 경로를 통해 호출될 경우 RCE/DoS로 이어질 수 있는 고위험 패턴임.
  - 제안: `getNestedValue`와 동일하게 blocked keys 체크 추가

- **[INFO]** `cases` 배열 크기 제한 없음 — 애플리케이션 레벨 DoS
  - 위치: `switch.handler.ts:30`, `validate` 메서드
  - 상세: `cases` 배열에 수만 개의 항목을 전달해도 검증 통과. `O(n)` 선형 탐색(`Array.find`)과 결합하면 CPU 집중적 공격이 가능함.
  - 제안: `validate`에서 최대 케이스 수 제한 추가 (예: 100개)

- **[INFO]** 런타임에만 수행되는 config 타입 검증 — 컴파일 타임 보호 미흡
  - 위치: `switch.handler.ts:21`, `execute` 메서드 58행
  - 상세: `validate()`를 호출하지 않고 `execute()`를 직접 호출해도 잘못된 config가 그대로 사용됨. `execute()` 내부에는 별도 타입 검증이 없음.
  - 제안: `execute()` 진입 시 필수 필드 존재 여부를 assert하거나, 런타임 타입 가드 추가

---

### 요약

`switch.handler.ts`와 `nested-value.util.ts`에는 두 가지 실질적 보안 취약점이 존재한다. 첫째, 에러 메시지에 `actualValue`가 직접 포함되어 민감 데이터가 로그/클라이언트로 노출될 수 있다(OWASP A05). 둘째, `getNestedValue`가 `__proto__`, `constructor` 등의 키를 차단하지 않아 프로토타입 체인 탐색이 허용되며, `setNestedValue`는 실제 프로토타입 오염이 가능한 구현을 갖고 있다. 테스트의 `should not traverse prototype properties` 케이스는 값 불일치로 우연히 통과하므로 실제 방어 효과를 보장하지 않는다. `cases` 배열 크기 제한 부재도 DoS 위험 요소로 존재한다. 전반적 위험도는 프로토타입 오염 이슈를 감안하면 **MEDIUM**으로 평가한다.

### 위험도
**MEDIUM**