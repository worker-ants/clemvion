# 테스트(Testing) 리뷰 — codebase/frontend/eslint.config.mjs

## 검증 재현 (본 리뷰 중 수행)

리뷰 과정에서 PR 설명에 언급된 수동 검증을 독립적으로 재현했다 (probe 파일은 리뷰 종료 후 즉시 삭제, 커밋 없음. `git status --short src/lib` 로 clean 확인 완료).

| 케이스 | import 형태 | 결과 |
| --- | --- | --- |
| 정적 named import, alias | `import { Foo } from "@/components/foo"` | ✅ error (규칙 발동) |
| 정적 import, alias 우회 상대경로 (`../../components/x`) | `import { Bar } from "../../components/bar"` | ✅ error |
| 정적 import, 상대경로 1단계 (`../components/x`) | `import { Baz } from "../components/baz"` | ✅ error |
| `@/components-legacy/*` (거짓양성 여부 확인) | `import { Qux } from "@/components-legacy/qux"` | ✅ error 없음 (정상, 오탐 없음) |
| `import type` | `import type { Foo } from "@/components/foo"` | ✅ error |
| `export ... from` re-export | `export { Foo } from "@/components/foo"` | ✅ error |
| **동적 `import()`** | `await import("@/components/foo")` | ❌ **exit 0, error 없음 — 규칙 미발동** |
| **CJS `require()`** | `require("@/components/foo")` | ❌ **exit 0, error 없음 — 규칙 미발동** |

`npx eslint src/lib` 는 사전 존재하던 무관한 warning 2건 외 clean (0 errors) 확인.

## 발견사항

- **[WARNING]** 이 레이어 역전 가드에 대한 자동 회귀 테스트가 전혀 없다 — 향후 config 를 건드리는 순간 "조용히 무력화"될 수 있고, 그 시점에 `pnpm --filter frontend lint` 는 여전히 초록으로 통과한다
  - 위치: `codebase/frontend/eslint.config.mjs` (신규 블록 전체, `files: ["src/lib/**"]` ~ `no-restricted-imports` 옵션)
  - 상세: 이 규칙은 "무언가 일어나지 않아야 함(레이어 역전 금지)"을 보장하는 **negative-space 가드**다. 현재 `src/lib` 아래 실제 위반이 없으므로 `npx eslint src/lib` 는 이 규칙이 규칙표에 실제로 로드됐는지·`files` glob 이 의도한 경로를 매칭하는지·`group` 패턴 문자열이 오타 없이 유효한지와 무관하게 항상 "0 errors" 로 통과한다. 즉 지금의 검증 방식(수동 probe 로 1회 위반 유발 → error 확인 → 원복, 커밋 안 함)은 **이 순간에는** 규칙이 동작함을 증명하지만, 그 증거는 코드베이스에 남지 않는다. 이후 누군가 (1) `eslint-config-next` 업그레이드로 규칙 우선순위/merge 동작이 바뀌거나, (2) `files: ["src/lib/**"]` 를 리팩터링 중 오타 내거나 (`src/lib/*` 로 좁아짐 등), (3) rule 이름/구조를 잘못 고치는 실수를 해도 — lint 는 계속 통과하고, 실제로 `@/components` 를 다시 import 하는 회귀가 발생해야만 (그것도 우연히 실제 위반이 생겨야만) 발각된다. 배경 주석에 명시된 `src/lib/conversation/rag-types.ts` 사례가 바로 "한 번 발생했던" 전례이므로, 재발 방지 가드 자체의 무결성을 지속적으로 검증할 필요성이 낮지 않다.
  - 제안: `codebase/frontend` 에 vitest 테스트를 추가해 이 config 를 실행 가능한 고정 사례로 못 박는다. 두 가지 접근 중 하나:
    1. **경량**: ESLint 코어 규칙 `no-restricted-imports` 를 `RuleTester` (또는 `Linter#verify`) 로 직접 호출해, 이 config 블록의 `rules["no-restricted-imports"]` 옵션 객체를 그대로 사용한 fixture 소스 문자열(`@/components/foo` import 등)에 대해 정확히 1개의 error 가 나는지, 무관한 import(`@/components-legacy/x`)는 통과하는지를 assert. 파일시스템에 실제 파일을 쓰지 않아도 되므로 격리성이 가장 좋다.
    2. **엔드투엔드**: `eslint.config.mjs` 를 import 해서 `new Linter({ configType: "flat" }).verify(source, eslintConfig, "src/lib/__fixture__.ts")` 형태로 실제 전체 config 대상 통합 검증(느리지만 `files` glob 매칭까지 포함해 실제 동작을 그대로 검증).
    테스트 위치는 vitest include 패턴(`src/**/*.{test,spec}.{ts,tsx}`)에 맞춰 예: `src/lib/__tests__/eslint-layering-guard.test.ts` 등이 적절.

