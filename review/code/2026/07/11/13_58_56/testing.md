# 테스트(Testing) 리뷰 — commit e34ef03f8

FRESH review. 이전 리뷰(13_35_47) 의 testing CRITICAL("widget job 이 실제 GitHub CI 에서
타입 가드를 발화시키지 못함")에 대한 fix 커밋을 mutation testing 으로 실증 검증했다.

## 검증 방법

worktree(`/Volumes/project/private/clemvion/.claude/worktrees/guard-effectiveness-18f8e7`)에서
직접 로컬 명령을 실행해 baseline→mutation→revert 사이클을 2건(widget, sdk-client) 수행했다.
모든 mutation 은 `git diff --stat` 로 원상복구 확인 후 제거했다(현재 `git status` clean).

## 발견사항

### (1) widget job Typecheck step — 실증 완료, 가드 유효

- **[INFO]** widget job 에 `Typecheck` step 이 정확한 위치(Lint 다음, Vitest 이전)에
  추가됨. sibling `sdk` job 과 동일한 4-step 구조(Lint→Typecheck→Test→Build)로 대칭 확보.
  - 위치: `.github/workflows/web-chat-checks.yml` widget job (Lint 뒤, Vitest 앞)
  - Mutation 실증:
    1. baseline `pnpm --filter channel-web-chat typecheck` → 0 errors (green).
    2. `codebase/channel-web-chat/src/lib/eia-events.test.ts:268` 의
       `// @ts-expect-error — ButtonsContext 인데 buttonConfig 필드가 없다.` 삭제.
    3. `pnpm --filter channel-web-chat typecheck` → **red**:
       `error TS2741: Property 'buttonConfig' is missing in type '{ interactionType: "buttons"; waitingNodeId: string; }' but required in type 'ButtonsContext'.` (exit 2)
    4. 같은 mutation 상태에서 `pnpm --filter channel-web-chat test -- --run src/lib/eia-events.test.ts` → **green**(300 tests passed) — vitest(esbuild strip)가 이 클래스 회귀를 못 잡는다는 커밋의 전제(next build 도 마찬가지 module-graph 한계)를 교차 검증.
    5. 파일 복구 → `git diff` 없음, `typecheck` 다시 green 확인.
  - 결론: widget job 의 새 Typecheck step 은 실제로 union 가드 회귀를 GitHub Actions 상에서 red 로 만든다. 갭이 닫혔다.

### (2) sdk-client job — 실증 완료, ts-jest 타입가드 유효

- **[INFO]** `sdk-client` job 신설이 실제로 `client.spec.ts` 의 negative 타입 가드를 검증한다.
  - 위치: `.github/workflows/web-chat-checks.yml` 신규 `sdk-client` job, step `Jest (unit + type guard)` (`pnpm --filter @workflow/sdk test`)
  - Mutation 실증:
    1. baseline `pnpm --filter @workflow/sdk test` → 2 suites / 33 tests passed (green).
    2. `codebase/packages/sdk/src/client.spec.ts:46` 의
       `// @ts-expect-error — ButtonsContext 인데 buttonConfig 필드가 없다.` 삭제.
    3. `pnpm --filter @workflow/sdk test` → **red**: `FAIL src/client.spec.ts` /
       `error TS2741: Property 'buttonConfig' is missing...` (Test Suites: 1 failed, 1 passed / exit 1).
    4. 파일 복구 → `git diff` 없음, `test` 다시 green(33/33) 확인.
  - job steps 순서(checkout→pnpm setup→node setup→install→Jest→Build)도 확인:
    - `pnpm install --frozen-lockfile --filter "@workflow/sdk..."` 실제 실행 성공(격리된 workspace, `dependencies: {}`라 외부 연쇄 없음).
    - `pnpm --filter @workflow/sdk build`(tsc) 실제 성공(exit 0, 에러 없음).
    - `tsconfig.json` 의 `exclude: ["node_modules", "dist", "**/*.spec.ts"]` 확인 — 커밋 주석 "build=tsc 는 *.spec.ts 를 exclude" 주장이 정확함. 즉 build 단계는 spec 의 타입가드를 못 보고, test(ts-jest) 단계가 유일한 검증 통로라는 설계가 실측과 일치.
    - `pnpm --filter @workflow/sdk lint` 를 직접 실행해 커밋 주석 "lint 는 SDK eslint.config 부재라 생략"도 실측 확인: `ESLint couldn't find an eslint.config.(js|mjs|cjs) file` 로 실패(exit 2). CI 에 Lint step 을 넣지 않은 선택이 정당함(넣었으면 job 이 상시 red).

### (3) YAML 유효성 + sdk sibling job 과의 일관성

- **[INFO]** `.github/workflows/web-chat-checks.yml` 을 `yaml.safe_load` 로 파싱 성공. 3개 job(`sdk`, `widget`, `sdk-client`) 모두 정상 구조.
  - `sdk`: checkout→pnpm→node→Install→Lint→Typecheck→Jest→Build
  - `widget`: checkout→pnpm→node→Install→Lint→**Typecheck(신규)**→Vitest→Next build
  - `sdk-client`(신규): checkout→pnpm→node→Install→**Jest(type guard 겸)**→Build
  - `sdk-client` 는 Lint/전용 Typecheck step 이 없어 3-job 중 유일하게 5-step(다른 둘은 6-step) 구조 — 다만 근거(위 (2) 참고)가 명확하고 주석으로 문서화돼 있어 임의 누락이 아님. **경미한 비대칭**으로 INFO 처리(아래 요약 참고).
  - `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v6`, `cache-dependency-path: pnpm-lock.yaml` 모두 3개 job 에서 동일 버전으로 일치.

### (4) `items[0]!` → `items[0]` 제거 — tsc 0 에러 확인

- **[INFO]** `codebase/channel-web-chat/tsconfig.json` 에 `noUncheckedIndexedAccess` 미설정(strict:true 만) 확인. `pnpm --filter channel-web-chat typecheck` 를 baseline/최종 양쪽에서 재실행해 0 에러 확인 — non-null assertion 제거가 안전함을 실측으로 재확인(narrowing 은 앞선 `expect(c.items.length).toBe(2)` 로도 타입 좁힘엔 기여하지 않지만애초에 배열 인덱스 접근이 strict 모드에서 optional 이 아니므로 문제 없음).
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:140, 288` 부근 두 곳.

### (5) 신규 이슈 / 커밋 메시지 overclaim 여부

- **[INFO]** 커밋 메시지의 구체적 주장들(Typecheck 대칭, sdk-client 신설 이유, lint 생략 이유, tsc 0)은 모두 실측 재현됨 — overclaim 없음.
- **[INFO]** `sdk-client` job 에 lint 가 전혀 없어 `packages/sdk` 의 프로덕션 코드(`src/client.ts` 등)는 여전히 CI 에서 ESLint 검증을 받지 않는다. 이는 이번 커밋이 만든 갭이 아니라 `packages/sdk` 에 `eslint.config.*` 가 원래 없던 선재 부채이며, 커밋이 이를 숨기지 않고 주석으로 명시했다는 점은 정직하다. 다만 후속 조치 없이는 이 gap 이 영구화될 위험이 있다 — plan 후속 항목으로 "packages/sdk 에 eslint.config 추가 + sdk-client job 에 Lint step 배선"을 등록하는 것을 권장(WARNING 대신 INFO 로 남기는 이유: 이번 fix 커밋의 스코프인 "가드가 실제 CI 에서 발화하는가"와는 직교하는 별개 이슈이고, 회귀를 만들지 않음).
- **[INFO]** commit 이 언급한 "e2e(252) 재통과"는 이번 세션에서 재실행하지 않았다(비용 문제로 범위 밖 — 이전 라운드 scope.md 도 동일하게 재실행 생략을 기록함). 이 수치 자체가 이번 diff 로 검증 가능한 범위(CI yaml + 2개 test 파일)를 벗어나 있어 testing 관점에서 CRITICAL 로 볼 근거는 아니다.
- **[INFO]** `use-widget-eager-start.test.ts` 에 추가된 배경 주석(`as unknown as this` 트릭 설명)은 순수 문서화로, 테스트 동작에 영향 없음(diff 로 로직 변경 없음 확인). 커밋이 스스로 명시한 "EventSource stub 4곳 공용 헬퍼 추출" 후속 부채는 아직 미해결이지만 이는 이번 커밋 스코프 밖 후속으로 명시돼 있어 문제 없음.
- 회귀 없음: 두 mutation 모두 정상적으로 revert 되었고 최종 `git status --porcelain` 은 review 산출물 디렉터리 외 변경 없음을 확인.

## 요약

이전 리뷰의 testing CRITICAL(로컬 harness 만 가드를 발화시키고 실제 GitHub Actions 는 미달)은 이번 커밋으로 실질적으로 해소되었다. widget job 의 신규 `Typecheck` step 과 신규 `sdk-client` job 의 `Jest(ts-jest)` step 양쪽 모두 `@ts-expect-error` negative 를 제거하는 mutation 을 가해 실제로 CI 상에서 red 가 되는 것을 로컬 재현으로 직접 실증했고, revert 후 다시 green 임도 확인했다. `build(tsc)`가 `*.spec.ts` 를 exclude 한다는 주장, `lint` 가 SDK 에 `eslint.config` 부재로 실패한다는 주장도 모두 명령을 직접 실행해 사실로 확인됐다. YAML 은 유효하고 3-job 구조는 sibling `sdk` job 과 대체로 대칭(다만 `sdk-client` 는 의도적으로 Lint/전용 Typecheck step 이 빠진 5-step 구조). `items[0]!` 제거는 tsc 0 에러로 안전 확인됨. 이번 커밋으로 새로 도입된 결함은 발견되지 않았고, 커밋 메시지의 구체적 주장은 overclaim 없이 전부 실측과 일치한다. 유일한 잔여 갭은 `packages/sdk` 자체의 ESLint 미설정(선재 부채, 이번 스코프 밖)이며 후속 plan 항목화를 권장한다.

## 위험도

NONE
