# 유지보수성(Maintainability) Review

DRY 리팩터링 PR — 손수 짠 DFS 여섯 벌을 `walkTree` 하나로 통합. 전체적으로 설계 의도가
문서화(주석·plan 문서)와 잘 맞물려 있고, 뮤테이션 근거·집합 대조 등 검증 흔적도 충실하다.
지시받은 5개 관점 + 일반 체크리스트를 순서대로 짚는다.

### 발견사항

- **[WARNING]** `walkTree` 에 어떤 호출부도 쓰지 않는 "절대경로 base" 분기가 미검증 상태로 들어갔다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:78` (`const dir = path.isAbsolute(base) ? base : path.join(root, base);`)
  - 상세: 6개 호출부(`plan-scan.ts:67`, `spec-links.ts:160`·`332`, `spec-frontmatter-parse.ts:89`, `impl-anchor-parse.ts:116`, 그리고 `tree-walk.test.ts` 전체)를 확인했지만 전부 `bases` 에 `root` 기준 **상대** 세그먼트(`"spec"`, `"plan/in-progress"`, `CODEBASE_SOURCE_ROOTS` 등)만 넘긴다(`grep -rn "walkTree("` 로 전수 확인). `path.isAbsolute(base)` 분기는 어느 테스트에서도 참이 되지 않는다 — 이 저장소가 반복해서 스스로 지적해 온 "뮤테이션으로 발각되는 도달 불가 분기"(예: 같은 PR `plan-scan.ts:442` 의 `isFile()` 주석, `spec-plan-completion.test.ts` 의 빈 문자열 검사)와 정확히 같은 형태다. 게다가 이 분기가 실제로 쓰이면 `rel(full) = path.relative(root, full)` 가 `root` 밖을 가리켜 `../` 를 포함한 `relPath` 를 만들 수 있는데, 이는 JSDoc 이 명시한 계약("relPath 는 항상 root 기준")과 walkTree 자신의 헤더/plan 문서가 강조하는 "여섯 호출부를 정확히 표현한다"는 설계 목표에도 어긋난다.
  - 제안: 지금 6개 호출부 중 실제로 절대경로 base 가 필요한 곳이 없다면 이 분기를 제거해 `path.join(root, base)` 로 단순화하거나, 정말 필요하다면 그 필요를 만든 실제 호출부와 함께 도입하고 `tree-walk.test.ts` 에 양성 fixture 를 추가한다.

- **[WARNING]** "`_` 접두 = 디렉터리 vs 파일명" 규칙 차이 설명이 4곳에 거의 동일한 문장으로 중복돼 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:9-12` (헤더 주석) / `codebase/frontend/src/lib/docs/__tests__/impl-anchor-parse.ts:107-114` (`collectMdxFiles` JSDoc) / `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts:181-183` (테스트 주석) / `plan/in-progress/docs-guard-walker-dedup.md:167-176`
  - 상세: 네 자리 모두 "`plan-scan.ts` 는 `_` 를 파일명에, `impl-anchor-parse.ts` 는 디렉터리명에 적용한다"는 같은 사실을 각자의 문장으로 반복 서술한다. 이 저장소 자체가 memory 에 "리뷰어 위치 인용을 소스 라인에 고정"류의 SoT 원칙을 여러 번 강조해온 만큼, 같은 설명이 네 곳에 흩어지면 나중에 규칙이 바뀔 때(예: `plan-scan.ts` 의 인덱스 면제 범위가 넓어지는 경우) 한두 곳만 고치고 나머지가 stale 로 남을 위험이 실재한다. 코드 자체의 가독성 문제는 아니지만, "이 PR 이 고치려던 것"(조용히 갈리는 문서화되지 않은 규칙)과 같은 계열의 위험을 새 코드에 다시 만든 형태다.
  - 제안: `tree-walk.ts` 헤더를 SoT 로 삼고, `impl-anchor-parse.ts`/`tree-walk.test.ts` 주석은 "왜"를 재서술하지 말고 그쪽을 가리키는 한 줄 참조로 축약한다.

