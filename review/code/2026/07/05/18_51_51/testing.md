# 테스트(Testing) Review — Re-run 모달 typed 폼 (V-14) 후속 검증 (18_51_51)

FOCUS: 이전 리뷰(18_37_10)에서 지적된 갭 — object/array JSON 테스트, "Use original
input" ON 시 typed checkbox 도 disabled 되는지 — 두 건이 실제로 추가됐는지, 그리고
그 추가가 충분한지 검증.

## 발견사항

- **[INFO]** 지적된 두 갭은 실제로 해소됨 — 테스트 파일·실행 결과로 확인
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:361-398`(object JSON), `:400-436`(useOriginalInput typed-disable)
  - 상세: `rerun-modal.test.tsx` 는 이전 14건에서 16건으로 늘었고(`grep -c "it("` = 16), `npx vitest run rerun-modal.test.tsx` 로 직접 실행해 16/16 통과를 확인했다. 두 신규 테스트는:
    - "object 필드는 JSON 으로 표시하고 편집 시 파싱해 native 값으로 전송한다" — `{a:1}` → 표시 `'{"a":1}'` 확인 → `fireEvent.change` 로 `'{"a":2}'` 입력 → 제출 시 `inputOverride: { meta: { a: 2 } }` (native object, 문자열 아님) 로 전송됨을 검증. displayValue/coerceInput 의 JSON 직렬화·역직렬화 왕복을 실질적으로 커버.
    - "Use original input ON 시 typed 위젯(checkbox)도 disabled 된다" — 스키마 로드 후 typed checkbox 렌더 확인 → 토글 클릭 → `flag` input 이 `toBeDisabled()` 확인. RESOLUTION #1(disabled prop 이 boolean 분기에도 정확히 전달되는지)을 직접 검증.
  - 두 테스트 모두 기존 헬퍼(`seedDefinitions`, `renderModal`, `waitFor`)를 재사용해 스타일이 일관되고, 테스트명이 한국어로 검증 의도(무엇을 typed 로 렌더하고 무엇을 전송하는지)를 명확히 서술한다.

- **[INFO]** `array` 타입은 object 와 동일 코드 경로(`type === "object" || type === "array"`)이지만 여전히 전용 테스트가 없음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:129`(`displayValue`), `:144`(`coerceInput`) — 두 함수 모두 object/array 를 동일 분기로 묶어 처리
  - 상세: 추가된 object 테스트가 `type === "object" || type === "array"` 분기 자체는 실행하므로 로직 커버리지 공백은 아니다(동일 코드 경로). 다만 `fields` 스키마 매핑에서 `type: "array"` 값이 그대로 `RerunField.type` 에 전파되는지(즉 `field.type === "boolean"` 분기를 타지 않고 default text-with-JSON 분기로 가는지)는 별도로 확인되지 않았다 — 현재 분기 조건이 `field.type === "boolean"` 하나뿐이라 실질 위험은 낮지만, 향후 `field.type` 분기가 늘어나면(예: `"array"` 전용 위젯 추가) 이 테스트 부재가 회귀를 놓칠 수 있다.
  - 제안: 우선순위 낮음(INFO) — 현재 구조상 object 테스트가 array 를 사실상 대리 커버하므로 필수 추가는 아니나, `{ name: "tags", type: "array" }` 스키마로 한 줄만 파라미터화하면 명시적으로 닫을 수 있는 갭.

- **[INFO]** JSON.parse 실패(malformed 입력) 시 raw 문자열 유지 경로(`coerceInput` catch 분기)는 여전히 미테스트
  - 위치: `rerun-modal.tsx:144-149` (`try { JSON.parse(raw) } catch { return raw; }`)
  - 상세: 사용자가 object/array 필드에 `{"a":` 같은 불완전 JSON 을 입력 중일 때 "편집 중 부분 입력 허용"을 위해 raw 문자열을 그대로 반환하는 분기다. 이 경로가 테스트되지 않으면 (a) 실제로 부분 입력 중 인풋이 그대로 유지되는지, (b) 그 상태로 제출을 누르면 무엇이 전송되는지(문자열 그대로 `inputOverride` 로 새는지)가 검증되지 않는다. RESOLUTION 항목 5(requirement/INFO, "JSON 실패 미표시")도 이 지점을 이미 언급했으나 "조치 불요"로 처리됐다 — UI 표시 여부는 그렇다 쳐도, **제출 시 malformed 문자열이 그대로 서버에 전송될 수 있다는 사실은 여전히 테스트되지 않은 채 남아 있다.**
  - 제안: 선택적. `fireEvent.change(input, { target: { value: '{invalid' } })` 후 제출 → `inputOverride.meta` 가 문자열 `'{invalid'` 그대로 전송되는지(혹은 백엔드가 어떻게 처리하는지 문서화하는 차원의) 회귀 테스트를 추가하면 이 known-limitation 이 향후 silent 하게 바뀌는 것을 방지할 수 있다. 차단 사유 아님.

