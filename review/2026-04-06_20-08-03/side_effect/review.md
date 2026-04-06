## 부작용(Side Effect) 코드 리뷰

### 발견사항

---

**[WARNING] 기존 케이스 데이터의 `valueType` 누락으로 인한 마이그레이션 불일치**
- 위치: `switch.handler.ts:75-77` / `logic-configs.tsx:108-115`
- 상세: 새로 추가되는 케이스에는 `valueType: "string"`이 기본으로 세팅되지만, **기존에 저장된 워크플로우 데이터**의 케이스 항목에는 `valueType`이 없습니다. 백엔드 `coerceCaseValue`는 `valueType === undefined`이면 `string`과 동일하게 처리하므로 실행 동작에는 문제없습니다. 그러나 프론트엔드 `<select>`는 `c.valueType ?? "string"`으로 렌더링하므로 UI는 정상 표시됩니다. 사실상 하위 호환은 유지되나, 기존 데이터에서 저장된 값이 `undefined`인 케이스가 DB에서 로드되면 `valueType`이 선택되어 있지만 persist 되지 않을 수 있습니다.
- 제안: 백엔드 validate() 또는 별도 마이그레이션 레이어에서 `valueType` 없는 케이스를 `"string"`으로 정규화하거나, 명시적으로 허용된 `undefined = string` 계약을 주석으로 명시하세요.

---

**[WARNING] `coerceCaseValue`의 단방향 강제 변환 — `actualValue`는 변환하지 않음**
- 위치: `switch.handler.ts:75-77`
- 상세: 현재 로직은 **케이스 값만 강제 변환**하고, `actualValue`(실행 입력에서 추출된 값)는 변환하지 않습니다. 즉 `switchValue`가 `"x"` (문자열 경로)이고 `input.x === 42` (숫자)인데 케이스의 `valueType: 'number'`, `value: '42'`라면 `coerce('42', 'number') === 42`는 `true`가 됩니다. 반대 상황 — `input.x === '42'` (문자열)에 `valueType: 'number'`, `value: '42'`이면 `coerce('42', 'number') === '42'`는 `false`로 케이스가 매칭 안 됩니다. 이 비대칭 동작은 사용자에게 혼란을 줄 수 있습니다.
- 제안: `valueType`이 의미하는 것이 "케이스 값의 타입" 또는 "비교 대상 타입"인지 명확히 정의하고, 필요하다면 `actualValue`도 동일하게 변환하거나 문서/주석으로 의도를 명시하세요.

---

**[INFO] `SwitchCase.value` 타입이 `unknown`으로 유지됨에도 프론트엔드는 `string`으로 단언**
- 위치: `logic-configs.tsx:101-107`
- 상세: 프론트엔드는 `cases`를 `Array<{ value: string; valueType?: string }>` 으로 캐스팅하지만, 백엔드 인터페이스의 `SwitchCase.value`는 `unknown`입니다. 비-string 타입의 `value`가 API를 통해 넘어올 경우 프론트엔드에서 타입 오류 없이 잘못 렌더링될 수 있습니다.
- 제안: `value`를 항상 string으로 직렬화하는 계약을 API 레벨에서 보장하거나, 프론트엔드 캐스팅에 런타임 방어 코드를 추가하세요.

---

**[INFO] 테스트 케이스 "should use strict equality" 설명과 실제 동작의 의미 충돌**
- 위치: `switch.handler.spec.ts` — 기존 테스트 `"should use strict equality (no type coercion)"`
- 상세: 이 테스트는 `valueType` 없는 경우에 타입 강제 없음을 검증합니다. 이제 `valueType`이 있으면 강제 변환을 허용하는 기능이 추가됐으므로, 테스트 설명이 "기본(valueType 미지정) 시 strict equality"로 명확하게 업데이트되어야 합니다. 설명이 오해를 유발할 수 있습니다.
- 제안: 테스트 설명을 `"should use strict equality when valueType is not specified"`로 수정하세요.

---

### 요약

이번 변경은 `SwitchHandler`에 `valueType` 기반 단방향 강제 변환을 추가한 것으로, 새로운 전역 상태 변경, 파일시스템 접근, 외부 네트워크 호출 등 명백한 부작용은 없습니다. 하위 호환성도 `valueType === undefined` 처리를 통해 보장됩니다. 다만 **강제 변환이 케이스 값에만 적용되고 `actualValue`에는 적용되지 않는 비대칭 설계**가 잠재적인 혼란 요소이며, 기존에 저장된 데이터의 마이그레이션 경계가 명시적으로 문서화되지 않은 점이 중간 수준의 위험입니다.

### 위험도

**LOW**