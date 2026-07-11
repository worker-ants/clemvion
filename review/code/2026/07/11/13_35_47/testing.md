# Testing 리뷰 — guard-effectiveness (74b256f46..HEAD)

리뷰 대상: `.claude/test-stages.sh`(+1), `.github/workflows/spec-link-checks.yml`(신규), `codebase/channel-web-chat/src/lib/presentation.test.ts`(mock 타입 수정), `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(mock 타입 수정).

모든 검증은 실제 mutation test(코드를 일시적으로 깨서 가드가 red 로 도는지 실측 → revert)로 수행했다. 최종적으로 `git status --porcelain` / `git diff 74b256f46..HEAD --stat` 로 작업트리가 원래 diff 와 정확히 일치함을 재확인했다(잔여 변경 없음).

## 발견사항

- **[CRITICAL]** 실제 GitHub Actions CI(`web-chat-checks.yml`)는 이번 PR 에서 전혀 갱신되지 않음 — 가드가 harness 경로에서만 fire 하고 GH CI 경로에서는 여전히 안 fire 함
  - 위치: `.github/workflows/web-chat-checks.yml` (job `widget`, step `Next build (static export)`) — 이번 diff 에 미포함(`git diff 74b256f46..HEAD -- .github/workflows/web-chat-checks.yml` 빈 결과, 최근 수정 커밋도 무관한 dependency bump 뿐).
  - 상세: 이번 PR 은 `pnpm --filter channel-web-chat typecheck` 를 **`.claude/test-stages.sh`(AI 하네스/`run-test.sh build` 전용) 에만** 추가했다. 그런데 실제 GitHub PR 을 게이트하는 CI 는 `web-chat-checks.yml` 의 `widget` job 이고, 여기엔 `Lint` → `Vitest (unit)` → `Next build (static export)` 세 스텝뿐, `typecheck` 스텝이 없다. `web-chat-checks.yml` 의 마지막 스텝 주석은 "next build ... + typecheck 동반 검증" 이라 적혀 있어 작성자가 `next build` 가 typecheck 를 겸한다고 가정한 것으로 보이는데, **이 가정이 틀렸음을 직접 mutation test 로 실증했다.**
    - `eia-events.test.ts` 의 `@ts-expect-error` 한 줄을 제거(가드를 깨뜨림) → `pnpm --filter channel-web-chat typecheck` (tsc --noEmit) 는 즉시 `TS2741 Property 'buttonConfig' is missing` 로 red.
    - 동일한 mutation 상태에서 **`pnpm --filter channel-web-chat build` (= `next build`, `web-chat-checks.yml` 이 실제로 도는 스텝)** 를 `.next` 캐시까지 삭제한 fresh 상태로 두 번 재실행 — 둘 다 `✓ Compiled successfully` / `Finished TypeScript` / exit 0 으로 **green** (즉 `next build` 는 `*.test.ts` 를 타입체크 그래프에 포함하지 않는다 — Next 의 typecheck 는 앱 모듈 그래프 기준이라 어디서도 import 되지 않는 test 파일은 스캔 밖).
    - 두 mutation 모두 확인 후 `cp` 로 원본 복구, `git status`/`git diff HEAD` 로 정확히 원상복구됨을 검증.
  - `e2e.yml` 에도 channel-web-chat/typecheck 언급이 전혀 없어(grep 0건) 다른 CI 경로로도 이 갭이 메워지지 않는다. `web-chat-checks.yml` 이 channel-web-chat 의 유일한 실제 GH CI 표면이다.
  - 결과적으로: 이번 PR 이 "PR #912 가드가 실제로 fire 하게 만든다"는 목적은 **로컬/하네스 build 단계에서만 달성**되고, **GitHub 상의 실제 CI(브랜치 보호·PR 체크) 에서는 여전히 미달성** — 하네스를 우회하거나(직접 push, BYPASS 류) 다른 세션 상태로 인해 로컬 build 단계가 누락된 경우 방어선이 없다. 이는 정확히 이 프로젝트가 과거 겪은 클래스의 문제다(PROJECT.md L36 이 언급하는 PR-E3: 한쪽 stack 만 검증돼 다른 쪽 회귀가 새어나가 `0f05d3e5` 핫픽스 필요했던 사례)와 동일한 패턴 — 이번엔 "backend/frontend" 축이 아니라 "harness/실 GH CI" 축에서 반복.
  - 제안: `.github/workflows/web-chat-checks.yml` 의 `widget` job 에 `- name: Typecheck` / `run: pnpm --filter channel-web-chat typecheck` 스텝을 `Lint` 다음(또는 build 이전 어디든)에 추가. `web-chat-sdk` job 은 이미 이 스텝을 갖고 있어(`web-chat-checks.yml` L38-39 `Typecheck` 스텝 참고) widget job 만 빠진 비대칭이 뚜렷하다.

- **[INFO]** mock 캐스트 2중 적용 지점 중 바깥쪽 `as unknown as typeof EventSource` 는 empirically 불필요(redundant) — 마스킹 리스크는 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (4곳: L97, L215, L644, L797 부근) — `class { ... } as unknown as typeof EventSource`.
  - 상세: `vi.stubGlobal(name, value)` 의 시그니처가 이미 `value: unknown` (node_modules/vitest/dist/index.d.ts L588) 이라 `EventSource` 로 캐스트해도 stubGlobal 호출 자체엔 원래 아무 타입 체크가 없었다. 실측: 바깥쪽 캐스트를 제거하고(안쪽 `return latest as unknown as this;` 만 유지) `pnpm --filter channel-web-chat typecheck` 재실행 → 여전히 0 errors. 반대로 안쪽 캐스트만 제거하면 원래의 `TS2409`/`TS2322` 가 재현된다 — 즉 **안쪽 `as unknown as this` 만이 load-bearing** 이고 바깥쪽은 순수 잉여 캐스트. 실제 앱 경계 타입(`EventSourceLike`, `eia-client.ts` L14-17: `addEventListener`/`close` 2개 메서드만 요구)을 `ControllableEventSource` 가 온전히 구현하므로 마스킹되는 실질 위험은 없다 — 이건 DOM `EventSource` 클래스 자체의 "constructor 가 반환하는 값은 `this` 에 assignable 해야 한다"는 구조적 룰(TS2409)을 우회하는 것뿐, 애플리케이션이 실제로 쓰는 계약과 무관.
  - 제안: 기능상 문제는 아니라 blocking 아님. 원하면 바깥쪽 캐스트 제거해 diff 를 더 최소화할 수 있음(선택사항).

- **[INFO]** `!.buttons!` 이중 non-null assertion 중 `items[0]!` 쪽도 empirically 불필요
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` L143, L291 — `c.items[0]!.buttons!.map(...)`.
  - 상세: `CarouselItem.buttons?: PresentationButton[]` 만 optional (`presentation.ts` L23), `tsconfig.json` 에 `noUncheckedIndexedAccess` 없음 → 배열 인덱싱 `items[0]` 자체는 애초에 `| undefined` 로 추론되지 않는다. 실측: `items[0]!` 를 제거하고 `buttons!` 만 남긴 뒤 typecheck → 0 errors(원래 pre-existing error 는 `.buttons.map` 한 곳뿐, `.title` 접근은 애초에 에러 없었음). 현재는 위험 없는 잉여지만, 프로젝트가 향후 `noUncheckedIndexedAccess` 를 켜면 이 `!` 가 진짜 필요한 새 시그널을 조용히 삼킬 수 있다는 점만 참고.
  - 제안: blocking 아님. 선택적으로 `items[0].buttons!` 로 축소 가능.

