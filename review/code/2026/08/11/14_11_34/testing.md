# 테스트(Testing) Review — 델타 라운드 (`bafa7c007`)

## 검증 방법

직전 라운드(`13_51_44`)의 `testing.md`/`SUMMARY.md`/`RESOLUTION.md` 를 먼저 읽고, 이번 라운드의
유일한 새 커밋 `bafa7c007`(`git show --stat`/`git show -- '*.ts'` 로 실제 diff 직접 확인)만을
델타로 취급했다. 검증은 저장소를 직접 실행해서 했다(뮤테이션은 하지 않았다 — 아래 §3 근거 참고):

- `pnpm exec vitest run src/lib/docs/__tests__ --reporter=dot` → **2892 passed** (실측)
- `pnpm exec vitest run src/lib/docs/__tests__/spec-plan-completion.test.ts` → **818 passed** (실측, 커밋 메시지 수치와 일치)
- `pnpm exec tsc --noEmit -p tsconfig.json` → 에러 0
- `pnpm exec eslint src/lib/docs/__tests__` → 0 error / 3 warning(`plan-scan.test.ts` 의 기존 `_` 접두 미사용 변수 3건, 이 델타가 만든 것 아님 — 직전 라운드 처분 기록과 일치)
- `git status --short` 로 워크트리 무변경 재확인. 저장소를 수정하는 명령(`git checkout`/`restore`)은 쓰지 않았다.

## 질문별 결과

### 1. `path.isAbsolute` 제거가 기존 5개 호출부의 동작을 바꾸지 않았는가 — **바뀌지 않음, 확인됨**

`grep -rn "walkTree(" codebase/frontend/src/lib/docs/__tests__/*.ts`(테스트 파일 제외)로 5개
호출부를 전수 확인했다:

- `impl-anchor-parse.ts:112` — `walkTree(rootDir, [subPath], ...)`
- `plan-scan.ts:70` — `walkTree(root, [path.join("plan", bucket)], ...)`
- `spec-frontmatter-parse.ts:89` — `walkTree(root, ["spec"], ...)`
- `spec-links.ts:160` — `walkTree(root, ["spec"], ...)`
- `spec-links.ts:332` — `walkTree(root, CODEBASE_SOURCE_ROOTS, ...)` (`CODEBASE_SOURCE_ROOTS` 는 `"codebase/backend/src"` 등 리터럴 상대 세그먼트 배열)

다섯 곳 모두 `root` 기준 상대 세그먼트만 넘긴다. `path.isAbsolute(base) ? base : path.join(root, base)` → `path.join(root, base)` 로의 단순화는 `path.isAbsolute(base)` 가 절대 `true` 가 되지 않는 입력 도메인에서 항등이므로, 관측 가능한 동작 변화가 없다. 이는 직전 라운드에서 testing 이 뮤테이션으로 이미 실측한 것(해당 삼항을 반대로 뒤집어도 2900건 전량 GREEN)과 논리적으로 정확히 대칭이다 — "아무도 안 쓰는 분기를 없앤다"는 이번 삭제는 그 실측 결과의 필연적 귀결이다. `tsc --noEmit` 0 에러·`vitest run` 전체 통과로 컴파일·런타임 양쪽에서 재확인했다.

### 2. `SpecMdFile` → `MdFileRef` 치환이 타입만 바뀌고 런타임 동작이 같은가 — **그렇다, 확인됨**

`SpecMdFile`(`export type SpecMdFile = MdFileRef`)은 순수 타입 별칭이라 애초에 런타임 표현이 없다(TS 컴파일 시 완전히 소거). 이번 델타가 지운 것은 그 별칭 선언 자체와, 유일한 사용처였던 `findBrokenLinksInFiles(files: SpecMdFile[], ...)` 의 파라미터 타입 표기(→ `MdFileRef[]`)뿐이다.

