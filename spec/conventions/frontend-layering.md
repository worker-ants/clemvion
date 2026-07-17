---
id: frontend-layering
status: implemented
code:
  - codebase/frontend/eslint.config.mjs
  - codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts
---

# Frontend 레이어 경계 규약

> 관련 문서: [Spec 0-Overview §4](../0-overview.md#4-영역별-진입-문서) · [Data Hydration Surfaces](./data-hydration-surfaces.md)

## Overview

`codebase/frontend/src/` 의 디렉터리 간 의존 방향 규약. CI(ESLint)가 강제한다.

> 본 문서의 "레이어" 는 frontend 디렉터리 의존 방향(§1)만을 가리킨다 — `0-overview.md` 의 Data Layer, `execution-context.md` 의 3계층 등 타 문서의 동명 용어와 무관하다.

## 1. 계층 정의

의존은 **위에서 아래로만** 흐른다.

| 계층 | 디렉터리 | 역할 | 아래로 의존 | 위로 의존 |
| --- | --- | --- | --- | --- |
| 최상위 | `src/app/**` | Next.js App Router 라우트·페이지 | 허용 | — |
| 상위 | `src/components/**` | React 컴포넌트 (UI·JSX) | 허용 | **금지** |
| 하위 | `src/lib/**` | 도메인 로직·유틸·스토어·API 클라이언트·타입 | 허용 | **금지** |
| 최하위 | `src/types/**` | 프레임워크 비의존 순수 타입 정의 | — | **금지** |

`src/lib/types/` (예: `trigger.ts`) 는 `src/types/` 와 별개다 — 전자는 `lib` 계층 내부의 타입 모듈이고, 후자는 그 아래 독립 계층이다.

`src/content/**`(MDX 유저 가이드) · `src/test/**` · `src/__tests__/**` 는 의존 축 밖이라 본 규약의 대상이 아니다.

## 2. 금지 방향

**규약**: 각 계층은 §1 표에서 자기보다 위에 있는 계층을 import 하지 않는다. `types → lib`,
`types → components`, `lib → components`, `components → app` 이 모두 금지 방향이다.

**CI 가 강제하는 범위는 그 부분집합이다** — `src/lib/**` 과 `src/types/**` 의
`@/components/**` import 만 막는다. 나머지 방향(`types → lib`, `components → app`)은 규약상
금지지만 가드가 없다. 이유는 관측된 역전 압력이 0이기 때문이며(→ Rationale), 압력이 생기면
그때 가드를 추가한다. **규약이 곧 집행은 아니라는 점을 문서가 숨기지 않는다** — 코드 리뷰에서
이 방향들을 사람이 봐야 한다.

아래는 CI 가 실제로 막는 `{lib, types} → components` 의 우회 형태 전부다:

- 정적 `import` / `import type` / `export ... from`
- alias 경로(`@/components/...`) 와 상대경로 우회(`../components/...`, `../../components/...`)
- 서브패스 없는 bare 형태(`@/components`, `../components`)
- 동적 `import("@/components/...")` — 문자열 리터럴과 백틱 리터럴 모두
- CJS `require("@/components/...")` — 문자열 리터럴과 백틱 리터럴 모두

**커버리지 한계**: 규칙은 **리터럴 specifier** 만 매칭한다. 경로가 런타임 계산값이면(`import(someVar)`, 인터폴레이션이 있는 `` import(`@/components/${name}`) ``) 정적 분석 영역 밖이라 어떤 규칙도 막지 못한다. `eslint-disable` 주석에 의한 의도적 우회도 막지 않는다. 이 가드는 "정직한 실수" 방지용이다.

`src/app/**` 은 어느 계층도 import 하지 않지만(현재 0건), 라우트 정의 디렉터리라 import 대상이 아니라는 성격상의 이유이므로 별도 CI 가드를 두지 않는다 (→ Rationale).

## 3. 위반 시 해소법

레이어 역전이 발생했다면 "상위 계층의 무언가를 하위가 필요로 한다" 는 뜻이고, 그 무언가는 **애초에 하위에 속했어야 하는 것**이다. import 방향을 뒤집는 게 아니라 **대상을 아래로 옮긴다**.

1. 필요한 타입·유틸을 `src/lib/` (또는 계층상 맞는 위치)로 **이동**한다.
2. 기존 소비처 안정성이 필요하면 원래 `components/` 경로에서 **re-export** 를 유지한다 — 소비처는 그대로 두되 정본은 lib 에 둔다.
3. JSX·React 훅에 의존하는 코드라면 그것은 진짜 컴포넌트 관심사다. 하위 계층이 그것을 필요로 한다면 설계가 잘못된 것이므로 이동이 아니라 **호출 관계를 재설계**한다 (하위가 값을 반환하고 상위가 렌더링).

적용 사례: `conversation-utils.ts` 의 정본은 `@/lib/conversation/` 에 있고 `@/components/editor/run-results/conversation-utils.ts` 는 re-export 껍데기다. 그 함수가 받는 타입(`rag-types.ts`)도 같은 이유로 lib 에 산다.

## 4. CI 강제

`codebase/frontend/eslint.config.mjs` 의 `files: LOWER_LAYERS` (= `["src/lib/**", "src/types/**"]`) 블록:

| 규칙 | 커버 대상 |
| --- | --- |
| `no-restricted-imports` (`patterns[].group`) | 정적 `import` / `import type` / `export ... from` |
| `no-restricted-syntax` (`ImportExpression` selector × 2) | 동적 `import()` — 문자열 리터럴 / 백틱 리터럴 |
| `no-restricted-syntax` (`CallExpression[callee.name='require']` selector × 2) | CJS `require()` — 문자열 리터럴 / 백틱 리터럴 |

문자열과 백틱이 **별도 selector** 인 이유는 AST 형태가 다르기 때문이다 — 백틱은 `TemplateLiteral` 노드라 `.value` 프로퍼티가 없어서, 문자열용 `[source.value=/.../]` 매칭이 조용히 빗나간다. 실제로 이 경로는 가드 도입 시점부터 뚫려 있었고 PR #969 에서 `quasis[0].value.raw` 기반 selector 를 추가해 닫았다.

### 4.1 왜 테스트가 필수인가 — negative-space 가드

현재 위반이 0건이라 `npx eslint src/lib` 는 규칙이 실제로 로드·매칭·발동하는지와 **무관하게** 항상 초록이다. 즉 lint 통과는 가드가 살아있다는 증거가 못 된다. 따라서 `src/lib/__tests__/eslint-layering-guard.test.ts` 가 **실제 config 객체를 ESLint `Linter#verify` 에 먹여** 규칙의 발동 자체를 검증한다.

이 테스트가 고정하는 것 (전부 실제 mutation 으로 탐지 확인됨):

- **규칙 발동**: 금지 형태 전부(정적·bare·동적·백틱·`import type`·re-export)가 error 를 낸다.
- **오탐 방지**: 근접 경로(`@/components-legacy`)·계산 경로는 잡지 않는다.
- **flat config 병합 의미론**: 가드 블록을 **전부** 병합해 검증한다. 배열 뒤쪽 override 가 규칙을 `off` 로 되돌리면 실패해야 하므로, 첫 블록만 보면 fail-open 이다.
- **severity**: 두 규칙이 `error` 여야 한다. `warn` 으로 강등되면 `lint` 스크립트에 `--max-warnings` 제한이 없어 **CLI 는 exit 0 으로 통과**한다 — 이 경우 유닛 테스트가 유일한 방어선이다.
- **파서 정합**: 프로덕션 config 의 파서를 그대로 꺼내 쓴다. 기본 espree 로 후퇴하면 `import type` fixture 가 파싱조차 안 되고, 그 fatal 이 `ruleId` 필터에 걸러져 "위반 0건" 으로 위장한다.
- **스코프**: 규칙이 **어느 경로에** 걸리는지. 위 항목들은 합성 config 로 규칙의 *내용*을 검증하느라 `files:` glob 을 우회하므로, glob 오타·스코프 축소(`src/types/**` 누락)·`/**` 누락으로 인한 중첩 미매칭을 원리적으로 못 잡는다. 이를 위해 별도 스위트가 **실제 `ESLint` API 로 config 를 resolve** 해 계층별 경로 매칭을 확인한다. 그 스위트의 기대 계층 목록은 config 에서 가져오지 않고 독립적으로 하드코딩한 뒤 `LOWER_LAYERS` 와 일치를 단언한다 — config 에서 가져오면 glob 을 지우는 순간 검증 대상도 함께 사라져 false green 이 되기 때문이다.

## Rationale

### 왜 이 방향인가 — 이름이 아니라 관측된 의존 그래프

레이어 순서는 선험적 취향이 아니라 실측에서 나왔다 (2026-07-17, main `099f63cc`):

| 방향 | 건수 |
| --- | --- |
| `components → lib` | 248 files |
| `app → lib` | 97 files |
| `app → components` | 64 files |
| `lib → components` | **0** (권위 판정: `npx eslint src/lib` 0 errors) |
| `lib → app` · `components → app` | **0** |
| `types → (무엇이든)` | **0** (import 문 없는 leaf) |

즉 이 규약은 새 제약을 도입한 게 아니라 **이미 성립해 있던 사실을 CI fitness function 으로 고정**한 것이다. 248:0 이라는 비대칭이 방향을 결정했다.

> 계수 주의: `grep` 으로 `lib → components` 를 세면 1건이 잡히는데, 이는 가드 테스트(`eslint-layering-guard.test.ts`)의 **fixture 문자열**이지 실제 import 가 아니다. 이 축의 권위 있는 판정은 `npx eslint src/lib` 다.

### 계기 — 추상적 원칙이 아니라 구체적 강제였다

`@/lib/websocket/` 이 `conversation-utils` 의 함수를 소비해야 했다. 그 함수가 `components/` 에 살면 `lib → components` 역전이 되므로 정본을 `@/lib/conversation/` 으로 옮겼고, 그 함수가 받는 타입(`TurnRagDelta[]`)도 같은 이유로 `rag-types.ts` 에 따라왔다. 규약은 이 판단을 사후에 일반화한 것이다.

### 왜 `src/types/**` 도 규약 범위에 넣었나 (2026-07-17 결정)

`src/types/` 는 `transform.ts` 하나뿐이고 위반도 0건이라 즉각적 실익은 없다. 그럼에도 포함한 이유는 `src/types` 가 `src/lib` **보다도 아래**이기 때문이다 — `lib`(2 files)과 `components`(5 files)가 함께 소비하는 leaf 라, `types → components` 역전은 `lib → components` 보다 엄격히 더 나쁘다. 범위를 `src/lib/**` 로 두면 규칙의 근거가 "계층 지위" 가 아니라 "`lib` 이라는 디렉터리 이름" 에 우연히 국소화된다.

이 가드를 만들게 된 원래 사건 자체가 **타입 모듈**(`rag-types.ts`)이었다는 점도 근거다 — "타입이라서 안전하다" 는 직관은 이미 한 번 깨졌다. import 0건 leaf 라 오탐 위험이 없고 비용은 glob 1줄이므로, 의도를 코드에 확정하는 쪽을 택했다.

기각: **`src/types/transform.ts` 를 `src/lib/types/` 로 통합** — 이중 "types 홈" 을 해소하는 대안이나 import 7곳을 건드리는 코드 이동이라 규약 문서화의 범위를 넘는다. 계층이 서면화된 지금 독립적으로 재평가할 수 있다.

### 왜 `app` 경계는 가드하지 않나

`src/app` 을 import 하는 파일은 0건이지만, 이는 규율의 성과가 아니라 App Router 의 `app/` 이 라우트 정의 디렉터리라 애초에 import 대상이 아니기 때문이다. 가드는 **관측된 역전 압력에 비례**해야 한다 — 압력이 없는 경계에 규칙을 두면 유지보수 비용만 남는다. 계층 표에는 명시해 두되 CI 는 `lib`·`types` → `components` 에만 건다.

`src/types` 와 `app` 은 둘 다 "현재 위반 0건" 이지만 결론이 갈리는 이유는 **0 의 성격이 다르기** 때문이다. `types` 의 0 은 우연이라 언제든 깨질 수 있는 반면(누군가 타입 하나를 잘못된 방향으로 참조하면 그만), `app` 의 0 은 구조적이다 — 라우트 파일은 import 해 쓸 표면 자체가 없어 압력이 영구적으로 0 에 수렴한다. 전자는 고정할 가치가 있고 후자는 없다.

### 왜 `types → lib` 는 규약에만 있고 가드가 없나

§1 의 계층 순서상 `types → lib` 도 금지 방향이지만 CI 가드는 `{lib, types} → components` 만
막는다 (§2 가 이 차이를 명시한다). `types` 는 import 문이 하나도 없는 leaf 라 이 방향의 압력이
현재 0 이고, 가드를 추가하면 `no-restricted-imports` group 에 `@/lib` 을 넣어야 하는데
그러면 `src/lib/**` 자신이 자기 내부를 import 하는 정상 경로까지 걸리지 않도록 스코프를
`src/types/**` 전용 블록으로 쪼개야 한다 — 압력 0 인 경계에 블록을 하나 더 만드는 비용이
이득을 넘는다.

이 판단은 `app` 경계와 같은 원칙(압력에 비례)이되 결론의 성격이 다르다. `app` 은 압력이
**구조적으로** 0 이라 영구히 가드 대상이 아니지만, `types → lib` 는 압력이 **우연히** 0 일 뿐이라
`src/types` 에 import 문이 생기는 순간 재평가 대상이다. 그때는 `types` 전용 블록을 두거나,
경계 쌍이 늘어난 것을 신호로 삼아 zone 기반 도구(아래)로 한 번에 옮기는 편이 낫다.

### 왜 규칙 2종 조합인가

경계가 1쌍(`lib`+`types` → `components`)인 현재 규모에선 `no-restricted-imports`(glob) + `no-restricted-syntax`(정규식) 조합이 적절하다. 두 규칙이 "components 경로" 라는 같은 개념을 서로 다른 문법으로 이중 표현하는 비용이 있으나, ESLint API 상 glob 과 esquery 정규식은 단일 소스화가 불가능하다. 경계 쌍이 2개 이상으로 늘면 규칙이 선형 증식하므로 `eslint-plugin-import` 의 `no-restricted-paths` 같은 zone 기반 선언적 도구로 재평가한다. 지금 도입하는 것은 과설계다.
