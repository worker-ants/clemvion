import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Hydration coverage guard.
 *
 * spec/conventions/data-hydration-surfaces.md §1 매트릭스 — backend handler
 * 가 영속하는 `output.result.*` field 가 frontend 의 모든 hydration 함수에서
 * picking-up 되는지 grep 검증. PR #271 의 이슈 #1 (실행 내역 페이지에서
 * presentations 안 보임) 와 같은 회귀를 build 단계에서 차단.
 *
 * 매트릭스 항목 1줄당 한 entry. 추가/삭제는 spec 매트릭스 + 본 테이블 동시
 * 갱신.
 */

const REPO_ROOT = resolve(__dirname, "../../../../../../");
const F = (rel: string) => readFileSync(resolve(REPO_ROOT, rel), "utf-8");

interface CoverageRow {
  /** Field name as it appears in `output.result.*` */
  field: string;
  /** Frontend hydration source files that must reference the field literal. */
  sites: string[];
}

// SoT: spec/conventions/data-hydration-surfaces.md §1.1.
const COVERAGE_MATRIX: CoverageRow[] = [
  {
    field: "messages",
    sites: [
      "codebase/frontend/src/lib/conversation/conversation-utils.ts",
      "codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts",
    ],
  },
  {
    field: "presentations",
    sites: [
      // Last-assistant attach in completed history hydration.
      "codebase/frontend/src/lib/conversation/conversation-utils.ts",
      // Live thread snapshot (turn-level) reads turn.presentations.
      // (same file — separate function, but a grep hit is enough)
    ],
  },
  {
    field: "turnCount",
    sites: [
      "codebase/frontend/src/lib/conversation/conversation-utils.ts",
      // ResultTimeline reads turn count for "Turn N/M" badge.
      "codebase/frontend/src/components/editor/run-results/result-timeline.tsx",
    ],
  },
  {
    // `maxTurns` is read directly off `outputData.output.conversationConfig`
    // by the timeline row; conversation-utils.ts itself doesn't surface it.
    field: "maxTurns",
    sites: [
      "codebase/frontend/src/components/editor/run-results/result-timeline.tsx",
    ],
  },
  {
    // `output.error` is surfaced by parseHistoryMessages (conversation-utils.ts)
    // which synthesises a `system_error` ConversationItem for the history view.
    // Live view is covered by use-execution-events.ts (node.failed / node.completed).
    // SoT: spec/conventions/data-hydration-surfaces.md §1 +
    //      spec/conventions/conversation-thread.md §9.10 CT-S9.
    field: "error",
    sites: [
      "codebase/frontend/src/lib/conversation/conversation-utils.ts",
    ],
  },
];

describe("output.result.* hydration coverage", () => {
  for (const row of COVERAGE_MATRIX) {
    for (const site of row.sites) {
      it(`'${row.field}' is referenced in ${site}`, () => {
        const src = F(site);
        // Match the field as either a property key (e.g. `result.messages`,
        // `result["messages"]`) or a destructured / typed identifier.
        const patterns = [
          new RegExp(`\\.${row.field}\\b`),
          new RegExp(`['"\\\`]${row.field}['"\\\`]`),
        ];
        const hit = patterns.some((p) => p.test(src));
        expect(
          hit,
          `Field '${row.field}' missing from ${site}. ` +
            `SoT: spec/conventions/data-hydration-surfaces.md §1.1`,
        ).toBe(true);
      });
    }
  }
});
