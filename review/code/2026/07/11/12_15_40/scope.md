# 변경 범위(Scope) 리뷰 — commit `dedc411fd` (fresh, review 11_44_59 반영분)

대상: `git show dedc411fd` (worktree `eia-client-context-types-33e771`).
diff base: 직전 리뷰 세션 `review/code/2026/07/11/11_44_59/`(SUMMARY.md·RESOLUTION.md) 적용분.

## 변경 파일 인벤토리 (17개, 전량 확인)

코드 7개 + plan 1개 + 이전 리뷰 세션 아티팩트 신규 커밋 9개:

| 구분 | 파일 |
|---|---|
| harness 배선 | `.claude/test-stages.sh` |
| 코드 fix | `codebase/channel-web-chat/src/lib/eia-events.test.ts`, `codebase/channel-web-chat/src/lib/eia-types.ts`, `codebase/frontend/.../auto-form/__tests__/multi-select-widget.test.tsx`, `codebase/frontend/.../auto-form/widgets.tsx`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`, `codebase/packages/sdk/src/client.spec.ts` |
| plan | `plan/in-progress/eia-context-schema-followups.md` |
| review 아티팩트(신규 add) | `review/code/2026/07/11/11_44_59/{RESOLUTION.md,SUMMARY.md,_retry_state.json,api_contract.md,maintainability.md,meta.json,scope.md,side_effect.md,testing.md}` |

review/ 아티팩트를 같은 커밋에 함께 add 하는 것은 이 프로젝트의 확립된 관례("review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋", plan 체크박스=실제 상태 규약)와 일치 — scope 위반 아님.

`.github/**` 등 CI 설정 파일은 전혀 건드리지 않음(커밋 메시지가 명시적으로 CI trigger 확대를 deferred 로 남긴 것과 일치).

---

## 발견사항

### [INFO] 순수 범위(8개 체크리스트) 관점에서는 클린 — 파일셋이 커밋 메시지가 주장하는 4개 조치(C1·W-scan-frontend·W-negative-test·maint-nodeOutput)와 1:1로 정확히 대응

각 파일의 diff 는 정확히 하나의 claim 만 건드린다:
- `.claude/test-stages.sh`: `cmd_unit`/`cmd_build` 에 `pnpm --filter @workflow/sdk test`/`build` 2줄 추가 — C1.
- `spec-links.ts`: `CODEBASE_SOURCE_ROOTS` 에 `"codebase/frontend/src"` 1줄 추가 — W-scan-frontend.
- `widgets.tsx:130`, `multi-select-widget.test.tsx:3`: `../` 깊이 1단 보정(각각 6→7, 7→8) — W-scan-frontend 정정. 실측: `widgets.tsx` 위치(`codebase/frontend/src/components/editor/settings-panel/auto-form/`)에서 repo root 까지 7단, `multi-select-widget.test.tsx` 위치(`.../auto-form/__tests__/`)에서 8단 — **깊이 계산 정확함을 직접 검증**.
- `eia-events.test.ts`, `client.spec.ts`: negative `@ts-expect-error` 케이스 1개씩 추가 — W-negative-test.
- `eia-types.ts`: `NonNullable<...>` 래핑 1줄 — maint-nodeOutput.

드라이브바이 리팩터링·불필요한 포맷팅·주석 정리·무관한 임포트 변경은 발견되지 않음. 각 diff hunk 가 최소 크기로 해당 finding 에만 정확히 대응한다.

### [WARNING] 커밋 메시지·RESOLUTION.md 의 핵심 기술 주장("SDK 는 build=tsc 라 negative 가 build 로 검증된다")이 실측과 다르다 — 실제 검증 주체는 `test`(jest/ts-jest), `build`(tsc) 아님

- 위치: 커밋 메시지 본문("SDK build=tsc 라 이제 negative `@ts-expect-error` 까지 build 로 검증된다", 2회 반복), `RESOLUTION.md` W-negative-test 행("SDK 는 build=tsc 로 즉시 검증"), `client.spec.ts` 신규 주석("SDK 는 build=tsc 라 이 `@ts-expect-error` 가 build 로 검증된다").
- 상세: `codebase/packages/sdk/tsconfig.json` 은 `"exclude": ["node_modules", "dist", "**/*.spec.ts"]` — `client.spec.ts` 자체가 `tsc` 컴파일 대상에서 제외된다. 이는 사실 직전 리뷰(`testing.md` C1)가 이미 명시한 사실("`tsconfig.json`의 `exclude: ["**/*.spec.ts"]`는 `tsc` 빌드에만 적용되고 ts-jest 컴파일에는 영향을 주지 않는다")과 정확히 배치된다.
  실증: worktree 안에서 `client.spec.ts` 의 negative 케이스를 의도적으로 "유효한(타입 통과하는) shape" 으로 바꿔(`@ts-expect-error` 가 unused 가 되도록) `pnpm --filter @workflow/sdk build`(tsc) 를 돌리면 **exit 0 로 통과**한다(스펙 파일이 애초에 컴파일 대상 밖이므로). 반면 `pnpm --filter @workflow/sdk test`(jest) 는 즉시 `TS2578: Unused '@ts-expect-error' directive` 로 fail 한다. 실험 후 원상복구, `git status --short` 로 잔존 diff 없음 확인.
  즉 이 negative 테스트를 실제로 검증하는 것은 이번 커밋이 새로 배선한 **`cmd_unit`(`test`)** 이지 **`cmd_build`** 가 아니다. C1 의 실질적 fix(=harness 에 `test` 배선) 자체는 유효하지만, 그 근거로 반복 서술된 "build 가 검증한다"는 문장은 틀렸다 — 커밋 메시지·RESOLUTION.md·소스 주석 3곳에 동일 오류가 퍼져 있어 향후 독자를 오도할 소지가 있다.
