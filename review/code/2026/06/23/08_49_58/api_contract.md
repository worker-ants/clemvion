# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `getHistory` 응답 정규화 로직이 세 가지 shape(bare array / `{data:{items}}` envelope / `{data:{}}` empty)을 처리하나, `{items:[...]}` flat envelope(data 래퍼 없음)는 미처리
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` lines 1031-1034
  - 상세: `body?.data ?? body` 로직에서 서버가 `{items:[...]}` 형태(data 키 없이 최상위 items)를 반환하면 `data = {items:[...]}` 로 올바르게 처리되어 `data?.items` 분기로 들어간다. 반면 서버가 `{data:{data:[...]}}` 이중 envelope를 반환하면 `data = {data:[...]}` 가 되어 빈 배열 fallback이 된다. 테스트는 실제 서버가 반환하는 세 가지 shape를 이미 커버하고 있으므로 실질적 버그는 없으나, `getById`와 `getHistory`의 envelope 정규화 패턴이 미묘하게 다르다(`getById`는 `body?.data ?? body`를 사용해 raw entity를 가져오고, `getHistory`는 동일 패턴 뒤 추가 items 분기). 일관성 차원의 참고 사항.
  - 제안: 현재 동작을 보존하면서 테스트 커버리지가 이미 충분하므로 변경 불필요. 향후 서버 shape 변경 시 정규화 로직 재검토.

- **[INFO]** `delete` 메서드는 응답 바디를 무시(`Promise<void>`)하고 에러 처리는 호출부(`trigger-delete-dialog.tsx`)의 `onError`에 전적으로 위임
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` line 1019-1021, `trigger-delete-dialog.tsx` lines 157-166
  - 상세: 404 동시 삭제 케이스를 `isAxiosLikeStatus(err, 404)` 로 호출부에서 처리하는 구조는 API 계약 관점에서 적절. `apiClient`가 axios 인터셉터를 통해 에러를 래핑한다면 `response.status` 접근이 보장되며, 현재 패턴은 기존 코드에서 그대로 이어진 것.
  - 제안: 해당 없음.

- **[INFO]** `getHistory`의 `limit` 파라미터가 optional(`params?: { limit?: number }`)이어서 파라미터 미전달 시 backend 기본값에 의존
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` lines 1027-1035
  - 상세: 컴포넌트에서 `HISTORY_LIMIT = 10` 상수를 전달하므로 실제 미전달 경로는 없음. 하지만 API 계약 관점에서 기본 limit가 명시되지 않은 채 optional로 선언되어 있어, 다른 컴포넌트에서 파라미터 없이 호출 시 예상치 못한 응답 크기가 반환될 수 있다.
  - 제안: 주석에 기본값(backend default limit) 또는 권장 limit를 명시하는 것을 고려.

## 요약

이번 변경은 프론트엔드 내부 리팩터링으로, `apiClient`를 직접 호출하던 두 컴포넌트를 `triggersApi` typed 카탈로그로 이관한 것이다. API 엔드포인트(`DELETE /triggers/:id`, `GET /triggers/:id/history`)는 spec §3에 정의된 것을 그대로 따르며, URL 구조·HTTP 메서드·파라미터 전달 방식 모두 RESTful 원칙에 부합한다. 응답 정규화 로직은 세 가지 서버 shape를 단위 테스트로 검증하고 있으며, 에러 처리(404 동시 삭제)도 적절히 다루고 있다. 기존 API 클라이언트 계약(public interface, 엔드포인트 경로, 파라미터 스키마)에 breaking change 없이 호출 경로만 재배선한 변경으로, API 계약 관점에서 위험 요소가 없다.

## 위험도

NONE
