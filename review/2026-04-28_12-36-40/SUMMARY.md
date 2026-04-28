파일 쓰기 권한이 필요합니다. 승인해 주시면 `review/2026-04-28_12-36-40/SUMMARY.md`에 저장하겠습니다. 그 전에 보고서 내용을 여기에 먼저 출력합니다.

---

# Code Review 통합 보고서

> 대상 브랜치: `dockerfile` | 리뷰 시각: 2026-04-28 12:36:40  
> 변경 범위: 공용 `Pagination` 컴포넌트 + `usePageParam` 훅 신설, 6개 목록 페이지 페이지네이션 통합

---

## 전체 위험도

**MEDIUM** — 기능 회귀 없음. 즉시 수정이 필요한 항목은 세 가지(import 순서 오류, 스펙 누락, 이중 디바운스)이며, 데이터 파괴·보안 취약점은 없음.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 코드 품질 | `const PAGE_SIZE = 20;`이 `import` 블록 사이에 삽입됨. ESLint `import/first` 위반으로 CI 린트 실패 가능 | `llm-configs/page.tsx:14-16` | 모든 `import` 이후로 이동 |
| 2 | 테스트 | 페이지네이션이 추가된 5개 페이지(`integrations`, `knowledge-bases`, `llm-configs`, `schedules`, `triggers`) 테스트 없음 | 각 페이지 `__tests__/` 부재 | `workflows-page.test.tsx` 패턴 기반으로 회귀 케이스 추가 |
| 3 | 테스트 | `totalPages` 폴백 로직(`collections.length / PAGE_SIZE`)이 현재 페이지 아이템 수로 전체 페이지를 계산하는 버그 미커버. 마지막 페이지(5개)에서 `Math.ceil(5/20)=1`이 되어 페이지네이션 소멸 | `knowledge-bases/page.tsx:54`, `llm-configs/page.tsx:68`, `schedules/page.tsx:529`, `triggers/page.tsx:120` | 이 시나리오 테스트 추가 또는 `totalItems` 없을 때 totalPages를 1로 고정하는 정책 통일 |
| 4 | 문서/스펙 | `integrations`, `executions` 페이지에 페이지네이션 적용됐으나 대응 스펙 파일에 `page`, `limit` 파라미터 및 응답 형식 미추가. 나머지 5개 스펙은 업데이트됨 | `spec/2-navigation/` 내 integrations, executions 관련 문서 | 다른 스펙 파일과 동일한 패턴으로 API 규약 참조 추가 |
| 5 | UX / 요구사항 | 마지막 아이템 삭제 후 URL에 `?page=3`이 남아 빈 페이지에 고립됨. `deleteMutation.onSuccess`에서 페이지 자동 조정 없음 | `knowledge-bases/page.tsx`, `llm-configs/page.tsx` — deleteMutation `onSuccess` | `onSuccess`에서 현재 페이지 아이템이 1개였을 경우 `setPage(Math.max(1, page - 1))` 호출 |
| 6 | UX / 요구사항 | `schedules` 캘린더 뷰가 페이지네이션된 쿼리(현재 페이지 20개)를 공유해 21번째 이후 스케줄이 캘린더에 미표시 | `schedules/page.tsx` — 캘린더 뷰 분기 | 캘린더 뷰 전용 별도 쿼리(limit 없이 전체 조회) 또는 UI 안내 |
| 7 | 사이드 이펙트 | `workflows/page.tsx` `useEffect`가 `setPage`를 의존성으로 포함. `setPage(1)` 호출 → URL 변경 → `searchParams` 갱신 → `setPage` identity 변경 → effect 재실행 → 이중 디바운스(최대 600ms) 유발 | `workflows/page.tsx` — `useEffect([search, setPage])` | `setPage`를 의존성에서 제외하고 `ref`로 캡처하거나 `page > 1` 조건 추가 |
| 8 | 아키텍처 | 백엔드가 `schedules`, `triggers` 엔드포인트의 `page`/`limit`를 미지원 시 `totalPages=1` 폴백으로 페이지네이션 무음 실패(silent failure) | `schedules/page.tsx`, `triggers/page.tsx` | 백엔드 지원 여부 확인 또는 피처 플래그로 보호 |
| 9 | 아키텍처 | API 응답 정규화 로직(`Array.isArray(data?.data) ? ... : []` + `totalPages` 계산)이 4개 파일에 중복 | `knowledge-bases/page.tsx`, `llm-configs/page.tsx`, `schedules/page.tsx`, `triggers/page.tsx` | `lib/api/utils.ts`에 `normalizePagedResponse<T>(body, pageSize)` 헬퍼 추출 |
| 10 | 성능 | 페이지 전환 시 `placeholderData: keepPreviousData` 미설정으로 캐시 없는 페이지 이동 시 목록 사라졌다가 재등장(CLS) | `knowledge-bases/page.tsx:44`, `llm-configs/page.tsx:60`, `schedules/page.tsx:492`, `triggers/page.tsx:82` | `useQuery`에 `placeholderData: (prev) => prev` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 일관성 | `executions/page.tsx`만 `useState(1)`로 페이지 관리. 뒤로 가기·새로고침 시 page=1 초기화 | `executions/page.tsx:114` | 의도적 설계라면 주석 명시, 아니라면 `usePageParam`으로 교체 |
| 2 | 일관성 | `integrations/page.tsx`만 `pagination && pagination.totalPages > 1`로 외부 렌더링 가드. 다른 페이지는 컴포넌트 내부 가드에 의존 | `integrations/page.tsx:300` | 외부 가드 제거하여 컴포넌트 내부 가드로 통일 |
| 3 | 일관성 | `PAGE_SIZE = 20` 상수 4개 파일에 각각 로컬 선언. 전역 변경 시 수동 동기화 필요 | `knowledge-bases`, `llm-configs`, `schedules`, `triggers` 각 페이지 상단 | `lib/api/constants.ts`에 `DEFAULT_PAGE_SIZE = 20` 추출 검토 |
| 4 | 일관성 | `schedules/page.tsx`에 필터 변경 시 `setPage(1)` 리셋 미추가. `triggers/page.tsx`에는 있음 | `schedules/page.tsx` — 필터 변경 핸들러 | 필터 변경 핸들러에 `setPage(1)` 추가 |
| 5 | 성능 | `Pagination`에 `React.memo` 미적용. props만 의존하는 순수 컴포넌트이므로 부모 리렌더마다 불필요하게 재렌더됨 | `pagination.tsx:50` | `React.memo` 적용 |
| 6 | 성능 | `buildTokens` 결과가 `useMemo` 없이 매 렌더마다 재계산 | `pagination.tsx:67` | `useMemo([page, totalPages, siblingCount])` 적용 |
| 7 | 성능 | 목록 쿼리에 `staleTime` 미설정(기본값 0). 탭 포커스 복귀마다 background refetch 발생 | `knowledge-bases`, `llm-configs`, `schedules`, `triggers` useQuery | `staleTime: 30_000` 수준 적용 검토 |
| 8 | 성능 | `integrations/page.tsx`의 `updateParam`·`onPageChange` 핸들러가 `useCallback` 없이 매 렌더마다 재생성 | `integrations/page.tsx` | `useCallback`으로 안정화 |
| 9 | 아키텍처 | `Pagination`의 `className` prop이 `?? "default"` 패턴 사용. `cn(defaultClass, className)` 패턴과 다름 | `pagination.tsx:62-65` | `cn("flex flex-wrap items-center justify-center gap-2", className)` 방식으로 변경 |
| 10 | 아키텍처 | `queryFn` 내부에서 `totalPages` 파생값 계산. 데이터 패칭과 비즈니스 로직 혼재 | `schedules/page.tsx:519-535`, `triggers/page.tsx:109-122` | `queryFn`은 raw 응답 반환, `totalPages`는 `select` 또는 컴포넌트 본문에서 계산 |
| 11 | 보안 | `parsePage()`가 하한(1)만 검증, 상한 없음. `?page=9999999` 등이 API에 그대로 전달됨 | `use-page-param.ts:13-17` | 서버 범위 검증 필수. 클라이언트에서도 `Math.min(n, MAX_SAFE_PAGE)` 상한 추가 권장 |
| 12 | 테스트 | `pagination.test.tsx`에서 `siblingCount=0/2`, `className` prop, `page > totalPages` 경계값 케이스 미검증 | `pagination.tsx` — `buildTokens`, PaginationProps | 경계값 케이스 및 prop 조합 테스트 추가 |
| 13 | 테스트 | `workflows-page.test.tsx`의 `cleanup()`이 `beforeEach`에 위치. 표준은 `afterEach` | `workflows-page.test.tsx:51` | `afterEach`로 이동 |
| 14 | 문서 | `schedules`, `triggers` queryFn에 `// Backend (api-convention §5.2)` 주석 있으나 `knowledge-bases`, `llm-configs`에는 없어 일관성 깨짐 | `schedules/page.tsx`, `triggers/page.tsx` | 주석 제거 또는 전체 파일에 균일하게 적용 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | 스펙 누락(integrations/executions), 삭제 후 빈 페이지 고립, 캘린더 뷰 데이터 불완전 |
| testing | MEDIUM | 5개 페이지 테스트 없음, `totalPages` 폴백 버그 미검증 |
| architecture | LOW | API 응답 정규화 로직 프레젠테이션 레이어 분산, 페이지 상태 관리 패턴 3종 혼재 |
| side_effect | LOW | `setPage` 의존성으로 인한 이중 디바운스 |
| performance | LOW | DOM 노드 수 감소(긍정적), `placeholderData` 누락, `React.memo` 미적용 |
| api_contract | LOW | schedules/triggers 백엔드 지원 미검증, `totalPages` 폴백 중복 |
| maintainability | LOW | 응답 정규화 로직 4중 복제 |
| security | LOW | 페이지 파라미터 상한선 미설정 |
| database | LOW | `collections.length` 폴백 과소 추정 |
| documentation | LOW | integrations/executions 스펙 미업데이트 |
| scope | LOW | `const PAGE_SIZE` import 사이 삽입 |
| dependency | LOW | `const PAGE_SIZE` import 사이 위치 |
| concurrency | NONE | React Query 기반 격리로 실질적 동시성 문제 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| concurrency | React Query의 queryKey 기반 격리로 경쟁 조건 없음. URL 파라미터 연속 호출도 현 UI 구조에서 실제 발생 경로 없음 |

