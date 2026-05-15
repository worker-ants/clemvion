# 요구사항(Requirement) 리뷰

## 발견사항

### 기능 완전성

- **[INFO]** `onSuccess` 분기 — 완전하게 구현됨
  - 위치: `scope-tab.tsx` L604-614
  - 상세: `"authUrl" in res` 분기(기존 OAuth popup)와 `"mode" in res && res.mode === "cafe24_private_pending"` 분기(신규 Cafe24 Private 안내)가 모두 처리된다. 수정 전에 누락됐던 Cafe24 Private 분기가 spec §4.4 에 맞게 채워졌다.
  - 제안: 없음.

- **[WARNING]** `onSuccess` — 두 조건이 동시에 성립할 수 있는 응답 shape 는 현재 타입상 존재하지 않으나, 런타임 응답이 예상 밖의 필드를 가져올 경우 (예: `authUrl` 과 `mode` 가 함께 반환) 첫 번째 분기(`authUrl`)만 실행되고 `cafe24_private_pending` 처리가 묵살된다. `else if` 구조이므로 의도적 상호배타 처리이지만 주석이 없어 유지보수자가 혼동할 수 있다.
  - 위치: `scope-tab.tsx` L605-611
  - 상세: `if ("authUrl" in res) … else if ("mode" in res …)` — 두 유니온 멤버가 각각 다른 필드를 가지므로 현재 타입 정의 기준으로는 문제없다. 그러나 백엔드가 두 필드를 모두 반환하는 경우를 타입 레벨에서 차단하지 않는다(`RequestScopesResult`는 유니온이므로 컴파일러는 교집합 필드를 허용하지 않으나, `unwrap<>` 캐스팅 후 런타임 객체는 다를 수 있다).
  - 제안: 주석으로 분기 의도를 명시하거나, discriminated union 기반으로 `switch(res.mode)` 패턴 + exhaustive check 를 도입한다.

- **[INFO]** 빈 `scopesAdded` 처리
  - 위치: `scope-tab.tsx` L681
  - 상세: `cafe24Pending.scopesAdded.length > 0` 조건으로 빈 배열일 때 목록 섹션을 렌더링하지 않는다. 안내 타이틀과 설명문은 항상 표시되므로 `scopesAdded: []` 이더라도 사용자는 행동 방침을 파악할 수 있다.
  - 제안: 없음.

---

### 엣지 케이스

- **[WARNING]** `allOptions`가 빈 배열일 때 scope 요청 버튼이 노출되나 선택 가능한 항목이 없다
  - 위치: `scope-tab.tsx` L706-734
  - 상세: `service?.scopes ?? []` 가 빈 배열이면 체크박스 목록이 공백으로 렌더링되고 버튼은 `selected.length === 0` 조건으로 비활성화된다. 사용자에게는 "선택 가능한 scope 가 없습니다" 안내 없이 비활성화된 버튼만 보인다.
  - 제안: `allOptions.length === 0` 일 때 빈 상태 메시지를 렌더링하거나, 해당 섹션 자체를 숨기는 분기를 추가한다.

- **[INFO]** `openOAuthPopup` — 팝업 차단 시 반환값 미처리
  - 위치: `open-oauth-popup.ts` L280-289
  - 상세: `window.open()`이 팝업 차단으로 `null`을 반환해도 이를 무시하고 `toast.success`가 호출된다(caller인 `scope-tab.tsx`에서). 사용자는 팝업이 차단됐음을 알 수 없다.
  - 제안: `window.open()`의 반환값이 `null`인 경우 `toast.warning("팝업이 차단됐습니다. 브라우저 설정을 확인해 주세요.")` 형태의 피드백을 추가한다.

- **[INFO]** 네트워크 오류 후 재시도 시 `cafe24Pending` 상태가 유지됨
  - 위치: `scope-tab.tsx` L601-603
  - 상세: `onMutate`에서 `setCafe24Pending(null)`을 호출하므로 재시도 시 이전 pending 안내가 초기화된다. 의도된 동작이며 적절하다.
  - 제안: 없음.

---

