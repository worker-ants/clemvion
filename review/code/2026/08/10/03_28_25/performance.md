# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `findNonTerminalCompletedPlans` 는 caller 마다 `plan/complete/**` 전체를 재순회 + `matter()` 재파싱하며, 메모이제이션이 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:119` (`findNonTerminalCompletedPlans`), 내부에서 부르는 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:53`(`walkPlanMarkdown`, `recurse: true`)
  - 상세: `plan-scan.test.ts` 안에서만 이 함수가 서로 다른 `it` 블록 9곳(라인 72, 78, 84, 90, 98, 111-112, 123, 138, 144)에서 각각 독립 호출된다. 매 호출마다 디렉터리 트리를 다시 걷고, 걸린 모든 `.md` 파일을 `fs.readFileSync` + `gray-matter` 로 다시 파싱한다. 합성 fixture(파일 15개 내외) 규모에서는 무시할 수준이지만, 실저장소 `plan/complete/**`(완료 plan 수백 건 추정)를 대상으로 호출하는 지점이 향후 늘어나면 호출 횟수만큼 선형 비용이 그대로 반복된다.
  - 제안: 현재 호출부(단일 실저장소 호출 1곳 + fixture 9회 호출)에서는 조치 불요. 다만 이 함수를 여러 가드가 같은 `root` 에 대해 반복 호출하는 패턴이 늘어난다면 `root` 를 키로 한 프로세스-스코프 캐시(Map)를 고려할 것.

- **[INFO]** `findBrokenPlanLinks` 호출과 별도로 같은 파일들에 대해 `extractLinks` 를 다시 호출해 링크를 재추출한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:111-120`(`top-level in-progress plans have no broken relative links`)와 바로 다음 `plan-frontmatter.test.ts:122-133`(`the plan link scanner actually sees links (non-vacuity)`)
  - 상세: 앞 테스트가 `findBrokenPlanLinks(root)`(`spec-links.ts:306` `findBrokenPlanLinks` → 내부 `findBrokenLinksInFiles` → 파일마다 `extractLinks` 호출)를 실행해 이미 모든 살아있는 plan 파일을 읽고 링크를 추출했는데, 바로 다음 non-vacuity 테스트가 `collectLivePlanMarkdown(root).reduce((n, f) => n + extractLinks(f.absPath).length, 0)` 로 **동일 파일 집합에 대해 다시** 읽기 + 링크 추출을 수행한다(`plan-frontmatter.test.ts:128-131`). top-level in-progress plan 수가 작아(현재 하한 `> 5`) 절대 비용은 낮지만, 두 테스트가 결과를 공유하면 I/O·정규식 파싱 비용을 절반으로 줄일 수 있는 구조다.
  - 제안: `findBrokenLinksInFiles`(또는 `findBrokenPlanLinks`)가 추출한 총 링크 수를 함께 반환하도록 확장하거나, 두 `it` 가 공유하는 `beforeAll`/모듈 스코프 변수에 1회만 계산한 추출 결과를 캐시해 재사용. 우선순위는 낮음(파일 수가 작아 실제 지연은 체감 이하).

- **[INFO]** `rawScalar` 가 호출마다 `new RegExp` 를 컴파일한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:153-157`
  - 상세: `checkPlanFrontmatter` 가 라이브 plan 한 건을 검사할 때마다 `rawScalar(block, "started")` 를 호출하고, 그 안에서 `new RegExp(...)` 가 매번 새로 만들어진다. `key` 인자가 실질적으로 `"started"` 고정값이라 모듈 스코프 정적 정규식으로 끌어올릴 수 있다. 현재 라이브 plan 개수(수십 건) 규모에서는 체감 비용이 없다.
  - 제안: 조치 불요 수준(INFO). 호출 빈도가 커지거나 `key` 종류가 늘어나면 `Map<string, RegExp>` 캐시로 전환 고려.

## 참고 (발견사항 아님 — 긍정적 패턴)

- `spec-links.ts:188-196` 의 `slugCache`(Map)는 동일 타깃 파일의 헤딩 슬러그를 여러 소스 링크가 참조할 때 `headingSlugs`(mdast 파싱 포함, 상대적으로 비싼 연산) 재계산을 막는 적절한 캐싱이다.
- `plan-scan.ts:100-105` 의 `TERMINAL_PLAN_STATUSES: ReadonlySet<string>` 은 `.has()` O(1) membership 을 위해 Set 을 쓴 적절한 자료구조 선택이다(배열 `includes` 대비).
- `walkPlanMarkdown`(`plan-scan.ts:53`)은 재귀 대신 명시적 스택으로 트리를 순회해 O(n) 이며 깊은 트리에서도 콜스택 오버플로 위험이 없다.
- `collectCodebaseSources`/`findBrokenSpecLinksInSources`(`spec-links.ts:335`, `368`)는 저장소 전체 `.ts`/`.tsx`(2000+ 파일)를 동기 I/O 로 순회·파싱하지만, 이 로직은 이번 diff 범위 밖(기존 코드, 변경 없음)이라 발견사항에 포함하지 않았다.

## 요약

이번 변경은 CI/테스트 시점에만 실행되는 plan 라이프사이클 가드(디렉터리 스캔 + frontmatter/링크 검증) 리팩터링으로, 사용자 요청 경로나 런타임 서비스와 무관한 빌드타임 도구 코드다. 동기 `fs` 호출은 이 문맥에서 적절하고, 헤딩 슬러그 캐싱(`slugCache`)·Set 기반 상태 어휘 검사 등 이미 합리적인 자료구조·캐싱 선택이 적용돼 있다. 발견된 항목은 모두 반복 호출 시 재계산/재파싱이 메모이즈되지 않는다는 INFO 수준 비효율이며, 현재 입력 규모(라이브 plan 수십 건, fixture 파일 10~20개)에서는 체감 성능 영향이 없다. 알고리즘 복잡도상 O(n²) 패턴이나 N+1 DB/API 호출, 블로킹 I/O 병목, 메모리 누수 가능성은 발견되지 않았다.

## 위험도

LOW
