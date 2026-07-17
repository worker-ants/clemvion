import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// `@/components` · `../components` (bare 및 하위 경로) 를 매칭하는 esquery 정규식 소스.
// 아래 동적 `import()` / `require()` selector 들이 공유한다 — 한쪽만 완화되는 drift 방지.
const COMPONENTS_PATH_RE = String.raw`^(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)$`;

// 리터럴 specifier 는 두 가지 AST 형태로 나타나며 매칭 방식이 다르다:
//  - 문자열 리터럴(`"..."` / `'...'`) → `Literal` 노드, `.value` 로 비교.
//  - 인터폴레이션 없는 백틱(`` `...` ``) → `TemplateLiteral` 노드. `.value` 프로퍼티 자체가
//    없어 `.value` 매칭이 조용히 실패한다(가드 우회) — `quasis[0].value.raw` 를 봐야 한다.
//    `expressions.length=0` 으로 한정하는 이유는 `` import(`@/components/${x}`) `` 처럼
//    인터폴레이션이 섞이면 경로가 계산값이라 정적 분석 대상이 아니기 때문.
const literalSpecifier = (path) => `[${path}.value=/${COMPONENTS_PATH_RE}/]`;
const backtickSpecifier = (path) =>
  `[${path}.expressions.length=0][${path}.quasis.0.value.raw=/${COMPONENTS_PATH_RE}/]`;

const DYNAMIC_IMPORT_MSG =
  "레이어 역전: src/lib/** 은 동적 import() 로도 @/components/** 를 import 할 수 없습니다. 타입/유틸이 필요하면 그 대상을 src/lib/ 로 옮기고, components 쪽에서 re-export 하세요.";
const REQUIRE_MSG =
  "레이어 역전: src/lib/** 은 require() 로도 @/components/** 를 import 할 수 없습니다. 타입/유틸이 필요하면 그 대상을 src/lib/ 로 옮기고, components 쪽에서 re-export 하세요.";

const REQUIRE_CALL = "CallExpression[callee.name='require']";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // co-deployed web-chat widget bundle (built artifact, copy-widget.mjs)
    "public/_widget/**",
  ]),
  {
    // `src/lib/**` 은 `@/components/**` 를 소비하지 않는다 (레이어 역전 금지).
    // 배경 주석: src/lib/conversation/rag-types.ts ·
    // src/components/editor/run-results/conversation-utils.ts
    //
    // 커버리지 한계: `no-restricted-imports` 는 정적 import/export 선언만 검사하고 동적
    // `import()` 및 CJS `require()` 는 검사하지 않는다 — 아래 `no-restricted-syntax` 가
    // 그 우회 경로를 보조로 커버한다 (문자열·백틱 리터럴 specifier 모두).
    // 남은 사각지대: 경로가 **계산값**인 경우 (`import(someVar)`,
    // `` import(`@/components/${name}`) ``) — 정적 분석 불가능 영역이라 어떤 규칙도 못 막는다.
    files: ["src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components",
                "@/components/**",
                // alias 를 우회한 상대경로 형태 (../components, ../../components ...)
                "**/../components",
                "**/../components/**",
              ],
              message:
                "레이어 역전: src/lib/** 은 @/components/** 를 import 할 수 없습니다. 타입/유틸이 필요하면 그 대상을 src/lib/ 로 옮기고, components 쪽에서 re-export 하세요.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // 동적 import("@/components/...") / import("../components/...")
          selector: `ImportExpression${literalSpecifier("source")}`,
          message: DYNAMIC_IMPORT_MSG,
        },
        {
          // 동적 import(`@/components/...`) — 백틱 리터럴.
          selector: `ImportExpression${backtickSpecifier("source")}`,
          message: DYNAMIC_IMPORT_MSG,
        },
        {
          // CJS require("@/components/...") / require("../components/...")
          selector: `${REQUIRE_CALL}${literalSpecifier("arguments.0")}`,
          message: REQUIRE_MSG,
        },
        {
          // CJS require(`@/components/...`) — 백틱 리터럴.
          selector: `${REQUIRE_CALL}${backtickSpecifier("arguments.0")}`,
          message: REQUIRE_MSG,
        },
      ],
    },
  },
]);

export default eslintConfig;