- `grep -rn "SpecMdFile" codebase/frontend/src/` → 코드 내 잔존 참조 0건(남은 것은 `plan-scan.ts`/`tree-walk.ts` 주석의 역사적 언급뿐, 타입 참조 아님).
- `grep -rn "SpecMdFile" codebase/frontend/src/lib/docs/__tests__/*.test.ts` → 0건 — 어떤 테스트도 이 타입을 import 하지 않았으므로 삭제로 깨질 테스트가 애초에 없었다.
- `tsc --noEmit` 0 에러로 타입 레벨 회귀도 없음을 재확인.

### 3. 뮤테이션 3축(`skipDir`/`recurse`/`includeFile`)이 여전히 각각 대응 테스트를 RED 로 떨어뜨리는가 — **영향 없음, 코드 검토로 확인 (재실행 안 함, 근거 명시)**

`git show bafa7c007 -- codebase/frontend/src/lib/docs/__tests__/tree-walk.ts` 로 diff 를 직접 대조한 결과, 이 커밋이 `tree-walk.ts` 에서 건드린 줄은 **딱 하나**다 — `const dir = path.isAbsolute(base) ? base : path.join(root, base);` → `const dir = path.join(root, base);` (+ 주석 4줄 추가). `skipDir`/`recurse`/`includeFile` 이 실제로 평가되는 루프 본문(87~99행: `if (!recurse) continue;` / `options.skipDir?.(...)` / `options.includeFile(...)`)은 **한 글자도 바뀌지 않았다**. `tree-walk.test.ts` 쪽 diff 도 주석 한 줄 교체뿐이고 `it`/`expect` 는 전부 그대로다(`git show bafa7c007 -- codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts` 로 확인).

세 옵션이 관여하는 코드·테스트가 바이트 단위로 불변이므로, 직전 라운드가 scratch 뮤테이션으로 실측한 결과(`skipDir` 무력화 → 8건, `recurse` 무력화 → 35건, `includeFile` 제거 → 612건)는 논리적으로 이번 라운드에도 그대로 성립한다. 원칙(뮤테이션은 저장소 밖 scratch 에서만, 다른 11명이 같은 워크트리를 동시에 쓰는 상황)에 따라 이미 결론이 코드 diff 로 닫힌 재확인성 뮤테이션을 다시 도는 대신, `vitest run`(2892 passed, 실패 0) 으로 세 옵션이 여전히 정상 동작(회귀 없음)함만 실행 기반으로 재확인했다. 재실행이 필요하다고 판단되면(예: 다음 라운드가 `tree-walk.ts` 루프 본문을 건드리면) 그때 scratch 뮤테이션을 다시 돌리는 것이 맞다.

### 4. plan 이동으로 테스트 수 2893 → 2892 감소 — **커버리지 감소 아님, 산술적으로 정확히 설명됨 (실측 재현)**

이동 전(plan 이 `plan/in-progress/`에 있을 때)과 이동 후(`plan/complete/`)에 각각 어떤 파일의 어떤 `describe`/`it` 이 이 plan 을 몇 개의 개별 테스트로 만드는지 직접 코드로 추적했다:

- **잃은 쪽 — `plan-frontmatter.test.ts:76-102`**: `for (const abs of plans)`(`plans = collectLivePlanMarkdown(root)`, top-level `plan/in-progress/*.md`)가 plan 마다 `describe(rel, ...)` 블록을 열고 그 안에 `it()` **4개**를 생성한다("has a parseable frontmatter block"·"`worktree` is set..."·"`started` is an ISO date"·"`owner` is set"). plan 이 `in-progress/` 를 떠나면 이 4개가 사라진다.
- **얻은 쪽 — `spec-plan-completion.test.ts:104-142`**: `for (const {rel, parsed} of enforced)`(Gate C 컷오프 `2026-06-04` 이후 `started` 를 가진 `plan/complete/**`)가 plan 마다 `describe(rel, ...)` 안에 `it()` **3개**를 생성한다("declares spec_impact"·"each spec_impact spec path exists"·"string spec_impact is an explicit no-op assertion" — 뒤 두 개는 조건에 안 맞으면 `if (...) return;` 으로 조기 반환하지만 `it()` 자체는 여전히 1건으로 집계된다). 이동한 plan 의 `started: 2026-08-10` 은 컷오프 이후라 `enforced` 에 들어가므로 이 3개가 새로 생긴다.

