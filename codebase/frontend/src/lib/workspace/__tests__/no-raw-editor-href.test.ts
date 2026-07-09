import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SRC, collectSourceFiles, findRawHrefOffenders } from "./href-guard-utils";

/**
 * Guard: 에디터 캔버스 경로(`/workflows/<id>`)는 **반드시** `buildEditorHref(slug, workflowId)` 로
 * 조립한다.
 *
 * 슬러그 라우팅 phase 2 에서 에디터가 `(editor)/w/[slug]/workflows/[id]` 로 편입돼 실행 경로처럼
 * 항상 slug 를 붙여야 한다. 리터럴이 여러 소비처(create-then-push·트리거/스케줄/통합 카드·행 클릭)에
 * 흩어져 한 곳이 slug 를 빠뜨리는 broken-link 회귀가 반복됐다(PR #865/#866 같은 멀티라인 `router.push`
 * 클래스). raw `` `/workflows/${id}` `` 템플릿 리터럴을 소스에서 금지해 그 클래스를 CI 로 차단한다.
 *
 * regex 는 **경로가 `${id}` 에서 끝나는**(닫는 backtick 이 `}` 바로 뒤) 리터럴만 매칭하므로 실행
 * 경로(`/workflows/${id}/executions`, 별도 guard)와 겹치지 않는다. `router.push(` prefix 를 요구하지
 * 않아 개행 분리된 멀티라인 호출도 잡는다. 소스 트리 수집·스캔 골격은 `href-guard-utils.ts` 를 공유한다.
 *
 * 예외(네비게이션이 아닌 정당한 `/workflows/${id}` 생성처):
 *  - `lib/workspace/href.ts` — `buildEditorHref` 헬퍼 자신.
 *  - `lib/api/**` — REST 클라이언트의 `/api/workflows/:id` 경로(문자열이 같을 뿐 네비게이션 아님).
 *  - `lib/notifications/href.ts` — 알림 딥링크는 slug 컨텍스트 없이 bare 발행, catch-all 이 흡수(결정).
 */

// `\`/workflows/${...}` + 닫는 backtick. `${...}` 는 첫 `}` 까지 non-greedy → 경로가 id 에서 끝나는
// 리터럴만(하위 세그먼트 없는 에디터 캔버스 경로) 매칭.
const RAW_EDITOR_HREF = /`\/workflows\/\$\{[^`]*?\}`/;

const HELPER = path.join(SRC, "lib", "workspace", "href.ts");
const API_DIR = path.join(SRC, "lib", "api");
const NOTIF_HREF = path.join(SRC, "lib", "notifications", "href.ts");

function isExempt(f: string): boolean {
  return f === HELPER || f === NOTIF_HREF || f.startsWith(API_DIR + path.sep);
}

describe("no raw editor href literals (use buildEditorHref)", () => {
  it("has no `/workflows/<id>` raw literals outside the helper/api/notifications", () => {
    expect(findRawHrefOffenders(RAW_EDITOR_HREF, isExempt)).toEqual([]);
  });

  // regex self-test — "현재 위반 0건"만으로는 정규식 약화(이스케이프 실수)를 놓쳐 guard 가 조용히
  // 무력화된다. 알려진 위반은 match, 안전/무관 형태는 non-match 임을 고정한다.
  describe("RAW_EDITOR_HREF true/false positives", () => {
    it.each([
      ["router.push", "router.push(`/workflows/${id}`)"],
      ["href=", "href={`/workflows/${w.workflowId}`}"],
      ["router.replace", "router.replace(`/workflows/${wf}`)"],
      // 멀티라인 호출(리터럴만 매칭 → prefix 개행과 무관)
      ["멀티라인 리터럴", "router.push(\n  `/workflows/${id}`,\n)"],
    ])("matches a raw editor literal — %s", (_label, src) => {
      expect(RAW_EDITOR_HREF.test(src)).toBe(true);
    });

    it.each([
      ["헬퍼 호출", "buildEditorHref(slug, workflowId)"],
      ["실행 경로(별도 guard)", "`/workflows/${id}/executions`"],
      ["하위 세그먼트", "`/workflows/${id}/settings`"],
      ["id 없는 목록", "`/workflows`"],
      ["문자열 연결(알려진 미탐지)", '"/workflows/" + id'],
    ])("does not match a non-editor-nav form — %s", (_label, src) => {
      expect(RAW_EDITOR_HREF.test(src)).toBe(false);
    });
  });

  it("resolves SRC + exemptions correctly (guard does not fail open)", () => {
    expect(fs.existsSync(HELPER)).toBe(true);
    expect(fs.existsSync(NOTIF_HREF)).toBe(true);
    expect(fs.existsSync(API_DIR)).toBe(true);
    expect(collectSourceFiles().length).toBeGreaterThan(50);
  });
});
