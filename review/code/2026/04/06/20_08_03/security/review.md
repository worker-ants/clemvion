## 보안 코드 리뷰 결과

### 발견사항

---

**[INFO]** `valueType` 미검증 — 신뢰되지 않은 문자열이 분기 조건에 사용됨
- **위치**: `switch.handler.ts` — `coerceCaseValue()` 메서드
- **상세**: `valueType`은 `CaseValueType` 타입으로 선언되어 있지만, 런타임에 실제로 허용된 값('string' | 'number' | 'boolean')인지 검증하지 않음. 설정이 외부에서 역직렬화된다면 임의의 문자열이 들어올 수 있으나, 현재 구현에서는 알 수 없는 값이 입력될 경우 마지막 `return value`로 안전하게 처리되어 실제 취약점으로 이어지지는 않음.
- **제안**: 방어적 설계를 위해 `validate()` 내에서 `cases[i].valueType`이 허용된 값인지 명시적으로 검사하는 것을 권장.

```typescript
const VALID_VALUE_TYPES = new Set(['string', 'number', 'boolean']);
if (c.valueType !== undefined && !VALID_VALUE_TYPES.has(c.valueType)) {
  errors.push(`cases[${i}].valueType must be 'string', 'number', or 'boolean'`);
}
```

---

**[INFO]** `select` 드롭다운의 `value`가 `updateCase`를 통해 직접 config로 전파됨
- **위치**: `logic-configs.tsx` — `SwitchConfig` 컴포넌트, line ~168
- **상세**: `e.target.value`가 필터링 없이 `updateCase(i, "valueType", e.target.value)`로 전달됨. 브라우저 환경에서 `<select>`는 DOM이 조작되지 않는 한 정의된 `<option>` 값만 반환하므로 실질적 위협은 낮음. 그러나 직렬화된 설정이 API를 통해 서버로 저장/복원된다면 신뢰 경계가 프론트엔드가 아닌 백엔드에 있어야 함.
- **제안**: 백엔드 `validate()`에서 `valueType` 허용 목록 검사를 추가하는 것으로 충분 (위 항목과 동일).

---

**[INFO]** `Number(value)` 변환 — 잠재적 대규모 숫자/특수값
- **위치**: `switch.handler.ts` — `coerceCaseValue()`, line ~97
- **상세**: `Number('Infinity')`, `Number('-Infinity')` 등은 `NaN`이 아니므로 `Infinity`로 변환되어 case 값이 됨. 악의적 입력이라기보다는 예상치 못한 동작이나, case 값으로 `Infinity`가 의도되지 않았다면 처리 불일치가 생길 수 있음.
- **제안**: 필요 시 `Number.isFinite(n)` 조건을 추가.

```typescript
if (valueType === 'number') {
  const n = Number(value);
  return Number.isNaN(n) || !Number.isFinite(n) ? value : n;
}
```

---

**[INFO]** 에러 메시지에 내부 상태 노출 없음 — 적절한 수준
- **위치**: `switch.handler.ts` — `execute()` 마지막 throw
- **상세**: `'No matching case found and no default case configured'` 메시지는 구체적인 입력값이나 내부 경로를 포함하지 않아 정보 노출 위험 없음. 적절함.

---

### 요약

이번 변경사항(Switch 노드의 `valueType` 기반 타입 강제 변환 기능)은 전반적으로 보안 위험이 낮습니다. `coerceCaseValue` 구현은 명시적인 분기로 처리되며 의도치 않은 값은 원본을 그대로 반환하는 안전한 폴백 구조를 갖추고 있습니다. 다만, `valueType`에 대한 허용 목록 검사가 `validate()` 단계에서 누락되어 있어 직렬화된 외부 설정이 서버에 직접 유입될 경우 방어 계층이 타입스크립트 타입 시스템에만 의존하게 되는 설계 취약점이 있습니다. 프론트엔드의 `<select>` 컴포넌트는 DOM 수준에서 값이 고정되어 있으나, 신뢰 경계는 항상 백엔드 검증 계층에 있어야 합니다. `Infinity` 변환 엣지 케이스를 포함하여 세 항목 모두 INFO 수준이며 즉각적인 보안 위협은 없습니다.

---

### 위험도

**LOW**