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
const layeringBlocks = (
  eslintConfig as ReadonlyArray<{ files?: readonly string[]; rules?: Record<string, unknown> }>
).filter((c) => Array.isArray(c.files) && c.files.includes("src/lib/**"));

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

// 규칙 배열의 첫 원소(severity)를 문자열/숫자 어느 표기든 정규화해 꺼낸다.
// (예: `["error", {...}]` → `"error"`, 배열이 아니면 값 그대로.)
function ruleSeverity(rule: unknown): unknown {
  return Array.isArray(rule) ? rule[0] : rule;
}

const linter = new Linter({ configType: "flat" });

const verifyConfig = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { ecmaVersion: "latest" as const, sourceType: "module" as const },
    rules: mergedRules,
  },
];

function layeringErrors(code: string) {
  return linter
    .verify(code, verifyConfig, "src/lib/probe.ts")
    .filter((m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax");
}

describe("src/lib layering guard (eslint.config.mjs, 실제 config 로드)", () => {
  it("config 가 src/lib/** 에 no-restricted-imports 와 no-restricted-syntax 를 함께 정의한다", () => {
    expect(mergedRules).toHaveProperty("no-restricted-imports");
    expect(mergedRules).toHaveProperty("no-restricted-syntax");
  });

  it("두 규칙 모두 severity 가 \"error\" 다 — \"warn\" 으로 조용히 강등되면 CI lint 가 이 위반을" +
    " 통과시켜버린다 (max-warnings 무제한)", () => {
    expect(ruleSeverity(mergedRules["no-restricted-imports"])).toBe("error");
    expect(ruleSeverity(mergedRules["no-restricted-syntax"])).toBe("error");
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
    ])("%s → no error", (_label, code) => {
      expect(layeringErrors(code).length).toBe(0);
    });
  });
});
