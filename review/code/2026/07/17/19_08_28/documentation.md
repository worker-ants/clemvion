# 문서화(Documentation) Review

리뷰 대상: `git diff origin/main..HEAD` (누적 diff, 커밋 `a1e2ec8af` + `161699c7a` 포함)
- `codebase/frontend/eslint.config.mjs`
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
- `review/code/2026/07/17/{18_06_36,18_43_17}/**` — CLAUDE.md 정보 저장 위치 표에 따른 정상 산출물 저장 경로. 문서화 결함으로 다루지 않음.

## 검증 방법 (실측 기반)

1. `node`로 실제 `eslint.config.mjs`를 로드해 `Linter#verify`에 5가지 fixture(문자열 리터럴 / 인터폴레이션 없는 백틱 / 인터폴레이션 있는 백틱 / require 문자열 / require 백틱)를 직접 먹여 selector 매칭 여부를 실측.
2. `codebase/frontend/node_modules`를 직접 뒤져 `@typescript-eslint/parser`·`typescript-eslint` 패키지가 frontend 패키지 자체 node_modules 최상위에 존재하는지 확인(phantom-dependency 주장 검증).
3. `git log`로 이 diff에 포함된 두 커밋(`a1e2ec8af`, `161699c7a`)의 커밋 메시지를 코드 주석과 대조.
4. `git show a1e2ec8af:.../eslint-layering-guard.test.ts`로 `RESOLUTION.md`가 인용하는 "23/23" 테스트 수가 **그 시점 커밋**의 실제 테스트 개수와 일치하는지 대조(grep count가 아니라 해당 커밋의 실제 파일 구조를 직접 카운트).
5. `npx vitest run`으로 현재 HEAD의 테스트 파일 전체 통과·개수(34/34) 확인.

## 발견사항 (오케스트레이터 지정 3개 항목 — 전건 검증 완료, 결함 없음)

### 1. `eslint.config.mjs`의 "커버리지 한계" 주석 — 정확함

- 위치: `codebase/frontend/eslint.config.mjs:44-48`
- 주석: "그 우회 경로를 보조로 커버한다 (문자열·백틱 리터럴 specifier 모두). 남은 사각지대: 경로가 **계산값**인 경우... 정적 분석 불가능 영역이라 어떤 규칙도 못 막는다."
- 실측: 실제 config를 로드해 `Linter#verify`에 직접 먹인 결과 —
  - `import("@/components/foo")` (문자열) → 매칭 O
  - `` import(`@/components/foo`) `` (인터폴레이션 없는 백틱) → 매칭 O
  - `` import(`@/components/${n}`) `` (인터폴레이션 있는 백틱, 계산 경로) → 매칭 X (0건)
  - `require("@/components/foo")` / `` require(`@/components/foo`) `` → 둘 다 매칭 O
- 결론: 주석이 서술하는 "문자열·백틱 둘 다 커버 / 계산값만 사각지대" 는 실제 selector 동작과 **정확히 일치**한다. 이전 버전 주석("문자열 리터럴 specifier만 매칭")은 이번 diff가 백틱 지원 추가와 함께 올바르게 갱신했다 — 오래된 주석 아님.

### 2. `literalSpecifier` / `backtickSpecifier` 헬퍼 주석 — 정확함

- 위치: `codebase/frontend/eslint.config.mjs:9-17`
- 주석 내용: (a) 문자열 리터럴은 `Literal` 노드로 `.value`로 비교, (b) 인터폴레이션 없는 백틱은 `TemplateLiteral` 노드라 `.value` 프로퍼티 자체가 없어 `.value` 매칭이 조용히 실패한다 — `quasis[0].value.raw`를 봐야 한다, (c) `expressions.length=0`으로 한정하는 이유는 인터폴레이션 섞이면 계산값이라 정적 분석 대상이 아니기 때문.
- 검증: ESTree 스펙상 `TemplateLiteral`은 `quasis`(각 원소가 `{value:{raw,cooked}}`)와 `expressions` 필드만 가지고 `.value`는 없음 — (b)는 AST 스펙과 정확히 일치. `backtickSpecifier`가 생성하는 selector `[${path}.expressions.length=0][${path}.quasis.0.value.raw=/.../ ]`를 실제 config에서 그대로 실행해 위 표의 결과(백틱-no-interp 매칭 O, 백틱-with-interp 매칭 X)를 얻었으므로 (a)(c) 서술도 selector의 실제 동작과 정확히 부합.
- 결론: 결함 없음.

### 3. 테스트 파일 `tsParser` 추출 주석의 phantom dependency 근거 — 정확함