- **[INFO]** `impl-anchor-parse.ts` 의 `collectMdxFiles` JSDoc 이 함수 본문보다 훨씬 길다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/impl-anchor-parse.ts:107-114` (JSDoc 8줄) vs `115-120` (함수 본문 5줄)
  - 상세: 이 저장소가 이미 "주석 비대화 경향"으로 직전 PR 에서 지적받았다는 전제가 있는데, 이 JSDoc 은 위 항목의 중복 설명을 포함해 실질 정보 밀도가 낮다. `tree-walk.ts:100` 전체를 봐도 comment/blank/code 비율이 대략 51/6/44(줄 수 기준, 스크립트로 실측)로 코드보다 주석이 많다 — 다만 `walkTree` 자체의 JSDoc(라인 60-66)은 34줄 구현에 대해 7줄로 비율이 합리적이라 이 파일 전체가 "과하다"기보다는 헤더 주석(24줄, 히스토리 서술)과 위 중복 JSDoc 이 비중을 끌어올리는 구조다.
  - 제안: `collectMdxFiles` JSDoc 은 위 WARNING 처리와 함께 2-3줄로 축약 가능. `tree-walk.ts` 헤더의 "왜 모으나"/"무엇을 안 모았나" 절은 유지하되(공유 유틸의 헌법적 문서로서 가치가 있음), plan 문서와의 중복 서술은 plan 쪽을 요약으로 남기고 코드 헤더를 SoT 로 삼는 편이 낫다.

- **[INFO]** Gate C 판정 8개 함수가 `plan-scan.ts` 로 옮겨오면서 파일이 449줄까지 커졌고, 세 가지 결이 다른 책임(디렉터리 순회 / frontmatter 3필드 필수값 검사 / Gate C `spec_impact` 판정)이 한 파일에 모였다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:39-82`(순회) / `:196-331`(frontmatter 3필드) / `:333-449`(Gate C, 섹션 구분 주석 `:333-343`)
  - 상세: 세 책임 모두 "plan frontmatter 를 검증한다"는 상위 주제로는 묶이고, `rawScalar`/`isIsoDate`/`parseFrontmatterSafe`/`collectCompletePlanMarkdown` 같은 하위 유틸을 실제로 공유하므로 억지 결합은 아니다. 이동 이유(테스트 파일 밖에서 재사용 가능해야 함)도 섹션 구분 주석(`:334-343`)과 plan 문서(`docs-guard-walker-dedup.md` "판정이 선행돼야 하는 것" 항목)에 명확히 남아 있다. 다만 파일이 이 PR 전보다 눈에 띄게 커졌고(Gate C 블록만 ~120줄, 전체의 27%), 향후 또 한 벌의 판정군이 추가되면 응집도 재검토가 필요해질 수 있는 크기다. 지금 당장 분리를 요구할 수준은 아니라고 판단해 INFO 로 남긴다.
  - 제안: 당장 조치 불필요. 다음에 이 파일에 새 판정군을 추가할 일이 생기면 `plan-scan.ts`(순회+파싱) / `plan-frontmatter-checks.ts`(3필드) / `gate-c.ts`(spec_impact) 분리를 고려할 시점으로 표시해 둔다.