- **[PASS]** 하네스 배선(item 1) — mutation test 로 실제 fire 확인됨
  - 위치: `.claude/test-stages.sh` L46 `pnpm --filter channel-web-chat typecheck`.
  - 상세: `@ts-expect-error` 제거 → `pnpm --filter channel-web-chat typecheck` (== `cmd_build` 가 도는 것과 동일 명령) red(TS2741) 확인. 원상복구 후 clean(exit 0) 재확인. `cmd_build` 함수 안에서 `&&` 체인의 일부로 정확히 배선돼 있어(다른 스텝 실패 시 조기 종료와 동일 패턴) 하네스 `run-test.sh build` 경로에서는 확실히 가드가 살아있다.

- **[PASS]** item 3 — `channel-web-chat typecheck` 는 HEAD 에서 전역 clean, 가드 파일에만 국한되지 않고 전체 트리를 스캔
  - 상세: HEAD 에서 `pnpm --filter channel-web-chat typecheck` 실행 결과 0 errors. `tsconfig.json` 의 `include`(`**/*.ts`, `**/*.tsx`) 가 채널-웹챗 전체를 포함하므로, 이번 배선은 가드 회귀뿐 아니라 channel-web-chat 어디서든 발생하는 향후 타입 회귀 전체를 (하네스 경로 한정으로) 잡는다 — 의도된 부수효과이자 순수 이득. 노이즈(무관 red) 없음.

