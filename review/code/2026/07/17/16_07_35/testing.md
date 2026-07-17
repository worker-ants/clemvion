# 테스트(Testing) 리뷰

## 진행 방식에 대한 선행 메모

`prompt_file` 에 첨부된 diff 는 `review/consistency/**` 산출물 4개 + `spec/**` 문서
3개뿐이며, 이 PR 의 실제 핵심 코드(`codebase/packages/ai-end-reason/**`,
`codebase/frontend/src/lib/conversation/interaction-type-registry.ts`,
`output-shape.ts`, backend 3파일, CI/Dockerfile 배선)는 **payload 에 전혀 포함돼
있지 않다** — 오케스트레이터의 diff 수집이 `codebase/**` 를 놓친 것으로 보인다
(과거에도 관찰된 diff-scope 누락 패턴). 지시받은 점검 관점 (a)~(e) 는 전부
`codebase/**` 코드를 요구하므로, `git diff main..HEAD` 와 실제 워크트리 파일을
직접 읽고 **mutation 을 직접 주입해 tsc/jest 를 재실행**하는 방식으로 검증했다
(주입한 mutation 은 검증 직후 원본과 diff 0 으로 복원 확인 완료).

추가로, 리뷰 수행 중 브랜치 HEAD 가 진행됐다 — 리뷰 시작 시점 최신 커밋은
`f0ef4a821`(패키지 신설)·`9df2bb42f`(spec 갱신)이었으나, 검증 도중 `b04ddc258`
(`test(ai-end-reason): 패키지 테스트 신설`)이 새로 커밋되어 **(c) 의 핵심 갭이
검증 도중 해소**되는 것을 실시간으로 관찰했다. 아래 발견사항은 **현재 HEAD
(`b04ddc258`) 기준**으로 작성하되, 해소 전 상태가 CI 에 미쳤을 실제 영향도 함께
기록한다(재발 방지 관점에서 유의미).

## 발견사항

