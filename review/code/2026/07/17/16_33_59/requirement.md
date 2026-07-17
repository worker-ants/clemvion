# 요구사항(Requirement) Review — codebase/frontend/eslint.config.mjs

## 검증 방법

- `no-restricted-imports` 코어 규칙 소스(`eslint@9.39.4`, `node_modules/.pnpm/eslint@9.39.4_.../lib/rules/no-restricted-imports.js`)를 직접 읽어 `patterns.group` 매칭 엔진이 minimatch 가 아니라 `ignore`(gitignore-style) 패키지임을 확인.
- 실제 설치된 `ignore` 패키지로 diff 의 `group` 4개 패턴(`@/components`, `@/components/**`, `**/../components`, `**/../components/**`)을 다양한 샘플 import 경로에 대해 직접 실행해 매칭 동작을 실측(오탐/누락 여부).
- `@eslint/config-array` 가 사용하는 `minimatch` 로 `files: ["src/lib/**"]` 글롭이 중첩 디렉터리(`src/lib/conversation/rag-types.ts` 등)를 재귀적으로 포함하고 `src/libfoo.ts`/`src/libextra/**` 같은 유사 이름에는 오탐하지 않음을 실측.
- `grep` 으로 현재 `src/lib/**` 트리 전체(정적 import, 동적 `import()`, `require()`)에서 `@/components` 또는 상대경로 `../components` 참조 실사용 여부 확인 (0건 → 규칙 추가로 기존 lint 가 즉시 깨지지 않음).
- 근거로 제시된 두 파일(`src/lib/conversation/rag-types.ts`, `src/components/editor/run-results/conversation-utils.ts`)의 상단 주석 원문 확인.
- `plan/complete/rag-tool-row-distinct-ui.md` 를 확인해 이 변경이 해당 plan 이 남긴 "후속 백로그: `lib/`→`components/` ESLint 가드" 항목의 구현임을 확인.
- `spec/conventions/` 전수 및 `spec/` 전역 grep 으로 이 레이어 규약을 명문화한 spec 문서가 존재하는지 확인 (없음 확인).

## 발견사항

- **[WARNING]** 동적 `import()` 표현식은 이 규칙으로 걸러지지 않는다 (엣지 케이스 커버리지 공백)
  - 위치: `codebase/frontend/eslint.config.mjs:41-61` (`no-restricted-imports` 설정 전체)
  - 상세: `no-restricted-imports` 코어 규칙은 `ImportDeclaration` / `ExportNamedDeclaration` / `ExportAllDeclaration` / `TSImportEqualsDeclaration` 리스너만 등록하고 `ImportExpression`(동적 `import(...)`)은 검사하지 않는다 (규칙 소스 코드로 직접 확인, `ImportExpression` 문자열이 전혀 등장하지 않음). `src/lib/**` 는 이미 동적 import 를 실사용 중이다 (`src/lib/stores/workspace-store.ts:55,66-68` 의 `await import("../api/auth")`, `import("sonner")` 등). 따라서 향후 누군가 `src/lib/**` 안에서 `await import("@/components/Foo")` 형태로 컴포넌트를 지연 로드하면, 요구사항이 금지하려는 "`src/lib/**` 가 `@/components/**` 를 import" 행위임에도 이 ESLint 설정은 이를 잡아내지 못하고 통과시킨다. 현재는 실사용 위반이 0건이라 즉시 문제는 없지만, "import 하는 것을 ESLint error 로 금지"라는 요구사항을 정적 `import`/`export...from` 문법으로만 충족하고 동적 import 경로는 구조적으로 비어 있다.
  - 제안: 완전한 커버리지가 필요하면 보조로 `no-restricted-syntax` 규칙에 `ImportExpression[source.value=/^@\/components|^(\.\.\/)+components/]` 같은 selector 를 추가하거나, `src/lib/**` 안에서는 동적 import 자체를 별도 규칙으로 제한하는 것을 검토. 현재 실사용 위반이 없으므로 CRITICAL 은 아니지만, 이 gap 을 의도적으로 수용하는지(문서화) 아니면 후속 커밋으로 메울지 판단이 필요.

- **[INFO]** 이 레이어 규약을 정의하는 공식 spec 문서가 없음 (spec 누락, 정보성)
  - 위치: `spec/conventions/*` 전수 확인 — 해당 규약 관련 문서 없음
  - 상세: 이번 ESLint 가드의 근거는 `src/lib/conversation/rag-types.ts:1-12` 와 `src/components/editor/run-results/conversation-utils.ts:1-4` 의 코드 주석, 그리고 `plan/complete/rag-tool-row-distinct-ui.md:16` 의 "후속 백로그: `lib/`→`components/` ESLint 가드" 한 줄뿐이며, `spec/conventions/` 에는 이 layering 규칙을 명문화한 문서가 없다. CLAUDE.md 정보 저장 표에 따르면 "정식 규약"은 `spec/conventions/<name>.md` 가 SoT 위치인데, 이 프런트엔드 아키텍처 규약은 코드 주석에만 근거를 두고 있어 코드-스펙 상호 참조가 비어 있다 (이번 작업의 rag-tool-row-distinct-ui plan 이 유사한 "상호 참조 0건" drift 를 §9.3/§9.1 사이에서 이미 지적한 패턴과 동일 성격).
  - 제안: 이 ESLint 가드가 프로젝트 표준으로 자리잡는다면 `spec/conventions/frontend-layering.md`(가칭) 신설을 `project-planner` 에 위임해 규약을 spec 화하는 것을 고려. 단, 본 변경 자체는 순수 lint 설정이고 developer 의 `spec/` 쓰기 금지 범위 내에서 정당하게 codebase 만 수정했으므로 CRITICAL/WARNING 은 아님.

