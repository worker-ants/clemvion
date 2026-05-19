### 발견사항

- **[WARNING]** `warningRule.when` 표현식과 `requiredWhen` 정책 간 의미 불일치 잔존
  - 위치: `switch.schema.ts` — `warningRules[0].when: 'mode != expression && !switchValue'`
  - 상세: `requiredWhen`은 화이트리스트 `equals: ['value']`로 정준화되었지만, 같은 파일의 `warningRule.when` 표현식은 여전히 블랙리스트 논리인 `mode != expression`을 사용한다. 두 조건의 의미는 현재 enum(`'value'`/`'expression'`) 기준으로 동치이나, 향후 신규 mode(`'range'`, `'literal'` 등)가 추가되면 `warningRule`은 신규 mode에도 자동 적용되는 반면 `requiredWhen`은 `['value']`만 적용된다. 즉 UI 필수 표시(asterisk)와 캔버스 경고 배지(⚠️)가 불일치하는 상황이 발생한다. consistency-check I-2에서 "warningRule.when 도 동기화 검토" 단계 추가를 권고했으나 spec §8.2에만 가이드라인으로 기록됐고 코드는 수정되지 않았다.
  - 제안: 즉각 수정 필요성은 현재 enum 2개 기준으로 낮지만, mode 확장 시 반드시 `warningRule.when`도 `mode == value && !switchValue`로 전환해야 함을 코드 주석에 명시하거나, 이번 PR 범위에서 함께 전환하는 것을 고려. plan I-2 FIXED 처리로 기록되어 있으나 실제 코드 변경은 없음 — 추적 가능한 별 follow-up 항목으로 분리 권장.

- **[WARNING]** `matchesVisible` 함수에서 `equals`가 array일 경우 처리 누락
  - 위치: `visibility.ts` — `matchesVisible` 함수, 특히 `if ("equals" in rule) return value === rule.equals;`
  - 상세: `requiredWhen`은 `equals`가 array이면 `Array.isArray` 분기로 whitelist 평가하도록 `matchesRequired`에서 분리되었다. 반면 `matchesVisible`의 `equals` 분기는 여전히 `value === rule.equals`로만 평가한다. `visibleWhen`의 타입 정의(`{ field: string; equals: unknown }`)는 단일 값만 허용하므로 현재는 문제없지만, 향후 `visibleWhen`도 동일 정책으로 통합 정리할 때(`visibleWhen DSL 통합 정리` follow-up) 개발자가 `matchesVisible`에도 배열 분기를 추가하지 않으면 동작 불일치가 생긴다.
  - 제안: `matchesVisible` 내부 `equals` 분기에 "단일 값만 — array 확장은 visibleWhen DSL 통합 정리 follow-up 시 matchesRequired 패턴 참조" 주석을 달아 후속 확장 시 놓치지 않도록 가이드.

- **[INFO]** `requiredWhen.equals`의 타입 표현 모호성 — `unknown | readonly unknown[]`
  - 위치: `node-component.interface.ts:299` 및 `types.ts:1141`
  - 상세: `equals: unknown | readonly unknown[]`는 TypeScript 관점에서 `unknown`이 `readonly unknown[]`를 포함하므로 사실상 `equals: unknown`과 동일하게 해석된다. 런타임 `Array.isArray` 분기로 동작은 올바르지만, 타입 수준에서 "단일 값 vs 배열" 의도가 전혀 표현되지 않는다. 잘못된 값(예: `equals: { a: 1 }` 객체)을 넘겨도 타입 오류가 발생하지 않는다.
  - 제안: `equals: unknown | readonly unknown[]` 유지가 불가피하다면 JSDoc에 "배열이면 whitelist 평가, 객체는 미지원" 명시. 더 안전하게는 `equals: string | number | boolean | null | readonly (string | number | boolean | null)[]` 같은 좁은 타입을 채택하는 것을 검토. 단, 기존 carousel/http-request 사용처에 영향이 없는지 확인 필요.

- **[INFO]** `switch.schema.ts` plan 표(L1440)의 `notEquals` 표기 잔존 가능성
  - 위치: `plan/in-progress/node-config-required-defaults-sweep.md` — `## 적용 대상 / Commit 2 — Logic` 표
  - 상세: 해당 표 L1440에 `ui.requiredWhen: { field: 'mode', notEquals: 'expression' }` 표기가 코드 변경 이전 원안 그대로 남아 있다. 이는 이미 `equals: ['value']`로 마이그레이션이 완료된 후의 상태와 불일치하여, plan을 보는 사람에게 혼란을 준다. plan은 "과거 결정 기록"과 "현재 상태"를 혼용하고 있어 추적성이 낮아진다.
  - 제안: plan 표의 switch 행을 `equals: ['value']`로 갱신하거나, 취소선으로 처리 후 "requiredwhen-dsl-whitelist 로 마이그레이션" 주석 추가.

- **[INFO]** 빈 배열 화이트리스트 테스트 추가는 긍정적이나 `null`/`undefined` config 값 케이스 미포함
  - 위치: `visibility.test.ts` — `isFieldRequired` 테스트 블록
  - 상세: `equals: ['value']`에 대해 `config[field]`가 `null` 또는 `undefined`인 경우(`config` 자체에 키가 없는 경우)의 동작이 명시적으로 테스트되지 않는다. `matchesRequired`에서 `value = config[rule.field]`는 `undefined`가 되고 `['value'].includes(undefined)`는 `false`를 반환하므로 동작은 올바르다. 그러나 이 케이스가 테스트로 보장되지 않아 향후 `matchesRequired` 수정 시 회귀를 감지하지 못할 수 있다.
  - 제안: `config` 에 해당 field 키가 없을 때의 케이스(`{}`) 하나를 whitelist 테스트에 추가. 예: `isFieldRequired(ui, 'f', [], {})` 가 `false`임을 명시.

### 요약

이번 변경은 `requiredWhen` DSL을 `notEquals`/`oneOf` 블랙리스트 형태에서 `equals: T | T[]` 화이트리스트 단일 shape으로 정준화한 일관성 있는 리팩터링이다. 인터페이스 타입 변경(백엔드·프론트엔드 mirror), 런타임 평가 로직 분리(`matchesRequired`), 사용처 마이그레이션(`switch.schema.ts`), 테스트 갱신이 원자적으로 함께 적용되어 기능 완전성은 높다. 단, `warningRule.when` 표현식이 여전히 블랙리스트 논리(`mode != expression`)를 사용하고 있어, 향후 mode 확장 시 UI 필수 표시와 캔버스 경고 배지 간 불일치 위험이 잠재한다. `equals: unknown | readonly unknown[]` 타입 표현의 모호성도 타입 안전성 관점에서 개선 여지가 있다. 두 사안 모두 현재 enum 2개 체계에서는 실제 결함을 일으키지 않으나, 확장성 관점에서 추적 가능한 follow-up 항목으로 관리할 것을 권장한다.

### 위험도

LOW
