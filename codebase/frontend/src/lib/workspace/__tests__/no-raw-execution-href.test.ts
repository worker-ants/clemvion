import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guard: 실행 목록/상세 경로(`/workflows/<id>/executions[/<execId>]`)는 **반드시**
 * `buildExecutionHref(slug, workflowId, executionId?)` 로만 조립한다.
 *
 * 이 경로는 `(main)` 라우트라 항상 slug 를 붙여야 하는데(에디터 canvas `/workflows/<id>` 와 달리
 * bare 예외가 없다), 리터럴이 여러 소비처에 흩어져 한 곳이 slug 를 빠뜨리는 broken-link 회귀가
 * 반복됐다(PR #865 rerun-modal·executions row-click·dashboard·prev/next). raw 템플릿 리터럴을
 * 소스에서 금지해 그 클래스를 CI 로 차단한다. ESLint `no-restricted-syntax` 는 템플릿 리터럴이
 * quasi 로 쪼개져 AST 매칭이 취약하므로, 소스 텍스트 기반 guard 테스트로 강제한다.
 */

// `\`/workflows/${...}/executions` 형태의 raw 템플릿 리터럴. `${...}` 는 첫 `}` 까지 non-greedy.
const RAW_EXECUTION_HREF = /`\/workflows\/\$\{[^`]*?\}\/executions/;

const SRC = path.join(__dirname, "..", "..", "..");
// 헬퍼 정의 자신은 예외(경로 조립의 단일 진실).
const HELPER = path.join(SRC, "lib", "workspace", "href.ts");

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("no raw execution href literals (use buildExecutionHref)", () => {
  it("has no `/workflows/<id>/executions` raw literals outside the helper", () => {
    const offenders = collectSourceFiles(SRC)
      .filter((f) => f !== HELPER)
      .filter((f) => RAW_EXECUTION_HREF.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
