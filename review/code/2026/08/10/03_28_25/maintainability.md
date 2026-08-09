# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 디렉터리 트리 워커(stack 기반 DFS + 필터 + sort)가 3벌로 중복 — 이 PR 이 스스로 지목한 "walker 중복" 문제를 절반만 해소
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:53` (`walkPlanMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:132` (`collectSpecMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:335` (`collectCodebaseSources`)
  - 상세: 세 함수 모두 `const stack = [root]; while (stack.length > 0) { const cur = stack.pop()!; for (const e of fs.readdirSync(cur, { withFileTypes: true })) { ... if (e.isDirectory()) { (스킵 판정) stack.push(full) } else if (파일 확장자/필터) { out.push({absPath, relPath}) } } } out.sort((a,b)=>a.relPath.localeCompare(b.relPath));` 골격을 거의 그대로 반복한다. 차이는 스킵 디렉터리 판정(`archive` 단일 이름 vs `CODEBASE_SKIP_DIRS` Set vs 없음)과 파일 필터(`isLifecyclePlan` vs `.md` vs `.ts`/`.tsx`)뿐이다. `plan-scan.ts` 파일 헤더 주석(1~25행)이 "walker 가 저장소에 네 벌 있었고 서로 조용히 어긋났다"를 이 PR 의 존재 이유로 명시하면서도, 정작 `spec-links.ts` 의 두 walker 는 통합 대상에서 제외돼 있다(주석은 "그중 둘"만 합쳤다고 명시하므로 의도된 축소 범위이긴 하나, 남은 중복이 같은 실패 패턴 — 스킵 조건이 손으로 세 곳에 따로 박혀 있어 향후 하나만 고치면 다시 어긋난다 — 을 그대로 갖고 있다).
  - 제안: `walkFiles(roots: string[], opts: { skipDir?: (name: string) => boolean; include: (fullPath: string) => boolean })` 형태의 공유 헬퍼로 셋을 통일하거나, 최소한 이번 PR 범위 밖이라면 `plan-scan.ts` 헤더 주석에 "spec-links.ts 의 두 walker 는 아직 미통합"이라고 명시해 향후 오독(이미 다 합쳤다고 읽힘)을 막는다.

- **[WARNING]** `findBrokenPlanLinks` JSDoc 이 이 PR 자신이 명시한 "코드 주석은 현재 규칙만 담는다" 컨벤션을 정면으로 위반 — 날짜·건수가 박제된 회고 서사
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:280`~`296` (`findBrokenPlanLinks` JSDoc 의 "Measured 2026-08-09/10" 단락)
  - 상세: 같은 리뷰 대상인 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:38`~`39` 는 "이 가드가 잡는 실패의 이력은 커밋 메시지와 `plan/complete/` 산출물을 볼 것 — 코드 주석은 **현재 규칙**만 담는다(ai-review 가 회고 서사 누적을 지적)" 라고 이 changeset 스스로 규약을 못박는다. 그런데 바로 옆 파일의 `findBrokenPlanLinks` JSDoc 은 "This guard sees 8: seven of the move case ... plus one stale #anchor", "A 9th was fixed by hand", "the first draft of this comment said '9 measured'", "`plan/complete/**` 는 135 broken links" 처럼 특정 시점 측정치·리뷰 수정 이력·"초안이 뭐라고 썼었는지"까지 코드 주석에 영구 박제했다. 이 숫자들(`8`/`135`/`9th`)은 plan 트리가 grooming 으로 계속 변하므로 곧 stale 해지고, 미래 독자는 이를 살아있는 불변식으로 오독할 위험이 있다.
  - 제안: 측정 서사(측정 날짜·건수·초안 대비 수정 이유)는 PR 설명/커밋 메시지 또는 `plan/complete/` 산출물로 옮기고, JSDoc 은 "무엇을(top-level in-progress 링크), 왜 좁게(스코프 근거), 어떤 예외(`checkSelfAnchors: false` 이유)"만 남긴다 — `TERMINAL_PLAN_STATUSES` 독스트링(plan-scan.ts:92~99)이 이미 그 절제된 톤의 좋은 예시다.

- **[INFO]** 거의 동일한 frontmatter 픽스처 빌더 두 개가 한 테스트 파일에 공존
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:28` (`fm`), `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:192` (`frontmatter`)
  - 상세: `fm(status?)` 은 `title: t` 고정 + 선택적 `status` 한 줄을 조립하고, `frontmatter(fields)` 은 임의 필드 map 을 조립한다. 두 함수 모두 `["---", ..., "---", "", "# Doc", ""].join("\n")` 골격이 동일하다. `fm` 은 `frontmatter({ title: "t", ...(status !== undefined ? { status } : {}) })` 로 대체 가능해 보인다.
  - 제안: 하나로 통합하거나, 통합하지 않을 경우 두 헬퍼의 관계(왜 별도인지)를 한 줄 주석으로 남겨 다음 편집자가 "이미 있는 헬퍼를 못 찾고 세 번째를 또 만드는" 상황을 예방한다. 우선순위는 낮음 — 각 `describe` 블록 내부에서만 쓰이는 로컬 헬퍼라 영향 범위가 좁다.

- **[INFO]** `checkPlanFrontmatter` 내 "비어있지 않은 문자열" 판정이 두 곳(worktree/owner)에서 반복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:234`~`236` (worktree), `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:249`~`251` (owner)
  - 상세: `typeof v !== "string" || v.length === 0` 판정이 두 번 나온다. worktree 쪽만 추가로 placeholder 검사가 붙어 완전한 중복은 아니다.
  - 제안: 함수 전체가 50줄 내외로 짧고 각 분기가 `add()` 호출 한 줄로 끝나 가독성 손실이 크지 않으므로 필수는 아니다. 세 번째 필수 필드가 추가되는 시점에는 `requireNonEmptyString(data, key, kind)` 같은 소헬퍼 추출을 고려.

- **[INFO]** `slugify` 와 `headingSlugs` 가 "마크다운 파싱 → heading 노드 수집" 보일러플레이트를 반복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:42`~`48` (`slugify`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:51`~`70` (`headingSlugs`)
  - 상세: 둘 다 `fromMarkdown` → `collectHeadings(tree, headings)` 호출을 각자 인라인한다. 로직 자체는 짧아 위험도는 낮음.
  - 제안: `parseHeadings(text: string): Heading[]` 소헬퍼로 추출하면 두 함수가 "무엇을 하는지"만 남아 약간 더 읽기 쉬워진다. 필수는 아님.

## 요약

전반적으로 문서화 밀도가 매우 높고(모든 비자명한 분기·정규식·엣지케이스에 근거 주석이 붙어 있음), 함수 대부분이 짧고 단일 책임을 지키며, 매직 넘버는 거의 전부 인접 주석으로 근거가 달려 있어 유지보수성이 양호한 편이다. 다만 두 가지는 실질적으로 짚을 만하다 — (1) `plan-scan.ts`/`spec-links.ts` 사이에 걸친 디렉터리 트리 워커 로직 3중 복제가, 정작 이 PR 이 스스로 "walker 중복이 조용히 어긋나는 문제"라고 명시한 동기와 정면으로 부딪힌다(의도된 축소 범위이긴 하나 헤더 주석에서 그 경계가 더 명확했으면 함). (2) `findBrokenPlanLinks` JSDoc 이 같은 changeset 의 다른 파일이 스스로 못박은 "코드 주석은 현재 규칙만, 회고 서사는 커밋/산출물로" 컨벤션을 정면으로 위반해, 곧 stale 해질 측정 건수를 코드에 영구 박제했다. 나머지는 INFO 수준의 소소한 헬퍼 중복으로 시급성은 낮다.

## 위험도
LOW
