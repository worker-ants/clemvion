# 신규 식별자 충돌 검토 — naming_collision

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
diff 소스: 프롬프트 번들에 diff 섹션이 누락돼 있어(알려진 결함) 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` 에서
`git diff origin/main...HEAD` 를 직접 실행해 확보함(`--stat` 172줄 + 대상 2개 test 파일
전체 diff).

대상 신규 식별자(직전 세션 `04_07_54` 이후분, 오케스트레이터 지정):

- `plan-scan.ts`: `findUnparseablePlans` · `parseFrontmatterSafe` · `ParsedFrontmatter`
  (+ `rawScalar`/`isIsoDate` 가 private → export 로 승격)
- `spec-plan-completion.test.ts`: `hasMalformedStarted` · `danglingSpecImpact` ·
  `makeSpecExists` (+ `isGateCEnforced` 시그니처가 `Record<string, unknown>` → `string`
  으로 변경)

## 발견사항

- **[WARNING]** `danglingSpecImpact` 이름이 이 모듈군의 `find*` = "위반/오펜더 배열 반환"
  컨벤션과 어긋난다 — boolean predicate 처럼 읽히는데 실제로는 배열을 반환한다
  - target 신규 식별자: `danglingSpecImpact(impact: unknown[], specExists): unknown[]`
    (`codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:96-101`)
  - 기존 사용처(컨벤션 근거, 전수 확인): 같은 `docs/__tests__/` 가드 클러스터
    (`plan-scan.ts`·`spec-links.ts`·형제 디렉터리 `workspace/__tests__/href-guard-utils.ts`)
    안의 모든 `find*` 함수가 예외 없이 "위반/오펜더 목록"을 반환한다 —
    `findUnparseablePlans(root): string[]`(`plan-scan.ts:184`),
    `findNonTerminalCompletedPlans(root): NonTerminalPlan[]`(`plan-scan.ts:160`),
    `findFrontmatterViolations(root): FrontmatterViolation[]`(`plan-scan.ts:319`),
    `findBrokenLinks`/`findBrokenPlanLinks`/`findBrokenSpecLinksInSources(root): LinkViolation[]`
    (`spec-links.ts:263,290,352`), `findRawHrefOffenders(...): string[]`
    (`href-guard-utils.ts:33`). 저장소 전역(backend 포함)의 다른 `find*` 함수는 대부분
    "단건 검색"(`findService`·`findActivePlanContext`·`findFirstTriggerNode` 등)이라 이
    "배열=위반" 규약은 **저장소 전역 공식 규약이 아니라 이 docs-guard 클러스터에 국한된
    de-facto 패턴**이다. 다만 같은 `docs/__tests__/` 폴더 안에도 예외가 하나 있다 —
    `findGuiFlowSections(mdx): GuiFlowSection[]`(`impl-anchor-parse.ts:70`)는 위반이 아니라
    **매칭된 콘텐츠 섹션**을 반환한다(추출용 파서 헬퍼, 가드 판정 함수가 아님). 따라서
    코드 리뷰의 "모듈 컨벤션이 find\*=위반 배열 반환" 지적은 **`danglingSpecImpact` 의
    직접 형제인 Gate C/plan-lifecycle 가드 함수군(`plan-scan.ts`·`spec-links.ts`) 범위에서는
    정확**하고, `danglingSpecImpact` 만 이 국소 패턴에서 벗어난다. (단, "저장소 전역 컨벤션"
    이라는 강한 프레이밍으로 일반화하면 `findGuiFlowSections`·backend 의 단건-검색 `find*`
    들과는 맞지 않으므로 그 조건은 명시가 필요하다.)
  - 상세: `spec-impl-evidence.md` 자체는 이 함수명을 규정하지 않으므로(spec 문서는 §4
    가드 표에 파일명만 등재) spec-충돌은 아니고, 코드 내부 명명 일관성 이슈다. 실 위험은
    낮다 — TypeScript 반환 타입(`unknown[]`)이 boolean 오용을 컴파일 타임에 막고, 호출부
    2곳(`spec-plan-completion.test.ts:225,302-306`)이 모두 배열 메서드(`.map`/`toEqual([])`)
    로 즉시 쓰여 오독 위험이 실사용에서 드러난 적은 없다. 다만 향후 새 호출부(예: pre-commit
    hook, 위 문서의 "Gate C 함수 이전" 항목이 실행되면)가 `if (danglingSpecImpact(...))`
    처럼 truthy 로 오용할 위험은 존재한다.
  - 제안: **이미 적절히 등재·추적됨** — `plan/in-progress/docs-guard-walker-dedup.md`
    §"2026-08-10 추가" 체크리스트에 `danglingSpecImpact` → `findDanglingSpecImpact` 개명이
    명시돼 있다. 그 제안 이름을 저장소 전역에서 grep 한 결과 **기존 사용처와 충돌 없음**
    (`git grep findDanglingSpecImpact` 0건) — 위 컨벤션(위반 배열 반환)과도 정확히 부합해
    개명 제안 자체는 적절하다. 이번 라운드에서 즉시 적용을 요구할 필요는 없다(같은 plan 이
    Gate C 판정 함수 전체를 `plan-scan.ts` 로 이전하는 더 큰 리팩터와 함께 처리하기로 이미
    범위를 잡아 두었다) — 다만 리네임 전까지는 신규 호출부 추가 시 boolean 오용 위험을
    리뷰어가 인지하고 있어야 한다.

- **[INFO / 확인됨, 충돌 없음]** 이번 라운드 신규·승격 식별자 6종 전수 grep — 저장소
  전역(`codebase/`, `.claude/hooks`, `.claude/tools`)에 동명 심볼로 이미 쓰이는 곳 없음
  - target 신규 식별자: `findUnparseablePlans` · `parseFrontmatterSafe` ·
    `ParsedFrontmatter` · `hasMalformedStarted` · `danglingSpecImpact` · `makeSpecExists`
  - 확인 방법: `git grep -n "<식별자>" -- '*.ts' '*.tsx'` (review/ 산출물 제외) 및
    `.claude/hooks/**`·`.claude/tools/**`(bash/Python 쪽 cross-language 중복 여부)
    전수 실행 — 모두 정의부 + `plan-scan.ts`/`spec-plan-completion.test.ts`/
    `plan-scan.test.ts` 세 파일 안의 자기 참조만 나온다. `ParsedFrontmatter` 는
    `gray-matter` 패키지의 `.d.ts` 에도 동명 타입이 없음을 별도 확인(`parseFrontmatterSafe`
    가 `matter()` 를 감싸는 wrapper 라 그 패키지 타입과의 충돌 가능성을 특히 점검).
  - 제안: 없음.

- **[INFO / 확인됨, 파괴적 변경 아님]** `isGateCEnforced` 시그니처 변경
  (`Record<string, unknown>` → `string`) — export 상태이나 외부 소비처 부재
  - target 변경: `export function isGateCEnforced(block: string): boolean`
    (`codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:57`,
    종전 `isGateCEnforced(data: Record<string, unknown>): boolean` — origin/main 대비
    diff 로 확인)
  - 기존 사용처 전수 확인: `git grep -n "isGateCEnforced" -- '*.ts' '*.tsx'` 결과,
    호출부는 같은 파일 내부(§ `enforced` 필터 `:162`, 단위 테스트 `:256-274`) 뿐이고,
    `plan-scan.ts:217`·`docs-guard-walker-dedup.md:94` 는 **주석/산문 언급**일 뿐 실제
    import·호출이 아니다. 다른 `.ts`/`.tsx` 파일이 `spec-plan-completion.test.ts` 를
    import 하는 곳도 없다(`from "./spec-plan-completion"` 류 grep 0건).
  - 상세: `isGateCEnforced` 는 `.test.ts` 파일에서 `export` 된 헬퍼라 vitest 빌드 경로상
    다른 프로덕션 모듈이 정상적으로 import 할 대상이 아니고, 실제로 아무도 import 하지
    않는다. 따라서 시그니처를 Record 기반에서 원문 스칼라(`block: string`) 기반으로 바꾼
    것은 **동일 파일 안에서 self-consistent** 하며 외부 계약을 깨지 않는다. (참고:
    Gate C 판정 함수들이 `*.test.ts` 안에 있어 재사용이 어렵다는 구조적 문제 자체는
    이미 같은 plan 문서에 "선재 배치" 로 별도 추적 중 — 이번 시그니처 변경과는 별개 이슈.)
  - 제안: 없음(차단 사유 아님). 추후 Gate C 함수들을 `plan-scan.ts` 로 옮기는 시점에
    이 시그니처(`block: string`)가 새 소비처의 계약이 되므로, 그 이전 시에는 원문 블록
    전달 관례를 유지할 것.

- **[INFO]** `rawScalar`/`isIsoDate` private → export 승격 — 이름 자체는 직전 세션
  (`04_07_54`)에서 이미 `plan-scan.ts` 내부 export 로 검토돼 충돌 없음 확인됨(그 라운드
  보고서 참조). 이번 라운드의 차이는 **소비처가 한 곳 늘었을 뿐**(`spec-plan-completion.test.ts`
  가 신규 import) — 식별자 자체의 신규 충돌 표면은 없다. 요구사항 ID·API endpoint·이벤트명·
  환경변수·spec 파일 경로 항목은 이번 diff 가 `spec/conventions/spec-impl-evidence.md` 의
  `code:` 리스트에 `plan-scan.ts` 한 줄 추가 + 기존 `plan-frontmatter.test.ts` 행 갱신뿐이라
  해당 없음(N/A) — 새 spec id·endpoint·env var·파일 경로를 도입하지 않는다.

## 요약

이번 라운드가 승격·신설한 식별자(`findUnparseablePlans`·`parseFrontmatterSafe`·
`ParsedFrontmatter`·`hasMalformedStarted`·`danglingSpecImpact`·`makeSpecExists` +
`rawScalar`/`isIsoDate` export 승격 + `isGateCEnforced` 시그니처 변경) 중 저장소 전역과
**진짜 충돌하는 것은 없다** — 전수 grep 으로 동명 심볼 부재를 확인했고, `gray-matter` 패키지
타입과의 충돌도 없다. 유일한 명명 이슈는 `danglingSpecImpact` 가 이 파일군의 `find*`=
"위반 배열 반환" de-facto 패턴(같은 클러스터 6개 함수가 일관되게 따름, 클러스터 밖의
`findGuiFlowSections`·backend 단건-검색 `find*` 는 예외)에서 벗어나 boolean predicate 처럼
읽힌다는 것인데, 코드 리뷰의 지적은 (클러스터 범위로 한정하면) 타당하고 등재된 개명 제안
(`findDanglingSpecImpact`)도 충돌 없이 적절하며 이미 `docs-guard-walker-dedup.md` 에
후속 항목으로 추적 중이라 이번 라운드의 추가 조치는 불요하다. `isGateCEnforced` 시그니처
변경은 export 상태지만 실제 외부 소비처가 하나도 없어(`*.test.ts` 내부 self-reference 뿐)
파괴적 변경이 아니다.

## 위험도

LOW

STATUS=success
