# 정식 규약 준수 검토 — convention_compliance (4차 라운드, 종결 확인)

## 검토 범위·방법

- 대상: `spec/conventions/**` (bundle: `spec-impl-evidence.md`, `audit-actions.md`, `cafe24-api-catalog/{_overview,category,store,translation}.md`, `cafe24-api-metadata.md`)
- diff-base: `origin/main...HEAD` — 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서 실측:
  `git diff --stat origin/main...HEAD -- spec/conventions/ codebase/frontend/src/lib/docs/__tests__/ .claude/docs/plan-lifecycle.md PROJECT.md` →
  `.claude/docs/plan-lifecycle.md`(+22) · `PROJECT.md`(+2/-1) · `plan-frontmatter.test.ts`(+103/-14) · `plan-scan.test.ts`(신규) ·
  `plan-scan.ts`(신규) · `spec-links.test.ts`(+99) · `spec-links.ts`(+45) · `spec/conventions/spec-impl-evidence.md`(+4/-2)만 변경. `audit-actions.md`·`cafe24-api-catalog/**`·`cafe24-api-metadata.md`는 diff 밖(직전 3차 라운드 `01_53_28` 확인 그대로 무변경) — 재검토 불요, 신규 위반 없음.
- 3차(`01_53_28`)는 NONE 으로 종결됐고, 그 뒤 ai-review 가 낸 WARNING 1건(`plan-frontmatter.test.ts` 헤더 주석의 정본 오기재)만 반영됐다. 본 라운드는 그 정정 하나가 (a) 코드 사실과 일치하는지, (b) 세 미러(`PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5`)와 여전히 정합한지만 확인하는 좁은 종결 라운드다.

## 확인 결과

### 1. `plan-frontmatter.test.ts` 헤더 주석 정정 — 코드 사실과 일치 확인

정정 커밋: `f5f454844 fix(harness): 헤더 주석의 정본을 plan-scan.ts 로 정정 (ai-review W1)`.

현재 주석(`codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:16-26`):
> `그 규칙의 **단일 구현**은 \`plan-scan.ts\` 의 \`collectLivePlanMarkdown\` 이고 … (\`spec-links.ts\` 도 같은 이름을 export 하지만 그건 **하위호환 re-export** 다 — 링크 모듈이 plan 트리 규칙까지 갖고 있으면 그 규칙이 두 곳으로 갈린다.)`

워킹트리에서 직접 대조:
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17` — `import { collectLivePlanMarkdown } from "./plan-scan";`
- `spec-links.ts:304` — `export { collectLivePlanMarkdown };` (재-export)
- `spec-links.ts:306-308` `findBrokenPlanLinks()` 내부에서 그 import 한 `collectLivePlanMarkdown` 을 그대로 사용

→ "정본은 `plan-scan.ts`, `spec-links.ts` 의 동명 export 는 하위호환 재-export" 라는 주석 서술이 코드와 **정확히 일치**한다. `plan-frontmatter.test.ts:145` 의 자매 주석("스캐너는 `spec-links.ts` 의 공유 구현(`findBrokenPlanLinks`)을 쓴다")과도 모순 없음 — 링크 검사는 `spec-links.ts` 의 `findBrokenPlanLinks`(내부적으로 `plan-scan.ts` 의 스코프 함수를 씀)를 쓰고, frontmatter 검사의 스코프 수집은 `plan-scan.ts` 를 직접 쓴다는 두 문장이 서로 다른 층위를 가리키며 양립한다.

### 2. 세 미러 정합 재확인 — 정합

- **`PROJECT.md:277`**: `plan-frontmatter.test.ts` — plan 라이프사이클 가드 **3종** … 판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크). SoT: `.claude/docs/plan-lifecycle.md §4`.
- **`spec-impl-evidence.md §4.2`** (표 행): "셋을 본다 — (1)/(2)/(3) … 판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관이고 이 파일은 호출부다" — `PROJECT.md` 와 자구까지 거의 동일. frontmatter `code:` 목록도 `plan-scan.ts` 가 이번 diff 로 새로 추가돼(`+  - codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`) `spec-links.ts` 와 나란히 등재됐다 — §4.2 가드 파일 등재 규칙과 일치.
- **`plan-lifecycle.md §4/§5`**: 모듈 이름(`plan-scan.ts`/`spec-links.ts`)은 언급하지 않는다 — 이는 결함이 아니라 역할 분담 그대로다: `spec-impl-evidence.md §4.2` 이 "본 절은 가드 파일 등재 위치만 선언" 이라 명시하고, "가드 규약 SoT = plan-lifecycle §4"(필드·enum·예외 조건의 행위 서술)로 위임한다. `plan-lifecycle.md §4`(status 종료값 enum·`(unstarted)` sentinel·`TERMINAL_PLAN_STATUSES` 확장점)와 §5(자가 점검 체크리스트 2항목)는 이번 diff 로 신설된 두 검사(status 모순·상대링크)를 `PROJECT.md`/`spec-impl-evidence.md §4.2` 와 동일한 enum·예외(선택 필드·`plan/complete/**` 링크검사 제외)로 서술 — 3차 라운드에서 확인된 정합 상태가 이번 diff 로 흔들리지 않았다.

### 신규 발견

없음. 4차 라운드가 확인 범위로 지정한 단일 정정(`plan-frontmatter.test.ts` 헤더 주석)은 실제 코드(`spec-links.ts` → `plan-scan.ts` re-export 관계)와 정확히 일치하며, 세 미러(`PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5`)는 여전히 서로 정합하다. diff 범위 밖의 `audit-actions.md`·`cafe24-api-catalog/**`·`cafe24-api-metadata.md` 는 무변경이라 3차 라운드의 NONE 판정이 그대로 유효하다. 명명 규약·출력 포맷 규약·문서 구조 규약(Overview/본문/Rationale)·API 문서 규약·금지 항목 어느 관점에서도 이번 diff 가 새로 어긋내는 지점을 찾지 못했다.

## 요약

4차 라운드는 3차(NONE) 이후 반영된 WARNING 정정 1건(`plan-frontmatter.test.ts` 헤더 주석의 정본을 `spec-links.ts` → `plan-scan.ts` 로 정정)이 실제 코드 사실과 일치하고 세 미러(`PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5`)와 여전히 정합한지 확인하는 좁은 종결 라운드였다. 워킹트리 직접 대조(`spec-links.ts` 의 `collectLivePlanMarkdown` import·재-export 확인) 및 `git diff --stat origin/main...HEAD` 로 diff 범위를 한정한 결과, 정정은 정확했고 세 미러 간 새로운 드리프트는 발견되지 않았다. 신규 CRITICAL/WARNING/INFO 없음 — 게이트를 열어도 되는 종결 상태다.

## 위험도

NONE
STATUS=success