- **[INFO]** `require()` 를 통한 우회는 이론상 미검사이나 현재 실사용 없음
  - 위치: `codebase/frontend/eslint.config.mjs:41-61`
  - 상세: `no-restricted-imports` 는 CommonJS `require()` 호출을 검사하지 않는다 (별도의 deprecated 규칙 `no-restricted-modules` 영역). 그러나 `src/lib/**` 전체를 grep 한 결과 `require(` 호출이 전혀 없어(ESM-only, `"module": "esnext"`), 이 경로는 현재 실질적 위험이 아니다.
  - 제안: 별도 조치 불필요. 동적 import 항목(WARNING)과 함께 향후 "완전한 layering 가드" 재검토 시 참고용으로만 남김.

## 검증된 정상 동작 (기능 완전성 근거)

- `files: ["src/lib/**"]` 는 `src/lib/conversation/rag-types.ts` 등 임의 깊이의 중첩 파일을 정확히 포함하며, `src/libfoo.ts`/`src/libextra/**` 같은 접두 문자열 충돌에는 오탐하지 않음 (minimatch 실측).
- `group` 패턴은 `@/components`, `@/components/foo`, `@/components/editor/run-results/conversation-utils`, `../components/foo`, `../../components/foo`, `../../../components/foo`(임의 depth 의 상위 이동 후 `components/` 진입) 를 모두 정확히 차단 대상으로 매칭하고, `@/components-foo`, `@/componentsUtil`, `./components/foo`(같은 디렉터리 하위의 무관한 `components` 폴더), `@/lib/foo`, `react` 같은 무관한 경로에는 매칭하지 않음 (`ignore` 패키지 직접 실행 실측) — false positive/negative 없음.
- `type` import(`import type { X } from "@/components/Foo"`) 도 `allowTypeImports` 미설정으로 함께 차단되며, 이는 메시지 문구("타입/유틸이 필요하면 그 대상을 src/lib/ 로 옮기고…")와 `rag-types.ts` 가 실제로 타입을 lib 로 옮긴 선례와 일치 — 의도·구현 괴리 없음.
- `export ... from "@/components/**"` 형태의 재수출도 `ExportNamedDeclaration`/`ExportAllDeclaration` 리스너로 함께 차단됨 (규칙 소스 확인).
- 현재 `src/lib/**` 전체(정적/동적 import, require 포함)에 `@/components` 또는 `../components` 참조가 0건이라, 이 규칙 추가로 기존 CI lint 가 즉시 깨지지 않음.
- `eslint-config-next`(v16.2.x) 의 base config 는 `no-restricted-imports` 를 별도로 설정하지 않아 이 신규 블록과 규칙 충돌/override 문제 없음.
- TODO/FIXME/HACK/XXX 주석: diff 내 없음.
- 반환값/에러 시나리오/데이터 유효성 항목은 이 변경이 순수 정적 설정(런타임 함수 아님)이라 해당 없음(N/A) — 문제 없음.

## 요약

이 변경은 "`src/lib/**` 가 `@/components/**` 를 import 하면 ESLint error" 라는 요구사항을 정적 `import`/`export ... from` 구문 및 alias(`@/components`)·임의 depth 상대경로(`../components`, `../../components`, ...) 형태에 대해 정확하고 오탐 없이 구현한다 — 실제 설치된 `ignore` 매칭 엔진과 `minimatch` 글롭 엔진으로 직접 실측 검증했다. 근거로 인용된 두 파일의 주석과도 정확히 일치하며, 이 작업이 `plan/complete/rag-tool-row-distinct-ui.md` 가 남긴 후속 백로그 항목의 구현임도 확인했다. 유일한 실질적 공백은 `no-restricted-imports` 규칙 자체의 구조적 한계로 동적 `import()` 표현식이 검사되지 않는다는 점이며, `src/lib/**` 가 이미 동적 import 를 사용 중이라 이론적 우회 경로가 존재한다(현재 실사용 위반은 0건). 관련 spec 문서가 없어 spec fidelity 는 회색지대(INFO)로, 이는 코드 결함이 아니라 규약이 아직 spec 화되지 않은 상태다.

## 위험도

LOW
