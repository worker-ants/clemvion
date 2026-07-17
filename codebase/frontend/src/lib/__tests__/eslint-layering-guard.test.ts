import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll } from "vitest";
import { Linter, ESLint } from "eslint";
import eslintConfig, { LOWER_LAYERS as CONFIG_LOWER_LAYERS } from "../../../eslint.config.mjs";

/**
 * Guard: `src/lib/**` 는 정적 import 뿐 아니라 동적 `import()` / CJS `require()` 로도
 * `@/components/**` (alias·상대경로 우회 포함)를 소비할 수 없다 (레이어 역전 금지).
 *
 * `src/lib` 에 현재 위반이 0건이라 `npx eslint src/lib` 는 이 규칙이 실제로 로드·매칭·
 * 발동하는지와 무관하게 항상 "0 errors" 로 통과한다 — 향후 `files` glob 오타, 규칙 옵션
 * 약화, `eslint-config-next` 업그레이드로 인한 병합 동작 변화가 있어도 CI 는 계속 초록일
 * 수 있다 (ai-review WARNING #1·#2, review/code/2026/07/17/16_33_59/SUMMARY.md).
 *
 * 픽스처를 이 테스트에 복제하지 않고 `eslint.config.mjs` 의 실제 `src/lib/**` 블록
 * (`no-restricted-imports` + `no-restricted-syntax`)을 그대로 가져와 ESLint `Linter#verify`
 * 에 먹인다 — config 가 나중에 조용히 약화돼도(오타/규칙 삭제/패턴 완화) 여기서 드러난다.
 */

// eslint-config-next 프리셋을 포함한 flat config 배열. 레이어 가드 블록을 **전부** 추출한다.
// ESLint 는 배열을 순회하며 동일 rule-ID 를 "나중 블록 우선"으로 병합하므로, 첫 블록만 보면
// 뒤쪽 override 가 규칙을 `"off"` 로 되돌려도 테스트는 초록으로 남는다 (fail-open).
// 블록 식별 키는 config 의 `LOWER_LAYERS` 첫 요소를 그대로 쓴다 — 하드코딩 리터럴이면 그쪽
// glob 표기가 바뀔 때 조용히 어긋난다.
const GUARD_BLOCK_KEY = CONFIG_LOWER_LAYERS[0]; // "src/lib/**"

type FlatBlock = {
  files?: readonly string[];
  rules?: Record<string, unknown>;
  languageOptions?: { parser?: unknown };
};

const blocks = eslintConfig as ReadonlyArray<FlatBlock>;

const layeringBlocks = blocks.filter(
  (c) => Array.isArray(c.files) && c.files.includes(GUARD_BLOCK_KEY),
);

// 실제 config 가 `.ts` 에 쓰는 파서를 그대로 빌려온다. 기본 espree 로는 TS 전용 구문
// (`import type`)을 파싱조차 못해 이 가드의 원래 동기 사례를 fixture 로 표현할 수 없다.
// `@typescript-eslint/parser` 를 직접 import 하지 않는 이유: frontend 매니페스트에 선언된
// 의존이 아니라(전이 의존) `node-linker=isolated` 에서 phantom-dependency 로 깨진다 —
// config 에서 꺼내 쓰면 프로덕션과 동일한 파서 인스턴스라 버전 스큐도 없다.
const tsParser = blocks
  .filter(
    (c) =>
      c.languageOptions?.parser &&
      (c.files === undefined || c.files.some((g) => g.includes("ts"))),
  )
  .map((c) => c.languageOptions!.parser)
  .at(-1);

if (!tsParser) {
  throw new Error(
    "eslint.config.mjs 에서 TypeScript 파서를 찾지 못했습니다 — " +
      "`import type` fixture 가 파싱 에러로 위장 통과할 수 있습니다.",
  );
}

// 나중 블록이 앞 블록을 덮어쓰는 flat config 병합 순서를 그대로 재현한다.
const mergedRules: Record<string, unknown> = Object.assign(
  {},
  ...layeringBlocks.map((c) => c.rules ?? {}),
);

