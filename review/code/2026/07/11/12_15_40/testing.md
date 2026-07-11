# 테스트(Testing) 리뷰 — commit dedc411fd (FRESH, 선행 리뷰 11_44_59 HIGH 후속 검증)

대상: commit `dedc411fd7d8222421b28d2174698d679bed12a4`
("refactor(docs,sdk): ai-review 반영 — 가드 실효성(SDK 배선·frontend 스캔·negative)")
검증 방식: 각 주장을 실제로 명령 실행 + 의도적 회귀 주입(negative removal) 으로 실측. 모든 실험은 원상복구 완료(`git status --short` clean).

## 검증 결과 요약 (4개 fix)

| # | 주장 | 검증 결과 |
| --- | --- | --- |
| (1) SDK 배선 | `pnpm --filter @workflow/sdk test`/`build` 가 harness 에 배선되어 실제로 실행됨 | **PASS** (test 33/33, build green) — 단, "build(tsc)가 negative @ts-expect-error 를 검증한다"는 **claim 은 실측상 거짓** (아래 CRITICAL 참조). 실제 검증 주체는 `test`(ts-jest) |
| (2) frontend 스캔 | `spec-links.ts` `CODEBASE_SOURCE_ROOTS` 에 `codebase/frontend/src` 추가, 가드 green, 링크 정정, 백틱 예시 오탐 배제 | **PASS** — 전부 실측 확인 (아래 상세) |
| (3) widget @ts-expect-error negative | 현재 아무것도 타입체크 안 함(정직하게 라벨링됨)이 맞는지 | **PASS**(정직성) 이나 **새 결함 발견**: 설명 주석 자체가 `@ts-expect-error` 지시어로 오인식되어 `tsc` 상 `TS2578 Unused directive` 에러 유발 (아래 CRITICAL 참조) — C2 배선 시점에 즉시 터질 self-inflicted 버그 |
| (4) `NonNullable<...>` | `nodeOutput: undefined` 를 실제로 거부하는지 | **PASS** — `tsc` 로 실측: `undefined` 대입 시 `TS2322` 발생 확인 |

---

## 발견사항

### [CRITICAL] SDK "build 검증" claim 이 실측과 다르다 — `tsc` 는 `client.spec.ts` 를 아예 컴파일하지 않는다

- 위치: `codebase/packages/sdk/tsconfig.json:18` (`"exclude": ["node_modules", "dist", "**/*.spec.ts"]`), commit 메시지 "SDK build=tsc 라 이제 negative @ts-expect-error 까지 build 로 검증된다", `review/code/2026/07/11/11_44_59/RESOLUTION.md:31`("build | PASS — SDK `tsc` 가 negative `@ts-expect-error` 검증")
- 상세: `pnpm --filter @workflow/sdk build` 는 `tsc`(무인자, 로컬 `tsconfig.json` 사용)를 실행하는데 이 tsconfig 는 `**/*.spec.ts` 를 **exclude** 한다. 실측(`tsc --listFiles`): 컴파일 대상은 `client.ts`/`signature.ts`/`index.ts` 3개뿐이고 `client.spec.ts` 는 목록에 없다. `dist/` 에도 `client.spec.js`/`.d.ts` 가 생성되지 않는다.
  - **회귀 주입 실험**: `client.spec.ts` 의 `// @ts-expect-error — ButtonsContext 인데 buttonConfig 필드가 없다.` 한 줄을 삭제한 뒤
    - `pnpm --filter @workflow/sdk build` → **exit 0 (green, 미검출)**
    - `pnpm --filter @workflow/sdk test` → **FAIL** (`TS2741: Property 'buttonConfig' is missing...`), 실제로 negative 를 잡는 것은 `test`(jest+ts-jest, 타입체크 O — `isolatedModules` 미설정 확인)이다.
  - 즉 "SDK build=tsc 가 negative 를 검증한다"는 커밋 메시지·RESOLUTION.md 의 핵심 주장은 **틀렸다**. 실제로 가드가 발화하는 통로는 `cmd_unit`(`test`) 뿐이며, `cmd_build` 의 `pnpm --filter @workflow/sdk build` 추가는 (일반적인 컴파일 오류는 잡아주지만) **negative `@ts-expect-error` 검증에는 아무 기여가 없다.**
