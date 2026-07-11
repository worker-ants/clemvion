# 부작용(Side Effect) 리뷰 — guard-effectiveness (74b256f46..HEAD)

대상: `a3317ef37`(mock 타입 red 정리) + `029abcd86`(typecheck 배선+CI), 4개 파일.

## 검증 방법

- `use-widget-eager-start.test.ts`: `npx vitest run src/widget/use-widget-eager-start.test.ts` 실행 → **20 passed (20)**.
- `presentation.test.ts`: `npx vitest run src/lib/presentation.test.ts` 실행 → **46 passed (46)**.
- `tsc --noEmit -p codebase/channel-web-chat/tsconfig.json` 직접 실행 → 0 에러 (exit 0).
- `.claude/test-stages.sh` / `.github/workflows/spec-link-checks.yml` 은 정적 분석(diff·비교) + 인접 workflow 파일 대조.

## 발견사항

### (1) EventSource stub 캐스트 — 런타임 불변 확인, CONFIRMED

- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 4곳 (line 96, 214, 643, 796 부근)
- 상세: `return latest as unknown as this;` 와 `} as unknown as typeof EventSource);` 는 둘 다 TypeScript 타입 단언 문법이다. `as` 캐스트는 트랜스파일 시 완전히 제거되며 (esbuild/swc strip, vitest 도 esbuild 기반) 런타임 바이트코드에는 아무 흔적도 남기지 않는다. `return latest as unknown as this` 의 실제 런타임 문장은 여전히 `return latest;` — 참조는 정확히 동일한 `ControllableEventSource` 인스턴스다. `vi.stubGlobal("EventSource", class {...} as unknown as typeof EventSource)` 도 마찬가지로 `vi.stubGlobal` 이 실제로 받는 두 번째 인자(런타임 값)는 캐스트 전과 완전히 동일한 클래스 객체 — 타입 시그니처만 `typeof EventSource` 로 위장된다.
- 검증: 실제 vitest 실행 20/20 통과 — `getEs()`/`latest` 캡처, `.emit()` 주입, `new EventSource(...)` 호출부에서 `latest` 인스턴스가 여전히 도달함을 실증. 커밋 메시지 자체도 "mock 은 그대로 동작(latest 캡처·emit 주입 무변경)" 명시.
- 결론: **런타임 불변, 컴파일 타임 전용 수정**. 부작용 없음.

### (2) `presentation.test.ts` non-null assertion — CONFIRMED, 런타임 불변

