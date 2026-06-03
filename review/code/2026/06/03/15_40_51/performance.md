# 성능(Performance) 코드 리뷰

대상 변경: `interactionAllowedOrigins` 워크스페이스 설정 API/UI 추가
리뷰 일시: 2026-06-03

---

## 발견사항

### **[WARNING]** `updateWorkspaceSettings` 에서 워크스페이스 조회 전 `assertAdmin` 이 별도 쿼리 실행 — 중복 DB 왕복
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `updateWorkspaceSettings` (라인 361–378)
- **상세**: `assertAdmin(workspaceId, userId)` 는 내부적으로 `WorkspaceMember` 를 SELECT 한다. 이후 `workspaceRepository.findOne({ where: { id: workspaceId } })` 로 `Workspace` 를 다시 SELECT 한다. 결과적으로 단일 PATCH 요청당 최소 2회 DB 왕복(member check + workspace load)이 발생한다. 설정 변경은 빈도가 낮아 실제 p99 에 미치는 영향은 제한적이지만, `getWorkspaceSettings` 역시 동일 패턴(`getMemberRole` + `findOne`)이어서 GET 요청마다 같은 2-쿼리 패턴이 반복된다.
- **제안**: TypeORM relation JOIN 으로 단일 쿼리화하거나, 최소한 `workspaceRepository.findOne` 에 `relations: ['members']` 를 합쳐 1-RTT 로 줄일 수 있다. 단, 해당 리팩터는 기존 `assertAdmin` 헬퍼의 시그니처 변경을 수반하므로 범위를 판단하여 후속 이슈로 처리하는 것도 무방하다.

### **[WARNING]** `EmbedOriginsCard` 의 `key` prop 전략 — 쿼리 로딩 완료 시 전체 에디터 언마운트/리마운트
- **위치**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` `EmbedOriginsCard` (라인 584–596)
- **상세**: `key={`${workspaceId}:${settingsQuery.isSuccess ? "loaded" : "pending"}`}` 패턴은 쿼리가 `pending → success` 로 전환될 때 `EmbedOriginsEditor` 를 완전히 언마운트하고 새 인스턴스를 마운트한다. 이 방식은 effect-setState 를 회피하기 위한 의도적 선택으로 코드 주석에 명시되어 있으나, 다음 비용이 따른다: (1) 첫 렌더 시 빈 UI 표시 후 데이터 도착 시 전체 DOM 교체가 발생하여 레이아웃 시프트(CLS) 가능성이 있다. (2) 이후 `invalidateQueries` 가 `isSuccess` 를 일시적으로 `pending` 으로 돌릴 경우, 저장 직후 에디터가 다시 언마운트된다. 저장 성공 후 `onSuccess` 에서 `invalidateQueries` 를 호출하면 `isSuccess: false → true` 사이클이 생겨 에디터가 한 번 더 리마운트된다.
- **제안**: `initialValues` 를 `useEffect` 없이 관리할 방법이 없다면 `useRef` 로 "초기화 완료" 플래그를 유지하거나, `queryClient.setQueryData` 로 invalidation 후에도 stale 값을 즉시 캐시에 유지해 불필요한 언마운트를 방지한다. 또는 저장 성공 후 `invalidateQueries` 대신 `setQueryData` 로 직접 갱신하면 isSuccess 전환이 발생하지 않는다.

### **[INFO]** `origins.includes(value)` — O(n) 중복 검사, 소규모에서는 무해하나 자료구조 선택 주의
- **위치**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` `addOrigin` (라인 639)
- **상세**: `origins.includes(value)` 는 배열을 순회하는 O(n) 검사다. `@ArrayMaxSize(100)` 제약이 적용되므로 최대 100개 원소이며 실제 비용은 무시 가능하다. 다만 UI 상태를 `string[]` 대신 `Set<string>` 으로 관리하면 중복 검사가 O(1)이 되고 `removeOrigin` 의 `.filter` 도 삭제 플래그 관리로 대체할 수 있다. 현재 규모에서는 INFO 수준이다.
- **제안**: 100개 제한이 유지되는 한 변경 불필요. 상한이 올라가거나 실시간 입력 검색이 추가될 경우 `Set` 으로 전환을 고려한다.

### **[INFO]** `ORIGIN_PATTERN` 정규식 — 컴포넌트 모듈 스코프 상수로 올바르게 위치함
- **위치**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` 라인 567
- **상세**: `const ORIGIN_PATTERN = /^https?:\/\/[^/\s?#]+$/i` 가 모듈 최상단에 단 한 번 컴파일된다. 렌더마다 새로 생성되지 않으므로 불필요한 RegExp 재할당이 없다. 백엔드 DTO 의 `@Matches` 데코레이터도 클래스 정의 시 한 번 컴파일된다. 정상적인 패턴.

### **[INFO]** `getSettings` API 응답에 캐시 헤더 부재 — 클라이언트 TanStack Query 의존
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` `getSettings` (라인 155–164)
- **상세**: `GET /:id/settings` 는 HTTP Cache-Control 헤더를 설정하지 않는다. 프론트엔드는 TanStack Query 의 기본 staleTime(0ms)으로 탭 포커스마다 재요청할 수 있다. 설정 데이터는 변경 빈도가 낮으므로 `staleTime` 을 늘리거나 서버 응답에 단기 Cache-Control(`max-age=60` 등)을 추가하면 불필요한 네트워크 왕복을 줄일 수 있다.
- **제안**: `useQuery` 호출에 `staleTime: 60_000` 정도를 추가하거나, 컨트롤러에서 `@Header('Cache-Control', 'private, max-age=60')` 를 선언한다. 현재 규모에서는 INFO 수준이다.

---

## 요약

이번 변경은 설정 값 저장·조회라는 단순한 CRUD 경로로 알고리즘적 복잡도 문제나 N+1 루프는 없다. 주요 관찰은 두 가지다. 첫째, 백엔드 서비스 레이어에서 권한 확인(member SELECT)과 워크스페이스 로딩(workspace SELECT)이 항상 직렬 2-쿼리로 실행되며, 이 패턴은 기존 서비스 전반에 이미 존재하는 구조적 비용이므로 본 변경의 범위 내에서 즉각 수정하기보다 후속 리팩터링으로 분리하는 것이 적절하다. 둘째, 프론트엔드 `EmbedOriginsCard` 의 `key` 기반 리마운트 전략은 저장 성공 후 `invalidateQueries` 와 결합될 때 에디터가 두 번 리마운트되는 잠재적 깜빡임을 유발하며, `setQueryData` 직접 갱신으로 회피할 수 있다. 나머지 발견사항은 소규모 데이터(100개 한도)와 낮은 요청 빈도를 감안할 때 실운영 영향이 미미한 INFO 수준이다.

---

## 위험도

LOW
