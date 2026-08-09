# 유지보수성(Maintainability) 리뷰

## 범위 요약

본 변경은 26개 파일 중 실제 로직이 있는 파일은 2개뿐이다 — `.claude/docs/plan-lifecycle.md`(문서)와
`codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`(신규 build guard 2종). 나머지
23개 `plan/**/*.md`는 대부분 `status: in-progress` → `status: complete` 1~2줄짜리 기계적 frontmatter
정정이거나 `../complete/<name>` 상대링크 정정으로, 유지보수성 관점에서 다룰 로직이 없다. 아래 발견사항은
실제 코드(`plan-frontmatter.test.ts`)와 그 SoT 문서(`plan-lifecycle.md`)에 집중했다.

### 발견사항

- **[WARNING]** 이미 존재하는 마크다운 링크 스캐너를 재사용하지 않고 더 약한 버전을 새로 만듦 (중복 코드)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:89-99` (`relativeLinkTargets` 함수),
    사용처 `:180-201` (`top-level in-progress plans have no broken relative links`)
  - 상세: 같은 `__tests__/` 디렉터리에 이미 `spec-links.ts`가 마크다운 인라인 링크 추출·존재확인용
    범용 인프라(`extractLinks`, `findBrokenLinksInFiles`, `isExternal`, `SpecMdFile`)를 제공한다.
    그 구현은 (a) fenced code block(````…````)을 `FENCE_RE`/`inFence` 로 추적해 스캔에서 제외하고,
    (b) 타이틀 문법(`(url "title")`)을 처리하며, (c) `http/https/mailto/tel/일반 scheme://` 를
    폭넓게 외부 링크로 인식한다. 반면 신규 `relativeLinkTargets`는 파일 전체 텍스트에 정규식
    `/\[[^\]]*\]\(([^)#]+?)(?:#[^)]*)?\)/g` 를 그대로 돌려 **코드펜스 내부도 스캔 대상에 포함**하고,
    외부 링크 판정도 `/^(https?:|mailto:|<)/` 로 더 좁다.
    실측: `plan/in-progress/spec-fix-swagger-forbidden-response.md` 안에 예시용 \`\`\`markdown\`\`\`
    펜스 블록으로 `[1-auth.md §3.3](../../spec/5-system/1-auth.md)` 같은 실제 마크다운 링크가
    들어있는데, 새 정규식은 이를 실제 링크로 취급해 존재 확인까지 수행한다. 이번엔 우연히 경로가
    실재해 통과했지만, 다음에 누군가 "Before/After" 예시 스니펫에 존재하지 않는 예시 경로를 적으면
    (흔한 문서 작성 패턴) 이 신규 가드가 오탐(false positive)으로 push 를 막는다 — `findBrokenLinksInFiles`
    를 재사용했다면 애초에 발생하지 않았을 클래스의 버그다.
  - 제안: `relativeLinkTargets` + 인라인 존재확인 루프를 걷어내고, `spec-links.ts` 의
    `findBrokenLinksInFiles(files, { checkSelfAnchors: false })` 를 `plans`(top-level in-progress
    plan 목록)에 대해 그대로 재사용한다. `SpecMdFile[]` 로 변환하는 어댑터 몇 줄이면 충분하며, 펜스
    제외·타이틀 처리 등을 공짜로 얻고 두 스캐너가 서로 다른 동작을 하는 유지보수 부담을 없앤다.

- **[INFO]** 상대경로 변환 1줄이 같은 파일 안에서 두 번 인라인됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:184`, `:217`
  - 상세: `path.relative(root, abs).split(path.sep).join("/")` 가 "top-level in-progress plans have
    no broken relative links" 테스트와 "no completed plan still declares…" 테스트에 각각 인라인돼
    있다. `spec-links.ts` 의 `SpecMdFile.relPath` 가 이미 이 계산을 캡슐화한 선례라, 위 WARNING 항목과
    같은 재사용 기회를 놓친 결과다.
  - 제안: 로컬 헬퍼(`const relOf = (abs: string) => path.relative(root, abs).split(path.sep).join("/")`)
    로 한 번만 선언하거나, WARNING 항목처럼 `spec-links.ts` 인프라를 재사용하면 자연히 해소된다.

