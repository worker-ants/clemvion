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

// eslint-config-next 프리셋을 포함한 flat config 배열. `src/lib/**` 를 매칭하는 블록만 추출.
const layeringBlock = (
  eslintConfig as ReadonlyArray<{ files?: readonly string[]; rules?: Record<string, unknown> }>
).find((c) => Array.isArray(c.files) && c.files.includes("src/lib/**"));

if (!layeringBlock?.rules) {
  throw new Error(
    'eslint.config.mjs 에서 `files: ["src/lib/**"]` 레이어 가드 블록을 찾지 못했습니다 — ' +
      "가드 자체가 fail-open 상태일 수 있습니다.",
  );
}

const linter = new Linter({ configType: "flat" });

const verifyConfig = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { ecmaVersion: "latest" as const, sourceType: "module" as const },
    rules: layeringBlock.rules,
  },
];

function layeringErrors(code: string) {
  return linter
    .verify(code, verifyConfig, "src/lib/probe.ts")
    .filter((m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax");
}

describe("src/lib layering guard (eslint.config.mjs, 실제 config 로드)", () => {
  it("config 가 src/lib/** 에 no-restricted-imports 와 no-restricted-syntax 를 함께 정의한다", () => {
    expect(layeringBlock.rules).toHaveProperty("no-restricted-imports");
    expect(layeringBlock.rules).toHaveProperty("no-restricted-syntax");
  });

  describe("위반으로 잡혀야 하는 형태", () => {
    it.each([
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
      expect(layeringErrors(code).length).toBeGreaterThan(0);
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
    ])("%s → no error", (_label, code) => {
      expect(layeringErrors(code).length).toBe(0);
    });
  });
});
