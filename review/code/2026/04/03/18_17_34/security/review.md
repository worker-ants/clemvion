## 보안 코드 리뷰 결과

### 발견사항

---

**[CRITICAL] ReDoS (Regular Expression Denial of Service)**
- 위치: `filter.handler.ts`, `evaluateCondition` — `case 'regex':`
- 상세: 사용자 입력값(`compareValue`)을 직접 `new RegExp(String(compareValue))`에 전달하고 있음. 악성 패턴(예: `(a+)+`, `(a|a)*`)을 입력하면 CPU를 점유하는 catastrophic backtracking이 발생하여 서버 전체에 영향을 줄 수 있음. 이는 워크플로우 실행 엔진에서 특히 위험 — 공격자가 의도적으로 느린 정규식을 주입하여 DoS를 유발할 수 있음.
- 제안:
  ```typescript
  // 정규식 복잡도 제한 또는 타임아웃 처리
  // 옵션 1: 패턴 길이/문자 제한
  case 'regex':
    try {
      const pattern = String(compareValue);
      if (pattern.length > 100) return false; // 길이 제한
      // 위험 패턴 차단: 중첩 수량자 탐지
      if (/(\(.*\+.*\).*[\+\*])|(\(.*\|.*\).*[\+\*])/.test(pattern)) return false;
      return new RegExp(pattern).test(String(fieldValue));
    } catch {
      return false;
    }
  ```

---

**[WARNING] 에러 메시지 내 사용자 입력 노출**
- 위치: `filter.handler.ts:76` — `throw new Error(...)`
- 상세: `inputField` 값이 그대로 에러 메시지에 포함됨. 공격자가 임의 문자열을 inputField에 삽입할 경우 에러 로그/응답에 그대로 반영됨. 이 자체는 낮은 위험도이지만, 에러가 클라이언트에 직접 반환될 경우 정보 노출(OWASP A09) 문제로 발전할 수 있음.
- 제안: 에러 메시지에 사용자 입력을 포함할 때는 길이 제한 및 새니타이징 적용. 또는 고정 메시지만 사용.
  ```typescript
  throw new Error(`Filter inputField does not resolve to an array`);
  ```

---

**[WARNING] `is_type` operator의 타입 비교 안전성 문제**
- 위치: `filter.handler.ts` — `case 'is_type':`
- 상세: `typeof fieldValue === compareValue`에서 `compareValue`는 사용자가 제공하는 임의 문자열. `typeof` 결과와의 비교는 안전하지만, VALID_OPERATORS 검증을 통과한 후에도 `compareValue`에 대한 허용 타입 목록 검증이 없음. 예를 들어 `value: 'function'`을 입력하면 `typeof fieldValue === 'function'`이 실행됨. 함수 타입 필터링이 의도된 기능인지 불분명하며 잠재적 오용 가능성 존재.
- 제안:
  ```typescript
  case 'is_type': {
    const VALID_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'null', 'undefined'];
    if (!VALID_TYPES.includes(String(compareValue))) return false;
    if (compareValue === 'array') return Array.isArray(fieldValue);
    if (compareValue === 'null') return fieldValue === null || fieldValue === undefined;
    return typeof fieldValue === compareValue;
  }
  ```

---

**[WARNING] `not_contains` 연산자의 비대칭 동작**
- 위치: `filter.handler.ts` — `case 'not_contains':`
- 상세: `fieldValue` 또는 `compareValue`가 문자열이 아닐 경우 `contains`는 `false`를 반환하지만 `not_contains`는 `true`를 반환. 이 비대칭성은 예상치 못한 필터링 결과를 만들어 보안 정책(예: 특정 값을 제외하는 필터)을 우회할 수 있음.
- 제안: 타입 불일치 시 동일하게 `false` 반환 또는 명시적으로 문서화.
  ```typescript
  case 'not_contains':
    return typeof fieldValue === 'string' && typeof compareValue === 'string'
      ? !fieldValue.includes(compareValue)
      : false; // true 대신 false로 통일
  ```

---

**[INFO] `loose equality (==)` 사용**
- 위치: `filter.handler.ts` — `case 'eq':`, `case 'neq':`
- 상세: `strictComparison: false`(기본값)일 때 `==` 연산자 사용. 이는 의도적 설계이나, `null == undefined` (true), `0 == false` (true) 등의 암묵적 타입 변환이 예상치 못한 필터 통과를 허용할 수 있음. 특히 보안 관련 필터 조건(예: 권한 필드 비교)에서 위험.
- 제안: 기본값을 `strictComparison: true`로 변경하고 느슨한 비교가 필요한 경우에만 명시적으로 활성화 권장.

---

**[INFO] `getNestedValue`의 경로 탐색 안전성 미검증**
- 위치: `filter.handler.ts:77`, `evaluateCondition`
- 상세: `field` 값으로 `__proto__`, `constructor`, `prototype` 등의 프로토타입 체인 접근이 가능한 경로가 입력될 경우, `getNestedValue` 구현에 따라 Prototype Pollution 위험이 있음. `validate()`에서 `field` 경로에 대한 검증이 없음.
- 제안: `getNestedValue` 구현 확인 및 프로토타입 접근 방지 로직 추가. 또는 validate에서 경로 검증:
  ```typescript
  const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
  const pathParts = cond.field.split('.');
  if (pathParts.some(part => DANGEROUS_KEYS.includes(part))) {
    errors.push(`conditions[${i}].field contains forbidden path segment`);
  }
  ```

---

**[INFO] 테스트 코드 — 보안 경계 케이스 누락**
- 위치: `filter.handler.spec.ts`
- 상세: 다음 보안 관련 테스트가 없음:
  1. ReDoS 패턴에 대한 regex 동작 테스트
  2. `__proto__`, `constructor` 등 프로토타입 경로에 대한 field 접근 테스트
  3. 매우 긴 inputField 경로나 조건 배열에 대한 처리 테스트
  4. `is_type` operator에 `'function'`, `'symbol'` 등 비정상 타입 값 입력 테스트

---

### 요약

FilterHandler는 전반적으로 입력 검증 구조는 갖추고 있으나, **regex operator의 ReDoS 취약점**이 가장 심각한 문제임. 사용자가 임의의 정규식 패턴을 제공할 수 있는 구조에서 검증이나 타임아웃 없이 `new RegExp()`를 직접 실행하는 것은 DoS 공격 벡터로 직결됨. 추가로 `not_contains`의 비대칭 동작, `is_type`의 허용 타입 미검증, `getNestedValue`에서의 잠재적 Prototype Pollution 가능성도 보완이 필요함. 기본값인 loose equality(`==`)는 보안 필터 용도로 사용 시 예상치 못한 동작을 유발할 수 있으므로 기본값 변경을 권장함.

### 위험도

**HIGH** (ReDoS로 인한 DoS 가능성으로 인해)