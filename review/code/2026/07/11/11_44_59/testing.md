# 테스트(Testing) 리뷰 — `git diff 1682777fe..HEAD` (2 commits)

대상: `feat(web-chat,sdk): EIA getStatus context 를 클라이언트에서도 닫힌 union 으로 정밀화`
(964e887af) + `test(docs): spec-link-integrity 가드를 codebase 소스로 확장 + 깨진 링크 14곳 정정`
(428134b64).

방법론: 두 테스트 표면(A=타입가드 테스트, B=링크 가드)의 주장을 코드 읽기로 끝내지 않고,
worktree 안에서 **실제로 타입을 깨거나 링크를 깨서 각 테스트/CI 스크립트가 실제로 red 가
되는지 실증**했다. 모든 실험은 실행 직후 원본으로 복구했고 (`git status --short` 로
diff 잔존 없음 확인, plan/review 쪽 unrelated 파일만 표시됨), 최종적으로
`codebase/channel-web-chat` 전체 vitest 스위트(299 tests) 를 재실행해 회귀 없음을 재확인했다.

---

## 발견사항

### [CRITICAL] SDK 표면(`packages/sdk`) 의 신규 타입가드 테스트가 어떤 CI/로컬 하네스에도 연결돼 있지 않다

- 위치: `codebase/packages/sdk/src/client.spec.ts` (신규 `describe` 블록), CI 설정
  `.github/workflows/web-chat-checks.yml`, 로컬 하네스 `.claude/test-stages.sh`.
- 상세:
  - `web-chat-checks.yml` 의 trigger `paths`에는 `codebase/packages/sdk/**` 가 포함돼
    PR 이 이 워크플로를 발화시키지만, `jobs.sdk` 스텝은 실제로는
    `pnpm --filter @workflow/web-chat ...` 만 실행한다. `@workflow/web-chat` 은
    **다른 패키지**(`codebase/packages/web-chat-sdk`)이고, 이 diff 가 건드린
    `@workflow/sdk`(`codebase/packages/sdk`)는 lint/typecheck/test/build 어느 스텝에도
    등장하지 않는다.
  - `.claude/test-stages.sh` 의 `cmd_lint`/`cmd_unit`/`cmd_build` 도 동일하게
    `@workflow/web-chat` + `channel-web-chat` 만 실행하고 `@workflow/sdk` 는 전혀
    참조하지 않는다 (`grep -rln "@workflow/sdk" .github .claude Makefile` → 0건).
  - 실증: `client.spec.ts` 의 `ButtonsContext` 리터럴에서 필수 필드 `buttonConfig` 를
    제거한 뒤 `npx jest client.spec.ts` 를 로컬 실행하면 `TS2741` 로 즉시 fail 한다
    (ts-jest 는 기본적으로 실제 타입체크를 수행 — `tsconfig.json` 의
    `exclude: ["**/*.spec.ts"]` 는 `tsc` 빌드에만 적용되고 ts-jest 컴파일에는 영향을
    주지 않는다). 즉 **로컬에서 수동으로 돌리면** 새 테스트는 진짜로 유효하다.
  - 그러나 위 CI/하네스 배선 부재로 인해, `ButtonsContext`/`NodeOutputContext`/
    `WaitingContext` 의 계약을 깨는 회귀(예: `buttonConfig` 를 optional 로 완화,
    discriminator 재도입, 필드 rename)가 향후 PR 로 들어와도 **누구도 자동으로 잡지
    못한다** — 개발자가 우연히 `pnpm --filter @workflow/sdk test` 를 손으로 돌리지
    않는 한 항상 green 으로 보인다.
- 제안: `web-chat-checks.yml` 에 `@workflow/sdk` 전용 job(또는 기존 `sdk` job 안에
  `--filter @workflow/sdk` 스텝 추가)을 신설하고, `.claude/test-stages.sh` 의
  `cmd_lint`/`cmd_unit`/`cmd_build` 에도 `@workflow/sdk` 를 포함시킬 것. 본 diff 범위
  밖의 pre-existing 인프라 갭이지만, 이번 PR 이 바로 그 미연결 패키지에 신규
  테스트를 추가하는 것이므로 반드시 같이 잡아야 하는 이슈.