- 영향: 현재는 `cmd_unit` 에 SDK `test` 가 이미 배선돼 있어 **실질적 가드는 작동한다** (risk 는 완화됨). 그러나 문서화된 근거가 사실과 다르면, 향후 누군가 "build 가 이미 커버하니 unit 에서 SDK test 를 빼도 된다"고 오판할 위험이 있다 — 바로 이 PR 이 고치려던 "가드가 조용히 무력화되는" 패턴의 재발 경로다.
- 제안: 커밋 메시지/RESOLUTION.md 문구를 "SDK 는 `test`(ts-jest 타입체크)로 negative 를 검증한다. `build`(tsc) 는 `**/*.spec.ts` 를 exclude 하므로 spec 파일의 타입 오류는 잡지 않는다"로 정정. 또는 `tsconfig.json` 의 `exclude` 에서 `**/*.spec.ts` 를 빼고 `dist` 에 테스트 산출물이 안 들어가도록 별도 `tsconfig.build.json` 을 분리해 실제로 build 가 spec 을 체크하게 만들 것.

### [WARNING] channel-web-chat 의 새 설명 주석이 `@ts-expect-error` 지시어로 오인식되어 `TS2578` 유발 (self-inflicted, C2 배선 시 즉시 터짐)

- 위치: `codebase/channel-web-chat/src/lib/eia-events.test.ts:265`
  ```ts
  it("잘못된 shape 은 타입 거부 — union 닫힘 고정 (negative)", () => {
    // @ts-expect-error 들은 vitest run(esbuild 타입 strip)에선 no-op 이고, `tsc --noEmit`
    // (typecheck) 에서 검증된다 — union 이 open map 으로 되돌려지면 이 expect-error 가
    // "사용되지 않음" 으로 tsc red 가 된다.
    // @ts-expect-error — ButtonsContext 인데 buttonConfig 필드가 없다.
    const missingButtons: ButtonsContext = { interactionType: "buttons", waitingNodeId: "n" };
    ...
  ```
- 상세: 265번 줄의 **설명용** 주석이 문자 그대로 `// @ts-expect-error` 로 시작한다. TypeScript 는 주석이 `@ts-expect-error` 로 시작하면 (뒤에 이어지는 설명 텍스트와 무관하게) 실제 지시어로 파싱한다. 이 지시어는 바로 다음 줄(266번, 또 다른 설명 주석)에 타입 오류가 없으므로 **미사용 지시어**로 처리된다.
  - 실측: `pnpm --filter channel-web-chat typecheck` (`tsc --noEmit`) 실행 결과
    ```
    src/lib/eia-events.test.ts(265,5): error TS2578: Unused '@ts-expect-error' directive.
    ```
    이 파일은 이번 커밋에서 신규 추가된 블록이므로(diff 확인), 이 에러는 **이번 커밋이 새로 만든 결함**이며 RESOLUTION.md/followups 플랜이 언급하는 "pre-existing red"(`presentation.test.ts` 2건, `use-widget-eager-start.test.ts` 3건 — 이번 커밋이 건드리지 않은 파일이라 pre-existing 맞음)와는 무관한 **4번째, 새로운** 에러다.
  - `plan/in-progress/eia-context-schema-followups.md` §"리뷰 후속" 의 C2 항목은 pre-existing red 를 "`use-widget-eager-start.test.ts` EventSource mock 타입 에러 3건"으로만 언급하고, 이 신규 `TS2578` 은 언급하지 않는다 — 후속 작업자가 typecheck 를 배선할 때 "예상 못 한 4번째 에러"로 혼동하거나, 최악의 경우 진짜 negative 지시어(268/270번 줄)를 실수로 지워버릴 위험이 있다.