- **[INFO]** RESOLUTION #1 의 "재조정(reconciliation) effect" 자체를 직접 노리는 테스트는 없음 — 두 신규 테스트는 이미-typed 스키마가 로드된 상태만 검증
  - 위치: `rerun-modal.tsx:260-281` (`useEffect(() => { ... }, [fields])`, fallback string → typed 값 1회 재조정)
  - 상세: side_effect WARNING 을 유발했던 실제 시나리오는 "스키마 로딩 전(fallback, all-string) 구간에 사용자가 값을 편집 → 스키마 로드 완료로 `fields` 가 typed 로 전환 → 이미 입력된 string 값이 재조정되어야 함"이다. 그런데 추가된 두 테스트(object/useOriginalInput)는 모두 `apiGetMock` 이 처음부터 `manual_trigger` 스키마를 반환하도록 설정하고, `seedDefinitions` 로 정의 스토어도 함께 세팅한다 — 즉 "스키마 로드 전 fallback 편집" 구간이 테스트에 존재하지 않고, 이미 정의된 최종 상태에서의 렌더/제출만 검증한다. 기존 테스트("manual_trigger config.parameters 스키마 기반 typed 폼을 렌더한다")도 마찬가지로 초기값(`count: 3, flag: true`)이 이미 number/boolean native 타입이라 재조정 effect 가 개입할 필요가 없는 케이스다.
  - 실제 재조정 effect 가 개입하는 시나리오(예: `apiGetMock` 응답을 지연시키고 그 사이 `fireEvent.change` 로 text input 에 `"true"` 문자열을 입력 → 이후 스키마 도착 → `flag` 값이 boolean `true` 로 재조정되어 checkbox 로 정확히 렌더되는지)는 여전히 미검증이다. 이는 **RESOLUTION #1 이 해결한 바로 그 버그의 회귀 방지 테스트가 없다**는 뜻 — side_effect WARNING 의 fix 자체(재조정 effect)는 존재하지만, 이 fix 를 직접 겨냥한 테스트는 이번 라운드에서도 추가되지 않았다.
  - 제안: `apiGetMock.mockImplementation` 으로 resolve 를 지연(예: `new Promise((resolve) => setTimeout(...))` 혹은 `deferred` 패턴)시켜 (1) 초기 렌더에서 fallback text input 에 `"true"` 입력 (2) 이후 스키마 resolve (3) `flag` 가 checkbox 로 전환되고 값이 boolean `true` 로 유지되는지 검증하는 테스트를 추가하면 이 effect 의 실제 목적을 회귀로부터 보호할 수 있다. WARNING 은 아니나, side_effect 리뷰가 지적한 버그의 직접적 재현 테스트 부재이므로 INFO 로 남긴다.

- **[INFO]** Mock 적절성 — `apiGetMock`/`apiPostMock`/`useNodeDefinitionsStore` mock 은 실제 동작과 괴리 없이 적절
  - 상세: `apiClient` 모듈 전체를 mock 하되 실제 axios response shape(`{ data: { data: [...] } }`)를 그대로 흉내내고, `useNodeDefinitionsStore.setState` 로 실제 zustand 스토어 상태를 직접 세팅해 컴포넌트가 실제 훅을 그대로 사용하도록 한다 — 과도한 mock 이 아니며 컴포넌트-스토어 통합 지점을 실제로 태운다. `waitFor` 로 react-query 의 비동기 `getNodes` 해석을 기다리는 패턴도 실제 렌더 타이밍과 일치한다.

- **[INFO]** 테스트 격리 — `beforeEach` 의 `vi.clearAllMocks()`/`cleanup()`/스토어·mock 리셋으로 각 테스트가 독립적. 신규 4개 테스트도 동일 패턴을 따르며 상호 의존 없음.

## 요약

이전 라운드(18_37_10)에서 지적된 두 갭 — object/array JSON 위젯 경로, Use original
input ON 시 typed(checkbox) 위젯 disable — 은 실제로 테스트가 추가됐고
(`rerun-modal.test.tsx` 14→16건), `npx vitest run` 으로 16/16 통과를 직접 확인했다.
두 테스트 모두 실제 동작(JSON 직렬화 왕복·disabled prop 전달)을 정확히 겨냥하며
기존 테스트 스타일과 일관되어 가독성도 좋다. 다만 완전한 클로저는 아니다: (1) `array`
타입 전용 테스트는 여전히 없음(object 와 동일 코드 경로라 실질 위험은 낮음), (2)
JSON.parse 실패 시 raw 문자열이 그대로 제출될 수 있는 known-limitation 경로가
미검증, (3) 가장 중요하게 — 이번 PR 의 핵심 side_effect 수정인 "fallback(스키마
로딩 전) 구간에 편집된 string 값이 스키마 도착 후 재조정되는지"를 직접 재현하는
테스트가 없다(신규 테스트들은 모두 스키마가 이미 로드된 상태에서만 검증). 세 항목
모두 INFO 수준으로, 이번 라운드에서 요청된 두 갭 자체는 충분히 해소되었으나 회귀
방지 관점에서 추가 여지가 남아 있다.

## 위험도

LOW
