## 발견사항

이 코드는 HTTP API 엔드포인트가 아닌 프론트엔드 UI 컴포넌트 및 내부 유틸리티입니다. 단, `TransformOperation` 타입은 프론트엔드가 백엔드 실행 엔진으로 전달하는 **데이터 계약(Data Contract)** 을 정의하므로, 해당 관점에서 분석합니다.

---

- **[WARNING]** `args?: unknown` 타입이 여러 오퍼레이션에서 느슨하게 정의됨
  - 위치: `transform.ts` — `string_op`, `date_op`의 `args?: unknown`
  - 상세: `args` 필드가 `unknown`으로 선언되어 있어 컴파일 타임에 구조 검증이 불가합니다. 백엔드 핸들러는 런타임에 `(op.args ?? {}) as Record<string, unknown>` 캐스팅을 해야 하며, 잘못된 `args`가 전달되어도 타입 오류가 발생하지 않습니다.
  - 제안: `string_op`는 `args?: { search?: string; replacement?: string; all?: boolean; regex?: boolean; separator?: string }`, `date_op`는 `args?: { pattern?: string; amount?: number; unit?: DateUnit; compareField?: string }`로 구체화하세요.

- **[WARNING]** `set_field.value: unknown`의 직렬화 일관성 문제
  - 위치: `transform.ts` — `{ type: "set_field"; field: string; value: unknown }`, `ops.tsx` — `SetFieldFields`
  - 상세: UI에서 `value`를 항상 문자열로 저장하지만 (`onChange({ ...op, value: v })`), 타입은 `unknown`입니다. 백엔드가 숫자/불리언/객체를 기대할 때와 문자열이 전달될 때 동작이 달라질 수 있습니다. 표현식 처리 후의 실제 타입이 명시되지 않아 백엔드 계약이 불명확합니다.
  - 제안: `value: string | number | boolean | null`처럼 허용 타입을 명시하거나, "항상 문자열로 저장하고 실행 시 평가한다"는 계약을 문서화하세요.

- **[INFO]** `object_pick` / `object_omit`의 루트 객체 교체 시 데이터 유실 가능성
  - 위치: `apply-operation.ts` — `object_pick` case, `field`가 없을 때 `return picked`
  - 상세: `field`가 없을 때 루트 객체 자체를 `picked`로 교체합니다. 이 동작이 백엔드와 일치하는지 명시적 계약이 없습니다. 이후 체인 오퍼레이션이 이전 필드에 접근하면 유실됩니다.
  - 제안: 스펙 문서에 "field 미지정 시 루트 교체" 동작을 명시하고, 백엔드 핸들러와 동일한 로직을 보장하는 통합 테스트를 추가하세요.

- **[INFO]** `array_filter` 조건의 `value: unknown` 직렬화
  - 위치: `transform.ts` — `ArrayFilterCondition.value: unknown`
  - 상세: `eq`, `neq` 비교 시 `==` (느슨한 동등) 를 사용합니다. 문자열 `"3"`과 숫자 `3`을 같게 처리하므로, 백엔드에서 엄격 비교(`===`)를 사용한다면 동작 불일치가 발생합니다.
  - 제안: 프론트 Preview와 백엔드 실행 결과가 동일한 비교 의미론을 사용하도록 계약을 통일하세요.

---

### 요약

이 변경사항은 HTTP API가 아닌 프론트엔드 내부 데이터 계약(`TransformOperation` 타입)을 다룹니다. 전체적으로 discriminated union을 활용한 타입 설계는 견고하며, BLOCKED_KEYS를 통한 prototype pollution 방어도 갖추고 있습니다. 주요 리스크는 `args?: unknown`과 `value: unknown`처럼 느슨한 타입 선언으로, 백엔드 실행 엔진과의 계약 일치를 컴파일 타임에 보장하지 못한다는 점입니다. 특히 `set_field`의 값 타입과 `string_op`/`date_op`의 args 구조가 백엔드 핸들러와 암묵적으로 일치해야 하는 상황이므로, 타입을 구체화하거나 명시적 직렬화 계약을 문서화하는 것이 권장됩니다.

### 위험도
**LOW**