- 영향: 현재 하네스(`cmd_lint`/`cmd_unit`/`cmd_build`)는 channel-web-chat 에 대해 `typecheck` 를 호출하지 않고(`eslint`+`vitest`(esbuild, 타입 strip)+`next build`(실측: 이 파일을 타입체크 대상에 포함하지 않음 — 아래 참고) 만 실행), `next build` 도 이 에러를 잡지 않음을 실측 확인했다(`next build` green, "Running TypeScript... Finished" 라 표시되지만 앱 그래프에 포함되지 않는 독립 `.test.ts` 파일은 검사 대상에서 빠지는 것으로 보임). 따라서 **지금 당장 CI/harness 를 깨뜨리지는 않지만**, 이 커밋이 스스로 "정직하게 라벨링했다"고 주장하는 negative 케이스 코드 자체에 흠이 있다는 뜻이다.
- 제안: 265번 줄 설명 주석을 `@ts-expect-error` 로 시작하지 않도록 재작성(예: "이 negative 케이스들은 vitest run(esbuild 타입 strip)에선 no-op..."로 어순 변경). C2(typecheck 배선) 착수 전에 고쳐두지 않으면 배선 즉시 실패한다.

### [INFO] `NonNullable<WaitingForInputEvent["nodeOutput"]>` — `undefined` 거부 실측 확인 (fix 정상 동작)

- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:154`
- 상세: `WaitingForInputEvent.nodeOutput` 은 optional(`nodeOutput?: {...}`, `eia-types.ts:93`)이라 원래 `NodeOutputContext.nodeOutput` 타입도 `| undefined` 를 포함했다. `NonNullable<...>` 적용 후 실측(scratch 파일로 `nodeOutput: undefined` 대입 → `pnpm typecheck` 실행 → 정리):
  ```
  error TS2322: Type 'undefined' is not assignable to type '{ ... }'.
  ```
  `@ts-expect-error` 를 해당 줄 바로 위에 붙이면 typecheck 가 green 으로 돌아옴(정상 suppress) — `NonNullable` 이 실제로 `undefined` 를 컴파일 타임에 거부함을 확인. 이 fix 자체는 결함 없음.

### [INFO] frontend spec-link 스캔 확장 — 실측 green + negative 주입으로 발화 확인

- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:252`(`CODEBASE_SOURCE_ROOTS`), `spec-link-integrity.test.ts`
- 상세:
  - `npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` → 13/13 pass (기존 "vacuous pass 방지" 카운트 assertion 포함: `collectCodebaseSources(root).length > 100`, 기존 `-api-catalog/` 제외 검증 등 견고).
  - `widgets.tsx:130`, `multi-select-widget.test.tsx:3` 링크의 `../` depth 를 `path.resolve` 로 직접 계산 → 둘 다 실존 파일 `spec/4-nodes/3-ai/0-common.md` 로 정확히 해석됨. `§11` 앵커도 실존(`## 11. AI 노드 시스템 프롬프트 자동 prefix`) 확인.
  - **회귀 주입 실험**: `widgets.tsx` 의 `../` 를 하나 제거해 원래의 깨진 링크로 복구한 뒤 재실행 → 가드가 정확히 `[DEAD] codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx:130 -> ...` 로 실패함을 확인(즉 "frontend/src 를 이제 실제로 스캔한다"는 주장이 vacuous 하지 않음). 이후 원상복구, 재실행하여 green 재확인.
  - `spec-links.ts:242` 주석 속 백틱 예시(`` `[..](../../../../spec/....md)` ``): `extractLinks()` 가 인라인 코드(백틱 페어)를 정규식으로 먼저 제거한 뒤 링크를 추출하므로 이 예시는 링크 후보에서 배제된다. 이 파일 자체가 `codebase/frontend/src/lib/docs/__tests__/` 하위라 `collectCodebaseSources` 스캔 범위에 포함되는데도(스캔 범위 확인됨) 전체 스위트가 0 violation 으로 green 인 것이 간접 증거이며, 로직(정규식 backtick 스트립 → LINK_RE 매칭)으로도 직접 확인됨 — **오탐 아님**, 주장대로 배제됨.

### [INFO] SDK negative test 자체의 논리(assertion)는 견고함

