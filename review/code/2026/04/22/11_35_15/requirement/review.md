## 발견사항

### [WARNING] `IfElseHandler`에 `strictComparison` 유효성 검사 누락
- **위치**: `if-else.handler.ts`, `validate()` 메서드
- **상세**: `SwitchHandler`는 `strictComparison`이 boolean이 아닌 경우 에러를 추가하지만, `IfElseHandler`는 동일한 `strictComparison` 옵션을 `execute()`에서 사용함에도 `validate()`에서 타입 검사를 하지 않음. 두 핸들러가 동일한 `condition-evaluator.util`을 공유하므로 검증 계약도 일치해야 함.
- **제안**: 
  ```ts
  if (strictComparison !== undefined && typeof strictComparison !== 'boolean') {
    errors.push('strictComparison must be a boolean');
  }
  ```

### [WARNING] `hasDefault: null` 검증 동작 변경 (테스트 미비)
- **위치**: `switch.handler.ts`, `validate()` 메서드, L88
- **상세**: 기존 코드는 `hasDefault !== null` 조건을 포함해 `null`을 허용(무시)했으나, 변경 후 `null`이 전달되면 `typeof null !== 'boolean'` → `true`이므로 validation 에러가 발생. 기존 동작과 달라졌으나 이 케이스를 커버하는 테스트가 없음.
- **제안**: `hasDefault: null`에 대한 테스트 추가 또는 `null`을 명시적으로 허용할지 결정 후 문서화.

### [WARNING] `matchByValue` 느슨한 비교(`==`)가 기본값 — 예상치 못한 매칭 가능
- **위치**: `switch.handler.ts`, `matchByValue()`, L149
- **상세**: 기본(non-strict)이 `==`이므로 `0 == false`, `'' == false`, `null == undefined` 등이 모두 `true`. 예: `switchValue: 0`이고 케이스에 `value: false`가 있으면 의도하지 않은 매칭 발생 가능. 테스트는 `'1' == 1` 케이스만 커버.
- **제안**: 최소한 `0 == false`와 `null == undefined` 케이스에 대한 테스트 추가. UI에서 사용자에게 기본이 느슨한 비교임을 안내하거나, 기본값을 strict로 바꾸는 것 고려.

### [WARNING] `SwitchHandler` — `switchValue`의 path-lookup → 직접값 변경은 기존 워크플로우 파괴적 변경
- **위치**: `switch.handler.ts`, `execute()`, 주석 및 L110
- **상세**: 기존 `switchValue: 'user.role'`처럼 필드 경로를 사용하던 워크플로우는 이제 `'user.role'` 문자열 자체를 비교 대상으로 사용. 주석에 "표현식 엔진이 사전 해석한다"고 명시되어 있으나, 실제로 표현식 엔진이 `switchValue`를 항상 사전 해석하는지 검증하는 통합 테스트가 이 변경 세트에 없음.
- **제안**: 표현식 엔진이 `switchValue`를 핸들러 실행 전 해석하는 경로를 커버하는 통합/E2E 테스트 추가.

### [INFO] `Condition.value`가 optional이나 비교 연산자에서 런타임 검증 없음
- **위치**: `condition-evaluator.util.ts`, `Condition` 인터페이스 L16
- **상세**: `is_empty`, `is_null` 등 단항 연산자를 위해 `value`를 optional로 선언했지만, `eq`, `gt` 등 이항 연산자에서 `value`가 `undefined`이면 잘못된 비교 결과(`undefined == undefined` → `true`) 발생 가능.
- **제안**: `validate()` 단계 또는 `evaluateCondition()` 내에서 이항 연산자에 `value`가 필요한 경우 경고 로깅 또는 명시적 처리 추가.

### [INFO] `not_contains` — 비문자열 타입에서 항상 `true` 반환
- **위치**: `condition-evaluator.util.ts`, L44
- **상세**: `fieldValue`가 숫자/배열 등 비문자열이면 `not_contains`는 항상 `true`. 기존 `if-else` 핸들러와 동일한 동작이지만, 공유 유틸로 추출되면서 이 암묵적 동작이 더 넓게 적용됨. 테스트에 `contains: false` 케이스는 있으나 `not_contains`의 비문자열 케이스는 없음.
- **제안**: `not_contains` 비문자열 케이스 테스트 추가로 의도된 동작임을 명확히 문서화.

### [INFO] `structuredOutputCache` 참조 확인 불가
- **위치**: `execution-engine.service.ts`, `stripControlFields` JSDoc
- **상세**: JSDoc에 "structuredOutputCache에는 control fields가 유지되어 `$node["X"].port` 표현식이 여전히 동작한다"고 명시되어 있으나, 현재 변경 세트에서 `structuredOutputCache`의 실제 존재 및 분리 관리 여부가 확인되지 않음.

---

## 요약

이번 변경은 제어 필드(`port`, `status`, `_resumeState`) 누출로 인한 라우팅 오작동 버그를 수정하고, 조건 평가 로직을 `condition-evaluator.util`로 통합하며 Switch 핸들러에 `expression` 모드와 `strictComparison`을 추가한 합리적인 리팩토링이다. 핵심 버그 픽스(`stripControlFields`, `toEngineFlatShape` 권위 필드 우선순위)는 테스트로 잘 검증되어 있다. 그러나 `IfElseHandler`의 `strictComparison` 검증 누락, `matchByValue`의 느슨한 기본 비교로 인한 잠재적 오매칭, 그리고 `switchValue` path-lookup 제거가 기존 워크플로우에 미치는 영향에 대한 통합 검증이 부재한 점이 주요 위험 요소다.

## 위험도

**MEDIUM**