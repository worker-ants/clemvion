# Scope 리뷰 — FE-2 워크플로우 목록 폴더 필터 UI

- 대상: `git diff origin/main...HEAD` (HEAD=6279d01b6, 1 commit)
- 작업 범위: 폴더 필터 UI 단독 (태그 필터·마켓플레이스 링크는 planner 결정 대기, 이번 구현 제외 대상)

## 변경 파일 목록

```
codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx
codebase/frontend/src/app/(main)/workflows/page.tsx
codebase/frontend/src/lib/api/folders.ts                 (신규)
codebase/frontend/src/lib/i18n/dict/en/workflows.ts
codebase/frontend/src/lib/i18n/dict/ko/workflows.ts
plan/in-progress/spec-sync-workflow-list-gaps.md
```

백엔드 파일 변경 없음 (`git diff --name-only | grep backend` → 0건). 서버 `?folderId=` 지원은 기존 구현을 그대로 재사용한다는 커밋 메시지 서술과 일치.

## 발견사항

결함 없음. 아래는 확인한 항목별 근거.

- **범위 일치 — 폴더 필터만 구현**
  - 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx`
  - 상세: 추가된 것은 `folderId` state, `foldersQuery`(`GET /folders`), 필터 select, `hasActiveFilters`/`handleResetFilters` 연동, `queryKey`에 `folderId` 삽입뿐. 태그 관련 코드(`workflows.tags` 컬럼 헤더, `workflow.tags?.map` 배지 렌더)는 diff에 `+`/`-` 없이 그대로 남아있는 pre-existing 코드이며, 태그 필터 UI(멀티 선택 등)는 추가되지 않음. 마켓플레이스 링크·빈 상태 CTA 확장도 없음.

- **정렬/ownership/pagination 로직 불변**
  - 위치: `page.tsx`의 `sortKey`, `ownership`, `usePageParam`, `normalizePagedResponse` 관련 코드
  - 상세: diff에 이 로직들의 수정은 없고, `queryKey` 배열에 `folderId` 항목 추가와 `hasActiveFilters`/`handleResetFilters`에 `folderId` 조건 추가만 있음. 기존 정렬 옵션·ownership 3-tier·pagination 계산식에는 손대지 않음.

- **신규 API 클라이언트 스코프 적절**
  - 위치: `codebase/frontend/src/lib/api/folders.ts` (신규 파일, 25 lines)
  - 상세: `foldersApi.list()` 하나만 노출, 폴더 필터가 소비하는 `id`/`name`/`parentId`/`sortOrder` 필드만 typed. CRUD 등 필터에 불필요한 기능은 추가하지 않음(over-engineering 없음).

- **i18n 변경 최소·대칭**
  - 위치: `dict/en/workflows.ts`, `dict/ko/workflows.ts`
  - 상세: 양쪽 각 4줄, `folderFilter.{aria, all}` 키만 추가. 태그 필터용 문자열이나 다른 무관 키 추가 없음.

- **테스트 변경 스코프 일치**
  - 위치: `workflows-page.test.tsx` (+159 lines)
  - 상세: 신규 `foldersApi` mock(기본 빈 배열 — 기존 describe에 영향 없도록 설계) + 신규 `describe("WorkflowsPage — folder filter (NAV §2.3)")` 블록 하나만 추가. 기존 pagination/ownership/search/sort describe 블록의 assertion·mock 로직은 수정되지 않음(문자열 비교로 diff 확인 완료 — 순수 추가).

- **plan 갱신이 폴더 항목만 반영**
  - 위치: `plan/in-progress/spec-sync-workflow-list-gaps.md`
  - 상세: 폴더 필터 체크박스만 `[ ]` → `[x]`로 변경되고 완료 근거(파일·테스트·커밋 슬러그)가 기재됨. 태그 필터·마켓플레이스 링크 체크박스는 `[ ]` 그대로 유지. 진행 로그에 "남은 잔여 = 태그 필터 UI(planner 결정 필요)·마켓플레이스 링크"라고 명시해 다음 작업 경계를 재확인. `worktree:` frontmatter 값만 이번 작업 worktree로 갱신 — 다른 frontmatter(started/owner)는 불변.

- **포맷팅/무관 diff 노이즈 없음**
  - 상세: 각 diff hunk가 전부 실질 추가 라인이며, 공백/줄바꿈만 바뀐 라인이나 import 재정렬·불필요한 리팩토링은 발견되지 않음.

## 요약

이번 커밋은 폴더 필터 UI(신규 `foldersApi`, `page.tsx`의 `folderId` state·select·filter/reset 연동, i18n 키, 대응 테스트)만 정확히 구현했으며 태그 필터·마켓플레이스 링크에는 전혀 손대지 않았다. 정렬·ownership·pagination 등 기존 로직은 `queryKey`/`hasActiveFilters`/`resetFilters`에 `folderId` 항목을 끼워 넣는 최소 침습적 수정 외에는 그대로 유지되어 무관 리팩토링이나 포맷팅 노이즈가 없다. 백엔드 코드 변경도 없어 커밋 메시지가 서술한 "서버는 기존 지원 재사용" 주장과 실제 diff가 일치한다. plan 문서도 폴더 항목만 체크되고 태그·마켓플레이스는 미체크 상태로 정확히 남아 있다. 범위 준수 관점에서 문제를 발견하지 못했다.

## 위험도

NONE
