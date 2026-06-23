# Testing Review — refactor(triggers): M-8 1단계 완결

## 발견사항

### [INFO] 다이얼로그 컴포넌트 테스트의 mock 대상이 `apiClient` 직접 참조
- 위치: `/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx` L13–20, `/codebase/frontend/src/components/triggers/__tests__/trigger-history-dialog.test.tsx` L13–19
- 상세: 두 다이얼로그 테스트는 `vi.mock("@/lib/api/client")` 로 `apiClient.delete` / `apiClient.get` 을 mock한다. 컴포넌트는 이제 `triggersApi`를 import하고, `triggersApi`는 내부적으로 `apiClient`를 import한다. Vitest의 `vi.mock` 호이스팅이 모듈 그래프 전체에 적용되므로 현재 테스트는 올바르게 동작한다. 그러나 mock 대상이 컴포넌트가 직접 의존하는 `triggersApi`가 아닌 내부 구현 세부사항인 `apiClient`이기 때문에, 향후 `triggersApi`가 `apiClient` 이외의 fetch 구현으로 교체될 경우 테스트가 무음 실패(false green)가 될 수 있다.
- 제안: 중기적으로 `vi.mock("@/lib/api/triggers")` 로 `triggersApi`를 직접 mock하는 방식으로 전환하면 컴포넌트-API 경계가 명확해진다. 단, 현재 동작은 정확하므로 즉각 차단 사안은 아니다.

### [INFO] `getHistory` params=undefined 시 axios 호출 인수 검증 부재
- 위치: `/codebase/frontend/src/lib/api/__tests__/triggers.test.ts` L571–583 (envelope/빈값 케이스)
- 상세: `triggersApi.getHistory("t1")` 을 params 없이 호출하면 내부에서 `apiClient.get(url, { params: undefined })` 가 된다. Axios는 `params: undefined`를 `params` 키 자체를 전송하지 않는 것과 동일하게 처리하므로 동작 문제는 없다. 그러나 unit 테스트의 envelope/빈값 케이스에서 `getMock`이 어떤 인수로 호출되었는지 검증하지 않아, 의도치 않게 URL 오타나 params 전달 방식이 바뀌어도 통과될 수 있다.
- 제안: envelope 및 빈값 케이스에도 `expect(getMock).toHaveBeenCalledWith("/triggers/t1/history", { params: undefined })` 형태로 호출 인수 검증 추가를 고려한다.

### [INFO] 다이얼로그 테스트의 history mock shape이 단일 envelope 형식에만 집중
- 위치: `/codebase/frontend/src/components/triggers/__tests__/trigger-history-dialog.test.tsx` — `apiGetMock.mockResolvedValueOnce({ data: { data: [...] } })` 패턴 반복
- 상세: 컴포넌트 레벨 테스트는 `{ data: { data: [...] } }` 형식만 사용한다. `triggersApi.getHistory`는 배열 root / `{ items }` envelope / 빈값 등 세 가지 정규화 경로를 처리하는데, 이 로직은 `triggers.test.ts`(unit)에서 이미 충분히 커버된다. 컴포넌트 테스트는 정규화 결과를 받는 레이어이므로 중복 커버는 불필요하다. 현 구조(unit: 정규화 로직, component: 렌더 동작)는 적절한 계층 분리다. 단, 컴포넌트 테스트의 mock shape이 `triggersApi`가 반환하는 최종 배열 형태가 아니라 raw axios 응답 shape임을 명시적으로 주석으로 남겨두면 유지보수 혼란을 줄일 수 있다.
- 제안: 현 상태 유지 가능. 가독성 향상을 원한다면 `// raw axios response — normalization tested in triggers.test.ts` 형식의 주석 추가.

### [INFO] `trigger-delete-dialog.test.tsx`의 `apiDeleteMock` 검증이 `triggersApi.delete` 내부 구현을 노출
- 위치: `/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx` L129
- 상세: `expect(apiDeleteMock).toHaveBeenCalledWith("/triggers/tr-1")` 는 `triggersApi.delete` 가 내부적으로 `apiClient.delete("/triggers/${id}")` 를 호출함을 전제한다. 이 검증은 `triggers.test.ts`의 `"delete DELETEs /triggers/:id"` 케이스와 사실상 중복이다. 컴포넌트 테스트의 책임은 "삭제 버튼 클릭 시 `triggersApi.delete(trigger.id)`가 호출되었는가"이지, 내부 HTTP verb/path 검증이 아니다.
- 제안: 컴포넌트 테스트에서는 `apiDeleteMock` 검증 대신 `triggersApi.delete`를 직접 mock하고 호출 여부만 확인하는 것이 계층 책임을 명확히 한다. 단, 기능 보존에는 문제 없으므로 강제 개선은 아니다.

### [INFO] `isAxiosLikeStatus` 유틸 함수에 대한 독립 단위 테스트 부재
- 위치: `/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L116–120
- 상세: `isAxiosLikeStatus` 는 error 객체에서 HTTP status를 추출하는 순수 함수다. 현재 컴포넌트 테스트에서 404 / 5xx 통합 시나리오를 통해 간접 검증되고 있다. 함수 자체는 단순하고 현 커버리지로 충분하나, 비정형 error 객체(`err.response` 없음, `err` 가 null, `err` 가 string 등) 경우는 명시적으로 테스트되지 않는다.
- 제안: 해당 함수가 파일 내부에 머무른다면 현재 수준으로 충분하다. 공통 유틸로 추출될 경우 전용 단위 테스트 작성 권장.

---

## 요약

이번 변경의 핵심은 `apiClient` 직접 호출을 `triggersApi` 경유로 이전한 리팩터이며, 테스트 전략은 전반적으로 타당하다. `triggers.test.ts`에 `delete` · `getHistory`(배열/envelope/빈값 3-way) 단위 테스트가 추가되었고, 두 다이얼로그의 기존 컴포넌트 테스트는 `apiClient` 모듈 모킹 체인을 통해 여전히 유효하게 동작한다. 주요 개선 여지는 다이얼로그 테스트가 `triggersApi` 대신 `apiClient` 내부 구현을 직접 mock하는 패턴으로, 현재는 Vitest의 모듈 호이스팅으로 기능적 문제가 없지만 중장기적으로 `triggersApi` 직접 mock 방식으로 전환하면 컴포넌트-API 경계가 더 명확해진다. 커버되지 않는 실질적 위험 경로는 없으며, lint·build·unit·e2e 전체 통과가 확인된 상태다.

## 위험도

LOW

STATUS: SUCCESS