if (Object.keys(mergedRules).length === 0) {
  throw new Error(
    `eslint.config.mjs 에서 \`files: ${JSON.stringify(CONFIG_LOWER_LAYERS)}\` 레이어 가드 블록을 ` +
      "찾지 못했거나 병합된 규칙이 비어 있습니다 — 가드 자체가 fail-open 상태일 수 있습니다.",
  );
}

// 규칙 설정에서 severity 를 꺼내 ESLint 의 숫자 표기(0/1/2)로 정규화한다.
// `["error", {...}]` 와 `[2, {...}]` 는 ESLint 상 동등하므로 둘 다 2 로 취급한다
// (문자열 비교만 하면 동등 표기 리팩터에 false-fail 한다).
const SEVERITY_BY_NAME: Record<string, number> = { off: 0, warn: 1, error: 2 };

function ruleSeverity(rule: unknown): number | undefined {
  const raw = Array.isArray(rule) ? rule[0] : rule;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return SEVERITY_BY_NAME[raw];
  return undefined;
}

const linter = new Linter({ configType: "flat" });

const verifyConfig = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest" as const,
      sourceType: "module" as const,
      parser: tsParser as Linter.Parser,
    },
    rules: mergedRules,
  },
];

function layeringErrors(code: string) {
  const messages = linter.verify(code, verifyConfig, "src/lib/probe.ts");
  // 파싱 에러(fatal, ruleId=null)는 아래 필터에 걸리지 않아 "위반 0건" 으로 둔갑한다 —
  // fixture 가 조용히 무력화되지 않도록 즉시 드러낸다.
  const fatal = messages.find((m) => m.fatal);
  if (fatal) {
    throw new Error(`fixture 파싱 실패 (line ${fatal.line}): ${fatal.message}`);
  }
  return messages.filter(
    (m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax",
  );
}

describe("src/lib layering guard (eslint.config.mjs, 실제 config 로드)", () => {
  it("config 가 src/lib/** 에 no-restricted-imports 와 no-restricted-syntax 를 함께 정의한다", () => {
    expect(mergedRules).toHaveProperty("no-restricted-imports");
    expect(mergedRules).toHaveProperty("no-restricted-syntax");
  });

  it("위반 메시지가 실제 계층 라벨과 규약 링크를 담는다 (문구 회귀 고정)", () => {
    // 메시지 상수(`LAYERS_LABEL`·`RESOLUTION_HINT`)는 `LOWER_LAYERS` 에서 파생된다.
    // length/severity 만 보는 다른 케이스는 라벨 누락·변수 뒤바뀜 같은 문구 회귀를 못 잡으므로
    // (ai-review WARNING), 세 진입점(정적/동적/require) 각각의 `.message` 를 직접 고정한다.
    const expectedLabel = CONFIG_LOWER_LAYERS.join(" · "); // "src/lib/** · src/types/**"
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['import { Foo } from "@/components/foo";', "@/components/** 를 import 할 수 없습니다"],
      ['export const load = () => import("@/components/foo");', "동적 import() 로도"],
      ['const mod = require("@/components/foo");', "require() 로도"],
    ];
    for (const [code, distinctPhrase] of cases) {
      const [first] = layeringErrors(code);
      expect(first?.message).toContain(expectedLabel);
      expect(first?.message).toContain("spec/conventions/frontend-layering.md");
      expect(first?.message).toContain(distinctPhrase);
    }
  });

  it("두 규칙 모두 severity 가 error(2) 다 — \"warn\" 으로 조용히 강등되면 CI lint 가 이 위반을" +
    " 통과시켜버린다 (max-warnings 무제한)", () => {
    expect(ruleSeverity(mergedRules["no-restricted-imports"])).toBe(2);
    expect(ruleSeverity(mergedRules["no-restricted-syntax"])).toBe(2);
  });

  describe("위반으로 잡혀야 하는 형태", () => {
    it.each([
      // bare 형태 (서브패스 없음) — 이 케이스가 없으면 config 의 bare 엔트리를 제거하는
      // mutation 이 테스트를 통과해버린다.
      ["정적 alias bare import", 'import "@/components";'],
      ["정적 상대경로 bare import", 'import "../components";'],
      ["동적 import() alias bare", 'export const load = () => import("@/components");'],
      ["require() 상대경로 bare", 'const mod = require("../components");'],
      ["정적 alias import", 'import { Foo } from "@/components/foo";'],
      ["정적 alias 하위 경로 import", 'import { Foo } from "@/components/foo/bar";'],
      ["정적 상대경로 우회(1단계)", 'import { Foo } from "../components/foo";'],
      ["정적 상대경로 우회(2단계)", 'import { Foo } from "../../components/foo";'],
      ["동적 import() alias", 'export const load = () => import("@/components/foo");'],
      ["동적 import() alias 하위 경로", 'export const load = () => import("@/components/foo/bar");'],
      ["동적 import() 상대경로 우회", 'export const load = () => import("../components/foo");'],
      [
        "동적 import() 상대경로 우회(2단계)",
        'export const load = () => import("../../components/foo");',
      ],
      ["require() alias", 'const mod = require("@/components/foo");'],
      ["require() 상대경로 우회", 'const mod = require("../components/foo");'],
      // 백틱(템플릿 리터럴) 형태 — `TemplateLiteral` 노드에는 `.value` 가 없어
      // `[source.value=/.../]` selector 가 조용히 빗나간다. 실제로 가드를 우회하던 경로.
      ["동적 import() 백틱 bare", "export const load = () => import(`@/components`);"],
      ["동적 import() 백틱 alias", "export const load = () => import(`@/components/foo`);"],
      ["동적 import() 백틱 상대경로", "export const load = () => import(`../components/foo`);"],
      ["require() 백틱 alias", "const mod = require(`@/components/foo`);"],
      ["require() 백틱 상대경로", "const mod = require(`../components/foo`);"],
      // 타입 전용 import — 이 가드의 원래 동기 사례(rag-types.ts)에 가장 가까운 형태.
      // 파서가 espree 면 파싱조차 안 돼 fixture 로 표현할 수 없다.
      ["정적 import type", 'import type { Foo } from "@/components/foo";'],
      ["정적 import type 상대경로", 'import type { Foo } from "../components/foo";'],
      // re-export — 가드 메시지가 "components 쪽에서 re-export 하세요" 라 방향 착각 개연성이 있다.
      ["re-export named", 'export { Foo } from "@/components/foo";'],
      ["re-export all", 'export * from "@/components/foo";'],
    ])("%s → error", (_label, code) => {
      const errors = layeringErrors(code);
      expect(errors.length).toBeGreaterThan(0);
      // 실제 Linter#verify 출력의 severity 를 직접 검증한다 — config 표기(문자열/숫자)와
      // 무관하게 규칙이 "error"→"warn" 으로 강등되면 여기서 즉시 실패한다(ESLint 의
      // `warn` severity 는 2 가 아닌 1).
      expect(errors.every((m) => m.severity === 2)).toBe(true);
    });
  });

  describe("위반으로 잡히면 안 되는 형태 (오탐 방지)", () => {
    it.each([
      ["무관한 정적 import", 'import { z } from "zod";'],
      ["src/lib 내부 상대 import (components 아님)", 'import { x } from "../types/foo";'],
      ["무관한 동적 import", 'export const load = () => import("sonner");'],
      [
        "무관한 상대경로 동적 import",
        'export const load = () => import("../api/auth");',
      ],
      ["무관한 require", 'const mod = require("../api/auth");'],
      // 근접 오탐 경계값 — "components" 를 접두어로만 공유할 뿐 실제로는 다른 디렉터리다.
      // 정규식이 앵커(`^...$`) 없이 느슨해지는 mutation 이 있으면 아래 두 케이스가 걸린다.
      ["근접 오탐: components-legacy 정적 import", 'import { Foo } from "@/components-legacy/x";'],
      ["근접 오탐: componentsShared require", 'const mod = require("../componentsShared/x");'],
      ["근접 오탐: 백틱 components-legacy", "export const load = () => import(`@/components-legacy/x`);"],
    ])("%s → no error", (_label, code) => {
      expect(layeringErrors(code).length).toBe(0);
    });

    // 계산된 경로는 정적 분석 대상이 아니다 — config 주석이 명시한 커버리지 한계를 테스트로
    // 고정해 둔다. "이것도 잡히겠지" 라는 착각(문서와 실제 동작의 괴리)을 막는 것이 목적.
    it("인터폴레이션이 섞인 백틱은 계산 경로라 잡지 않는다 (문서화된 커버리지 한계)", () => {
      const code = "export const load = (n: string) => import(`@/components/${n}`);";
      expect(layeringErrors(code).length).toBe(0);
    });
  });
});

