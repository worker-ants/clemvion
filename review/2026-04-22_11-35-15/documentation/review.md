### 발견사항

---

**[WARNING]** `handler-output.adapter.ts` JSDoc에 폐기된 함수명 잔류

- 위치: `toEngineFlatShape` 함수 JSDoc (전체 파일 컨텍스트 기준 ~line 105)
- 상세: JSDoc 문자열에 `` `applyPortSelection`, `stripSelectedPort` ``로 기재되어 있으나, 이번 변경으로 `stripSelectedPort`는 `stripControlFields`로 리네임되었음. 문서가 실제 코드와 불일치.
- 제안:
  ```ts
  // 변경 전
  * shape so that existing engine internals (`applyPortSelection`,
  * `stripSelectedPort`, downstream `$input.<field>` access) keep working

  // 변경 후
  * shape so that existing engine internals (`applyPortSelection`,
  * `stripControlFields`, downstream `$input.<field>` access) keep working
  ```

---

**[WARNING]** `condition-evaluator.util.ts` — 신규 공개 함수·타입에 JSDoc 전무

- 위치: `evaluateCondition`, `Condition`, `EvaluateOptions` (condition-evaluator.util.ts 전체)
- 상세: 이 유틸은 `if-else.handler`와 `switch.handler` 두 곳에서 공유하는 핵심 로직임에도 JSDoc이 없음. 특히 `strict` 옵션이 `eq`/`neq` 연산자에만 적용되는지, 모든 연산자에 적용되는지 코드만 보면 즉시 파악하기 어려움. `is_empty`, `is_not_empty`, `is_null`은 `value`가 불필요하지만 인터페이스에 `value?: unknown`으로만 표시되어 있어 어느 연산자에 값이 필요한지 명시 없음.
- 제안:
  ```ts
  /**
   * Evaluates a single condition against an input object.
   *
   * `strict` mode uses `===`/`!==` for `eq`/`neq`; loose mode (default) uses
   * `==`/`!=`. Numeric operators (`gt`, `gte`, `lt`, `lte`) always coerce via
   * `Number()`. Emptiness/null operators (`is_empty`, `is_not_empty`,
   * `is_null`) ignore `condition.value`.
   */
  export function evaluateCondition(...) { ... }
  ```

---

**[INFO]** `toEngineFlatShape` JSDoc의 "Phase 3 will remove this function" 주석 — 진행 여부 불명확

- 위치: `handler-output.adapter.ts` JSDoc 마지막 문장
- 상세: `"Phase 3 will remove this function along with the legacy cache."` 문구가 이번 변경 이후에도 그대로 남아 있음. Phase 3가 현재 진행 중인지, 완료되었는지, 혹은 계획이 변경되었는지 코드만으로는 알 수 없어 독자에게 혼란을 줄 수 있음.
- 제안: Phase 3 계획이 여전히 유효하면 예상 시점/이슈 링크를 추가하고, 계획이 변경되었으면 해당 문장을 제거.

---

**[INFO]** `SwitchConfig` / `SwitchCase` 인터페이스 — 신규 필드 미문서화

- 위치: `switch.handler.ts` 인터페이스 정의
- 상세: 이번에 추가된 `mode`, `strictComparison`(SwitchConfig), `condition`(SwitchCase) 필드에 인라인 JSDoc이 없음. `mode`가 생략될 때 기본값이 `'value'`라는 사실과, `condition`이 `mode: 'expression'`에서만 유효하다는 제약이 타입 선언만으로는 드러나지 않음.
- 제안:
  ```ts
  interface SwitchConfig {
    /** @default 'value' */
    mode?: SwitchMode;
    /** Required when mode is 'value'. Pre-resolved by the expression engine. */
    switchValue?: unknown;
    ...
    /** When true, uses `===` for value comparison instead of `==`. @default false */
    strictComparison?: boolean;
  }
  ```

---

**[INFO]** `IfElseConfig.strictComparison` 미문서화

- 위치: `if-else.handler.ts`, `IfElseConfig` 인터페이스
- 상세: `switch.handler`와 동일한 `strictComparison` 옵션이 추가되었으나 JSDoc이 없음. `condition-evaluator.util`로 위임된다는 사실도 주석으로 남아 있지 않음.
- 제안: 위 SwitchConfig 제안과 동일한 패턴으로 인라인 주석 추가.

---

**[INFO]** `switch.handler.ts` `matchByValue` — `==` 루스 비교 의도 미명시

- 위치: `switch.handler.ts:matchByValue` (private 메서드)
- 상세: `caseValue == switchValue`의 `==` 사용이 의도적 루스 비교임을 주석 없이는 ESLint 경고나 리뷰어의 실수 지적 대상이 됨. `condition-evaluator.util`의 `eq` 연산자가 `strict` 플래그를 받는 것과 대칭 구조임을 명시하면 유지보수 시 혼선을 줄일 수 있음.
- 제안:
  ```ts
  // Intentional loose equality: mirrors condition-evaluator's non-strict eq path.
  return caseValue == switchValue;
  ```

---

### 요약

전체적으로 회귀 원인을 설명하는 인라인 주석(test 파일의 `// Regression:` 블록, `stripControlFields` JSDoc의 항목별 이유 설명)이 잘 작성되어 있고 가장 중요한 변경(엔진 레벨 컨트롤 필드 누수 수정)은 충분히 문서화됨. 다만 `handler-output.adapter.ts` JSDoc에 폐기된 함수명(`stripSelectedPort`)이 잔류하고, 새로 추출된 공유 유틸리티 `condition-evaluator.util.ts`에 JSDoc이 전무하여 신규 기여자가 `strict` 옵션 동작 범위와 `value` 필드 필요 여부를 코드 트레이싱 없이 파악하기 어렵다. 나머지는 인터페이스 신규 필드 주석 누락으로 낮은 위험도임.

### 위험도

**LOW**