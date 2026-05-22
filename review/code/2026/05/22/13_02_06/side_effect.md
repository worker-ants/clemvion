# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] WebhookConfigCard — stale closure: `authType` / `hmacHeader` 지역 변수가 편집 취소 시 잘못된 값으로 복원될 수 있음
- 위치: `trigger-detail-drawer.tsx` — `WebhookConfigCard` 함수 본문, `cancelEdit` 및 `getCurlExample`
- 상세: `authType`과 `hmacHeader`는 함수 최상단에서 `trigger.config?.authType ?? "none"`, `trigger.config?.hmacHeader ?? "X-Hub-Signature-256"`로 상수처럼 캡처된다. `cancelEdit` 내 `setAuthTypeValue(authType)`와 `setHmacHeaderValue(hmacHeader)`는 이 캡처된 값으로 되돌리는데, 만약 이전 저장 성공 후 `trigger` prop이 갱신(invalidate → refetch)되기 전에 다시 편집을 시작한다면, 화면에 보이는 최신 `authType`과 `hmacHeader`가 아직 이전 값일 수 있다. 이것은 상태 복원의 기준이 되는 "원본"이 stale할 때 발생하는 subtle한 상태 불일치이다. 한편 `getCurlExample`도 항상 `authType`(snapshot)을 참조하여 편집 중 `authTypeValue`가 바뀌어도 curl 예시에는 반영되지 않는다.
- 제안: `cancelEdit`에서 `setAuthTypeValue(trigger.config?.authType ?? "none")`와 같이 prop을 직접 참조하도록 변경하거나, 편집 시작 시(`setEditing(true)`) 스냅샷을 별도 ref에 저장하는 방식을 고려하라. `getCurlExample`은 `authTypeValue`를 참조하도록 수정 검토.

