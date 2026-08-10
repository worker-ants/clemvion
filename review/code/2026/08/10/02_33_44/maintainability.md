# 유지보수성(Maintainability) 리뷰 — plan-frontmatter.test.ts

## 발견사항

- **[WARNING]** 헤더 주석이 과도하게 길고, 지속적인 API 문서와 리뷰 라운드 히스토리(내러티브)가 섞여 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:13`~`50`
  - 상세: 실제 테스트 로직(15줄 남짓)에 앞서 약 38줄짜리 주석 블록이 붙는다. 이 중 일부(13~31)는 "무엇을 왜 검사하는가" 라는 지속적 문서지만, 33~50 은 특정 PR 번호(`#1108`, `#1117`)와 "두 번 놓쳤다", "ai-review documentation WARNING" 같은 리뷰 회차 내러티브를 그대로 소스에 남겼다. 새로 이 파일을 읽는 사람은 현재 불변식을 파악하기 전에 과거 리뷰 이력을 먼저 읽어야 한다. 같은 저장소의 다른 sibling 테스트 파일들은 이런 다단락 히스토리 없이 1~2줄의 근거만 남긴다(`nodes-coverage.test.ts` 등).
  - 제안: 헤더는 "스코프 + 왜 이 규칙인가" 정도의 지속 문서만 남기고, 어떤 PR/라운드에서 무엇이 잡혔는지 같은 회고성 서술은 커밋 메시지나 `plan/complete/` 산출물로 옮긴다.

- **[WARNING]** `describe("plan-frontmatter guard", …)` 안에 frontmatter 와 무관한 링크 무결성 테스트 2개가 추가되어 describe 이름과 실제 스코프가 어긋난다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:65`(describe 시작), `:150`(`"top-level in-progress plans have no broken relative links"`), `:161`(`"the plan link scanner actually sees links (non-vacuity)"`)
  - 상세: outer describe 이름은 "plan-frontmatter guard" 인데, 실제로는 frontmatter 필드 검증(worktree/started/owner) 뿐 아니라 상대링크 무결성 검사까지 같은 블록 아래 있다. 테스트 이름이나 `-t` 필터로 스코프를 짐작하는 사람은 링크 검사가 여기 섞여 있다는 걸 놓치기 쉽다. 코드 안에서는 `// ── (b) …` 구분 주석으로만 경계를 표시하는데, 이는 실행 시 출력에 드러나지 않는다.
  - 제안: 링크 무결성 테스트 2개를 별도 `describe("plan relative link integrity", …)` 로 (nested 든 top-level 이든) 분리하거나, 최소한 outer describe 이름을 "plan lifecycle guards" 처럼 포괄적으로 바꾼다.

- **[INFO]** `collectTopLevelPlans` 가 단일 호출부만 가진 1줄 위임 함수이면서, 위임 대상과 다른 어휘("TopLevel" vs "Live")를 쓴다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:61`-`63` (정의), `:67` (유일한 호출부)
  - 상세: `collectTopLevelPlans(root)` 는 이제 `return collectLivePlanMarkdown(root).map((f) => f.absPath);` 한 줄이며, 파일 안에서 딱 한 번만 쓰인다. `plan-scan.ts` 를 함께 읽는 사람 입장에서 "TopLevel" 과 "Live" 가 같은 스캔을 가리키는지 다시 확인해야 하는 부담이 생긴다.
  - 제안: 단일 호출부이므로 `const plans = collectLivePlanMarkdown(root).map((f) => f.absPath);` 로 인라인하거나, 함수를 유지한다면 `collectLivePlanAbsPaths` 처럼 위임 대상과 어휘를 맞춘다.

- **[INFO]** `repoRoot()` 가 두 top-level `describe` 블록에서 각각 별도로 호출된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:66`, `:177`
  - 상세: 순수 함수라 버그는 아니지만, 같은 저장소 루트를 파일 전체에서 한 번만 계산해 공유하면 "이 파일이 다루는 루트는 하나" 라는 의도가 더 명확해진다.
  - 제안: 파일 최상단에 `const root = repoRoot();` 를 한 번만 두고 두 describe 블록에서 재사용.

- **[INFO]** `extractLinks` non-vacuity 캐너리(`:161`~`172`)가 이미 계산된 `plans` 를 재사용하지 않고 `collectLivePlanMarkdown(root)` 를 다시 호출해 같은 디렉터리 스캔을 중복 수행
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:167`-`170`
  - 상세: outer scope 에 이미 `const plans = collectTopLevelPlans(root)`(절대경로 배열, `:67`)가 있는데, non-vacuity 테스트는 `collectLivePlanMarkdown(root)` 를 다시 호출해 파일시스템을 재스캔한다. `extractLinks` 는 문자열 경로만 받으므로(`:168`) `plans.reduce((n, p) => n + extractLinks(p).length, 0)` 로 대체 가능하다.
  - 제안: 이미 수집한 `plans` 를 재사용해 불필요한 재스캔을 없앤다. (테스트 성능에 미치는 영향은 미미하지만, 두 스캔이 어긋날 여지를 없애는 것 자체가 목적이라면 단일 소스 재사용이 취지에 더 맞는다.)

- **[INFO]** 하한 매직 넘버 `5`(`:78`, `:186`)와 `50`(`:171`)는 주석으로 근거가 설명되어 있고, 같은 디렉터리의 다른 다수 테스트도 동일하게 리터럴 임계값을 인라인으로 쓰는 것이 이 저장소의 우세한 컨벤션이다(`spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-plan-completion.test.ts` 등). 이탈이 아니므로 낮은 우선순위지만, `nodes-coverage.test.ts` 는 `MIN_EXPECTED_NODE_SCHEMAS` named constant 를 쓰는 예외가 있어 참고할 수 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:78`, `:171`, `:186`
  - 제안: 현재 상태 유지로 충분하나, 두 개의 서로 다른 컬렉션(in-progress plans, completed plans)이 우연히 같은 리터럴 `5` 를 공유하는 점은 향후 하나만 바뀔 때 나머지에 영향 없는지 확인이 필요하다는 점만 인지해 둔다.

## 요약

이번 변경은 기존 diff 히스토리(`git log`)에서 보이듯 여러 차례 ai-review 라운드를 거치며 vacuity·중복 스캔·doc drift 문제를 실측 기반으로 착실히 다잡아 온 결과물이다. 함수 길이·중첩 깊이·순환 복잡도 관점에서는 문제가 없고, 상수 네이밍(`ISO_DATE`, `WORKTREE_PLACEHOLDER`, `WORKTREE_SENTINEL`)과 에러 메시지 포맷도 파일 전체에서 일관적이다. 남은 이슈는 대부분 "코드가 틀렸다"가 아니라 "다음 리더의 스캔 비용" 에 관한 것이다 — 헤더 주석에 리뷰 회차 내러티브가 과도하게 누적된 점, `describe("plan-frontmatter guard")` 이름이 이제 링크 무결성 검사까지 포괄하게 되어 스코프와 이름이 어긋난 점, 그리고 사소한 이름 불일치·중복 스캔이다. CRITICAL 은 없다.

## 위험도
LOW
