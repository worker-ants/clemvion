# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `visibility.ts` 내부 함수명 리팩토링 — `matches` → `matchesVisible`
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` 라인 3-8 (diff hunk)
  - 상세: 기존 `matches(rule: Rule, ...)` 함수가 `matchesVisible(rule: VisibleRule, ...)`로 이름 변경되고, `Rule` 타입 별칭도 `VisibleRule`로 교체됨. 이 변경 자체는 `requiredWhen` DSL 단일화 작업과 직접 관련은 없으나, `matchesRequired`를 추가하기 위해 기존 함수명에 `Visible` 접미어를 부여한 결과물이다. 새로운 `matchesRequired` 함수가 별도 분기 로직을 필요로 하기 때문에 분리가 불가피했으며, 함수명 정렬은 코드 가독성 유지 측면에서 자연스러운 수반 변경으로 볼 수 있다. 작업 의도와 무관한 독립적 리팩토링은 아니다.
  - 제안: 현 수준의 이름 정렬은 허용 가능. 단, 독립 리팩토링으로 간주될 소지가 있으므로 커밋 메시지에 "함수 분리에 따른 rename" 임을 명시하면 충분.

- **[INFO]** `visibility.ts` JSDoc 주석 추가 — `isFieldRequired` 함수에 날짜/작성자 인라인 주석 삽입
  - 위치: `visibility.ts` diff 라인 +42 ~ +44 (JSDoc 내부 3줄 추가)
  - 상세: `isFieldRequired` 함수 JSDoc에 "2026-05-19 정준화 — `requiredWhen` 은 단일 shape …" 설명이 추가됨. 구현 변경 내용을 JSDoc으로 문서화하는 것은 작업 범위 내 행위이나, 날짜와 작성자 이름을 코드 JSDoc에 직접 박는 패턴은 다른 파일들의 주석 스타일(날짜/작성자 없이 의도만 기술)과 혼재되어 있다. `switch.schema.ts`와 `logic-ui-required.spec.ts`의 인라인 주석도 동일 패턴을 사용하고 있어 이번 PR 내에서 일관성은 유지됨. 기능 변경 설명이 주 목적이므로 주석 자체는 범위 내.
  - 제안: 날짜·작성자 기록 방식을 git log로 대체하고 JSDoc에서는 제거하는 것이 장기적으로 더 깔끔하나, 이번 PR의 범위 일탈은 아님.

- **[INFO]** `node-component.interface.ts` JSDoc에 `visibleWhen`과 형태 비교 문장 삭제
  - 위치: `node-component.interface.ts` diff 라인 -45 ~ -49 (기존 JSDoc 일부 교체)
  - 상세: 기존 주석 "Same shape as `visibleWhen`." 문구가 삭제되고 단일 shape 설명으로 교체됨. `requiredWhen`이 더 이상 `visibleWhen`과 같은 shape를 공유하지 않으므로 이 삭제는 정확하고 필요한 문서 갱신이다. 범위 내.
  - 제안: 없음.

- **[WARNING]** `warningRule` DSL의 `mode != expression` 조건과 `requiredWhen: { equals: ['value'] }` 간 의미적 불일치 잔존
  - 위치: `switch.schema.ts` 라인 722-726 (`warningRules` 블록)
  - 상세: `warningRules`의 `switch:value-mode-needs-switch-value` 규칙은 여전히 `mode != expression && !switchValue` 조건을 사용 (블랙리스트 방식)이며, 이번 PR의 핵심 목표인 화이트리스트 전환과 상충한다. JSDoc 주석(라인 718-722)에서도 "Default mode is 'value' (zod default), so the rule must also fire when `mode` is missing" 라며 `notEquals` 방식을 의도적으로 유지한다고 명시되어 있다. `requiredWhen`은 화이트리스트로 바뀌었지만 `warningRules`는 블랙리스트 방식을 유지함 — 둘이 의미가 달라졌다. PR 범위(requiredWhen DSL 단일화) 내의 사안이기는 하나, `warningRules`를 변경하지 않은 것이 의도적 결정인지 누락인지 불명확하다. 기존 `notEquals` 동작(`mode == undefined`일 때도 발동)을 `warningRules`에서 유지하려는 의도라면 주석이 이를 충분히 설명하지만, `requiredWhen`과의 의미 분기가 발생했다는 사실은 코드를 읽는 후속 개발자에게 혼란을 줄 수 있다.
  - 제안: `switch.schema.ts`의 `warningRules` 주석에 "requiredWhen의 equals 화이트리스트와 달리 warningRules는 mode가 undefined인 초기 상태도 포함하기 위해 `!= expression` 유지"를 한 줄 추가해 명시적으로 분기 이유를 기록하면 충분.

## 요약

이번 변경은 `requiredWhen` DSL을 `{ field, notEquals }` / `{ field, oneOf }` 세 가지 형태에서 `{ field, equals: value | array }` 단일 형태로 통일하는 작업이며, 변경 파일 6개(인터페이스 2, 스키마 1, 구현 1, 테스트 2) 모두 해당 목적에 집중되어 있다. 부수 변경으로 `matches` → `matchesVisible` 함수 rename이 포함되었으나 이는 `matchesRequired` 분리를 위한 필수 수반 변경이다. JSDoc 내 날짜·작성자 인라인 기록은 코드베이스 다른 주석 스타일과 혼재될 소지가 있으나 범위 이탈은 아니다. 주목할 점은 `warningRules`의 `mode != expression` 조건이 블랙리스트 방식으로 그대로 남아있어 `requiredWhen`의 화이트리스트 방식과 의미가 분기되었다는 점인데, 이것이 의도적이라면 해당 이유를 주석에 명시하는 것이 권장된다. 전체적으로 변경 범위는 요청 의도에 부합하며, 무관한 수정이나 불필요한 기능 확장은 발견되지 않았다.

## 위험도

LOW