순증감 = `-4 + 3 = -1`, 이동 전 baseline(직전 라운드가 실측한 2893)에서 정확히 1 감소해 **2892** 가 된다 — 실제로 `vitest run` 을 돌려 **2892 passed** 를 재현했고(위 §검증 방법), `spec-plan-completion.test.ts` 단독 재실행도 커밋 메시지가 적은 **818 passed** 와 정확히 일치한다. 잃은 4개(frontmatter 4필드 검사)와 얻은 3개(`spec_impact` 판정 3종)는 서로 다른 종류의 검증이지 "같은 검증이 사라진" 것이 아니다 — plan 이 살아있을 때는 frontmatter 기본 필드(worktree/started/owner)를, 완료됐을 때는 Gate C 의 spec 정합 선언(spec_impact)을 검증하는 게 원래 설계다(SoT: `.claude/docs/plan-lifecycle.md §4/§5`). 즉 **테스트 개수 자체가 "이 plan 하나에 대한 불변 커버리지 지표"가 아니라 "그 plan 이 현재 라이프사이클 단계에서 강제되는 규칙 개수"** 라서, 이동에 따라 자연스럽게 재계산되는 파생값이다. 이 델타가 새로 만든 코드(`isAbsolute` 제거·`SpecMdFile` 삭제)로 인한 테스트 손실은 0건이다.

## 새 CRITICAL — 없음

## 새 WARNING/INFO — 없음

이번 델타는 순수하게 (a) 직전 라운드가 지적한 미관측 죽은 분기 제거, (b) 근거가 반증된 타입 별칭 제거, (c) 주석 정리, (d) plan 이동 + `spec_impact` 정정으로 구성돼 있다. 넷 다 테스트 표면을 **줄이는** 방향(관측되지 않던 옵션을 없앰, 잔존 참조 없는 타입을 없앰)이거나 테스트와 무관한 문서/plan 변경이라, 새로 커버리지가 필요한 코드 경로가 생기지 않았다. 직전 라운드에서 등재로 처분된 INFO(`spec-frontmatter-parse.ts` 의 `matterNoCache` 전용 회귀 fixture 부재)는 이 델타가 건드리지 않은 파일이라 재론하지 않는다(그 파일은 `bafa7c007` diff 에 없음 — `git show --stat` 로 확인).

## 요약

`bafa7c007` 은 직전 testing 라운드가 낸 INFO(관측되지 않는 `path.isAbsolute` 분기)를 정확히 겨눠 제거했고, 5개 호출부 전수 확인·`tsc`·`vitest` 실행으로 동작 무변경을 재확인했다. `SpecMdFile` 삭제는 순수 타입 소거라 런타임/테스트에 영향이 없음을 grep 전수 확인으로 검증했다. 뮤테이션 3축(`skipDir`/`recurse`/`includeFile`)은 이 커밋이 그 로직에 손을 대지 않았다는 것을 diff 로 직접 확인했으므로 직전 라운드의 실측 결과(8/35/612건)가 그대로 유효하다고 판단하며, 실행 기반 재확인(전체 스위트 2892 passed, 회귀 0)으로 보강했다. 테스트 수 2893→2892 감소는 커버리지 손실이 아니라 plan 이 `in-progress`(4개 필드 검사)에서 `complete`(3개 `spec_impact` 검사, 컷오프 이후라 강제 대상)로 옮겨가며 생기는 산술적으로 정확한 파생 결과이며, `-4+3=-1` 계산과 실측(2892·818 passed) 이 정확히 일치함을 확인했다. 새 CRITICAL 없음.

## 위험도

NONE
