# 유지보수성(Maintainability) 리뷰

## 발견사항

### integration-configs.tsx

- **[WARNING]** 렌더 함수 본문 내 조건부 setState 호출이 패턴 이해를 어렵게 함
  - 위치: `integration-configs.tsx` L349–L361 (`Cafe24Config` 함수 내부)
  - 상세: `objectsEqual(externalFields, lastPropagated)` 가 false일 때 `setFieldRows` / `setLastPropagated` 를 렌더 본문에서 직접 호출하는 "derived-state update during render" 패턴은 React 공식 문서에서 허용하지만, 코드베이스 내 다른 컴포넌트에서는 관찰되지 않는 희귀 패턴이다. 추후 유지보수자가 이 블록이 "렌더 중 setState" 임을 즉시 인식하지 못할 경우 무한 루프 위험성 오해 또는 잘못된 수정을 할 수 있다. 인라인 주석이 있어도 그 복잡성을 완전히 해소하지는 못한다.
  - 제안: `useMemo`를 이용해 `externalFields` 를 메모화하고, `useEffect`(또는 별도 커스텀 훅 `useFieldRowsSync`)로 동기화를 분리하는 방식이 코드베이스 내 일반적 React 패턴과 일치하며 유지보수자의 인지 부담을 낮춘다. 단, 현재 구현이 React 팀 권장 패턴임은 주석으로 명시되어 있으므로 WARNING 수준으로 분류한다.

- **[INFO]** `objectsEqual` 함수의 값 비교가 `String()` 변환에 의존해 타입 의미를 숨김
  - 위치: `integration-configs.tsx` L316–L322
  - 상세: `String(a[k] ?? "")` 비교는 `1` 과 `"1"` 을 동일하게 취급한다. `fieldRowsToObject` 가 `Record<string, string>` 을 반환하므로 실질적 위험은 낮지만, 함수 시그니처가 `Record<string, unknown>` 을 받기 때문에 향후 `unknown` 값이 유입될 때 조용한 오동작 가능성이 있다. 함수 시그니처를 `Record<string, string>` 으로 좁히거나 엄격한 타입 비교를 추가하면 의도가 명확해진다.
  - 제안: `objectsEqual` 의 파라미터 타입을 `Record<string, string>` 으로 좁히거나, 사용처에서 명시적 캐스팅을 제거하고 타입을 일치시킨다.

- **[INFO]** `externalFields` 파생 로직이 렌더 본문에 인라인으로 위치해 가독성을 저하
  - 위치: `integration-configs.tsx` L345–L348
  - 상세: `config.fields` 를 `Record<string, unknown>` 으로 정제하는 로직이 렌더 함수 본문 중간에 위치한다. 이 변환은 `normalizeCafe24Fields` 와 개념적으로 중복되는 부분이 있다(이미 해당 함수는 `object` 타입을 처리한다). 별도 헬퍼로 추출하거나 `normalizeCafe24Fields` 호출 경로로 통합하면 중복이 줄어든다.
  - 제안: `config.fields` → `Record<string, unknown>` 정제를 별도 함수(예: `toFieldsObject`)로 추출하거나, `normalizeCafe24Fields` 에 직접 `config.fields` 를 전달하고 내부에서 타입 가드를 처리하도록 통합한다.

- **[INFO]** `Cafe24Config` 컴포넌트의 함수 본문 길이가 다소 증가함
  - 위치: `integration-configs.tsx` L324–L364
  - 상세: 변경 전 컴포넌트는 state 없이 간단한 파생·렌더 구조였으나, 변경 후 `useState` 2개 + 렌더 중 파생 상태 동기화 블록 + 핸들러 함수가 추가되어 약 40라인 이상의 로직이 JSX 반환 전 본문에 위치하게 됐다. 기능 분리 차원에서 state + sync 로직을 커스텀 훅(예: `useCafe24FieldRows`)으로 추출하면 컴포넌트가 단일 책임에 집중할 수 있다.
  - 제안: `fieldRows`, `lastPropagated`, 동기화 블록, `handleFieldRowsChange` 를 `useCafe24FieldRows(config, onChange)` 커스텀 훅으로 추출한다.

### cafe24-config.test.tsx