### TODO/FIXME

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음
  - 위치: 변경된 모든 파일 전체
  - 상세: 검토 대상 파일(`scope-tab.tsx`, `open-oauth-popup.ts`, `integrations.ts`, `en.ts`, `ko.ts`, 테스트 파일) 어디에도 미완성을 시사하는 주석이 존재하지 않는다.
  - 제안: 없음.

- **[WARNING]** `plan/in-progress/cafe24-request-scopes-ui.md` 체크리스트에 미완료 항목이 다수 남아 있음
  - 위치: `plan/in-progress/cafe24-request-scopes-ui.md` L1048-1054
  - 상세: i18n 추가, mutation 분기, 단위 테스트 추가, lint/build, ai-review, plan complete 이동 항목이 모두 `[ ]` 미체크 상태로 커밋됐다. 실제 구현은 이루어진 것으로 보이나 체크리스트가 갱신되지 않았다. 계획과 구현 결과가 불일치하는 것처럼 보여 사후 추적이 어렵다.
  - 제안: 커밋 전 체크리스트 항목을 실제 완료 상태에 맞춰 `[x]`로 갱신하고, 남은 항목(ai-review, plan complete 이동 등)은 명시적으로 남겨둔다.

---

### 의도와 구현 간 괴리

- **[INFO]** `ScopeTab` prop `service` 타입이 `ServiceDefinition | undefined` — 신규 모듈에서도 동일하게 허용
  - 위치: `scope-tab.tsx` L578-579
  - 상세: `page.tsx`에서 추출 전에도 `service: ServiceDefinition | undefined`였으므로 동작이 변경되지 않는다. `allOptions = service?.scopes ?? []`로 undefined 를 방어한다.
  - 제안: 없음.

- **[INFO]** `onChanged()`가 `cafe24_private_pending` 분기에서도 호출됨
  - 위치: `scope-tab.tsx` L612
  - 상세: `onChanged()`는 상위 컴포넌트에 integration 새로고침을 지시한다. Cafe24 Private pending 상태에서는 아직 실제 scope 가 추가되지 않았으므로 새로고침해도 상태 변화는 없다. 무해하지만 불필요한 refetch 를 유발할 수 있다.
  - 제안: `cafe24_private_pending` 분기에서는 `onChanged()`를 생략하거나, 이를 명시적으로 주석화한다.

---

### 에러 시나리오

- **[WARNING]** 알 수 없는 `mode` 값 수신 시 무음(silent) 처리
  - 위치: `scope-tab.tsx` L604-614
  - 상세: 백엔드가 `{ mode: "unknown_mode", ... }` 를 반환하면 두 `if/else if` 분기를 모두 통과하지 못해 `onChanged()`만 호출되고 사용자에게 아무 피드백이 없다. toast 도 alert 도 표시되지 않는다.
  - 제안: `else` 분기에 `toast.warning` 또는 콘솔 경고를 추가하여 예상치 못한 응답 shape 에 대한 피드백을 제공한다.

- **[INFO]** `onError` 처리
  - 위치: `scope-tab.tsx` L614
  - 상세: 네트워크 오류나 4xx/5xx 응답 시 `toast.error(t("integrations.requestScopesFailed"))`를 표시한다. 오류 유형(권한 없음, 서버 오류 등)에 무관하게 동일한 메시지를 사용한다. 현재 수준에서는 충분하다.
  - 제안: 필요시 HTTP 상태 코드별 세분화된 메시지를 고려할 수 있으나 이번 범위에서는 불요.

---

### 데이터 유효성

- **[WARNING]** `selected` 배열이 비어 있을 때 버튼 비활성화 처리는 있으나, 이미 부여된 scope 만 선택된 상태로 submit 이 가능한 경로는 타입상 차단됨
  - 위치: `scope-tab.tsx` L717, L737-738
  - 상세: 이미 부여된 scope에 해당하는 체크박스는 `disabled` 처리되므로 `selected`에 현재 scope 가 추가될 경로가 없다. 그러나 `selected` 초기값이 `[]`이므로 `toggle` 함수는 중복 추가를 막는다. 데이터 무결성 충분.
  - 제안: 없음.