- **[PASS]** item 4 — `spec-link-checks.yml` 트리거·실행 경로 검증
  - 상세: `paths` 에 `codebase/backend/**` 포함 확인 — backend-only PR 에서도 트리거된다. 커맨드 `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` 를 그대로 실행해 실증(`--` 없이도 pnpm 이 위치인자를 vitest 로 정상 전달) → `Test Files 1 passed (1)`, `Tests 13 passed (13)`, 해당 파일 하나만 정확히 스코프됨(전체 suite 미실행, CI 시간 절약 의도 부합). 가드 자체(`spec-link-integrity.test.ts` + `spec-links.ts`)는 `repoRoot()` 기반 fs 스캔만 하고 backend/channel-web-chat 코드를 import/실행하지 않으므로, `pnpm install --frozen-lockfile --filter "frontend..."` (backend/channel-web-chat 의존성 미설치) 로도 충분 — 이 설계 근거를 소스 레벨로 확인. actions 버전(`checkout@v7`/`pnpm/action-setup@v6`/`setup-node@v6`, node 24)도 `frontend-checks.yml` 과 정합.

- **[INFO]** `spec-link-checks.yml` 이 frontend-only PR 에서 `frontend-checks.yml` 과 동일 테스트를 중복 실행
  - 위치: `.github/workflows/spec-link-checks.yml` `on.pull_request.paths` 에 `codebase/frontend/**` 포함.
  - 상세: `frontend-checks.yml` 은 이미 `pnpm --filter frontend test` (전체 suite, `spec-link-integrity.test.ts` 포함)를 돈다. frontend-only 변경 PR 은 두 워크플로가 모두 트리거돼 같은 가드 파일이 두 번 실행됨 — 정확성 문제는 아니고 CI 분 낭비 수준의 minor 비효율. 원한다면 `spec-link-checks.yml` 의 paths 에서 `codebase/frontend/**` 를 빼고 진짜 갭(backend/channel-web-chat/packages/spec) 만 남기는 것도 고려 가능하나 blocking 아님(워크플로 자체 주석이 "gap 만 메운다"는 취지이므로, 의도적으로 전 영역을 커버해 단순성을 택했을 수도 있음).

- **[PASS]** 회귀 테스트 — 수정된 두 테스트 파일 런타임 동작 확인
  - 상세: `pnpm --filter channel-web-chat test` 로 channel-web-chat 전체 suite 실행 → `Test Files 19 passed (19)`, `Tests 300 passed (300)`. mock 타입 캐스트/non-null assertion 은 순수 타입 레벨 변경이라 런타임 동작(assert 값)에 영향 없음을 확인 — 회귀 없음.

## 요약

이번 PR 의 핵심 mutation test(harness `cmd_build` 경로에서 PR #912 가드가 실제로 red 로 도는지)는 실증적으로 통과했고, mock 타입 캐스트들도 애플리케이션 경계 타입(`EventSourceLike`)을 기준으로 보면 실질적 안전성 손실 없이 최소에 가깝게(일부 잉여 캐스트 제외) 적용됐다. `spec-link-checks.yml` 신규 워크플로도 트리거 경로·실행 커맨드·설치 스코프 모두 실측으로 검증되어 의도대로 동작한다. 다만 가장 치명적인 발견은 **이번 PR 이 "가드가 실제로 fire" 하게 만든 대상이 AI 하네스의 `.claude/test-stages.sh` 뿐이고, 실제 GitHub Actions CI(`web-chat-checks.yml`)는 건드리지 않았다는 것** — `next build` 가 test 파일을 타입체크하지 않는다는 걸 fresh 캐시 상태로 두 번 실증했으므로, 사람이 직접 push 하거나 하네스 세션 상태가 어긋난 경우 실제 GH CI 는 여전히 이 가드 회귀를 놓친다. PR 의 "whole point" 를 완전히 달성하려면 `web-chat-checks.yml` 의 `widget` job 에도 typecheck 스텝을 대칭으로 추가해야 한다.

## 위험도

CRITICAL
