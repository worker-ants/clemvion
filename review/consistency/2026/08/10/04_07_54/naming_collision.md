# 신규 식별자 충돌 검토 — naming_collision

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
diff 소스: 프롬프트 번들에 diff 섹션이 누락돼 있어(알려진 결함) 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` 에서
`git diff origin/main...HEAD` 를 직접 실행해 확보함.

대상 신규 식별자 (`plan-scan.ts` / `plan-scan.test.ts`):
`checkPlanFrontmatter` · `findFrontmatterViolations` · `FrontmatterViolation` ·
`FrontmatterViolationKind` · `WORKTREE_SENTINEL` · `rawScalar` · `isIsoDate` ·
fixture 빌더 `frontmatter`(`fm` 과 공존)

## 발견사항

- **[WARNING]** `collectCompletePlanMarkdown` (신규, `plan-scan.ts` export) 이
  기존 `collectCompletePlans` (`spec-plan-completion.test.ts:59`, Gate C 로컬 함수)와
  한 단어 차이 이름으로 공존
  - target 신규 식별자: `collectCompletePlanMarkdown` (`codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:83`, `export function collectCompletePlanMarkdown`)
  - 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59` `function collectCompletePlans(root: string): string[]` — Gate C(`spec_impact` 강제) 가 완료 plan 을 수집하는 독립 구현
  - 상세: 두 함수 모두 "`plan/complete/**` 의 `.md` 를 수집" 한다는 같은 목적이지만 서로 다른 코드 경로(독립 walker)이고 반환 타입도 다르다(`PlanMdFile[]` vs `string[]`). 이름이 `…PlanMarkdown` vs `…Plans` 로만 갈려 grep/자동완성 시 혼동 가능. **target 자신이 이 위험을 코드 주석(`plan-scan.ts:19-25`, `:45`)에서 명시적으로 인지**하고 있고, `plan/in-progress/docs-guard-walker-dedup.md` 로 통합 여부 판정을 후속 분리했다(같은 diff 로 신규 작성). 현재는 두 walker 의 필터 값이 실측상 일치한다고 주석에 적혀 있으나 그 동등성을 강제하는 계약 테스트는 없다(같은 plan 파일의 "함께 볼 것" 체크리스트가 이 갭도 별도 항목으로 이미 추적 중).
  - 제안: 이번 라운드에서는 추가 조치 불요 — 이미 self-aware 하게 문서화·후속 plan 화 돼 있다. 후속 plan 실행 시 (a) `collectCompletePlanMarkdown` 재사용으로 전환하거나 (b) 전환하지 않는다면 두 함수의 반환 집합 동등성을 assert 하는 계약 테스트를 `docs-guard-walker-dedup.md` 체크리스트대로 추가할 것.

- **[INFO]** 같은 파일의 `fm` vs `frontmatter` 두 fixture 빌더 — 이름이 비슷해 스캔 시 혼동 여지는 있으나 시그니처가 달라 오호출은 컴파일 타임에 막힘
  - target 신규 식별자: `frontmatter` (`plan-scan.test.ts:206`, `const frontmatter = (fields: Record<string, string>): string => …`)
  - 기존(같은 diff 안에서 먼저 정의된) 식별자: `fm` (`plan-scan.test.ts:28`, `const fm = (status?: string): string => …`) — 둘 다 이번 diff 로 신규 도입, 같은 파일 module scope 에 공존(178줄 간격)
  - 상세: 둘 다 "frontmatter 블록을 가진 `.md` 본문 문자열을 만든다" 는 같은 역할의 헬퍼이지만 용도가 다르다 — `fm(status?)` 는 `title: t` 고정 + 선택적 `status:` 한 줄만 있는 최소 블록(Gate C `findNonTerminalCompletedPlans` 검증용, `describe("plan-scan")` 블록에서만 사용), `frontmatter(fields)` 는 임의 key/value 맵을 그대로 펼치는 범용 블록(`checkPlanFrontmatter` 3필드 검증용, `describe("checkPlanFrontmatter")`/`describe("findFrontmatterViolations")` 에서 사용). 시그니처가 `(status?: string)` vs `(fields: Record<string,string>)` 로 달라 `fm({...})` 나 `frontmatter("complete")` 처럼 뒤바꿔 부르면 즉시 타입 에러가 나므로 **런타임 오동작 위험은 낮다**. 다만 이름이 `fm`(frontmatter 의 축약)과 `frontmatter`(풀네임)로 사실상 같은 단어의 축약/풀네임 쌍이라, 리뷰어가 빠르게 훑을 때 "왜 두 개가 있지" 하는 인지 비용이 있다.
  - 제안: 기능적 위험은 없어 차단 사유 아님. 가독성 개선을 원하면 `fm` → `statusOnlyFm` 또는 `frontmatter` → `frontmatterFields` 등으로 목적을 이름에 드러내는 정도의 선택적 리네임 권장(비차단 INFO).

