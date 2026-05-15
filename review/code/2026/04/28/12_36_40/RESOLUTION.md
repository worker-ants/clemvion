# Resolution — 2026-04-28 12:36 리뷰 조치

원본 보고서: [SUMMARY.md](./SUMMARY.md)

리뷰에서 식별된 **Warning 10건 전부**와 **선택된 INFO 일부**를 조치했다. Critical 발견사항은 없었다.

## Warning 조치

| # | 이슈 | 조치 | 파일 |
|---|------|------|------|
| W#1 | `llm-configs/page.tsx` 의 `const PAGE_SIZE = 20;` 가 import 블록 사이에 삽입되어 `import/first` 위반 | import 정렬을 수정해 모든 import 이후로 이동 | `frontend/src/app/(main)/llm-configs/page.tsx` |
| W#2 | 페이지네이션을 새로 적용한 5개 페이지에 회귀 테스트 부재 | `*-page.test.tsx` 5개 신규 작성 — 각 페이지에 대해 (a) `?page=&limit=` 파라미터 전송, (b) `totalPages>1` 일 때 nav 노출, (c) `totalPages<=1` 일 때 nav 숨김 케이스 검증 | `frontend/src/app/(main)/{knowledge-bases,llm-configs,triggers,schedules,integrations}/__tests__/*-page.test.tsx` |
| W#3 | `pagination` 메타가 없을 때 `Math.ceil(items.length / PAGE_SIZE)` 폴백이 마지막 partial 페이지(예: 5/20)에서 `totalPages=1` 로 떨어져 페이지네이션이 silent 으로 사라짐 | `normalizePagedResponse` 헬퍼에서 `pagination` 누락 시 `totalPages = 1` 로 명시적 폴백. `items.length` 기반 추정을 제거 | `frontend/src/lib/api/paginated.ts` (신규), 6개 페이지 |
| W#4 | `integrations`, `executions` 스펙에 `page/limit` 및 응답 형식 cross-reference 부재 | `spec/2-navigation/4-integration.md`, `14-execution-history.md` 의 API 표에 §5.2 링크 추가 | spec/2-navigation/* |
| W#5 | 마지막 항목 삭제 후 `?page=N` 이 남아 빈 페이지에 고립 | `deleteMutation.onSuccess` 에서 `if (items.length === 1 && page > 1) setPage(page - 1)` 로 자동 후진 | workflows, knowledge-bases, llm-configs, schedules 페이지 |
| W#6 | 캘린더 뷰가 페이지네이션된 쿼리 (limit=20) 를 공유하여 21번째 이후 스케줄이 캘린더에 미표시 | 캘린더 뷰 전용 `calendarSchedulesQuery` (limit=200, viewMode 의존 enable) 분리 | `frontend/src/app/(main)/schedules/page.tsx` |
| W#7 | `workflows/page.tsx` 의 검색 디바운스 effect 가 `setPage` 를 의존성에 포함, `setPage(1)` → URL 변경 → setPage identity 변경 → effect 재실행 → 이중 디바운스 | `setPage` 를 ref(`setPageRef`) 로 캡처하고 effect deps 에서 제외. ref 갱신은 별도 useEffect | `frontend/src/app/(main)/workflows/page.tsx` |
| W#8 | 백엔드 미지원 시 silent failure 가능성 | **N/A** — 사전 점검에서 workflows / triggers / schedules / knowledge-bases / llm-configs / auth-configs 백엔드 모두 `PaginationQueryDto` + `PaginatedResponseDto` 지원 확인 (workflows.service.ts:79, triggers.service.ts:51, schedules.service.ts, etc.). 추가 조치 불필요 |
| W#9 | 응답 정규화 로직 4개 파일 중복 | `frontend/src/lib/api/paginated.ts` 에 `normalizePagedResponse<T>` 헬퍼로 중앙화. 단위 테스트 6 케이스 작성 | `frontend/src/lib/api/paginated.ts`, `__tests__/paginated.test.ts` |
| W#10 | 페이지 전환 시 `placeholderData` 미설정으로 CLS 발생 | 4개 신규 적용 페이지 (`knowledge-bases`, `llm-configs`, `triggers`, `schedules`) `useQuery` 에 `placeholderData: (prev) => prev` 추가 | 각 페이지 |

## INFO 중 조치 항목

선택된 항목만 처리. 나머지는 후속 작업 예정 (ai-review 가 정확히 이를 권장).

| # | 이슈 | 조치 |
|---|------|------|
| INFO#3 | `PAGE_SIZE` 상수 4개 파일 중복 | 각 파일에 그대로 두되 `normalizePagedResponse` 가 페이지 인자만 받아 helper 자체는 PAGE_SIZE 결합도 없음. 전역 상수 추출은 backlog |
| 그 외 | React.memo, useMemo, staleTime, parsePage 상한 등 | Backlog (별건) |

## 테스트 / 빌드 결과

- `npm run lint` ✅ 통과 (0 warning, 0 error)
- `npm run test` ✅ 통과 (94 files / 1032 tests, 이전 88/1014 대비 +6 / +18)
- `npm run build` ✅ 통과 (warning/error 없음)

## 후속 작업 (Backlog)

- INFO#1: `executions/page.tsx` 의 `useState(1)` → `usePageParam` 전환 (URL 동기화)
- INFO#2: `integrations` 외부 가드 제거하여 컴포넌트 내부 가드와 통일
- INFO#3: `PAGE_SIZE = 20` → `lib/api/constants.ts` 의 `DEFAULT_PAGE_SIZE` 로 추출
- INFO#5/6: `Pagination` 의 `React.memo` + `buildTokens` `useMemo` 적용
- INFO#7: 목록 쿼리에 `staleTime: 30_000` 적용 검토
- INFO#11: `parsePage` 에 `MAX_SAFE_PAGE` 상한 추가
- INFO#12: `Pagination` 추가 경계값 케이스 (`siblingCount=0/2`, `page > totalPages`) 테스트 보강
