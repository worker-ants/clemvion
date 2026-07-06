# 변경 범위(Scope) 리뷰 — 워크플로우 목록 단일 태그 필터

리뷰 대상: `git diff origin/main...HEAD` (1 commit, `2d0eb622c`)
비교 기준: `a9e2186ae` (#830 폴더 필터 UI, 직전 merge)

## 변경 파일 목록

```
codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx  (+100)
codebase/frontend/src/app/(main)/workflows/page.tsx                          (+35)
codebase/frontend/src/lib/i18n/dict/en/workflows.ts                          (+4)
codebase/frontend/src/lib/i18n/dict/ko/workflows.ts                          (+4)
plan/in-progress/spec-sync-workflow-list-gaps.md                             (+8/-3)
review/consistency/2026/07/06/11_09_44/*.md                                  (신규 4개, +150)
spec/2-navigation/1-workflow-list.md                                         (+13/-3)
```

## 발견사항

없음. 범위 위반 항목을 발견하지 못했다.

### 확인한 항목 (결함 아님, 근거로 기록)

- **page.tsx**: 추가된 코드는 태그 필터 state(`tagFilter`/`debouncedTag`) 선언, debounce `useEffect`, queryKey/queryFn 에 `tag` 파라미터 추가, `hasActiveFilters`/`handleResetFilters` 에 태그 조건 추가, 태그 입력 UI(`<Input>` + `Tag` 아이콘) 삽입뿐이다. 기존 폴더 필터(`folderId`, `foldersApi.list()`, `NativeSelect` 렌더 블록), 검색(`search`/`debouncedSearch`), 정렬(`sortKey`), ownership, pagination(`usePageParam`) 로직은 라인 단위로 전혀 수정되지 않았고 순수 추가(context 라인)로만 나타난다. debounce 패턴에 쓰인 `setPageRef`(`useRef`) 는 검색 필터가 이미 쓰던 기존 유틸을 재사용한 것이지 신규 정의가 아니다.
- **whitespace-only 여부**: `git diff -w --stat` 결과가 일반 diff 와 동일 — 공백/줄바꿈만 바뀐 라인 없음.
- **테스트 파일**: 기존 `describe` 블록(폴더 필터 등)을 건드리지 않고 파일 끝에 새 `describe("WorkflowsPage — tag filter (NAV §2.3)")` 블록만 추가(append-only).
- **i18n**: en/ko 모두 `tagFilter: { aria, placeholder }` 키 추가만, 기존 키 수정·삭제 없음.
- **spec (`1-workflow-list.md`)**: 변경된 섹션은 정확히 §1(목업 안내 문구, 태그/폴더 UI 존재를 반영하도록 갱신) · §2.3(태그 행 하향 + 폴더 행 현행화) · §3.1(폴더 API 안내문 "미소비"→"필터가 소비") · Rationale §4(신규, 태그 단일 하향 근거) 뿐이다. `## Heading` 전수 확인 결과 §2.7(빈 상태/마켓플레이스 관련 섹션, 이 spec 파일 내에서는 "빈 상태"를 의미)이나 그 외 §2.1/§2.2/§2.4~§2.6/§3.2/Rationale §1~3 은 diff 에 나타나지 않는다. 마켓플레이스 관련 별도 spec 파일도 변경 목록에 없다.
- **plan (`spec-sync-workflow-list-gaps.md`)**: 체크박스 변경은 "태그 필터 UI 부재" 항목 1건만 `[ ]→[x]`. "빈 상태 마켓플레이스 템플릿 추천 링크 (§2.7)" 항목은 `[ ]` 그대로 유지되어 범위 외로 명확히 남아있다. `worktree:` frontmatter 값 갱신은 이번 작업의 worktree 경로를 반영한 것으로 정상. 상단 진행 로그에 "planner 후속(SPEC-DRIFT) — 해소됨" 기록도 실제 코드/spec 변경(§2.3 폴더 행·§3.1)과 일치한다.
- **review/consistency/2026/07/06/11_09_44/*.md**: `project-planner` 가 `spec/` 쓰기 직전 수행이 의무화된 `consistency-check --spec` 산출물이며, 그중 `cross-spec.md` 에서 marketplace 관련 in-progress plan 언급이 나오는 것은 "태그" 키워드 충돌 여부를 확인하는 조사 텍스트일 뿐, 실제 마켓플레이스 spec/코드를 수정한 것이 아니다. 규약상 정상적으로 동반되는 산출물.
- **§2.7/마켓플레이스 코드 접촉 여부**: diff 전체에서 `marketplace`/`template` 키워드 검색 결과, 유일한 매치는 위 cross-spec.md 의 "무관함을 확인했다"는 조사 문장 하나뿐 — 실제 마켓플레이스 관련 파일·섹션은 미변경.

## 요약

이번 PR 은 명시된 범위—(1) 단일 태그 필터 FE 구현, (2) spec §2.3 태그 행 하향 + Rationale §4, (3) #830 폴더 필터 반영에 따른 §2.3 폴더 행·§3.1 SPEC-DRIFT 안내문 현행화, (4) plan 갱신—에 정확히 한정되어 있다. `page.tsx` 는 태그 필터 관련 라인만 추가했고 폴더/검색/정렬/ownership/pagination 기존 로직은 손대지 않았으며, 포맷팅 노이즈나 불필요한 리팩토링·무관 파일 수정·마켓플레이스(§2.7) 침범도 발견되지 않았다. plan 체크박스도 태그 항목만 `[x]`로 갱신되고 마켓플레이스 항목은 `[ ]`로 정확히 유지되어 있어, 변경 범위 관점에서 결함이 없다.

## 위험도

NONE
