# 테스트(Testing) 리뷰 — codebase/frontend eslint.config.mjs / eslint-layering-guard.test.ts

## 범위 및 방법

`git diff origin/main..HEAD` 대상은 실질적으로 코드 2파일(`codebase/frontend/eslint.config.mjs`,
`codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`)과 그 결과물인
`review/code/2026/07/17/18_06_36/*` 산출물(전 라운드 리뷰 보고서/상태 파일 — 코드 아님)이다.
main 이 이미 수행한 mutation 검증(override-off, `COMPONENTS_PATH_RE` 무력화, severity 강등,
앵커 완화) 결과는 재실행하지 않고 그대로 신뢰했다. 본 리뷰는 그 위에서 **아직 보고되지 않은
논리적 사각지대**를 찾는 데 집중했다. 워킹트리는 수정하지 않았고(`git status --short` 로
diff 없음 확인), 검증은 다음 두 가지 read-only 실행으로 수행했다.

1. `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` → 23/23 통과 (baseline 확인).
2. 스크래치패드에 격리된 probe 스크립트(`require("<frontend>/node_modules/eslint")`)로 실제
   `no-restricted-imports`/`no-restricted-syntax` 규칙 객체를 직접 `Linter#verify` 에 먹여
   현재 fixture 목록에 없는 입력 형태의 실제 판정을 관찰. 이어서 실제 `eslint.config.mjs` 를
   그대로 사용하는 `npx eslint --stdin --stdin-filename src/lib/__scratch_probe.ts` 로 동일
   결과를 프로덕션 config 기준으로 교차 검증(파일을 디스크에 쓰지 않음, stdin 모드).

## 발견사항

- **[WARNING] 백틱(템플릿 리터럴) 인자의 동적 `import()` 가 레이어 가드를 완전히 우회 — 실측 확인된 현재 유효한 미탐지 경로**
  - 위치: `codebase/frontend/eslint.config.mjs:55` (`ImportExpression[source.value=/${COMPONENTS_PATH_RE}/]` selector), 대응 테스트 부재 — `eslint-layering-guard.test.ts` 의 "위반으로 잡혀야 하는 형태" `it.each` 목록(76-96행)
  - 상세: esquery 의 `source.value` 속성 매칭은 AST 노드가 `Literal`(문자열 리터럴)일 때만 `.value` 를 갖는다. `TemplateLiteral`(백틱 문자열)에는 `.value` 프로퍼티 자체가 없어 정규식 매칭이 성립하지 않는다. 실측:
    ```
    echo 'export const load = () => import(`@/components/foo`);' \
      | npx eslint --stdin --stdin-filename src/lib/__scratch_probe.ts
    → EXIT:0, 출력 없음 (0 errors)
    ```
    이는 격리된 규칙 객체만으로 재현한 결과와, 수정하지 않은 실제 `eslint.config.mjs` 를 그대로 사용한 `npx eslint` 양쪽에서 동일하게 확인했다. `src/lib/**` 안에서 인터폴레이션 없는 정적 백틱 문자열로 `import(\`@/components/foo\`)` 를 쓰면 **어떤 규칙에도 걸리지 않고** 레이어 역전이 성립한다. `eslint.config.mjs` 상단 주석(91-94행)은 "계산된 동적 경로"(`import(someVar)`)만 정적 분석 불가 영역으로 명시하는데, 인터폴레이션 없는 백틱 리터럴은 계산된 값이 아니라 문자열 리터럴과 정보량이 동일함에도 실제로는 커버되지 않는다 — 주석이 선언한 스코프와 실제 동작 사이에 괴리가 있다. `require()` 쪽 동일 케이스(`require(\`../components/foo\`)`)는 격리 테스트에서는 마찬가지로 `no-restricted-syntax` 를 우회하지만, 실제 프로젝트 전체 preset 에서는 무관한 별도 규칙 `@typescript-eslint/no-require-imports`(모든 `require()` 를 금지)가 우연히 함께 걸려 현재는 결과적으로 안전하다 — 즉 레이어 가드 자체가 막는 게 아니라 부수 효과다. 그 규칙이 향후 완화·예외 처리되면 이 경로도 조용히 뚫린다.
  - 제안: `it.each` positive 목록에 `'export const load = () => import(\`@/components/foo\`);'`, `` `const mod = require(\`../components/foo\`);` `` 케이스를 추가해 먼저 "현재 미탐지"를 명시적 실패로 고정한 뒤, `eslint.config.mjs` 의 selector 를 `source.value` 대신 esquery 의 template literal 대응(예: `TemplateLiteral[expressions.length=0][quasis.0.value.raw=/.../]`) 으로 확장하거나, 최소한 주석에 "백틱 literal 은 커버 범위 밖"이라고 정확히 스코프를 명시해 문서와 실제 동작의 괴리를 없앨 것.

