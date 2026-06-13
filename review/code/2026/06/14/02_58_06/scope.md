### 발견사항

- **[INFO]** 파일 7 (spec/2-navigation/1-workflow-list.md) — spec 파일 수정
  - 위치: 전체 파일
  - 상세: developer 역할은 `spec/` 에 대한 쓰기 권한이 없다(CLAUDE.md Skill 체계). 그러나 이 변경 내용을 살펴보면, 본 PR 의 구현(정렬 §2.4)이 완료됨에 따라 미구현 경고문을 제거하고 현행 구현 상태로 spec 을 동기화한 것이다. 변경 내용이 구현을 반영하는 spec update(구현 → spec sync)이며, 실제 요구사항이나 설계를 변경한 게 아니다. 단, CLAUDE.md 규약 상 이런 spec 업데이트는 project-planner 역할을 경유해야 한다. 실질적으로 scope 를 벗어난 변경은 아니지만 역할 분리 규약 위반 소지가 있다.
  - 제안: spec 수정이 구현 완료 후 현행화 목적임은 명확하나, 엄밀히는 planner 경로를 거쳤어야 함을 기록으로 남길 것

- **[INFO]** `hasActiveFilters` 로직에 `sortKey` 미포함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-workflow-list-gaps-f4f815/codebase/frontend/src/app/(main)/workflows/page.tsx`, `hasActiveFilters` 계산부
  - 상세: `hasActiveFilters`가 `sortKey !== "created"` 를 포함하지 않아, 정렬이 기본이 아닌 상태에서 검색/필터가 없으면 "Reset Filters" 버튼이 나타나지 않는다. `handleResetFilters` 는 `setSortKey("created")` 를 호출하지만, 버튼이 표시될 조건에 sortKey 가 빠져 있다. 이는 scope 내 기능의 미완으로 볼 수 있으나, 과잉 구현(scope 위반)은 아니다.
  - 제안: `const hasActiveFilters = !!debouncedSearch || filter !== "all" || (isTeamWorkspace && ownership !== "all") || sortKey !== "created"` 로 수정 권고 (별도 버그 리뷰 항목)

- **[INFO]** 기본 sort 전송 생략 최적화(의도적 scope 내 결정)
  - 위치: `page.tsx`, queryFn 내 `if (sortKey !== "created")` 분기
  - 상세: 기본 옵션 선택 시 sort/order 파라미터를 보내지 않는다. 이는 서버 기본값에 의존하는 의도적 최적화이고 spec 주석에 명시되어 있어 scope 내 정상 설계다.

### 요약

7개 파일 모두 §2.4 정렬 기능 구현이라는 단일 목적에 집중되어 있다. backend(`workflows.service.ts`)의 `last_run` subquery 추가 및 injection 안전 분기, frontend(`page.tsx`)의 `NativeSelect` 정렬 드롭다운과 queryKey/params 연동, i18n(ko/en) `workflows.sort.*` 추가, 테스트 3건 추가, plan 파일 체크박스 갱신이 모두 해당 기능의 필수 구성요소다. 불필요한 리팩토링·무관 파일 수정·임포트 정리·포맷팅 노이즈는 발견되지 않는다. spec 파일 수정(`spec/2-navigation/1-workflow-list.md`)은 구현 완료 후 현행화이므로 내용상 scope 이탈은 없으나, CLAUDE.md 규약상 developer → planner 경유 없이 직접 수정한 점이 경미한 규약 위반이다. 전반적으로 변경 범위는 명확히 통제되어 있다.

### 위험도

LOW
