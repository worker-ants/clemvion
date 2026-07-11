# Side Effect Review — commit `dedc411fd` (fresh)

대상: `dedc411fd7d8222421b28d2174698d679bed12a4`
("refactor(docs,sdk): ai-review 반영 — 가드 실효성(SDK 배선·frontend 스캔·negative)")
직전 리뷰(`review/code/2026/07/11/11_44_59/`) 지적사항에 대한 fix 커밋. 모든 지적된 항목을
실측(빌드/테스트 실행)으로 재검증했다.

## 발견사항

- **[WARNING]** `channel-web-chat/src/lib/eia-events.test.ts`의 신규 설명 주석이 실제
  `@ts-expect-error` 컴파일러 지시어로 오인식되어 새 typecheck 에러를 유발함(이 커밋이 도입)
  - 위치: `codebase/channel-web-chat/src/lib/eia-events.test.ts:265`
    ```
    it("잘못된 shape 은 타입 거부 — union 닫힘 고정 (negative)", () => {
      // @ts-expect-error 들은 vitest run(esbuild 타입 strip)에선 no-op 이고, `tsc --noEmit`
      // (typecheck) 에서 검증된다 — union 이 open map 으로 되돌려지면 이 expect-error 가
      // "사용되지 않음" 으로 tsc red 가 된다.
      // @ts-expect-error — ButtonsContext 인데 buttonConfig 필드가 없다.
      const missingButtons: ButtonsContext = { interactionType: "buttons", waitingNodeId: "n" };
      ...
    ```
  - 상세: TypeScript 는 `//` 주석의 trim 된 내용이 `@ts-expect-error` 로 **시작**하기만 하면
    그 다음 줄을 대상으로 한 실제 지시어(pragma)로 파싱한다 — 나머지 텍스트(설명 프로즈)는
    무관하다. 265번 줄의 설명용 주석("@ts-expect-error 들은 vitest run(esbuild 타입
    strip)에선...")이 정확히 이 조건에 해당해, 다음 줄(266번, 역시 순수 주석)에 실제
    타입 에러가 없다는 이유로 `tsc --noEmit` 이 `TS2578: Unused '@ts-expect-error'
    directive` 를 새로 낸다.
    독립 재현으로 이 파싱 규칙을 확인함(TS 5.9.3):
    ```
    // @ts-expect-error 들은 이것은 설명 텍스트일 뿐이다
    // 다음 줄은 그냥 주석
    const x: number = 1;
    ```
    → `error TS2578: Unused '@ts-expect-error' directive.`
    실제로 `pnpm --filter channel-web-chat typecheck`(`tsc --noEmit`) 실행 결과:
    ```
    src/lib/eia-events.test.ts(265,5): error TS2578: Unused '@ts-expect-error' directive.
    src/lib/presentation.test.ts(...)              ← pre-existing(무관)
    src/widget/use-widget-eager-start.test.ts(...) ← pre-existing(무관, RESOLUTION.md 기술한 3건)
    ```
    268/270번 줄의 **의도한** 실제 negative 지시어 2개는 정상 동작(다음 줄의 실제
    타입 에러를 정확히 suppress, "unused" 아님) — 손상된 것은 265번 줄뿐이다.
    같은 패턴을 SDK 쪽(`codebase/packages/sdk/src/client.spec.ts:43`)에는 도입하지
    않았음을 확인했다 — 거기 설명 주석은 `// SDK 는 build=tsc 라 이 @ts-expect-error 가...`
    로 **문장 중간**에 토큰이 있어 지시어로 오인식되지 않는다. 즉 두 파일에 동일 의도의
    설명 주석을 넣으면서 channel-web-chat 쪽만 어순이 어긋나 버그가 생겼다(비대칭 실수).
  - **현재 영향 범위(실측)**: 이 에러는 harness 에 배선된 어떤 스테이지도 통과시키지
    못하게 하지 않는다 — `pnpm --filter channel-web-chat lint`(0 error), `pnpm --filter
    channel-web-chat test`(vitest, 300/300 pass, esbuild 타입 strip이라 무관), `pnpm
    --filter channel-web-chat build`(`next build`, TypeScript 단계 포함 — 실측 초록,
    Next 의 typecheck 는 test 파일을 스캔하지 않음) 전부 green. 즉 이 커밋이 명시한
    "lint·unit·build·e2e 재통과" 주장과 모순되지 않는다 — **다만** RESOLUTION.md/C1 이
    "SDK 는 build 로 검증"이라 밝히면서 channel-web-chat 쪽은 "C2(typecheck 배선)는
    pre-existing red 3건 때문에 후속으로 미룬다"고 적어 놓았는데, 이 커밋 자체가 그
    pre-existing red 목록에 **새 항목(TS2578)을 하나 추가**했다. 나중에 C2(channel-web-chat
    `tsc --noEmit` 배선) 후속 작업을 수행할 사람이 "pre-existing red 3건"을 기대하고
    시작하면 실제로는 4건을 만나 혼선을 겪는다. 또한 정작 negative 테스트가 지키려는
    "union 이 닫혀 있다"는 의도와 무관하게, `tsc --noEmit` 을 직접 로컬에서 돌리는 개발자가
    이 실수를 "회귀"로 착각할 가능성도 있다.
  - 제안: 265번 줄 주석을 `@ts-expect-error` 로 시작하지 않도록 재배치(예: SDK 쪽과 동일하게
    "vitest run(esbuild 타입 strip)에선 이 @ts-expect-error 들이 no-op 이고 ..." 처럼 토큰을
    문장 중간으로 이동) — 한 줄 수정으로 해소 가능. 후속 plan 항목("C2")에 "pre-existing
    red 3건" 표기도 이 커밋의 신규 1건을 반영해 업데이트 권고.

