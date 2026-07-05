# 부작용(Side Effect) 리뷰 — rerun-modal typed form (V-14)

## 발견사항

- **[WARNING]** `fields` 전환 시 `paramValues` 는 재파생되지 않음 — 스키마 늦게 도착하면 이미 사용자가 입력한 text-fallback 값이 잘못된 타입인 채로 남는다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:186-198`(초기화/리셋 `useEffect`), `:239-254`(`fields` `useMemo`)
  - 상세: 모달이 열리면 `workflowNodes` 쿼리가 완료되기 전까지 `fields` 는 `originalParameters` 키 기반 전부 `type:"string"` fallback 이다. 이 구간에 사용자가 예컨대 `flag` 필드를 텍스트로 편집(`"true"`, `"yes"` 등 임의 문자열)하면 `setParam` 이 `paramValues.flag` 에 **raw string** 을 그대로 저장한다. 이후 스키마가 로드되어 `fields` 가 `boolean` 타입으로 바뀌어도, `paramValues` 를 스키마 타입에 맞게 재조정(coerce)하는 로직이 없다 — `useEffect(..., [open, originalParameters])` 뿐이라 `workflowNodes`/`fields` 변경은 트리거하지 않는다. 결과적으로 체크박스는 `checked={value === true || value === "true"}` 가드 덕에 안전하게 unchecked 로 표시되지만, 사용자가 fallback 구간에 입력한 문자열이 checkbox 렌더 전환 후에도 `paramValues` 에 잔류하다가 그대로 제출(`inputOverride: paramValues`)될 수 있다. 스키마 로딩은 보통 수 백ms 내 완료되므로 실사용 노출 창은 좁지만, 느린 네트워크·리페치 상황에서는 "fallback 구간 동안 입력 → 이후 typed 위젯으로 전환" 편집 순서가 실제로 가능하다.
  - 제안: `fields` 가 fallback(all-string)에서 스키마 기반으로 전환되는 순간, 새 스키마 타입에 맞춰 `paramValues` 를 1회 재조정하는 effect(`useEffect(() => { ... }, [fields])`, 이미 처리된 값은 skip)를 추가하거나, 최소한 object/array/number/boolean 타입 필드에 한해 fallback 단계 렌더를 disabled 처리해 편집 자체를 막는 것을 고려.

- **[INFO]** `coerceInput` 의 number 필드 빈 문자열 처리 — 제출 시 원본 타입과 다른 값(`""`)이 전송될 수 있음
  - 위치: `rerun-modal.tsx:1131-1141`(`coerceInput`)
  - 상세: `type === "number"` 이고 `raw === ""` 이면 그대로 `""` (string) 을 반환한다(편집 중 상태 보존 목적, 주석에 명시). 사용자가 number 필드를 지우고 그대로 제출하면 `inputOverride.count = ""` 로 backend 전송된다. backend `resolveTriggerParameters`/`coerceToType` 가 이 빈 문자열을 어떻게 처리하는지가 관건 — required 필드면 검증 실패(400)로 이어지는 것이 기대 동작과 일치하겠지만, optional 필드에서 `""` 이 `NaN`/`0`/누락과 다르게 해석될 여지가 있다. 코드 자체의 새 전역 부작용은 아니고 순수 로컬 상태이므로 CRITICAL 은 아니나, 제출 직전 최종 coercion(예: trim 후 빈 문자열이면 필드를 `inputOverride` 에서 제외) 유무를 확인할 가치가 있다.
  - 제안: 제출 시점(`handleSubmit`)에서 number 필드의 `""` 잔존값을 필터링(delete) 하거나 backend 계약을 명시적으로 재확인. 현재 diff 범위 밖이면 후속 이슈로 기록.

- **[INFO]** boolean 필드 `checked` 판정이 이중 조건(`value === true || value === "true"`)이라 값 표현이 뒤섞일 수 있음을 스스로 인정하는 방어 코드
  - 위치: `rerun-modal.tsx:1340`
  - 상세: 이는 위 WARNING 이 지적한 fallback→typed 전환 구간의 문자열 오염을 이미 예상한 방어적 코딩으로 보인다(정상 typed 흐름에서는 `setParam(field.name, e.target.checked)` 이 항상 boolean 만 저장하므로 `"true"` 문자열 분기는 도달할 일이 fallback 잔존값 경우뿐). 이 자체는 부작용이 아니라 위 WARNING 의 증거로 참고.
  - 제안: 없음(정보 제공).

- **[INFO]** `paramValues` 리셋은 `open` 전이에만 반응 — 재사용(같은 모달 인스턴스가 `open=false→true` 반복) 시 기존 파라미터 편집이 안전하게 초기화됨
  - 위치: `rerun-modal.tsx:191-198`
  - 상세: `useEffect(() => { if (open) { ...; setParamValues(originalParameters); ... } }, [open, originalParameters])` 는 모달을 다시 열 때마다(`open` false→true) 상태를 원본 기준으로 정확히 리셋한다. `original` prop 자체가 바뀌는 경우(같은 모달 인스턴스에 다른 실행을 재사용, 호출부 확인 결과 두 사용처 모두 조건부 mount/unmount 패턴이라 실제로는 발생 가능성 낮음)에도 `originalParameters`(useMemo, `original.inputData` 의존)가 바뀌면 effect 가 재실행되어 안전하다. 의도한 대로 동작.
  - 제안: 없음(문제 없음, 검증 목적 기록).

- **[INFO]** 시그니처/공개 인터페이스 변경 없음
  - 위치: `rerun-modal.tsx:1031-1048`(`ReRunModalProps`)
  - 상세: `ReRunModalProps` 는 변경되지 않았다. 두 호출부(`workflows/[id]/executions/[executionId]/page.tsx`, `editor/run-results/run-results-drawer.tsx`) 모두 영향 없음. 내부 헬퍼(`extractParameters` 시그니처 불변, `handleParamChange`→`setParam` 로 rename 되었으나 module-private 함수라 외부 영향 없음)만 변경.
  - 제안: 없음.

- **[INFO]** 신규 `<a target="_blank">` 링크 — `rel="noopener noreferrer"` 포함으로 `window.opener` 부작용 차단 확인됨
  - 위치: `rerun-modal.tsx:1289-1296`
  - 상세: 새 탭 열기(reverse tabnabbing 방지)를 위한 `rel="noopener noreferrer"` 가 포함되어 있어 window.opener 공유로 인한 부작용 없음. 순수 클라이언트 네비게이션이며 네트워크 호출·전역 상태 변경 없음.
  - 제안: 없음.

- **[INFO]** `fields` fallback 경로가 원본 키 순서를 `Object.keys(originalParameters)` 로 결정 — 스키마 전환 시 필드 순서가 바뀔 수 있음(order-only, 값 무결성과 무관)
  - 위치: `rerun-modal.tsx:239-254`
  - 상세: 스키마 로드 전(fallback) 필드 순서는 `originalParameters` 삽입 순서, 로드 후(schema)는 `config.parameters` 배열 순서다. 두 순서가 다르면 전환 시 폼 필드가 재배열되는 시각적 부작용이 있으나 데이터 무결성에는 영향 없다.
  - 제안: 없음(UX 참고 사항, 부작용 리뷰 범위 밖).

## 요약

이번 변경은 `paramValues` 라는 로컬 컴포넌트 state 만을 다루며, 전역 상태·환경 변수·파일시스템·네트워크 호출·공개 API 시그니처에는 영향을 주지 않는다(`ReRunModalProps` 불변, 두 호출부 무영향). 유일하게 주목할 부작용 후보는 스키마 비동기 로딩 이전(fallback: 원본 키 전부 text) 구간에 사용자가 편집한 값이, 스키마 도착 이후(typed 위젯) 전환 시 재조정 없이 `paramValues` 에 그대로 잔류할 수 있다는 점이다 — checkbox 는 이중 조건 가드(`value === true || value === "true"`)로 렌더링 크래시는 막지만, 오염된 문자열 값이 제출 payload 에 섞여 나갈 가능성은 남는다. 실사용 노출 창은 좁고(스키마 로딩이 보통 빠름), 크래시·전역 오염 등 CRITICAL 급 부작용은 없다. number 필드의 빈 문자열(`""`) 로컬 상태 보존도 제출 시점 최종 처리가 diff 범위에서 확인되지 않아 참고용으로 남긴다.

## 위험도

LOW
