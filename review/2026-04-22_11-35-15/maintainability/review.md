## 발견사항

### [WARNING] `stripControlFields`의 폐기 변수 처리 방식이 비관용적
- **위치**: `execution-engine.service.ts`, `stripControlFields` 메서드
- **상세**: `void _sp; void _p; void _st; void _rs;`는 구조 분해 후 미사용 변수 경고를 억제하기 위한 관용구이나, TypeScript에서는 비표준적이며 다음 코드를 읽는 개발자에게 낯설다.
- **제안**: `Object.entries`/`Object.fromEntries` 필터링 또는 명시적 `delete` 접근이 더 읽기 쉽다.
  ```typescript
  private stripControlFields(output: unknown): unknown {
    if (!output || typeof output !== 'object' || Array.isArray(output)) return output;
    const CONTROL_KEYS = new Set(['_selectedPort', 'port', 'status', '_resumeState']);
    const o = output as Record<string, unknown>;
    if (!Object.keys(o).some((k) => CONTROL_KEYS.has(k))) return output;
    return Object.fromEntries(Object.entries(o).filter(([k]) => !CONTROL_KEYS.has(k)));
  }
  ```

---

### [WARNING] `IfElseHandler.validate`가 `strictComparison` 유효성을 검사하지 않음
- **위치**: `if-else.handler.ts`, `validate()` 메서드
- **상세**: `SwitchHandler.validate`는 `strictComparison`이 boolean인지 검증하지만 (`'strictComparison must be a boolean'`), `IfElseHandler.validate`는 동일한 필드를 받으면서 타입 검사를 하지 않는다. 같은 `evaluateCondition`을 공유하는 두 핸들러 간 유효성 검사 계약이 불일치한다.
- **제안**: `IfElseHandler.validate`에 동일한 boolean 체크 추가.

---

### [WARNING] `VALID_OPERATORS`가 `ConditionOperator` 타입과 수동 동기화 필요
- **위치**: `if-else.handler.ts`, `VALID_OPERATORS` 배열
- **상세**: `ConditionOperator` union 타입(condition-evaluator.util.ts)에 새 연산자가 추가될 경우 `if-else.handler.ts`의 `VALID_OPERATORS` 배열을 수동으로 업데이트해야 한다. 컴파일 타임에 이 불일치를 잡을 방법이 없다.
- **제안**: 타입으로부터 배열을 파생하거나 exhaustiveness 체크를 추가한다.
  ```typescript
  // condition-evaluator.util.ts에서 상수 배열을 export하고 타입을 파생
  export const CONDITION_OPERATORS = ['eq', 'neq', ...] as const;
  export type ConditionOperator = typeof CONDITION_OPERATORS[number];
  ```
  그러면 `VALID_OPERATORS = CONDITION_OPERATORS`로 단순화 가능.

---

### [WARNING] `SwitchHandler` meta 형태 변경이 하위 호환성 없이 적용됨
- **위치**: `switch.handler.ts`, `execute()` 반환 값
- **상세**: `meta.expression` 필드가 제거되고 `meta.mode`/`meta.matchedCase`로 대체됐다. 프론트엔드나 다른 노드가 `meta.expression`을 읽는다면 조용히 `undefined`를 받게 된다.
- **제안**: 변경 자체는 올바른 방향이지만, meta를 소비하는 코드가 있다면 검색이 필요하다(`grep -r "meta\.expression"`).

---

### [INFO] `matchByValue`의 `==` 사용에 의도 주석 없음
- **위치**: `switch.handler.ts`, `matchByValue()` 메서드
- **상세**: `return caseValue == switchValue;`의 느슨한 비교(`==`)는 의도적이고 테스트로 검증됐으나, TypeScript 코드베이스에서 `==`를 보면 ESLint 위반 또는 실수로 오해하기 쉽다.
- **제안**: 한 줄 주석 추가: `// intentional loose equality — strict mode uses === above`

---

### [INFO] `resolvedMode` 중복 계산
- **위치**: `switch.handler.ts`, `validate()`와 `execute()`
- **상세**: `const resolvedMode: SwitchMode = mode ?? 'value';`가 두 메서드에 중복된다. 사소하지만 기본값이 변경될 경우 두 곳을 수정해야 한다.
- **제안**: 클래스 상단에 `private static readonly DEFAULT_MODE: SwitchMode = 'value';` 상수 정의.

---

### [INFO] 테스트 픽스처의 `containerId: undefined as unknown as string` 패턴
- **위치**: `execution-engine.service.spec.ts`, 신규 테스트
- **상세**: 이 변환 패턴이 기존 테스트 전반에 이미 존재하므로 새 코드가 일관성을 유지하고 있다. 다만 이 패턴 자체가 `Node` entity의 필드가 실제로는 nullable임에도 타입이 `string`으로 선언된 근본 문제를 감춘다.
- **제안**: 이번 PR 범위는 아니나, `Node.containerId`와 `toolOwnerId`를 `string | undefined`로 수정하면 전체 테스트 파일의 type cast 제거 가능.

---

## 요약

이번 변경은 `evaluateCondition` 유틸 추출을 통한 DRY 개선, `stripControlFields` 개명을 통한 의도 명확화, 그리고 `toEngineFlatShape`의 control field 우선순위 수정이라는 세 축이 잘 조율된 리팩토링이다. 전체적으로 코드 가독성과 관심사 분리가 향상됐다. 주요 유지보수 리스크는 두 가지다: `IfElseHandler`와 `SwitchHandler` 간 `strictComparison` 유효성 검사 불일치, 그리고 `VALID_OPERATORS` 배열과 `ConditionOperator` 타입의 수동 동기화 부담. 나머지는 코드 스타일과 문서화 수준의 사소한 이슈다.

## 위험도

**LOW**