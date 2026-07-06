# RESOLUTION — 워크플로우 목록 폴더 필터 (FE-2)

리뷰 산출: `review/code/2026/07/06/10_32_44/` (requirement / maintainability / testing / scope / api-contract 5인 fan-out)

전체 위험도 LOW. Critical 0, Warning 2 — 둘 다 해소. INFO 는 저비용·고가치인 것만 반영.

## Warning (해소)

### W1 — 워크스페이스 전환 시 스테일 폴더 필터 (requirement)
`folderId` state 와 `foldersQuery`(key `["folders"]`)가 워크스페이스 전환에 반응하지 않아, 전환 후
이전 워크스페이스의 폴더 목록이 그대로 노출되고 그 folderId 로 필터하면 새 워크스페이스에서 매칭 0건.
`switchWorkspace` 는 react-query 캐시를 비우지 않음(확인: workspace-store.ts·sidebar.tsx).

**Fix** (page.tsx):
- 기존 `useWorkspaceStore.subscribe` 콜백(이미 ownership 을 리셋)에 `setFolderId("")` 추가 — ownership 과 대칭.
- `foldersQuery` key 를 `["folders", currentWorkspaceId]` 로 워크스페이스 스코프화 → 전환 시 refetch.
- 신규 테스트 `clears the selected folder when the workspace is switched` (setFolderId 제거 시 fail = 비-vacuous).

### W2 — page-reset 단언이 vacuous (testing)
"페이지 2 이동 후 리셋 확인" 테스트가 실제로는 회귀를 못 잡음 — next/navigation mock 의 `replace` 가
no-op 이고 `useSearchParams` 가 정적이라 page state 가 항상 1. (기존 sort describe 의 동일 패턴을 복제한 것.)

**Fix** (test): 오해를 부르는 "페이지 2 이동" 셋업 제거. 테스트명을
`sends ?folderId=<id> on the first page when a folder is selected` 로 정정하고, folderId 송신을 실제
단언으로, page="1" 은 setPage(1) 배선을 문서화하는 보조 단언으로 명시(mock 한계를 주석에 기록).
공용 next/navigation mock 을 reactive 하게 만드는 것은 sort/pagination describe 전체에 영향을 주는
별도 인프라 개선이라 이번 범위에서 제외(testing 리뷰어도 후속으로 분류).

## INFO (반영)
- **api-contract**: ad-hoc `data.data ?? []` → 중앙 `unwrap()` 헬퍼(lib/api/unwrap.ts, 다수 sibling 사용) +
  `apiClient.get<{ data: FolderData[] }>` 응답 제네릭 명시. (folders.ts)
- **testing/maintainability**: 테스트 파일의 로컬 `FolderData` 재정의 → `import type { FolderData }` 로
  실제 계약과 동기화(런타임 elide, vi.mock 과 무관).

## INFO (미반영 — 근거)
- **requirement SPEC-DRIFT**: spec §2.3/§3.1 의 "프론트 미소비" 문구가 이번 구현으로 낡음 → spec 편집은
  planner 트랙(개발자 spec read-only). plan 후속으로 이관.
- **requirement INFO**: query-workflow.dto.ts 의 "빈 문자열=루트 폴더" 주석 vs 동작 불일치 = FE-2 범위 밖
  기존 백엔드 이슈(이번 프론트는 빈 값 미송신이라 무영향).
- **maintainability INFO**: 폴더 조회 실패 폴백(빈 배열) 의도 미문서화 등 — 사소, 즉시 조치 불요.

## 검증
- vitest workflows-page.test.tsx: **19 passed**
- frontend `tsc --noEmit`: clean (0)
- eslint 변경 5파일: clean
