# 테스트(Testing) Review

## 검증 방법

리뷰 대상 6개 파일(`tree-walk.ts`/`tree-walk.test.ts`/`plan-scan.ts`/`spec-links.ts`/`spec-links.test.ts`/`spec-frontmatter-parse.ts`/`impl-anchor-parse.ts`/`spec-plan-completion.test.ts`)을 저장소 밖 scratch(`/private/tmp/.../scratchpad/mutroot`)에 복제해 실제로 뮤테이션·실행했다. `codebase/frontend/node_modules` 는 절대경로 symlink 로만 참조(비파괴), `spec/`·`plan/`·`.github`·`scripts`·`.claude`·`review`·`codebase/{backend,channel-web-chat,packages}` 는 `repoRoot()` 6단계 상대경로가 올바르게 해석되도록 symlink 로 마운트했다. baseline: **2893 passed**(plan 문서의 주장과 일치). 실제 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/docs-guard-walker`)는 전혀 건드리지 않았다(`git status --short` 로 재확인, `review/code/2026/08/11/13_51_44/` untracked 산출물만 존재).

## 발견사항

- **[INFO]** `walkTree` 의 `path.isAbsolute(base)` 분기가 어떤 테스트로도, 어떤 실제 호출부로도 관측되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:78` (`const dir = path.isAbsolute(base) ? base : path.join(root, base);`)
  - 상세: `bases: string[]` 파라미터가 절대경로도 받도록 명시적으로 분기해 뒀는데, `tree-walk.test.ts` 의 어떤 `it` 도 절대경로 base 를 넘기지 않는다. 실제 호출부 5곳(`impl-anchor-parse.ts:116`, `plan-scan.ts:67`, `spec-frontmatter-parse.ts:89`, `spec-links.ts:160`, `spec-links.ts:332`)도 전부 상대경로 문자열(`"spec"`, `path.join("plan", bucket)` 등)만 넘긴다. 이 삼항연산자를 `path.join(root, base)` 로 단순화하는 뮤턴트를 직접 넣고 전체 docs 스위트(2900 tests, 신규 검증용 테스트 포함)를 돌렸더니 **전량 GREEN** — 관측 지점이 0개라는 뜻이다.
  - 제안: 지금 당장 위험은 없다(죽은 분기가 아니라 "누구도 안 쓰는 옵션"이라 실동작 결함은 아니다). 다만 이 파일 자체가 "필터 차이가 데이터가 그 형태를 갖는 순간에만 드러나 조용히 갈린다"는 문제의식으로 만들어졌으므로, 이 옵션도 같은 원칙을 적용해 fixture 한 줄(`walkTree(absDir, [absDir], {...})` 형태)로 겨누거나, 실제로 아무도 안 쓴다면 옵션 자체를 걷어내는 편이 일관적이다.