- 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:143, 291`
- 상세: `c.items[0].buttons.map(...)` → `c.items[0]!.buttons!.map(...)`. `!` non-null assertion 은 TypeScript 전용 구문으로 트랜스파일 시 완전히 제거된다(`c.items[0].buttons.map(...)` 와 컴파일 결과 동일). 값 자체나 접근 경로에 변화 없음 — optional 필드가 실제로 undefined 라면 이전과 동일하게 `TypeError`가 나고, 존재하면 이전과 동일하게 통과한다.
- 검증: 실제 vitest 실행 46/46 통과(해당 두 assertion 포함).
- 결론: 런타임 불변. 부작용 없음.

### (3) `.claude/test-stages.sh` cmd_build 에 typecheck 단계 삽입 — INFO, 체인 안전

- 위치: `.claude/test-stages.sh:46` — `pnpm --filter channel-web-chat build && \` 와 `pnpm --filter @workflow/sdk build && \` 사이에 `pnpm --filter channel-web-chat typecheck && \` 삽입.
- 상세: 전체가 `&&` 순차 체인이므로 삽입 지점과 무관하게 실패 시 이후 단계(sdk build, `_cmd_build_docker_images`)가 스킵되는 fail-fast 의미는 그대로 유지된다. `.claude/tools/run-test.sh` 는 `cmd_build` 를 단일 함수로 백그라운드 실행 후 exit code 만 관찰하므로 내부 단계 순서에 의존하는 외부 로직 없음(grep 확인: `cmd_build` 참조처는 `run-test.sh`/`test-stages.sh.example`/`test-wrapper.md` 뿐, 순서 가정 없음).
- 신규 부작용: `channel-web-chat/tsconfig.json` 에 기존부터 `"incremental": true` 가 설정돼 있어 `tsc --noEmit` 실행 시 `codebase/channel-web-chat/tsconfig.tsbuildinfo` 파일이 로컬에 생성/갱신된다. `codebase/channel-web-chat/.gitignore` 에 `*.tsbuildinfo` 가 이미 등재돼 있어(diff 대상 아님, 기존 파일) git 오염은 없음(`git status` 확인, untracked 로도 안 잡힘). CI(ubuntu-latest, 매 job ephemeral)에서는 애초에 지속되지 않는 파일이라 문제 없음.
- 게이트 강화 성격: 이전에는 `pnpm --filter channel-web-chat build`(`next build`)만으로 docker 이미지 빌드 단계까지 진행했는데, 커밋 메시지가 밝히듯 **`next build` 는 `*.test.ts` 파일을 typecheck 하지 않는다** — 즉 이번 삽입이 처음으로 테스트 파일의 타입 가드를 harness build 단계에서 발화시킨다(의도된 gap 해소, PR #912 후속 목적 그 자체). 이는 "새로운 실패 가능 경로"이지만 명시적으로 의도된 변경이며 기존 호출자(어떤 스크립트도 `cmd_build` 내부 단계 개수/순서에 의존하지 않음)에 부작용 없음.

### (4) `spec-link-checks.yml` 신규 workflow — 기존 workflow와 충돌 없음, 경미한 중복 실행 INFO

- 위치: `.github/workflows/spec-link-checks.yml` (신규)
- concurrency: `group: spec-link-checks-${{ github.ref }}` — 다른 workflow(`frontend-checks-*`, `web-chat-checks-*`, `harness-checks-*`)와 group 이름이 겹치지 않으므로 서로의 in-progress job 을 취소하지 않는다. 충돌 없음.
- side-effect 관점 job 내용: `actions/checkout` + `pnpm install --frozen-lockfile --filter "frontend..."` + `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` 뿐 — 외부 서비스 호출·쓰기 작업 없음(해당 테스트 파일 자체도 grep 결과 `fetch`/`exec`/`spawn`/`writeFile` 등 부작용 코드 없는 순수 fs 스캔+assert). 네트워크 부작용 없음.
- 트리거 중복 (INFO, 버그 아님): `pull_request.paths` 에 `codebase/frontend/**` 와 `codebase/packages/**` 가 포함되어 있어, **frontend/packages 만 바꾼 PR** 은 기존 `frontend-checks.yml`(이미 `pnpm --filter frontend test` 전체를 돌려 `spec-link-integrity.test.ts` 를 포함)과 신규 `spec-link-checks.yml` 이 동시에 트리거되어 같은 vitest 파일이 두 번 실행된다. 기능적으로 상충(다른 결과)될 여지는 없으나(같은 커밋, 같은 테스트, 결정적) CI 리소스 중복 소비다. 신설 목적(backend/channel-web-chat 경로 갭 메우기) 관점에서는 frontend/packages 경로까지 포함할 필요가 없어 보이지만, 실제 실행 결과에 영향은 없고 workflow 자체 주석도 "가드가 스캔하는 영역 전부"를 커버 범위로 명시하고 있어 의도된 단순화로 판단됨 — CRITICAL 아님.
- push(main) 트리거는 `.github/workflows/spec-link-checks.yml` 자체 경로를 paths 에 포함하지 않음 — 이는 `frontend-checks.yml`/`web-chat-checks.yml` 의 기존 컨벤션과 동일(비대칭 pull_request-only self-path 트리거), 신규 이슈 아님.

## 스코프 외 관찰 (참고용, 리뷰 대상 diff 아님)

- 리뷰 세션 중 한 시점에 `git status` 가 `codebase/channel-web-chat/src/lib/eia-events.test.ts` 에 대해 `@ts-expect-error` 주석 한 줄이 제거된 미커밋 unstaged 변경을 잠깐 보였으나, 이후 재확인 시 사라져 현재 working tree 는 `74b256f46..HEAD` 기준 clean(리뷰 산출물 디렉터리 제외)이다. 이 파일은 대상 diff(`a3317ef37`/`029abcd86`)에 포함되지 않으며, 아마도 동일 worktree 를 공유하는 다른 동시 작업/툴링에 의한 일시적 상태로 추정된다. 대상 diff 의 부작용으로 볼 수 없어 위험도 평가에는 반영하지 않았으나, 다음 커밋 전 `git status` 재확인을 권장.

## 요약

두 커밋은 모두 "타입 가드가 harness/CI 에서 실제로 발화하도록" 배선하는 것이 목적이며, 정작 테스트 코드 자체의 런타임 동작은 전혀 바꾸지 않았다. (1)(2) 는 순수 컴파일 타임 캐스트/non-null assertion 으로, 실제 vitest 실행(20/20, 46/46 통과)으로 런타임 무변화를 실증했다. (3) 은 기존 `&&` 체인에 안전하게 삽입된 새 gate 로, 유일한 파일시스템 부작용(`tsconfig.tsbuildinfo`)은 기존에 이미 있던 `incremental:true` 설정에서 기인하며 gitignore 처리돼 있어 무해하다. (4) 는 신규 workflow 로 외부 호출·쓰기 부작용이 없고 기존 workflow 와 concurrency group 충돌도 없으며, 유일한 흠은 frontend/packages 경로 PR 에서 `frontend-checks.yml` 과 동일 테스트가 한 번 더 도는 경미한 리소스 중복(기능적 상충 아님)이다. 전반적으로 이번 diff 는 "가드를 실제로 실행되게 만드는" 인프라 배선이며, 의도치 않은 상태 변경·전역 변수·시그니처/인터페이스 변경·환경 변수·네트워크 호출·이벤트/콜백 변경 그 어느 카테고리에도 해당하지 않는다.

## 위험도

LOW
