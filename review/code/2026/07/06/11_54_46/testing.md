# 테스트 리뷰 — /triggers 딥링크 소비 테스트

- 대상 worktree: `.claude/worktrees/fe3-triggers-deeplink-0fdb24`
- 커밋: `c75077ec5`
- 대상 파일: `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx`, `codebase/frontend/src/app/(main)/triggers/page.tsx`

## 검증 절차 요약

1. `git diff origin/main...HEAD` 로 변경 범위 확인 (테스트 파일 +48/-1, page.tsx +9행 초기화 로직).
2. `TriggerDetailDrawer` mock 을 `() => null` → `open ? <div data-testid... data-trigger-id=.../> : null` 로 바꾼 부분이 기존 3개 describe(`pagination`, `RBAC`, `auth column`)에 영향 없는지 확인 — 모두 `beforeEach` 에서 `currentSearchParams = new URLSearchParams()` 로 리셋하고 row 클릭 등 drawer-open 트리거를 실행하지 않으므로 `selectedTriggerId` 초기값이 항상 `null` → 새 mock 도 `open=false` 로 렌더링되어 `null` 반환. 실제로 `cwd=codebase/frontend` 에서 vitest 를 실행해 14개 테스트 전부 통과 확인.
3. non-vacuous 여부 실측: `page.tsx` 의 `useState(() => searchParams.get("triggerId"))` 를 `useState(null)` 로 임시 변경(스크래치패드에 원본 백업 후 python 치환) → 재실행 결과 "opens the detail drawer for the trigger named in ?triggerId= on landing" 테스트가 정확히 fail (`findByTestId` timeout), 나머지 13개는 그대로 통과. 이후 백업본으로 원복하고 `git diff`/`git status` 로 원본 커밋 diff 와 완전히 일치함을 확인, 재실행으로 14개 재통과 확인. 실험 흔적 없음(clean).
4. "does not open the drawer when no ?triggerId= is present" 테스트: `selectedTriggerId` 는 `useState` initializer 로 마운트 시 동기 확정되므로 `act(async () => render(...))` 직후 `queryByTestId` 로 즉시 부재를 단언해도 레이스 컨디션 없음 — 유효.
5. `currentSearchParams` 는 모듈 스코프 `let` mutable mock 이며, 신규 describe 도 기존 3개 블록과 동일하게 `beforeEach` 에서 `vi.clearAllMocks()` + `currentSearchParams = new URLSearchParams()` 로 리셋 — describe 간 누수 없음. 첫 테스트에서만 `currentSearchParams = new URLSearchParams("triggerId=trg-42")` 로 재할당하고 두 번째 테스트는 `beforeEach` 리셋값(파라미터 없음) 그대로 사용 — 격리 적절.

## 발견사항

없음 (Critical/Warning/Info 없음). 대상 변경분은 검증된 범위 내에서 결함을 발견하지 못했다.

몇 가지 참고(비결함, 정보성 관찰):

- mock 컴포넌트에 `data-trigger-id={triggerId ?? ""}` fallback 이 있는데, 실사용 시 `open` 이 true 이면 항상 `triggerId` 가 non-null(`selectedTriggerId !== null` 이 곧 `open` prop 이므로) 이라 이 fallback 경로는 현재 테스트로 커버되지 않는 죽은 분기다. 다만 이는 mock 자체의 방어적 코드일 뿐이고 프로덕션 로직과 무관해 결함으로 볼 정도는 아니다.
- 새 describe 블록 2개 테스트 모두 "URL 파라미터 있음/없음" 이라는 상호보완적인 최소 쌍으로, 회귀 감지 목적(딥링크 소비 로직 삭제/오타 시 즉시 실패)을 충족한다. 다만 `?triggerId=` 값이 빈 문자열인 경우(`new URLSearchParams("triggerId=")` → `get()` 이 `""` 반환, drawer 오픈 여부는 `selectedTriggerId !== null` 이므로 `""` 도 truthy 취급되어 열림)와 같은 엣지케이스는 다루지 않는다. 이는 실사용상 발생 가능성이 낮은 시나리오(스케줄 목록에서 링크 생성 시 항상 유효한 trigger id 부착)라 커버리지 갭으로 지적할 만큼 중요하지는 않다고 판단해 INFO 로도 별도 표기하지 않았다.

## 요약

신규 "inbound ?triggerId= deep-link" describe 는 실제로 page.tsx 의 마운트 시 초기화 로직에 의존하는 non-vacuous 테스트임을 코드 원복 실험으로 직접 검증했다. Drawer mock 을 `open` 조건부 렌더링으로 바꾼 변경은 기존 3개 describe(pagination/RBAC/auth column) 에 어떤 부작용도 주지 않는다 — 모든 기존 테스트가 drawer 를 열지 않는 시나리오만 다루기 때문이다. `currentSearchParams` mutable mock 은 describe 간 `beforeEach` 리셋으로 적절히 격리되어 있고, "미존재" 테스트는 `useState` initializer 의 동기성 덕분에 타이밍 이슈 없이 유효하다. 14개 테스트 전체 통과를 재현했고 실험 후 원본 상태로 완전히 원복(git diff 로 확인)했다. 테스트 관점에서 결함을 발견하지 못했다.

## 위험도

NONE