/**
 * 위 스위트는 규칙의 **내용**(어떤 코드 형태를 잡는가)을 합성 config 로 검증한다 — 그 구조상
 * `files:` glob 은 우회되므로 규칙이 **어느 경로에 걸리는가**는 증명하지 못한다. glob 오타나
 * 스코프 축소(`src/types/**` 누락)는 위 스위트를 그대로 통과한다.
 *
 * 여기서는 실제 `ESLint` API 로 `eslint.config.mjs` 를 resolve 해 경로 매칭 자체를 확인한다.
 * 규약 SoT: spec/conventions/frontend-layering.md §1·§2·§4.
 */
describe("가드 스코프 — 실제 ESLint 경로 매칭", () => {
  const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

  // config 에서 가져오지 않고 **독립적으로 하드코딩**한다 — config 의 glob 을 지우는 mutation 이
  // 기대값까지 함께 지워 검증이 조용히 사라지는 false green 을 막기 위함. 아래 일치 단언이
  // 양쪽의 drift 를 잡으므로, 계층을 추가하면 여기서 실패하며 케이스 갱신을 요구한다.
  const EXPECTED_LOWER_LAYERS = ["src/lib/**", "src/types/**"] as const;

  let eslint: ESLint;
  beforeAll(() => {
    eslint = new ESLint({ cwd: FRONTEND_ROOT });
  });

  async function errorsAt(code: string, filePath: string) {
    const results = await eslint.lintText(code, { filePath, warnIgnored: false });
    return (results[0]?.messages ?? []).filter(
      (m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax",
    );
  }

  it("config 의 LOWER_LAYERS 가 규약이 규정하는 하위 계층과 정확히 일치한다", () => {
    expect([...CONFIG_LOWER_LAYERS].sort()).toEqual([...EXPECTED_LOWER_LAYERS].sort());
  });

  describe.each(EXPECTED_LOWER_LAYERS.map((glob) => glob.replace(/\/\*\*$/, "")))(
    "%s — 하위 계층이므로 차단된다",
    (layer) => {
      it.each([
        ["정적 import", 'import { Foo } from "@/components/foo";'],
        ["동적 import()", 'export const load = () => import("@/components/foo");'],
        ["require()", 'const mod = require("@/components/foo");'],
        ["백틱 동적 import()", "export const load = () => import(`@/components/foo`);"],
      ])("%s → error", async (_label, code) => {
        expect(await errorsAt(code, `${layer}/probe.ts`)).not.toHaveLength(0);
      });

      it("중첩 경로에도 glob 이 걸린다", async () => {
        const code = 'import { Foo } from "@/components/foo";';
        expect(await errorsAt(code, `${layer}/nested/deep/probe.ts`)).not.toHaveLength(0);
      });
    },
  );

  it.each([
    ["components — 같은 계층", "src/components/probe.tsx"],
    ["app — 최상위 계층", "src/app/probe.tsx"],
    // 근접 디렉터리 — glob 이 앵커 없이 느슨해지면(`src/type*`) 여기 걸린다.
    ["types-legacy — 근접 이름", "src/types-legacy/probe.ts"],
    ["libs — 근접 이름", "src/libs/probe.ts"],
  ])("%s 는 규약 대상이 아니므로 차단되지 않는다", async (_label, filePath) => {
    const code = 'import { Foo } from "@/components/foo";';
    expect(await errorsAt(code, filePath)).toHaveLength(0);
  });

  it("`src/lib/types/` 는 src/lib/** 계층에 속하므로 차단된다 (src/types/ 와 혼동 금지 — 규약 §1)", async () => {
    // 규약이 명시적으로 구분하는 두 "types 홈": src/lib/types/ 는 lib 계층 내부라 lib glob 으로
    // 잡히고, src/types/ 는 독립 하위 계층이다. 둘 다 차단되지만 근거 glob 이 다르다.
    const code = 'import { Foo } from "@/components/foo";';
    expect(await errorsAt(code, "src/lib/types/probe.ts")).not.toHaveLength(0);
  });
});