- **[INFO]** `matterNoCache` 의 gray-matter 캐시-우회가 `spec-frontmatter-parse.ts` 호출 경로 자체로는 직접 증명되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:99-102` (`parseSpecFile` 내부 `matterNoCache(raw)` 호출)
  - 상세: 캐시-우회 회귀 테스트(`parseFrontmatterSafe(BROKEN)` 을 3회 호출해 매번 `null`을 확인)는 `plan-scan.test.ts` 의 `describe("parseFrontmatterSafe", ...)` 에만 있다. `matterNoCache` 자체가 공유 구현이라 간접적으로는 증명되지만, `spec-frontmatter-parse.ts` 는 `parseFrontmatterSafe` 를 거치지 않고 `matterNoCache` 를 직접 호출하는 별도 경로(자체 try/catch)이므로 그 파일에 대한 직접 fixture는 없다. 코드 주석 자체가 "한쪽이 언젠가 같은 파일을 읽는 순간 조용히 되살아난다"는 잔여 위험을 이미 명시하고 있어 은폐된 갭은 아니다.
  - 제안: 크기가 작으므로 지금 막을 필요는 없다는 판단에 동의하되, 다음에 이 파일을 만질 때 `collectApplicableSpecs` 로 같은 깨진 frontmatter 를 가진 spec 파일 2개를 만들어 둘 다 `parseError` 가 세팅되는지 확인하는 fixture 를 얹으면 닫힌다.

## 지시된 검증 항목별 결과

1. **`tree-walk.test.ts` 10건 무관측 여부** — vacuous 아님, 확인됨.
   - `skipDir` 무력화(`if (options.skipDir?.(...)) continue;` → `if (false) continue;`) → **정확히 8건 RED**: `tree-walk.test.ts` 의 "skipDir 는 그 디렉터리의 하위 전체를 잘라낸다"·"skipDir 는 basename 과 상대경로를 둘 다 받는다"·"collectCodebaseSources — build 산출물 4종 제외"·"collectMdxFiles — `_` 접두는 디렉터리에만 걸린다" 4건 + 기존 실저장소 가드 4건(`plan-scan.test.ts` 3건, `spec-link-integrity.test.ts` 1건). plan 문서가 주장하는 "8건(신규 4 + 기존 4)"과 정확히 일치.
   - `recurse` 옵션 무력화(항상 재귀) → 35건 RED, `tree-walk.test.ts` 자체의 "recurse:false 는 base 자신의 파일만 본다"·"base 여러 개를 한 번에 순회하고..." 2건 포함.
   - `includeFile` 호출 자체를 제거(항상 include) → `tree-walk.test.ts` 9건 전부 포함 총 612건 RED(포함 필터가 사실상 전체 계약의 기반이라 광범위하게 퍼지는 것이 정상).
   - 세 옵션 모두 저장소 밖 scratch 뮤테이션으로 직접 확인했고, 각 뮤테이션이 대응하는 `tree-walk.test.ts` 케이스를 정확히 잡아낸다.

2. **`extractLinks` 사전 필터 캐너리** — 진짜 방어로 확인됨.
   - 필터를 `!text.includes("](")` 단독으로 좁히자(`cannotContainLink` 뮤테이션) `spec-links.test.ts` 의 "인라인 코드 제거로 생기는 링크도 찾는다" **정확히 1건만 RED**, 나머지 11건은 GREEN — 캐너리가 의도한 지점을 정밀하게 잡는다.
   - 필터를 통째로 제거(`if (cannotContainLink(text)) return [];` → `if (false) return [];`)하자 전체 docs 스위트 2893건 **전량 GREEN** — 필터는 순수 성능 최적화이고 링크 검출 계약을 넓히지 않는다는 주장과 일치. 정상.

3. **`NONE_VALUES` 신규 fixture** — 두 뮤턴트 모두 정확히 겨눔.
   - `.trim().toLowerCase()` 제거 → `spec-plan-completion.test.ts` 의 "normalises the `none` vocabulary — case, surrounding space, and the n/a forms" **정확히 1건** RED.
   - `NONE_VALUES` 어휘를 `["none", "없음"]` 으로 축소(`"n/a"`/`"na"` 제거) → 같은 테스트 **정확히 1건** RED.
   - 두 경우 모두 다른 814개 테스트는 영향받지 않음 — 무관측이 해소됐다는 plan 문서의 주장과 일치.

4. **통합이 각 수집기의 대상 파일 집합을 바꾸지 않았는가** — 직접 재현으로 확인됨(단순 grep/추정이 아니라 실행 비교).
   - `git show 75f2e2af9^:...` 로 통합 前(pre) 버전의 `spec-links.ts`/`plan-scan.ts`/`impl-anchor-parse.ts`/`spec-frontmatter-parse.ts` 를 별칭 파일로 scratch 에 나란히 두고, 현재(post) 구현과 **실제 저장소 데이터**로 7개 호출(=`collectSpecMarkdown`·`collectCodebaseSources`·`collectLivePlanMarkdown`·`collectCompletePlanMarkdown`·`collectMdxFiles`×2 호출부·`collectApplicableSpecs`)을 나란히 실행해 `relPath` 배열을 `toEqual` 로 직접 대조했다.
   - **7개 전부 원소·순서까지 byte-identical.** `collectCodebaseSources` 는 `post.length === pre.length === 2082` 로 완전히 동일했다(plan 문서의 "2075→2076" 서술은 `tree-walk.ts` 파일이 아직 디스크에 없던 시점 기준 측정이라 방법론이 다를 뿐, 현재 디스크 상태 기준으로는 차이가 아예 없다는 더 강한 결과).
   - "합치는 김에 맞추는" 것을 의도적으로 하지 않았다고 주장하는 `collectSpecMarkdown` vs `collectApplicableSpecs` 의 카탈로그 처리 비대칭도 `tree-walk.test.ts:161-171`(게이트 기준) fixture 로 정확히 고정돼 있음을 확인했다(합성 트리에서 두 함수가 서로 다른 부분집합을 반환).

5. **놓친 커버리지 갭** — 위 발견사항 2건(둘 다 INFO, 실동작 결함 아님) 외에 추가로 없음.

## 그 외 관찰 (참고, 별도 발견사항 아님)

- `plan-scan.test.ts` 의 fixture 빌더 통합(`fm`/`frontmatter` 두 벌 → 하나)은 실제로 파일 전체에서 `frontmatter` 가 유일 선언인지, 두 번째 선언이 완전히 제거됐는지 `Read` 로 직접 확인했다 — 잔존 없음, `describe("checkPlanFrontmatter", ...)` 와 `describe("findFrontmatterViolations", ...)` 모두 상단의 단일 `frontmatter` 를 그대로 재사용한다.
- 모든 신규/변경 테스트가 `fs.mkdtempSync` 기반 합성 트리 + `beforeAll`/`afterAll` 정리를 쓰고 실제 파일시스템에 대해 동작한다 — mock/stub 이 전혀 없고 실동작과의 괴리 위험이 낮다. 각 `describe` 블록이 자기 temp root 를 따로 만들어 테스트 간 격리도 적절하다.
- `spec-plan-completion.test.ts` 의 `findDanglingSpecImpact`/`hasValidSpecImpact`/`makeSpecExists` 등이 전부 `specExists: (p: string) => boolean` 을 주입받는 구조라 실 파일시스템에 결합되지 않는다 — 테스트 용이성 측면에서 양호(자매 함수 간 패턴도 일관).
- 새 CRITICAL 발견 없음.

## 요약

`tree-walk.ts` 통합과 그에 딸린 `tree-walk.test.ts` 10건은 scratch 환경에서 `skipDir`/`recurse`/`includeFile` 세 옵션을 각각 직접 뮤테이션해 확인한 결과 무관측(vacuous) 없이 정확히 대응하는 테스트를 RED 로 떨어뜨린다. `extractLinks` 사전 필터 캐너리는 순진한 조건으로 좁혔을 때 의도한 1건만 정밀하게 잡아내고, 필터를 통째로 제거해도 전량 GREEN 이라 "성능 최적화가 계약을 넓히지 않는다"는 설계 의도와 정확히 일치한다. `NONE_VALUES` 정규화·어휘 뮤턴트도 신규 테스트 1건만을 정밀하게 잡는다. 가장 무겁게 검증한 "통합이 대상 파일 집합을 바꾸지 않았다"는 주장은 pre/post 구현을 실제 저장소 데이터로 나란히 실행해 7개 수집기 전부 원소·순서까지 완전히 동일함을 직접 재현했다 — 커밋 메시지의 주장이 grep 이 아니라 실행 결과로 뒷받침된다. 발견된 유일한 갭은 `walkTree` 의 절대경로 `bases` 분기가 어떤 테스트·호출부로도 관측되지 않는다는 것(INFO, 실피해 없음)과 `spec-frontmatter-parse.ts` 의 `matterNoCache` 직접 호출 경로에 대한 전용 회귀 fixture 부재(INFO, 이미 주석으로 자체 인지된 잔여 위험)뿐이다.

## 위험도

LOW
