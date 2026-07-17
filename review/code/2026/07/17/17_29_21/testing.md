# 테스트(Testing) 리뷰 — src/lib 레이어 가드 회귀 테스트

대상 커밋: `e0e2123d4` (`codebase/frontend/eslint.config.mjs`,
`codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`)

## 실측 방법

주장("규칙을 비우면 실패한다")을 코드 리뷰만으로 판단하지 않고, `eslint.config.mjs`
를 6가지 방식으로 실제 mutate 한 뒤 `npx vitest run
src/lib/__tests__/eslint-layering-guard.test.ts` 를 재실행해 fail 여부를 직접
확인했다 (mutation testing). 매 mutation 후 `git checkout -- eslint.config.mjs`
로 원복. 최종적으로 `git diff eslint.config.mjs` 가 0줄임을 확인해 작업 트리를
원상태로 복구했다.

| # | Mutation | 결과 |
|---|---|---|
| 1 | `files: ["src/lib/**"]` → `["src/liba/**"]` (glob 오타) | 스위트 전체 fail (throw, "가드 자체가 fail-open 상태일 수 있습니다") — 의도대로 |
| 2 | `no-restricted-syntax` 블록 전체 삭제 | 정확히 관련 7건만 fail (동적 import 4 + require 2 + property 존재 확인 1), 나머지 9건 pass |
| 3 | `no-restricted-imports` 의 상대경로 우회 패턴(`**/../components`, `**/../components/**`)만 제거 | 정확히 관련 2건만 fail (`정적 상대경로 우회(1/2단계)`) |
| 6 | `no-restricted-imports` 전체를 `"off"` 로 약화 | 정확히 관련 4건만 fail (정적 import 케이스 전부) |
| 4 | **배열 뒤쪽에 `files: ["src/lib/**"]` 를 재매칭하는 override 블록을 추가**해 두 규칙을 `"off"` 로 재설정 | 실제 `npx eslint` CLI 는 위반을 검출하지 못함(neutralize 확인) — 그러나 유닛 테스트는 **16/16 그대로 통과** |
| 5 | 서브패스 없는 "bare" 패턴(`"@/components"`, `"**/../components"`)만 제거, `/**` 하위경로 패턴은 유지 | 실제 `npx eslint` CLI 는 `import { Foo } from "@/components";` (서브패스 없음) 위반을 놓침(positive control로 원본은 잡음을 확인) — 그러나 유닛 테스트는 **16/16 그대로 통과** |

Mutation 1/2/3/6 은 커밋 메시지가 명시한 위협 모델(files glob 오타, 규칙 삭제,
패턴 완화)을 정확히, 그리고 **정밀하게**(관련 없는 케이스는 안 건드림) 잡아낸다.
Warning#2 가 요구한 "fail-open 을 CI 가 잡는다"는 핵심 주장은 실측으로 검증됨.

다만 mutation 4·5 는 테스트의 설계(`.find()` 로 단일 블록을 뽑아 합성
`verifyConfig` 에 직접 주입)에서 기인하는 **잔여 커버리지 갭**이며, 아래
발견사항에 상술한다.

## 발견사항

