// plan 트리 스캔 + 라이프사이클 불변식 — **테스트 밖에서 부를 수 있는** 순수 함수들.
//
// ## 왜 별 모듈인가
//
// 이 로직은 원래 `plan-frontmatter.test.ts` 안에 인라인으로 있었다. 그러면 fixture 로
// negative-path 를 증명할 수 없고, 실제로 리뷰가 실측했다 — 158 tests 전량 GREEN 인데
// 위반 수집 분기(`wrong.push`)는 **한 번도 실행되지 않았다.** "위반 0건" 은 검사가
// 작동한다는 증거가 아니다(ai-review WARNING).
//
// 자매 검사인 링크 무결성은 이미 `spec-links.ts` 로 추출돼 fixture 로 탐지를 증명하고
// 있었는데, 같은 파일의 status 검사만 그 교훈을 못 받고 있었다. 둘을 같은 자리로 맞춘다.
//
// ## 스캔 소스가 하나여야 하는 이유
//
// `plan/` 트리를 손으로 순회하는 walker 가 저장소에 네 벌 있었고, 서로 `0-`/`_` 접두
// 처리가 달랐다. 그 차이는 데이터가 그 형태를 갖는 순간에만 드러나므로 **조용히** 어긋난다.
// 여기서 두 수집기를 한 구현(`walkPlanMarkdown`)에서 파생시키고, Gate C
// (`spec-plan-completion.test.ts`)와 같은 면제 규칙을 쓴다.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface PlanMdFile {
  absPath: string;
  relPath: string;
}

/**
 * `0-`/`_` 접두는 인덱스 파일이라 라이프사이클 plan 이 아니다 — Gate C 의
 * `collectCompletePlans` 와 `plan-frontmatter.test.ts` 의 frontmatter 검사가 둘 다
 * 예전부터 면제해 온 규칙이고, 여기서도 같게 둔다. 한 트리를 보는 검사들이 서로 다른
 * 집합을 보면 "이 파일은 어느 가드가 지키는가" 가 사람마다 달라진다.
 */
function isLifecyclePlan(name: string): boolean {
  return name.endsWith(".md") && !name.startsWith("0-") && !name.startsWith("_");
}

/**
 * `plan/<bucket>/` 아래 `.md` 수집. `recurse: false` 면 top-level 만.
 * `archive/` 는 옛 memory/user_memo 보관소라 언제나 제외한다.
 */
function walkPlanMarkdown(
  root: string,
  bucket: string,
  options: { recurse: boolean },
): PlanMdFile[] {
  const dir = path.join(root, "plan", bucket);
  if (!fs.existsSync(dir)) return [];
  const out: PlanMdFile[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (!options.recurse) continue;
        if (e.name === "archive") continue;
        stack.push(full);
      } else if (e.isFile() && isLifecyclePlan(e.name)) {
        out.push({
          absPath: full,
          relPath: path.relative(root, full).split(path.sep).join("/"),
        });
      }
    }
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

/** 살아있는 plan — top-level `plan/in-progress/*.md`. 하위 그룹 폴더는 부속 문서라 제외. */
export function collectLivePlanMarkdown(root: string): PlanMdFile[] {
  return walkPlanMarkdown(root, "in-progress", { recurse: false });
}

/** 완료된 plan — `plan/complete/**.md` (archive 제외). */
export function collectCompletePlanMarkdown(root: string): PlanMdFile[] {
  return walkPlanMarkdown(root, "complete", { recurse: true });
}

/**
 * `plan/complete/**` 에서 허용되는 `status` 값.
 *
 * `in-progress` 는 **디렉터리와 정면으로 모순**이라 여기 없다 — 그것이 이 저장소가 두 번
 * 겪은 실패다(`#1108`·`#1117`). 나머지 셋은 실측으로 발견된 기존 어휘로, 눕히지 않고
 * 보존한다: 특히 `superseded` 는 "대체됨" 이라 완료가 아니고 일괄 `complete` 로 바꿨다면
 * 그 의미가 사라진다.
 */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "complete",
  "implemented",
  "applied",
  "superseded",
]);

export interface NonTerminalPlan {
  relPath: string;
  status: string;
}

/**
 * `plan/complete/**` 에 있으면서 종료 상태가 아닌 `status` 를 선언한 plan.
 *
 * `status` 는 **선택 필드**다(`plan-lifecycle.md §4` — 필수는 worktree/started/owner 셋).
 * 선언하지 않은 문서는 위반이 아니며, 선언했는데 디렉터리와 모순되는 것만 잡는다.
 * frontmatter 파싱 실패는 이 검사의 관심사가 아니라 건너뛴다(다른 가드의 소관).
 */
export function findNonTerminalCompletedPlans(root: string): NonTerminalPlan[] {
  const out: NonTerminalPlan[] = [];
  for (const f of collectCompletePlanMarkdown(root)) {
    let data: Record<string, unknown> = {};
    try {
      data = matter(fs.readFileSync(f.absPath, "utf8")).data ?? {};
    } catch {
      continue;
    }
    const status = data.status;
    if (typeof status !== "string") continue;
    if (!TERMINAL_STATUSES.has(status)) {
      out.push({ relPath: f.relPath, status });
    }
  }
  return out;
}