- **[WARNING]** `output-shape.test.ts` 의 endReason 회귀 테스트가 신규 7번째 값(`timeout`)을 검증하지 않고, SoT 를 import 하지 않은 채 여전히 로컬 하드코딩 — E-4 의 "동작·조건은 무변경" 주장과 실측이 어긋남
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:579-602` (`it("accepts every unified endReason as a conversation terminal", ...)`), 비교 대상 `plan/in-progress/is-conversation-output-restructure.md` E-4(`isConversationOutput` 의 동작·조건은 무변경)
  - 상세: 이 PR 전 `output-shape.ts` 의 `CONVERSATION_END_REASONS` 는 6개 값(`completed/user_ended/max_turns/max_retries/condition/error`)의 하드코딩 `Set` 이었다. 이 PR(E-4)이 그 하드코딩을 삭제하고 `@workflow/ai-end-reason` 의 `CONVERSATION_END_REASONS`(7개 값 — `timeout` 추가)로 교체했다. 그런데 이 테스트는 여전히 옛 6개 값을 로컬 배열(`const endReasons = [...] as const`)로 하드코딩하고 있어 (1) 신규 7번째 값 `timeout` 이 실제로 대화로 인식되는지 어디서도 검증되지 않고, (2) 향후 패키지 SoT 가 값을 추가/변경해도 이 프론트 회귀 테스트는 SoT 를 import 하지 않으므로 drift 를 못 잡는다 — 이 PR 이 없애려는 "손으로 베낀 사본" 패턴이 프로덕션 코드(`output-shape.ts`)에서는 제거됐지만 **테스트 코드에는 그대로 남아 있다**. 직접 실측: `endReason: "timeout"` + `output.result.messages` 조합으로 `isConversationOutput()` 을 호출하면 `true` 를 반환한다(신규 동작) — 이 PR 전에는 6개 값 목록에 `timeout` 이 없어 `false` 였을 조합이다. 즉 E-4 가 "동작·조건은 무변경"이라 명시했지만 실제로는 `timeout` 케이스에 한해 동작이 바뀌었고, 그 변화를 검증하거나 최소한 의도적 결정으로 문서화한 테스트가 없다. 실무 위험은 낮다 — `timeout` 은 IE 유니온에 생산자가 없는 죽은 값이라 실제 프로덕션 데이터에는 나타나지 않는다. 그러나 plan 자신이 반복 강조하는 원칙("통과 자체는 검증이 아니다", "일부러 mutation 을 주입해 red 인지 실측")에 비춰보면, 이 회귀 스위트는 새 SoT 의 완전한 계약을 실제로 검증하지 못하는 상태로 남아 있다.
  - 제안: `endReasons` 배열을 `@workflow/ai-end-reason` 의 `CONVERSATION_END_REASONS` 를 직접 import 해 순회하도록 바꾸면 (1) `timeout` 을 포함한 7개 값 전부가 자동으로 커버되고 (2) 향후 패키지가 값을 추가/변경해도 이 테스트가 자동으로 그 값을 검증해 drift 를 잡는다. 최소한으로는 하드코딩 배열에 `"timeout"` 을 추가해 현재 7값을 명시적으로 커버.

- **[WARNING]** `packages-checks.yml` 의 `push.paths` 트리거 목록에 `codebase/packages/ai-end-reason/**` 가 누락 — `pull_request.paths`/`matrix.pkg` 는 정상 반영됐으나 push 트리거만 빠짐
  - 위치: `.github/workflows/packages-checks.yml:17-23` (`push.paths`, 기존 4개 패키지만 나열)
  - 상세: `on.pull_request.paths`(라인 9-16)와 `strategy.matrix.pkg`(라인 39-45)에는 `@workflow/ai-end-reason`/`codebase/packages/ai-end-reason/**` 가 정확히 추가됐다 — PR 단계 CI 게이트는 정상. 그러나 `on.push.branches:[main].paths` 목록에는 여전히 기존 4개 패키지만 있고 `ai-end-reason/**` 이 빠져 있다. 이 PR 의 plan(E-5)이 스스로 "5·6 이 특히 위험하다 — 빌드는 통과하는데 CI 검증만 조용히 사라진다" 고 강조한 패턴과 정확히 같은 계열의 잔여 갭이다 — main 머지 이후 `ai-end-reason/**` 만 단독으로 건드리는 후속 push(예: admin 직접 커밋, squash-merge 후 hotfix)는 이 workflow 의 push 트리거를 발동시키지 못해 재검증되지 않는다. PR 게이트가 있으니 실무 위험은 제한적이나, E-5 가 명시한 검증 항목의 부분 누락이다.
  - 제안: `push.paths` 에도 `'codebase/packages/ai-end-reason/**'` 한 줄 추가.

- **[INFO — 확인 완료, PR 이 만든 문제 아님]** `interaction-type-exhaustiveness.test.ts` 의 grep 가드에 기존부터 있던 사각지대 — 백틱(JSDoc) 인용도 "코드 사이트 등장"으로 오인
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:56-77` (정규식 `` new RegExp(`['"\`]${value}['"\`]`) ``), 실측 대상 `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts:45-56`
  - 상세: (d) "grep 가드가 소스 모듈 import 로 바뀐 뒤에도 유효한가?" 에 대한 답 — **부분적으로만 유효**. 이 PR 은 `ENUM_VALUES`/`SOURCE_ENUM_VALUES` 를 로컬 하드코딩에서 `interaction-type-registry.ts` import 로 바꿨을 뿐 grep 로직 자체는 그대로다. 실측: `use-result-detail-waiting.ts` 의 실제 코드 분기(56행, `waitingInteractionType === "ai_form_render"`)를 임의로 `"ai_form_renderXXX"` 로 깨뜨려도 테스트는 여전히 green — 같은 파일 45·47행 JSDoc 주석의 백틱 인용(`` `ai_form_render` ``)에 정규식이 매칭되기 때문이다. 즉 실제 코드 분기가 깨져도 인접한 문서 텍스트가 있으면 가드가 놓칠 수 있는 false-negative 사각지대가 이 PR 이전부터 존재했고, 소스 모듈 리팩토링 후에도 그대로 남아 있다. mutation 뒤 정상 복원 확인 완료.
  - 제안: (강제 아님, 이 PR 범위 밖) 정규식을 코드 리터럴만 매칭하도록(예: `=== "value"` 형태 우선 매칭 후 fallback) 강화하거나, 최소한 이 사각지대를 테스트 파일 주석에 known-limitation 으로 남겨 다음 사람이 "grep 가드 = 완전한 안전망"으로 과신하지 않게 한다.

- **[INFO]** `interaction-type-exhaustiveness.test.ts` 상단 주석이 리팩토링 후 stale
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:45-47` ("Derive the enum values from the actual TS type... we list the values here as the test SoT and assert each matches the type via a typecheck")
  - 상세: 이 주석은 리팩토링 전(로컬 `ENUM_VALUES` + `_typecheck` 단언이 이 파일 안에 있던 시절) 코드를 설명한다. 지금은 목록도 typecheck 단언도 전부 `interaction-type-registry.ts` 로 이관됐으므로 "여기서 SoT 로 나열하고 typecheck 로 확인" 이라는 서술이 더 이상 사실이 아니다. 기능에는 영향 없으나 다음 사람이 이 파일을 SoT 로 오해할 수 있다.
  - 제안: 주석을 "실제 값 목록·컴파일 타임 단언의 SoT 는 `interaction-type-registry.ts` — 여기서는 그 값을 import 해 REGISTRY_SITES 파일에 대한 grep 가드만 수행한다" 로 갱신.

- **[정보 확인 — mutation 실측 통과]** `@workflow/ai-end-reason` 패키지의 `satisfies` + `Exclude` 양방향 가드 — 누락·과다 모두 red 전환 확인
  - 위치: `codebase/packages/ai-end-reason/src/index.ts:85-95`
  - 검증 내역: 베이스라인 `tsc --noEmit` 0 에러. ① 배열에서 `'timeout'` 을 제거(누락 mutation, `Exclude` 축 검증) → `error TS2322: Type 'true' is not assignable to type 'never'.` (red 확인). ② 배열에 존재하지 않는 `'bogus_extra'` 를 추가(과다 mutation, `satisfies` 축 검증) → `error TS2322: Type '"bogus_extra"' is not assignable to type 'ConversationEndReason'.` (red 확인). 두 mutation 모두 검증 직후 원본으로 복원, 최종 diff 0 확인. (a) 의 답: **양방향 모두 실제로 작동한다.**

- **[정보 확인 — mutation 실측 통과 + tsc 시야 확인]** `interaction-type-registry.ts` 의 `Exclude` 단언들이 실제로 tsc 시야 안에 있고 양방향으로 작동함
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts:22-55`, 대조 `codebase/frontend/tsconfig.json:29-36`(`exclude`)
  - 검증 내역: `tsconfig.json` 의 `exclude` 는 `src/**/__tests__/**` 등 4가지 패턴만 있고, 신규 파일은 `src/lib/conversation/interaction-type-registry.ts` — `__tests__` 디렉터리 밖이라 **exclude 에 걸리지 않는다**(원래 문제였던 `lib/__tests__/interaction-type-exhaustiveness.test.ts` 와 달리). frontend CI(`frontend-checks.yml`)는 `pnpm --filter frontend build`(`next build`)로 전체 모듈 그래프를 typecheck 하므로 이 파일도 대상이다. 베이스라인 `tsc --noEmit -p tsconfig.json` 0 에러. ① `INTERACTION_TYPE_VALUES` 에서 `"ai_form_render"` 제거(누락) → `error TS2322: Type 'true' is not assignable to type 'never'.`(33행) — red 확인. ② 존재하지 않는 `"bogus_extra_value"` 추가(과다) → `error TS2322: Type '"bogus_extra_value"' is not assignable to type 'WaitingInteractionType'.`(28행) — red 확인. 두 mutation 모두 복원 후 diff 0 확인. (b) 의 답: **원래 함정(테스트 파일이라 tsc 가 안 읽던 문제)에 다시 빠지지 않았고, 가드는 실제로 작동한다.**

- **[정보 확인]** (c) 패키지 테스트 부재 문제 — 리뷰 도중 커밋으로 해소, CI 실패 조건도 실측 확인
  - 위치: `codebase/packages/ai-end-reason/src/__tests__/end-reason.spec.ts`(커밋 `b04ddc258`), `package.json`(`"test": "jest"`, `testRegex: ".*\\.spec\\.ts$"`, `--passWithNoTests` 미설정), `.github/workflows/packages-checks.yml:36-37`(`pnpm --filter "${{ matrix.pkg }}" test`)
  - 상세: 리뷰 착수 시점 커밋(`f0ef4a821`)에는 `src/__tests__/` 가 완전히 비어 있었다. 이 상태에서 CI 가 실제로 실패했을지 실측으로 확인: `jest --testPathPatterns='<no-match>'` (테스트 0건 상황 재현) → `No tests found, exiting with code 1` / `Run with --passWithNoTests to exit with code 0`. `package.json` 의 `test` 스크립트에는 이 플래그가 없고 CI 스텝도 플래그를 추가하지 않으므로, **테스트가 0건인 채로 커밋됐다면 `packages-checks.yml` matrix 의 `@workflow/ai-end-reason` job 은 100% 실패했을 것**이다 — 컴파일 타임 단언이 테스트를 대체한다는 논리는 이 CI 배선에서는 성립하지 않는다(오히려 정반대로 CI 를 깨뜨린다). 이후 커밋 `b04ddc258` 이 `end-reason.spec.ts`(5개 테스트: 중복 없음/비어있지 않음/양쪽 노드 도메인 기여/`'out'` 미포함/narrowing)를 추가해 이 문제를 해소했다. 현재 HEAD 기준 실측: `pnpm --filter @workflow/ai-end-reason test` → 5/5 통과. 이 신규 테스트 설계는 견고하다 — "타입 장치가 못 잡는 축"만 다루도록 스스로 범위를 좁혔고, 그 주장을 직접 mutation 으로 검증했다: `CONVERSATION_END_REASONS` 배열에 `'max_retries'` 를 중복 삽입 → `tsc --noEmit` 은 **0 에러로 통과**(타입 시스템이 중복을 못 잡는다는 테스트 파일 자신의 주장이 사실로 확인됨) → 동일 mutation 상태에서 `jest` 실행 시 "중복이 없다" 테스트가 `Expected: 8, Received: 7` 로 **정확히 fail**(red 확인). mutation 은 즉시 복원, 최종 diff 0 확인. (c) 의 답: **컴파일 타임 단언만으로는 부족한 축(중복 탐지, 완전한 부재로 인한 CI red)이 실재했고, 이번 커밋으로 정확히 그 축만 겨냥한 런타임 테스트가 채워졌다.** 다만 "테스트 0건 커밋이 먼저 나가고 CI 가 잠시 빨간 상태로 노출될 뻔했다"는 프로세스 리스크 자체는 기록해 둘 가치가 있다(최종 PR 에는 두 커밋이 함께 포함되므로 실제 노출 여부는 머지 시점의 커밋 스쿼시 여부에 달려 있다).

- **[정보 확인]** (d) 위 WARNING/INFO 참조 — 결론: grep 가드는 소스 모듈 import 전환 후에도 "값 목록 자체의 정확성"은 컴파일 타임 단언(신규 위치)이 보강해 더 신뢰할 수 있게 됐으나, grep 메커니즘 고유의 사각지대(백틱 주석 오매칭)는 그대로 잔존.

- **[정보 확인]** (e) endReason 7값 + messages 조합의 `isConversationOutput` 인식 테스트 — 첫 WARNING 참조. 6/7 값은 기존 테스트로 커버(회귀 유효), 7번째 값(`timeout`)은 미검증.

- **[INFO]** backend 3파일(`ai-turn-executor.ts`/`information-extractor.handler.ts`/`node-handler.interface.ts`) 변경은 순수 타입 치환이라 기존 회귀 테스트가 유효할 것으로 판단되나 전체 backend jest 스위트는 시간 제약상 직접 실행하지 않음
  - 상세: diff 전체가 인라인 유니온 리터럴(`'user_ended' | 'max_turns' | 'condition' | 'error'`)을 named type(`AiAgentEndReason`)으로 바꾸거나, `EndReason` 로컬 alias 의 정의를 그대로 유지한 채 값만 패키지에서 가져오는 형태 — 런타임 분기·값 자체는 무변경이다. `ai-turn-executor.spec.ts`/`information-extractor.handler.spec.ts` 등 기존 테스트 파일은 이번 diff 에 포함되지 않아(git diff 확인) 수정 없이 그대로 통과할 것으로 예상되나, 이 리뷰에서 backend jest 전체 실행까지는 수행하지 못했다 — CI/로컬에서 `pnpm --filter backend test` 로 재확인 권장(형식적 확인일 뿐 위험은 낮다고 판단).

## 요약

이 PR 의 핵심 방어선(`@workflow/ai-end-reason` 의 `satisfies`+`Exclude`, `interaction-type-registry.ts` 의 동일 패턴)은 **양방향(누락/과다) mutation 을 직접 주입해 실측한 결과 모두 정상적으로 red 로 전환됐고**, 특히 `interaction-type-registry.ts` 가 `tsconfig.json` 의 `__tests__` exclude 패턴을 실제로 벗어나 tsc 시야 안에 있음을 확인해 이 PR 의 핵심 발견(원래 테스트 파일에 있던 단언이 tsc 에 안 읽히던 문제)이 재발하지 않았음을 검증했다. "컴파일 타임 단언이 테스트를 대체한다"는 전제는 부분적으로만 성립한다 — 실제로 타입 시스템이 못 잡는 축(배열 중복, 완전한 테스트 부재로 인한 CI 실패)이 실재했고, 리뷰 도중 관찰한 신규 커밋(`b04ddc258`)이 정확히 그 축만 겨냥한 5개 런타임 테스트로 이 갭을 메웠다(mutation 으로 그 테스트의 유효성도 확인). 남은 실질 갭은 두 가지다 — (1) 프론트엔드의 `isConversationOutput` 회귀 테스트(`output-shape.test.ts`)가 여전히 옛 6값을 하드코딩해 신규 7번째 값(`timeout`)의 실제 동작 변화(비인식→인식)를 검증도 문서화도 하지 않고 있고 SoT 를 import 하지 않아 향후 drift 도 못 잡는다(실무 위험은 낮음 — `timeout` 은 죽은 값), (2) `packages-checks.yml` 의 `push.paths` 에 신규 패키지가 등록되지 않아 main 머지 후 단독 push 재검증이 빠진다(PR 게이트는 정상이라 위험 제한적). 기존 grep 가드(`interaction-type-exhaustiveness.test.ts`)는 소스 모듈 import 전환 자체는 문제없이 동작하지만, 백틱 주석 오매칭이라는 PR 이전부터 있던 사각지대가 그대로 남아 있다는 점도 실측으로 확인했다.

## 위험도

LOW
