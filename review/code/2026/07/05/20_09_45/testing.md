# 테스트(Testing) 리뷰 — switch-value-asterisk (V-12)

대상: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/switch-config.test.tsx` (신규),
`codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` (`SwitchConfig` — `required={mode === "value"}` 1줄 추가).

## 발견사항

- **[INFO]** 커버리지가 asterisk 표시 여부에 국한, `SwitchConfig` 의 다른 필드/동작은 여전히 무테스트
  - 위치: `switch-config.test.tsx` 전체 / `logic-configs.tsx` `SwitchConfig` (라인 111~ 부근, `cases` 렌더링·`addCase`·`onChange` 파생 로직 등)
  - 상세: 이 디렉터리에는 `SwitchConfig` 를 다루는 기존 테스트가 전혀 없었다(신규 파일이 유일). 이번 변경은 정확히 필요한 스코프(asterisk 노출 whitelist 재현)만 커버하고 있어 diff 자체와는 정합적이나, `SwitchConfig` 의 나머지 표면(예: `mode` 변경 시 `switchValue` 초기화 여부, `cases` add/remove, `hasDefault` 플래그, `onChange` 파생 payload)은 여전히 회귀 안전망이 없다. `ParallelConfig`(`parallel-config.test.tsx`)는 필드 렌더링·기본값·onChange 전파까지 폭넓게 커버하는 것과 대비된다.
  - 제안: 이번 PR 스코프(asterisk) 밖이므로 필수는 아니나, `SwitchConfig` 전반 테스트를 별도 후속으로 고려. 최소한 이번 변경이 `switchValue` 자체의 `value`/`onChange` 배선을 깨지 않았는지 확인하는 스모크 테스트(예: `fireEvent.change` 후 `onChange` 호출 payload 검증)를 추가하면 "asterisk 만 보고 실제 값 배선은 안 봄" 갭을 줄일 수 있다.

- **[INFO]** `mode` 가 `"value"`/`"expression"` 외 임의 문자열(오타·미래 확장값)일 때의 동작 미검증
  - 위치: `switch-config.test.tsx` — 3개 케이스가 `"value"` / 미지정(default) / `"expression"` 만 다룸
  - 상세: `required={mode === "value"}` 는 순수 equality 비교라 `mode`가 예컨대 `"VALUE"`(대소문자 오류) 나 스키마에 없는 값일 때 asterisk 가 정상적으로 숨겨지는지(`false` 로 안전하게 fallback)는 별도 단언 없이도 로직상 자명하지만, "화이트리스트 재현" 이라는 커밋 취지상 backend `requiredWhen.equals` 배열과의 1:1 대응을 명시적으로 검증하는 테스트가 있으면 백엔드 스키마와의 향후 drift(예: `equals` 배열에 값 추가)를 프런트 테스트가 놓치지 않는다는 의도를 더 강하게 표현할 수 있다.
  - 제안: 선택사항. 현재 3케이스로 이분 로직(binary equality) 자체는 충분히 커버됨 — CRITICAL/WARNING 대상 아님.

- **[INFO]** `container.querySelector("span.text-red-500")` 는 클래스명 기반 구조적 쿼리로 `ExpressionInput` 리팩터에 취약
  - 위치: `switch-config.test.tsx` 라인 15(`asterisk = container.querySelector(...)`), 21, 27
  - 상세: 테스트가 접근성 속성(`aria-hidden="true"`) 이나 role 대신 Tailwind 유틸리티 클래스로 DOM 을 쿼리한다. `ExpressionInput` 내부에서 이 클래스명이 바뀌거나(디자인 토큰 전환 등) `text-red-500` 이 다른 요소(에러 메시지 등, 현재는 `text-red-400` 이라 충돌 없음 확인함)에도 쓰이게 되면 테스트가 silent 하게 깨지거나 오탐할 수 있다. 다만 파일 상단 주석("asterisk 는 ExpressionInput 이 `required` 시 렌더하는 `<span class="text-red-500">*</span>`")이 이 결합을 명시적으로 문서화해 의도를 분명히 하고 있고, 같은 디렉터리의 `logic-configs.tsx` 코드 자체가 정확히 `text-red-500` 클래스를 하드코딩하므로(라인 361 부근) 현재는 실제 구현과 100% 일치한다.
  - 제안: 더 견고한 대안으로 `screen.getByText("*")` 나 `aria-hidden` 속성 기반 쿼리, 혹은 `ExpressionInput` 에 `data-testid="required-asterisk"` 를 부여하는 방법이 있으나, 현재 방식도 실제 렌더 결과와 정확히 일치하고 파일 내 주석으로 결합을 문서화했으므로 INFO 수준 개선 제안에 그친다.

- **[INFO]** "asterisk 없음"(`mode=expression`) 케이스가 `queryBySelector` null 단언만 사용 — `ExpressionInput` 자체가 렌더되었는지(라벨 텍스트 등)는 별도 확인 안 함
  - 위치: `switch-config.test.tsx` 라인 24~27 (`mode=expression` 케이스)
  - 상세: `container.querySelector(...)` 가 `null` 이라는 사실만으로 "asterisk 가 의도적으로 숨겨졌다"를 증명하지만, 만약 `SwitchConfig` 자체가 예외를 던져 렌더가 통째로 실패해도(예: `mode=expression` 분기에서 다른 코드 경로가 깨졌다면) 이 단언은 여전히 통과할 수 있는 이론적 위험이 있다(렌더된 DOM 트리에 span 이 없으면 렌더 실패든 의도적 숨김이든 결과가 같음). 실제로는 `render()` 자체가 예외 시 throw 하므로 이 케이스는 실질적으로 안전하지만, "SwitchValue 필드 자체는 렌더됐다"는 것을 라벨 텍스트 등으로 함께 확인하면 의도가 더 명확해진다.
  - 제안: 선택사항. `container.querySelector('label')` 이나 `screen.getByText(/switchValue 라벨 텍스트/i)` 를 곁들여 "필드는 있지만 asterisk 만 없다"를 명시하면 가독성이 향상되나 현재도 테스트명·주석으로 의도가 충분히 표현되어 있어 필수는 아니다.

## 검증 사항 (문제 없음, 참고용)

- 새 테스트 3건 모두 실행 확인함(단독·디렉터리 전체 33건) — 전부 pass, 콘솔 경고 없음.
- `beforeEach` 에서 `useLocaleStore.setState({ locale: "en" })` + `cleanup()` 을 매번 실행해 테스트 간 격리를 보장(같은 디렉터리 `parallel-config.test.tsx` 와 동일 패턴, `cleanup()` 은 이 파일에서만 명시적으로 추가돼 있어 오히려 더 엄격함). 디렉터리 전체 실행(33건)에서 순서 의존성으로 인한 실패 없음을 확인.
- `text-red-500` 클래스는 `ExpressionInput` 내부에서 asterisk 전용으로 쓰이고, 에러 메시지(`syntaxError`/`scopeErrors`)는 `text-red-400`/기타 색상을 사용해 실제로 클래스 충돌이 없음을 소스에서 확인(`expression-input.tsx` 라인 361 vs 369).
- `ExpressionInput` 이 `bare` prop 없이 호출되는지 확인 — `bare=true` 시 `Label`(및 asterisk) 자체가 렌더되지 않는 조기 반환 경로가 있는데(`expression-input.tsx` 라인 352~354), `SwitchConfig` 의 `switchValue` 호출부는 `bare` 를 전달하지 않으므로 Label 경로가 정상 사용됨 — 테스트 전제가 실제 구현과 일치.
- `mode` 기본값(`config.mode ?? "value"`, `logic-configs.tsx` 라인 113)과 "기본값→asterisk" 테스트 케이스의 전제가 일치함을 소스로 확인.
- 커밋 diff 자체(`logic-configs.tsx` 변경분)는 `required` prop 전달 한 줄뿐이라 이 범위에 한정하면 테스트 커버리지는 충분하고 과함이 없다(over-testing 아님, under-testing 도 크리티컬 수준 아님).

## 요약

신규 `switch-config.test.tsx` 3건은 diff 로 추가된 `required={mode === "value"}` whitelist 로직의 세 가지 대표 분기(명시 `value`/기본값/`expression`)를 정확히 커버하며, 실제 렌더 결과(`ExpressionInput` 의 `text-red-500` asterisk span)와 소스 코드 검증 결과가 일치해 테스트가 검증하는 동작과 실제 구현 사이 괴리가 없다. `useLocaleStore.setState` + `cleanup()` 을 통한 테스트 격리도 적절하며 디렉터리 전체 실행에서도 순서 의존 문제가 없음을 확인했다. 다만 클래스명 기반 DOM 쿼리라는 구조적 결합, `mode` 이외 값(오타 등)에 대한 명시적 케이스 부재, `SwitchConfig` 나머지 로직(cases 관리 등)의 여전한 무테스트 상태는 이번 변경 스코프를 벗어나는 낮은 우선순위 개선 여지로 INFO 수준에서만 언급한다. 전반적으로 스코프에 맞는 적절하고 견고한 최소 테스트다.

## 위험도

NONE