- 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:36-40`
- 주석: "`@typescript-eslint/parser`를 직접 import 하지 않는 이유: frontend 매니페스트에 선언된 의존이 아니라(전이 의존) `node-linker=isolated`에서 phantom-dependency로 깨진다."
- 실측: `codebase/frontend/node_modules/@typescript-eslint`·`codebase/frontend/node_modules/typescript-eslint` 둘 다 **최상위에 존재하지 않음**(find 결과 0건). 실제로는 워크스페이스 루트 `.pnpm` 가상 스토어의 `eslint-config-next → typescript-eslint(v8, unscoped) → @typescript-eslint/parser` 체인을 통해서만 도달 가능 — frontend `package.json`에 어느 쪽도 직접 선언돼 있지 않음(grep 결과 0건). 따라서 테스트 파일에서 `import "@typescript-eslint/parser"`(또는 `typescript-eslint`)를 직접 시도하면 frontend 패키지 자신의 isolated 트리 경계 밖이라 해석 실패 가능성이 높다는 주장은 실측과 부합.
- 대조: 같은 diff에 포함된 커밋 `161699c7a` 메시지가 코드 주석과 동일한 문구("`@typescript-eslint/parser` 직접 import는 frontend 매니페스트 미선언 전이 의존이라 node-linker=isolated에서 phantom으로 깨짐")를 그대로 사용 — 저자 의도와 코드 주석이 일치.
- 참고(사소, 결함 아님): config가 실제로 `require()`하는 것은 `eslint-config-next`의 `dist/typescript.js`에 하드코딩된 `require("typescript-eslint")`(언스코프드 통합 패키지, v8)이며, 주석이 예시로 든 `@typescript-eslint/parser`(스코프드)는 그 2단계 더 아래 전이 의존이다. 다만 파서 객체의 `meta.name`이 두 경로 모두 `'typescript-eslint/parser'`로 동일하게 보고되고, 어느 쪽이든 frontend 자체 node_modules에는 없어(phantom) 결론(직접 import 불가·config에서 빌려써야 함)은 동일하게 유지된다. 주석의 핵심 주장에 영향 없음 — 굳이 정밀화한다면 "(또는 그 상위 통합 패키지 `typescript-eslint`)"를 덧붙이는 정도이나 우선순위 낮음, 조치 불요.

## 그 외 확인 (참고)

- **RESOLUTION.md의 "23/23" 테스트 카운트 — 실측 대조 결과 결함 아님**: `review/code/2026/07/17/18_06_36/RESOLUTION.md`가 "`eslint-layering-guard.test.ts` 23/23 포함"이라 기록하는데, 현재 HEAD 기준 실행하면 34개 테스트가 통과한다(`npx vitest run` 실측). 얼핏 불일치로 보이나, RESOLUTION.md는 커밋 `a1e2ec8af` 시점의 완료 기록이고 `git show a1e2ec8af:...eslint-layering-guard.test.ts`를 직접 열어 그 시점 파일을 카운트하면 정확히 23개(첫 `it.each` 14 + 둘째 `it.each` 7 + 독립 `it` 2)다. 이후 커밋 `161699c7a`가 백틱·`import type`·re-export·근접오탐 fixture 11개를 추가해 34개가 됐다 — RESOLUTION.md는 append-only 감사 기록(커밋 시점 스냅샷)이지 "현재 상태" 서술이 아니므로 이 불일치는 문서 결함이 아니다(grep count가 아니라 해당 커밋 체크아웃 실측으로 확인).
- CHANGELOG.md — 이번 diff(ESLint 정규식 리팩터 + 테스트 mutation 커버리지 보강)는 미갱신이나, 이 레이어 가드를 최초 도입한 선행 커밋(`e370d1d02`, PR #967)도 CHANGELOG를 갱신하지 않은 선례가 있고 내부 CI/개발 도구 성격이라 제품 동작 영향이 없다. 프로젝트 관례와 일치, 조치 불요.
- README/`spec/conventions/*.md` — `src/lib → components` 레이어 경계 규약을 위한 전용 spec 문서 부재는 선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md` WARNING#4, `18_06_36/SUMMARY.md` INFO#8)에서 이미 식별돼 `project-planner` 위임으로 트래킹 중 — 이번 diff 범위 밖이라 중복 제기하지 않음.
- 신규 env·API 엔드포인트 변경 없음 — 해당 점검 항목 N/A.
- 테스트 파일의 fixture 배열 자체(23→34건, 백틱/타입전용/re-export/근접오탐 각각에 인라인 주석 부착)가 이 가드의 "사용 예제"를 충실히 대체하고 있어 별도 예제 코드 필요성 없음.

## 요약

오케스트레이터가 특정한 3개 지점(커버리지 한계 주석, `literalSpecifier`/`backtickSpecifier` 헬퍼 주석, 테스트 파일의 phantom-dependency 근거 주석) 모두 실제 config를 로드해 `Linter#verify`로 직접 실행하고 frontend `node_modules`를 실측 대조한 결과 **서술이 실제 동작과 정확히 일치**함을 확인했다. `RESOLUTION.md`의 "23/23" 기록도 해당 커밋 체크아웃 실측으로 대조해보니 그 시점 기준 정확한 값이었다(이후 커밋에서 늘어난 것으로, append-only 기록이라 결함 아님). CHANGELOG·spec 문서 갭은 신규가 아니라 이미 트래킹 중인 항목. 전반적으로 이번 diff는 코드 주석과 커밋 메시지·테스트 fixture가 실제 AST/selector 동작과 매우 높은 정합도를 보이는, 문서화 관점에서 모범적인 변경이다.

## 위험도
NONE

STATUS: documentation review complete — output written to /Volumes/project/private/clemvion/.claude/worktrees/heuristic-nightingale-9c8a0e/review/code/2026/07/17/19_08_28/documentation.md
