# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `repoRoot` JSDoc 의 "같은 파일" 지시어가 실제로는 다른 파일을 가리킨다 (교차 파일 주석 오류)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:33`
  - 상세: `repoRoot` 의 JSDoc 이 "`startDir`/`exists` 주입은 **같은 파일** `discoverWorkspaceDirs(readLines)` 와 **대칭**이다" 라고 적는다. 그러나 `discoverWorkspaceDirs` 는 `_shared.ts` 가 아니라 형제 파일 `typescript-toolchain-guard.ts` 에 정의돼 있다(diff 파일 5, `discoverWorkspaceDirs` 정의부 참고). 이 PR 이 두 파일을 나란히 리팩터하면서 원래 "형제 파일" 관계였던 것을 "같은 파일" 로 잘못 서술한 것으로 보인다. 대조로, 같은 PR 의 `typescript-toolchain-guard.ts` 쪽 `discoverWorkspaceDirs` JSDoc(파일 5, gate 135-136: `readLines` 주입은 같은 파일의 `expandWorkspaceGlobs(readDir)` · `typescriptDecls(readManifest)` 와 같은 규약이다")은 실제로 같은 파일 내 대상을 가리키므로 정확하고, `shared.test.ts` 헤더(파일 4, gate 13)도 "같은 PR" 이라고만 적어 정확하다 — `_shared.ts` 한 곳만 "같은 파일" 로 잘못 좁혀 썼다.
  - 제안: "같은 파일" → "형제 모듈 `typescript-toolchain-guard.ts` 의" 로 정정. 향후 독자가 `_shared.ts` 안에서 `discoverWorkspaceDirs` 를 찾다가 못 찾는 혼동을 막을 수 있다.

- **[INFO]** `repo-guards/__tests__/` 디렉터리에 구조 개요 문서가 없다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/` (디렉터리 전체 — `_shared.ts`, `internal-package-registration-guard.ts`, `internal-package-registration.test.ts`, `shared.test.ts`, `typescript-toolchain-guard.ts`, `typescript-toolchain.test.ts` 6개 파일)
  - 상세: 이번 PR 로 "가드 2개 + 공유 프리미티브 모듈 1개 + 대응 테스트 3개"라는 6-파일 구조가 확정됐다. 각 파일 헤더 주석이 개별적으로는 잘 설명하고 있지만(특히 `_shared.ts` 헤더가 "여기 두는 기준"을 명문화), 이 디렉터리에 처음 들어오는 사람이 "가드 추가 시 어디에 뭘 둘지"를 한눈에 파악할 진입점(README 또는 최상위 인덱스 주석)은 없다. 각 파일이 서로를 텍스트로 참조("형제 가드", "중립 모듈")하는 방식이라 탐색은 가능하지만 지도가 없다.
  - 제안: 필수는 아니다 — 현재도 각 헤더가 상호 참조로 충분히 항해 가능하다. 가드가 3개 이상으로 늘어나는 시점에는 짧은 `__tests__/README.md`(또는 `_shared.ts` 헤더 확장)로 "신규 가드 추가 시 결정 트리(무엇을 `_shared` 에 둘지)"를 한 곳에 모으는 것을 고려할 만하다.

- **[INFO]** CHANGELOG·spec·PROJECT.md 업데이트 불필요 — 확인 완료
  - 위치: N/A (변경 없음 확인)
  - 상세: 이번 변경은 순수 내부 테스트 인프라 리팩터(가드 파서 소유권 이관, fail-closed 검증을 순수 함수로 분리)이며 사용자 대면 기능·API·설정이 없다. `CHANGELOG.md` 의 기존 항목은 전부 spec 섹션을 인용하는 제품 변경이라(예: §3.2, §7.5.1 등) 이 패턴과 맞지 않는다. `spec/` 에도 `repo-guards` 참조가 없어 spec 동기화 대상이 아니다. `PROJECT.md` 는 `typescript-toolchain.test.ts` 파일 경로만 참조하며 이번 diff 로 그 경로나 가드의 외부 계약(검증 목적)이 바뀌지 않아 갱신 불필요.

## 요약

전반적으로 문서화 품질이 매우 높다. 신설 파일 `_shared.ts` 는 "왜 생겼는지"(소유권 분리, 파서 중복 방지)를 헤더에 명문화했고, "여기 두는 기준"까지 규칙으로 남겼다. `internal-package-registration-guard.ts`·`typescript-toolchain-guard.ts` 양쪽 헤더도 새 의존 관계(`_shared.ts`)를 반영해 갱신됐고, `missingCompilerApi` JSDoc 은 이전 리뷰가 지적한 모호한 서술("이 경로")을 실제 분기로 명확히 정정했다. 테스트 파일들의 인라인 주석은 각 단언이 왜 필요한지(#968 클래스 회귀, 뮤테이션 실측으로 사각지대 발견 등)를 구체적으로 근거를 대며 설명하고, `plan/in-progress/typescript-toolchain-followups.md` 는 본문 실측 절과 체크리스트가 서로 어긋나지 않게 동기화됐다. 유일한 결함은 `_shared.ts` 의 `repoRoot` JSDoc 이 `discoverWorkspaceDirs` 를 "같은 파일" 대상으로 잘못 지시하는 것(실제로는 형제 파일 `typescript-toolchain-guard.ts`)으로, 사소하지만 실제로 틀린 서술이라 정정이 필요하다.

## 위험도

LOW
