# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `Cafe24Config` 컴포넌트에 두 개의 `useState` 추가 (`fieldRows`, `lastPropagated`)
  - 위치: `integration-configs.tsx` — `Cafe24Config` 함수 내부 (구 line 338~349)
  - 상세: 기존에는 `config.fields`를 렌더마다 파생(derive)하는 순수 계산이었으나, 이번 변경으로 컴포넌트 내부에 편집 버퍼 state가 생겼다. state는 컴포넌트 범위에 한정되어 전역 상태 오염은 없다. 단, 마운트 직후 `lastPropagated`는 `fieldRowsToObject(fieldRows)` 값(빈 key 제거 후 object)으로 초기화되는 반면, 부모가 넘긴 `config.fields`가 이미 다른 값일 경우 첫 렌더에서 `objectsEqual` 비교가 즉시 발동해 derived-state 재동기화가 트리거된다. 이는 의도된 동작이나, 첫 렌더에서 `setFieldRows`/`setLastPropagated`를 동기 호출하는 패턴이 React 공식 "derived state during render" 패턴이므로 무한 루프 위험은 없다.
  - 제안: 문서화된 React 패턴이므로 현 구현 유지. 다만 `lastPropagated` 초기화 시 `fieldRowsToObject(fieldRows)`를 사용하는 것은 `config.fields`(부모 prop)와 미세한 불일치 가능성이 있으므로, `(config.fields as Record<string, unknown>) ?? {}` 를 직접 초기값으로 넘기는 것을 고려한다.

- **[INFO]** 렌더 도중 `setState` 동기 호출 (derived-state-during-render 패턴)
  - 위치: `integration-configs.tsx` lines 355~361 (if `!objectsEqual(externalFields, lastPropagated)` 블록)
  - 상세: React의 공식 권장 패턴이지만, `objectsEqual`이 false인 상황에서 `setFieldRows`와 `setLastPropagated` 두 번의 setState가 렌더 함수 본문에서 직접 호출된다. React 18 Concurrent Mode에서는 렌더가 여러 번 실행될 수 있고, 이때 이 블록이 반복 실행된다. `objectsEqual` 결과가 안정적이고(동일 인자 → 동일 결과) 부수 효과가 없으므로 실질적인 위험은 낮다. 단, 이 패턴이 낯선 기여자에게는 무한 루프 우려를 줄 수 있다.
  - 제안: 코드 주석에 "Concurrent Mode 하에서도 안전한 이유"를 간략히 명시하거나(이미 일부 명시됨), `useEffect`로 전환하는 방법도 검토한다. 단 `useEffect`는 플리커를 유발할 수 있으므로 현 패턴이 더 나은 UX를 제공한다.

- **[INFO]** `handleFieldRowsChange` 내부의 `onChange` 호출이 항상 빈 key를 제거한 object를 전파
  - 위치: `integration-configs.tsx` — `handleFieldRowsChange` 함수 (lines 363~370)
  - 상세: 빈 key 행은 로컬 UI 상태에만 존재하고 `onChange`(부모 콜백)로는 전파되지 않는다. 이는 의도된 설계이며 백엔드 계약(`Record<string, unknown>`)을 보존한다. 그러나 부모가 `onChange` 이벤트를 수신할 때마다 저장·undo 스냅샷 등을 기록한다면, 키를 타이핑하는 매 keypress마다 object가 전파되어 undo 스택이 과도하게 쌓일 수 있다.
  - 제안: 부모(SettingsPanel/undo 레이어)의 디바운스 여부를 확인한다. 현재 변경 범위 밖이므로 INFO로 분류.

- **[INFO]** `useLocaleStore.setState` 직접 호출 (테스트 코드)
  - 위치: `cafe24-config.test.tsx` line 110 — `beforeEach` 훅
  - 상세: 전역 Zustand 스토어 `useLocaleStore`의 `setState`를 테스트에서 직접 호출한다. 이는 테스트 격리 목적의 세팅이지만, `afterEach`에서 원상복구(`setState({ locale: ... 원래값 })`)하거나 `vi.restoreAllMocks()`를 사용하지 않는다. 테스트 파일 내 각 케이스가 동일 locale `"en"`을 사용하고 있어 현재 파일 범위에서는 문제없다. 하지만 같은 프로세스에서 다른 테스트 파일이 locale 상태를 의존한다면 실행 순서에 따라 영향을 받을 수 있다.
  - 제안: `beforeEach`에 `useLocaleStore.setState({ locale: "en" })`을 두는 것은 허용 패턴이나, `afterEach(() => useLocaleStore.setState({ locale: 원복값 }))` 또는 Zustand의 `create(...)(...)` reset API를 추가해 전역 스토어 오염을 방어한다.

- **[INFO]** 새 헬퍼 함수 `fieldRowsToObject`, `objectsEqual`이 모듈 최상위 스코프에 추가됨
  - 위치: `integration-configs.tsx` lines 301~327
  - 상세: 두 함수는 export되지 않으므로 모듈 외부에는 노출되지 않는다. 전역 변수 도입이 아닌 모듈 수준 private 함수이므로 부작용 없음. `objectsEqual`은 얕은 비교(shallow string compare)만 수행하며, value가 객체/배열인 경우 `String(a[k] ?? "")` 변환으로 처리한다. 현재 Cafe24 fields 값은 string이므로 문제없으나, 미래에 value 타입이 확장될 경우 이 함수가 잘못된 equal 판정을 낼 수 있다.
  - 제안: `objectsEqual` 함수 주석에 "value는 string 비교" 가정을 명시한다.

## 요약

이번 변경은 `Cafe24Config` 컴포넌트 내부에 React 로컬 state를 도입해 UI 편집 버퍼(빈 key 행 포함)와 외부로 전파되는 object 형태를 분리한 것이다. 전역 변수 도입, 파일시스템 부작용, 외부 네트워크 호출, 환경 변수 접근, 이벤트/콜백 시그니처 변경은 모두 없다. `Cafe24Config`의 props 시그니처(`config`, `onChange`)는 변경되지 않아 호출자 영향도 없다. 테스트 코드에서 전역 Zustand 스토어를 직접 조작하는 부분은 현재 파일 범위에서는 격리되어 있으나, 스토어 복구 코드가 없어 타 테스트 파일 실행 순서에 따른 누출 가능성이 INFO 수준으로 존재한다. 전반적으로 부작용 위험이 낮은 변경이다.

## 위험도

LOW
