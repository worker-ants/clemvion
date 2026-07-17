import { describe, it, expect } from "vitest";
import { Linter } from "eslint";
import eslintConfig from "../../../eslint.config.mjs";

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

// eslint-config-next 프리셋을 포함한 flat config 배열. `src/lib/**` 를 매칭하는 블록을 **전부**
// 추출한다. ESLint 는 배열을 순회하며 동일 rule-ID 를 "나중 블록 우선"으로 병합하므로, 첫 블록만
// 보면 뒤쪽 override 가 규칙을 `"off"` 로 되돌려도 테스트는 초록으로 남는다 (fail-open).
// 주의: 아래 `"src/lib/**"` 리터럴은 `eslint.config.mjs` 의 `files:` 표기와 정확히 일치해야
// 탐색된다 — 그쪽 glob 표현을 바꾸면 이 리터럴도 함께 갱신할 것.
type FlatBlock = {
  files?: readonly string[];
  rules?: Record<string, unknown>;
  languageOptions?: { parser?: unknown };
};

const blocks = eslintConfig as ReadonlyArray<FlatBlock>;

const layeringBlocks = blocks.filter(
  (c) => Array.isArray(c.files) && c.files.includes("src/lib/**"),
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
    'eslint.config.mjs 에서 `files: ["src/lib/**"]` 레이어 가드 블록을 찾지 못했거나 병합된 규칙이 ' +
      "비어 있습니다 — 가드 자체가 fail-open 상태일 수 있습니다.",
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