- **[INFO]** 커밋 메시지/RESOLUTION.md 의 "SDK build=tsc 라 negative `@ts-expect-error`
  까지 build 로 검증된다"는 서술이 실제로는 부정확 — 실제 가드는 `test`(jest/ts-jest) 경로다
  - 위치: 커밋 메시지 "C1" 문단, `.claude/test-stages.sh` `cmd_build`(`pnpm --filter
    @workflow/sdk build` 추가), `RESOLUTION.md` C1 행("SDK `tsc` green 이라 배선 즉시 통과")
  - 상세: `codebase/packages/sdk/tsconfig.json` 은 `"exclude": ["node_modules", "dist",
    "**/*.spec.ts"]` 로 `*.spec.ts` 를 프로젝트에서 명시적으로 제외한다. 실측
    (`tsc --listFiles`)으로 확인: `src/client.ts`·`src/signature.ts`·`src/index.ts` 만
    포함되고 `client.spec.ts`(신규 negative 케이스 포함)는 목록에 없음 — 즉
    `pnpm --filter @workflow/sdk build`(`tsc`)는 `client.spec.ts` 를 전혀 컴파일/타입체크
    하지 않는다. 실제로 negative `@ts-expect-error` 를 검증하는 것은 `pnpm --filter
    @workflow/sdk test`(`jest` + `ts-jest`, 이번 커밋에서 `cmd_unit` 에 신규 배선)이며,
    이는 실측(`jest`, 33/33 pass)으로 정상 동작을 확인했다. 즉 **가드 자체는 실재하고
    올바르게 harness 에 연결**되어 있으나(cmd_unit 경유), 이를 "build 가 검증한다"고
    적은 서술은 오귀속이다.
  - 영향: 기능적 회귀는 아님(cmd_unit 에서 실제로 검증되므로 보호 목적은 달성) — 다만
    향후 누군가 "SDK 는 build 가 이미 지키니 unit 배선은 걷어내도 된다"고 오판할 여지가
    있는 문서적 리스크.
  - 제안: 후속 plan/커밋 메시지에서 "build 로 검증"을 "test(jest/ts-jest)로 검증, build
    는 프로덕션 컴파일(비-spec 소스)만 검증"으로 정정 권고. 코드 변경 불요.

- **[INFO]** `pnpm --filter @workflow/sdk build`(`tsc`)의 build 산출물(`dist/**`)은
  `codebase/packages/.gitignore` 로 무시되어 git 상태를 오염시키지 않음(확인:
  `git check-ignore -v codebase/packages/sdk/dist/client.js` → match) — 정상.
  Docker 빌드 대상(backend/frontend `Dockerfile`)은 `@workflow/sdk` 를 참조하지 않고
  (grep 0건), `@workflow/sdk` 는 `_cmd_build_docker_images` 이전에 독립 실행되어 docker
  build 순서/산출물에 영향 없음. `web-chat-sdk` 패키지가 `@workflow/sdk`(workspace:*)에
  실제 의존하지만 `test-stages.sh` 에 아직 배선되지 않은 기존 갭이며, 본 커밋이 그 갭을
  악화시키지도 않는다(plan 후속 항목에 별도 기재됨).

## 검증 요약 (Task 1–5 실측)

1. **SDK 를 build 체인에 추가해도 다른 스테이지/Docker 순서에 영향 없음.**
   `pnpm --filter @workflow/sdk build` 단독 실행 → PASS(tsc, 산출물은 gitignored `dist/`).
   backend/frontend 의 `package.json`/`Dockerfile` 어디에도 `@workflow/sdk` 참조 없음(grep 0건)
   → docker build 단계와 무관, 순서상 문제 없음. (전체 `cmd_build`(docker 이미지 포함)는
   수 분 이상 소요되어 본 세션에서는 미실행 — 의존성 그래프 검증으로 충분히 리스크 없음
   확인, 필요 시 별도 실행 권고.)
