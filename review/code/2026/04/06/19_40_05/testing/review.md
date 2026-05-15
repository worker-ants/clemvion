## 테스팅 코드 리뷰

### 발견사항

---

- **[CRITICAL]** 프로토타입 순회 방어 테스트가 false negative — 취약점을 실제로 검증하지 않음
  - 위치: `switch.handler.spec.ts:257–268`, `nested-value.util.ts:9–19`
  - 상세: `should not traverse prototype properties` 테스트는 `switchValue: '__proto__.constructor'`, `value: 'Function'`(string)을 조합한다. 그런데 `getNestedValue`는 실제로 `__proto__` 접근을 막지 않으며 `{}['__proto__']['constructor']`는 `Function` 생성자 객체를 반환한다. 테스트가 `default`로 routing되는 이유는 프로토타입 방어가 아니라 `Function !== 'Function'` 의 strict equality 타입 불일치 때문이다. **구현체에 취약점이 존재하지만 테스트는 이를 감지하지 못한다.** 예를 들어 `cases: [{ id: 'match', value: Object.prototype }]` 조합이라면 `case-1`이 매칭될 것이다.
  - 제안:
    ```ts
    it('should not traverse __proto__ in path lookup', async () => {
      // getNestedValue({}, '__proto__') returns Object.prototype if unguarded
      const proto = Object.getPrototypeOf({});
      const result = await handler.execute(
        {},
        {
          switchValue: '__proto__',
          cases: [{ id: 'match', value: proto }],
          hasDefault: true,
        },
        context,
      );
      // Should be 'default', not 'match'
      expect(result).toEqual({ port: 'default', data: {} });
    });
    ```
    그리고 `getNestedValue`에서 위험 키(`__proto__`, `constructor`, `prototype`) 접근을 차단하는 방어 로직 추가 필요:
    ```ts
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key)) return undefined;
      ...
    }
    ```

---

- **[WARNING]** `getNestedValue` 유틸리티에 독립 단위 테스트 없음
  - 위치: `nested-value.util.ts` 전체, `setNestedValue` 포함
  - 상세: `getNestedValue`는 switch handler의 핵심 경로 탐색 로직을 담당하고, `setNestedValue`도 export된 함수다. 두 함수 모두 `nested-value.util.spec.ts`가 존재하지 않아 독립 단위 테스트가 없다. null 중간 경로, 빈 문자열 경로, 숫자 키(`arr.0`) 등의 경계 케이스가 `switch.handler.spec.ts`를 통해 간접적으로만 검증된다.
  - 제안: `nested-value.util.spec.ts` 파일 생성 후 `getNestedValue` / `setNestedValue` 각각에 대한 단위 테스트 작성

---

- **[WARNING]** 에러 메시지에 사용자 입력값이 포함됨 — 정보 노출 미검증
  - 위치: `switch.handler.ts:77`, `switch.handler.spec.ts:173–185`
  - 상세: 구현체에서 `No matching case found for value "${String(actualValue)}" and no default case configured`로 실제 값을 에러 메시지에 삽입한다. `should throw when no case matches and no default` 테스트는 `rejects.toThrow('No matching case found')`로 부분 문자열만 검증하여 메시지 포맷 변경 시 회귀를 감지하지 못한다. 보안 관점에서 `actualValue`가 민감 데이터일 경우 에러 로그를 통한 정보 노출(OWASP A05) 가능성이 있다.
  - 제안: 에러 메시지 전체 패턴 검증 또는 민감 정보 미포함 검증 추가:
    ```ts
    await expect(...).rejects.toThrow(
      /No matching case found for value ".+" and no default case configured/
    );
    ```

---

- **[WARNING]** `validate`에서 중복 case id 허용 여부가 구현·테스트 모두 미정의
  - 위치: `switch.handler.ts:33–38`, `switch.handler.spec.ts` validate 블록
  - 상세: 현재 `validate` 구현은 중복 `id`를 검사하지 않는다. `execute`에서 `cases.find(c => c.value === actualValue)`를 사용하므로 동일 `id` 중복 시 첫 번째가 선택되지만, 이 동작이 스펙으로 명시되지 않았다. `should match first case when duplicate values exist`는 동일 `value` 중복은 검증하지만 동일 `id` 중복은 검증하지 않는다.
  - 제안:
    ```ts
    it('should return invalid when cases have duplicate ids', () => {
      const result = handler.validate({
        switchValue: 'field',
        cases: [
          { id: 'same-id', value: 'a' },
          { id: 'same-id', value: 'b' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('duplicate case id: same-id');
    });
    ```
    또는 validate에서 중복 id를 허용한다면 그 정책을 테스트로 명시

---

- **[INFO]** `_context` 미사용을 테스트로 명시하지 않음
  - 위치: `switch.handler.ts:56`, `switch.handler.spec.ts` execute 블록 전체
  - 상세: 구현체에서 `_context`에 underscore prefix로 미사용을 선언했다. 테스트에서도 context가 결과에 영향을 주지 않음을 단 한 번도 명시적으로 검증하지 않는다. context 관련 구현이 추가될 경우 기존 테스트가 silent하게 실패할 수 있다.
  - 제안: 동일 입력에 대해 context가 달라도 결과가 동일한지 검증하는 케이스 하나 추가 (선택적)

---

- **[INFO]** `switchValue: 0`, `switchValue: false` 등 falsy 비문자열 경로 분기 미검증
  - 위치: `switch.handler.ts:61–64`, execute 블록
  - 상세: `typeof switchValue === 'string'` 분기로 string이면 path lookup, 비문자열이면 직접 사용한다. `0`, `false`, `null`은 비문자열이므로 직접 사용되는데, 특히 `switchValue: 0`이 `value: 0` 케이스에 매칭되는지 확인하는 테스트가 없다. `boolean` 케이스는 검증되어 있으나 `number: 0` (falsy)는 누락.
  - 제안:
    ```ts
    it('should match case with switchValue of 0 (falsy number)', async () => {
      const result = await handler.execute(
        {},
        { switchValue: 0, cases: [{ id: 'zero', value: 0 }], hasDefault: true },
        context,
      );
      expect(result).toEqual({ port: 'zero', data: {} });
    });
    ```

---

### 요약

테스트 스펙은 전반적으로 핵심 실행 경로를 잘 커버하며, 리뷰에서 지적된 WARNING 항목(빈 cases, null 중간 경로, hasDefault 생략, 타입 coercion 정책, 중복 value)을 대부분 해소했다. 그러나 가장 심각한 문제는 **프로토타입 순회 방어 테스트가 false negative**라는 점이다 — `getNestedValue`는 실제로 `__proto__` 접근을 허용하며 테스트는 우연한 타입 불일치로 통과될 뿐 취약점을 검증하지 못한다. 또한 `getNestedValue` / `setNestedValue` 유틸리티에 독립 단위 테스트가 없어 핵심 경로 탐색 로직의 회귀 보호가 취약하다. 이 두 항목은 반드시 보완이 필요하다.

### 위험도

**MEDIUM** — 프로토타입 오염 취약점이 실제로 존재할 수 있음에도 테스트가 이를 통과시키는 구조적 문제