# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `extractLinks` 가 마크다운 링크 문법이 전혀 없는 소스 파일에도 매번 전체 라인 스캔(펜스 검사 + 코드스팬 정규식 치환 + 링크 정규식 exec)을 수행한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82`~`106` (`extractLinks` 함수)
  - 상세: `findBrokenSpecLinksInSources` → `collectCodebaseSources` 가 `codebase/backend/src`, `codebase/frontend/src`, `codebase/channel-web-chat/src`, `codebase/packages` 아래 모든 `.ts`/`.tsx` 를 수집한다. 실측(`find ... | wc -l`): 대상 파일 **2072개**. 그런데 `](` 문자열을 포함하는 파일은 **35개(1.7%)** 뿐이다(`grep -rl '](' ...`). 나머지 98%가 넘는 파일도 `extractLinks` 안에서 `text.split(/\r?\n/)` 후 라인마다 `FENCE_RE.test`, 백틱 코드스팬 제거 정규식, `LINK_RE` exec 루프를 전부 통과한다 — 실제로 필요한 것은 전체 저장소 소스 라인 수가 아니라 35개 파일의 라인 수뿐이다. 이 가드는 CI 테스트마다(guard test) 실행되므로 저장소가 커질수록 낭비가 선형으로 누적된다.
  - 제안: `fs.readFileSync` 직후 `if (!text.includes("]("))` 같은 값싼 사전 필터로 대부분의 파일을 즉시 스킵. (참고: `spec/**`·`plan/in-progress/*.md` 대상 두 entry-point 는 파일 수가 적어 영향이 작지만, 코드베이스 소스 대상 entry-point 는 파일 수가 압도적으로 커서 효과가 크다.)

- **[INFO]** 인라인 정규식 리터럴이 라인 루프 안에서 매 반복 새로 생성된다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:94` (`const noCode = line.replace(/\`[^\`]*\`/g, "");`)
  - 상세: 같은 파일의 `LINK_RE`/`FENCE_RE` 는 모듈 최상위 `const` 로 한 번만 만들어지는데, 코드스팬 제거용 정규식만 루프 내부 리터럴이라 매 라인마다 새 `RegExp` 객체가 만들어진다(ES5+ 스펙상 리터럴 캐싱 없음). 위 WARNING 항목과 결합하면 스캔 대상 파일 수(2072개) × 평균 라인 수만큼 GC 압력이 누적된다. 절대적 비용은 작지만 손쉬운 개선이다.
  - 제안: `LINK_RE`/`FENCE_RE` 와 같은 자리에 `const CODE_SPAN_RE = /\`[^\`]*\`/g;` 로 모듈 스코프로 끌어올리기.

- **[INFO]** `spec-plan-completion.test.ts` 가 Gate C 대상(enforced) plan 하나당 frontmatter 를 **두 번** 읽고 파싱한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:90`~`103` (`enforced = plans.filter(...)`, `startedDate` 판정을 위해 1차 read+parse) 및 `:118` (`describe(rel, ...)` 블록 안 `const data = matter(fs.readFileSync(abs, "utf8"), {}).data ?? {};` — 같은 파일을 2차 read+parse)
  - 상세: 현재는 Gate C cutoff(`2026-06-04`) 이후 시작된 완료 plan 이 0건이라 `enforced` 가 비어 있어 실질 비용이 없지만(vacuous), 앞으로 cutoff 이후 시작된 plan 들이 `complete/` 로 이동해 쌓이면 이 파일이 로드될 때마다(모듈 최상위 `describe` 콜백, 테스트 스위트 매 실행마다) enforced 항목 각각에 대해 동기 `fs.readFileSync` + `gray-matter` 파싱이 중복 실행된다. 캐시를 의도적으로 우회하는 이유(파싱-전 캐시 등록으로 인한 호출-순서 의존 오염)는 정당하지만, 그 우회가 "같은 함수 안에서" 같은 파일을 두 번 부르는 것까지 정당화하진 않는다.
  - 제안: `plans.filter(...)` 단계에서 `{ abs, data }` 쌍을 배열에 보존하고, 아래 `describe`/`it` 블록에서 그 `data` 를 재사용해 두 번째 read+parse 를 생략.

- **[INFO]** `plan/complete/**` 트리가 최소 두 개의 독립 워커로 각각 순회·파싱된다 — `plan-scan.ts` 의 `walkPlanMarkdown`/`collectCompletePlanMarkdown`/`findNonTerminalCompletedPlans` 경로와 `spec-plan-completion.test.ts` 자체의 로컬 `collectCompletePlans`(`spec-plan-completion.test.ts:59`~`83`).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:59`~`96`, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59`~`83`
  - 상세: 같은 디렉터리 트리를 두 구현이 각각 `readdirSync` 로 순회하고, 완료 plan 파일마다 frontmatter 를 각 가드가 별도로 `gray-matter` 파싱한다. 다만 이는 파일 자체의 주석(`plan-scan.ts:18`~`22`)에 이미 명시돼 있고, 통합 작업이 `plan/in-progress/docs-guard-walker-dedup.md` 로 별도 등재돼 추적 중이다 — **신규로 지적할 결함이 아니라 이미 알려진/계획된 부채**임을 확인하는 차원의 기록.
  - 제안: (조치 불요, 이미 후속 plan 에 등재됨) — 해당 plan 진행 시 이번 항목의 이중 read/parse 도 함께 소거될 것으로 보임.

- **[INFO]** `spec-links.ts` 의 heading-slug 캐시(`slugCache`)가 `findBrokenLinksInFiles` 호출 단위로 스코프돼, 세 public entry-point(`findBrokenLinks`/`findBrokenPlanLinks`/`findBrokenSpecLinksInSources`) 간에는 공유되지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:187`~`196` (`findBrokenLinksInFiles` 내부 `slugCache`)
  - 상세: 같은 프로세스 안에서 세 가드가 순차 실행되면, 여러 곳에서 공통으로 링크되는 spec 문서(예: 자주 참조되는 execution-engine 스펙)의 heading AST 가 entry-point 마다 다시 계산된다. 다만 각 entry-point 호출은 테스트 스위트당 1회뿐이고 관련 spec 파일 수도 many-but-bounded 라 실효 영향은 제한적 — 개선 여지로만 기록.
  - 제안: 필요성이 커지면 모듈 스코프의 캐시로 승격해 세 함수가 공유하도록 변경.

## 요약

리뷰 대상은 전부 CI 빌드 가드/테스트 코드(런타임 서비스 경로 아님)로, 전반적으로 자료구조(Set/Map 멤버십·캐시)와 알고리즘(단일 DFS 트리 순회, O(n) 파일 read)이 목적에 맞게 쓰였고 심각한 복잡도·메모리 문제는 없다. 가장 눈에 띄는 낭비는 `spec-links.ts` 의 `extractLinks` 가 마크다운 링크 문법이 없는 절대다수(2072개 중 35개만 해당, 실측)의 코드 소스 파일에도 매번 라인 단위 정규식 스캔을 수행하는 부분으로, 값싼 사전 필터 한 줄로 CI 가드 실행 시간을 눈에 띄게 줄일 수 있다. 나머지는 `spec-plan-completion.test.ts` 의 이중 파싱, 모듈 스코프 정규식 미고정, 캐시 공유 범위 등 저비용·저위험의 사소한 개선 여지들이며, `plan/complete/**` 이중 순회는 이미 저자 스스로 후속 통합 plan 으로 추적 중이라 신규 조치가 필요하지 않다.

## 위험도

LOW
