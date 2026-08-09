### 발견사항

- **[WARNING]** 디렉터리 트리 순회(walker) 로직이 3곳에 각각 다른 형태로 중복 구현됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:130-150` (`collectSpecMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:345-369` (`collectCodebaseSources`), `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:55-71` (`collectCompletedPlans`)
  - 상세: `collectSpecMarkdown`(130-150)과 `collectCodebaseSources`(345-369)는 스택 기반 DFS 로 디렉터리를 순회하며 파일을 수집하는 거의 동일한 구조(root 존재 확인 → `stack.pop()` → `readdirSync(withFileTypes)` → 디렉터리면 push / 파일이면 확장자·필터 검사 후 push → 마지막에 `relPath` 로 정렬)를 가진다. 차이는 순회 대상(단일 vs 다중 root)과 skip/match 판단(제너레이티드 카탈로그 제외 vs `node_modules`/`dist` 류 제외, `.md` vs `.ts`/`.tsx`) 뿐이다. `plan-frontmatter.test.ts`의 `collectCompletedPlans`는 같은 목적(마크다운 파일 재귀 수집)을 재귀 클로저(`walk`)로 세 번째 방식으로 구현한다.
    이 PR/파일들의 주석 자체가 "스캔 소스는 하나여야 한다 — 종전에 손으로 재구현한 사본이 필터에서 조용히 어긋났다"(`plan-frontmatter.test.ts:46-49`, `spec-links.ts:270-274`)는 교훈을 명시적으로 남기고 있는데, 정작 `spec-links.ts` 안에 구조적으로 동일한 워커가 두 벌, `plan-frontmatter.test.ts`에 세 번째 변종이 남아 있어 같은 종류의 drift 위험(skip-dir 목록이나 확장자 필터가 한쪽만 갱신되는 사고)이 재발할 수 있는 지점이다.
  - 제안: 공용 `walkFiles(roots: string[], { skipDir, matchFile })` 같은 저수준 헬퍼로 추출하고, `collectSpecMarkdown`/`collectCodebaseSources`/`collectCompletedPlans`가 그 위에서 predicate 만 다르게 주입하도록 통합하면 향후 filter 변경이 한 곳에서만 이뤄진다.

- **[INFO]** 동일 개념(디렉터리 엔트리)에 대한 루프 변수 네이밍이 파일 내에서 `e` / `entry` 로 혼용됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:551` (`collectLivePlanMarkdown` — `e`) vs `spec-links.ts:137` (`collectSpecMarkdown` — `entry`), `spec-links.ts:353` (`collectCodebaseSources` — `entry`)
  - 상세: 같은 파일 안에서 `fs.Dirent` 순회 변수명이 함수마다 `e`/`entry`로 갈려 있어 미세하지만 일관성이 떨어진다.
  - 제안: 한 파일 내에서는 동일 개념에 동일 이름(예: `entry`)을 쓰도록 통일.

- **[INFO]** `findBrokenLinksInFiles`가 self-anchor 처리 / cross-file DEAD 처리 / cross-file ANCHOR 처리를 한 함수 안에서 모두 담당해 함수 하나의 분기 수가 많음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 함수 `findBrokenLinksInFiles` (약 181-252)
  - 상세: 이중 for 루프 내부에 `target.startsWith("#")` 분기, `isExternal` 조기 종료, `targetFilter` 적용, `fs.existsSync` 체크, `.md` 확장자일 때만 ANCHOR 체크 등 5~6개의 개별 조건이 순차적으로 쌓여 있다. 함수 상단 주석이 "두 공개 진입점은 옵션 두 개만 다르다"고 명시하며 의도적으로 공유시킨 설계라는 근거는 있지만, 현재 형태는 순환 복잡도가 다소 높아 새로운 케이스(예: 세 번째 violation 종류) 추가 시 이 함수를 더 읽기 어렵게 만들 여지가 있다.
  - 제안: `resolveSelfAnchorViolation(link, file, options)` / `resolveCrossFileViolation(link, file, options, slugsFor)` 같은 이름의 서브 헬퍼로 두 갈래를 분리하면 각 분기의 책임이 명확해진다. (현재 리스크는 낮음 — 주석의 설계 의도가 명확하고 파일 전체가 테스트 픽스처로 잘 커버됨.)

- **[INFO]** `toBeGreaterThan(20)` 임계값이 과거 정확히 실패했던 것과 같은 종류의 하드코딩된 매직 넘버 패턴을 재사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:192` (`expect(completed.length, ...).toBeGreaterThan(20)`)
  - 상세: 파일 상단 주석(라인 92-94)이 "종전 `> 20` 이 grooming 후 정확히 20 이 되어 발화했다"는 과거 사고를 직접 언급하며 `plans.length`(in-progress) 쪽 임계값은 `5`로 낮춰 그 문제를 피했다. 그런데 바로 아래 `completed.length` 쪽 non-vacuity 체크는 같은 매직 넘버 `20`을 그대로 재사용한다. `complete/`는 단조 증가하는 컬렉션이라 현재로선 위험이 낮지만, 과거 사고와 동일한 형태의 하드코딩이라는 점에서 재발 여지를 남긴다.
  - 제안: 여유 있는 낮은 하한(예: `5`)으로 통일하거나, "discovery 가 죽었는가"만 판별하려는 의도를 살려 임계값 자체를 이름 있는 상수로 뽑아 두 검사가 같은 상수를 참조하게 하면 의도가 더 명확해진다.

### 요약

전반적으로 코드 가독성과 네이밍은 양호하며, 특히 각 함수/파일 상단에 "왜 이렇게 짰는가"를 설명하는 주석이 충실해 의도 파악이 쉽다. 다만 이 변경분의 핵심 목표가 "동일 순회 로직의 중복을 없애 drift 를 막는 것"이었음에도, `spec-links.ts` 안에 구조적으로 거의 동일한 디렉터리 워커가 두 벌(`collectSpecMarkdown`/`collectCodebaseSources`) 남아 있고 `plan-frontmatter.test.ts`에 세 번째 변종(`collectCompletedPlans`)이 존재해, 파일 자신이 경고하는 "두 곳이 조용히 틀어진다" 패턴이 완전히 해소되지 않았다. 이 외 발견사항(루프 변수명 혼용, 함수 하나의 분기 수, 매직 넘버 재사용)은 모두 낮은 심각도이며 즉각적인 유지보수 리스크는 크지 않다.

### 위험도
LOW