- **[WARNING]** 동적 `import()` / CJS `require()` 는 규칙을 완전히 우회한다 (확인됨) — 가드가 제공하는 보장이 부분적임에도 이를 알리는 문서나 테스트가 없다
  - 위치: `codebase/frontend/eslint.config.mjs:41-58` (`no-restricted-imports` — ESLint 코어 규칙 자체의 알려진 한계: 정적 `import`/`export ... from` 선언만 검사하고 동적 `import()` 표현식·CJS `require()` 호출은 대상에서 제외)
  - 상세: 위 재현 표에서 확인했듯 `await import("@/components/foo")` 와 `require("@/components/foo")` 는 둘 다 exit 0 (에러 없음)으로 조용히 통과한다. 즉 "src/lib/** 은 @/components/** 를 import 할 수 없다"는 커밋 메시지/주석의 의도된 보장은 정적 import 경로에 한해서만 성립하고, 개발자(또는 assistant)가 (드물지만) 동적 import 나 require 를 쓰면 레이어 역전이 lint 통과 상태로 재발할 수 있다. 이 프로젝트 성격(LLM 서브에이전트가 광범위하게 코드를 작성)을 고려하면 이 우회 경로가 실질적으로 낮지 않은 위험이다.
  - 제안: (a) 최소한 config 옆 주석에 "동적 import()/require() 는 이 가드로 커버되지 않음"을 명시해 향후 유지보수자가 오해하지 않도록 하고, (b) 위 WARNING 1 에서 제안한 테스트 스위트에 "동적 import 는 현재 미검출"을 **알고 있는 한계로서 고정하는 실패 예상(xfail) 또는 명시적 asserted-false 케이스**로 남겨, 향후 규칙 강화(예: `no-restricted-syntax` 로 `ImportExpression`/`CallExpression[callee.name='require']` 커버 추가) 시 이 테스트를 업데이트하도록 유도. 최소 비용 대안으로는 CI 에 간단한 grep 기반 보조 검사(`grep -rn 'require(.*@/components\|import(.*@/components' src/lib`)를 lint 단계에 곁들이는 방법도 있음.

- **[INFO]** 수동 probe 검증 절차 자체는 이번 1회성 변경 검증으로는 합리적이나, "커밋되지 않는 probe" 방식은 재현성이 없다
  - 위치: PR 설명 (검증 방법 서술)
  - 상세: `npx eslint src/lib` 통과 확인 + 위반 probe 로 error 발생 확인 후 원복이라는 절차 자체는 흠 없이 수행됐다(본 리뷰에서도 동일하게 재현되어 정합성 확인됨). 다만 이 절차는 "지금 이 순간 규칙이 동작한다"만 증명하며 회귀에 대한 지속적 방어력이 없다는 점에서 WARNING 1 과 동일한 문제의 근본 원인이다.
  - 제안: WARNING 1 의 자동화 테스트가 이 수동 절차를 대체/보완하면 이 항목은 해소된다.

- **[INFO]** `no-restricted-imports` 의 `group` 패턴이 오탐(false positive) 없이 정확히 스코프됨을 확인 — 별도 조치 불필요
  - 위치: `codebase/frontend/eslint.config.mjs:47-52`
  - 상세: `@/components-legacy/qux` 같이 `components` 를 부분 문자열로만 포함하는 경로는 규칙에 걸리지 않음을 확인했다(위 표 참조). minimatch 세그먼트 매칭이 의도대로 동작하며, 과도하게 넓은 매칭으로 인한 오탐 우려는 낮다.

## 요약

이번 변경은 `src/lib/**` → `@/components/**` 레이어 역전을 막는 순수 ESLint config 추가이며, 실제 애플리케이션 코드 변경이 없어 기존 테스트 스위트에 대한 회귀 위험은 없다(기존 테스트는 그대로 유효). 다만 이 config 는 "위반이 일어나지 않아야 한다"는 negative-space 가드이기 때문에, 통상적인 `npx eslint` clean 통과는 규칙이 실제로 로드·매칭·발동되는지에 대해 아무런 신호도 주지 못한다 — 커밋되지 않는 1회성 수동 probe 검증만으로는 향후 config 리팩터링·의존성 업그레이드에 따른 조용한 무력화를 잡아낼 수 없다. 더구나 이 리뷰 중 재현 테스트로 동적 `import()`/`require()` 가 이 가드를 완전히 우회함이 실측 확인되어, 가드가 제공하는 보장 범위가 처음 의도(주석 문구)보다 좁다는 사실도 코드베이스 어디에도 기록돼 있지 않다. 배경 주석이 실제 과거 위반 사례(`rag-types.ts`)를 명시하는 재발 방지 목적의 규칙임을 감안하면, ESLint `Linter`/`RuleTester` 기반의 소형 vitest 회귀 테스트 1개를 추가해 "이 config 가 실제로 무엇을 막고 무엇을 막지 못하는지"를 실행 가능한 고정 사례로 남기는 것이 수동 검증만으로 충분하다고 보기 어려운 이유다.

## 위험도
MEDIUM
