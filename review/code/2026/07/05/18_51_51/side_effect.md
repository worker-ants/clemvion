# 부작용(Side Effect) 리뷰 — rerun-modal.tsx typed 폼 전환 재조정 fix 검증

FOCUS: 이전 리뷰(18_37_10)의 WARNING — "fallback(all-string)→schema(typed) 전환 시 raw string paramValues 가 제출 payload 로 샐 수 있음" — 이 `useEffect([fields])` + `coerceInput` boolean 분기 추가로 올바르게 수정됐는지 검증.

## 발견사항

- **[INFO]** 재조정 effect 의 핵심 시나리오(fallback 구간 실사용자 typing → 전환 후 값)를 직접 검증하는 회귀 테스트 없음
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` (신규 4건, RESOLUTION.md #2)
  - 상세: 신규 테스트 4건은 모두 `await waitFor(...)` 로 스키마 로드(= `fields` 가 이미 typed 로 전환) 완료를 기다린 **이후에** `fireEvent.change`/`fireEvent.click` 을 수행한다. 즉 "스키마 로드 전 fallback text input 에 편집 → 로드 후 재조정" 이라는, 이번에 고친 정확한 타이밍(race)을 재현하는 테스트는 없다. 재조정 effect 자체는 코드 검토상 논리적으로 타당하지만(아래 확인), 회귀 시 감지할 자동 테스트가 없어 향후 리팩터링 시 조용히 깨질 수 있다.
  - 제안: `apiGetMock` 을 지연 resolve 시키고, resolve 전에 fallback text input(예: `flag` 또는 `count`) 에 `fireEvent.change` 로 raw string 을 입력 → 이후 schema resolve → typed 위젯의 값이 올바르게 native 타입으로 반영되는지 확인하는 테스트 1건 추가 권장. blocking 은 아님(fix 자체는 정적 분석상 correct).

- **[INFO]** `number` 타입 재조정에서 비정상적(non-numeric) 문자열이 남아있으면 `NaN` 으로 치환됨
  - 위치: `rerun-modal.tsx:266-281` (재조정 effect) + `coerceInput` number 분기(`Number(raw)`)
  - 상세: `coerced !== v` 비교에서 `coerced` 가 `NaN` 인 경우 `NaN !== v` 는 항상 `true`(NaN 은 자기 자신과도 `!==`)이므로 `changed=true`, `next[f.name]=NaN` 으로 대입된다. 실사용에서는 fallback 값이 원본 실행의 실제 파라미터 값(`String(3)` 등 항상 파싱 가능한 문자열)에서 시작하므로 트리거되기 어려운 edge case이지만, 만약 fallback 구간에 사용자가 숫자 필드에 비숫자 문자열(`"abc"`)을 입력한 채로 두면 전환 시 `NaN` 으로 조용히 대체된다. 이는 무한 루프를 유발하지 않음(아래 확인) — 순수 데이터 정합성 관점의 사소한 edge case.
  - 제안: 선택적으로 `Number.isNaN(coerced) ? raw : coerced` 형태로 파싱 실패 시 원문자열 유지(object/array 분기와 대칭)하면 더 안전하나, 실사용 확률이 낮아 non-blocking.

## 검증 결과 (FOCUS 3항목)

1. **활성 타이핑을 덮어쓰지 않는가 — 확인됨.** `fields` useMemo 의 의존성은 `[workflowNodes, originalParameters]` 뿐이며, 이 둘은 각각 React Query 데이터(`workflow-nodes`)와 `original.inputData` prop 파생값으로, `paramValues`/`setParam` 호출과는 무관하다. 따라서 사용자가 입력 필드에 타이핑(`setParam` → `setParamValues`)해도 `fields` 참조는 바뀌지 않고, `useEffect(..., [fields])` 는 재실행되지 않는다 — 활성 편집을 덮어쓸 경로가 없다.

2. **무한 루프 없음 — 확인됨.** 재조정 effect 내부 `setParamValues` updater 는 `changed=false` 인 경우(이미 typed 이거나 coerce 결과가 원값과 동일) `prev` 참조를 그대로 반환한다. React 는 setState updater 가 이전 state 와 `Object.is` 동일한 값을 반환하면 리렌더를 스킵(bail-out)하므로 추가 렌더/effect 트리거가 발생하지 않는다. 더 근본적으로, 이 effect 의 유일한 의존성(`fields`)은 `paramValues` 변경에 의해 갱신되지 않는 값이므로, 설령 매 호출마다 `changed=true` 가 나오더라도(예: `NaN` edge case) `fields`→effect→`paramValues` 갱신→`fields` 재계산으로 이어지는 피드백 루프 자체가 구조적으로 불가능하다.
   - 유일한 잠재 우려는 `workflowNodes = []` 라는 React Query 디폴트-배열 패턴(각 렌더마다 새 배열 리터럴 생성 가능 — data 가 undefined 인 동안)인데, 이는 이번 diff 로 신규 도입된 게 아니라 PR #390(`b7b6f3f20`) 부터 존재하던 기존 패턴이며 이미 `externalCall`/`dryRunDisabled` 두 useMemo 가 동일 의존성으로 사용 중이다. 이번 변경이 새로운 위험을 추가하지 않았다.

3. **`coerceInput` boolean 분기 — 확인됨.** `if (type === "boolean") return raw === "true";` 가 추가되어, 문자열 `"true"/"false"` 를 native boolean 으로 변환한다. 재조정 effect 와 결합해, fallback 구간에 boolean 필드가 문자열 상태(`displayValue` 의 `String(value)` 경로로 `"true"`/`"false"` 텍스트로 표시)였더라도 스키마 로드 후 native boolean 으로 정정되어 체크박스 `checked` 비교(`value === true || value === "true"`, 이중 방어)와 제출 payload(`inputOverride`) 모두 정확한 boolean 을 사용하게 된다.

## 부작용 범위 확인

- 시그니처/공개 API 변경 없음. `ReRunModalProps` 불변.
- 전역 상태/전역 변수 도입 없음. 신규 `useEffect` 는 컴포넌트 로컬 `paramValues` state 만 조작.
- 파일시스템/환경변수/네트워크 호출 부작용 없음 — 순수 클라이언트 상태 재조정.
- 이벤트/콜백 시그니처 변경 없음(`setParam`, `handleSubmit` 등 기존 유지).
- 기존 16개 테스트 전부 통과 확인(`npx vitest run src/components/executions/__tests__/rerun-modal.test.tsx` → 16 passed).

## 요약

이전 WARNING(fallback→typed 전환 시 raw string 잔류)을 해소하기 위해 추가된 `useEffect(..., [fields])` 재조정 로직은 의존성 설계(`fields` 가 `paramValues` 에 독립)와 `setParamValues` 의 `prev` 조기 반환(참조 동일 시 리렌더 스킵) 덕분에 활성 타이핑을 덮어쓰지 않고 무한 루프도 유발하지 않는다. `coerceInput` 의 신규 boolean 분기도 의도대로 문자열 `"true"/"false"` 를 native boolean 으로 정정한다. 코드 검토 기준으로 수정은 정확하고 부작용 없이 완결됐다고 판단하나, 정작 이 fix 가 고친 정확한 race(스키마 로드 전 fallback 입력 → 로드 후 값 확인)를 직접 재현하는 회귀 테스트가 없고, `number` 타입 재조정에서 `NaN` 관련 사소한 edge case 가 이론상 남아 있다 — 둘 다 non-blocking INFO 수준이다.

## 위험도

NONE
