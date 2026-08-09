# 신규 식별자 충돌 검토 — naming_collision (5차 라운드)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- SoT 워킹트리: `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`
- 직전 라운드(`02_18_34`)는 NONE 이었다. 그 이후 반영된 유일한 변경은 커밋
  `6101a04b2`(`fix(harness): non-vacuity 캐너리가 discovery 만 증명하던 것을 추출
  단계로 강화`) 하나뿐임을 실측으로 확인:

  ```
  git diff 3b037bc26..HEAD --stat -- codebase/ spec/
   .../lib/docs/__tests__/plan-frontmatter.test.ts | 26 +++++++++++++++-------
   1 file changed, 18 insertions(+), 8 deletions(-)
  ```

  (`c703039ba` 는 직전 라운드의 RESOLUTION 문서 커밋으로 `review/**` 만 건드리며
  코드·spec 변경은 없음.)

## 점검 대상: `extractLinks` 사용처 확대

`plan-frontmatter.test.ts` 가 신규로 `extractLinks` 를 import 해 "the plan link
scanner actually sees links (non-vacuity)" 테스트의 단언을 discovery(파일 수)에서
추출 단계(링크 수)로 강화했다.

```diff
- import { findBrokenPlanLinks } from "./spec-links";
+ import { extractLinks, findBrokenPlanLinks } from "./spec-links";
...
- expect(collectLivePlanMarkdown(root).length).toBeGreaterThan(5);
+ const links = collectLivePlanMarkdown(root).reduce(
+   (n, f) => n + extractLinks(f.absPath).length,
+   0,
+ );
+ expect(links, "...").toBeGreaterThan(50);
```

**신규 식별자 여부 실측**:

- `extractLinks` 정의는 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82`
  (`export function extractLinks(absPath: string): MdLink[]`) — `origin/main` 시점에도
  이미 존재:
  ```
  git show origin/main:codebase/frontend/src/lib/docs/__tests__/spec-links.ts | grep -n extractLinks
  80:export function extractLinks(absPath: string): MdLink[] {
  197:    for (const link of extractLinks(f.absPath)) {
  ```
- 기존 소비처: `spec-area-index.test.ts:5,84` 가 이미 동일 함수를 동일 의미(마크다운
  링크 추출)로 소비 중이었다.
- `plan-frontmatter.test.ts` 의 이번 변경은 **기존 export 를 추가로 import** 한
  것뿐 — 새 함수·타입·상수를 정의하지 않았다.
- 레포 전체(`codebase/`) 에서 동명의 다른 `extractLinks` 정의나 이질적 의미로 쓰인
  사례는 없음:
  ```
  grep -rn "extractLinks" --include="*.ts" --include="*.tsx" codebase/
    → spec-links.ts(정의) / spec-area-index.test.ts / plan-frontmatter.test.ts /
      spec-links.test.ts(주석) 뿐, 전부 같은 "마크다운 링크 추출" 의미 도메인.
  ```

## 발견사항

없음. 이번 라운드 변경분(diff 전체)은 기존에 정의·사용 중이던 `extractLinks` 를
새 호출부에서 소비 범위를 넓힌 것으로, 다음 6개 관점 어디에도 해당하지 않는다:

1. 요구사항 ID 충돌 — 해당 없음 (spec ID 신설 없음)
2. 엔티티/타입명 충돌 — 해당 없음 (신규 타입/DTO 없음, `MdLink` 등 기존 타입 재사용)
3. API endpoint 충돌 — 해당 없음
4. 이벤트/메시지명 충돌 — 해당 없음
5. 환경변수·설정키 충돌 — 해당 없음
6. 파일 경로 충돌 — 해당 없음 (신규 파일 없음, 기존 `plan-frontmatter.test.ts` 수정만)

`extractLinks` 는 단일 정의·단일 의미 도메인(spec-links.ts 소관, 마크다운 링크
추출)을 유지한 채 소비처만 하나 늘어난 것이라, 동일 이름이 다른 의미로 쓰이는
충돌도, 유사 이름 혼동도 발생하지 않는다.

## 요약

5차(종결) 라운드. 직전 라운드(`02_18_34`) 이후 반영된 유일한 변경(`6101a04b2`)은
`plan-frontmatter.test.ts` 캐너리 강화이며, 신규 식별자를 하나도 도입하지 않고
기존 `spec-links.ts` export `extractLinks` 의 소비처만 늘렸다. `origin/main` 시점
정의·기존 소비처(`spec-area-index.test.ts`)와 대조한 결과 의미 충돌·유사명 혼동
모두 없음을 실측으로 확인했다. 신규 식별자 충돌 관점에서 이번 target 은 게이트를
열어도 되는 상태다.

## 위험도

NONE

STATUS=success
