# 테스트(Testing) 리뷰

## 발견사항

### 파일 1: integration-oauth.service.cafe24.spec.ts — `buildFakeCafe24Integration` factory

- **[INFO]** factory 함수는 `workspaceId` 필드를 포함하지 않음
  - 위치: `buildFakeCafe24Integration` 반환 객체 (diff line 75–87)
  - 상세: 기존 인라인 mock 에는 일부 케이스에 `workspaceId: 'ws-1'` 이 있었으나 factory 반환값에서 빠졌다. 실제 Entity 에 `workspaceId` 필드가 있고 service 로직이 이를 참조한다면, 해당 필드를 건너뛰는 테스트들은 암묵적으로 `undefined`를 받게 된다. spec 의도상 duplication check 는 workspace scope 로 제한되므로, factory 에서 `workspaceId`를 기본값(`'ws-1'`)으로 내려주는 것이 더 안전하다.
  - 제안: factory 반환 객체에 `workspaceId: overrides.workspaceId ?? 'ws-1'` 추가 및 override 타입에 `workspaceId?: string` 추가.

- **[INFO]** `serviceType` 필드가 factory 에서 하드코딩(`'cafe24'`)되어 있지만 override 불가
  - 위치: `buildFakeCafe24Integration` 반환 객체 line 79
  - 상세: `serviceType` 은 현재 항상 `'cafe24'`로 고정되어 있으며 override 타입에도 포함되지 않는다. 다른 serviceType 과의 구분 로직을 검증하는 테스트가 이 factory 를 재활용하게 될 경우 별도 override 경로가 없다. 현재 범위에서는 문제가 되지 않지만, factory 의 확장 가능성 측면에서 언급한다.
  - 제안: 현 범위에서는 허용 가능. 향후 필요 시 `serviceType` 을 override 타입에 추가.

- **[INFO]** `mallId: null` 케이스(legacy row)의 factory 사용 시 `credentialsMallId` 기본값 fallback 로직이 미묘
  - 위치: `buildFakeCafe24Integration` lines 61–64
  - 상세: `credentialsMallId = overrides.credentialsMallId ?? mallId ?? 'priv-shop'` 에서 `mallId` 가 명시적으로 `null`로 전달된 경우(`overrides.mallId === null`) `mallId` 변수는 `null`이 되고, `null ?? 'priv-shop'`은 `'priv-shop'`을 반환한다. 이는 legacy row 테스트에서 `credentialsMallId: 'pub-shop'`을 별도로 지정하는 올바른 패턴으로 유도하고 있지만, `credentialsMallId`를 지정하지 않고 `mallId: null`만 전달하면 factory 가 `credentials.mall_id: 'priv-shop'`을 자동으로 채워 legacy 케이스가 아닌 것처럼 보일 수 있다.
  - 제안: `mallId === null && overrides.credentialsMallId === undefined` 인 경우 명시적 경고나 타입 제약을 추가해 혼란 방지 (필수는 아님, 현재 사용처는 올바르게 `credentialsMallId`를 명시하고 있음).

---

### 파일 19: cafe24-precheck.test.tsx — AbortController 테스트

- **[WARNING]** abort 타이밍 가정이 구현 세부사항에 의존
  - 위치: diff lines 2158–2161 (`expect(firstSignal?.aborted).toBe(true)`)
  - 상세: `await user.clear(mallIdInput)` + `await user.type(mallIdInput, 'shop-b')` 직후, debounce timeout 만료 없이 `firstSignal?.aborted` 가 `true`임을 기대한다. 이는 React effect cleanup 이 "다음 렌더 사이클에서 동기적으로" 실행된다는 가정에 기반한다. `userEvent`의 비동기 특성과 `act` wrapping 없이 signal abort 여부를 즉시 단언하는 구조는 타이밍에 민감할 수 있다. 현재 `vi.useFakeTimers` 환경에서는 대체로 안정적으로 동작하지만, 환경 변화(React 버전, userEvent 버전 업)에 따라 flaky 해질 수 있다.
  - 제안: `await act(async () => {})` 또는 `await waitFor(...)` 로 abort 단언을 감싸 effect cleanup 이 완료되었음을 보장한 뒤 단언하도록 수정 고려. 예: `await waitFor(() => expect(firstSignal?.aborted).toBe(true))`.