- **[INFO]** 테스트에서 `requestScopesMock` 호출 인수 검증 (`"int-cafe24-1", ["mall.write_product", "mall.read_order"]`) 이 적절히 이루어짐
  - 위치: `scope-tab.test.tsx` L186-190
  - 상세: API 호출 인수가 명시적으로 검증되어 올바른 integration id 와 scope 배열이 전달됨을 보장한다.
  - 제안: 없음.

---

### 비즈니스 로직

- **[INFO]** spec §4.4 요구사항 이행 확인
  - 위치: `scope-tab.tsx` L608-611, `en.ts` L874-878, `ko.ts` L930-934
  - 상세: spec §4.4 는 "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다"라는 안내를 요구한다. `cafe24PrivateScopeRequestDesc` i18n 값이 이 안내문을 포함한다. `scopesAdded` 목록 표시도 구현되어 있다.
  - 제안: 없음.

- **[INFO]** 신규 통합 흐름(`Cafe24PrivatePending` 컴포넌트)과의 의도적 분리
  - 위치: `plan/in-progress/cafe24-request-scopes-ui.md` L1029-1031
  - 상세: 신규 통합 흐름은 polling 기반 step 전환 컴포넌트이고, 상세 페이지의 scope 요청은 이미 `connected` 상태에서의 inline 안내이므로 재사용하지 않는 결정이 적합하다. 비즈니스 맥락이 다르다.
  - 제안: 없음.

- **[WARNING]** `cafe24_private_pending` 분기에서 `onChanged()` 호출 후 기대되는 UX 흐름 불명확
  - 위치: `scope-tab.tsx` L612
  - 상세: `onChanged()`가 integration 상세를 새로고침하면 scope 탭의 `currentScopes`가 갱신된다. 그러나 Cafe24 측 작업이 완료되기 전에는 `currentScopes`가 변경되지 않으므로, 사용자가 새로고침 시 pending 안내(`cafe24Pending` state)가 사라진다. 상태가 React 로컬 state 이므로 페이지 새로고침 또는 탭 전환 시 안내가 사라진다.
  - 제안: pending 안내를 더 오래 유지하려면 sessionStorage 등에 임시 저장하거나, 상위 컴포넌트 state 로 승격하는 것을 검토한다. 단, 현재 spec 이 이 지속성 요건을 명시하지 않으므로 INFO 수준 이슈로도 볼 수 있다.

---

### 반환값

- **[INFO]** `openOAuthPopup` 반환값 없음 (`void`)
  - 위치: `open-oauth-popup.ts` L279
  - 상세: 함수가 반환값 없이 사이드이펙트만 수행한다. 팝업 창 참조를 반환하지 않아 caller 가 팝업 상태(닫힘 여부)를 추적할 수 없다. 기존 구현과 동일하므로 기능 회귀는 없다.
  - 제안: 팝업 닫힘 감지가 필요한 미래 요구사항을 위해 `Window | null`을 반환하도록 변경을 검토한다. 현재 요구사항에서는 불요.

- **[INFO]** `ScopeTab` — 모든 렌더 경로에서 JSX 반환
  - 위치: `scope-tab.tsx` L617-748
  - 상세: `authType !== "oauth2"` 조건에서 early return, 정상 경로에서 전체 UI 반환. null 을 반환하는 경로가 없다.
  - 제안: 없음.

---

## 요약

이번 변경은 Cafe24 Private 통합의 `request-scopes` 응답 시 UI 안내가 누락되던 버그를 수정한다. `onSuccess` 분기 추가, 전용 타입(`RequestScopesResult`) 신설, i18n 키 3건 추가, ScopeTab 모듈 분리, 단위 테스트 2건 추가 등 변경 범위가 명확하고 spec §4.4 요구사항을 충실히 반영하고 있다. 주요 기능 흐름은 완전하게 구현됐으나, (1) 예상 외 응답 `mode` 수신 시 silent 실패 경로, (2) 팝업 차단 시 사용자 피드백 부재, (3) `cafe24_private_pending` 분기에서 `onChanged()` 호출로 인해 pending 안내 state 가 소멸될 수 있는 UX 흐름, (4) `allOptions` 빈 배열 시 빈 상태 안내 부재, (5) plan 체크리스트 미갱신 등 부가적인 개선 여지가 있다.

## 위험도

LOW
