### 발견사항

---

**[INFO] `ChipInput` — 컴포넌트 Props 문서 없음**
- 위치: `chip-input.tsx:7-14`
- 상세: `values`, `onChange`, `placeholder` props의 역할이 타입만으로는 충분히 표현되지 않습니다. `values` 중복 허용 여부, `onChange`가 언제 호출되는지(Enter, 쉼표, blur 모두) 등이 문서화되지 않았습니다.
- 제안: 인라인 주석으로도 충분하나, placeholder 기본값(`"Enter 또는 쉼표로 추가"`)이 영문이 아닌 점을 고려하면 props에 JSDoc 한 줄이라도 추가하면 국제화 작업 시 맥락을 보존할 수 있습니다.

---

**[WARNING] `defaultForType` — `preserve` 파라미터 동작이 문서화되지 않음**
- 위치: `defaults.ts:6-11`
- 상세: `preserve` 파라미터가 이전 operation의 `field` 값을 타입 변경 시 유지하는 역할임이 코드만 봐서는 즉시 파악하기 어렵습니다. 특히 `field`만 보존되고 나머지 속성(`from`, `to` 등)은 버려진다는 점이 비직관적입니다.
- 제안:
  ```ts
  /**
   * 타입 변경 시 field 경로를 유지한 채 해당 타입의 기본 operation을 반환합니다.
   * preserve에서 field 속성만 이전됩니다 (rename_field의 from/to 등은 이전되지 않음).
   */
  export function defaultForType(...)
  ```

---

**[WARNING] `TransformConfig` — `idState` 동기화 로직에 주석이 부족함**
- 위치: `index.tsx:88-102`
- 상세: `queueMicrotask`를 사용해 render 중 setState를 회피하는 비표준 패턴입니다. 현재 인라인 주석이 `"Sync in a microtask to avoid setState-during-render warnings."` 한 줄만 있어, 왜 `useEffect`가 아닌 `queueMicrotask`를 선택했는지, 이 접근의 trade-off(double render, stale closure 위험)가 문서화되지 않았습니다.
- 제안:
  ```ts
  // useEffect 대신 queueMicrotask를 사용하는 이유:
  // 이 render path는 부모로부터 operations 길이가 바뀌어 들어온 경우에만 실행됩니다.
  // useEffect는 paint 이후 실행되어 다음 render 전에 ids가 stale해지는 프레임이 생기지만,
  // queueMicrotask는 동일 task 내에서 동기적으로 flush되어 dnd-kit 드래그 상태와 정렬됩니다.
  ```

---

**[INFO] `ops.tsx` — 내부 헬퍼 컴포넌트 문서 없음**
- 위치: `ops.tsx:21-66` (`PathInput`, `MiniSelect`, `FieldLabel`)
- 상세: 세 컴포넌트가 모듈 내부 전용임에도 역할이 명확하지 않습니다. 특히 `PathInput`이 단순 `Input`이 아닌 `ExpressionInput`을 사용한다는 점(표현식 `{{ ... }}` 지원)이 문서화되지 않으면, 나중에 단순 Input으로 교체하는 실수를 유발할 수 있습니다.
- 제안: 함수 상단에 한 줄 주석 추가:
  ```ts
  // ExpressionInput을 사용해 {{ 표현식 }} 자동완성을 지원합니다.
  function PathInput(...)
  ```

---

**[WARNING] `apply-operation.ts` — 보안 관련 `BLOCKED_KEYS` 로직에 주석 부족**
- 위치: `apply-operation.ts:12`
- 상세: `BLOCKED_KEYS`는 prototype pollution 방지를 위한 보안 핵심 로직이지만, 왜 이 세 키가 차단되는지, 어떤 공격을 막는지 전혀 설명이 없습니다. 이는 보안 관련 코드에서 가장 중요한 문서화 대상입니다.
- 제안:
  ```ts
  // Prototype pollution 방지: 사용자 입력 경로가 객체 프로토타입 체인을 오염시키는 것을 차단합니다.
  // e.g., { field: "__proto__.isAdmin" } 형태의 경로를 무시합니다.
  const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  ```

