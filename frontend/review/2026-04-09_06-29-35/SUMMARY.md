# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - API 응답 정규화 부재, 중복 코드, 인접 실행 네비게이션의 구조적 한계, 테스트 커버리지 갭이 복합적으로 존재

## Critical 발견사항
없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API/Architecture | **API 응답 래핑 미정규화** — `(data as any).data ?? data` 패턴이 컴포넌트 곳곳에 반복. axios 레이어와 서버 응답의 `{ data: T }` 구조가 중첩되어 타입 안전성이 붕괴됨 | `[executionId]/page.tsx:108-112,121-126`, `executions/page.tsx:152-156` | `executionsApi` 레이어 또는 axios interceptor에서 응답 unwrapping을 일원화 |
| 2 | Architecture/Performance | **인접 실행 네비게이션의 비효율적 구현** — prev/next ID를 위해 `limit: 100`으로 전체 목록을 로드 후 클라이언트에서 `findIndex`. 100건 초과 시 네비게이션 실패(기능적 버그) | `[executionId]/page.tsx:114-132` | 백엔드에 `prev_id`/`next_id`를 포함한 adjacent 엔드포인트 추가 또는 cursor 기반 조회로 교체 |
| 3 | Requirement | **`currentIndex === -1` 엣지 케이스 미처리** — 현재 executionId가 목록에 없으면 `items[-1+1]` = `items[0]`이 잘못된 prev로 반환됨 | `[executionId]/page.tsx:137-143` | `if (currentIndex === -1) return { prev: null, next: null }` 추가 |
| 4 | Maintainability/Architecture | **`STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`, `formatDuration` 두 파일에 중복 정의** — 상태값 추가 시 양쪽 모두 수정 필요 | `[executionId]/page.tsx:22-65`, `executions/page.tsx:21-65` | `@/lib/utils/execution-status.ts`로 추출하여 단일 출처(SSoT) 유지 |
| 5 | Architecture | **`NodeResultsTab` 과도한 prop drilling** — 6개 props 중 `selectedNodeId`, `nodeDetailTab`은 내부 상태로 관리 가능 | `[executionId]/page.tsx:280-298` | 해당 상태를 `NodeResultsTab` 내부로 이동, 부모에서는 `defaultSelectedNodeId`만 전달 |
| 6 | Requirement | **`waiting_for_input` 상태 필터 버튼 누락** — `STATUS_LABEL`에는 정의되어 있으나 `FILTER_BUTTONS`에 없어 해당 상태 필터링 불가 | `executions/page.tsx` `FILTER_BUTTONS` 배열 | `{ label: "Waiting", value: "waiting_for_input" }` 항목 추가 |
| 7 | Requirement/Security | **API 에러 상태 미처리** — `executionQuery.isError` 시 "Execution not found."와 구분 없이 동일 처리, 네트워크 에러와 데이터 미존재를 구분하지 않음 | `[executionId]/page.tsx` | `isError` 분기 추가 후 별도 에러 UI 표시 |
| 8 | Security | **URL 경로에 서버 응답 데이터 무검증 삽입** — `adjacentQuery.data.prev/next`를 `router.push()`에 직접 사용, 악의적 응답 시 의도치 않은 경로로 리다이렉트 가능 | `[executionId]/page.tsx` prev/next 클릭 핸들러 | ID가 UUID/alphanumeric 형식인지 클라이언트에서 검증 후 사용 |
| 9 | Security | **라우트 파라미터 클라이언트 측 검증 부재** — `use(params)`로 얻은 `workflowId`, `executionId`를 무검증 API 호출에 사용 | 두 `page.tsx` 파일 모두 | UUID 정규식 검증 후 비정상 값이면 404 리다이렉트 |
| 10 | Security | **`JsonViewer`에서 민감 데이터 무제한 노출** — 노드 input/output/error 데이터가 그대로 렌더링, API 키·PII·토큰 등이 UI에 노출 가능 | `[executionId]/page.tsx` `JsonViewer` 컴포넌트 | 민감 필드 마스킹 또는 백엔드에서 민감 데이터 제거 후 응답 |
| 11 | Testing | **`vi.clearAllMocks()` 후 mock 재설정 누락** — 모듈 레벨 mock 구현이 제거되어 테스트 실행 순서에 따라 비결정적 실패 유발 가능 | `execution-list-page.test.tsx:54-56`, `execution-detail-page.test.tsx` | `beforeEach`에서 사용하는 모든 mock을 명시적으로 재설정 |
| 12 | Testing | **로딩/에러 상태 테스트 부재** — 스켈레톤 렌더링, API 실패, null 데이터 분기가 테스트되지 않음 | `execution-detail-page.test.tsx`, `execution-list-page.test.tsx` | 로딩 중, 에러, not-found 케이스 테스트 추가 |
| 13 | Testing | **페이지네이션/정렬/필터 인터랙션 테스트 부재** — `handleSort`, 필터 클릭, 페이지네이션 동작이 전혀 검증되지 않음 | `execution-list-page.test.tsx` | 정렬 클릭 후 API 재호출 파라미터 검증 테스트 추가 |
| 14 | Testing | **Prev/Next 네비게이션 버튼 테스트 부재** — prev/next null 시 버튼 비활성화, 클릭 시 라우팅 동작 미검증 | `execution-detail-page.test.tsx` | prev/next null 케이스 및 정상 네비게이션 테스트 추가 |
| 15 | Concurrency | **Timeline에서 노드 클릭 시 `nodeDetailTab` 미초기화** — 이전 탭 상태가 유지되어 잘못된 탭이 표시될 수 있음 | `[executionId]/page.tsx` `onNodeClick` 핸들러 | `onNodeClick`에서 `setNodeDetailTab` 리셋 추가 |
| 16 | Performance | **`JsonViewer` `memo` 없이 `JSON.stringify` 반복 호출** — 부모 리렌더 시마다 stringify 재실행 | `[executionId]/page.tsx` `JsonViewer` 컴포넌트 | `React.memo` 또는 `useMemo`로 `formatted` 값 캐싱 |
| 17 | Performance | **행 렌더링 시 `nodeExecutions` 3중 filter 순회** — 페이지당 20행 × 노드 수만큼 O(n×m) 연산 | `executions/page.tsx` `executions.map()` 내부 | 단일 `reduce`로 집계하거나 서버에서 집계 필드 제공 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | **페이지네이션 버튼 무제한 렌더링** — `totalPages`가 클 경우 수십~수백 개 버튼 DOM 생성, 비정상적으로 큰 서버 응답값 시 DoS-like 성능 저하 | `executions/page.tsx` 페이지네이션 섹션 | 슬라이딩 윈도우(현재 ±2) 방식 적용, `safeTotalPages = Math.min(totalPages, 100)` 상한선 설정 |
| 2 | Performance | **`sortedNodeExecutions` 집계 중복 순회** — 정렬 후 `completedCount`/`failedCount`를 별도 filter로 재순회 | `[executionId]/page.tsx` | `useMemo` 내에서 정렬과 집계를 동시에 처리 |
| 3 | Concurrency | **`running` 상태 실행에 polling 미적용** — 진행 중인 실행을 보는 경우 수동 새로고침 필요 | `[executionId]/page.tsx` `executionQuery` | `refetchInterval: (data) => ["running","pending"].includes(data?.status) ? 3000 : false` 추가 |
| 4 | Testing | **`Failed Execution` 테스트 블록에서 `createWrapper` 미재사용** — 인라인 wrapper 구성으로 일관성 부족 | `execution-detail-page.test.tsx:150-170` | `createWrapper()` 헬퍼로 통일 |
| 5 | Testing | **`mockBack` 선언 후 미사용** — `router.back()` 호출 검증 테스트 없음 | `execution-list-page.test.tsx:6` | 뒤로가기 버튼 클릭 테스트 추가 또는 변수 제거 |
| 6 | Testing | **`getAllByRole("button")` 인덱스 의존** — DOM 순서 변경 시 테스트 오작동 | `execution-detail-page.test.tsx` 백 버튼 테스트 | `getByRole("button", { name: /back/i })` 또는 `aria-label` 활용 |
| 7 | Testing | **`formatDuration` 단위 테스트 부재** — 두 파일에 중복 정의된 순수 함수에 경계값 테스트 없음 | `page.tsx` (양쪽 파일) | `formatDuration.test.ts`에서 null, 0, 999, 1000, 60000 등 경계값 테스트 추가 |
| 8 | Testing | **`document.querySelectorAll("tbody tr")` 전역 DOM 의존** — `screen` API 대신 전역 document 사용 | `execution-list-page.test.tsx` | `within(screen.getByRole("table")).getAllByRole("row")` 사용 |
| 9 | API | **`totalPages` 미존재 시 폴백 로직 없음** — API가 반환하지 않을 경우 페이지네이션 UI 숨겨짐 | `executions/page.tsx:161` | `Math.ceil(total / limit)`로 클라이언트 재계산 폴백 추가 |
| 10 | Architecture | **`QueryKey` `["workflow", workflowId]` 중복 사용** — 두 페이지에서 동일 키 사용하나 의도 불명확 | `[executionId]/page.tsx:103`, `executions/page.tsx:140` | 의도적 캐시 공유라면 주석으로 명시 |
| 11 | Documentation | **`// API may wrap response in { data: ... }` 주석의 맥락 부재** — 왜 이중 래핑이 발생하는지 설명 없음 | `[executionId]/page.tsx:109` | 백엔드 스펙과의 불일치 상황 명시 |
| 12 | Performance | **`detailTabs` 배열 렌더마다 재생성** | `[executionId]/page.tsx` `NodeResultsTab` 내부 | `useMemo(() => [...], [selectedNode?.error])`로 캐싱 |
| 13 | Testing | **`NodeResultsTab` Input/Output/Error 서브탭 전환 테스트 없음** | `execution-detail-page.test.tsx` | 노드 선택 후 각 탭 클릭 → JSON 렌더링 검증 테스트 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `waiting_for_input` 필터 누락, adjacentQuery 100건 한계, currentIndex=-1 버그, 에러 상태 미처리 |
| performance | MEDIUM | adjacent 100건 bulk fetch, nodeExecutions 3중 순회, JsonViewer memo 미적용 |
| api_contract | MEDIUM | 응답 래핑 이중 처리, adjacent 전용 API 부재, 정렬 파라미터 네이밍 불명확 |
| architecture | MEDIUM | 상수/유틸 중복, API 응답 파싱 컴포넌트 내 산재, NodeResultsTab prop drilling |
| maintainability | MEDIUM | 상수 중복, API 응답 정규화 부재, adjacentQuery 구조, NodeResultsTab 복잡성 |
| security | MEDIUM | 라우트 파라미터 미검증, 서버 응답 무검증 라우팅, JsonViewer 민감 데이터 노출 |
| testing | MEDIUM | 로딩/에러 상태 미테스트, 인터랙션 테스트 부재, vi.clearAllMocks 후 재설정 누락 |
| side_effect | MEDIUM | adjacentQuery 대량 fetch, vi.clearAllMocks mock 소실, nodeDetailTab 미초기화 |
| concurrency | LOW | adjacentQuery stale prev/next 일시 노출, running 상태 polling 미적용 |
| documentation | LOW | 상수/유틸 중복 (변경 불일치 위험), API 응답 래핑 주석 맥락 부재 |
| scope | LOW | 중복 상수/유틸, adjacent limit:100, router.back 테스트 누락 |
| dependency | NONE | 신규 외부 의존성 없음, 기존 패키지만 활용 |
| database | NONE | 해당 없음 (순수 프론트엔드 코드) |

