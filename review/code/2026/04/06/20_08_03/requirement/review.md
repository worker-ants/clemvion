### 발견사항

- **[INFO]** `valueType` 검증이 `validate()` 메서드에 누락됨
  - 위치: `switch.handler.ts` — `validate()` 메서드
  - 상세: `SwitchCase.valueType`에 `CaseValueType` 타입이 정의되어 있지만, `validate()`에서 허용되지 않는 값(예: `"object"`, `"array"`)에 대한 검증이 없음. 프론트엔드가 유일한 입력 경로가 아닌 이상 API를 통해 잘못된 값이 진입할 수 있음
  - 제안: `if (c.valueType !== undefined && !['string', 'number', 'boolean'].includes(c.valueType)) { errors.push(...) }`

- **[INFO]** 기존 케이스(저장된 워크플로우)에 `valueType`이 없는 경우의 마이그레이션 동작
  - 위치: `switch.handler.ts:91` — `coerceCaseValue`
  - 상세: `valueType === undefined`이면 코어션 없이 원래 값을 반환하므로, 기존 워크플로우는 이전과 동일하게 동작함. 의도적 하위 호환 설계로 보이며 동작 자체는 올바름
  - 제안: 문서화 또는 스펙에 마이그레이션 정책 명시 권장 (Info 수준)

- **[INFO]** 프론트엔드 `addCase`에서 신규 케이스의 기본 `valueType`이 `"string"`으로 설정되지만, 기존 저장된 케이스에는 `valueType`이 없을 수 있음
  - 위치: `logic-configs.tsx:170` — `select`의 `value={c.valueType ?? "string"}`
  - 상세: 렌더링은 `"string"`으로 폴백되므로 UI 표시는 올바르나, 백엔드 `coerceCaseValue`도 `undefined`를 `string`으로 처리하므로 일관성 있음. 실질적 문제 없음

- **[INFO]** `coerceCaseValue`에서 `value`가 이미 `number`/`boolean` 타입인 경우의 처리
  - 위치: `switch.handler.ts:95-96`
  - 상세: `typeof value !== 'string'`이면 그대로 반환하므로, 이미 올바른 타입이면 통과됨. 의도에 부합하는 방어 코드이며 동작 정확함

- **[INFO]** 테스트에서 `switchValue`가 경로 문자열이고 실제 값이 숫자인 케이스(`{ x: 42 }`, `valueType: 'number'`)에 대한 테스트 누락
  - 위치: `switch.handler.spec.ts`
  - 상세: 현재 숫자 코어션 테스트는 `switchValue: 42`(직접 값)만 검증함. `switchValue: 'x'`로 경로 조회 후 얻은 숫자 값과 `valueType: 'number'`인 케이스 문자열 값 간 매칭 시나리오가 없음 (`{ x: 42 }` 입력, `value: '42'`, `valueType: 'number'`로 매칭되는지)
  - 제안: 아래 테스트 추가
    ```ts
    it('should coerce case value to number when actual value from path is a number', async () => {
      const result = await handler.execute(
        { x: 42 },
        { switchValue: 'x', cases: [{ id: 'c1', value: '42', valueType: 'number' }], hasDefault: true },
        context,
      );
      expect(result).toEqual({ port: 'c1', data: { x: 42 } });
    });
    ```

---

### 요약

이번 변경은 Switch 노드에서 케이스 값의 타입 코어션(string → number/boolean)을 지원하기 위한 기능 추가로, 핵심 로직(`coerceCaseValue`)과 프론트엔드 UI(`valueType` select), 테스트 코드가 일관되게 구현되었습니다. 하위 호환성도 올바르게 유지되며 비즈니스 로직상 치명적 결함은 없습니다. 다만 `validate()`에서 `valueType`의 허용 값 검증이 누락되어 있어 외부 API 경로로 잘못된 값이 진입할 경우 무시(silent fallback)되는 점이 아쉽고, 경로 조회 후 얻은 숫자 값과의 매칭 시나리오에 대한 테스트가 추가되면 커버리지가 더 충실해집니다.

### 위험도

**LOW**