- **[INFO]** `WORKTREE_SENTINEL = "(unstarted)"` 이 언어 경계를 넘어 최소 4곳에 독립 하드코딩돼 있으나 현재는 값이 모두 일치
  - target 신규 식별자: `WORKTREE_SENTINEL` (`plan-scan.ts:150`, `export const WORKTREE_SENTINEL = "(unstarted)"` — 종전 `plan-frontmatter.test.ts` 로컬 상수를 이 파일로 승격·export)
  - 기존 사용처(모두 독립 리터럴, import 불가능한 언어 경계):
    - `.claude/tools/plan-stale-audit.sh:134` — `[[ "$wt_value" == "(unstarted)" ]]` (bash 문자열 비교)
    - `.claude/hooks/_lib/plan_guard.py:73` — `_PLACEHOLDER_WORKTREE = {"(unstarted)", "unstarted", "-", "tbd", "none", "n/a"}` (Python)
    - `.claude/tests/test_plan_guard.py:193,223,240` — 같은 리터럴을 테스트 fixture 로 재사용
    - `.claude/docs/plan-lifecycle.md:75` — 규약 SoT 산문 서술
  - 상세: 네 곳 모두 현재 `"(unstarted)"` 값에 합의돼 있고 의미도 일관(=아직 worktree 없는 plan 을 나타내는 명시 sentinel, placeholder 와 구분). TS 쪽은 이번 diff 로 파일-로컬 상수에서 export 상수로 승격돼 **TS 내부 재중복은 줄었지만**, bash/Python 은 언어가 달라 같은 상수를 import 할 수 없으므로 구조적으로 리터럴 재입력이 불가피하다. `plan-scan.ts` 자신의 주석(:141-149)이 이미 이 소비처 목록과 위험을 정확히 인지하고 있다. 값이 갈리는 순간(예: 누군가 TS 쪽만 `"(not-started)"` 등으로 바꾸는 경우) 조용히 어긋난다는 점은 review point 3 이 우려하는 그대로이나, **이번 diff 가 새로 만든 위험은 아니고** 기존에 이미 존재하던 cross-language 구조적 특성이며 이번 diff 는 오히려 TS 쪽 근거(§ plan-lifecycle.md:75)를 최신 소비처 목록으로 갱신해 문서 drift 를 줄였다(과거엔 이미 제거된 `plan_coherence` cross-worktree 충돌 검출을 근거로 들고 있었음 — 이번 diff 가 그 stale 근거를 정정).
  - 제안: 차단 사유 아님. 향후 값 변경 시 4곳(bash/Python 2곳/doc) 동시 갱신이 필요함을 인지하는 정도로 충분 — 원한다면 4곳을 여는 grep 커맨드를 `plan-lifecycle.md` 나 `plan-scan.ts` 주석에 한 줄 추가해 두면 향후 변경자의 누락 위험을 낮출 수 있다(선택).

- **[INFO / 확인됨, 실질 위험 없음]** `FrontmatterViolationKind` 리터럴 값과 기존 가드 어휘 충돌 여부, `implemented` 값의 spec status 도메인과의 공유
  - 상세: `"missing-block"` · `"unparseable"` · `"worktree-missing"` · `"worktree-placeholder"` · `"started-invalid"` · `"owner-missing"` 를 저장소 전역에서 grep 한 결과, 다른 위반 분류 taxonomy(예: `check-override-floors.py`, `date.ts` 등)에서 "unparseable" 이라는 **일반 영어 단어**로 산발적으로 쓰이는 사례는 있으나, 이들은 별도 타입 도메인(문자열 리터럴 유니언이 아니라 자연어 서술/주석)이라 실제 식별자 충돌이 아니다. `implemented` 값 하나가 spec frontmatter 의 `status` enum(`spec-impl-evidence.md §3`)과 plan frontmatter 의 `TERMINAL_PLAN_STATUSES` 사이에 공유되는 문제는 이미 target 문서 자신(`spec-impl-evidence.md §2.2`, 2026-08-09 추가분)이 "의미는 다르고 두 도메인은 문서 타입으로 완전히 갈리며 어휘를 맞출 의무는 없다" 고 명시적으로 근거를 남겨 두었다. 신규 문제 없음.
  - 제안: 없음.

## 요약

이번 라운드가 도입한 신규 식별자 7종(`checkPlanFrontmatter`·`findFrontmatterViolations`·`FrontmatterViolation`·`FrontmatterViolationKind`·`WORKTREE_SENTINEL`·`rawScalar`·`isIsoDate`)과 fixture 빌더 `frontmatter`는 저장소 전역에서 검증한 결과 **CRITICAL 급 진짜 충돌은 없다**. `FrontmatterViolationKind` 의 리터럴 어휘·`WORKTREE_SENTINEL` 값 자체는 기존 사용처와 정확히 일치하며, 후자의 cross-language(bash/Python/TS) 구조적 중복은 이번 diff 가 새로 만든 것이 아니라 이미 있던 특성이고 오히려 문서 drift 를 정정했다. 유일하게 실질적인 near-collision 은 `collectCompletePlanMarkdown` vs 기존 `collectCompletePlans` 인데, 이는 target 자신이 코드 주석과 후속 plan(`docs-guard-walker-dedup.md`)으로 이미 인지·추적 중이라 이번 라운드에서 추가 차단 조치가 필요하지 않다. `fm`/`frontmatter` 두 fixture 빌더 공존은 시그니처가 달라 오호출이 컴파일 타임에 걸리므로 가독성 수준의 INFO 로 충분하다.

## 위험도

LOW

STATUS=success