### [CRITICAL] channel-web-chat 표면 — "캐스트 없이 컴파일된다는 것을 build 로 강제한다" 주장이 현재 실행되는 파이프라인 어디에서도 검증되지 않는다

- 위치: `codebase/channel-web-chat/src/lib/eia-events.test.ts` 신규 `describe`
  ("WaitingContext ... 닫힌 2-variant union") 의 주석("EIA §5.3), "이 값이 컴파일된다는
  것 자체가 ... 고정한다"), CI `web-chat-checks.yml`'s `widget` job, 로컬 `cmd_unit`.
- 상세 (전부 실증):
  1. `package.json`'s `"test": "vitest run"` — vitest 는 esbuild 로 트랜스파일만 하고
     타입체크를 하지 않는다. `ButtonsContext` 리터럴에서 `buttonConfig` 를 제거해도
     `npx vitest run src/lib/eia-events.test.ts` 는 **22/22 전부 통과**했다. 이 스크립트가
     바로 CI `widget` job 의 "Vitest (unit)" 스텝이자 `.claude/test-stages.sh` 의
     `cmd_unit` 이 실행하는 것 — 즉 **CI/하네스가 실제로 돌리는 "test" 경로는 이 신규
     테스트가 주장하는 컴파일 가드를 전혀 검증하지 않는다.**
  2. `package.json` 에 별도 `"typecheck": "tsc --noEmit"` 스크립트가 있고 이건 실제로
     탐지한다 (`buttonConfig` 제거 시 `TS2741` 로 fail 확인). 하지만 CI `widget` job
     (lint → vitest → next build) 에는 이 스텝이 **없다**. `.claude/test-stages.sh` 의
     `cmd_lint`/`cmd_build` 에도 `channel-web-chat typecheck` 호출이 없다 — 즉 이
     package.json 스크립트는 **어디서도 자동 실행되지 않는 dead script** 다.
  3. 더 나아가 CI 주석은 "`next build` (static export) — 위젯 SPA prerender + typecheck
     동반 검증" 이라고 적혀 있으나, `npx next build` 를 실제로 실행해 확인한 결과
     **테스트 파일(`*.test.ts`)은 Next 의 build-time 타입체크 대상에 포함되지 않는다**
     — `buttonConfig` 를 제거한 상태에서도 `next build` 는 `✓ Compiled successfully` +
     `Finished TypeScript` 로 성공했다(같은 조작으로 `tsc --noEmit` 은 fail 했음에도).
     즉 "typecheck 동반 검증" 주석은 테스트 파일에 대해서는 **사실이 아니다.**
  4. 부가 증거: `tsc --noEmit` 을 아무 수정 없이 baseline 으로 돌리면 이미 이 diff 와
     무관한 **10건의 pre-existing 타입 에러**가 있다
     (`src/lib/presentation.test.ts:143,291`, `src/widget/use-widget-eager-start.test.ts:97,215,644,797`
     — 이 diff 가 건드리지 않은 파일들). 이는 `typecheck` 스크립트가 실제로는 아무도
     정기적으로 돌리지 않는 상태임을 강하게 시사한다 — 만약 지금 이 스크립트를 CI에
     연결한다면 이 신규 테스트와 무관한 이유로 즉시 실패할 것이다.
  - 종합: 현재 실행되는 파이프라인(vitest test, next build) 기준으로는 이 신규
    `describe` 블록의 "판별자 재도입 시 tsc red" 라는 핵심 주장이 **거짓**이다.
    `interactionType` 을 discriminator 로 되돌리거나 필수 필드를 완화하는 회귀가
    들어와도, CI 도 로컬 `cmd_unit`/`cmd_build` 도 이를 탐지하지 못한다.
- 제안: (a) CI `widget` job 에 `pnpm --filter channel-web-chat typecheck` 스텝을
  추가하고, (b) 먼저 pre-existing 10건의 타입 에러를 정리해 그 스텝이 green 으로
  시작하게 할 것. 그전까지는 테스트 코드의 주석(§ "build 로 강제한다")을 실제 보장
  수준에 맞게 톤다운하거나, 최소한 이 gap 을 아는 상태로 남겨야 한다.

### [WARNING] "닫힌 union" 을 증명하는 부정 케이스(`@ts-expect-error`)가 없다 — 한쪽 방향만 pin 됨

- 위치: `codebase/channel-web-chat/src/lib/eia-events.test.ts`,
  `codebase/packages/sdk/src/client.spec.ts` 의 신규 `describe` 블록 전부.
- 상세: 모든 신규 케이스는 "이 값이 캐스트 없이 컴파일된다"(허용되어야 하는 값이
  실제로 허용됨)만 pin 한다. 반대로 "허용되면 안 되는 값이 실제로 거부된다"를 pin 하는
  케이스(`// @ts-expect-error` 로 `buttonConfig`/`nodeOutput` 둘 다 없는 객체를
  `WaitingContext` 에 대입 시도 등)는 하나도 없다. 그 결과, 예컨대 누군가 실수로
  `ButtonsContext.buttonConfig` 를 optional 로 완화하거나 `WaitingContextBase` 자체를
  export 해 union 대신 쓰는 회귀를 내더라도, 기존 리터럴들은 여전히
  (superset 이므로) 문제없이 컴파일되기 때문에 **어떤 신규 테스트도 이 회귀를 잡지
  못한다.** "닫힌 2-variant union" 이라는 타입 설계 의도의 절반(포함 방향)만
  회귀 가드가 있고, 나머지 절반(배제 방향)은 무방비다.
- 제안: `// @ts-expect-error` 케이스를 최소 1개 추가 —
  `const bad: WaitingContext = { interactionType: 'buttons', waitingNodeId: 'n' };`
  처럼 두 판별 필드가 모두 없는 객체를 대입해 실제로 tsc 가 거부하는지를 pin.
  (`@ts-expect-error` 무효화 시 `tsc`/ts-jest 가 "Unused '@ts-expect-error' directive"
  로 알려주므로 이 자체가 회귀 가드가 된다.)

### [WARNING] spec-link-integrity 신규 codebase-scan 가드가 정작 그 버그가 발생한 영역(백엔드 전용 PR)에서는 CI 트리거되지 않는다

- 위치: `.github/workflows/frontend-checks.yml`'s `on.pull_request.paths` /
  `on.push.paths`, `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`.
- 상세: 새 `findBrokenSpecLinksInSources` 가드는
  `codebase/{backend,channel-web-chat,packages}` 의 `.ts`/`.tsx` 를 스캔하지만, 이
  테스트 자체는 `codebase/frontend/**` 아래(`spec-link-integrity.test.ts`)에 있고
  vitest 로 `pnpm --filter frontend test` 가 돌려야 실행된다. 이 명령을 부르는 유일한
  CI 워크플로는 `frontend-checks.yml` 인데, 그 trigger `paths` 는
  `codebase/frontend/**` / `codebase/packages/**` / lockfile 뿐이다 —
  **`codebase/backend/**` 와 `codebase/channel-web-chat/**` 는 포함돼 있지 않다.**
  다른 워크플로(`e2e.yml`, `web-chat-checks.yml`)는 이 vitest 스위트를 실행하지 않는다
  (`e2e.yml` 은 backend Jest e2e/Playwright 뿐, `web-chat-checks.yml` 은
  `@workflow/web-chat`/`channel-web-chat` 자체 vitest 만 돈다).
  - 결정적으로, 이 가드 도입의 동기로 커밋 메시지가 언급한 재발 사례
    (`codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 의
    off-by-N 링크, PR #904)는 **backend-only 파일**이다. 즉, 오늘 이 가드가 존재해도,
    누군가 backend(또는 channel-web-chat) 파일 하나만 건드리는 PR 로 정확히 같은
    버그 클래스(off-by-N `../`)를 재도입하면, `frontend-checks.yml` 자체가
    발화하지 않아 이 신규 가드는 **실행조차 되지 않는다.** (본 diff 는 우연히
    frontend 쪽 테스트 파일도 함께 수정했기 때문에 이번엔 트리거됐다.)
- 제안: `frontend-checks.yml` 의 `paths` 에 `codebase/backend/**`,
  `codebase/channel-web-chat/**` 를 추가하거나(과잉 트리거 우려 있음), 더 나은 방향으로
  이 codebase-source 가드를 별도의 경량 워크플로(또는 `web-chat-checks.yml`/기존
  backend CI)로 옮겨 그 소스 루트 변경과 1:1로 트리거되게 할 것.

### [WARNING] bracket 링크만 검사 — `@see spec/....md` 같은 non-bracket 참조는 완전히 사각지대

- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의
  `LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g` (기존 로직 재사용, 신규 함수도 동일 정규식에
  의존).
- 상세: 이 가드가 스캔 대상으로 삼는 세 루트(`backend/src`, `channel-web-chat/src`,
  `packages`) 안에서, `grep -rnE '@see spec/[^ ]+\.md'` 로 확인한 결과 **15건의
  bare(대괄호 없는) `@see spec/....md` JSDoc 참조**가 이미 존재한다 — 그중 여럿은 바로
  이 diff 가 건드린 파일(`chat-channel/types.ts`, `chat-channel-config.dto.ts`)
  안에 있다(예: `@see spec/conventions/secret-store.md §1`). `extractLinks()` 는
  `[text](url)` 마크다운 링크 syntax 만 추출하므로 이런 bare 참조는 DEAD 여부를 절대
  검사하지 않는다. commit 메시지의 스코프 설명("in-repo markdown links")과 일관되긴
  하지만, 이 코드베이스의 실제 spec 인용 관례 중 상당수가 이 형식이라 커버리지
  체감 격차가 크다.
- 제안: 최소한 spec-impl-evidence.md §4.2 문서에 "`@see`-bare 참조는 스코프 밖"을
  명시하거나, 정규식을 `@see spec/....md` 패턴까지 확장하는 후속 검토.

### [WARNING] `codebase/frontend/src` 자체는 신규 가드의 스캔 루트에서 빠져 있다

- 위치: `spec-links.ts` 의 `CODEBASE_SOURCE_ROOTS = ["codebase/backend/src",
  "codebase/channel-web-chat/src", "codebase/packages"]`.
- 상세: `grep -rhE '\]\([./]*spec/[a-zA-Z0-9_./-]+\.md' codebase/frontend/src` 로
  확인한 결과, frontend 자신도 정확히 같은 실패 모드(손으로 센 `../` 깊이의 bracket
  spec 링크, 예: `` [Spec AI Common §11](../../../../../../spec/4-nodes/3-ai/0-common.md) ``)
  를 이미 다수 갖고 있다. 이 가드가 보호하려는 대상이 정확히 "hand-counted `../`
  depth drift" 인데, 그 실패 모드가 나타나는 가장 큰 코드베이스(frontend)가 스캔
  루트에서 빠진 것은 앞뒤가 맞지 않는다. 커밋 메시지도 이 배제를 설명하지 않는다
  (backend/web-chat/packages 만 언급).
- 제안: `CODEBASE_SOURCE_ROOTS` 에 `codebase/frontend/src` 추가 검토 (frontend 는
  이미 이 vitest 스위트에 속해 있어 CI 트리거 문제도 없다 — 위 항목과 달리 이건
  순수하게 스코프 누락).

### [INFO] 멀티라인으로 쪼개진 마크다운 링크는 정규식 특성상 조용히 스킵된다 (latent, 미현시)

- 위치: `spec-links.ts` 의 `extractLinks()` — `LINK_RE` 를 라인 단위로 적용
  (`for (let i = 0; i < lines.length; i++) { ... noCode ... LINK_RE.exec(noCode) }`).
- 상세: `[text](url)` 형태가 한 줄 안에서 완결돼야만 매칭된다. 이 diff 의
  `chat-channel/types.ts` 처럼 여러 줄짜리 JSDoc SoT 블록(`* - [..](url)\n *   / [..](url)`)
  은 각 링크 자체는 한 줄 안에 있어 현재는 문제없지만, 만약 향후 누군가 매우 긴 단일
  링크(`[아주 긴 설명](../../../../spec/....md#아주-긴-anchor)`)를 사람이 줄바꿈해
  포맷하면 그 줄은 두 조각 다 `LINK_RE` 매칭에 실패해 **조용히 검사 대상에서
  빠진다**(에러도, 스킵 로그도 없음) — DEAD/ANCHOR 여부와 무관하게 그냥 무시됨.
  현재 코드베이스에서 실제로 발생한 사례는 못 찾았으나(현 스캔은 clean), 이 가드가
  타깃하는 정확한 실패 클래스(수작업 포맷)를 감안하면 latent risk 로 남겨둘 만하다.
- 제안: 조치 불필요 수준의 낮은 확률이나, 후속 pass 시 JSDoc 블록을 join 해서 스캔하는
  방식으로 강화 고려.

### [INFO] SDK `getStatus()` 는 런타임 스키마 검증이 전혀 없다 — 신규 테스트는 순수 컴파일 계약만 pin

- 위치: `codebase/packages/sdk/src/client.ts`'s `getStatus()` → `parseJsonOrThrow` →
  `unwrapData<T>(await res.json())` (`return parsed as T`, `unwrapData` 내부 unchecked
  cast). 이는 diff 이전부터 있던 정책("응답 schema 검증은 호출자 책임")이라 이 PR 이
  만든 문제는 아니다.
- 상세: 신규 `describe('ExecutionStatus.context ...')` 는 손으로 만든
  `ButtonsContext`/`NodeOutputContext` 객체 리터럴이 `WaitingContext` 에 대입 가능함을
  확인할 뿐, `client.getStatus()` 를 실제로 fetch-mock 해서 `context` 필드가 포함된
  JSON 응답을 파싱시키는 케이스는 없다(기존 `'getStatus — GET status'` 테스트의
  mock body 에도 `context` 가 없음). 즉 "타입이 wire 를 정확히 반영한다"는 주장은
  컴파일러 수준에서만 검증되고, 실제 `fetch → json() → cast` 경로가 그 타입과
  일치하는 값을 실어 나르는지는 어떤 테스트도 실행하지 않는다. 백엔드가 런타임에
  형태가 다른 `context` 를 보내도 SDK 는 조용히 통과시킨다(기존 정책이라 이 자체가
  버그는 아니지만, 새 테스트의 "타입 안전" 프레이밍이 주는 신뢰를 과장할 소지).
- 제안: `getStatus` 의 fetch-mock 테스트 하나에 `context: { interactionType: 'buttons',
  waitingNodeId, buttonConfig }` 를 포함한 JSON body 를 흘려 `result.context` 가
  기대한 대로 채워지는지 최소 1건 추가하면 컴파일 계약과 실제 wire 경로 사이의
  간극을 줄일 수 있다.

### [INFO] 실증된 긍정 요소 — DEAD/vacuous-pass 가드는 실제로 동작한다

- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 의
  `"scans a non-trivial codebase source set"` 테스트: `dist` 배제 단언이 실제로
  non-vacuous 함을 확인 — 로컬에 `codebase/packages/sdk/dist`, `codebase/packages/web-chat-sdk/dist`
  가 이미 빌드돼 있고 `.d.ts` 도 `.ts` 확장자 필터에 걸리는 파일들인데, `CODEBASE_SKIP_DIRS`
  의 `"dist"` 배제 덕분에 실제로 제외됨을 확인했다(빈 디렉터리라 우연히 통과하는
  케이스가 아니다).
- `eia-types.ts` 안의 한 SoT 링크에서 `../` 한 단계를 실제로 제거해
  (`../../../../spec/...` → `../../../spec/...`) `findBrokenSpecLinksInSources` 를
  재실행하면 정확한 파일/라인/타깃을 가리키는 DEAD violation 1건이 즉시 나타났다
  — "off-by-N 을 실제로 잡는가"라는 물음에 대해 실증적으로 **예**.
- 커밋 메시지 자체가 이 가드로 실제 ANCHOR 위반 4건(`chat-channel/types.ts` 의 축약
  anchor)을 잡아 고쳤다고 기록하고 있어, ANCHOR 경로도 이미 실전에서 검증됐다.
- fallthrough 케이스(`interactionType:'buttons'` + `nodeOutput`, discriminator 없음
  가드)는 타입 정의상 실질적이다 — `WaitingContextBase.interactionType` 이 두
  variant 모두에서 동일한 3-리터럴 union 이라 구조적으로 discriminator 가 될 수
  없고, 테스트는 이를 정확히 재현한다. 다만 위 WARNING 처럼 "역방향"(무효 조합의
  거부)까지는 pin 하지 못한다.

---

## 관점별 요약

1. **테스트 존재 여부**: 신규 로직(타입, 링크 가드 함수)마다 대응 테스트가 붙어
   있음 — 존재 자체는 충분. 문제는 그 테스트들이 **실행되는 위치**다(위 CRITICAL 2건).
2. **커버리지 갭**: `getStatus()` 실제 fetch 경로의 `context` 필드 미검증(INFO),
   `@see` bare 참조·frontend 소스 미스캔(WARNING 2건).
3. **엣지 케이스**: 양성(허용) 케이스는 충실하나 음성(거부되어야 함) 케이스가 전무
   — union 의 "닫힘"을 절반만 pin.
4. **Mock 적절성**: `fetchImpl` mock 패턴 자체는 기존 관례와 일관되고 적절. 다만 신규
   describe 는 fetch mock 을 아예 쓰지 않고 타입 리터럴만 구성 — 실제 HTTP 응답
   경로와의 괴리(INFO).
5. **테스트 격리**: 두 표면 모두 독립적으로 실행 가능(다른 테스트에 의존 없음).
   link-integrity 계열은 저장소 전체를 스캔하는 설계상 "무관한 파일 변경에도 깨질
   수 있다"는 특성이 있으나 이는 기존 패턴을 그대로 확장한 것이라 새로운 문제는
   아니다.
6. **테스트 가독성**: 주석이 "왜 이 케이스가 필요한가"를 명확히 설명해 의도 파악이
   쉬움 — 특히 fallthrough 케이스 주석은 우수. 다만 "build 로 강제한다"는 문구는
   위 CRITICAL 로 확인했듯 현재 실제 보장 수준보다 과장돼 있어 향후 독자를 오도할
   수 있다.
7. **회귀 테스트**: 기존 스위트(299 tests, channel-web-chat 전체) 재실행 결과 전부
   통과 — 이번 diff 가 기존 테스트를 깨뜨리지 않음을 확인. 다만
   `presentation.test.ts`/`use-widget-eager-start.test.ts` 의 pre-existing 타입
   에러(diff 무관)는 `typecheck` 스크립트가 사실상 방치돼 있다는 방증이라 CRITICAL
   항목의 근거로 함께 인용했다.
8. **테스트 용이성**: `ClemvionClient` 의 `fetchImpl` 주입 구조, `spec-links.ts` 의
   순수 함수 분리(`collectCodebaseSources`/`findBrokenSpecLinksInSources`)는 모두
   테스트하기 쉬운 구조 — 설계 자체는 양호.

---

## 요약

두 테스트 표면 모두 "무엇을" 테스트하는지는 명확하고 개별 assertion 의 의도도
잘 서술돼 있으나, 실제로 worktree 안에서 타입을 깨고 링크를 깨는 실증 실험을 돌려본
결과 **"컴파일/스캔이 실제로 회귀를 잡는다"는 핵심 주장 두 가지가 현재 CI/로컬 하네스
배선 기준으로는 성립하지 않는다**: (1) `packages/sdk` 는 어떤 자동화 경로에도 연결돼
있지 않아 신규 SDK 테스트가 orphan 상태이고, (2) `channel-web-chat` 은 CI 가 실제로
돌리는 `vitest run`/`next build` 어느 쪽도 테스트 파일의 타입 오류를 잡지 못하며 유일하게
잡는 `tsc --noEmit` 스크립트는 아무 데도 연결돼 있지 않을 뿐 아니라 이미 무관한 이유로
red 상태다. link-integrity 가드는 알고리즘 자체는 실증적으로 견고하지만(off-by-N ·
vacuous-pass 방어 모두 확인), CI 트리거 스코프가 자신이 스캔하는 소스 루트
(backend/channel-web-chat)를 커버하지 못해 정작 재발 방지 대상 시나리오(백엔드 전용
PR)에서 무발화할 수 있다는 구조적 결함이 있다. 코드/테스트 자체의 논리적 정확성은
전반적으로 높은 편이라 급히 되돌릴 사안은 아니지만, "테스트가 실제로 실행되고 있는가"
라는 가장 기본적인 질문에서 3건의 구조적 gap 이 나왔으므로 CI/하네스 배선 보강을
권고한다.

## 위험도

**HIGH**

(코드 로직 자체의 결함이 아니라 "테스트가 실행되지 않아 무력화된다"는 인프라
배선 문제이므로 CRITICAL 보다는 한 단계 낮게 책정했으나, 세 가지 독립된 구조적
gap 이 모두 "이 diff 가 새로 추가한 회귀 가드가 실질적으로 발화하지 않을 수 있다"는
동일한 결론으로 수렴해 HIGH 로 평가한다.)

STATUS: SUCCESS