- **[WARNING]** flat config 배열의 "나중 블록이 우선" 병합 규칙을 이용한 무력화는 테스트가 못 잡음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:20-24` (`layeringBlock = ... .find(...)`)
  - 상세: 이 테스트는 `eslintConfig` 배열에서 `files.includes("src/lib/**")` 인
    **첫 블록**을 찾아 그 `rules` 객체만 떼어내 합성 `verifyConfig` 에 주입한다.
    반면 실제 ESLint 는 flat config 배열 전체를 순회하며 매칭되는 모든 블록의
    `rules` 를 rule-ID 단위로 병합하고, 동일 rule-ID 는 **나중에 등장하는 블록이
    이긴다**. 실측으로, 배열 뒤쪽에 `files: ["src/lib/**"]` 를 재매칭하며
    `no-restricted-imports`/`no-restricted-syntax` 를 `"off"` 로 재설정하는
    블록을 추가하면 — `npx eslint` 는 실제로 위반을 놓치는데(neutralize 확인
    완료) — 이 회귀 테스트는 여전히 16/16 그대로 통과한다. `.find()` 가 최초
    매칭 블록만 보고 이후 override 를 반영하지 않기 때문이다.
    이 시나리오는 이 테스트가 방어하려는 위협(fail-open)과 **완전히 동일한
    범주**다 — 예컨대 향후 다른 목적(예: `no-console` 룰 추가)으로 `src/lib/**`
    를 다시 매칭하는 블록을 무심코 추가하면서 `rules` 객체를 통째로 교체하는
    실수(스프레드 누락)를 해도 이 테스트는 초록으로 남는다.
  - 제안: 두 가지 중 하나를 권장.
    (a) `layeringBlock` 을 추출하는 대신, `verifyConfig` 를 `eslintConfig`
    배열 전체(또는 최소한 `files: ["src/lib/**"]` 를 매칭하는 **모든** 블록을
    순서대로 병합한 것)로 구성해 실제 ESLint 의 "나중 블록 우선" 병합 의미론을
    재현한다. (b) 최소한 "배열에 `src/lib/**` 를 매칭하는 블록이 정확히 1개
    뿐이다"를 단언하는 테스트(`filter(...).length === 1`)를 추가해, 앞으로 두
    번째 매칭 블록이 생기면 최소한 그 사실 자체는 CI 가 알아채도록 한다. (a)
    가 근본적이지만 비용이 더 크면 (b)만으로도 최소 방어선은 확보된다.

- **[WARNING]** 서브패스 없는 "bare" import/require 형태가 회귀 케이스에 없음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:264-282` (`위반으로 잡혀야 하는 형태` it.each)
  - 상세: `eslint.config.mjs` 의 `no-restricted-imports` `group` 배열은
    `"@/components"`, `"**/../components"` (서브패스 없는 "bare" 정확 매칭)와
    `"@/components/**"`, `"**/../components/**"` (하위경로 매칭) 를 **별도
    엔트리**로 각각 갖고 있다. 그런데 회귀 테스트의 `it.each` 는 전부
    `@/components/foo`, `../components/foo` 처럼 서브패스가 있는 케이스만
    쓴다 — `import { Foo } from "@/components";` 같은 bare 배럴 import 는
    한 번도 검사하지 않는다. 실측 결과: `"@/components"`/`"**/../components"`
    (bare) 두 엔트리만 제거하고 `/**` 엔트리는 남기는 mutation 을 가해도
    16/16 그대로 통과했다. 반면 원본 config 로 실제 `npx eslint` 를 돌리면
    이 bare import 를 정상적으로 error 로 잡는다(positive control 확인) —
    즉 규칙 자체는 이 케이스를 방어하지만, 테스트는 그 방어선의 존재를
    검증하지 못한다. 동적 `import()`/`require()` selector 정규식도
    `(\\/.*)?` 로 서브패스를 옵셔널 처리해 동일한 구조이므로, `import("@/components")`,
    `require("../components")` (bare) 도 잠재적으로 같은 사각지대다.
  - 제안: `it.each` 위반 케이스에 bare 형태 4종(`import "@/components"`,
    `import "../components"`, `import("@/components")`, `require("../components")`)
    을 추가해 `group`/정규식의 옵셔널 서브패스 분기 전체를 커버한다.

- **[INFO]** 테스트가 config 배열의 매칭 문자열에 엄격히 의존 (브리틀니스, fail-open 방향 아님)
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:23-25`
  - 상세: `.find((c) => Array.isArray(c.files) && c.files.includes("src/lib/**"))`
    는 `files` 배열에 정확히 문자열 `"src/lib/**"` 가 포함돼야만 블록을 찾는다.
    누군가 의미상 동등하지만 표기가 다른 glob(`"src/lib/**/*.{ts,tsx}"` 등)으로
    바꾸면 이 테스트는 (안전한 방향인) throw 로 fail 한다. Fail-open 은 아니고
    오히려 "과민 반응"(false positive test failure) 쪽이라 위험도는 낮지만,
    향후 정당한 리팩터링을 이 테스트가 막을 수 있다는 점은 유지보수자가
    인지할 필요가 있다. 액션 불필요, 참고용.

- **[INFO]** Mock 미사용 — 실제 `eslint.config.mjs` 를 직접 import + 실제 `eslint` 패키지의 `Linter` 사용
  - 위치: 파일 전체
  - 상세: 이 테스트는 mock/stub 을 전혀 쓰지 않고 실제 config 객체와 실제
    `Linter#verify` 를 사용한다 — "config 가 나중에 조용히 약화돼도 여기서
    드러난다"는 목적에 정확히 부합하는 선택이며, mock 사용으로 인한 실제
    동작과의 괴리 우려는 없다. `eslint`/`eslint-config-next` 는 이미
    devDependency 로 존재해 신규 의존성 리스크도 없음(확인 완료:
    `package.json` `"eslint": "^9"`, `"eslint-config-next": "16.2.1"`).

## 요약

커밋 메시지가 명시한 위협 모델(파일 glob 오타, 규칙 삭제, 패턴 완화로 인한
fail-open)에 대해서는 6가지 실측 mutation 전부에서 테스트가 정확하고 정밀하게
(관련 없는 케이스를 오염시키지 않고) fail 함을 직접 확인했다 — Warning#2 의
핵심 요구("규칙이 조용히 무력화되면 CI 가 잡는다")는 충족된다. 다만 테스트가
"단일 매칭 블록을 골라 합성 config 로 검증"하는 설계를 택했기 때문에, (1) flat
config 의 "나중 블록이 우선" 병합 의미론을 이용해 배열 뒤쪽에 동일 `files` 를
재매칭하는 override 블록으로 무력화하는 경로와 (2) `group`/정규식의 옵셔널
서브패스(bare import/require) 분기는 실측으로 여전히 사각지대임을 확인했다.
두 갭 모두 이 테스트가 표방하는 목적(fail-open 방지)과 같은 범주에 있어
WARNING 으로 분류했으나, 원 취약점(동적 import/require 우회) 자체는 이미
견고하게 봉쇄됐고 격리·가독성·mock 적절성·기존 회귀 유효성 등 다른 항목은
모두 양호하다.

## 위험도

LOW
