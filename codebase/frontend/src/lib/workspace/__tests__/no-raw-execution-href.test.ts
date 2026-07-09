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

  // regex 자체의 self-test — "현재 위반 0건" 검증만으로는 정규식이 (이스케이프 실수 등으로)
  // 조용히 약화돼도 그 시점에 우연히 위반이 없으면 통과해 guard 가 무력화된다. 알려진 위반은
  // 반드시 match, 안전한 형태는 반드시 non-match 임을 고정해 그 fail-open 을 차단한다.
  describe("RAW_EXECUTION_HREF true/false positives", () => {
    it.each([
      ["목록 리터럴", "router.push(`/workflows/${workflowId}/executions`)"],
      ["상세 리터럴", "`/workflows/${id}/executions/${execId}`"],
      ["replace 경유", "router.replace(`/workflows/${wf}/executions`)"],
    ])("matches a raw execution literal — %s", (_label, src) => {
      expect(RAW_EXECUTION_HREF.test(src)).toBe(true);
    });

    it.each([
      ["헬퍼 호출", "buildExecutionHref(slug, workflowId, executionId)"],
      ["에디터 canvas 경로(executions 아님)", "`/workflows/${id}`"],
      ["다른 하위 경로", "`/workflows/${id}/settings`"],
      // 문자열 연결식은 탐지 대상 밖(문서화된 의도적 한계) — 여기 고정해 회귀 시 드러나게 한다.
      ["문자열 연결(알려진 미탐지)", '"/workflows/" + id + "/executions"'],
    ])("does not match a safe form — %s", (_label, src) => {
      expect(RAW_EXECUTION_HREF.test(src)).toBe(false);
    });
  });

  // SRC 경로 결합(상대 깊이) sanity — 테스트 파일 위치가 바뀌어 SRC 가 엉뚱한 곳을 가리키면
  // 스캔이 아무 파일도 못 찾고 fail-open(빈 offenders 로 통과)한다. 헬퍼 실존을 앵커로 확인.
  it("resolves SRC correctly (guard does not fail open)", () => {
    expect(fs.existsSync(HELPER)).toBe(true);
    expect(collectSourceFiles(SRC).length).toBeGreaterThan(50);
  });
});