- **[WARNING] 테스트 harness 가 TypeScript 전용 구문(`import type`)을 파싱조차 못함 — 가드의 핵심 동기 시나리오가 구조적으로 테스트 불가능**
  - 위치: `eslint-layering-guard.test.ts:47` (`new Linter({ configType: "flat" })` — `languageOptions.parser` 미지정)
  - 상세: 이 테스트는 `languageOptions.parser` 를 지정하지 않아 ESLint 기본 파서(espree, 순수 ECMAScript)를 사용한다. 반면 실제 `eslint.config.mjs` 는 `eslint-config-next/typescript`(`@typescript-eslint/parser`)를 프리셋으로 포함한다. 실측:
    ```
    echo 'import type { Foo } from "@/components/foo";' \
      | npx eslint --stdin --stdin-filename src/lib/__scratch_probe.ts
    → 1 error (no-restricted-imports 정상 발동, EXIT:1)
    ```
    즉 **실제 프로덕션 config 는 `import type` 을 올바르게 잡는다** — 규칙 자체는 정상이다. 문제는 동일 fixture 를 `eslint-layering-guard.test.ts` 의 격리된 `Linter` 인스턴스에 넣으면 파서가 TS 구문을 모르기 때문에 `Parsing error: Unexpected token {` 로 즉시 fatal 에러가 나고, `layeringErrors()` 는 `ruleId === "no-restricted-imports"` 필터에서 이 fatal 메시지(ruleId: null)를 걸러내 `errors.length === 0` 이 된다 — "→ error" 케이스로 추가하면 실패로 fail-loud 하긴 하지만, 애초에 규칙 로직과 무관한 파서 문제로 실패하므로 **이 harness 로는 `import type` 케이스를 대표하는 fixture 를 정상적으로 추가할 방법이 없다**(parser 배선을 먼저 고쳐야 함). 이 가드의 배경 주석(`eslint.config.mjs:24`, `rag-types.ts` 언급)이 명시하듯 원래 동기 사례가 타입 관련 파일이라는 점을 고려하면, `import type` 은 이 가드가 방어하려는 핵심 시나리오에 가까운데도 회귀 테스트로 표현 불가능한 상태로 남아 있다.
  - 제안: `verifyConfig[0].languageOptions.parser` 에 `@typescript-eslint/parser` 를 배선하고(devDependency 로 이미 존재), `import type { Foo } from "@/components/foo";` 를 positive fixture 로 추가할 것. parser 불일치로 인해 이 harness 가 검증할 수 있는 구문 범위가 실제 config 의 부분집합이라는 점은 테스트 스위트 상단 주석에도 명시해 두는 것이 좋다.

- **[INFO] re-export(`export ... from`) 형태가 실제로는 정상 차단되지만 회귀 테스트가 없음**
  - 위치: `eslint-layering-guard.test.ts:76-96` (positive fixture 목록에 `export ... from` 케이스 부재)
  - 상세: 실측 결과 `export { Foo } from "@/components/foo";`, `export * from "@/components/foo";` 모두 `no-restricted-imports` 에 의해 정상적으로 에러 처리됨을 확인했다(격리 probe·실제 `npx eslint` stdin 양쪽 EXIT:1). 다만 어느 fixture 목록에도 `export ... from` 형태가 없어, 향후 규칙 옵션 변경(예: `no-restricted-imports` 의 미래 버전에서 export-from 검사가 opt-in 으로 바뀌는 등)으로 이 경로가 조용히 빠지는 회귀가 생겨도 현재 테스트 스위트는 탐지하지 못한다. 이 가드의 안내 메시지 자체가 "components 쪽에서 re-export 하세요" 라는 정반대 방향의 패턴을 유도하고 있어, 실무에서 방향을 착각해 `export ... from "@/components/..."` 를 쓸 개연성도 낮지 않다.
  - 제안: positive 목록에 `export { Foo } from "@/components/foo";` (그리고 선택적으로 `export * from "@/components/foo";`) 를 1~2건 추가.

