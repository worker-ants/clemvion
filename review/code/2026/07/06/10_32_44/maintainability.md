# 유지보수성 리뷰 — 워크플로우 목록 폴더 필터 UI

대상: `git diff origin/main...HEAD` (HEAD=6279d01b6)
- `codebase/frontend/src/lib/api/folders.ts` (신설)
- `codebase/frontend/src/app/(main)/workflows/page.tsx`
- `codebase/frontend/src/lib/i18n/dict/{ko,en}/workflows.ts`
- `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`

## 발견사항

- **[INFO]** 폴더 목록 fetch 실패/로딩 상태 미처리
  - 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx:142-146` (`foldersQuery`)
  - 상세: `sortKey`/`ownership` 는 로컬 state 라 실패 개념이 없지만, `foldersQuery` 는 네트워크 요청이다. `foldersQuery.isError` 를 별도로 처리하지 않고 `folders = foldersQuery.data ?? []` 로 단순 폴백해, 조회 실패 시에도 "폴더가 없다"와 동일하게 필터가 조용히 숨겨진다. 워크플로우 쿼리(`workflowsQuery`)는 실패 시 별도 에러 UI(리뷰 범위 밖이나 기존 코드에 존재)가 있는 것과 비교하면 처리 수준이 다르다.
  - 제안: 현재 동작(실패 시 조용히 숨김)이 의도된 저위험 폴백이라면 그 의도를 주석 한 줄로 남기면 다음 리더가 "에러 처리 누락"으로 오인하지 않는다. 필수 수정은 아님.

- **[INFO]** 폴더 정렬을 서버 응답 순서에 암묵적으로 의존
  - 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx:459-463` (`folders.map`), `codebase/frontend/src/lib/api/folders.ts:5-9`
  - 상세: `folders.ts` 상단 주석에 "서버는 `sortOrder→name` 순으로 정렬된 배열을 반환한다"고 명시되어 있고 `FolderData.sortOrder` 필드도 존재하지만, 실제로 프론트 어디에서도 `sortOrder` 값 자체는 읽지 않고 배열 순서만 그대로 렌더링한다. 계약이 문서화되어 있어 즉시 버그는 아니지만, 필드를 인터페이스에 노출해놓고 소비하지 않는 점은 "왜 존재하는가"에 대한 물음을 남긴다.
  - 제안: 문제 없음(문서화된 서버 계약 신뢰) — 다만 향후 클라이언트 정렬 로직이 필요해질 경우를 대비한 필드로 이해하면 됨. 조치 불필요.

- **[INFO]** 테스트 파일 내 로컬 `FolderData` 타입 중복 정의
  - 위치: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx:31` (`type FolderData = {...}`)
  - 상세: `codebase/frontend/src/lib/api/folders.ts` 의 `FolderData` 인터페이스와 구조적으로 동일한 타입을 mock 파일 내에 별도 재정의했다. `vi.mock` 팩토리 함수의 호이스팅 제약(외부 모듈 import 를 팩토리 밖에서 참조할 수 없음) 때문에 흔히 쓰이는 패턴이며, 동일 파일 내 다른 mock(`workflowsApi`) 도 비슷하게 인라인 타입을 쓰는지 확인한 결과 일관된 관행으로 보인다.
  - 제안: 유지보수 부담은 낮음(필드 3개, 변경 빈도 낮음). 필드가 늘어나는 경우 `import type { FolderData } from "@/lib/api/folders"` 로 교체 검토 가능하나 현재로선 우선순위 낮음.

## 컨벤션 일관성 확인 (문제 없음)

- **select 패턴**: 폴더 필터 `NativeSelect` (`page.tsx:448-465`) 는 기존 정렬 select(`page.tsx:430-446`)와 완전히 동일한 구조를 따른다 — `<div className="w-44">` 래퍼, `aria-label={t(...)}`, `value`/`onChange` 페어, `data-testid="workflow-<name>-filter|sort"` 네이밍(`workflow-sort` → `workflow-folder-filter`), `onChange` 핸들러 내 `setPage(1)` 동반 호출까지 일치. 조건부 렌더링(`folders.length > 0 &&`) 만 추가된 차이인데 이는 `isTeamWorkspace &&` 로 ownership 블록을 감싸는 기존 패턴과 동일한 관용구다.
- **네이밍**: `foldersApi`, `FolderData`, `foldersQuery`, `folderId`, `folders` 모두 기존 `workflowsApi`/`WorkflowData`/`workflowsQuery` 네이밍 컨벤션과 정확히 대칭. `folders.ts` 파일도 `workflows.ts` 등 인접 API 카탈로그 파일과 동일하게 `export interface XxxData` + `export const xxxApi = { list: async () => ... }` 형태를 그대로 따른다.
- **상태 파생 로직**: `hasActiveFilters` 배열에 `folderId !== ""` 추가, `handleResetFilters()` 에 `setFolderId("")` 추가, `queryKey` 배열에 `folderId` 추가 — 세 곳 모두 `ownership` 도입 시 있었을 법한 동일 위치에 대칭적으로 추가되어 있어 패턴 이탈이 없다.
- **주석 스타일**: `spec/2-navigation/1-workflow-list.md §2.3` 앵커를 단 한국어 주석은 기존 `ownership`/`sortKey` state 선언부 주석과 동일한 형식(spec 경로 + 섹션 + 한 줄 요약)을 따른다.
- **i18n parity**: `ko/workflows.ts` 의 `folderFilter: { aria, all }` 와 `en/workflows.ts` 의 동일 키 구조가 1:1 대응하며, 기존 `sort`/`ownership` 블록과 같은 위치(순서)에 삽입되어 있다. `ko` 가 `as const` 없이 плain object literal 이지만 이는 diff 이전부터의 기존 패턴이며 `Dict["workflows"]` 타입에 대한 `en` 쪽 명시적 타입 어노테이션(`workflows: Dict["workflows"] = {...}`)과의 관계도 기존 구조 그대로 유지되어 이번 변경으로 인한 회귀는 없음.
- **테스트 구조**: 신규 `describe("WorkflowsPage — folder filter (NAV §2.3)")` 블록은 바로 위 `sort` 관련 describe 블록과 동일하게 `beforeEach`/`afterEach` 로 store 초기화 + `cleanup()` 을 수행하며, 케이스 커버리지(숨김/표시/필터 적용+page reset/기본값 미송신/active-filter+reset) 도 대칭적으로 충실하다.

## 요약

폴더 필터 구현은 같은 파일에 이미 존재하는 정렬(select)·소유권(button group) 필터 패턴을 거의 완벽하게 재사용했다 — select 래퍼 클래스, `data-testid` 네이밍, `onChange` 시 `setPage(1)` 동반, `hasActiveFilters`/`handleResetFilters`/`queryKey` 3곳 대칭 갱신, spec 앵커 주석 스타일까지 일관적이다. `folders.ts` 신규 파일도 인접 API 카탈로그 파일들의 `XxxData` 인터페이스 + `xxxApi.list()` 관용구를 그대로 따랐고, i18n ko/en 은 구조·순서·키 이름이 1:1 대응한다. 발견된 사항은 모두 INFO 수준의 사소한 관찰(폴더 조회 실패 시 폴백 처리 의도 미문서화, 미사용 `sortOrder` 필드, 테스트 파일의 로컬 타입 재정의)이며 기능적 결함이나 가독성·복잡도 문제는 없다.

## 위험도

NONE
