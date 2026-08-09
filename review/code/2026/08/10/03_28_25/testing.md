# 테스트(Testing) 리뷰 — plan-scan / plan-frontmatter / spec-links

## 발견사항

- **[WARNING]** 공백-only `worktree`/`owner` 값이 무검사로 통과한다 — placeholder 방지 목적을 우회
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:234-242`(worktree), `:249-252`(owner)
  - 상세: `checkPlanFrontmatter` 의 worktree/owner 판정은 `wt.length === 0`/`owner.length === 0` 만 본다(trim 없음). 실제로 `worktree: "   "`, `owner: "   "` 를 넣어 `checkPlanFrontmatter` 를 직접 호출해 확인한 결과 **위반 0건**이 반환됐다(`worktree-missing`/`owner-missing` 어느 것도 잡히지 않음). `WORKTREE_PLACEHOLDER` 정규식도 공백-only 문자열에는 매치하지 않는다. 이 파일의 존재 이유 자체가 "살아있지만 죽은 값이 조용히 통과하는 것"을 막는 것이라고 주석에 명시돼 있는데(`:141-143` "레거시 placeholder... 살아있지만 죽은 worktree 처럼 보여 충돌 검출을 오염시킨다"), 공백 문자열이 정확히 그 실패 형태를 재현한다.
  - 관련 테스트: `plan-scan.test.ts:215-222`("rejects a missing or empty `worktree`/`owner`")는 빈 문자열(`""`)만 다루고 공백-only 는 다루지 않는다 — 이 분기(엄밀히는 "분기 부재")가 fixture 로 겨눠지지 않는다.
  - 제안: `owner.trim().length === 0`/`wt.trim().length === 0` 로 정정하고, `plan-scan.test.ts` 에 `worktree: "   "`/`owner: "   "` 케이스를 추가해 이 회귀를 캐너리로 고정할 것.

- **[WARNING]** `plan/complete/**` 하위 디렉터리 이름의 `0-`/`_` 접두는 필터링되지 않음 — 미검증·미문서화 동작
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:66-70`(`walkPlanMarkdown` 디렉터리 재귀 분기), `:36-47`(`isLifecyclePlan` 은 파일명만 검사)
  - 상세: `isLifecyclePlan` 은 파일명에만 적용되고, 디렉터리 재귀는 `archive` 라는 리터럴 이름만 제외한다(`e.name === "archive"`). 즉 `plan/complete/0-batch/child.md` 처럼 디렉터리 자체가 `0-`/`_` 로 시작해도 그 하위 `.md` 파일(파일명 자체는 접두가 없음)은 수집 대상에 포함된다 — 실제로 `collectCompletePlanMarkdown` 을 호출해 확인함(`[{"relPath":"plan/complete/0-batch/child.md", ...}]` 반환). 헤더 주석(`:36-38`)은 "0-`/`_` 접두는 인덱스 파일" 이라 서술하는데 이것이 파일에만 적용되고 디렉터리에는 적용되지 않는다는 비대칭이 어느 테스트로도 고정돼 있지 않다.
  - 제안: 의도된 동작이면(그룹 폴더는 재귀 대상, index 파일만 개별 제외) 그 사실을 pin 하는 fixture 를 `plan-scan.test.ts` 에 추가. 의도가 아니면 디렉터리 이름도 `isLifecyclePlan`-류 검사로 걸러야 함.

- **[INFO]** 이 reviewer 페이로드에 `spec-links.test.ts` 가 누락됨 — `spec-links.ts` 신규 export(`findBrokenPlanLinks`)의 테스트 커버리지를 프롬프트만으로는 판단 불가
  - 위치: 프롬프트 조립 단계(`_prompts/testing.md`) — 대상 소스 아님. `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 는 이번 diff 에 +95 라인으로 포함돼 있으나 이 reviewer 의 "리뷰 대상 파일" 목록(4개)에는 빠져 있음.
  - 상세: 직접 저장소를 열어 `git diff origin/main -- .../spec-links.test.ts` 로 확인한 결과, `findBrokenPlanLinks` 에 대해 DEAD 링크 검출·코드펜스 무시·self-anchor 무시(`checkSelfAnchors:false`)·스코프(top-level only, `0-`/`_`/cluster 제외)·clean-repo negative case 까지 5개 `it` 로 충실히 커버돼 있어 **실제 코드 자체에는 문제 없음**. 다만 이 파일이 페이로드에서 빠진 것은 프롬프트 조립 로직의 갭으로, 다른 세션/다른 diff 조합에서는 진짜 커버리지 갭을 이 reviewer 가 놓칠 위험이 있다(`feedback_workflow_disk_write_gap_false_counts` 류와 같은 계열의 위험).
  - 제안: 코드 변경 자체는 조치 불필요. orchestrator 프롬프트 생성 스크립트가 diff 에 포함된 `*.test.ts` 파일을 빠짐없이 해당 reviewer 페이로드에 포함하는지 별도 점검 권장.

- **[INFO]** `plan-frontmatter.test.ts` 의 non-vacuity 캐너리(`toBeGreaterThan(50)`)가 실저장소 plan 개수에 결속
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`, "the plan link scanner actually sees links (non-vacuity)" (전체 파일 컨텍스트 기준 약 127-133행)
  - 상세: 이미 `plans.length > 5` 하한이 grooming 으로 인한 오탐 이력(2026-07-17, `> 20` → 정확히 20)을 주석에 남긴 것과 같은 계열의 리스크다. `> 50` 은 링크 총합이라 여유가 있어 보이지만, in-progress plan 수가 grooming 으로 크게 줄면(예: 소수의 plan 만 남고 각 plan 의 링크 수도 적으면) 마진 없이 flake 할 수 있다. 즉각적 문제는 아니며 조치 불필요 — 다만 이 하한이 향후 발화하면 로직 결함이 아니라 이 계열의 "실측 결속" 문제임을 미리 남겨둔다.

- **[INFO]** `rawScalar` (`plan-scan.ts:153-157`)의 정규식 기반 스칼라 추출은 blockscalar(`started: |`)·같은 키 중복 선언·인라인 주석(`started: 2026-08-10 # note`) 형태를 다루지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:153-157`
  - 상세: `started` 필드는 실사용상 항상 단순 스칼라(quoted/unquoted ISO 문자열 또는 js-yaml Date)이므로 실질 위험은 낮다. 다만 테스트 스위트가 이례적으로 엄격하게 라운드트립·leap-year 등 세부까지 pin 하는 스타일에 비해, 이 3가지 형태는 fixture 로 겨눠지지 않는다.
  - 제안: 낮은 우선순위. 실제 plan frontmatter 관례가 바뀌지 않는 한 추가 조치 불필요.

## 요약

전반적으로 테스트 설계 품질이 매우 높다. `plan-scan.ts` 는 순수 함수·문자열/root-경로 입력 기반으로 설계돼 있어 의존성 주입 없이도 테스트 용이성이 뛰어나고(`checkPlanFrontmatter` 가 raw string 을 받아 fs 없이 각 분기를 직접 겨눔), mock/stub 대신 `mkdtempSync` 실제 파일시스템 fixture 를 쓰는 방식이 fs 동작 괴리 위험을 원천 차단한다. `plan-scan.test.ts`/`plan-frontmatter.test.ts`/`spec-links.test.ts`(diff 확인) 모두 이 PR 이 스스로 지적하는 "positive-only 라 위반 분기가 한 번도 안 돈다"는 결함을 negative-path fixture 로 실제로 해소했고, "정확히 심은 위반만 잡히는가"(no over-reach), non-vacuity 캐너리, 뮤테이션 테스트로 실측된 죽은 분기 제거(`isIsoDate` 라운드트립 단순화) 등 이 코드베이스 메모리에 기록된 교훈들을 스스로 실천하고 있다. 다만 이번 검증 과정에서 `worktree`/`owner` 필드의 공백-only 값이 무검사로 통과하는 실제 동작(직접 재현 확인)과, `plan/complete/**` 하위 디렉터리명의 `0-`/`_` 접두가 필터링되지 않는 동작(직접 재현 확인)이 어느 fixture 로도 겨눠지지 않는다는 갭을 발견했다 — 전자는 이 파일의 존재 이유(placeholder 로 위장한 죽은 값 차단)를 직접 침해하는 형태라 우선 보정 가치가 있다. 이 reviewer 페이로드에 diff 대상인 `spec-links.test.ts` 가 누락된 점은 코드 결함이 아니라 리뷰 파이프라인 조립 이슈로 별도 기록해 둔다.

## 위험도
LOW
