# 성능(Performance) 리뷰

## 컨텍스트

두 파일 모두 `__tests__/` 하위의 **테스트/빌드타임 전용 스캐너**다 — vitest 실행 중에만 동작하며 프로덕션 런타임 경로가 아니다. 따라서 동기 I/O 자체는 감점 대상이 아니고("블로킹 I/O가 사용자 요청 경로를 막는가"라는 원 기준에는 해당 없음), 이 리뷰는 "테스트 스위트 실행 시간·확장성" 관점에서만 평가한다.

### 발견사항

- **[WARNING]** Gate C `enforced` 필터링과 per-plan 블록이 같은 `complete` plan 의 frontmatter 를 두 번 읽고 두 번 파싱한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:71`~`79` (전수 파싱 — `plans.filter` 내부에서 **모든** complete plan 을 읽고 파싱), 그리고 `:95` (enforced 로 걸러진 plan 만 **다시** 읽고 파싱)
  - 상세: 71번 줄 `enforced` 계산은 `plans`(전체 complete plan 목록)를 순회하며 매 항목마다 `fs.readFileSync` + `parseFrontmatterSafe` 를 호출한다. 이후 95번 줄에서 `enforced` 에 남은 항목에 대해 **동일 파일**을 다시 `readFileSync` + `parseFrontmatterSafe` 한다. 저자 주석(73~74번 줄)이 이 이중 파싱을 이미 인지하고 있으나 "같은 plan 을 두 번 파싱한다"라고만 기록하고 회피하지는 않았다. 현재는 `enforced` 집합이 grandfather 컷오프로 비어 있어 실질 비용이 0 이지만, 컷오프 이후 작업이 늘어나면 `enforced` 항목 수만큼 파일 I/O·YAML 파싱이 정확히 2배가 된다.
  - 제안: 71번 줄의 filter 단계에서 `{ abs, rel, data }` 형태로 파싱 결과를 캐시한 배열을 만들고, 95번 줄 이하에서는 그 캐시된 `data` 를 재사용한다. gray-matter 자체 캐시는 파일 상단 문서화된 버그(부분 실패 후 조용히 `data={}` 반환) 때문에 신뢰할 수 없으므로, 앱 레벨에서 명시적으로 캐시해야 안전하다.

- **[INFO]** `plan/complete/**` · `plan/in-progress/*` 전체 트리 워크가 여러 진입점에서 독립적으로 반복될 수 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:59`(`walkPlanMarkdown`, 재귀 `fs.readdirSync`), 그리고 이를 호출하는 `:157`(`findNonTerminalCompletedPlans`) · `:294`(`findFrontmatterViolations`) · `spec-plan-completion.test.ts:68`(`collectCompletePlans` 호출)
  - 상세: `walkPlanMarkdown` 은 캐시가 없는 순수 함수라, 같은 테스트 실행(vitest) 안에서 status 가드(`plan-scan.ts` 자체 유틸)와 Gate C(`spec-plan-completion.test.ts`)가 각각 별도 파일에서 호출되면 `plan/complete/**` 디렉터리 재귀 워크 + 정렬(O(n log n))이 중복 실행된다. vitest 는 파일 단위로 모듈 레지스트리가 분리(`isolate: true`, 파일 상단 108~115번 줄 주석에서도 언급)돼 있어 프로세스 내 캐시 공유가 애초에 어렵다는 점은 인지하고 있는 것으로 보인다.
  - 제안: 현재 plan 개수 규모(수십 건)에서는 무시할 수준. plan 수가 수백 건으로 늘어나 스위트 실행 시간이 체감되면, 워크 결과를 스위트 시작 시 1회만 계산해 `globalSetup`/모듈-레벨 싱글턴으로 공유하는 방안을 검토. 다만 gray-matter 캐시 버그 사례처럼 "캐시가 정합성 버그를 만든다"는 이 저장소의 실측 교훈이 있으므로, 캐싱 도입 시 무효화 시점(파일 mtime 등)을 명시적으로 관리해야 한다.

- **[INFO]** `rawScalar` 가 호출마다 `new RegExp` 를 생성
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:196`~`200`
  - 상세: `checkPlanFrontmatter` → `rawScalar(block, "started")` 호출 시마다(살아있는 top-level plan 수만큼) 정규식 리터럴을 새로 컴파일한다. `key` 인자가 현재 `"started"` 고정값 한 종류뿐이라 실질 영향은 미미하다(살아있는 plan 수는 통상 개 단위).
  - 제안: 현재 규모에서는 조치 불필요. 호출 빈도가 늘거나 여러 key 로 재사용된다면 모듈 레벨 정규식 캐시(`Map<string, RegExp>`)로 전환 고려.

- **[INFO]** `TERMINAL_PLAN_STATUSES`/`NONE_VALUES` 는 `Set` 을 적절히 사용 — 자료구조 선택 자체는 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:138`~`143`, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:25`
  - 상세: 배열 `.includes()` 대신 `ReadonlySet.has()`(O(1))를 쓴 것은 긍정적 패턴. 별도 조치 불필요, 참고용 기재.

### 요약

두 파일 모두 vitest 실행 시점에만 동작하는 plan 트리 스캐너/게이트로, 사용자 요청 경로에 영향을 주는 블로킹 I/O나 N+1 API 호출은 없다. 유일하게 실제 개선 여지가 있는 지점은 Gate C 의 `enforced` 필터링(전체 complete plan 파싱) 이후 통과한 항목을 per-plan 블록에서 다시 파싱하는 부분으로, 저자도 주석으로 인지하고 있으나 grandfather 컷오프로 현재는 `enforced` 집합이 비어 있어 실질 비용은 0이다. 컷오프 이후 작업이 누적되면 해당 plan 수만큼 파일 I/O·YAML 파싱이 정확히 두 배가 되므로, 필터 단계에서 파싱 결과를 캐시해 재사용하는 리팩터링을 권장한다. 그 외 트리 워크 중복·정규식 재컴파일은 현재 저장소 규모(plan 수십 건)에서 무시할 수준이다.

### 위험도
LOW