---

## 권장 조치사항

### 즉시 수정 (Before merge)

1. **`llm-configs/page.tsx` import 순서 수정** — `const PAGE_SIZE = 20;`을 모든 import 이후로 이동. 10개 에이전트가 공통 지적. CI 린트 실패 가능성 차단.
2. **스펙 문서 보완** — `spec/2-navigation/`의 integrations 및 executions 관련 파일에 `page`, `limit` 쿼리 파라미터 및 페이지네이션 응답 형식 추가.
3. **`workflows/page.tsx` 이중 디바운스 수정** — `useEffect` 의존성에서 `setPage` 제거, `ref`로 캡처하거나 `page > 1` 조건 추가.

### 단기 수정 (Next sprint)

4. **5개 페이지 테스트 추가** — `integrations`, `knowledge-bases`, `llm-configs`, `schedules`, `triggers`에 페이지네이션 표시/숨김, 필터 변경 시 page 리셋 회귀 케이스 추가.
5. **삭제 후 빈 페이지 고립 수정** — `deleteMutation.onSuccess`에서 `setPage(Math.max(1, page - 1))` 호출 추가.
6. **schedules 캘린더 뷰 데이터 분리** — 캘린더 뷰 전용 별도 쿼리(limit 없이 전체 조회) 또는 UI 안내.
7. **`placeholderData: (prev) => prev` 추가** — 4개 목록 페이지 `useQuery`에 일괄 적용.
8. **schedules 필터 변경 시 `setPage(1)` 추가** — triggers와 동일한 패턴으로 통일.

### 기술 부채 (Backlog)

9. **`normalizePagedResponse<T>` 헬퍼 추출** — 4개 파일에 중복된 응답 정규화 로직을 `lib/api/utils.ts`로 집중화.
10. **`executions/page.tsx` URL 동기화** — `useState(1)` → `usePageParam` 전환 또는 주석으로 의도 명시.
11. **`Pagination` 컴포넌트 최적화** — `React.memo`, `buildTokens` `useMemo`, `className`을 `cn()` 패턴으로 통일.

---

`SUMMARY.md` 파일 저장을 위해 쓰기 권한 승인이 필요합니다. 승인해 주시면 `review/2026-04-28_12-36-40/SUMMARY.md`에 저장하겠습니다.