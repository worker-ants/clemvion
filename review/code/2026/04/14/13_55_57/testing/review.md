### 발견사항

---

**[CRITICAL] `chip-input.tsx` — 테스트 파일 전무**
- 위치: `chip-input.tsx` 전체
- 상세: 쉼표 입력으로 chip 추가, Enter로 commit, Backspace로 마지막 chip 삭제, blur 시 commit, 중복 입력 방지 등 복잡한 인터랙션 로직이 모두 테스트 없음
- 제안:
  ```ts
  // 누락된 케이스 예시
  it("쉼표 입력 시 chip 추가", () => { ... })
  it("중복 값은 추가하지 않음", () => { ... })
  it("Backspace로 마지막 chip 삭제", () => { ... })
  it("빈 문자열은 commit하지 않음", () => { ... })
  it("blur 시 draft 값 commit", () => { ... })
  ```

---

**[CRITICAL] `defaults.ts` — 테스트 파일 전무**
- 위치: `defaults.ts` 전체
- 상세: `defaultForType`은 모든 11가지 operation type에 대한 기본값 생성 로직을 포함. `preserve` 파라미터의 field 전달 여부, `object_pick`/`object_omit`의 `field: preservedField || undefined` 분기 등 테스트되지 않은 로직 존재
- 제안:
  ```ts
  it("타입 변경 시 field 값을 보존함", () => {
    const result = defaultForType("remove_field", { type: "set_field", field: "user.name", value: "" });
    expect(result).toEqual({ type: "remove_field", field: "user.name" });
  })
  it("빈 field는 undefined로 설정됨 (object_pick)", () => {
    const result = defaultForType("object_pick", { type: "remove_field", field: "" });
    expect((result as any).field).toBeUndefined();
  })
  ```

---

**[WARNING] `apply-operation.test.ts` — 커버리지 갭: 여러 케이스 누락**
- 위치: `apply-operation.test.ts`
- 상세: 다음 케이스가 미검증:
  - `string_op`: `uppercase`, `lowercase`, `replace` (regex 포함, replaceAll), `join`
  - `math_op`: `add`, `subtract`, `multiply`, `divide`, `round`, divide-by-zero 방어 처리
  - `date_op`: `add`, `subtract`, `diff`
  - `array_filter`: `eq`, `neq`, `contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`, `regex`, `is_null`, `is_type` 등 다수 연산자 미검증
  - `array_sort`: primitive 값 정렬, `asc` 방향
  - `type_convert`: `string`, `number`, `boolean`, `object` 타입
  - `rename_field`: 존재하지 않는 필드 처리
  - prototype pollution 방어 (`__proto__`, `constructor`, `prototype` key 차단)
  - 빈 `ops` 배열에 대한 `applyOperations` 동작
- 제안:
  ```ts
  it("divide-by-zero는 값을 변경하지 않음", () => {
    const result = applyOperation({ v: 10 }, { type: "math_op", field: "v", operation: "divide", operand: 0 });
    expect(result).toEqual({ v: 10 });
  })
  it("__proto__ 키 접근을 차단함", () => {
    const result = applyOperation({}, { type: "set_field", field: "__proto__.polluted", value: true });
    expect(({}  as any).polluted).toBeUndefined();
  })
  ```

---

**[WARNING] `TransformConfig` (index.tsx) — DnD 상태 관리 로직 미검증**
- 위치: `index.tsx`, `queueMicrotask` 블록 및 `addOperation`, `duplicateOperation`
- 상세: `ids.length !== operations.length` 시 `queueMicrotask`로 동기화하는 로직, `addOperation`의 counter 증가, `duplicateOperation` 후 id 중복 방지 등 버그 발생 가능성이 높은 로직이 테스트 없음
- 제안: React Testing Library로 operation 추가/삭제/중복 후 id 배열 상태를 검증하는 단위 테스트 필요

---

**[WARNING] `preview.tsx` — 상태 분기 로직 미검증**
- 위치: `preview.tsx`
- 상세: `hasExecutionInput` 분기(실행 이력 유/무), `parsedSample` 오류 표시, `applyOperations` 예외 silencing(`catch { return [] }`) 등 주요 분기가 테스트 없음. 특히 예외를 조용히 삼키는 패턴은 디버깅이 어려워 테스트로 보완 필요
- 제안:
  ```ts
  it("잘못된 JSON 입력 시 오류 메시지 표시", () => { ... })
  it("실행 이력이 있으면 샘플 textarea가 렌더되지 않음", () => { ... })
  ```

---

**[INFO] `apply-operation.test.ts` — `applyOperations` 빈 배열 케이스 누락**
- 위치: `apply-operation.test.ts`, `applyOperations chain` describe
- 상세: `ops = []`일 때 빈 배열 반환 여부를 검증하는 테스트 없음
- 제안:
  ```ts
  it("ops가 비어있으면 빈 배열 반환", () => {
    expect(applyOperations({ a: 1 }, [])).toEqual([]);
  })
  ```

---

**[INFO] `apply-operation.test.ts` — 테스트 가독성 양호**
- 위치: 전체
- 상세: 존재하는 테스트들은 명확한 given/when/then 구조, 의미 있는 테스트 명칭, 불변성 검증 포함 등 가독성이 높음. `describe` 계층 구조도 적절

---

### 요약

`apply-operation.ts`와 `apply-operation.test.ts`의 핵심 로직 검증 구조는 양호하나, 11개 연산자 중 실제 검증되는 케이스가 6개 내외로 커버리지가 낮음. 더 큰 문제는 **UI 컴포넌트 전체(`chip-input`, `TransformConfig`, `preview`, `operation-card`, `ops`)와 유틸 함수(`defaults.ts`)에 테스트가 전혀 없다**는 점이다. 특히 `chip-input`의 복잡한 인터랙션 로직과 `defaults.ts`의 타입 변경 시 field 보존 로직은 회귀 위험이 높으며, `TransformConfig`의 `queueMicrotask` 기반 id 동기화 패턴은 타이밍 의존성이 있어 테스트 없이 유지보수하기 어렵다. Prototype pollution 방어 코드에 대한 보안 관련 테스트도 누락되어 있다.

### 위험도
**HIGH**