- 위치: `codebase/packages/sdk/src/client.spec.ts:42-51`
- 상세: `missingButtons`/`neither` 두 케이스 모두 실제 타입 계약 위반을 정확히 짚고 있고(필수 필드 누락, 두 판별 키 모두 부재), `ts-jest` 가 `isolatedModules` 없이 기본 타입체크 모드로 동작함을 실측했으므로(위 CRITICAL 항목의 negative-removal 실험에서 `TS2741` 로 정확히 캐치) `test` 경로를 통한 가드는 신뢰할 수 있다. 다만 이 신뢰가 "test" 를 통해서만 성립하고 "build" 를 통해서는 성립하지 않는다는 사실이 문서화되지 않은 점이 위 CRITICAL 의 핵심.

---

## 회귀 테스트(regression) 관점

- (1)(2)(4) 는 모두 negative-injection 실험으로 "가드가 실제로 빨간불이 되는지" 직접 확인했다 — 이번 리뷰의 핵심 요구("prove the negatives actually fire")를 충족.
- (3) 위젯 쪽은 harness 상 여전히 미검증(vitest 는 타입 strip, `next build` 는 독립 test 파일을 검사 대상에서 제외하는 것으로 실측됨) — 이는 커밋이 스스로 인정한 deferred 상태이므로 "overclaim" 은 아니다. 다만 그 안에 심어진 `TS2578` 자기유발 결함은 새로운 이슈로, C2 착수 시점에 예상치 못한 실패를 야기할 것이 실측으로 확실하다.
- 기존 테스트(33 SDK 유닛, 13 spec-link-integrity, 기존 eia-events 테스트들)는 이번 변경 후에도 전부 green — 회귀 없음.

## 테스트 격리·가독성

- 모든 negative 케이스가 독립 `it()` 블록으로 분리되어 있고 주석으로 의도(왜 `@ts-expect-error` 인지)를 설명하려는 시도는 좋으나, 바로 그 설명 주석이 TS 파서와 충돌한 것이 이번 리뷰의 핵심 발견이다 — `@ts-expect-error` 관련 설명 주석을 작성할 때는 반드시 그 정확한 3-token 시퀀스로 줄을 시작하지 않도록 하는 규칙이 팀 컨벤션(또는 lint rule)으로 필요해 보인다.

---

## 요약

핵심 목표("가드가 실제로 발화하는지")는 4개 항목 중 3개(frontend 스캔, NonNullable, SDK test 를 통한 negative 검증)에서 실측으로 확인됐고 전부 정상 동작한다. 다만 SDK 쪽 fix 의 근거 서술("build=tsc 가 negative 를 검증한다")은 tsconfig 의 `**/*.spec.ts` exclude 때문에 실측상 거짓이며, 실제 검증 주체는 `test`(ts-jest)다 — 현재는 `cmd_unit` 배선 덕분에 실질적 위험은 낮지만 문서/커밋 근거가 틀려 있어 향후 오판의 소지가 있다(CRITICAL). 또한 channel-web-chat(widget) 쪽에 추가된 negative 케이스의 설명 주석이 `@ts-expect-error` 지시어로 오인식되어 `tsc --noEmit` 상 새 `TS2578` 에러를 유발하는 self-inflicted 결함을 발견했다 — 현재 하네스에는 영향 없지만(typecheck 미배선), 후속 plan(C2)에 등재된 "pre-existing red 3건"에 포함되지 않은 4번째 새 에러이므로 C2 착수 전에 반드시 정정이 필요하다(WARNING).

## 위험도

MEDIUM

(핵심 가드 로직 자체는 실측으로 검증되어 정상 작동하나, SDK 쪽 근거 문서의 사실 오류와 widget 쪽 self-inflicted TS2578 결함은 "가드 실효성 확보"라는 이번 커밋의 목적을 부분적으로 훼손하며, 방치 시 향후 유지보수자를 오도할 수 있어 HIGH 로 격상될 소지가 있다. 즉시 서비스 영향은 없어 CRITICAL 은 아님.)

STATUS: SUCCESS
