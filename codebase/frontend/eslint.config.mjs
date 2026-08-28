// ⚠️ 이 워크스페이스는 **eslint 9 에 남는다** (backend·`packages/*` 9개는 2026-08-28 에
// eslint 10 으로 올렸다 — `plan/in-progress/deps-peer-gating-and-eslint10.md` §2).
//
// 상류가 막는다. `eslint-config-next` 자신의 peer 는 `eslint: >=9.0.0` 이라 열려 보이지만,
// 그 **의존성**들이 eslint 9 를 상한으로 못 박는다 — 2026-08-28 registry 실측(각 패키지의
// latest 기준):
//
//   eslint-plugin-react      7.37.5  peer eslint `^3 || … || ^9.7`
//   eslint-plugin-jsx-a11y   6.10.2  peer eslint `^3 || … || ^9`
//   eslint-plugin-import     2.32.0  peer eslint `^2 || … || ^9`
//   eslint-plugin-react-hooks 7.1.1  peer eslint `… || ^10.0.0`   ← registry 는 10 지원
//
// 즉 셋은 **eslint 10 을 지원하는 버전이 아직 존재하지 않는다**(latest 조차). 올리면
// `pnpm install --strict-peer-dependencies` 가 CI 5개 설치 지점 전부에서 실패한다 — 실제로
// 상향을 시도해 그 실패를 확인하고 되돌린 것이 이 주석의 근거다.
//
// ⚠️ **위 표는 registry 기준이다. 우리 트리의 차단자는 넷이다** (2026-08-28 lockfile 실측).
// `eslint-plugin-react-hooks` 는 registry latest(7.1.1)가 `^10.0.0` 을 넣어 "차단자 아님" 으로
// 보이지만, `pnpm-workspace.yaml` 의 **`eslint-plugin-react-hooks: 7.0.1` exact 핀** 때문에
// 우리 lockfile 은 7.0.1 을 고정하고 그 버전 상한은 `^9.0.0` 이다. **registry 를 재고 우리
// 트리를 재지 않으면 틀린다** — 이 표가 정확히 그 함정에 빠졌던 자리다.
//
// 그래서 해제 레버가 둘로 갈린다:
//   - 앞의 셋 → **상류 릴리스 대기**. 우리가 할 수 있는 게 없다.
//   - react-hooks → **우리 override 값**이라 우리가 올리면 된다. 단 그 핀에는 근거 주석이
//     없다(`ef3617a79` pnpm 마이그레이션 유입) — 올리기 전에 왜 exact 였는지부터 확인할 것.
//
// `peerDependencyRules` 로 억제하지 않았다: 이 저장소는 억제에 "그 코드에 도달하지 않는다"
// 수준의 실측을 요구하는데(`pnpm-workspace.yaml` §peer dependency 게이트), 여기서는
// 플러그인들이 실제로 eslint 10 위에서 **돌아야 하는** 대상이라 미검증 억제가 곧 fail-open 이다.
//
// 푸는 조건: **넷 모두**의 peer 가 `^10` 을 받는 것. 그때 `eslint: "^9"` 를 올리면 된다.
// 그 시점은 사람이 다시 재지 않아도 된다 — 상시 캐너리가 알린다:
// `src/lib/repo-guards/__tests__/eslint10-unblock.test.ts`. 배제가 풀리면 그 테스트가
// **RED 로 해제를 통지**한다(방향이 거꾸로인 가드). 단 그것은 registry 가 아니라 **우리
// lockfile** 을 본다 — 유입은 dependabot 이 담당한다.
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

// `@/components/**` 를 소비할 수 없는 하위 계층. 규약 SoT: spec/conventions/frontend-layering.md §1·§2.
// `src/types` 는 import 0건 leaf 이고 `src/lib`·`src/components` 가 함께 소비하므로 계층상 lib 보다
// 아래다 — 규칙의 근거는 "lib 이라는 디렉터리 이름" 이 아니라 "계층 지위" 다 (§Rationale).
// 회귀 테스트가 이 배열을 import 해 자기 기대값과 대조한다 (`eslint-layering-guard.test.ts`).
export const LOWER_LAYERS = ["src/lib/**", "src/types/**"];

const LAYERS_LABEL = LOWER_LAYERS.join(" · ");
const RESOLUTION_HINT =
  "타입/유틸이 필요하면 그 대상을 src/lib/ 로 옮기고, components 쪽에서 re-export 하세요 (spec/conventions/frontend-layering.md §3).";

const STATIC_IMPORT_MSG = `레이어 역전: ${LAYERS_LABEL} 은 @/components/** 를 import 할 수 없습니다. ${RESOLUTION_HINT}`;
const DYNAMIC_IMPORT_MSG = `레이어 역전: ${LAYERS_LABEL} 은 동적 import() 로도 @/components/** 를 import 할 수 없습니다. ${RESOLUTION_HINT}`;
const REQUIRE_MSG = `레이어 역전: ${LAYERS_LABEL} 은 require() 로도 @/components/** 를 import 할 수 없습니다. ${RESOLUTION_HINT}`;

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
    // 하위 계층은 `@/components/**` 를 소비하지 않는다 (레이어 역전 금지).
    // 규약·근거·위반 시 해소법: spec/conventions/frontend-layering.md
    //
    // 커버리지 한계: `no-restricted-imports` 는 정적 import/export 선언만 검사하고 동적
    // `import()` 및 CJS `require()` 는 검사하지 않는다 — 아래 `no-restricted-syntax` 가
    // 그 우회 경로를 보조로 커버한다 (문자열·백틱 리터럴 specifier 모두).
    // 남은 사각지대: 경로가 **계산값**인 경우 (`import(someVar)`,
    // `` import(`@/components/${name}`) ``) — 정적 분석 불가능 영역이라 어떤 규칙도 못 막는다.
    files: LOWER_LAYERS,
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
              message: STATIC_IMPORT_MSG,
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