2. **`NonNullable<WaitingForInputEvent["nodeOutput"]>` narrowing은 `WaitingContext ⊆
   WaitingForInputEvent` assignability 를 깨지 않음.** `nodeOutput` 값 타입에서
   `| undefined` 만 제거(속성 자체는 원래도 required key)하는 순narrowing 이라 목적 타입
   (`nodeOutput?:` optional)과의 방향은 그대로 유지. 실측: `channel-web-chat` 전체
   테스트 300/300 pass, `use-widget.ts` 의 캐스트-free 대입부(§"WaitingContext 는
   WaitingForInputEvent 에 assignable — as 캐스트 불필요") 포함 `next build` TypeScript
   단계 green. positive 테스트(`eia-events.test.ts` 기존 케이스들) 전부 pass — 회귀 없음.
   (단, 위 WARNING 참조 — `tsc --noEmit` 단독 실행 시 negative 테스트 자체가 아니라
   **그 설명 주석**이 새 에러를 낸다.)
3. **`codebase/frontend/src` 를 스캔에 추가해도 기존 2건 외 추가로 깨진 링크는 없음.**
   `spec-link-integrity.test.ts` 직접 실행(vitest) → 13/13 pass (RESOLUTION.md 의
   "13 pass" 주장과 일치). `frontend` 전체 테스트(5330 tests, 271 files)도 별도로
   green — 가드가 실제로 전체 스캔 경로에서 켜진 상태로 문제없이 통과함을 재확인.
4. **두 frontend 링크 수정은 순수 주석 라인.** `widgets.tsx:130`은 `/** ... */` JSDoc
   블록 내부, `multi-select-widget.test.tsx:1-3`은 파일 최상단 `//` 헤더 주석 — 둘 다
   실행 코드 라인 변경 0. `path.join`/`path.normalize` 로 두 상대경로 모두
   `spec/4-nodes/3-ai/0-common.md`(실존 파일)로 정확히 resolve 됨을 계산 검증.
5. **커밋에 포함된 그 외 변경**: `.claude/test-stages.sh`(SDK 배선), `plan/in-progress/
   eia-context-schema-followups.md`(후속 항목 4건 등재 + frontmatter worktree 채움),
   `review/code/2026/07/11/11_44_59/*`(직전 라운드 리뷰 산출물 — SUMMARY/RESOLUTION/
   subagent report 커밋은 프로젝트 관례상 정상, `review/` 는 gitignore 대상 아님). `git
   show --name-status` 로 전수 확인 — 커밋 메시지가 설명하지 않는 파일 변경, 관련 없는
   코드 diff, 의심스러운 파일(비밀값 등)은 없음. 위 WARNING(TS2578)이 유일한 실질적
   "의도치 않은" 코드 부작용.

## 요약

이번 fix 커밋은 이전 리뷰가 지적한 4개 항목(SDK harness 미배선, frontend 링크 스캔
갭, negative 테스트 부재, `nodeOutput` optional 허용)을 모두 실질적으로 해소했고,
Task(1)~(4)로 요청된 회귀 가능성은 전부 실측으로 배제됐다 — SDK 를 build 체인에
추가해도 Docker/다른 패키지에 영향 없음, `NonNullable` narrowing 은 assignability 를
보존, frontend 링크 스캔 확장은 다른 링크를 추가로 깨뜨리지 않고 가드가 green, 두
링크 수정은 순수 주석. 다만 이 fix 커밋 스스로가 **새로운 부작용 하나를 도입**했다 —
`eia-events.test.ts` 의 설명용 주석이 `@ts-expect-error` 로 시작하는 바람에 TypeScript
가 이를 진짜 지시어로 오인, `tsc --noEmit` 에서 `TS2578`(Unused directive) 를 새로 낸다.
harness 에 wiring 된 어떤 스테이지도 이 경로를 타지 않아(정확히는 `next build` 의
typecheck 가 test 파일을 스캔하지 않음, lint 는 이 룰을 검사하지 않음) 지금 당장 CI/
harness 를 깨뜨리지는 않지만, 커밋이 스스로 문서화한 "channel-web-chat pre-existing
red 3건"의 베이스라인을 조용히 4건으로 늘려 놓았고, 이는 정확히 이 커밋이 막으려던
"가드가 실제로는 검증되지 않는 상태"의 축소판 재발이다. 한 줄 주석 재배치로 해소
가능한 저비용 수정이므로 이번 PR 또는 즉시 후속으로 정정 권고. 부가적으로 "SDK build
로 negative 가 검증된다"는 커밋 서술은 `tsconfig.exclude`("**/*.spec.ts")에 비추어
부정확(실제 가드는 `test`/jest 경로) — 기능 회귀는 아니고 문서 정확도 이슈.

## 위험도

LOW