### [WARNING] ExternalInteractionCard — `window.location.reload()` 직접 호출이 남아있음 (기존 코드이지만 이번 변경과 충돌)
- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard.handleSave` 내 `window.location.reload()`
- 상세: 이번 PR의 `OverviewCard` 및 `WebhookConfigCard`는 `queryClient.invalidateQueries`를 통해 react-query 캐시만 갱신하는 올바른 패턴을 도입했다. 그러나 같은 파일 내에 존재하는 `ExternalInteractionCard.handleSave`는 여전히 `window.location.reload()`를 호출한다. 두 카드가 동일 drawer 내에서 독립 편집을 지원하는 구조이므로, External Interaction 저장 후 전체 페이지가 리로드되면 Overview/Webhook 편집 중 입력된 내용이 날아가는 부작용이 발생한다. 주석에 "window.location.reload 금지"라고 plan에도 명시되어 있으나 해당 함수 내에서는 수정되지 않았다.
- 제안: `ExternalInteractionCard`도 `onSaved` prop(또는 내부 `invalidateAfterSave`)을 통해 쿼리 invalidation 방식으로 전환하라. 이는 plan 수용 기준 "EIA 카드의 기존 edit 흐름과 충돌 없음"에도 위배된다.

### [WARNING] WebhookConfigCard — `mutationFn` 내 `window.confirm` 호출
- 위치: `trigger-detail-drawer.tsx` — `WebhookConfigCard.updateMutation.mutationFn` (라인 1649)
- 상세: react-query의 `mutationFn`은 side-effect 없는 순수 비동기 함수로 설계되는 것이 관례이다. 그러나 이 코드는 `mutationFn` 안에서 `window.confirm`(동기 블로킹 UI)을 호출하여 사용자가 취소하면 `throw new Error("USER_CANCELLED")`를 발생시킨다. 이로 인해 react-query의 `mutation.isError`가 `true`로 설정되며, `onError` 핸들러에서 `"USER_CANCELLED"` 분기 처리를 별도로 해야 한다. 취소가 "에러"로 분류되는 것은 의도하지 않은 상태 변경이다 — `mutation.error`에 `USER_CANCELLED` 에러 객체가 잠시라도 올라간다.
- 제안: confirm 검사를 `mutationFn` 바깥에서(onClick 단계에서) 수행하고, 사용자가 취소하면 `mutate()`를 아예 호출하지 않는 방식을 권장한다.

### [INFO] OverviewCard — `nameValue` state가 `trigger.name` prop 변경에 자동 동기화되지 않음
- 위치: `trigger-detail-drawer.tsx` — `OverviewCard` 함수 (라인 2046 `const [nameValue, setNameValue] = useState(trigger.name)`)
- 상세: `useState(trigger.name)`은 최초 렌더 시 한 번만 평가된다. 같은 triggerId로 drawer가 열린 상태에서 외부에서 쿼리 갱신이 발생하면 `trigger.name`이 바뀌더라도 `nameValue`는 기존 값을 유지한다. 이는 read 뷰가 새 이름을 보여주는 반면 (편집 미진입 시), 편집을 시작하면(`startEdit`에서 `setNameValue(trigger.name)`)에서 최신 prop을 사용하므로 실제로는 문제가 없다. 다만, 편집 중 invalidate → refetch가 일어나면 `trigger.name`이 바뀌어도 진행 중인 `nameValue`에는 영향이 없다는 점에 유의.
- 제안: 현재 패턴은 편집 시작 시 `startEdit`에서 최신 값으로 초기화하므로 실용적 문제는 낮지만, 향후 컴포넌트 재활용 시 `useEffect(() => { if (!editing) setNameValue(trigger.name) }, [trigger.name, editing])` 추가를 고려하라.

### [INFO] `TriggersService.update` — schedule 가드에서 `rest.authConfigId` 참조가 dto에 정의되지 않은 필드일 수 있음
- 위치: `triggers.service.ts` — `update` 메서드 라인 903 (`if (rest.authConfigId !== undefined)`)
- 상세: `UpdateTriggerDto`에 `authConfigId` 필드가 실제로 선언되어 있는지 코드 내에서 확인할 수 없다. 만약 DTO에 해당 필드가 없다면 `rest.authConfigId`는 항상 `undefined`가 되어 가드가 무력화된다. 의도는 맞지만 타입 레벨에서 보장되어야 한다.
- 제안: `UpdateTriggerDto`에 `authConfigId?: string`이 선언되어 있는지 확인하라.

### [INFO] i18n dict — `triggers.detail.nameLabel`과 최상단 `triggers.nameLabel` 중복
- 위치: `en/triggers.ts`, `ko/triggers.ts` — `triggers.nameLabel` (최상단, 기존) vs `triggers.detail.nameLabel` (신규)
- 상세: 두 키가 동일한 문자열("Name" / "이름")을 갖는다. 리소스 중복이며 향후 한쪽만 수정할 경우 불일치가 생긴다. 기능상 부작용은 없으나 i18n 상태 관리 복잡도를 높인다.
- 제안: 기존 `triggers.nameLabel`을 재사용하거나, `detail.nameLabel`이 필요하다면 기존 키를 deprecated 처리하라.

### [INFO] `ExternalInteractionCard` RBAC 가드 부재
- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard` 컴포넌트
- 상세: `OverviewCard`와 `WebhookConfigCard`는 `useHasRole("editor")` 가드로 Edit 버튼을 숨기지만, `ExternalInteractionCard`는 이번 변경 이전부터 RBAC 가드 없이 Edit 버튼이 노출된다. 이번 PR에서 신규 도입된 문제는 아니지만, 새로 추가된 RBAC 패턴과 비교하여 일관성 부재가 뚜렷해졌다.
- 제안: `ExternalInteractionCard`의 Edit 버튼에도 `canEdit && ...` 조건을 추가하라.

---

## 요약

백엔드 변경(`TriggersService.update` schedule 가드, 테스트 2건 추가)은 전역 상태·파일시스템·환경 변수를 건드리지 않으며 기존 시그니처를 유지한다. 프론트엔드 변경에서의 가장 중요한 부작용 위험은 두 가지이다. 첫째, `ExternalInteractionCard.handleSave`가 여전히 `window.location.reload()`를 호출하여 같은 drawer 내 OverviewCard·WebhookConfigCard 편집 중인 입력을 예고 없이 소멸시킨다. 둘째, `WebhookConfigCard.updateMutation`의 `mutationFn` 안에서 `window.confirm`을 호출하고 취소 시 throw하는 패턴은 react-query의 `isError` 상태를 오염시키는 의도치 않은 상태 변경이다. i18n 파일은 순수 추가이므로 기존 키에 영향을 주지 않는다.

---

## 위험도

MEDIUM
