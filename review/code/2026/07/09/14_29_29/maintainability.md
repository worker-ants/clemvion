## 유지보수성(Maintainability) 리뷰

### 발견사항

- **[INFO]** 활성 팀 워크스페이스 mock 객체 리터럴 반복
  - 위치: `dashboard-page.test.tsx`(신규 `describe` blocks의 `beforeEach`), `execution-list-page.test.tsx`(178행대, 신규 485행대), `workflows-page.test.tsx`(신규 742행대) 등 이번 diff 로 추가된 각 테스트의 `useWorkspaceStore.setState({ workspaces: [{ id: "ws-1", name: "Team", type: "team", slug: "team-x", role: "editor" }], ... })`
  - 상세: 동일한 "활성 팀 워크스페이스(ws-1/team-x)" 리터럴이 파일 내부·파일 간에 여러 차례 반복된다. `execution-list-page.test.tsx` 한 파일에서만도 이제 2회 등장하고, 3개 파일에 걸쳐 사실상 동일한 객체가 계속 복제된다. 다만 이 패턴은 이번 diff 이전부터 각 테스트 파일에 이미 존재하던 컨벤션(각 `describe`가 자체 `beforeEach`에서 store 를 독립적으로 셋업)을 그대로 답습한 것이라 새로 도입된 스타일 이탈은 아니다.
  - 제안: 당장 조치가 필요한 수준은 아니나, 후속 정리 시 `makeActiveTeamWorkspace(slug = "team-x")` 같은 공용 테스트 픽스처 헬퍼(예: 각 파일 상단 또는 공용 test-utils)로 추출하면 slug 값이나 role 을 바꿔야 할 때 여러 파일을 동시에 고쳐야 하는 산발적 수정 비용을 줄일 수 있다.

- **[INFO]** 신규 `RECENT_WORKFLOW` 상수의 배치 위치가 파일 내 기존 관례와 다름
  - 위치: `dashboard-page.test.tsx` 신규 `describe("DashboardPage — recent workflows editor navigation (phase 2)")` 내부의 `const RECENT_WORKFLOW = {...}`
  - 상세: 같은 파일의 기존 `SUMMARY`, `RECENT_EXECUTION` 은 모듈 최상단에 정의돼 있는 반면, 신규 `RECENT_WORKFLOW` 는 `describe` 블록 내부 지역 상수로 정의되어 스타일이 혼재한다. 사용 범위가 해당 `describe` 하나뿐이라 지역 정의 자체는 캡슐화 관점에서 나쁘지 않지만, 같은 파일 안에서 "공용 fixture 는 모듈 top-level" 관례와는 살짝 어긋난다.
  - 제안: 굳이 옮길 필요는 없음(오히려 지역성이 더 명확할 수 있음). 다만 신규 fixture 추가 시 파일의 기존 배치 관례(top-level vs describe-local)를 의식적으로 선택하는 편이 향후 일관성에 도움이 된다.

### 요약
이번 변경은 대부분 기존 테스트 파일에 회귀 테스트를 추가하는 순수 additive 변경(3개 테스트 파일)과 주석 1줄 정정(`sidebar.tsx`), plan 문서 텍스트 갱신으로 구성되어 있어 유지보수성 리스크가 매우 낮다. 새로 추가된 테스트들은 각 파일에 이미 존재하는 "활성 워크스페이스 slug 회귀" 테스트 패턴(동일한 mock 셋업·동일한 `mockPush` 단언 스타일)을 그대로 재사용하고 있어 가독성·네이밍·일관성 모두 기존 컨벤션과 잘 맞는다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 등도 문제되는 수준이 아니다. 유일하게 눈에 띄는 점은 "활성 팀 워크스페이스" mock 객체 리터럴이 파일 내부·파일 간에 반복된다는 것인데, 이는 이번 diff 가 새로 만든 문제가 아니라 기존 테스트 파일들의 기존 관례를 답습한 것이므로 차단 사유는 아니며 향후 공용 헬퍼로 추출하면 좋을 정도의 개선 여지로만 남는다.

### 위험도
LOW
