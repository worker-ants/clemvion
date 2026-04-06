### 발견사항

- **[INFO]** `coerceCaseValue` 메서드의 책임 분리가 적절함
  - 위치: `switch.handler.ts:89-107`
  - 상세: 타입 강제변환 로직을 private 메서드로 분리한 점은 단일 책임 원칙에 부합. `execute`가 매칭 흐름을, `coerceCaseValue`가 타입 변환을 담당하는 구조가 명확함
  - 제안: 현행 유지

- **[WARNING]** `CaseValueType`과 `SwitchCase` 인터페이스가 핸들러 내부에만 정의되어 있어 프론트엔드와 타입 정의가 이중화됨
  - 위치: `switch.handler.ts:8`, `logic-configs.tsx:104`
  - 상세: 백엔드는 `CaseValueType = 'string' | 'number' | 'boolean'`을 강타입으로 정의했으나, 프론트엔드는 `valueType?: string`으로 약하게 정의함. 두 레이어가 같은 도메인 계약을 각자 유지하고 있어 타입 불일치 버그가 무방비 상태임. 특히 사용자가 프론트에서 새 valueType 값을 전달하면 백엔드 `coerceCaseValue`는 조용히 원본값을 반환할 뿐 오류를 내지 않음
  - 제안: 공유 타입 패키지(`packages/shared-types` 등) 또는 OpenAPI/Zod 스키마에서 `CaseValueType`을 단일 정의하고 양쪽이 import하는 구조로 개선

- **[WARNING]** `coerceCaseValue`의 강제변환 방향이 단방향(case value → actual value)으로 고정되어 있어 역방향 시나리오를 처리하지 못함
  - 위치: `switch.handler.ts:75-78`
  - 상세: `actualValue`는 런타임 입력값이므로 타입이 보장되지 않음. 예를 들어 `switchValue`가 expression으로 `"42"` (string)를 반환하고 case value가 `42` (number, valueType: 'number')일 때 coerce 후에도 `42 === "42"` 불일치가 발생함. 즉 변환 방향이 항상 case side에만 적용되는 설계가 모든 실사용 시나리오를 커버하지 않음
  - 제안: `actualValue`도 타입 힌트에 따라 변환하거나, `actualValue`의 타입을 기준으로 양방향 동등 비교를 수행하는 별도 비교 전략 객체(Strategy 패턴)로 추상화

- **[INFO]** 프론트엔드 `updateCase`에서 `valueType` 변경을 문자열 key로 접근 (`updateCase(i, "valueType", e.target.value)`)
  - 위치: `logic-configs.tsx:163`
  - 상세: `key: string`으로 받아 인덱스 접근하는 패턴은 타입 안전성이 없음. 허용되지 않는 키나 값이 조용히 케이스 객체에 삽입될 수 있음
  - 제안: `key: keyof SwitchCaseItem` 형태로 제네릭 타입을 좁히거나, valueType 전용 핸들러를 별도로 분리

- **[INFO]** `validate` 메서드에서 `valueType`의 유효값 검증이 누락됨
  - 위치: `switch.handler.ts:27-58`
  - 상세: `valueType`이 추가되었으나 `validate`에서는 허용 값(`string | number | boolean`) 범위 검사를 하지 않음. 잘못된 `valueType`이 들어와도 `coerceCaseValue`가 fallthrough하므로 무결성이 묵시적으로만 보장됨
  - 제안: validate에서 `VALID_VALUE_TYPES = ['string', 'number', 'boolean']` 체크 추가

---

### 요약

이번 변경은 Switch 노드의 타입 강제변환 기능을 `coerceCaseValue` private 메서드로 캡슐화하고 프론트엔드에 valueType 선택 UI를 추가한 소규모 확장으로, 핵심 플로우 변경 없이 기능을 자연스럽게 삽입한 점은 개방-폐쇄 원칙에 부합한다. 다만 `CaseValueType`이 백엔드 핸들러 내부에만 강타입으로 존재하고 프론트엔드는 `string`으로 느슨하게 받는 계약 불일치가 레이어 경계 약화의 주요 위험 요인이며, 변환 방향이 case side에만 고정되어 있어 expression 해석 결과가 문자열로 들어오는 실사용 시나리오에서 의도치 않은 미스매치가 발생할 수 있다. 전반적으로 단순하고 이해하기 쉬운 구조이나, 공유 타입 계약 부재와 validate 누락이 중기적으로 유지보수 부채가 될 가능성이 있다.

### 위험도

**LOW**