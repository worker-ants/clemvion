### 발견사항

- **[INFO]** `updateParam` 연속 호출 시 URL 파라미터 손실 가능성
  - 위치: `integrations/page.tsx` — `updateParam` 함수
  - 상세: `updateParam`은 매 호출마다 현재 `searchParams`를 기반으로 새 URL을 만들어 `router.replace`를 호출한다. 렌더링이 완료되기 전에 두 번 호출되면 (예: 필터 A → 필터 B 빠른 연속 클릭), 두 번째 호출은 첫 번째 변경이 반영되기 전의 `searchParams`를 읽어 첫 번째 변경을 덮어쓸 수 있다. 단, 현재 UI 구조상 사용자가 두 필터를 동시에 클릭하는 경로가 없어 실제 발생 가능성은 낮다.
  - 제안: 현 구조는 수용 가능하다. 안전하게 처리하려면 `router.replace` 대신 콜백 형태 (`(prev) => ...`)를 지원하는 상태 업데이터를 쓰거나, 단일 URL 파라미터 소스를 관리하는 레이어를 도입할 수 있다.

- **[INFO]** `setActiveTab` / `setStatusFilter` + `setPage(1)` 비원자적 호출
  - 위치: `triggers/page.tsx` — 탭/상태 필터 클릭 핸들러
  - 상세: `setActiveTab(tab)`은 React 상태 setter(배치됨)이고, `setPage(1)`은 즉시 `router.replace`를 실행하는 사이드 이펙트다. React 18이 상태 업데이트를 배치하더라도 URL 변경은 별도 타이밍에 발생해 두 번의 렌더링을 유발할 수 있다. 현재 쿼리 키가 `[..., activeTab, statusFilter, page]`로 구성되어 있어 최종 결과는 올바르지만, 중간 상태(탭은 바뀌었는데 page는 아직 이전 값)로 쿼리가 한 번 발생할 수 있다.
  - 제안: `useCallback`으로 감싸거나, 두 변경을 동일한 URL 파라미터 업데이트로 병합하면 중간 페치를 제거할 수 있다.

- **[INFO]** `usePageParam.setPage` 스테일 클로저 — 빠른 연속 클릭 시
  - 위치: `use-page-param.ts` — `setPage` callback
  - 상세: `setPage`는 `searchParams`를 의존성으로 가지므로 렌더 사이클마다 최신 값을 사용한다. 그러나 한 렌더 사이클 내에서 `setPage`를 여러 번 호출하면 모두 동일한 `searchParams` 스냅샷을 기반으로 URL을 만든다. `page` 파라미터만 수정하는 현재 사용 패턴에서는 최종 URL이 항상 마지막 호출 값으로 덮어씌워지므로 실질적 문제는 없다.
  - 제안: 현 구현으로 충분하다. 변경 없음.

- **[INFO]** `totalPages` 폴백 — 현재 페이지 아이템 수로 전체 페이지 계산
  - 위치: `knowledge-bases/page.tsx`, `llm-configs/page.tsx` — `totalPages` 산출 로직
  - 상세: `data?.pagination`이 없는 레거시 응답 시 `collections.length / PAGE_SIZE`로 `totalPages`를 계산한다. 이 값은 전체 아이템 수가 아닌 현재 페이지 아이템 수이므로 다중 페이지 레거시 환경에서는 항상 `totalPages = 1`이 되어 페이지네이션이 숨겨진다. 동시성 문제라기보다는 데이터 정확성 이슈이나, 레거시 응답과 신규 응답이 혼재하는 배포 환경에서 나타날 수 있다.
  - 제안: 폴백 메시지를 콘솔에 경고로 남기거나, 레거시 응답 형식 지원을 명시적으로 문서화한다.

---

### 요약

변경된 코드는 대부분 React + React Query 기반의 클라이언트 UI 레이어이며, 전통적인 동시성 문제(락, 데드락, 스레드 안전성)와는 거리가 멀다. React Query가 쿼리 키 변경 시 중복 요청 및 응답 순서 문제를 자동으로 처리하므로 비동기 데이터 페칭 측면은 안전하다. 주목할 부분은 URL 기반 상태관리에서 발생하는 "렌더링 전 연속 호출 시 스테일 스냅샷" 패턴인데, 현재 사용 방식(단일 파라미터 수정, UI 단에서 중복 트리거 경로 없음)에서는 실질적 영향이 없다. 전반적으로 위험 요소는 없으며 구현이 안정적이다.

### 위험도

**NONE**