- **[INFO] 신규 severity 문자열 직접비교(`toBe("error")`)가 동등 표기 리팩터에 false-fail 할 수 있음**
  - 위치: `eslint-layering-guard.test.ts:69-73` (`ruleSeverity(mergedRules[...]).toBe("error")`)
  - 상세: `ruleSeverity()` 는 규칙 배열의 첫 원소를 그대로 반환한다. 만약 누군가 `eslint.config.mjs` 에서 `"error"` 를 기능적으로 동일한 숫자 표기 `2` 로(둘 다 유효한 ESLint severity 표기) 바꾸면, 이 assertion 은 실제로는 아무 것도 약화되지 않았음에도 `"error" !== 2` 로 실패한다. 반면 바로 아래(99-102행) `errors.every((m) => m.severity === 2)` 검증은 `Linter#verify` 가 실제로 정규화해 반환하는 숫자 severity 를 사용하므로 표기 방식과 무관하게 안전하다 — 두 assertion 이 같은 것을 서로 다른 강건성 수준으로 이중 검증하고 있다. 보안·기능적으로 문제는 아니며(fail-safe 방향의 오탐), 우선순위는 낮다.
  - 제안: 필요하다면 `ruleSeverity()` 를 숫자/문자열 모두 `2`/`"error"` 로 정규화하는 헬퍼로 바꾸거나, 현재 상태를 의도적 이중 방어로 인정하고 조치하지 않아도 무방.

## 회귀 테스트 유효성 (기존 23건)

main 이 보고한 4종 mutation(override-off 15/23 fail, `COMPONENTS_PATH_RE` 약화 8/23 fail, severity
강등 15/23 fail, 앵커 완화 1/23 fail)과 로컬 재실행 결과(23/23 clean)는 코드 정독 결과와 정합적이다.
`mergedRules` 병합 로직(`Object.assign` 배열 순서 기반)은 flat config 의 "나중 블록 우선" 규칙-키
단위 병합을 정확히 재현하며, fail-open 가드(`Object.keys(mergedRules).length === 0` → throw)는
블록 자체가 사라지는 mutation 에 대해 fail-loud 하게 작동한다. `it.each` 의 negative 목록(근접
오탐 `@/components-legacy`, `../componentsShared`)도 정규식 앵커 완화를 정확히 겨냥한다. 이 부분은
추가로 지적할 사각지대가 없다.

## 요약

이번 diff(`COMPONENTS_PATH_RE` 상수화 + `eslint-layering-guard.test.ts` 의 flat-config 병합
재현/severity assertion/bare fixture 보강)는 선행 리뷰(`18_06_36`)의 WARNING #1 을 정확히
겨냥해 해소했고, 보고된 4종 mutation 실측 결과와 코드 정독이 정합적이라 diff 자체의 품질은
양호하다. 다만 "레이어 가드가 fail-open 하지 않게" 라는 이 브랜치의 목표를 기준으로 코드를
직접 실행 검증한 결과, 두 개의 새로운(이번 diff 가 만들지는 않았지만 아직 아무도 보고하지
않은) 사각지대를 실측으로 확인했다: (1) 백틱 템플릿 리터럴을 쓴 동적 `import()` 는 현재
프로덕션 config 기준으로 **실제로 아무 규칙에도 걸리지 않는 살아있는 우회 경로**이며 테스트
커버리지가 전혀 없고, (2) 테스트 harness 가 TS 전용 파서를 배선하지 않아 이 가드의 핵심
동기 시나리오에 가까운 `import type` 케이스를 애초에 fixture 로 표현할 수 없다(파서
불일치로 파싱 에러가 남). 두 항목 모두 diff 범위 밖의 pre-existing 갭이지만, "fail-open
방지"가 이 브랜치의 핵심 목표라는 점에서 후속 보강 대상으로 보고할 가치가 있다고 판단했다.
그 외 re-export 미검증, severity 문자열 비교의 표기 취약성은 낮은 우선순위 INFO 다.

## 위험도

MEDIUM