- 제안: "SDK 는 `test`(ts-jest) 가 `*.spec.ts` 를 타입체크하므로 이제 harness 로 검증된다"로 정정(주석 1곳 + 커밋 메시지는 이미 확정이라 후속 커밋에서 코멘트만 정정 검토).

### [WARNING] `eia-events.test.ts` 신규 negative 테스트에 자기 자신을 무력화하는 latent 버그 — RESOLUTION.md 의 "typecheck 배선 후 유효" 주장이 성립하지 않는다

- 위치: `codebase/channel-web-chat/src/lib/eia-events.test.ts:264-274`(신규 `it("잘못된 shape 은 타입 거부...")`).
- 상세: 신규 테스트 블록의 설명 주석이 `// @ts-expect-error 들은 vitest run(esbuild 타입 strip)에선 no-op 이고...`로 시작한다 — TypeScript 의 `@ts-expect-error` pragma 인식 규칙은 "`//` 직후(공백 허용) 로 `@ts-expect-error` 가 오는 줄"을 실제 지시어로 취급하므로, 이 **설명용 문장 자체가 의도치 않은 pragma 로 파싱**된다. 이 줄 바로 다음 줄(265) 도 코드가 아닌 또 다른 주석이라 실제로 억제할 에러가 없어 `tsc --noEmit` 이 `TS2578: Unused '@ts-expect-error' directive`(`eia-events.test.ts(265,5)`) 를 낸다.
  실측: `cd codebase/channel-web-chat && pnpm run typecheck` 로 직접 재현(수정 없이 read-only 실행) — 이 에러는 diff 전에는 존재하지 않았던, **이 커밋 자체가 신규로 만든** 에러다(기존 pre-existing red 10건과는 별개로 +1).
  같은 패턴이 `client.spec.ts` 에는 없다 — SDK 쪽 설명 주석은 `// SDK 는 build=tsc 라 이 @ts-expect-error 가 build 로 검증된다 — ...`처럼 `@ts-expect-error` 가 문장 중간에 위치해 pragma 로 오인식되지 않는다(우연히 회피).
  파급: RESOLUTION.md 는 "위젯은 typecheck 배선 후 유효(주석 명시)"라고 적어 두었는데, 실제로는 typecheck 를 배선해도(=C2 완료해도) 이 테스트 자체가 자기 주석 때문에 red 가 된다 — "배선 후 유효" 주장이 거짓이다. 현재는 C2 가 deferred(harness 미배선) 상태라 이 결함이 드러나지 않고 있을 뿐이다.
- 제안: 설명 주석의 첫 줄에서 `@ts-expect-error` 문구를 pragma 로 오인되지 않게 재배치(예: 문장 중간에 넣거나 `ts-expect-error`처럼 `@` 제거)하고, 로컬에서 `pnpm run typecheck` 로 0-error 확인 후 커밋.

### [WARNING] C1 finding 의 제안 범위(`cmd_lint`/`cmd_unit`/`cmd_build`) 중 `cmd_lint` 만 조용히 누락 — 근거는 타당하나 어디에도 기록되지 않음

- 위치: `.claude/test-stages.sh` `cmd_lint()`(미변경) vs 원 finding(`testing.md` C1) 제안문("`.claude/test-stages.sh` 의 `cmd_lint`/`cmd_unit`/`cmd_build` 에도 `@workflow/sdk` 를 포함시킬 것").
- 상세: 이번 커밋은 `cmd_unit`+`cmd_build` 에만 `@workflow/sdk` 를 추가했다. 실측: `pnpm --filter @workflow/sdk lint` 를 직접 실행하면 `eslint.config.(js|mjs|cjs)` 부재로 즉시 fail — SDK 패키지에 flat-config ESLint 설정 자체가 없다(pre-existing, 이 diff 와 무관). `cmd_lint` 에 무심코 추가했다면 harness 가 즉시 새로운 red 로 깨졌을 것이므로, 누락은 결과적으로 옳은 판단이다.
  다만 이 판단 근거(`eslint.config.js` 부재 → pre-existing red)는 C2 deferral 에 쓰인 것과 동일한 논리인데도, `RESOLUTION.md`·`eia-context-schema-followups.md` 어디에도 "`cmd_lint` 는 SDK ESLint 설정 부재로 제외했다"는 기록이 없다. `RESOLUTION.md` C1 행은 "`cmd_unit`+`cmd_build` 에... 추가"라고만 적어, 원 finding 의 3-stage 제안 중 1개를 조용히 축소한 사실 자체가 문서에 드러나지 않는다.