- **[WARNING]** `SpecMdFile` 을 "외부 호출부가 6곳이라 한 번에 못 바꾼다"는 근거로 `@deprecated` 별칭으로 남겼는데, 실측하면 외부 소비처가 0곳이다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:141-149` (`export type SpecMdFile = MdFileRef;`), 유일한 내부 사용처 `:196` (`findBrokenLinksInFiles(files: SpecMdFile[], ...)`)
  - 상세: `grep -rln "SpecMdFile" codebase/` 로 전수 확인하면 이 타입을 **import** 하는 파일이 이 저장소 어디에도 없다(`grep -rn "import.*SpecMdFile"` 결과 0건). `plan-scan.ts`/`tree-walk.ts` 의 주석이 `SpecMdFile` 을 언급하는 것은 전부 텍스트 설명이지 타입 참조가 아니다. 즉 이번 PR 이 `collectSpecMarkdown`/`collectCodebaseSources` 반환 타입을 이미 `MdFileFef` 로 바꿨기 때문에, "외부 호출부를 한 번에 못 바꿀 때를 위한 별칭"이라는 JSDoc 의 정당화 근거가 이 PR 자체가 만든 상태와 어긋난다 — 실제로는 파일 내부의 `findBrokenLinksInFiles` 파라미터 타입 하나만 이 별칭을 쓴다.
  - 제안: `findBrokenLinksInFiles` 의 파라미터 타입을 `MdFileRef[]` 로 바꾸고 `SpecMdFile` 자체를 삭제한다(질문에서 제시한 "호출부가 6곳뿐이니 완전히 지우는 게 나은가"에 대한 답 — 실측상 6곳이 아니라 0곳이므로 지우는 쪽이 명백히 낫다). 유지해야 할 이유가 생기면 그때 다시 별칭을 만들면 된다.

- **[INFO]** `WalkOptions` 세 축(`skipDir`/`includeFile`/`recurse`) 자체는 6개 호출부를 억지 없이 자연스럽게 표현한다. `includeFile(name, relPath)` 이 두 인자를 받는 것도 정당하다 — `isLifecyclePlan`/`.endsWith(".mdx")` 류는 basename 이, `isApplicable(relPath)`/`inGeneratedCatalog(relPath)` 류는 relPath 가 필요해서 실제로 6개 호출부 중 절반씩 각 인자를 쓴다(`tree-walk.test.ts:72-83`의 "basename 과 relPath 를 둘 다 받는다" 테스트가 이를 고정). 하나로 통일했다면 호출부가 `path.basename` 을 다시 부르거나 `relPath.includes` 로 뭉개는 역행이 생겼을 것이다. 이 부분은 과도한 추상화도 부족한 추상화도 아니라고 판단한다.

- **[INFO]** 긍정 요소: `plan-scan.test.ts` 의 `fm`/`frontmatter` fixture 빌더 중복 제거(파일 서두가 "walker 중복"을 경계하면서 자기 fixture 가 두 벌이었던 자기모순을 해소), `danglingSpecImpact` → `findDanglingSpecImpact` 개명(클러스터 내 `find*` = "위반 배열 반환" 컨벤션과 일치화), gray-matter 캐시 우회 관용구를 `matterNoCache` 단일 진입점으로 모은 것은 모두 이 리뷰 관점(네이밍 일관성·중복 제거)에서 명확한 개선이다.

새 CRITICAL 은 없다.

### 요약

핵심 설계(`walkTree` + `WalkOptions` 3축)는 6개 호출부를 실측 기반으로 파라미터화한 결과라 억지스러운 추상화 없이 잘 들어맞고, fixture 소비처 배선까지 `tree-walk.test.ts` 로 양성 검증돼 있어 통합 자체의 유지보수성은 높다. 다만 세부에서 이 PR 스스로가 경계하는 문제(뮤테이션 미검증 도달-불가 분기, 근거가 실측과 어긋난 채 남은 deprecated 별칭, 같은 설명의 다자리 중복)를 소규모로 재생산했다 — 전부 WARNING/INFO 급이며 CRITICAL 은 없다. `plan-scan.ts` 로의 Gate C 이동은 근거가 문서화돼 있고 지금 크기에서는 응집도가 유지된다고 보되, 파일이 449줄까지 커진 점은 다음 확장 시점에 재검토할 표식으로 남겨 둔다.

### 위험도

LOW

STATUS: OK