- **[INFO]** AbortError 분기(catch 블록)가 테스트에 없음
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` 변경 대응 테스트 부재
  - 상세: 구현 코드(`page.tsx`)에서 `catch (err)` 블록은 AbortError 를 `void err`로 무시하고 `!aborted` 조건으로 state 갱신을 건너뛴다. 그러나 `cafe24-precheck.test.tsx`에 abort 된 fetch 가 AbortError 를 throw 했을 때 `setCafe24Conflict(null)` 및 `setCafe24PrecheckLoading(false)` 가 호출되지 않음을 검증하는 케이스가 없다. 현재 추가된 테스트는 signal 전달과 mock 호출 횟수만 검증한다.
  - 제안: `precheckMock` 이 `AbortError`를 reject 하도록 설정한 뒤, `setCafe24Conflict` 및 loading state 가 변경되지 않음을 단언하는 테스트 케이스 추가.

---

### 파일 4: integrations.service.ts — 트랜잭션 미적용 설명 주석

- **[INFO]** 새로 추가된 주석에 대응하는 테스트 없음
  - 위치: diff lines 394–403 (트랜잭션 미적용 rationale 주석)
  - 상세: 주석은 `save()` 실패 시 audit log 가 기록되지 않는 동작을 "의도적"으로 설명하고 있다. 이 동작에 대한 단위 테스트(save 실패 시 `auditLogsService.record`가 호출되지 않는 것 검증)가 현재 diff 에서 확인되지 않는다. 중요한 설계 결정이 주석으로만 남아 있고 테스트로 보호되지 않는다.
  - 제안: `integrationRepository.save`가 throw 할 때 `auditLogsService.record`가 호출되지 않음을 검증하는 테스트 케이스 추가.

---

### 파일 5–18: Cafe24 metadata 파일들 (application, collection, community 등)

- **[INFO]** 삭제된 operation 들에 대한 회귀 테스트 확인 필요
  - 위치: `application.ts`, `collection.ts`, `community.ts`, `design.ts`, `mileage.ts`, `notification.ts`, `personal.ts`, `privacy.ts`, `promotion.ts`, `translation.ts` — 다수 operation 삭제
  - 상세: Phase 8* 시리즈로 추가됐던 operation 들이 대거 삭제되고 `planned.ts`로 이동되었다. 이 operation 들에 의존하는 단위 테스트나 e2e 테스트가 있다면 깨질 수 있다. diff 에는 해당 operation ID 를 참조하는 기존 테스트 갱신이 포함되어 있지 않으므로, CI 에서 테스트 실패가 발생하지 않는지 확인이 필요하다.
  - 제안: `planned.ts`로 이동된 operation ID 목록(`appstore_orders_get`, `coupon_manage`, `themes_count` 등)을 테스트 파일에서 grep 하여 의존 케이스가 있는지 확인 후 적절히 업데이트.

- **[INFO]** `planned.ts`의 `CAFE24_PLANNED_BY_RESOURCE` 맵 변경에 대한 테스트 없음
  - 위치: `planned.ts` diff lines 1628–1731
  - 상세: `CAFE24_PLANNED_BY_RESOURCE`는 UI 에서 "지원 예정" 항목 목록을 렌더링하는 데 사용된다. 이 구조체가 올바른 카테고리에 올바른 operation ID 를 담고 있는지 검증하는 스냅샷 또는 단위 테스트가 없다. 항목 누락이나 오분류를 자동으로 감지할 수 없다.
  - 제안: `CAFE24_PLANNED_BY_RESOURCE`의 각 category 별 ID 목록을 검증하는 간단한 단위 테스트 또는 스냅샷 테스트 추가 고려.

---

### 파일 2: integration-oauth.service.ts — 타입 포맷 변경

- **[INFO]** 단순 포맷 변경 — 테스트 영향 없음
  - 위치: diff line 347
  - 상세: `Cafe24PrecheckStatus` 타입 선언의 줄바꿈 위치 변경만이며 동작 변화 없다. 테스트 관점에서 무시 가능.

---

### 파일 3: integrations.controller.ts — `@ApiOperation.description` 업데이트

- **[INFO]** route order 관련 회귀 위험에 대한 테스트 부재
  - 위치: diff line 371
  - 상세: description 에 "본 경로는 동적 `GET /api/integrations/:id` 보다 앞에 선언되어야 한다" 라는 회귀 안전망 설명이 추가됐지만, 실제로 route 선언 순서를 검증하는 integration/e2e 테스트가 diff 에 보이지 않는다. `cafe24` 가 `:id`로 소비되어 `ParseUUIDPipe`가 400을 반환하는 시나리오가 e2e 테스트로 보호되고 있는지 확인이 필요하다.
  - 제안: `GET /api/integrations/cafe24/precheck?mallId=xxx` 를 호출했을 때 200 이 반환되는 e2e 케이스가 이미 있는지 확인. 없다면 추가 권장.

---

## 요약

이번 변경의 핵심 테스트 개선은 `buildFakeCafe24Integration` factory 도입과 AbortController 시나리오 테스트 추가이며, 두 가지 모두 방향성은 올바르다. factory 는 기존 인라인 mock 의 중복 선언 문제를 효과적으로 해소하고, AbortController 테스트는 실제 UX 시나리오(빠른 타이핑 시 이전 요청 cancel)를 커버한다. 다만 factory 에서 `workspaceId` 누락, abort 후 state 갱신 방지 동작의 테스트 부재, `integrations.service.ts` 의 save 실패 시 audit 미기록 동작에 대한 테스트 공백이 있다. metadata 파일들의 대규모 삭제는 기존 operation ID 를 참조하는 테스트가 있을 경우 CI 회귀를 유발할 수 있으므로 확인이 필요하다. abort 타이밍 단언은 구현 세부사항에 의존하여 향후 flaky 해질 가능성이 있다.

## 위험도

LOW
