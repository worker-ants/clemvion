스펙 파일 읽기 권한이 없어 코드 자체 분석으로 진행합니다.

---

## 요구사항 관점 코드 리뷰

### 발견사항

---

**[WARNING] `set_field` value 표현식이 preview에서 평가되지 않음**
- 위치: `ops.tsx` `SetFieldFields`, `apply-operation.ts` `case "set_field"`
- 상세: UI에서 `{{ $input.x }}` 형태의 표현식을 입력받지만, `applyOperation`은 그 문자열을 그대로 값으로 저장한다. Preview에서는 `{{ $input.x }}`가 리터럴 문자열로 표시되어 실제 실행 결과와 Preview 결과가 다를 수 있음.
- 제안: Preview 전용으로 표현식 평가기를 연결하거나, 표현식이 포함된 값은 Preview에서 "표현식 포함 - 실행 시 평가됨"으로 별도 표시.

---

**[WARNING] `type_convert` boolean 변환의 직관에 반하는 동작**
- 위치: `apply-operation.ts` `case "type_convert"` → `case "boolean"`
- 상세: `Boolean("false")` → `true` 반환. 사용자가 문자열 `"false"`를 boolean으로 변환하면 `true`가 되는 반직관적 결과 발생. 테스트도 이 케이스를 다루지 않음.
- 제안: 문자열 `"false"`, `"0"`, `"no"` 등을 `false`로 처리하는 스마트 변환 로직 추가, 또는 UI에 경고 표시.

---

**[WARNING] Preview에서 연산 실패 시 오류 메시지 없음**
- 위치: `preview.tsx` `steps` 계산부 (line ~65)
- 상세: `applyOperations` 예외 발생 시 `catch { return []; }` 로 빈 배열 반환. UI에서는 "연산이 없습니다." 메시지만 출력되어 사용자는 오류 원인을 알 수 없음.
- 제안: `try { ... } catch (e) { setError(e.message) }` 형태로 오류 상태를 분리하여 UI에 표시.

---

**[WARNING] Preview가 배열 루트 입력을 지원하지 않음**
- 위치: `preview.tsx` `toDisplayObject` 함수
- 상세: `toDisplayObject`는 배열을 `null` 반환 처리. transform 노드의 실행 결과 inputData가 배열인 경우 Preview가 샘플 입력으로 폴백되어 실제 데이터 미반영.
- 제안: 배열 루트 지원 또는 "배열 입력은 미지원" 메시지를 명시적으로 표시.

---

**[WARNING] `index.tsx` render 중 `queueMicrotask` 상태 동기화 - React 패턴 위반**
- 위치: `index.tsx` lines ~95-105
- 상세: render 함수 본문에서 `queueMicrotask`로 `setState`를 지연 호출. React concurrent mode에서 render는 여러 번 호출될 수 있어 중복 microtask 등록 가능. `useEffect`로 대체해야 함.
- 제안:
  ```ts
  useEffect(() => {
    if (idState.ids.length !== operations.length) {
      setIdState({ ids: resized, counter: nextCounter });
    }
  }, [operations.length]);
  ```

---

**[WARNING] `math_op` operand가 `divide` 전환 시 기본값 0 유지**
- 위치: `defaults.ts` `case "math_op"`, `ops.tsx` `MathOpFields`
- 상세: 기본 operand가 `0`인 상태에서 operation을 `divide`로 변경하면 0으로 나누기 시도. `apply-operation.ts`에서는 `if (operand !== 0)` 가드로 무시되지만 사용자는 결과가 바뀌지 않는 이유를 알 수 없음.
- 제안: `divide` 선택 시 기본 operand를 1로 설정하거나, 0 입력 시 UI 경고 표시.

---

**[INFO] `ChipInput` 중복 입력 시 쉼표 트리거 후 draft 미초기화**
- 위치: `chip-input.tsx` `onChange` 핸들러
- 상세: 쉼표 입력 시 `setDraft(v.slice(0, -1))`가 먼저 실행된 후, 값이 이미 존재하면 `setDraft("")`가 호출되지 않아 draft에 중복 값 텍스트가 남음. Enter 트리거의 `commit` 함수는 동일 상황에서 `setDraft("")` 호출하여 동작이 비일관적.
- 제안: 중복 여부와 무관하게 쉼표 트리거 후 항상 `setDraft("")` 호출.

---

**[INFO] `apply-operation.test.ts` 누락 테스트 케이스**
- 위치: `apply-operation.test.ts`
- 상세: 다음 케이스 미커버:
  - `rename_field` 존재하지 않는 필드 대상 (no-op 검증)
  - `type_convert` boolean: `"false"` → `true` 반직관 케이스
  - `math_op` divide by zero 방어 동작
  - `date_op` add/subtract 결과가 ISO 문자열로 변환됨
  - `object_pick` root level (field 없음) - keys 외 필드가 완전히 제거되는 동작
  - `array_filter` 배열이 아닌 필드 대상 (no-op 검증)
- 제안: 위 케이스에 대한 테스트 추가.

---

**[INFO] `date_op` add/subtract 결과가 항상 ISO 문자열**
- 위치: `apply-operation.ts` `case "date_op"` add/subtract
- 상세: 원본 값 포맷(`"2024-01-15"`)과 무관하게 결과가 항상 ISO 8601 (`toISOString()`) 형태. 원본이 날짜만이면 시간 포함 ISO 문자열로 변환되어 downstream 처리에 영향.
- 제안: 원본 포맷 보존 또는 스펙에 "결과는 ISO 8601" 명시 후 UI에서 안내.

---

**[INFO] `object_pick` root level 시 나머지 키 완전 삭제**
- 위치: `apply-operation.ts` `case "object_pick"` (field 없음)
- 상세: `field`가 없으면 `picked` 객체만 반환하여 keys에 없는 모든 루트 키가 제거됨. 이 동작은 의도된 것이나 테스트 미커버이며, Preview에서도 이 동작이 명확히 드러나지 않음.
- 제안: 테스트 추가 및 UI caption에 "keys 외 모든 필드 제거" 문구 보완.

---

### 요약

Transform 노드의 프론트엔드 구현은 11가지 연산 타입을 UI로 구성하고, drag-and-drop 순서 변경, 실시간 Preview를 제공하는 등 요구사항의 핵심 기능을 충실히 구현했다. 그러나 `set_field`의 표현식 값이 Preview에서 평가되지 않아 실행과 Preview 간 불일치가 발생하고, `type_convert` boolean 변환의 반직관적 동작 및 `queueMicrotask`를 render 내에서 사용하는 React 안티패턴이 잠재적 버그를 유발할 수 있다. Preview의 오류 묵살 처리와 배열 루트 미지원도 사용자 경험을 저해한다. 핵심 로직(`apply-operation.ts`)의 보안(prototype pollution 방어)과 불변성(structuredClone) 처리는 잘 구현되었으나 테스트 커버리지가 부족하여 엣지 케이스 동작 보증이 어렵다.

### 위험도

**MEDIUM**