- **[WARNING]** 행 제거 테스트에서 DOM 쿼리 전략이 취약하고 중복 로직이 존재
  - 위치: `cafe24-config.test.tsx` L141–L151
  - 상세: `removeButton` 을 먼저 `querySelector("button:not([data-state])")` 로 찾고, 실패 대비 폴백으로 `candidateButtons[candidateButtons.length - 1]` 을 구한 뒤 `fireEvent.click(removeButton ?? targetButton)` 으로 양쪽을 다 시도한다. 이 이중 쿼리 패턴은 (1) 어떤 전략이 실제로 동작하는지 명확하지 않아 테스트 실패 시 원인 파악이 어렵고, (2) `removeButton` 이 null이어도 테스트가 통과할 경우 폴백에 의해 다른 버튼이 클릭될 수 있어 테스트 신뢰도가 낮아진다. `expect(targetButton).toBeTruthy()` 가 있지만 `removeButton` 의 null 여부는 assert 하지 않는다.
  - 제안: 단일 명확한 쿼리 전략을 선택한다. `data-testid="remove-field-row"` 같은 테스트 전용 속성을 `KeyValueEditor`/행 렌더에 추가하거나, `getByRole("button", { name: /remove|delete/i })` 처럼 접근성 기반 쿼리를 사용한다. 폴백 패턴과 이중 변수를 제거하면 테스트 의도가 명확해진다.

- **[INFO]** `ControlledCafe24` 헬퍼가 테스트 파일 내에서만 사용되나 타입이 느슨함
  - 위치: `cafe24-config.test.tsx` L24–L41
  - 상세: `initial` 타입이 `Record<string, unknown>` 으로 선언되어 있어 `Cafe24Config` 의 실제 `Config` 타입과 느슨하게 연결된다. 테스트 헬퍼 수준에서는 허용 가능하지만, 향후 `Config` 타입이 바뀌어도 이 헬퍼는 타입 오류를 잡아내지 못한다.
  - 제안: `Config` 타입을 `integration-configs.tsx` 에서 export하거나, 헬퍼의 `initial` 타입을 `Parameters<typeof Cafe24Config>[0]["config"]` 처럼 컴포넌트 props에서 파생시키면 타입 안전성이 높아진다.

- **[INFO]** 각 테스트에서 `vi.fn()` + `render(<ControlledCafe24 ...>)` 패턴이 반복됨
  - 위치: `cafe24-config.test.tsx` L49–52, L72–77, L97–106, L122–131, L162–167
  - 상세: 5개 테스트 모두 `const onChange = vi.fn()` + `render(...)` 로 시작한다. `beforeEach` 에서 공통 렌더 세팅을 추출할 수 있는 일부 케이스(초기값이 동일한 테스트들)가 있다. 현재 수준은 허용 가능한 중복이나, 테스트가 늘어나면 패턴 통일성을 위해 헬퍼 함수 `renderCafe24(initial)` 을 도입하는 것을 고려할 만하다.
  - 제안: 공통 초기값(`{ resource: "product", operation: "product_list" }`)을 상수로 추출하고, 필요 시 `renderCafe24(initial?, onChangeMock?)` 팩토리 함수를 도입한다.

---

## 요약

이번 변경은 "렌더 중 파생 상태 동기화" 라는 React 권장 패턴을 올바르게 적용해 버그를 수정했으며, 전반적인 네이밍·함수 분리 수준은 수용 가능하다. 다만 `Cafe24Config` 컴포넌트가 state 관리·동기화·이벤트 처리를 모두 직접 담당하게 되어 단일 책임 원칙이 느슨해졌고, 렌더 본문 내 setState 블록은 코드베이스 내 희귀 패턴이라 향후 유지보수자의 인지 부담을 높인다. 테스트 파일에서는 행 제거 버튼 탐색 로직의 이중 폴백 패턴이 테스트 신뢰도를 낮추는 점이 주의가 필요하다. `fieldRowsToObject` / `objectsEqual` 의 타입 시그니처 불일치도 소규모 기술 부채로 남아있다. 커스텀 훅 추출과 테스트 쿼리 전략 단일화가 권장된다.

## 위험도

LOW