## 발견 없는 에이전트

- **database** — 데이터베이스 직접 접근 코드 없음 (REST API 추상화)
- **dependency** — 신규 외부 의존성 없음, 모든 임포트는 기존 패키지 또는 내부 모듈

## 권장 조치사항

1. **[즉시] `currentIndex === -1` 엣지 케이스 버그 수정** — 잘못된 prev 반환으로 인한 UI 오작동 방지 (`[executionId]/page.tsx:137`)
2. **[즉시] 테스트 `vi.clearAllMocks()` 후 mock 재설정** — CI에서 비결정적 실패 방지 (`execution-list-page.test.tsx`, `execution-detail-page.test.tsx`)
3. **[높음] API 응답 unwrapping을 `executionsApi` 레이어로 이동** — `any` 캐스팅 및 중복 패턴 제거
4. **[높음] `STATUS_*` 상수 및 `formatDuration` 공통 모듈 추출** — `@/lib/utils/execution-status.ts`로 분리
5. **[높음] `waiting_for_input` 필터 버튼 추가** — 스펙과의 요구사항 불일치 해소
6. **[높음] 누락된 테스트 추가** — 로딩/에러 상태, Prev/Next 네비게이션, 정렬/필터/페이지네이션 인터랙션
7. **[중간] Timeline → Node Results 탭 전환 시 `nodeDetailTab` 초기화** — 잘못된 탭 상태 잔류 방지
8. **[중간] 라우트 파라미터 UUID 검증 추가** — 비정상 입력에 대한 방어
9. **[중간] `adjacentQuery` 100건 한계 해소** — 백엔드 adjacent 엔드포인트 추가 또는 cursor 기반 조회
10. **[낮음] 페이지네이션 슬라이딩 윈도우 적용 및 `totalPages` 상한선 설정** — UI 깨짐 및 DoS-like 렌더링 방지
11. **[낮음] `JsonViewer` `React.memo` 적용, `nodeExecutions` 집계 단일 reduce로 개선** — 렌더링 성능 최적화
12. **[낮음] `running` 상태 실행에 `refetchInterval` 적용** — 실시간 상태 반영