---

**[INFO] `apply-operation.ts` — `evaluateCondition`의 `eq`/`neq`가 느슨한 비교(`==`) 사용**
- 위치: `apply-operation.ts:128-129`
- 상세: `==`를 사용하는 의도적인 설계(예: `"3" == 3` 허용)가 주석 없이 코드에 포함되어 있습니다. 일반적으로 TypeScript에서 `==`는 lint 경고 대상이므로, 의도임을 명시해야 합니다.
- 제안:
  ```ts
  case "eq":
    return fieldValue == compareValue; // 의도적 느슨한 비교: "3" == 3 허용
  case "neq":
    return fieldValue != compareValue; // 의도적 느슨한 비교
  ```

---

**[INFO] `apply-operation.ts` — `DATE_UNITS` 중복 정의**
- 위치: `apply-operation.ts:14-21`, `types/transform.ts` 마지막 줄
- 상세: `DATE_UNITS` 배열이 `types/transform.ts`와 `apply-operation.ts` 두 곳에 각각 정의되어 있습니다. 왜 import 대신 재정의했는지 주석이 없어 의도가 불명확합니다.
- 제안: 주석으로 이유를 명시하거나, `types/transform.ts`에서 import하도록 리팩터링 검토.

---

**[INFO] `preview.tsx` — `TransformPreview` 컴포넌트의 입력 데이터 우선순위 로직 문서화 필요**
- 위치: `preview.tsx:28-37`
- 상세: "실행 결과의 inputData가 있으면 우선 사용, 없으면 샘플 JSON 사용"하는 fallback 로직이 있지만, 이 동작이 사용자에게 보이는 UI 문자열로만 설명되고 코드 레벨 주석은 없습니다. `inputData`가 배열인 경우 무시되는 이유(`toDisplayObject`에서 null 반환)도 설명이 없습니다.
- 제안: `toDisplayObject` 함수와 `hasExecutionInput` 로직에 한 줄 주석 추가.

---

**[INFO] `types/transform.ts` — `TransformOperation` 유니온 타입의 `args?: unknown` 타입이 느슨함**
- 위치: `types/transform.ts:53-60`
- 상세: `string_op`와 `date_op`의 `args` 타입이 `unknown`으로 정의되어 각 operation별 허용 구조가 타입 레벨에서 표현되지 않습니다. 현재는 `ops.tsx`의 인라인 캐스팅(`args.search as string`)으로 처리하는데, 이 설계 결정의 이유(유연성 vs 타입 안전성 tradeoff)가 문서화되지 않았습니다.
- 제안: `// args 구조는 operation별로 다르며, 실행 시 각 handler에서 검증합니다.` 주석 추가.

---

### 요약

전반적으로 코드 구조와 네이밍이 명확하여 가독성은 양호합니다. 그러나 세 가지 영역에서 문서화 보완이 필요합니다: (1) `BLOCKED_KEYS`의 보안 의도가 주석 없이 노출되어 있고, (2) `TransformConfig`의 `queueMicrotask` 패턴처럼 비표준적 기술 결정의 근거가 기록되지 않았으며, (3) `eq`/`neq`의 의도적 느슨한 비교처럼 lint 경고를 유발할 수 있는 패턴에 이유가 없습니다. `DATE_UNITS` 중복 정의도 단일 진실 공급원(single source of truth) 원칙에 위배되어 유지보수 시 불일치 위험이 있습니다.

### 위험도

**LOW** — 기능 동작에는 문제없으나, 보안 의도 누락(`BLOCKED_KEYS`)과 비표준 패턴(`queueMicrotask`)의 문서 부재는 향후 잘못된 수정을 유발할 수 있습니다.