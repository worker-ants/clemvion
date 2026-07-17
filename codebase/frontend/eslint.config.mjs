import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // 그 우회 경로를 보조로 커버한다. 다만 두 규칙 모두 문자열 리터럴 specifier 만 매칭한다
    // (`import(someVar)` 처럼 계산된 동적 경로는 여전히 정적 분석 불가능 영역).
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
          // 동적 import("@/components/...") / import("../components/...") — 리터럴 specifier 형태만.
          selector:
            "ImportExpression[source.value=/^(@\\/components(\\/.*)?|(\\.\\.\\/)+components(\\/.*)?)$/]",
          message:
            "레이어 역전: src/lib/** 은 동적 import() 로도 @/components/** 를 import 할 수 없습니다. 타입/유틸이 필요하면 그 대상을 src/lib/ 로 옮기고, components 쪽에서 re-export 하세요.",
        },
        {
          // CJS require("@/components/...") / require("../components/...") — 리터럴 인자 형태만.
          selector:
            "CallExpression[callee.name='require'][arguments.0.value=/^(@\\/components(\\/.*)?|(\\.\\.\\/)+components(\\/.*)?)$/]",
          message:
            "레이어 역전: src/lib/** 은 require() 로도 @/components/** 를 import 할 수 없습니다. 타입/유틸이 필요하면 그 대상을 src/lib/ 로 옮기고, components 쪽에서 re-export 하세요.",
        },
      ],
    },
  },
]);

export default eslintConfig;
