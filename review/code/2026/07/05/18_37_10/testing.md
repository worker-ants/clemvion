# 테스트(Testing) Review — rerun-modal typed form (V-14)

## 발견사항

- **[WARNING]** object/array 타입 필드(JSON 위젯) 테스트 부재
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` (신규 3건), `codebase/frontend/src/components/executions/rerun-modal.tsx` `displayValue`/`coerceInput` (object/array 분기)
  - 상세: 변경 코드는 `type: "object" | "array"` 필드를 JSON 문자열로 표시(`displayValue`)하고 편집 시 `JSON.parse` 로 coerce(`coerceInput`)하는 로직을 새로 추가했다. 그러나 신규 3개 테스트는 number/boolean 위젯과 new-tab 링크만 검증하고, object/array 위젯 렌더·JSON 직렬화·역직렬화 경로는 전혀 커버되지 않는다. FOCUS 프롬프트가 명시한 "object/array JSON" 경로가 실제로 테스트에 없다.
  - 제안: 아래 케이스를 최소 1개씩 추가.
    1. `type: "object"` 필드에 `{a:1}` 같은 원본 값이 들어왔을 때 텍스트 input 에 `'{"a":1}'` 로 렌더되는지(`displayValue` object 분기).
    2. 사용자가 JSON 텍스트를 수정 후 제출 시 `inputOverride` 에 파싱된 객체(`{a:1}`이 아닌 native object)가 실려 가는지(`coerceInput` 성공 경로).
    3. **엣지 케이스**: 잘못된 JSON(예: `"{invalid"`)을 입력했을 때 `coerceInput` 이 raw 문자열을 그대로 반환 — 이 상태로 제출 시 backend 에 malformed 문자열이 전송되는 동작이 의도된 것인지 최소 한 건이라도 문서화하는 테스트가 있어야 한다(현재는 코드 주석에만 "실패 시 raw 유지"로 설명되고 검증 테스트 없음).

- **[WARNING]** number 필드 빈 문자열(편집 중 상태) 및 잘못된 숫자 입력 케이스 미검증
  - 위치: `rerun-modal.tsx` `coerceInput` — `if (type === "number") return raw === "" ? "" : Number(raw);`
  - 상세: number 필드를 전부 지웠을 때(`raw === ""`) 빈 문자열을 그대로 보존하는 특수 분기가 있는데, 이 분기와 `Number("abc")` → `NaN` 이 되는 케이스 모두 테스트가 없다. `NaN` 이 `inputOverride` 에 담겨 전송되면 JSON.stringify 시 `null` 로 직렬화되어 백엔드가 이를 받아들이는지 불확실하다. 신규 테스트는 valid number(`3`)만 검증한다.
  - 제안: (a) number input 을 빈 문자열로 지운 뒤 제출 시 `inputOverride: { count: "" }` 로 가는지, (b) 비숫자 문자열 입력 시 동작(현재는 `NaN`)을 명시적으로 고정하는 회귀 테스트 추가.

- **[WARNING]** `useOriginalInput=true` 상태에서 typed 필드(checkbox 포함)가 disabled 되는지 검증 누락
  - 위치: 신규 테스트 3건, `rerun-modal.tsx` boolean 분기 `disabled={useOriginalInput}`, non-boolean 분기 `disabled={useOriginalInput} readOnly={useOriginalInput}`
  - 상세: 기존 11개 테스트 중 "Use original input 토글 ON 시 입력 폼이 read-only(disabled) 된다" 테스트는 fallback(text-only) 경로만 검증한다(`seedDefinitions([])`이므로 schema 없이 fallback field). typed 폼(schema 존재) 경로에서 `useOriginalInput` 토글 시 number/checkbox 위젯이 실제로 disabled 되는지는 어떤 테스트도 검증하지 않는다 — 이는 이번 diff 로 분기가 두 갈래(boolean label 안의 `input`, 그 외 `Input` 컴포넌트)로 나뉘었으므로 회귀 위험이 있는 지점이다.
  - 제안: typed 폼(schema 존재) 상태에서 `useOriginalInput` 토글 후 checkbox 와 number input 모두 disabled 확인하는 케이스 추가.

- **[INFO]** boolean 값이 문자열 `"true"`로 들어오는 legacy 케이스의 근거 테스트 부재
  - 위치: `rerun-modal.tsx` `checked={value === true || value === "true"}`
  - 상세: 이 이중 비교는 원본 `inputData.parameters.flag` 가 문자열로 저장된 legacy 데이터(예: 과거 텍스트 Input 으로 저장된 `"true"`)를 boolean 처럼 취급하기 위한 방어 코드로 보인다. 그러나 이 분기를 실제로 트리거하는 테스트가 없어 왜 이 코드가 필요한지, 향후 리팩터링 시 삭제해도 안전한지 판단할 근거가 없다.
  - 제안: `inputData: { parameters: { flag: "true" } }` (문자열) 케이스를 넣어 checkbox 가 checked 로 렌더됨을 검증하는 회귀 테스트 1건 추가 — 이 방어 로직의 존재 이유를 테스트로 문서화.

- **[INFO]** fallback 경로(스키마 부재)에서 boolean/number 원본 값이 여전히 text 로 렌더되는지에 대한 명시적 커버리지 약함
  - 위치: 신규 테스트, `rerun-modal.tsx` fields fallback 분기 (`type: "string" as const`)
  - 상세: PR 설명(CHANGELOG)은 "스키마 부재(노드 삭제 등) 시 원본 키 text fallback" 을 핵심 동작으로 강조하지만, 기존 11개 회귀 테스트 중 이 fallback 경로를 직접 겨냥한 것은 "기본(default) 입력 편집 모드에서 inputOverride 를 함께 전송한다"(`seedDefinitions([])` → `manual_trigger` 노드 자체가 없어 fallback) 정도이며, `originalParameters` 에 boolean/number 값이 섞여 있을 때 fallback 이 이를 **text** 로(타입 안 바뀌고) 렌더한다는 것을 직접 assert 하는 테스트는 없다. typed 폼과 fallback 폼의 차이(핵심 변경 포인트)를 나란히 보여주는 대조 테스트가 있으면 회귀 시 유용하다.
  - 제안: `manual_trigger` 노드는 있지만 `config.parameters` 가 없거나 빈 배열인 케이스, 그리고 `originalParameters` 에 `{flag: true}` 가 있을 때 여전히 text input(`type=text`)으로 렌더되는지 확인하는 테스트 추가(현재 스키마 배열이 빈 배열([])일 때의 fallback도 코드상 `schema.length > 0` 조건으로 분기되므로 이 경계값도 함께 커버 가능).

- **[INFO]** `workflowNodes` 쿼리 실패/로딩 지속 상태에 대한 테스트 없음
  - 위치: `rerun-modal.tsx` `useQuery<NodeData[]>({ ..., enabled: open })`, `default: []`
  - 상세: `getNodes` API 호출이 실패(reject)하는 경우 `workflowNodes` 는 빈 배열로 유지되어 fields 는 fallback 경로(원본 키 text)로 자연히 떨어지는 것으로 보이나, 이 경로(에러 상태)를 직접 검증하는 테스트는 없다. 우선순위는 낮음(엔지니어링상 자연 스러운 graceful degradation) — 다만 "스키마 부재 시 데이터 은닉을 피한다"는 diff 의 안전성 주장을 완전히 뒷받침하려면 API 에러 케이스도 하나 커버하면 좋다.
  - 제안: 낮은 우선순위. 시간이 없다면 생략 가능.

## 요약

신규 3개 테스트는 이번 PR 이 명시한 세 가지 핵심 변경(new-tab ID 링크, number/boolean typed 위젯, boolean 토글→native boolean 전송)을 정확히 겨냥해 잘 작성되었고, 기존 11개 회귀 테스트도 리팩터링(paramKeys→fields, handleParamChange→setParam) 이후에도 유효한 fallback 경로(스키마 부재, `seedDefinitions([])`)를 그대로 사용하므로 깨지지 않는다. Mock 구성(`apiClient`, `next/navigation`, `sonner`)과 `waitFor`/`seedDefinitions` 헬퍼 사용은 기존 패턴과 일관되고 격리도 양호(`beforeEach`의 `vi.clearAllMocks`/`cleanup`). 다만 diff 가 실제로 도입한 `object`/`array` JSON 위젯 경로(coerceInput/displayValue 의 JSON.parse 분기)가 테스트에서 완전히 누락되어 있고, number 필드의 빈 문자열·비숫자 입력 같은 엣지 케이스, typed 폼에서의 `useOriginalInput` disabled 상태, boolean 문자열 legacy 값 방어 로직의 근거 테스트가 빠져 있다 — 이들은 모두 이번 diff 가 새로 만든 분기(따라서 아직 아무 테스트도 커버한 적 없는 코드)이므로 커버리지 갭으로 본다. Critical 수준은 아니며(핵심 3개 시나리오는 검증됨), 후속 커밋에서 보강 권장.

## 위험도

LOW