- **[INFO]** 디렉터리 순회 방식이 인접 파일과 다른 패턴을 씀 (일관성)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:61-77` (`collectCompletedPlans`
    의 내부 `walk`)
  - 상세: 같은 리뷰 세션이 근거로 삼는 `spec-links.ts`의 `collectSpecMarkdown`/`collectCodebaseSources`
    는 명시적 stack(`while (stack.length > 0)`) 기반 반복 순회를 쓰는데, 신규 `collectCompletedPlans`
    는 재귀 클로저(`const walk = (d) => { … walk(full) … }`)를 쓴다. `plan/complete/` 깊이가 얕아
    스택 오버플로 위험은 없지만, 같은 "마크다운 트리 수집" 문제에 대해 같은 코드베이스 영역 안에
    서로 다른 두 관용구가 공존하게 된다.
  - 제안: 필수는 아니나, 재사용(WARNING 항목)을 택하면 이 divergence 자체가 사라진다. 유지한다면
    기존 stack 기반 관용구를 따르는 편이 일관적이다.

- **[INFO]** vacuity guard 임계값이 이름 없는 매직 넘버
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:194`
    (`expect(checked, …).toBeGreaterThan(50)`), `:211` (`expect(completed.length, …).toBeGreaterThan(20)`)
  - 상세: 두 값 모두 "탐지 로직이 죽으면 이 단언이 영원히 vacuous 하게 통과하는 것을 막는다"는 목적은
    주석으로 잘 설명돼 있으나, 왜 하필 50/20 인지(실측 카운트 대비 여유값 등)는 남아있지 않다. 이
    저장소의 기존 vacuity guard 관용구(다른 가드 파일들도 유사 패턴을 씀)와 일관되므로 큰 문제는
    아니다.
  - 제안: 급하지 않음. 필요하면 `const MIN_EXPECTED_LINKS = 50;` 처럼 이름을 붙여 실측 근거를
    변수명/주석에 한 번 더 앵커링해도 좋다.

- **[INFO]** `.claude/docs/plan-lifecycle.md` 신규 절 — 가독성·기존 스타일 정합
  - 위치: `.claude/docs/plan-lifecycle.md:79-90`
  - 상세: 기존 §4 불릿 목록의 "**굵은 키 문구** + 설명 + `>` 인용 rationale" 패턴을 그대로 따르고,
    코드(`TERMINAL_STATUSES`, `plan-frontmatter.test.ts`)와 문구가 정확히 대응해 문서-구현 drift가
    없다. 특별한 개선점 없음 — 긍정 확인 차원에서 기록.

### 요약

이번 diff 는 사실상 문서/plan 정리 성격이 짙고, 유지보수성 관점에서 검토할 실질 코드는
`plan-frontmatter.test.ts` 에 신설된 두 build guard(`completed plans declare a terminal status`,
`top-level in-progress plans have no broken relative links`)뿐이다. 이 두 가드 자체는 함수가
짧고(모두 20줄 이내), 네이밍이 기존 컨벤션(`collectTopLevelPlans`↔`collectCompletedPlans`,
`ISO_DATE`/`WORKTREE_SENTINEL`↔`TERMINAL_STATUSES`)과 잘 맞고, 중첩도 얕으며, 주석이 "왜"를 충실히
설명해 가독성이 좋다. 다만 핵심 약점 하나가 있다 — 같은 `__tests__/` 디렉터리에 이미 존재하는, 코드펜스
제외까지 포함한 더 견고한 마크다운 링크 스캐너(`spec-links.ts`)를 재사용하지 않고 더 약한 정규식
기반 스캐너를 새로 만들었다(WARNING). 이는 지금 당장 실패를 일으키진 않지만, 향후 plan 문서에
예시용 마크다운 코드펜스가 늘어나면 오탐으로 push 를 막을 수 있는 잠재적 유지보수 부채다. 나머지 21개
`plan/*.md` 파일은 1~2줄짜리 frontmatter 필드 교정으로 유지보수성 이슈가 없다.

### 위험도

LOW
