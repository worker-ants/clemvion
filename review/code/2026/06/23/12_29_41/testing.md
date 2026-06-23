# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] statistics.test.ts — getErrors·getNodeStats 테스트 누락
- 위치: `/codebase/frontend/src/lib/api/__tests__/statistics.test.ts`
- 상세: `statisticsApi`의 7개 메서드 중 `getErrors`와 `getNodeStats`에 대한 유닛 테스트가 없다. 커밋 메시지는 "statistics 5"로 명시하고 있으나, 테스트되는 메서드는 `getSummary`·`getExecutions`·`getTopWorkflows`·`getLlmUsageSummary`·`exportStats` 5종이다. `getErrors`와 `getNodeStats`는 다른 엔드포인트들과 구조적으로 동일한 `unwrap<T>` 패턴을 따르므로 버그 확률이 낮지만, 커버리지가 일관적이지 않다. 특히 `getNodeStats`는 `workflowId` 파라미터를 `workflowParam`이 아닌 `selectedWorkflowId`(raw)로 전달하는 특이점(커밋 메시지에도 "workflowId=selectedWorkflowId 보존"으로 강조)이 있어 테스트로 고정(pin)해두는 것이 가치 있다.
- 제안: `getErrors`는 최소 1개("GETs /statistics/errors with params and unwraps"), `getNodeStats`는 `workflowId` 전달 정확성까지 검증하는 테스트 1개를 추가한다.

### [INFO] dashboard.test.ts — getSummary의 bare(un-enveloped) 응답 폴백 테스트 불균일
- 위치: `/codebase/frontend/src/lib/api/__tests__/dashboard.test.ts` (line 667–671 기준)
- 상세: `getRecentExecutions`는 "bare array body as-is" 케이스(envelope 없는 응답)를 별도 it으로 검증한다. 그러나 `getSummary`와 `getRecentWorkflows`에는 동일한 폴백 경로 테스트가 없다. `unwrap<T>` 자체가 별도 유닛에서 폴백을 검증하고 있다면 중복 불필요하지만, 현재 페이로드에서 `unwrap.ts`에 대한 전용 테스트 파일의 존재 여부를 확인하지 못했다. `unwrap.ts`에 별도 테스트가 없는 경우라면, 각 API 모듈 테스트에서 폴백 케이스를 일관되게 다루거나 `unwrap` 유닛 테스트를 별도 추가해야 한다.
- 제안: `unwrap.ts`에 대한 `__tests__/unwrap.test.ts`가 이미 존재하는지 확인한다. 없다면 envelope/non-envelope 두 경로 커버 전용 테스트 추가를 고려한다. 있다면 현 dashboard 테스트는 충분하다.

### [INFO] statistics.test.ts — exportStats blob 테스트에서 mock 응답이 이미 문자열(non-Blob)
- 위치: `/codebase/frontend/src/lib/api/__tests__/statistics.test.ts` (line 1119–1128)
- 상세: `getMock.mockResolvedValue(fakeAxios("a,b,c\n1,2,3"))` 로 설정하고 `new Blob([res.data as BlobPart])`를 호출한다. 실제 axios `responseType: "blob"` 환경에서는 `res.data`가 이미 `Blob` 객체이므로 `new Blob([existingBlob])` 형태로 래핑된다 — 즉, 실제 동작은 `Blob(["a,b,c\n1,2,3"])` 이 아니라 `Blob([<Blob>])` 이 되어 nested Blob 이 생긴다. 테스트에서는 문자열을 BlobPart로 감싸므로 `blob.text()` 검증이 통과하지만, 실제 런타임 동작(axios가 이미 Blob을 반환)과 괴리가 있다. 테스트 자체는 현 구현 코드의 인터페이스(문자열 BlobPart를 받아 Blob으로 래핑)를 정확히 반영하므로 테스트 오류는 아니나, 이 동작이 실제 서버 응답과 일치하는지 integration 레벨에서 확인이 필요하다.
- 제안: 주석으로 "test environment에서는 mock이 string을 반환하지만, 실 axios blob 환경에서는 res.data가 이미 Blob임" 을 명시해 의도를 문서화한다. 또는 `new Blob([res.data as BlobPart])` 대신 axios interceptor 설정에서 blob 처리를 통일하는 것을 후속 PR에서 고려한다.

### [INFO] 페이지 컴포넌트(dashboard/schedules/statistics page.tsx)에 대한 컴포넌트 레벨 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/dashboard/page.tsx`, `schedules/page.tsx`, `statistics/page.tsx`
- 상세: 이번 변경은 behavior-preserving 리팩터이며, 커밋 메시지에 "기존 페이지 테스트(statistics 4·schedules 9) 무수정 통과"로 회귀 안전성을 확인했다. 그러나 `dashboard/page.tsx`에 대한 기존 컴포넌트 테스트가 존재하지 않는다. 이번 변경에서 dashboard는 3개의 queryFn이 모두 교체되었으므로, 이후에 dashboardApi 시그니처가 변경되어도 페이지 레벨에서 감지할 수단이 없다. 이번 리팩터 범위를 벗어나는 사항이라 즉시 차단 사유는 아니다.
- 제안: dashboard page에 대한 최소 smoke test(렌더링 + queryFn 호출 모킹) 를 별도 이슈로 트래킹한다.

## 요약

이번 변경은 behavior-preserving 리팩터로서 테스트 전략이 체계적으로 수립되어 있다. 신규 API 래퍼 3개(dashboard/statistics/schedules)에 대해 17개의 유닛 테스트가 추가되었고, 기존 페이지 테스트(statistics 4개·schedules 9개)가 무수정 통과함으로써 회귀 안전성이 검증되었다. mock 패턴(`vi.mock("../client")` + 전용 spy 변수)이 일관적이고, `beforeEach(() => vi.clearAllMocks())`로 테스트 격리가 유지된다. 주요 미비점은 `statisticsApi.getErrors`·`getNodeStats` 2개 메서드 테스트 누락과 `getNodeStats`의 `workflowId` 전달 특이점 미검증이며, blob mock과 실제 axios 동작 간의 의미론적 괴리가 잠재적 관심 사항이다. 모두 INFO 등급으로 즉시 차단 사유는 아니다.

## 위험도

LOW