- 제안: `eia-context-schema-followups.md` §리뷰 후속에 "SDK `cmd_lint` 배선(ESLint flat-config 부재로 제외, 설정 추가 후 배선)" 항목을 별도로 추가해 C2 와 동일한 완결성 수준으로 기록.

### [INFO] `eia-context-schema-followups.md` 의 C2 pre-existing-red 카운트("3건")가 실측치와 어긋나고, 이 커밋 자신이 추가한 신규 에러를 반영하지 못함

- 위치: `plan/in-progress/eia-context-schema-followups.md:33`(`use-widget-eager-start.test.ts` EventSource mock 타입 에러 3건).
- 상세: `pnpm run typecheck`(channel-web-chat) 직접 실행 결과 `use-widget-eager-start.test.ts` 만 4개 호출부(97/215/644/797행) × 2에러 = 8에러, `presentation.test.ts` 2에러(143/291행) 를 합쳐 원 리뷰(`testing.md`)가 언급한 "10건" 과 정합한다. followups.md 의 "3건"은 과소 집계이고, 게다가 위 두 번째 WARNING 에서 확인한 이 커밋 자신의 신규 에러(`eia-events.test.ts:265`)까지 더해지면 현재 baseline 은 이미 11건이다. "pre-existing red 라 C2 를 미룬다"는 결론 자체는 여전히 타당하지만 뒷받침 숫자는 커밋 시점 기준으로 stale.
- 제안: 후속 C2 착수 시 followups.md 항목의 카운트를 실측치로 갱신(정보성, 차단 아님).

### [INFO] `RESOLUTION.md`(11_44_59) 에 commit 열이 없음 — 동일 커밋에 신설되므로 self-reference 구조적 한계, 타 RESOLUTION 선례와 형식 상이

- 위치: `review/code/2026/07/11/11_44_59/RESOLUTION.md` 조치 항목 표.
- 상세: repo 내 다른 RESOLUTION.md 다수(`review/code/2026/07/03/08_08_54/RESOLUTION.md` 등)는 `commit` 열로 각 조치의 실제 커밋 해시를 명시한다. 본 RESOLUTION.md 는 fix 코드와 **같은 커밋**(`dedc411fd`)에 신규 add 되므로 작성 시점에 자기 해시를 알 수 없는 구조적 제약이 있어 열 자체가 없다 — 명백한 오류는 아니나 SoT 추적성 관점에서 타 선례 대비 약함.
- 제안: 조치 불필요(구조적 chicken-egg). 굳이 보강하려면 커밋 메시지 자체가 SoT 역할을 하므로 무방.

---

## 요약

파일셋·diff 크기 관점에서 이 커밋은 매우 타이트하다 — 커밋 메시지가 주장하는 4개 조치(C1 SDK 배선, W-scan-frontend, W-negative-test, maint-nodeOutput) 각각에 정확히 대응하는 최소 diff 만 존재하고, 드라이브바이 리팩터링·무관 파일·불필요 포맷팅/주석/임포트 변경은 없다. review 아티팩트 커밋과 plan 후속 등재도 프로젝트 관례에 부합한다. 다만 실측 검증 과정에서 순수 "범위" 를 넘어선 **정확성 문제**를 3건 발견했다: (1) 커밋 메시지·RESOLUTION.md·소스 주석이 "SDK negative 는 build(tsc)로 검증된다"고 반복 주장하지만 `tsconfig.json` 이 `*.spec.ts` 를 build 대상에서 제외해 실제로는 `test`(ts-jest)가 검증 주체다(직접 재현 확인), (2) `eia-events.test.ts` 신규 negative 테스트의 설명 주석이 의도치 않게 실제 `@ts-expect-error` pragma 로 파싱되어 "unused directive" 로 자멸하는 latent 버그가 있어(직접 `tsc --noEmit` 재현), RESOLUTION.md 의 "typecheck 배선 후 유효" 주장이 현재 코드로는 성립하지 않는다, (3) 원 finding 이 제안한 `cmd_lint` 배선이 조용히 누락됐고(근거=SDK ESLint 설정 부재, 실측상 타당) 그 사실이 어디에도 기록되지 않았다. 이들은 "의도 이상의 변경/무관한 수정" 류의 전통적 scope 위반은 아니지만, 커밋이 스스로 내세운 "가드 실효성" 이라는 목적을 부분적으로 훼손하는 정확성·완결성 갭이므로 후속 조치 또는 최소한 문서 정정을 권고한다.

## 위험도

**LOW**

(순수 8-체크리스트 관점의 범위 이탈은 NONE. 다만 커밋 자신의 핵심 주장 중 하나가 실측과 반대이고, 신규 테스트 코드 자체에 latent self-defeating 버그가 있어 향후 C2 착수 시 예상치 못한 추가 실패로 이어질 수 있으므로 WARNING 3건을 근거로 LOW 로 상향.)

STATUS: SUCCESS