# Code Review 통합 보고서 — typescript-toolchain-followups §1·§2·§4

- 대상: `claude/typescript-toolchain-followups` (4커밋) · diff-base `origin/main`
- 변경 6파일 — `codebase/frontend/src/lib/repo-guards/__tests__/` 5개 + plan 1개
- 본 세션은 **수렴 라운드(R4)** 다. R1~R3 의 발견과 조치 이력은 아래 §라운드 추이.

## 전체 위험도

**LOW** — Critical 0 · WARNING 0 · INFO 3.

## Critical / Warning

없음.

## 참고 (INFO)

| # | reviewer | 발견사항 | 조치 |
|---|----------|----------|------|
| 1 | documentation | `loadTypescriptFrom` 의 반환 타입 변경 근거가 JSDoc 블록이 아니라 별도 `//` 주석이라 IDE hover 에 안 뜬다 | 조치 불요 — 그 주석은 **왜 `unknown \| null` 을 버렸는가**라는 리팩터 이력이지 호출자가 알아야 할 계약이 아니다. 계약(미설치 시 `null`)은 바로 위 JSDoc 에 있다 |
| 2 | requirement | 이 harness/CI 가드 코드를 규정하는 `spec/` 문서가 없다 | 조치 불요 — plan 의 `spec_impact: none` 과 일치한다. 전수 grep 0건으로 확인했고, 성격상 정상적 부재다 |
| 3 | documentation(R3) | `repo-guards/__tests__/` 에 구조 개요 문서가 없다 | **의도적 보류** — 리뷰어 자신이 "필수 아님" 으로 판정했고 각 파일 헤더가 상호 참조로 항해 가능하다. 가드가 3개 이상이 되는 시점이 트리거다 |

## 라운드 추이 — 수렴 판단 근거

이 저장소는 과거 fix→리뷰 stale 루프를 7라운드 돈 전례가 있어, 수렴을 "발견 0" 이 아니라
**발견의 성격**(동작 → 구조 → 문서)으로 판단한다.

| 라운드 | reviewer | Critical | WARNING | 성격 |
|---|---|---|---|---|
| R1 | 8 (router 선별) | 0 | 3 | 구조·문서 혼재 |
| R2 | 4 | 0 | 3 | 구조 1 + 문서 2 |
| R3 | 3 | 0 | 1 | 순수 문서 |
| **R4** | 2 | **0** | **0** | INFO 만 |

## 각 라운드에서 고친 것

**R1 (`08_32_48` 계열 이후 `10_54_59`)**
- `validateWorkspacePatterns` 의 에러 메시지가 분리 전 함수명(`discoverWorkspaceDirs:`)을 달고 있었다 — 디버깅 시 없는 자리를 가리킨다.
- 재export 주석이 "이미 공개 창구였다" 고 적었으나 `blockRange`/`findKeyLine` 은 원래 **비공개** 헬퍼였다. 이관의 부산물로 없던 공개 표면이 두 모듈에 생긴 셈이라 그 둘을 재export 에서 뺐다 — 이관이 API 를 넓히면 그건 이관이 아니다.
- `findKeyLine` JSDoc 신설, 등록 가드 모듈 헤더가 파서 이관을 반영하도록 정정.

**R2 (`11_08_01`)**
- **`repoRoot` 의 fail-closed 가 테스트 불가능했다.** 같은 PR 에서 `discoverWorkspaceDirs` 에는 `readLines` 주입을 넣어 fail-closed 를 합성으로 겨냥해 놓고 `repoRoot` 에는 안 넣었다 — `__dirname` 하드코딩이라 marker 없는 트리를 만들 수 없었다. 이 모듈은 두 가드의 공용 기반(`ROOT`)이라 조용히 깨지면 파급이 가장 크다. 주입점을 대칭으로 열고 소유 모듈 스위트 `shared.test.ts` 6건 신설(뮤테이션 6종 RED).
- 주석이 "그 둘은 `_shared` 에서만 쓴다" 고 적었으나 **이 파일 자신의 `blockScalarAtPath`** 가 쓴다. 드리프트 방지가 이 PR 의 취지인데 주석이 그 예시가 됐다.
- plan frontmatter `worktree: (unstarted)` 잔존 — 죽은 worktree 처럼 보여 `plan_coherence` 를 오염시키는 sentinel 이다.

**R3 (`11_15_05`)**
- `repoRoot` JSDoc 이 `discoverWorkspaceDirs` 를 "같은 파일" 이라 적었으나 형제 파일이다. 같은 PR 의 반대편 주석은 정확해서 한쪽만 틀렸다.

## 검증

- `pnpm --filter frontend test` — **284 files / 5920 passed**, 1 skipped
- `pnpm --filter frontend exec vitest run src/lib/repo-guards/__tests__/` — 3 files / 82 passed
- `pnpm --filter frontend lint` — 0 errors (기존 warning 13, **신규 0**)
- `pnpm --filter frontend exec tsc --noEmit` — 0 errors
- 뮤테이션 누적 14종 전부 RED (fail-closed 3축 · 통과 경로 · 호출부 · 공유 파서 인라인 주석 · repoRoot marker/상한/루트-종료/기본인자 · readLines 기본값)

## 스코프 밖으로 남긴 것

§3(`catalog:` 마이그레이션)은 **미착수**다. 세 판단 항목 중 둘을 실측으로 해소했고
(대상 범위 = 9개 묶고 `@types/node` 제외 / lockstep 축은 무의미해지는 게 아니라 **가드가
깨진다** — `parseMajor("catalog:")` → `null` → `unparsable` → 위반 판정), 남은 하나
(dependabot 의 pnpm catalog 지원)는 저장소 안에서 답할 수 없다. 확인 없이 옮기면
typescript 가 dependabot 시야에서 사라지고, 그건 #1047 을 만든 것과 같은 클래스의
사각지대다.
