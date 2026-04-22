## 발견사항

### [WARNING] `switch.handler.spec.ts`: `coerceCaseValue` 핵심 분기 커버리지 제거

- **위치**: 기존 `execute` describe 블록에서 제거된 테스트들
- **상세**: 아래 4가지 케이스가 신규 테스트에서 대체 없이 삭제됨
  - `valueType: 'boolean'` 강제 변환 (`'true'` → `true`, `'false'` → `false`)
  - Boolean 강제 변환 실패 케이스 (`'yes'` → `'yes'` 유지)
  - Number 강제 변환 실패 케이스 (`'abc'` → NaN 방지, 원본 유지)
  - `valueType: 'string'` 명시 시 변환 안 함 (현재는 `valueType` 미지정 케이스만 커버)
- **제안**: `coerceCaseValue`는 `private`이지만 실질 로직을 담당하므로 execute 테스트에서 해당 분기를 추가

```typescript
// 추가 필요 예시
it('coerces "true"/"false" string to boolean when valueType is boolean', async () => {
  const result = await handler.execute({}, {
    switchValue: true,
    cases: [{ id: 'yes', value: 'true', valueType: 'boolean' }],
    hasDefault: true,
  }, context);
  expect(result).toMatchObject({ port: 'yes' });
});

it('keeps non-convertible string when number coercion yields NaN', async () => {
  const result = await handler.execute({}, {
    switchValue: 'abc',
    cases: [{ id: 'c1', value: 'abc', valueType: 'number' }],
    hasDefault: true,
  }, context);
  expect(result).toMatchObject({ port: 'c1' });
});
```

---

### [WARNING] `switch.handler.ts`: 느슨한 비교(`==`) 경계값 미테스트

- **위치**: `switch.handler.ts` `matchByValue()`, `switch.handler.spec.ts`
- **상세**: `strict: false`(기본) 시 `caseValue == switchValue`로 비교하는데, JavaScript `==`의 비직관적인 케이스가 테스트되지 않음:
  - `null == undefined` → `true`: switchValue가 `null`이고 case value가 `undefined`이면 의도치 않게 매칭
  - `0 == false`, `'' == false`, `'' == 0` 등 falsy 동치
- **제안**: 느슨한 비교의 위험 케이스를 명시적으로 문서화하거나 테스트 추가

```typescript
it('loose mode: null and undefined are equal (JS == behavior)', async () => {
  const result = await handler.execute({}, {
    switchValue: null,
    cases: [{ id: 'c1', value: undefined }],
    hasDefault: false, // 테스트용
  }, context);
  // 매칭 여부가 의도된 것인지 명시적 검증 필요
});
```

---

### [WARNING] `if-else.handler.spec.ts` diff 부재 — `strictComparison` 미커버

- **위치**: `if-else.handler.ts` 변경 / 스펙 파일 미포함
- **상세**: `if-else.handler.ts`에 `strictComparison` 옵션이 추가되었으나, 해당 spec 파일의 변경 diff가 없음. `condition-evaluator.util.spec.ts`에 strict 모드 테스트가 있지만, if-else 핸들러 레벨에서 `strictComparison: true` 설정이 실제로 `evaluateCondition`에 전달되는지 검증하는 통합 테스트가 없음
- **제안**: `if-else.handler.spec.ts`에 다음 케이스 추가

```typescript
it('rejects "42" vs 42 when strictComparison is true', async () => {
  const result = await handler.execute(
    { n: '42' },
    {
      conditions: [{ field: 'n', operator: 'eq', value: 42 }],
      combineMode: 'and',
      strictComparison: true,
    },
    context,
  );
  expect(result).toMatchObject({ port: 'false' });
});
```

---

### [WARNING] `handler-output.adapter.spec.ts`: 상속된 port 유지 동작의 잠재적 위험

- **위치**: `handler-output.adapter.spec.ts` line ~309 ("still preserves inherited port when adapted does not declare one")
- **상세**: 핸들러가 `port`를 선언하지 않으면 output 객체의 `port: 'out'`이 그대로 유지됨. 현재는 `stripControlFields`가 다운스트림에 전달 전 제거하지만, 이 테스트는 "포트 필드 보존"을 정상 동작으로 문서화함. `stripControlFields` 적용 경로가 누락되는 경우 라우팅 오류로 이어질 수 있음
- **제안**: 테스트 주석에 "이 동작이 안전한 이유는 `stripControlFields`가 다운스트림 전달 전 제거하기 때문" 명시. 또는 `toEngineFlatShape`에서 핸들러 미선언 port의 output 전파를 차단하는 방향 검토

---

### [INFO] `execution-engine.service.spec.ts`: `data` 합성 필드 미검증

- **위치**: 신규 regression 테스트 "should strip port / status / _resumeState control fields..."
- **상세**: emitter 핸들러가 `port: 'out'`을 선언하면 `toEngineFlatShape`이 `data: output` 필드를 합성. 스트리핑 후 receiver가 받는 객체에는 `{ interaction: {...}, data: { interaction: {...} } }` 형태의 `data` 필드가 포함될 수 있으나 테스트에서 미검증(`toMatchObject`라 통과는 되나 예상치 못한 필드 존재)
- **제안**: 필요에 따라 `expect(receivedInput).not.toHaveProperty('data')` 또는 `toEqual`로 정확한 shape 검증 추가

---

### [INFO] `condition-evaluator.util.spec.ts`: `not_contains` 비문자열 케이스 의도 불명확

- **위치**: `condition-evaluator.util.ts` `not_contains` case / spec
- **상세**: `not_contains`는 field가 string이 아니면 `true`를 반환(포함하지 않음으로 간주). `contains`가 `false`를 반환하는 것과 비대칭이며, `{ n: 12345 }` 대상 `not_contains '23'` 테스트가 없음. 비문자열 `not_contains`가 항상 `true`임이 명시적으로 테스트/문서화되지 않음
- **제안**: 명시적 테스트 추가

```typescript
it('not_contains returns true when field is not a string (non-string fields cannot contain anything)', () => {
  expect(evaluateCondition({ n: 12345 }, { field: 'n', operator: 'not_contains', value: '23' })).toBe(true);
});
```

---

### [INFO] `condition-evaluator.util.spec.ts`: `is_not_empty`의 falsy-but-truthy 케이스 미테스트

- **위치**: `condition-evaluator.util.spec.ts` `is_not_empty` describe
- **상세**: `0`, `false`, `NaN` 같은 falsy이지만 empty가 아닌 값에 대해 `is_not_empty`가 `true`를 반환하는지 테스트 없음. `is_empty` 정의가 `'' | null | undefined | []`이므로 `0`은 비어있지 않음이지만 직관에 반할 수 있음
- **제안**: `{ f: 0 }`, `{ f: false }` 케이스 명시적 테스트 추가

---

## 요약

전반적으로 테스트 품질은 높다. 회귀 버그를 명확한 주석과 함께 재현하는 regression 테스트, condition evaluator의 신규 유틸리티 spec, handler-output adapter의 override 동작 테스트 모두 잘 작성되어 있다. 다만 `switch.handler.spec.ts`에서 기존 `coerceCaseValue` 분기(boolean 강제 변환, NaN 방어) 커버리지가 삭제되어 private 메서드 변경 시 silent regression 위험이 생겼고, `if-else.handler.ts`의 신규 `strictComparison` 옵션이 핸들러 레벨에서 직접 검증되지 않는 점, 그리고 느슨한 비교(`==`) 경계값 미테스트가 주요 개선 포인트다.

## 위험도

**MEDIUM**